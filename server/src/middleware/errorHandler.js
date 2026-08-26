function notFound(req, res) {
  res.status(404).json({ error: 'المسار غير موجود' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[err]', err);
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'بيانات غير صالحة',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'تعارض في البيانات', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'العنصر غير موجود' });
  }
  const status = err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'خطأ داخلي في الخادم' : err.message });
}

module.exports = { notFound, errorHandler };