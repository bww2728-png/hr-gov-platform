const prisma = require('../prisma');

/**
 * Writes an audit-log entry. Fire-and-forget safe: never blocks the request.
 * @param {Object} req - Express request (to extract userId, ip, etc.)
 * @param {string} action - e.g. 'employee.create'
 * @param {Object} options - { entityType, entityId, beforeJson, afterJson, reason, correlationId }
 */
function audit(req, action, options = {}) {
  prisma.auditLog
    .create({
      data: {
        userId: req.user?.id ?? null,
        action,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        beforeJson: options.beforeJson || undefined,
        afterJson: options.afterJson || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers?.['user-agent'] || null,
        correlationId: options.correlationId || null,
        reason: options.reason || null,
      },
    })
    .catch((e) => console.error('audit log failed:', e.message));
}

module.exports = { audit };