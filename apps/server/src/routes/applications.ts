import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

export const applicationRoutes = Router();

function generateApplicationNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `GC${dateStr}${uuidv4().slice(0, 6).toUpperCase()}`;
}

const CANCELLABLE = ['DRAFT', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'PENDING_DISPATCH', 'RESERVED'];
const now = () => new Date().toISOString();

// 获取申请列表
applicationRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, application_type, keyword } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.find(a => a.is_deleted === 0);

    if (!['SYSTEM_ADMIN', 'ADMIN_MANAGER', 'L1_APPROVER', 'L2_APPROVER', 'SENIOR_VP'].includes(role)) {
      list = list.filter(a => a.applicant_id === userId);
    }
    if (status) {
      if (status === 'PENDING_APPROVAL') {
        list = list.filter(a => a.status === 'PENDING_L1' || a.status === 'PENDING_L2' || a.status === 'PENDING_L3');
      } else {
        list = list.filter(a => a.status === status);
      }
    }
    if (application_type) list = list.filter(a => a.application_type === application_type);
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      list = list.filter(a => a.application_no?.toLowerCase().includes(kw) || a.applicant_name?.toLowerCase().includes(kw) || a.destination?.toLowerCase().includes(kw) || a.reason?.toLowerCase().includes(kw));
    }

    const total = list.length;
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    list = list.slice((page - 1) * pageSize, page * pageSize);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 获取申请详情
applicationRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const logStore = getStore<any>('car_application_operation_log');
    const approvalStore = getStore<any>('car_approval_record');
    const dispatchStore = getStore<any>('car_dispatch_record');

    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const ops = await logStore.find(l => l.application_id === app.id);
    ops.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const approvals = await approvalStore.find(r => r.application_id === app.id);
    const dispatches = await dispatchStore.find(d => d.application_id === app.id);

    res.json({ code: 0, data: { ...app, operation_logs: ops, approval_records: approvals, dispatch_records: dispatches } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 创建申请
applicationRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const deptStore = getStore<any>('sys_department');
    const userStore = getStore<any>('sys_user');
    const store = getStore<any>('car_application');
    const { application_type, departure_at, return_at, origin, destination, passenger_count, reason, l1_approver_id, l1_approver_name, l2_approver_id, l2_approver_name, l3_approver_id, l3_approver_name, remark, applicant_id, is_long_distance_300km } = req.body;

    if (!['OFFICIAL', 'PRIVATE'].includes(application_type)) {
      res.status(400).json({ code: 400, message: '申请类型无效' }); return;
    }

    // 用车人：若传了 applicant_id 则用选中的用户，否则用当前登录用户
    let applicantUserId = req.user!.id;
    let applicantName = req.user!.name;
    let applicantDeptId = req.user!.department_id;
    if (applicant_id && applicant_id !== req.user!.id) {
      const selectedUser = await userStore.findOne((u: any) => u.id === applicant_id && u.is_deleted === 0);
      if (selectedUser) {
        applicantUserId = selectedUser.id;
        applicantName = selectedUser.name;
        applicantDeptId = selectedUser.department_id;
      }
    }

    const dept = await deptStore.findById(applicantDeptId);
    const app = await store.insert({
      application_no: generateApplicationNo(), application_type, applicant_id: applicantUserId,
      applicant_name: applicantName, applicant_department_id: applicantDeptId,
      applicant_department_name: dept?.name || '',
      departure_at, return_at, origin, destination, passenger_count: passenger_count || 1, reason,
      l1_approver_id: l1_approver_id || null, l1_approver_name: l1_approver_name || null,
      l2_approver_id: l2_approver_id || null, l2_approver_name: l2_approver_name || null,
      l3_approver_id: l3_approver_id || null, l3_approver_name: l3_approver_name || null,
      is_long_distance_300km: is_long_distance_300km ? true : false,
      status: 'DRAFT', attachments: null, remark: remark || null,
      cancelled_at: null, cancelled_by: null, cancel_reason: null, change_from_id: null, change_reason: null,
      external_ref_no: null, created_at: now(), updated_at: now(), created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0,
    });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'CREATE', operator_id: req.user!.id, operator_name: req.user!.name, from_status: null, to_status: 'DRAFT', detail: '创建申请', created_at: now() });

    res.json({ code: 0, data: app });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 更新申请（仅草稿）
applicationRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (app.status !== 'DRAFT') { res.status(400).json({ code: 400, message: '仅草稿状态可编辑' }); return; }

    const updates = { ...req.body, updated_by: req.user!.id, updated_at: now() };
    delete updates.id;
    const updated = await store.update(Number(req.params.id), updates);
    res.json({ code: 0, data: updated });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 提交申请
