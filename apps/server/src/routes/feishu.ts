import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { authMiddleware } from '../middleware/auth';
import {
  isFeishuConfigured,
  getDepartmentList,
  getDepartmentAllUsers,
  createApprovalInstance,
  sendFeishuMessage,
} from '../integration/feishu-client';

export const feishuRoutes = Router();
const now = () => new Date().toISOString();

// 递归拉取部门树
async function fetchDeptTree(parentDeptId?: string): Promise<any[]> {
  const children = await getDepartmentList(parentDeptId);
  if (children.length === 0) return [];

  const results = await Promise.all(children.map(async (d: any) => {
    // 子树和用户并行拉取，不互相等待
    const [subDepts, users] = await Promise.all([
      fetchDeptTree(d.open_department_id),
      getDepartmentAllUsers(d.open_department_id).catch(() => []),
    ]);
    return {
      feishu_department_id: d.open_department_id,
      name: d.name || `部门(${d.member_count || 0}人)`,
      parent_feishu_dept_id: d.parent_department_id || null,
      sort_order: d.order || 0,
      leader_open_id: d.leader_user_id || null,
      children: subDepts,
      users: users.map((u: any) => ({
        open_id: u.open_id,
        name: u.name,
        employee_no: u.employee_no || '',
        mobile: u.mobile || '',
      })),
    };
  }));

  return results;
}

