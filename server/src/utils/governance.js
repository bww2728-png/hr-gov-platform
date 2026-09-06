/**
 * محرك الحوكمة — Maker-Checker للقوائم المرجعية والمعادلات وهياكل الرواتب.
 * ينفّذ القواعد الذهبية الأربع:
 *  1) الفصل الوظيفي (SoD): المقترح لا يعتمد نفسه.
 *  2) الأربع عيون: التغييرات الحساسة تتطلب اعتمادين مستقلين.
 *  3) البصمة والتوثيق: من/متى/قبل/بعد/السبب في كل تغيير.
 *  4) الصلاحيات حسب السيناريو: المالك من lookup_categories / formula_definitions.
 */
const prisma = require('../prisma');

class GovernanceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const roleOf = (user) => user?.role?.code || '';
const isSysadmin = (user) => roleOf(user) === 'sysadmin';
const perms = (user) => (Array.isArray(user?.role?.permissions) ? user.role.permissions : []);
const hasPerm = (user, code) => perms(user).includes('*') || perms(user).includes(code);

/** جلب تعريف الفئة مع مصفوفة الحوكمة */
async function getCategory(code) {
  const cat = await prisma.lookupCategory.findUnique({ where: { code } });
  if (!cat) throw new GovernanceError(`فئة غير معروفة: ${code}`, 404);
  return cat;
}

/** هل المستخدم ضمن أدوار المالك للفئة؟ */
function isOwner(user, ownerRoles) {
  return isSysadmin(user) || ownerRoles.includes(roleOf(user));
}

/**
 * اقتراح تغيير على قائمة مرجعية (إنشاء/تعديل/تعطيل قيمة).
 * إن كانت الفئة بلا موافقة والمستخدم مالكها → يُطبَّق فوراً مع توثيق.
 * وإلا → يُنشأ ChangeRequest بانتظار سلسلة الاعتماد.
 */
async function proposeLookupChange({ categoryCode, action, payload, before, reason, user }) {
  const cat = await getCategory(categoryCode);
  if (!isOwner(user, cat.ownerRoles)) {
    throw new GovernanceError('ممنوع: لست مالكاً لهذا الجدول الفرعي', 403);
  }
  if (!reason || !String(reason).trim()) {
    throw new GovernanceError('سبب التغيير إلزامي (مبدأ البصمة والتوثيق)');
  }
  if (!hasPerm(user, 'governance.propose') && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: لا تملك صلاحية الاقتراح', 403);
  }

  // فئة بدون موافقة → تطبيق مباشر من المالك فقط
  if (!cat.requiresApproval) {
    const applied = await applyLookupChange({ categoryCode: action === 'create' ? null : before, action, payload, user, reason });
    return { applied: true, result: applied, chain: [] };
  }

  const cr = await prisma.changeRequest.create({
    data: {
      kind: 'lookup',
      targetKey: `${categoryCode}:${payload?.code || before?.code || ''}`,
      action,
      payloadJson: payload || {},
      beforeJson: before || undefined,
      reason: String(reason).trim(),
      proposedBy: user.id,
      approverChain: cat.approverRoles,
    },
    include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
  });
  return { applied: false, changeRequest: cr, chain: cat.approverRoles };
}

/** اقتراح تغيير معادلة */
async function proposeFormulaChange({ formulaCode, payload, before, reason, user }) {
  const def = await prisma.formulaDefinition.findUnique({ where: { code: formulaCode } });
  if (!def) throw new GovernanceError(`معادلة غير معروفة: ${formulaCode}`, 404);
  if (!isOwner(user, def.ownerRoles)) throw new GovernanceError('ممنوع: لست مالكاً لهذه المعادلة', 403);
  if (!reason || !String(reason).trim()) throw new GovernanceError('سبب التغيير إلزامي');
  if (!hasPerm(user, 'formulas.propose') && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: لا تملك صلاحية اقتراح تعديل المعادلات', 403);
  }
  const chain = [...def.approverRoles];
  if (def.requiresCeo && !chain.includes('ceo')) chain.push('ceo');

  const cr = await prisma.changeRequest.create({
    data: {
      kind: 'formula',
      targetKey: formulaCode,
      action: 'update',
      payloadJson: payload || {},
      beforeJson: before || undefined,
      reason: String(reason).trim(),
      proposedBy: user.id,
      approverChain: chain,
    },
    include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
  });
  return { applied: false, changeRequest: cr, chain };
}

