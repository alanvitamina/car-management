import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import {
  isFeishuConfigured,
  getDepartmentList,
  getDepartmentAllUsers,
  createApprovalInstance,
  sendFeishuMessage,
} from '../integration/feishu-client';

export const feishuRoutes = Router();
const now = () => new Date().toISOString();

// 获取组织架构树
feishuRoutes.get('/org-tree', async (_req: Request, res: Response) => {
  try {
    if (!isFeishuConfigured()) {
      res.json({ code: 0, data: { tree: [], total_users: 0, total_departments: 0, mock: true } });
      return;
    }

    const items = await getDepartmentList();
    let totalUsers = 0;

    const tree = await Promise.all(items.map(async (d: any) => {
      try {
        const users = await getDepartmentAllUsers(d.open_department_id);
        totalUsers += users.length;
        return {
          feishu_department_id: d.open_department_id,
          name: d.name || '根部门',
          parent_feishu_dept_id: d.parent_department_id || null,
          sort_order: 0,
          users: users.map((u: any) => ({
            open_id: u.open_id,
            name: u.name,
            employee_no: u.employee_no || '',
          })),
        };
      } catch {
        return { feishu_department_id: d.open_department_id, name: d.name || '根部门', parent_feishu_dept_id: null, sort_order: 0, users: [] };
      }
    }));

    res.json({ code: 0, data: { tree, total_users: totalUsers, total_departments: items.length } });
  } catch (e: any) {
    console.error('[feishu] 获取组织架构失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 执行组织架构同步（飞书 → 本地数据库）
feishuRoutes.post('/sync-org', async (_req: Request, res: Response) => {
  try {
    if (!isFeishuConfigured()) {
      res.status(400).json({ code: 400, message: '飞书应用未配置，无法同步' });
      return;
    }

    const deptStore = getStore<any>('sys_department');
    const userStore = getStore<any>('sys_user');

    const feishuDepts = await getDepartmentList();
    const deptIdMap: Record<string, number> = {};

    // 建立已有部门映射
    const existingDepts = await deptStore.find(() => true);
    existingDepts.forEach((d: any) => {
      if (d.feishu_department_id) deptIdMap[d.feishu_department_id] = d.id;
    });

    let deptAdded = 0;
    let deptUpdated = 0;

    // 按层级排序
    const sortedDepts = [...feishuDepts].sort((a: any, b: any) => {
      const aDepth = a.parent_department_id ? 1 : 0;
      const bDepth = b.parent_department_id ? 1 : 0;
      return aDepth - bDepth;
    });

    for (const d of sortedDepts) {
      const parentId = d.parent_department_id ? deptIdMap[d.parent_department_id] : null;
      const deptOpenId = d.open_department_id;
      const existingId = deptIdMap[deptOpenId];

      if (existingId) {
        await deptStore.update(existingId, {
          name: d.name || '未命名部门', parent_id: parentId,
          feishu_department_id: deptOpenId,
          updated_at: now(),
        });
        deptUpdated++;
      } else {
        const inserted = await deptStore.insert({
          parent_id: parentId, name: d.name || '未命名部门',
          feishu_department_id: deptOpenId,
          manager_id: null, sort_order: 0,
          created_at: now(), updated_at: now(), is_deleted: 0,
        });
        deptIdMap[deptOpenId] = inserted.id;
        deptAdded++;
      }
    }

    // 同步用户
    let userAdded = 0;
    let userUpdated = 0;
    const existingUsers = await userStore.find(() => true);

    for (const d of sortedDepts) {
      try {
        const users = await getDepartmentAllUsers(d.open_department_id);
        const localDeptId = deptIdMap[d.open_department_id] || 1;

        for (const u of users) {
          const existingUser = existingUsers.find(
            (eu: any) => eu.open_id === u.open_id && eu.is_deleted === 0
          );

          if (existingUser) {
            await userStore.update(existingUser.id, {
              name: u.name, employee_no: u.employee_no || existingUser.employee_no,
              mobile: u.mobile || existingUser.mobile,
              email: u.email || existingUser.email,
              department_id: localDeptId,
              updated_at: now(),
            });
            userUpdated++;
          } else {
            await userStore.insert({
              open_id: u.open_id, union_id: u.union_id || null,
              name: u.name, employee_no: u.employee_no || null,
              mobile: u.mobile || null,
              email: u.email || null,
              avatar_url: u.avatar_url || null,
              role: 'EMPLOYEE', department_id: localDeptId,
              status: 'ACTIVE',
              created_at: now(), updated_at: now(),
              created_by: null, updated_by: null, is_deleted: 0,
            });
            userAdded++;
          }
        }
      } catch (e: any) {
        console.warn(`[feishu] 同步部门 ${d.name} 用户失败: ${e.message}`);
      }
    }

    // 记录同步日志
    try {
      const logStore = getStore<any>('sys_integration_log');
      await logStore.insert({
        integration_type: 'FEISHU_SYNC',
        request_url: '/contact/v3/departments',
        request_body: null,
        response_body: JSON.stringify({ dept_count: feishuDepts.length, user_added: userAdded, user_updated: userUpdated }),
        status_code: 200, duration_ms: null,
        status: 'SUCCESS', error_message: null,
        created_at: now(),
      });
    } catch { /* 日志表可能不存在（JSON 模式） */ }

    res.json({
      code: 0, message: '同步完成',
      data: {
        departments: { added: deptAdded, updated: deptUpdated, total: feishuDepts.length },
        users: { added: userAdded, updated: userUpdated },
      },
    });
  } catch (e: any) {
    console.error('[feishu] 同步失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 飞书事件回调（审批结果、url_verification 等）
feishuRoutes.post('/callback', async (req: Request, res: Response) => {
  try {
    const { type, challenge, event } = req.body;

    // URL 验证（首次配置事件订阅地址时飞书会发 challenge）
    if (type === 'url_verification') {
      res.json({ challenge });
      return;
    }

    // 记录回调日志
    try {
      const logStore = getStore<any>('sys_integration_log');
      await logStore.insert({
        integration_type: 'FEISHU_CALLBACK',
        request_url: '/api/feishu/callback',
        request_body: JSON.stringify(req.body),
        response_body: null,
        status_code: 200, duration_ms: null,
        status: 'SUCCESS', error_message: null,
        created_at: now(),
      });
    } catch { /* ignore */ }

    // 审批实例状态变更
    if (event?.type === 'approval_instance') {
      const { approval_code, instance_code, status } = event;
      console.log(`[feishu] 审批回调: ${approval_code} ${instance_code} → ${status}`);

      // 根据 approval_code 查找本地审批记录并更新状态
      if (approval_code) {
        const approvalStore = getStore<any>('car_approval_record');
        const records = await approvalStore.find(r => r.feishu_approval_code === approval_code);
        for (const r of records) {
          const action = status === 'APPROVED' ? 'APPROVE'
            : status === 'REJECTED' ? 'REJECT'
            : status === 'CANCELED' ? 'CANCEL' : null;
          if (action) {
            await approvalStore.update(r.id, {
              action, acted_at: now(), sync_status: 'RECEIVED', updated_at: now(),
            });
          }
        }

        // 同步更新申请状态
        if (records.length > 0) {
          const appStore = getStore<any>('car_application');
          const appId = records[0].application_id;
          if (status === 'APPROVED') {
            const app = await appStore.findById(appId);
            if (app?.status === 'PENDING_L1') {
              const newStatus = app.l2_approver_id ? 'PENDING_L2' : 'PENDING_DISPATCH';
              await appStore.update(appId, { status: newStatus, updated_at: now() });
            } else if (app?.status === 'PENDING_L2') {
              await appStore.update(appId, { status: 'PENDING_DISPATCH', updated_at: now() });
            }
          } else if (status === 'REJECTED') {
            await appStore.update(appId, { status: 'REJECTED', updated_at: now() });
          }
        }
      }
    }

    res.json({ code: 0, message: 'OK' });
  } catch (e: any) {
    console.error('[feishu] 回调处理失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 创建飞书审批实例
feishuRoutes.post('/create-approval', async (req: Request, res: Response) => {
  try {
    const appStore = getStore<any>('car_application');
    const { application_id } = req.body;
    const app = await appStore.findById(application_id);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const approvalStore = getStore<any>('car_approval_record');
    const pendingApprovals = await approvalStore.find(
      r => r.application_id === application_id && r.sync_status === 'PENDING'
    );

    if (!isFeishuConfigured()) {
      // 降级为 mock code
      const mockCode = `FC_${Date.now()}`;
      for (const r of pendingApprovals) {
        await approvalStore.update(r.id, {
          feishu_approval_code: mockCode, sync_status: 'SENT', updated_at: now(),
        });
      }
      res.json({ code: 0, data: { feishu_approval_code: mockCode, mock: true } });
      return;
    }

    // 真实飞书审批实例创建
    for (const r of pendingApprovals) {
      const formValues = [
        { id: 'application_no', value: app.application_no },
        { id: 'applicant_name', value: app.applicant_name },
        { id: 'department', value: app.applicant_department_name },
        { id: 'destination', value: app.destination },
        { id: 'departure_at', value: app.departure_at },
        { id: 'return_at', value: app.return_at },
        { id: 'passenger_count', value: String(app.passenger_count) },
        { id: 'reason', value: app.reason },
      ];

      const instanceCode = await createApprovalInstance(
        process.env.FEISHU_APPROVAL_CODE || 'DEFAULT_APPROVAL_CODE',
        formValues,
        [{ openId: r.approver_id.toString(), level: r.approval_level === 'L1' ? 'l1' : 'l2' }]
      );

      await approvalStore.update(r.id, {
        feishu_approval_code: instanceCode, sync_status: 'SENT', updated_at: now(),
      });
    }

    // 记录日志
    try {
      const logStore = getStore<any>('sys_integration_log');
      await logStore.insert({
        integration_type: 'FEISHU_APPROVAL',
        request_url: '/approval/v4/instances',
        request_body: JSON.stringify({ application_id }),
        response_body: null, status_code: 200, duration_ms: null,
        status: 'SUCCESS', error_message: null,
        created_at: now(),
      });
    } catch { /* ignore */ }

    res.json({ code: 0, data: { sent: pendingApprovals.length } });
  } catch (e: any) {
    console.error('[feishu] 创建审批失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 发送飞书消息
feishuRoutes.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { recipient_id, recipient_name, title, content } = req.body;

    if (!isFeishuConfigured() || !recipient_id) {
      // 降级：本地通知
      const notifStore = getStore<any>('msg_notification_log');
      await notifStore.insert({
        recipient_id: recipient_id || 0, recipient_name: recipient_name || '',
        notification_type: 'SYSTEM_NOTICE',
        title: title || '系统通知', content: content || '',
        channel: 'IN_APP', send_status: 'PENDING',
        send_at: null, fail_reason: null, retry_count: 0,
        is_read: 0, created_at: now(),
      });
      res.json({ code: 0, data: { fallback: 'local_notification' } });
      return;
    }

    const messageId = await sendFeishuMessage(recipient_id, content, title);

    // 记录到本地通知表
    const notifStore = getStore<any>('msg_notification_log');
    await notifStore.insert({
      recipient_id, recipient_name: recipient_name || '',
      notification_type: 'SYSTEM_NOTICE',
      title: title || '系统通知', content: content || '',
      channel: 'FEISHU',
      send_status: 'SENT', send_at: now(),
      fail_reason: null, retry_count: 0,
      is_read: 0, created_at: now(),
    });

    res.json({ code: 0, data: { message_id: messageId } });
  } catch (e: any) {
    console.error('[feishu] 发送消息失败:', e.message);

    // 失败降级为本地通知
    try {
      const notifStore = getStore<any>('msg_notification_log');
      await notifStore.insert({
        recipient_id: req.body.recipient_id || 0, recipient_name: req.body.recipient_name || '',
        notification_type: 'SYSTEM_NOTICE',
        title: req.body.title || '系统通知', content: req.body.content || '',
        channel: 'IN_APP',
        send_status: 'FAILED', send_at: null,
        fail_reason: e.message, retry_count: 0,
        is_read: 0, created_at: now(),
      });
    } catch { /* ignore */ }

    res.status(500).json({ code: 500, message: e.message });
  }
});