// 获取组织架构树
feishuRoutes.get('/org-tree', async (_req: Request, res: Response) => {
  try {
    if (!isFeishuConfigured()) {
      res.json({ code: 0, data: { tree: [], total_users: 0, total_departments: 0, mock: true } });
      return;
    }

    const tree = await fetchDeptTree('0');
    let totalUsers = 0;
    let totalDepts = 0;

    // 递归统计
    function count(node: any) {
      totalDepts++;
      totalUsers += (node.users || []).length;
      (node.children || []).forEach((c: any) => count(c));
    }
    tree.forEach((d: any) => count(d));

    res.json({ code: 0, data: { tree, total_users: totalUsers, total_departments: totalDepts } });
  } catch (e: any) {
    console.error('[feishu] 获取组织架构失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 递归拉取全部子部门（扁平列表）
async function getAllDepartmentsFlat(parentDeptId?: string): Promise<any[]> {
  const children = await getDepartmentList(parentDeptId);
  if (children.length === 0) return [];
  const results = await Promise.all(children.map(async (d: any) => {
    const sub = await getAllDepartmentsFlat(d.open_department_id);
    return [d, ...sub];
  }));
  return results.flat();
}

// 执行组织架构同步（飞书 → 本地数据库）
feishuRoutes.post('/sync-org', async (req: Request, res: Response) => {
  try {
    if (!isFeishuConfigured()) {
      res.status(400).json({ code: 400, message: '飞书应用未配置，无法同步' });
      return;
    }

    const deptStore = getStore<any>('sys_department');
    const userStore = getStore<any>('sys_user');
    const { department_ids, user_open_ids } = req.body || {};

    // 递归拉取全部部门（含嵌套子部门）
    let feishuDepts = await getAllDepartmentsFlat('0');
    if (department_ids && Array.isArray(department_ids) && department_ids.length > 0) {
      feishuDepts = feishuDepts.filter((d: any) => department_ids.includes(d.open_department_id));
    }
    const deptIdMap: Record<string, number> = {};

    // 建立已有部门映射
    const existingDepts = await deptStore.find(() => true);
    existingDepts.forEach((d: any) => {
      if (d.feishu_department_id) deptIdMap[d.feishu_department_id] = d.id;
    });

    let deptAdded = 0;
    let deptUpdated = 0;

    // 按深度排序（确保父部门先于子部门创建，父子关系才能正确关联）
    const sortedDepts = [...feishuDepts].sort((a: any, b: any) => {
      const depth = (d: any) => {
        let n = 0;
        let cur = d;
        while (cur.parent_department_id) { n++; cur = feishuDepts.find((x: any) => x.open_department_id === cur.parent_department_id) || {}; }
        return n;
      };
      return depth(a) - depth(b);
    });
    console.log(`[feishu] 同步 ${sortedDepts.length} 个部门（含子部门），根级 ${sortedDepts.filter((d: any) => !d.parent_department_id).length} 个`);

    for (const d of sortedDepts) {
      const parentId = d.parent_department_id ? deptIdMap[d.parent_department_id] : null;
      const deptOpenId = d.open_department_id;
      const existingId = deptIdMap[deptOpenId];

      if (existingId) {
        await deptStore.update(existingId, {
          name: d.name || `部门(${d.member_count || 0}人)`, parent_id: parentId,
          feishu_department_id: deptOpenId,
          feishu_leader_open_id: d.leader_user_id || null,
          updated_at: now(),
        });
        deptUpdated++;
      } else {
        const inserted = await deptStore.insert({
          parent_id: parentId, name: d.name || `部门(${d.member_count || 0}人)`,
          feishu_department_id: deptOpenId,
          feishu_leader_open_id: d.leader_user_id || null,
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
          // 如果指定了用户范围，仅同步选中用户
          if (user_open_ids && Array.isArray(user_open_ids) && user_open_ids.length > 0) {
            if (!user_open_ids.includes(u.open_id)) continue;
          }

          const existingUser = existingUsers.find(
            (eu: any) => eu.open_id === u.open_id && eu.is_deleted === 0
          );

          if (existingUser) {
            await userStore.update(existingUser.id, {
              name: u.name, employee_no: u.employee_no || existingUser.employee_no,
              mobile: u.mobile || existingUser.mobile,
              email: u.email || existingUser.email,
              leader_open_id: u.leader_user_id || existingUser.leader_open_id,
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
              leader_open_id: u.leader_user_id || null,
              leader_user_id: null,
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

    // 解析部门负责人：将 feishu_leader_open_id 映射为本地用户 ID
    let leaderResolved = 0;
    const allDepts = await deptStore.find(() => true);
    const allUsers = await userStore.find(() => true);
    for (const dept of allDepts) {
      if (!dept.feishu_leader_open_id || dept.manager_id) continue;
      const leader = allUsers.find((u: any) => u.open_id === dept.feishu_leader_open_id && u.is_deleted !== 1);
      if (leader) {
        await deptStore.update(dept.id, { manager_id: leader.id, updated_at: now() });
        leaderResolved++;
      }
    }
    if (leaderResolved > 0) console.log(`[feishu] 已解析 ${leaderResolved} 个部门负责人`);

    // 解析用户直属上级：将 leader_open_id 映射为本地用户 ID
    let userLeaderResolved = 0;
    const allUsersAfterSync = await userStore.find(() => true);
    for (const u of allUsersAfterSync) {
      if (!u.leader_open_id || u.leader_user_id) continue;
      const leader = allUsersAfterSync.find((lu: any) => lu.open_id === u.leader_open_id && lu.is_deleted !== 1);
      if (leader) {
        await userStore.update(u.id, { leader_user_id: leader.id, updated_at: now() });
        userLeaderResolved++;
      }
    }
    if (userLeaderResolved > 0) console.log(`[feishu] 已解析 ${userLeaderResolved} 个用户直属上级`);

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

// 导入司机（从已同步的飞书用户中选择）
feishuRoutes.post('/import-drivers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) {
      res.status(400).json({ code: 400, message: '请选择至少一个用户' });
      return;
    }

    const userStore = getStore<any>('sys_user');
    const driverStore = getStore<any>('car_driver');
    const existingDrivers = await driverStore.find(() => true);

    let created = 0;
    let skipped = 0;

    for (const u of users) {
      // 确保用户存在于 sys_user
      let sysUser = await userStore.findOne(
        (x: any) => x.open_id === u.open_id && x.is_deleted === 0
      );
      if (!sysUser) {
        sysUser = await userStore.insert({
          open_id: u.open_id, union_id: u.union_id || null,
          name: u.name, employee_no: u.employee_no || null,
          mobile: u.mobile || null, email: u.email || null,
          avatar_url: u.avatar_url || null,
          role: 'DRIVER', department_id: 1,
          status: 'ACTIVE',
          created_at: now(), updated_at: now(),
          created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0,
        });
      } else {
        // 更新用户角色为 DRIVER（保留已有角色如果已是更高权限）
        if (sysUser.role === 'EMPLOYEE') {
          await userStore.update(sysUser.id, { role: 'DRIVER', updated_at: now() });
        }
      }

      // 检查是否已是司机
      const existingDriver = existingDrivers.find(
        (d: any) => d.user_id === sysUser.id && d.is_deleted === 0
      );
      if (existingDriver) {
        skipped++;
        continue;
      }

      await driverStore.insert({
        user_id: sysUser.id,
        name: u.name,
        license_number: null,
        license_type: null,
        mobile: u.mobile || '',
        status: 'AVAILABLE',
        hired_date: null,
        remark: null,
        created_at: now(), updated_at: now(),
        created_by: req.user!.id, updated_by: req.user!.id, is_deleted: 0,
      });
      created++;
    }

    res.json({
      code: 0, message: `成功导入 ${created} 名司机，跳过 ${skipped} 名已有`,
      data: { created, skipped },
    });
  } catch (e: any) {
    console.error('[feishu] 导入司机失败:', e.message);
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
              await appStore.update(appId, { status: 'PENDING_L2', updated_at: now() });
            } else if (app?.status === 'PENDING_L2' && app.is_long_distance_300km) {
              await appStore.update(appId, { status: 'PENDING_L3', updated_at: now() });
            } else if (app?.status === 'PENDING_L2' || app?.status === 'PENDING_L3') {
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
