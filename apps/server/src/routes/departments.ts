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

    const userId = req.query.user_id ? Number(req.query.user_id) : null;
    let l1Approver: any = null;

    if (userId) {
      // L1: 用车人的直属上级（从飞书用户 leader_user_id 解析而来）
      const applicantUser = await userStore.findOne(u => u.id === userId && u.is_deleted === 0);
      if (applicantUser?.leader_user_id) {
        l1Approver = await userStore.findOne(u => u.id === applicantUser.leader_user_id && u.is_deleted === 0);
      }
    }

    // 回退：无直属上级时用部门负责人
    if (!l1Approver && dept.manager_id) {
      l1Approver = await userStore.findOne(u => u.id === dept.manager_id && u.is_deleted === 0);
    }

    // L2 (正常): 行政经理
    const adminManager = await userStore.findOne(u => u.role === 'ADMIN_MANAGER' && u.is_deleted === 0);

    // L2 (>300km): 常务副总裁
    const seniorVp = await userStore.findOne(u => u.role === 'SENIOR_VP' && u.is_deleted === 0);

    res.json({ code: 0, data: {
      l1_approver: l1Approver ? { id: l1Approver.id, name: l1Approver.name } : null,
      l2_approver: adminManager ? { id: adminManager.id, name: adminManager.name } : null,
      l2_vp_approver: seniorVp ? { id: seniorVp.id, name: seniorVp.name } : null,
    } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