/** اقتراح تغيير معامل سياسة (متغير مركزي) */
async function proposeParameterChange({ parameterCode, value, effectiveFrom, reason, user }) {
  const param = await prisma.policyParameter.findUnique({ where: { code: parameterCode } });
  if (!param) throw new GovernanceError(`معامل غير معروف: ${parameterCode}`, 404);
  if (!isOwner(user, Array.isArray(param.ownerRoles) ? param.ownerRoles : [])) {
    throw new GovernanceError('ممنوع: لست مالكاً لهذا المعامل', 403);
  }
  if (!reason || !String(reason).trim()) throw new GovernanceError('سبب التغيير إلزامي (مبدأ البصمة والتوثيق)');
  if (!hasPerm(user, 'policies.propose') && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: لا تملك صلاحية اقتراح تعديل المعايير', 403);
  }
  const num = Number(value);
  if (!Number.isFinite(num)) throw new GovernanceError('قيمة المعامل يجب أن تكون رقمية');
  if (param.minValue != null && num < param.minValue) throw new GovernanceError(`القيمة أدنى من الحد الأدنى (${param.minValue})`);
  if (param.maxValue != null && num > param.maxValue) throw new GovernanceError(`القيمة أعلى من الحد الأقصى (${param.maxValue})`);
  const eff = effectiveFrom ? new Date(effectiveFrom) : new Date();
  if (Number.isNaN(eff.getTime())) throw new GovernanceError('تاريخ السريان غير صالح');

  const payload = { value: num, effectiveFrom: eff.toISOString() };
  if (!param.requiresApproval) {
    const applied = await applyParameterChange(param, payload, user, String(reason).trim());
    return { applied: true, result: applied, chain: [] };
  }
  const cr = await prisma.changeRequest.create({
    data: {
      kind: 'parameter',
      targetKey: parameterCode,
      action: 'update',
      payloadJson: payload,
      beforeJson: { value: (await currentParameterValue(parameterCode)), version: param.version },
      reason: String(reason).trim(),
      proposedBy: user.id,
      approverRoles: Array.isArray(param.approverRoles) ? param.approverRoles : [],
    },
    include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
  });
  return { applied: false, changeRequest: cr, chain: cr.approverChain };
}

async function currentParameterValue(code) {
  const store = require('./policyStore');
  return store.get(code);
}

/** تطبيق نسخة جديدة من معامل سياسة + إبطال الكاش اللحظي */
async function applyParameterChange(param, payload, user, reason, changeRequestId) {
  const store = require('./policyStore');
  const oldValue = store.get(param.code);
  const version = param.version + 1;
  const [, newVersion] = await prisma.$transaction([
    prisma.policyParameter.update({ where: { code: param.code }, data: { version } }),
    prisma.policyParameterVersion.create({
      data: {
        parameterCode: param.code,
        version,
        valueJson: payload.value,
        effectiveFrom: new Date(payload.effectiveFrom),
        reason,
        changeRequestId: changeRequestId || null,
        createdBy: user?.id || null,
      },
    }),
  ]);
  await store.load(); // انعكاس لحظي بدون إعادة نشر
  try { require('../socket').getIO()?.emit('public:policies.updated', { code: param.code, at: new Date().toISOString() }); } catch { /* socket غير مهيأ */ }
  await prisma.auditLog.create({
    data: {
      userId: user?.id || null,
      action: 'policy.parameter.apply',
      entityType: 'policy_parameter',
      entityId: param.code,
      beforeJson: { value: oldValue },
      afterJson: { value: payload.value, version },
      reason,
      correlationId: changeRequestId ? `CR-${changeRequestId}` : null,
    },
  });
  return { code: param.code, version: newVersion.version, value: newVersion.valueJson };
}

/** اقتراح تغيير قواعد نوع إجازة (سقوف/أرصدة) */
async function proposeLeaveTypeRulesChange({ leaveTypeCode, rules, reason, user }) {
  const lt = await prisma.leaveType.findUnique({ where: { code: leaveTypeCode } });
  if (!lt) throw new GovernanceError(`نوع إجازة غير معروف: ${leaveTypeCode}`, 404);
  if (!isOwner(user, ['hr_director']) && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: تعديل سقوف الإجازات من اختصاص مدير الموارد البشرية', 403);
  }
  if (!reason || !String(reason).trim()) throw new GovernanceError('سبب التغيير إلزامي');
  if (!hasPerm(user, 'policies.propose') && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: لا تملك صلاحية اقتراح تعديل قواعد الإجازات', 403);
  }
  const cr = await prisma.changeRequest.create({
    data: {
      kind: 'leave_type_rules',
      targetKey: `leaveType:${leaveTypeCode}`,
      action: 'update',
      payloadJson: { rules },
      beforeJson: { rules: lt.rulesJson },
      reason: String(reason).trim(),
      proposedBy: user.id,
      approverRoles: ['hr_director', 'ceo'],
    },
    include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
  });
  return { applied: false, changeRequest: cr, chain: cr.approverChain };
}

