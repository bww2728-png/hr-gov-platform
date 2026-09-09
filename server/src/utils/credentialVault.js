/**
 * خزنة بيانات الدخول — تشفير AES-256-GCM لكلمات السر المولّدة تلقائياً.
 * المفتاح: CREDENTIAL_VAULT_KEY إن وُجد، وإلا يُشتق من JWT_SECRET (نفس سر الجلسات، لا يُخزن بكلمة السر نفسها).
 */
const crypto = require('crypto');
const config = require('../config');

function vaultKey() {
  const raw = process.env.CREDENTIAL_VAULT_KEY || config.jwtSecret;
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

function decryptSecret(payload) {
  try {
    const parts = String(payload).split('.');
    if (parts.length !== 3) return null;
    const [iv, tag, enc] = parts.map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// 12 خانة من حروف وأرقام بلا رموز ملتبسة (بدون I/l/O/0/1)
function generatePassword(len = 12) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

module.exports = { encryptSecret, decryptSecret, generatePassword };
