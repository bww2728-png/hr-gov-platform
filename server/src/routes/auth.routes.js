const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../prisma');
const { signToken, COOKIE_NAME } = require('../utils/jwt');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1).max(200),
});

const strongPassword = z
  .string()
  .min(12)
  .max(200)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true, employee: true },
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ error: 'الحساب مقفل، حاول لاحقاً' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const newCount = user.failedLoginCount + 1;
      const updateData = { failedLoginCount: newCount };
      if (newCount >= MAX_FAILED) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        updateData.failedLoginCount = 0;
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    audit(req, 'auth.login', { entityType: 'user', entityId: user.id });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullNameAr: user.fullNameAr,
        fullNameEn: user.fullNameEn,
        email: user.email,
        role: { code: user.role.code, nameAr: user.role.nameAr, nameEn: user.role.nameEn },
        permissions: user.role.permissions,
        mustChangePassword: user.mustChangePassword,
        languagePref: user.languagePref,
        employeeId: user.employeeId,
      },
    });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  });
  audit(req, 'auth.logout');
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      username: u.username,
      fullNameAr: u.fullNameAr,
      fullNameEn: u.fullNameEn,
      email: u.email,
      role: { code: u.role.code, nameAr: u.role.nameAr, nameEn: u.role.nameEn },
      permissions: u.role.permissions,
      mustChangePassword: u.mustChangePassword,
      languagePref: u.languagePref,
      employeeId: u.employeeId,
      employee: u.employee,
    },
  });
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });

    audit(req, 'auth.change_password', { entityType: 'user', entityId: user.id });

    const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { role: true } });
    const token = signToken(fresh);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/set-language', authenticate, async (req, res, next) => {
  try {
    const lang = req.body.lang === 'en' ? 'en' : 'ar';
    await prisma.user.update({ where: { id: req.user.id }, data: { languagePref: lang } });
    res.json({ ok: true, lang });
  } catch (e) { next(e); }
});

module.exports = router;