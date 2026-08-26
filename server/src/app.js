const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const hrRoutes = require('./routes/hr.routes');
const lifecycleRoutes = require('./routes/lifecycle.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const workflowRoutes = require('./routes/workflow.routes');
const complianceRoutes = require('./routes/compliance.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const adminRoutes = require('./routes/admin.routes');
const lookupsRoutes = require('./routes/lookups.routes');
const leavesRoutes = require('./routes/leaves.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const payrollRoutes = require('./routes/payroll.routes');
const performanceRoutes = require('./routes/performance.routes');
const lndRoutes = require('./routes/lnd.routes');
const talentRoutes = require('./routes/talent.routes');
const retentionRoutes = require('./routes/retention.routes');
const relationsRoutes = require('./routes/relations.routes');
const expatRoutes = require('./routes/expat.routes');
const insuranceRoutes = require('./routes/insurance.routes');
const complianceSaRoutes = require('./routes/complianceSa.routes');
const requestsRoutes = require('./routes/requests.routes');
const govDocsRoutes = require('./routes/govDocs.routes');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
            },
          }
        : false,
    })
  );
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: 1200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'طلبات كثيرة، حاول لاحقاً' },
    })
  );

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, ts: new Date().toISOString(), service: 'hr-governance' })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/hr', hrRoutes);
  app.use('/api/lifecycle', lifecycleRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/compliance', complianceRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/lookups', lookupsRoutes);
  app.use('/api/leaves', leavesRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/perf', performanceRoutes);
  app.use('/api/lnd', lndRoutes);
  app.use('/api/talent', talentRoutes);
  app.use('/api/retention', retentionRoutes);
  app.use('/api/relations', relationsRoutes);
  app.use('/api/expat', expatRoutes);
  app.use('/api/insurance', insuranceRoutes);
  app.use('/api/compliance-sa', complianceSaRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/gov-docs', govDocsRoutes);

  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
  });

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };