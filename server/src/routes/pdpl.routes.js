/**
 * pdpl.routes.js — محرك حماية البيانات الشخصية (P0-06):
 *   /api/dsar      طلبات أصحاب البيانات (وصول/نسخة/تصحيح/إتلاف) — م12 من PDPL
 *   /api/ropa      سجل أنشطة المعالجة — المادة 33 من اللائحة التنفيذية
 *   /api/breaches  حوادث تسرب البيانات + عداد الإبلاغ لسدايا (72 ساعة)
 *
 * كل المدد من مركز المعايير (policyStore) — لا أرقام صلبة في المنطق.
 */
const express = require('express');
const { z } = require('zod');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const prisma = require('../prisma');
const policyStore = require('../utils/policyStore');
const {
  DSAR_TYPES, ERASURE_FIELDS,
  computeDsarDueDate, computeExtendedDue,
  dsarCanDecide, dsarCanExtend, breachSdaiaWindow, erasureEligibility,
} = require('../utils/pdpl');

// ==== /api/dsar ====
const dsar = express.Router();
dsar.use(authenticate);

const dsarCreateSchema = z.object({
  type: z.enum(DSAR_TYPES),
  details: z.string().max(2000).optional().nullable(),
  contact: z.string().max(200).optional().nullable(),
});

// تقديم طلب من بوابة الموظف (أو مستخدم بلا ملف موظف — يُربط بالبريد)
dsar.post('/', requirePerm('self.profile.read'), async (req, res, next) => {
  try {
    const data = dsarCreateSchema.parse(req.body);
    const responseDays = policyStore.get('dsar.responseDays');
    const row = await prisma.dsarRequest.create({
      data: {
        employeeId: req.user.employeeId || null,
        requesterName: req.user.fullNameAr,
        requesterContact: data.contact || req.user.email || null,
        type: data.type,
        details: data.details || null,
        status: 'submitted',
        dueDate: computeDsarDueDate(new Date(), responseDays),
      },
    });
    audit(req, 'dsar.create', { entityType: 'dsar_request', entityId: String(row.id), afterJson: { type: data.type } });
    res.status(201).json({ request: row, responseDays });
  } catch (e) { next(e); }
});

// طلباتي — ملك حصري: صاحب الطلب فقط
dsar.get('/me', requirePerm('self.profile.read'), async (req, res, next) => {
  try {
    const where = req.user.employeeId
      ? { employeeId: req.user.employeeId }
      : { requesterContact: req.user.email || '__none__' };
    const requests = await prisma.dsarRequest.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, type: true, status: true, details: true, dueDate: true, extendedDueDate: true, resolution: true, createdAt: true },
    });
    res.json({ requests });
  } catch (e) { next(e); }
});

// قائمة الانتظار — DPO
dsar.get('/', requirePerm('pdpl.read'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await prisma.dsarRequest.findMany({
      where: status ? { status: String(status) } : {},
      orderBy: { createdAt: 'desc' }, take: 200,
      include: {
        employee: { select: { id: true, employeeNumber: true, fullNameAr: true } },
      },
    });
    const responseDays = policyStore.get('dsar.responseDays');
    res.json({ requests, responseDays });
  } catch (e) { next(e); }
});

