import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const vehicleRoutes = Router();
const adminRoles = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];

vehicleRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_vehicle');
    const { status, keyword } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.find(v => v.is_deleted === 0);
    if (status) list = list.filter(v => v.status === status);
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      list = list.filter(v => v.plate_number?.toLowerCase().includes(kw) || v.brand?.toLowerCase().includes(kw) || v.model?.toLowerCase().includes(kw));
    }

    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

vehicleRoutes.get('/available', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_vehicle');
    const dispatchStore = getStore<any>('car_dispatch_record');
    const { departure_at, return_at } = req.query;

    let list = await store.find(v => v.status === 'AVAILABLE' && v.is_deleted === 0);

    if (departure_at && return_at) {
      const allDispatches = await dispatchStore.find(d => ['RESERVED', 'IN_PROGRESS'].includes(d.status));
      const busyIds = new Set(
        allDispatches
          .filter(d => !(d.actual_return_at < departure_at || d.actual_departure_at > return_at))
          .map(d => d.vehicle_id)
      );
      list = list.filter(v => !busyIds.has(v.id));
    }

    res.json({ code: 0, data: list });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

vehicleRoutes.post('/', requireRole(...adminRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_vehicle');
    const existing = await store.findOne(v => v.plate_number === req.body.plate_number && v.is_deleted === 0);
    if (existing) {
      res.status(400).json({ code: 400, message: '车牌号已存在' }); return;
    }
    const now = new Date().toISOString();
    const vehicle = await store.insert({ ...req.body, status: req.body.status || 'AVAILABLE', created_at: now, updated_at: now, created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0 });
    res.json({ code: 0, data: vehicle });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

vehicleRoutes.put('/:id', requireRole(...adminRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_vehicle');
    const updated = await store.update(Number(req.params.id), { ...req.body, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    if (!updated) { res.status(404).json({ code: 404, message: '车辆不存在' }); return; }
    res.json({ code: 0, data: updated });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

vehicleRoutes.delete('/:id', requireRole('SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_vehicle');
    await store.update(Number(req.params.id), { is_deleted: 1, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    res.json({ code: 0, message: '已删除' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
