import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const userRoutes = Router();

userRoutes.get('/', requireRole('SYSTEM_ADMIN', 'ADMIN_MANAGER'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('sys_user');
    const deptStore = getStore<any>('sys_department');
    const { role, department_id, keyword } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.find(u => u.is_deleted === 0);
    if (role) list = list.filter(u => u.role === role);
    if (department_id) list = list.filter(u => u.department_id === Number(department_id));
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(kw) || u.mobile?.includes(kw));
    }

    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);

    const enriched = await Promise.all(list.map(async u => {
      const dept = await deptStore.findById(u.department_id);
      return { ...u, department_name: dept?.name || '' };
    }));

    res.json({ code: 0, data: { list: enriched, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

userRoutes.get('/todo-summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const appStore = getStore<any>('car_application');
    const consumptionStore = getStore<any>('car_consumption_record');
    const summary: any = {};

    if (['L1_APPROVER', 'L2_APPROVER', 'ADMIN_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
      const level = role === 'L2_APPROVER' ? 'PENDING_L2' : 'PENDING_L1';
      if (role === 'ADMIN_MANAGER' || role === 'SYSTEM_ADMIN') {
        summary.pendingApproval = await appStore.count(a => (a.status === 'PENDING_L1' || a.status === 'PENDING_L2') && a.is_deleted === 0);
      } else {
        summary.pendingApproval = await appStore.count(a => a.status === level && a.is_deleted === 0);
      }
    }

    if (['ADMIN_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
      summary.pendingDispatch = await appStore.count(a => a.status === 'PENDING_DISPATCH' && a.is_deleted === 0);
      summary.pendingConfirm = await consumptionStore.count(c => c.status === 'PENDING_CONFIRM');
    }

    summary.myApplications = await appStore.count(a => a.applicant_id === userId && a.is_deleted === 0);
    summary.inProgress = await appStore.count(a => a.applicant_id === userId && ['PENDING_DISPATCH', 'RESERVED', 'IN_PROGRESS'].includes(a.status) && a.is_deleted === 0);

    res.json({ code: 0, data: summary });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

userRoutes.put('/:id', requireRole('SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('sys_user');
    const id = Number(req.params.id);
    const user = await store.findById(id);
    if (!user) { res.status(404).json({ code: 404, message: '用户不存在' }); return; }

    const allowed = ['role', 'status'];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await store.update(id, { ...updates, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    res.json({ code: 0, data: updated });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