// البت: تنفيذ أو رفض مسبب
dsar.post('/:id/decision', requirePerm('pdpl.dsar.review'), async (req, res, next) => {
  try {
    const data = z.object({
      outcome: z.enum(['completed', 'rejected']),
      resolution: z.string().min(3).max(2000),
    }).parse(req.body);
    const row = await prisma.dsarRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!dsarCanDecide(row.status)) return res.status(409).json({ error: `لا يمكن البت في طلب حالته ${row.status}` });
    const updated = await prisma.dsarRequest.update({
      where: { id: row.id },
      data: { status: data.outcome, resolution: data.resolution, decidedById: req.user.id },
    });
    audit(req, `dsar.${data.outcome}`, {
      entityType: 'dsar_request', entityId: String(row.id),
      beforeJson: { status: row.status }, afterJson: { status: data.outcome }, reason: data.resolution,
    });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

// تمديد مسبب (+dsar.extensionDays)
dsar.post('/:id/extend', requirePerm('pdpl.dsar.extend'), async (req, res, next) => {
  try {
    const data = z.object({ reason: z.string().min(3).max(1000) }).parse(req.body);
    const row = await prisma.dsarRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!dsarCanExtend(row.status)) return res.status(409).json({ error: `لا يمكن تمديد طلب حالته ${row.status}` });
    const extensionDays = policyStore.get('dsar.extensionDays');
    const extendedDueDate = computeExtendedDue(row.dueDate, row.extendedDueDate, extensionDays);
    const updated = await prisma.dsarRequest.update({
      where: { id: row.id },
      data: { status: 'extended', extendedDueDate },
    });
    audit(req, 'dsar.extend', {
      entityType: 'dsar_request', entityId: String(row.id),
      afterJson: { extendedDueDate, extensionDays }, reason: data.reason,
    });
    res.json({ request: updated, extensionDays, reason: data.reason });
  } catch (e) { next(e); }
});

// النسخة القابلة للنقل (JSON/CSV) — بيانات صاحب الطلب نفسه
function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);
  return '\uFEFF' + [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

dsar.get('/:id/export', requirePerm('pdpl.dsar.review'), async (req, res, next) => {
  try {
    const row = await prisma.dsarRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { employee: true },
    });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!row.employee) return res.status(409).json({ error: 'لا يوجد ملف موظف مرتبط بالطلب — النسخة القابلة للنقل تتطلب ملف موظف' });
    const emp = row.employee;
    audit(req, 'dsar.export', { entityType: 'dsar_request', entityId: String(row.id), afterJson: { employeeId: emp.id } });

    const [leaveCount, incidentCount, payslipCount] = await Promise.all([
      prisma.leaveRequest.count({ where: { employeeId: emp.id } }).catch(() => 0),
      prisma.attendanceIncident.count({ where: { employeeId: emp.id } }).catch(() => 0),
      prisma.payrollItem.count({ where: { employeeId: emp.id } }).catch(() => 0),
    ]);

    const payload = {
      meta: { generatedAt: new Date().toISOString(), dsarId: row.id, type: row.type, basis: 'المادة (11): حق الحصول على نسخة — بيانات صاحب الطلب نفسه' },
      profile: {
        employeeNumber: emp.employeeNumber, fullNameAr: emp.fullNameAr, fullNameEn: emp.fullNameEn,
        nationality: emp.nationality, gender: emp.gender, dobHijri: emp.dobHijri,
        email: emp.email, phone: emp.phone, address: emp.address,
      },
      employment: {
        hireDate: emp.hireDate, contractType: emp.contractType, employmentStatus: emp.employmentStatus,
        contractEndDate: emp.contractEndDate, lastWorkingDate: emp.lastWorkingDate,
      },
      counts: { leaveRequests: leaveCount, attendanceIncidents: incidentCount, payrollItems: payslipCount },
    };

    if ((req.query.format || 'json') === 'csv') {
      const rows = [
        { section: 'profile', field: 'employeeNumber', value: payload.profile.employeeNumber },
        { section: 'profile', field: 'fullNameAr', value: payload.profile.fullNameAr },
        { section: 'profile', field: 'nationality', value: payload.profile.nationality },
        { section: 'profile', field: 'email', value: payload.profile.email },
        { section: 'profile', field: 'phone', value: payload.profile.phone },
        { section: 'employment', field: 'hireDate', value: payload.employment.hireDate },
        { section: 'employment', field: 'contractType', value: payload.employment.contractType },
        { section: 'employment', field: 'employmentStatus', value: payload.employment.employmentStatus },
        { section: 'counts', field: 'leaveRequests', value: payload.counts.leaveRequests },
        { section: 'counts', field: 'attendanceIncidents', value: payload.counts.attendanceIncidents },
        { section: 'counts', field: 'payrollItems', value: payload.counts.payrollItems },
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dsar-${row.id}-portable.csv"`);
      return res.send(toCsv(rows));
    }
    res.setHeader('Content-Disposition', `attachment; filename="dsar-${row.id}-portable.json"`);
    res.json(payload);
  } catch (e) { next(e); }
});