/**
 * اعتماد/رفض مرحلة في طلب تغيير.
 * يفرض: SoD (المقترح ≠ المعتمد)، الأربع عيون (لا اعتماد مكرر)، ترتيب السلسلة.
 */
async function decide({ changeRequestId, user, decision, note }) {
  const cr = await prisma.changeRequest.findUnique({
    where: { id: changeRequestId },
    include: { proposer: { select: { id: true, fullNameAr: true } } },
  });
  if (!cr) throw new GovernanceError('طلب التغيير غير موجود', 404);
  if (cr.status !== 'pending') throw new GovernanceError('هذا الطلب لم يعد بانتظار الاعتماد');

  const chain = Array.isArray(cr.approverChain) ? cr.approverChain : [];
  const expectedRole = chain[cr.currentStage];
  if (!expectedRole) throw new GovernanceError('سلسلة الاعتماد اكتملت بالفعل');

  // SoD: المقترح لا يعتمد نفسه — حتى لو كان ضمن سلسلة الاعتماد
  if (cr.proposedBy === user.id) {
    throw new GovernanceError('ممنوع: لا يمكنك اعتماد تغيير اقترحته بنفسك (الفصل الوظيفي)', 403);
  }
  // يجب أن يكون المستخدم ضمن الدور المطلوب في هذه المرحلة
  if (!isSysadmin(user) && roleOf(user) !== expectedRole) {
    throw new GovernanceError(`هذه المرحلة تتطلب دور: ${expectedRole}`, 403);
  }
  if (!hasPerm(user, 'governance.approve') && !hasPerm(user, 'formulas.approve') && !isSysadmin(user)) {
    throw new GovernanceError('ممنوع: لا تملك صلاحية الاعتماد', 403);
  }
  // الأربع عيون: لا اعتماد مكرر من نفس المستخدم
  const approvals = Array.isArray(cr.approvalsJson) ? cr.approvalsJson : [];
  if (approvals.some((a) => a.userId === user.id)) {
    throw new GovernanceError('لقد اعتمدت هذا الطلب مسبقاً (مبدأ الأربع عيون)', 409);
  }

  const entry = { userId: user.id, role: roleOf(user), decision, note: note || null, at: new Date().toISOString() };
  const newApprovals = [...approvals, entry];

  if (decision === 'reject') {
    return prisma.changeRequest.update({
      where: { id: cr.id },
      data: { status: 'rejected', approvalsJson: newApprovals, decidedNote: note || null },
    });
  }

  const nextStage = cr.currentStage + 1;
  const done = nextStage >= chain.length;
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: {
      approvalsJson: newApprovals,
      currentStage: nextStage,
      status: done ? 'approved' : 'pending',
    },
  });

  // اكتملت السلسلة → طبّق التغيير فعلياً
  if (done) {
    await applyChangeRequest(updated, user);
    return prisma.changeRequest.update({
      where: { id: cr.id },
      data: { status: 'applied', appliedAt: new Date() },
    });
  }
  return updated;
}

/** تطبيق طلب تغيير مكتمل الاعتمادات + كتابة البصمة */
async function applyChangeRequest(cr, approverUser) {
  if (cr.kind === 'lookup') {
    const [categoryCode] = String(cr.targetKey).split(':');
    await applyLookupChange({
      categoryCode,
      action: cr.action,
      payload: cr.payloadJson,
      before: cr.beforeJson,
      user: approverUser,
      reason: cr.reason,
      changeRequestId: cr.id,
    });
  } else if (cr.kind === 'parameter') {
    const param = await prisma.policyParameter.findUnique({ where: { code: cr.targetKey } });
    if (!param) throw new GovernanceError(`المعامل غير موجود: ${cr.targetKey}`, 404);
    await applyParameterChange(param, cr.payloadJson, approverUser, cr.reason, cr.id);
  } else if (cr.kind === 'leave_type_rules') {
    const [, code] = String(cr.targetKey).split(':');
    const rules = cr.payloadJson?.rules;
    await prisma.leaveType.update({ where: { code }, data: { rulesJson: rules } });
    await prisma.auditLog.create({
      data: {
        userId: approverUser.id,
        action: 'policy.leave_type_rules.apply',
        entityType: 'leave_type',
        entityId: code,
        beforeJson: cr.beforeJson || undefined,
        afterJson: cr.payloadJson || undefined,
        reason: cr.reason,
        correlationId: `CR-${cr.id}`,
      },
    });
  } else if (cr.kind === 'formula') {
    if (cr.payloadJson?.logicJson !== undefined) {
      const before = await prisma.formulaDefinition.findUnique({ where: { code: cr.targetKey } });
      await prisma.formulaRevision.create({
        data: {
          formulaCode: cr.targetKey,
          version: before.version,
          logicJson: before.logicJson ?? undefined,
          expressionAr: before.expressionAr,
          reason: cr.reason,
          changeRequestId: cr.id,
          createdBy: approverUser.id,
        },
      });
    }
    await prisma.formulaDefinition.update({
      where: { code: cr.targetKey },
      data: { ...pickFormulaFields(cr.payloadJson), version: { increment: 1 } },
    });
  }
  // البصمة الكاملة
  await prisma.auditLog.create({
    data: {
      userId: approverUser.id,
      action: `governance.${cr.kind}.apply`,
      entityType: cr.kind,
      entityId: String(cr.targetKey),
      beforeJson: cr.beforeJson || undefined,
      afterJson: cr.payloadJson || undefined,
      reason: cr.reason,
    },
  });
}

