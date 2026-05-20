import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const driverRoutes = Router();
const adminRoles = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];

driverRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_driver');
    const { status, keyword } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.find(d => d.is_deleted === 0);
    if (status) list = list.filter(d => d.status === status);
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      list = list.filter(d => d.name?.toLowerCase().includes(kw) || d.mobile?.includes(kw));
    }

    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

driverRoutes.get('/available', async (_req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_driver');
    const list = await store.find(d => d.status === 'AVAILABLE' && d.is_deleted === 0);
    res.json({ code: 0, data: list });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

driverRoutes.post('/', requireRole(...adminRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_driver');
    const now = new Date().toISOString();
    const driver = await store.insert({ ...req.body, status: req.body.status || 'AVAILABLE', created_at: now, updated_at: now, created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0 });
    res.json({ code: 0, data: driver });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

driverRoutes.put('/:id', requireRole(...adminRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_driver');
    const updated = await store.update(Number(req.params.id), { ...req.body, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    res.json({ code: 0, data: updated });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

driverRoutes.delete('/:id', requireRole('SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    await getStore<any>('car_driver').update(Number(req.params.id), { is_deleted: 1, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    res.json({ code: 0, message: '已删除' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
