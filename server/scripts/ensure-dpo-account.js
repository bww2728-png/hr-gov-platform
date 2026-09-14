/**
 * ensure-dpo-account.js — خطوة إقلاع idempotent (تعمل بعد migrate.js وقبل تشغيل الخادم):
 *   1) دور dpo موجود (مضمون أصلاً في migrate.js) — يُزامن صلاحياته مع permissions.js.
 *   2) حساب dpo1 — يُنشأ فقط إن لم يوجد، بنفس أنماط النظام:
 *      كلمة عشوائية قوية من خزنة بيانات الدخول → bcrypt → تُخزن مشفرة في
 *      initialPasswordEnc (يكشفها المشرف عبر /api/hr/employees/credentials)
 *      + mustChangePassword=true (إلزام تغييرها عند أول دخول).
 *   3) عند الإنشاء فقط: تُعرض الكلمة مرة واحدة في سجل الإقلاع ليستلمها مشرف المنصة.
 * لا أسرار صلبة في الكود إطلاقاً — كل المفاتيح من بيئة التشغيل.
 */
const bcrypt = require('bcryptjs');
const { generatePassword, encryptSecret } = require('../src/utils/credentialVault');
const prisma = require('../src/prisma');
const { ROLE_PERMS } = require('../src/permissions');

(async () => {
  // 1) + مزامنة صلاحيات الدور
  const perms = ROLE_PERMS.dpo || [];
  let role = await prisma.role.findUnique({ where: { code: 'dpo' } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        code: 'dpo', nameAr: 'مسؤول حماية البيانات', nameEn: 'Data Protection Officer',
        description: 'Data Protection Officer', isSystem: true, permissions: perms,
      },
    });
    console.log('[ensure-dpo] role dpo created');
  } else if (JSON.stringify(role.permissions) !== JSON.stringify(perms)) {
    role = await prisma.role.update({ where: { id: role.id }, data: { permissions: perms } });
    console.log('[ensure-dpo] role dpo permissions synced');
  }

  // 2) حساب dpo1 — idempotent
  const existing = await prisma.user.findUnique({ where: { username: 'dpo1' } });
  if (existing) {
    console.log('[ensure-dpo] dpo1 exists (status=' + existing.status + ') — nothing to do');
    return;
  }
  const password = generatePassword(14) + 'a7!';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username: 'dpo1',
      fullNameAr: 'مسؤول حماية البيانات',
      fullNameEn: 'Data Protection Officer',
      email: 'dpo1@alnadij-hr.local',
      passwordHash,
      roleId: role.id,
      status: 'active',
      mustChangePassword: true,
      initialPasswordEnc: encryptSecret(password),
      passwordIssuedAt: new Date(),
    },
  });
  // 3) استلام مشرف المنصة — مرة واحدة، مع إلزام التغيير عند أول دخول
  console.log('[ensure-dpo] dpo1 created (mustChangePassword=true)');
  console.log('[ensure-dpo] DPO1_INITIAL_PASSWORD=' + password);
})().catch((e) => { console.error('[ensure-dpo] FAILED (non-fatal, server will start):', e.message); })
  .finally(() => prisma.$disconnect());
