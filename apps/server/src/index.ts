import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { seedIfEmpty } from './db/seed';
import { initMysqlTables } from './db/database';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { departmentRoutes } from './routes/departments';
import { vehicleRoutes } from './routes/vehicles';
import { driverRoutes } from './routes/drivers';
import { applicationRoutes } from './routes/applications';
import { approvalRoutes } from './routes/approvals';
import { dispatchRoutes } from './routes/dispatches';
import { consumptionRoutes } from './routes/consumptions';
import { subsidyRoutes } from './routes/subsidies';
import { dashboardRoutes } from './routes/dashboard';
import { notificationRoutes } from './routes/notifications';
import { configRoutes } from './routes/configs';
import { feishuRoutes } from './routes/feishu';
import { initDb } from './routes/init';
import { syncTimeBasedStatus } from './utils/time-sync';

const app = express();
const PORT = process.env.PORT || 8080;

const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// 公开路由
app.use('/api/init', initDb);
app.use('/api/auth', authRoutes);
app.use('/api/feishu', feishuRoutes);

// 需要认证的路由
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/departments', authMiddleware, departmentRoutes);
app.use('/api/vehicles', authMiddleware, vehicleRoutes);
app.use('/api/drivers', authMiddleware, driverRoutes);
app.use('/api/applications', authMiddleware, applicationRoutes);
app.use('/api/approvals', authMiddleware, approvalRoutes);
app.use('/api/dispatches', authMiddleware, dispatchRoutes);
app.use('/api/consumptions', authMiddleware, consumptionRoutes);
app.use('/api/subsidies', authMiddleware, subsidyRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/configs', authMiddleware, configRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  // 生产环境安全检查
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'govcar-dev-secret-key-change-in-production') {
      console.error('[gov-car-server] FATAL: JWT_SECRET is still the dev default. Set a strong random secret in production.');
      process.exit(1);
    }
    console.log('[gov-car-server] running in PRODUCTION mode (x-user-id disabled)');
  }

  await initMysqlTables();
  await seedIfEmpty();

  app.listen(PORT, () => {
    console.log(`[gov-car-server] running on http://localhost:${PORT}`);
    setInterval(() => syncTimeBasedStatus(), 60000);
  });
}

start().catch(err => {
  console.error('[gov-car-server] failed to start:', err);
  process.exit(1);
});

export default app;