// الإتلاف بفحص الاحتفاظ النظامي (لا حذف أعمى أبداً)
dsar.post('/:id/erasure', requirePerm('pdpl.dsar.review'), async (req, res, next) => {
  try {
    const row = await prisma.dsarRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { employee: { select: { id: true, lastWorkingDate: true, employmentStatus: true } } },
    });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (row.type !== 'erasure') return res.status(409).json({ error: 'الإتلاف متاح فقط لطلبات نوع erasure' });
    if (!dsarCanDecide(row.status)) return res.status(409).json({ error: `الطلب حالته ${row.status} — لا يمكن التنفيذ` });
    if (!row.employee) return res.status(409).json({ error: 'لا يوجد ملف موظف مرتبط بالطلب' });

    const empId = row.employee.id;
    const [payrollCount, eosCount, activeStatus] = await Promise.all([
      prisma.payrollItem.count({ where: { employeeId: empId } }).catch(() => 0),
      prisma.eosCalculation.count({ where: { employeeId: empId } }).catch(() => 0),
      prisma.employee.findUnique({ where: { id: empId }, select: { employmentStatus: true, lastWorkingDate: true } }),
    ]);
    const check = erasureEligibility({
      lastWorkingDate: activeStatus?.lastWorkingDate || null,
      hasFinancialRecords: payrollCount > 0 || eosCount > 0,
      now: new Date(),
      personnelYears: policyStore.get('retention.personnelYears'),
      financialYears: policyStore.get('retention.financialYears'),
    });
    if (!check.eligible) {
      audit(req, 'dsar.erasure.denied', { entityType: 'dsar_request', entityId: String(row.id), reason: check.reason });
      return res.status(409).json({ error: 'الإتلاف مرفوض — استثناء الاحتفاظ النظامي (م10)', reason: check.reason });
    }
    // مؤهل: محو البيانات الشخصية مع بقاء القشرة الوظيفية/المالية للسجلات النظامية
    await prisma.employee.update({ where: { id: empId }, data: ERASURE_FIELDS });
    const updated = await prisma.dsarRequest.update({
      where: { id: row.id },
      data: { status: 'completed', resolution: `تم محو البيانات الشخصية وفق م10 — ${check.reason}`, decidedById: req.user.id },
    });
    audit(req, 'dsar.erasure.executed', {
      entityType: 'dsar_request', entityId: String(row.id),
      afterJson: { employeeId: empId, fields: Object.keys(ERASURE_FIELDS) }, reason: check.reason,
    });
    res.json({ request: updated, erasure: check.reason });
  } catch (e) { next(e); }
});

// ==== /api/ropa — سجل أنشطة المعالجة (م33) ====
const ropa = express.Router();
ropa.use(authenticate);

const ropaSchema = z.object({
  activityName: z.string().min(2).max(300),
  purpose: z.string().min(2).max(1000),
  legalBasis: z.string().min(2).max(300),
  dataCategories: z.string().min(2).max(1000),
  dataSubjectCategories: z.string().min(2).max(500),
  recipientCategories: z.string().min(2).max(500),
  retentionPeriod: z.string().min(1).max(300),
  securityMeasures: z.string().min(2).max(1000),
  internationalTransfer: z.boolean().optional().default(false),
  transferDestination: z.string().max(300).optional().nullable(),
  transferSafeguards: z.string().max(1000).optional().nullable(),
  active: z.boolean().optional(),
});

ropa.get('/', requirePerm('pdpl.read'), async (req, res, next) => {
  try {
    const entries = await prisma.roPAEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    res.json({ entries });
  } catch (e) { next(e); }
});

ropa.post('/', requirePerm('pdpl.ropa.write'), async (req, res, next) => {
  try {
    const data = ropaSchema.parse(req.body);
    const entry = await prisma.roPAEntry.create({ data: { ...data, dpoOwnerId: req.user.id } });
    audit(req, 'ropa.create', { entityType: 'ropa_entry', entityId: String(entry.id), afterJson: { activity: data.activityName } });
    res.status(201).json({ entry });
  } catch (e) { next(e); }
});

ropa.patch('/:id', requirePerm('pdpl.ropa.write'), async (req, res, next) => {
  try {
    const data = ropaSchema.partial().parse(req.body);
    const existing = await prisma.roPAEntry.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'السجل غير موجود' });
    const entry = await prisma.roPAEntry.update({ where: { id: existing.id }, data });
    audit(req, 'ropa.update', { entityType: 'ropa_entry', entityId: String(entry.id), beforeJson: { activity: existing.activityName }, afterJson: data });
    res.json({ entry });
  } catch (e) { next(e); }
});

// ==== /api/breaches — حوادث تسرب البيانات + عداد سدايا ====
const breaches = express.Router();
breaches.use(authenticate);

const breachSchema = z.object({
  title: z.string().min(3).max(300),
  detectedAt: z.string().datetime().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(3).max(4000),
  affectedCategories: z.string().max(1000).optional().nullable(),
  containmentActions: z.string().max(2000).optional().nullable(),
});

function withWindow(row, now) {
  const w = breachSdaiaWindow(row.detectedAt, now, policyStore.get('breach.sdaiaHours'));
  return { ...row, sdaiaWindow: w };
}

breaches.get('/', requirePerm('pdpl.read'), async (req, res, next) => {
  try {
    const rows = await prisma.dataBreachIncident.findMany({ orderBy: { detectedAt: 'desc' }, take: 200 });
    const now = new Date();
    res.json({ incidents: rows.map((r) => withWindow(r, now)), sdaiaHours: policyStore.get('breach.sdaiaHours') });
  } catch (e) { next(e); }
});

breaches.post('/', requirePerm('pdpl.breach.write'), async (req, res, next) => {
  try {
    const data = breachSchema.parse(req.body);
    const incident = await prisma.dataBreachIncident.create({
      data: {
        title: data.title,
        detectedAt: data.detectedAt ? new Date(data.detectedAt) : new Date(),
        severity: data.severity,
        description: data.description,
        affectedCategories: data.affectedCategories || null,
        containmentActions: data.containmentActions || null,
        reportedById: req.user.id,
      },
    });
    // إشعار تلقائي فوري لدور DPO
    await prisma.systemNotification.create({
      data: {
        roleKey: 'dpo', kind: 'system',
        title: `حادث تسرب بيانات: ${data.title}`,
        body: `خطورة ${data.severity} — يجب تقييم الإبلاغ لسدايا خلال ${policyStore.get('breach.sdaiaHours')} ساعة من الاكتشاف`,
        link: '/pdpl',
      },
    });
    audit(req, 'breach.create', { entityType: 'data_breach_incident', entityId: String(incident.id), afterJson: { severity: data.severity } });
    res.status(201).json({ incident: withWindow(incident, new Date()) });
  } catch (e) { next(e); }
});

breaches.post('/:id/notify-sdaia', requirePerm('pdpl.breach.write'), async (req, res, next) => {
  try {
    const row = await prisma.dataBreachIncident.findUnique({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).json({ error: 'الحادث غير موجود' });
    if (row.sdaiaNotifiedAt) return res.status(409).json({ error: 'سبق إبلاغ سدايا عن هذا الحادث' });
    const updated = await prisma.dataBreachIncident.update({
      where: { id: row.id },
      data: { sdaiaNotifiedAt: new Date() },
    });
    audit(req, 'breach.notify_sdaia', { entityType: 'data_breach_incident', entityId: String(row.id) });
    res.json({ incident: withWindow(updated, new Date()) });
  } catch (e) { next(e); }
});

breaches.post('/:id/status', requirePerm('pdpl.breach.write'), async (req, res, next) => {
  try {
    const data = z.object({
      status: z.enum(['open', 'contained', 'closed']),
      subjectsNotifiedAt: z.string().datetime().optional(),
    }).parse(req.body);
    const row = await prisma.dataBreachIncident.findUnique({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).json({ error: 'الحادث غير موجود' });
    const updated = await prisma.dataBreachIncident.update({
      where: { id: row.id },
      data: {
        status: data.status,
        subjectsNotifiedAt: data.subjectsNotifiedAt ? new Date(data.subjectsNotifiedAt) : row.subjectsNotifiedAt,
      },
    });
    audit(req, `breach.${data.status}`, { entityType: 'data_breach_incident', entityId: String(row.id), beforeJson: { status: row.status }, afterJson: { status: data.status } });
    res.json({ incident: withWindow(updated, new Date()) });
  } catch (e) { next(e); }
});

module.exports = { dsar, ropa, breaches };
