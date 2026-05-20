import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const approvalRoutes = Router();
const approverRoles = ['L1_APPROVER', 'L2_APPROVER', 'ADMIN_MANAGER', 'SYSTEM_ADMIN'];
const now = () => new Date().toISOString();

approvalRoutes.get('/pending', requireRole(...approverRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const role = req.user!.role;

    let list: any[];
    if (role === 'L1_APPROVER') {
      list = await store.find(a => a.status === 'PENDING_L1' && a.is_deleted === 0);
    } else if (role === 'L2_APPROVER') {
      list = await store.find(a => a.status === 'PENDING_L2' && a.is_deleted === 0);
    } else {
      list = await store.find(a => (a.status === 'PENDING_L1' || a.status === 'PENDING_L2') && a.is_deleted === 0);
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json({ code: 0, data: { list } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

approvalRoutes.post('/:id/approve', requireRole(...approverRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const role = req.user!.role;
    let newStatus: string, approvalLevel: string;

    if (app.status === 'PENDING_L1' && ['L1_APPROVER', 'ADMIN_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
      newStatus = app.l2_approver_id ? 'PENDING_L2' : 'PENDING_DISPATCH';
      approvalLevel = 'L1';
      if (app.l2_approver_id) {
        const approvalStore = getStore<any>('car_approval_record');
        await approvalStore.insert({ application_id: app.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L2', approver_id: app.l2_approver_id, approver_name: app.l2_approver_name, action: null, comment: null, acted_at: null, sync_status: 'PENDING', raw_callback: null, created_at: now(), updated_at: now() });
      }
    } else if (app.status === 'PENDING_L2' && ['L2_APPROVER', 'ADMIN_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
      newStatus = 'PENDING_DISPATCH';
      approvalLevel = 'L2';
    } else {
      res.status(400).json({ code: 400, message: '当前状态不可审批或无权审批' }); return;
    }

    await store.update(app.id, { status: newStatus, updated_by: req.user!.id, updated_at: now() });

    const approvalStore = getStore<any>('car_approval_record');
    const { comment } = req.body;
    const pendingApprovals = await approvalStore.find(r => r.application_id === app.id && r.approval_level === approvalLevel && r.approver_id === req.user!.id);
    for (const r of pendingApprovals) {
      await approvalStore.update(r.id, { action: 'APPROVE', comment: comment || null, acted_at: now(), sync_status: 'CONFIRMED', updated_at: now() });
    }

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'APPROVE', operator_id: req.user!.id, operator_name: req.user!.name, from_status: app.status, to_status: newStatus, detail: comment || null, created_at: now() });

    res.json({ code: 0, data: { status: newStatus, from_status: app.status, approval_level: approvalLevel } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

approvalRoutes.post('/:id/reject', requireRole(...approverRoles), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (!['PENDING_L1', 'PENDING_L2'].includes(app.status)) { res.status(400).json({ code: 400, message: '当前状态不可审批' }); return; }

    const approvalLevel = app.status === 'PENDING_L1' ? 'L1' : 'L2';
    await store.update(app.id, { status: 'REJECTED', updated_by: req.user!.id, updated_at: now() });

    const { comment } = req.body;
    const approvalStore = getStore<any>('car_approval_record');
    const pendingApprovals = await approvalStore.find(r => r.application_id === app.id && r.approval_level === approvalLevel && r.approver_id === req.user!.id);
    for (const r of pendingApprovals) {
      await approvalStore.update(r.id, { action: 'REJECT', comment: comment || null, acted_at: now(), sync_status: 'CONFIRMED', updated_at: now() });
    }

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'REJECT', operator_id: req.user!.id, operator_name: req.user!.name, from_status: app.status, to_status: 'REJECTED', detail: comment || null, created_at: now() });

    res.json({ code: 0, data: { status: 'REJECTED', from_status: app.status } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
