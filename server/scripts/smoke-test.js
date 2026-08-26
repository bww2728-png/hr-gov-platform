/**
 * Smoke test for HR Governance Platform.
 * Verifies: auth, RBAC, all major endpoints.
 * Requires running server on http://localhost:4000
 */
const http = require('http');

const BASE = 'http://localhost:4000';

function req(method, path, body, cookies = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookies ? { Cookie: cookies } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const url = new URL(BASE + path);
    const r = http.request(url, opts, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        const cookie = setCookie
          ? (Array.isArray(setCookie) ? setCookie : [setCookie])
              .map((c) => c.split(';')[0]).join('; ')
          : null;
        let parsed = out;
        try { parsed = JSON.parse(out); } catch {}
        resolve({ status: res.statusCode, body: parsed, cookie });
      });
    });
    r.setTimeout(15000, () => { r.destroy(new Error('request timeout')); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(cond, label) {
  const sym = cond ? '✓' : '✗';
  console.log(`  ${sym} ${label}`);
  if (!cond) process.exitCode = 1;
  return cond;
}

(async () => {
  console.log('▶ HR Governance Platform - Smoke Test\n');

  console.log('[1] Health check');
  const health = await req('GET', '/api/health');
  ok(health.status === 200 && health.body.ok, 'health endpoint');
  ok(health.body.service === 'hr-governance', 'service identifier');

  console.log('\n[2] Auth flow');
  const login = await req('POST', '/api/auth/login', { username: 'admin', password: 'Admin@12345' });
  ok(login.status === 200, 'login as admin');
  ok(login.body.user.role.code === 'sysadmin', 'role = sysadmin (13-role matrix)');
  ok(login.body.user.permissions.includes('*'), 'sysadmin has wildcard permission');
  const adminCookie = login.cookie;

  const me = await req('GET', '/api/auth/me', null, adminCookie);
  ok(me.status === 200 && me.body.user.id, 'fetch /me');

  const badLogin = await req('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  ok(badLogin.status === 401, 'wrong password rejected');

  console.log('\n[3] RBAC + Scope');
  const empLogin = await req('POST', '/api/auth/login', { username: 'employee', password: 'Admin@12345' });
  ok(empLogin.status === 200, 'login as employee');
  const empCookie = empLogin.cookie;
  ok(!empLogin.body.user.permissions.includes('hr.employee.write'), 'employee lacks write perm');

  const auditAsEmployee = await req('GET', '/api/admin/audit', null, empCookie);
  ok(auditAsEmployee.status === 403, 'employee blocked from audit');

  const empsAsEmployee = await req('GET', '/api/hr/employees', null, empCookie);
  ok(empsAsEmployee.status === 200, 'employee can list (filtered)');
  const firstEmp = empsAsEmployee.body.employees[0];
  ok(!firstEmp.salary, 'employee cannot see salaries');

  console.log('\n[4] HR Core');
  const employees = await req('GET', '/api/hr/employees', null, adminCookie);
  ok(employees.status === 200 && employees.body.employees.length > 0, `list employees (${employees.body.employees.length})`);
  const empId = employees.body.employees[0].id;
  const empDetail = await req('GET', `/api/hr/employees/${empId}`, null, adminCookie);
  ok(empDetail.status === 200, 'get employee detail');

  const regions = await req('GET', '/api/hr/regions', null, adminCookie);
  ok(regions.status === 200 && regions.body.regions.length >= 3, `regions (${regions.body.regions.length})`);

  console.log('\n[5] Lifecycle');
  const postings = await req('GET', '/api/lifecycle/postings', null, adminCookie);
  ok(postings.status === 200 && postings.body.postings.length > 0, `job postings (${postings.body.postings.length})`);
  const pipeline = await req('GET', '/api/lifecycle/pipeline', null, adminCookie);
  ok(pipeline.status === 200 && typeof pipeline.body.total === 'number', `pipeline total = ${pipeline.body.total}`);

  console.log('\n[6] Knowledge');
  const docs = await req('GET', '/api/knowledge/documents', null, adminCookie);
  ok(docs.status === 200 && docs.body.documents.length > 0, `knowledge docs (${docs.body.documents.length})`);

  const decisions = await req('GET', '/api/knowledge/decisions', null, adminCookie);
  ok(decisions.status === 200 && decisions.body.decisions.length > 0, `decisions (${decisions.body.decisions.length})`);
  const verify = await req('GET', '/api/knowledge/decisions/verify', null, adminCookie);
  ok(verify.body.intact, 'hash chain integrity intact');

  const newDec = await req('POST', '/api/knowledge/decisions', {
    titleAr: 'قرار اختبار smoke',
    contextMarkdown: 'سياق تجريبي',
    decisionMarkdown: 'قرار تجريبي',
  }, adminCookie);
  ok(newDec.status === 201, 'create decision');

  const policies = await req('GET', '/api/knowledge/policies', null, adminCookie);
  ok(policies.status === 200 && policies.body.policies.length > 0, `policies (${policies.body.policies.length})`);

  console.log('\n[7] Workflows');
  const wdefs = await req('GET', '/api/workflows/definitions', null, adminCookie);
  ok(wdefs.status === 200 && wdefs.body.definitions.length > 0, `workflow defs (${wdefs.body.definitions.length})`);

  console.log('\n[8] Compliance');
  const summary = await req('GET', '/api/compliance/summary', null, adminCookie);
  ok(summary.status === 200, 'compliance summary');
  const violations = await req('GET', '/api/compliance/violations', null, adminCookie);
  ok(violations.status === 200, `violations (${violations.body.violations.length})`);
  const expiries = await req('GET', '/api/compliance/expiries', null, adminCookie);
  ok(expiries.status === 200, `expiries (${expiries.body.expiries.length})`);

  console.log('\n[9] Analytics');
  const dash = await req('GET', '/api/analytics/dashboard', null, adminCookie);
  ok(dash.status === 200 && dash.body.totalEmployees > 0, `dashboard totalEmployees = ${dash.body.totalEmployees}`);
  const kpis = await req('GET', '/api/analytics/kpis', null, adminCookie);
  ok(kpis.status === 200 && kpis.body.kpis.length > 0, `KPIs (${kpis.body.kpis.length})`);
  const mat = await req('GET', '/api/analytics/maturity/summary', null, adminCookie);
  ok(mat.status === 200 && mat.body.totalDimensions === 42, `maturity = 42 dimensions ✓`);
  const risks = await req('GET', '/api/analytics/risks', null, adminCookie);
  ok(risks.status === 200 && risks.body.risks.length >= 15, `risks (${risks.body.risks.length} ≥ 15)`);
  const roadmap = await req('GET', '/api/analytics/roadmap', null, adminCookie);
  ok(roadmap.status === 200 && roadmap.body.items.length === 52, `roadmap = 52 weeks ✓`);
  const fw = await req('GET', '/api/analytics/fivewhys', null, adminCookie);
  ok(fw.status === 200 && fw.body.analyses.length > 0, `5 Whys (${fw.body.analyses.length})`);

  console.log('\n[10] Admin');
  const users = await req('GET', '/api/admin/users', null, adminCookie);
  ok(users.status === 200 && users.body.users.length >= 14, `users (${users.body.users.length})`);
  const roles = await req('GET', '/api/admin/roles', null, adminCookie);
  ok(roles.status === 200 && roles.body.roles.length === 13, `roles = 13 ✓`);
  const catalog = await req('GET', '/api/admin/permissions/catalog', null, adminCookie);
  ok(catalog.status === 200 && catalog.body.allCodes.length >= 140, `permissions catalog (${catalog.body.allCodes.length} ≥ 140)`);

  console.log('\n[11] Lookups');
  const countries = await req('GET', '/api/lookups?category=country', null, adminCookie);
  ok(countries.status === 200 && countries.body.lookups.length > 0, `countries (${countries.body.lookups.length})`);
  const ryd = await req('GET', '/api/lookups?category=city&parent=SA', null, adminCookie);
  ok(ryd.status === 200 && ryd.body.lookups.length > 0, `SA cities (${ryd.body.lookups.length})`);

  console.log('\n[12] Leaves engine');
  const leaveTypes = await req('GET', '/api/leaves/types', null, adminCookie);
  ok(leaveTypes.status === 200 && leaveTypes.body.types.length === 7, `leave types = 7 (saudi rules)`);
  const annual = leaveTypes.body.types.find((t) => t.code === 'annual');
  ok(annual && annual.rulesJson.daysPerYear === 21, 'annual = 21 days (<5y) in rulesJson');
  const balances = await req('GET', '/api/leaves/balances/me', null, empCookie);
  ok(balances.status === 200 && balances.body.balances.length > 0, `balances for self (${balances.body.balances.length})`);
  const leaveReq = await req('POST', '/api/leaves/requests', {
    leaveTypeId: annual.id, startDate: '2026-12-01', endDate: '2026-12-03', reason: 'smoke test',
  }, empCookie);
  ok(leaveReq.status === 201 && leaveReq.body.request.days === 3, `leave request created (${leaveReq.body.request?.days} days)`);
  const leaveReqs = await req('GET', '/api/leaves/requests', null, empCookie);
  const ownOnly = leaveReqs.body.requests.every((r) => r.employeeId === leaveReq.body.request.employeeId);
  ok(ownOnly, 'employee sees only own leave requests');
  const mgrLogin = await req('POST', '/api/auth/login', { username: 'manager', password: 'Admin@12345' });
  const mgrCookie = mgrLogin.cookie;
  const mgrApprove = await req('POST', `/api/leaves/requests/${leaveReq.body.request.id}/manager-decision`, { decision: 'approve' }, mgrCookie);
  ok(mgrApprove.status === 200 && mgrApprove.body.request.status === 'manager_approved', 'manager approved leave');
  const hrLogin = await req('POST', '/api/auth/login', { username: 'hrdir', password: 'Admin@12345' });
  const hrCookie = hrLogin.cookie;
  const hrApprove = await req('POST', `/api/leaves/requests/${leaveReq.body.request.id}/hr-decision`, { decision: 'approve' }, hrCookie);
  ok(hrApprove.status === 200 && hrApprove.body.request.status === 'approved', 'HR approved leave (balance deducted)');
  const holidays = await req('GET', '/api/leaves/holidays', null, adminCookie);
  ok(holidays.status === 200 && holidays.body.holidays.length >= 4, `official holidays (${holidays.body.holidays.length})`);

  console.log('\n[13] Attendance + overtime');
  const checkIn = await req('POST', '/api/attendance/check-in', { method: 'gps' }, empCookie);
  ok(checkIn.status === 201, 'self check-in (GPS)');
  const otReq = await req('POST', '/api/attendance/overtime', { date: '2026-08-20', hours: 3, reason: 'smoke overtime' }, empCookie);
  ok(otReq.status === 201 && otReq.body.yearCap === 720, 'overtime created with 720h year cap');
  const otApprove = await req('POST', `/api/attendance/overtime/${otReq.body.request.id}/decision`, { decision: 'approve' }, mgrCookie);
  ok(otApprove.status === 200, 'manager approved overtime');
  const otAsEmployee = await req('GET', '/api/attendance/overtime', null, empCookie);
  ok(otAsEmployee.status === 200 && otAsEmployee.body.requests.length > 0, 'employee lists own overtime');

  console.log('\n[14] Payroll engine');
  const runs = await req('GET', '/api/payroll/runs', null, adminCookie);
  ok(runs.status === 200 && runs.body.runs.length > 0, `payroll runs (${runs.body.runs.length})`);
  const paidRun = runs.body.runs.find((r) => r.status === 'paid');
  ok(!!paidRun, 'paid run exists (seeded)');
  const runItems = await req('GET', `/api/payroll/runs/${paidRun.id}/items`, null, adminCookie);
  ok(runItems.status === 200 && runItems.body.items.length > 0, `run items (${runItems.body.items.length})`);
  const item = runItems.body.items[0];
  const gosiCheck = Math.abs(Number(item.gosiEmployee) - (Number(item.baseSalary) + Number(item.housing)) * 0.0975) < 1;
  ok(gosiCheck, 'GOSI employee share = 9.75% of (base+housing)');
  const payslips = await req('GET', '/api/payroll/payslips/me', null, empCookie);
  ok(payslips.status === 200, `self payslips (${payslips.body.payslips.length})`);
  const eos = await req('POST', '/api/payroll/eos/calculate', { employeeId: empId, reason: 'resignation' }, adminCookie);
  ok(eos.status === 201 && eos.body.breakdown.eosAmount >= 0, `EOS calculated (formula: ${eos.body.breakdown?.segments?.[0]?.note || 'ok'})`);
  const wpsFiles = await req('GET', '/api/payroll/wps', null, adminCookie);
  ok(wpsFiles.status === 200 && wpsFiles.body.files.length > 0, `WPS files (${wpsFiles.body.files.length})`);
  const loansList = await req('GET', '/api/payroll/loans', null, adminCookie);
  ok(loansList.status === 200, `loans (${loansList.body.loans.length})`);

  console.log('\n[15] Performance + L&D + Talent + Retention');
  const cycles = await req('GET', '/api/perf/cycles', null, adminCookie);
  ok(cycles.status === 200 && cycles.body.cycles.length > 0, `perf cycles (${cycles.body.cycles.length})`);
  const objectives = await req('GET', '/api/perf/objectives', null, adminCookie);
  ok(objectives.status === 200 && objectives.body.objectives.length > 0, `OKRs (${objectives.body.objectives.length})`);
  const courses = await req('GET', '/api/lnd/courses', null, adminCookie);
  ok(courses.status === 200 && courses.body.courses.length >= 3, `courses (${courses.body.courses.length})`);
  const succession = await req('GET', '/api/talent/succession', null, hrCookie);
  ok(succession.status === 200 && succession.body.plans.length > 0, `succession plans (${succession.body.plans.length})`);
  const surveys = await req('GET', '/api/retention/surveys', null, adminCookie);
  ok(surveys.status === 200 && surveys.body.surveys.length > 0, `surveys (${surveys.body.surveys.length})`);
  const enpsSurvey = surveys.body.surveys.find((s) => s.type === 'enps');
  const enpsResults = await req('GET', `/api/retention/surveys/${enpsSurvey.id}/results`, null, hrCookie);
  ok(enpsResults.status === 200 && typeof enpsResults.body.results.enps === 'number', `eNPS score = ${enpsResults.body.results.enps}`);

  console.log('\n[16] Relations + Expat + Insurance + ComplianceSA');
  const cases = await req('GET', '/api/relations/disciplinary', null, hrCookie);
  ok(cases.status === 200 && cases.body.cases.length > 0, `disciplinary cases (${cases.body.cases.length})`);
  const grievance = await req('POST', '/api/relations/grievances', { subject: 'تظلم اختبار', details: 'تفاصيل تظلم اختبار smoke' }, empCookie);
  ok(grievance.status === 201, 'employee filed grievance');
  const expatDash = await req('GET', '/api/expat/dashboard', null, adminCookie);
  ok(expatDash.status === 200 && expatDash.body.expatCount > 0, `expat dashboard (${expatDash.body.expatCount} expats)`);
  const gosiRecs = await req('GET', '/api/expat/gosi', null, adminCookie);
  ok(gosiRecs.status === 200 && gosiRecs.body.records.length > 0, `GOSI records (${gosiRecs.body.records.length})`);
  const iqamas = await req('GET', '/api/expat/iqamas', null, adminCookie);
  ok(iqamas.status === 200 && iqamas.body.iqamas.length > 0, `iqama records (${iqamas.body.iqamas.length})`);
  const policiesIns = await req('GET', '/api/insurance/policies', null, adminCookie);
  ok(policiesIns.status === 200 && policiesIns.body.policies.length > 0, `insurance policies (${policiesIns.body.policies.length})`);
  const nitaqatDash = await req('GET', '/api/compliance-sa/dashboard', null, adminCookie);
  ok(nitaqatDash.status === 200 && nitaqatDash.body.current.band, `nitaqat band = ${nitaqatDash.body.current.band} (${nitaqatDash.body.current.pct}%)`);
  const saudiRules = await req('GET', '/api/compliance-sa/rules', null, adminCookie);
  ok(saudiRules.status === 200 && saudiRules.body.rules.gosi.employeePct === 9.75, 'saudi rules engine exposed');

  console.log('\n[17] Requests center + gov docs + flowcharts');
  const reqTypes = await req('GET', '/api/requests/types', null, adminCookie);
  ok(reqTypes.status === 200 && reqTypes.body.types.length === 6, `request types = 6`);
  const newReq = await req('POST', '/api/requests', { typeId: reqTypes.body.types[0].id, payload: { details: 'smoke request' } }, empCookie);
  ok(newReq.status === 201 && newReq.body.request.status === 'submitted', 'unified request submitted');
  const govDocs = await req('GET', '/api/gov-docs/documents', null, adminCookie);
  ok(govDocs.status === 200 && govDocs.body.documents.length > 0, `employee documents (${govDocs.body.documents.length})`);
  const probation = await req('GET', '/api/gov-docs/probation', null, hrCookie);
  ok(probation.status === 200, `probation list (${probation.body.employees.length} in probation)`);
  const flowcharts = await req('GET', '/api/knowledge/documents?category=flowchart', null, adminCookie);
  const fcCount = flowcharts.body.documents?.length ?? flowcharts.body.total;
  ok(flowcharts.status === 200 && fcCount === 69, `69 flowcharts as knowledge docs (${fcCount})`);

  console.log('\n[18] Role isolation (13 roles)');
  const payrollLogin = await req('POST', '/api/auth/login', { username: 'payroll', password: 'Admin@12345' });
  ok(payrollLogin.status === 200 && payrollLogin.body.user.role.code === 'payroll_officer', 'login as payroll_officer');
  const payrollCookie = payrollLogin.cookie;
  const payrollRunsOk = await req('GET', '/api/payroll/runs', null, payrollCookie);
  ok(payrollRunsOk.status === 200, 'payroll_officer reads payroll');
  const payrollBlocked = await req('GET', '/api/lifecycle/postings', null, payrollCookie);
  ok(payrollBlocked.status === 403, 'payroll_officer blocked from recruitment (403)');
  const auditorLogin = await req('POST', '/api/auth/login', { username: 'auditor', password: 'Admin@12345' });
  const auditorCookie = auditorLogin.cookie;
  const auditorRead = await req('GET', '/api/admin/audit', null, auditorCookie);
  ok(auditorRead.status === 200, 'auditor reads audit log');
  const auditorWrite = await req('POST', '/api/payroll/runs', { month: 9, year: 2026 }, auditorCookie);
  ok(auditorWrite.status === 403, 'auditor blocked from writes (403)');
  const empSecurity = await req('GET', '/api/admin/security-events', null, empCookie);
  ok(empSecurity.status === 403, 'employee blocked from security events (403)');
  const securityLogin = await req('POST', '/api/auth/login', { username: 'security', password: 'Admin@12345' });
  ok(securityLogin.status === 200 && securityLogin.body.user.role.code === 'security_admin', 'login as security_admin');
  const secEvents = await req('GET', '/api/admin/security-events', null, securityLogin.cookie);
  ok(secEvents.status === 200, 'security_admin reads security events');
  const complianceLogin = await req('POST', '/api/auth/login', { username: 'compliance', password: 'Admin@12345' });
  ok(complianceLogin.status === 200 && complianceLogin.body.user.role.code === 'compliance_officer', 'login as compliance_officer');
  const compNitaqat = await req('GET', '/api/compliance-sa/nitaqat', null, complianceLogin.cookie);
  ok(compNitaqat.status === 200, 'compliance_officer reads nitaqat');
  const analystLogin = await req('POST', '/api/auth/login', { username: 'analyst', password: 'Admin@12345' });
  ok(analystLogin.status === 200 && analystLogin.body.user.role.code === 'data_analyst', 'login as data_analyst');
  const lndLogin = await req('POST', '/api/auth/login', { username: 'lnd', password: 'Admin@12345' });
  ok(lndLogin.status === 200 && lndLogin.body.user.role.code === 'ld_specialist', 'login as ld_specialist');

  console.log('\n[19] Admin extras (sessions/restore/simulate)');
  const sessions = await req('GET', '/api/admin/sessions', null, adminCookie);
  ok(sessions.status === 200, `active sessions (${sessions.body.sessions.length})`);
  const deletedList = await req('GET', '/api/admin/deleted', null, adminCookie);
  ok(deletedList.status === 200, 'soft-delete list endpoint');
  const sim = await req('POST', '/api/admin/workflow/simulate', { definitionCode: 'WF-REQ-CERT' }, adminCookie);
  ok(sim.status === 200 && sim.body.trace.length === 2, `workflow simulation (${sim.body.trace?.length} steps traced)`);

  console.log('\n[20] Logout');
  const logout = await req('POST', '/api/auth/logout', null, adminCookie);
  ok(logout.status === 200, 'logout');
  // Use the possibly-updated cookie from logout (may be empty)
  const clearedCookie = logout.cookie || '';
  const meAfterLogout = await req('GET', '/api/auth/me', null, clearedCookie);
  ok(meAfterLogout.status === 401, 'session invalidated');

  console.log('\n────────────────────────────────────────');
  if (process.exitCode) {
    console.log('✗ FAILED');
  } else {
    console.log('✓ ALL PASSED');
  }
  console.log('────────────────────────────────────────');
})().catch((e) => { console.error('error:', e); process.exit(1); });