applicationRoutes.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const approvalStore = getStore<any>('car_approval_record');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (app.status !== 'DRAFT') { res.status(400).json({ code: 400, message: '当前状态不可提交' }); return; }

    if (!app.l1_approver_id) {
      res.status(400).json({ code: 400, message: '请先设置一级审批人后再提交' }); return;
    }

    const isLongDistance = app.is_long_distance_300km === true;

    await store.update(app.id, { status: 'PENDING_L1', updated_by: req.user!.id, updated_at: now() });

    await approvalStore.insert({ application_id: app.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L1', approver_id: app.l1_approver_id, approver_name: app.l1_approver_name, action: null, comment: null, acted_at: null, sync_status: 'PENDING', raw_callback: null, created_at: now(), updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    const detail = isLongDistance ? '提交申请（长途>300km，需常务副总裁+行政经理审批）' : '提交申请';
    await logStore.insert({ application_id: app.id, operation: 'SUBMIT', operator_id: req.user!.id, operator_name: req.user!.name, from_status: 'DRAFT', to_status: 'PENDING_L1', detail, created_at: now() });

    res.json({ code: 0, data: { status: 'PENDING_L1' } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 取消申请
applicationRoutes.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const dispatchStore = getStore<any>('car_dispatch_record');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (!CANCELLABLE.includes(app.status)) { res.status(400).json({ code: 400, message: `当前状态 ${app.status} 不可取消` }); return; }

    if (app.status === 'RESERVED') {
      const vehicleStore = getStore<any>('car_vehicle');
      const driverStore = getStore<any>('car_driver');
      const dispatches = await dispatchStore.find(d => d.application_id === app.id && d.status === 'RESERVED');
      for (const d of dispatches) {
        await dispatchStore.update(d.id, { status: 'CANCELLED', updated_at: now() });
        await vehicleStore.update(d.vehicle_id, { status: 'AVAILABLE', updated_at: now() });
        await driverStore.update(d.driver_id, { status: 'AVAILABLE', updated_at: now() });
      }
    }

    const { reason } = req.body;
    await store.update(app.id, { status: 'CANCELLED', cancelled_at: now(), cancelled_by: req.user!.id, cancel_reason: reason || null, updated_by: req.user!.id, updated_at: now() });

    const approvalStore = getStore<any>('car_approval_record');
    const pendingApprovals = await approvalStore.find(r => r.application_id === app.id && r.sync_status === 'SENT');
    for (const r of pendingApprovals) {
      await approvalStore.update(r.id, { sync_status: 'CANCELLED', updated_at: now() });
    }

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'CANCEL', operator_id: req.user!.id, operator_name: req.user!.name, from_status: app.status, to_status: 'CANCELLED', detail: reason || null, created_at: now() });

    res.json({ code: 0, data: { status: 'CANCELLED' } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 变更申请（生成变更单）
applicationRoutes.post('/:id/change', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const changeable = ['PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'REJECTED'];
    if (!changeable.includes(app.status)) { res.status(400).json({ code: 400, message: `当前状态 ${app.status} 不支持变更` }); return; }

    const { change_reason, ...updates } = req.body;
    const newApp = await store.insert({
      application_no: generateApplicationNo(), application_type: app.application_type,
      applicant_id: req.user!.id, applicant_name: req.user!.name,
      applicant_department_id: req.user!.department_id, applicant_department_name: app.applicant_department_name,
      departure_at: updates.departure_at || app.departure_at, return_at: updates.return_at || app.return_at,
      origin: updates.origin || app.origin, destination: updates.destination || app.destination,
      passenger_count: updates.passenger_count || app.passenger_count, reason: updates.reason || app.reason,
      l1_approver_id: updates.l1_approver_id || app.l1_approver_id, l1_approver_name: updates.l1_approver_name || app.l1_approver_name,
      l2_approver_id: updates.l2_approver_id || app.l2_approver_id, l2_approver_name: updates.l2_approver_name || app.l2_approver_name,
      l3_approver_id: updates.l3_approver_id || app.l3_approver_id, l3_approver_name: updates.l3_approver_name || app.l3_approver_name,
      is_long_distance_300km: updates.is_long_distance_300km != null ? updates.is_long_distance_300km : app.is_long_distance_300km,
      status: 'DRAFT', change_from_id: app.id, change_reason: change_reason || null,
      attachments: null, remark: app.remark, cancelled_at: null, cancelled_by: null, cancel_reason: null,
      external_ref_no: null, created_at: now(), updated_at: now(), created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0,
    });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'CHANGE', operator_id: req.user!.id, operator_name: req.user!.name, from_status: app.status, to_status: app.status, detail: `生成变更单: ${newApp.application_no}`, created_at: now() });

    res.json({ code: 0, data: newApp });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 软删除申请（仅系统管理员）
applicationRoutes.delete('/:id', requireRole('SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const app = await store.findOne(a => a.id === Number(req.params.id) && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const cancellable = ['DRAFT', 'REJECTED', 'CANCELLED', 'COMPLETED'];
    if (!cancellable.includes(app.status)) {
      res.status(400).json({ code: 400, message: `状态 ${app.status} 不可删除，请先取消后再删除` }); return;
    }

    await store.update(app.id, { is_deleted: 1, updated_by: req.user!.id, updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: app.id, operation: 'DELETE', operator_id: req.user!.id, operator_name: req.user!.name, from_status: app.status, to_status: app.status, detail: '系统管理员删除', created_at: now() });

    res.json({ code: 0, message: '已删除' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