const pickFormulaFields = (p = {}) => {
  const out = {};
  for (const k of ['nameAr', 'nameEn', 'expressionAr', 'variablesJson', 'exampleJson', 'notes', 'isActive', 'logicJson']) {
    if (p[k] !== undefined) out[k] = p[k];
  }
  return out;
};

/** تطبيق فعلي على جدول lookups (أو إرجاع وصف للكيانات الحية) */
async function applyLookupChange({ categoryCode, action, payload, before, user, reason, changeRequestId }) {
  const cat = await prisma.lookupCategory.findUnique({ where: { code: categoryCode } });
  if (cat?.source === 'table') {
    // الكيانات الحية (فروع/إدارات/موظفون...) تُدار من شاشاتها — هنا نوثّق فقط
    await prisma.auditLog.create({
      data: {
        userId: user.id, action: `lookup.${action}`, entityType: categoryCode,
        entityId: payload?.code || before?.code || null,
        beforeJson: before || undefined, afterJson: payload || undefined, reason,
      },
    });
    return { note: 'فئة مرتبطة بجدول حي — وُثّق الطلب فقط' };
  }

  let result;
  if (action === 'create') {
    result = await prisma.lookup.create({
      data: {
        category: categoryCode,
        code: String(payload.code),
        valueAr: String(payload.valueAr),
        valueEn: String(payload.valueEn || payload.valueAr),
        parentCategory: payload.parentCategory || null,
        parentCode: payload.parentCode || null,
        sortOrder: payload.sortOrder || 0,
      },
    });
  } else if (action === 'update') {
    result = await prisma.lookup.update({
      where: { category_code: { category: categoryCode, code: String((before || payload).code) } },
      data: {
        valueAr: payload.valueAr ?? undefined,
        valueEn: payload.valueEn ?? undefined,
        sortOrder: payload.sortOrder ?? undefined,
        isActive: payload.isActive ?? undefined,
      },
    });
  } else if (action === 'deactivate') {
    result = await prisma.lookup.update({
      where: { category_code: { category: categoryCode, code: String((before || payload).code) } },
      data: { isActive: false },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: `lookup.${action}`,
      entityType: 'lookup',
      entityId: `${categoryCode}:${(before || payload)?.code || payload?.code}`,
      beforeJson: before || undefined,
      afterJson: payload || undefined,
      reason,
      correlationId: changeRequestId ? `CR-${changeRequestId}` : null,
    },
  });
  return result;
}

/** صندوق «بانتظار اعتمادي» — الطلبات التي تطابق دور المستخدم في مرحلتها الحالية */
async function pendingFor(user) {
  const pending = await prisma.changeRequest.findMany({
    where: { status: 'pending', proposedBy: { not: user.id } },
    include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (isSysadmin(user)) return pending;
  const myRole = roleOf(user);
  return pending.filter((cr) => {
    const chain = Array.isArray(cr.approverChain) ? cr.approverChain : [];
    const already = (Array.isArray(cr.approvalsJson) ? cr.approvalsJson : []).some((a) => a.userId === user.id);
    return chain[cr.currentStage] === myRole && !already;
  });
}

module.exports = {
  GovernanceError,
  proposeLookupChange,
  proposeFormulaChange,
  proposeParameterChange,
  proposeLeaveTypeRulesChange,
  decide,
  pendingFor,
  getCategory,
};
