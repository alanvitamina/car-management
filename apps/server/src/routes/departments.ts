import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';

export const departmentRoutes = Router();

departmentRoutes.get('/tree', async (_req: Request, res: Response) => {
  try {
    const store = getStore<any>('sys_department');
    const depts = await store.find(d => d.is_deleted === 0);
    depts.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

    const buildTree = (parentId: number | null): any[] =>
      depts.filter(d => d.parent_id === parentId).map(d => ({ ...d, children: buildTree(d.id) }));

    res.json({ code: 0, data: buildTree(null) });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

departmentRoutes.get('/:id/approver', async (req: Request, res: Response) => {
  try {
    const deptStore = getStore<any>('sys_department');
    const userStore = getStore<any>('sys_user');
    const dept = await deptStore.findById(Number(req.params.id));
    if (!dept) { res.status(404).json({ code: 404, message: '部门不存在' }); return; }

    const l1Approver = dept.manager_id
      ? await userStore.findOne(u => u.id === dept.manager_id && u.role === 'L1_APPROVER' && u.is_deleted === 0)
      : null;
    const l2Approver = await userStore.findOne(u => u.role === 'ADMIN_MANAGER' && u.is_deleted === 0);

    res.json({ code: 0, data: { l1_approver: l1Approver ? { id: l1Approver.id, name: l1Approver.name } : null, l2_approver: l2Approver ? { id: l2Approver.id, name: l2Approver.name } : null } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
