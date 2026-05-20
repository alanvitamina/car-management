import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { generateToken } from '../middleware/auth';
import { exchangeCodeForToken, getUserInfo, isFeishuConfigured } from '../integration/feishu-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'govcar-dev-secret-key-change-in-production';

export const authRoutes = Router();

// 飞书应用入口 SSO（可作为飞书应用主页 URL）
authRoutes.get('/feishu/entry', (_req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (!isFeishuConfigured()) {
    res.redirect(`${frontendUrl}/login?mode=manual`);
    return;
  }
  const appId = process.env.FEISHU_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.FEISHU_REDIRECT_URI || 'http://localhost:8080'}/api/auth/feishu/callback`
  );
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}`;
  res.redirect(url);
});

// 飞书 OAuth 授权入口 URL（前端跳转用）
authRoutes.get('/feishu/auth-url', (_req: Request, res: Response) => {
  if (!isFeishuConfigured()) {
    res.status(400).json({ code: 400, message: '飞书应用未配置' }); return;
  }
  const appId = process.env.FEISHU_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.FEISHU_REDIRECT_URI || 'http://localhost:8080'}/api/auth/feishu/callback`
  );
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}`;
  res.json({ code: 0, data: { url } });
});

// 飞书 OAuth 回调：用 authorization code 换取用户信息
authRoutes.get('/feishu/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=missing_code`);
      return;
    }

    if (!isFeishuConfigured()) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=feishu_not_configured`);
      return;
    }

    // 用 code 换取 user_access_token
    const { userAccessToken, openId } = await exchangeCodeForToken(code);

    // 获取用户信息
    const feishuUser = await getUserInfo(userAccessToken);

    // 在本地数据库中查找或创建用户
    const userStore = getStore<any>('sys_user');
    let user = await userStore.findOne(u => u.open_id === openId && u.is_deleted === 0);

    if (!user) {
      // 新用户自动注册，默认 EMPLOYEE 角色
      const deptStore = getStore<any>('sys_department');
      const depts = await deptStore.find(d => d.is_deleted === 0);
      const defaultDept = depts[0];
      const now = new Date().toISOString();
      user = await userStore.insert({
        open_id: openId,
        union_id: feishuUser.union_id || null,
        name: feishuUser.name || `飞书用户`,
        employee_no: feishuUser.employee_no || null,
        mobile: feishuUser.mobile || null,
        email: feishuUser.email || null,
        avatar_url: feishuUser.avatar_url || null,
        role: 'EMPLOYEE',
        department_id: defaultDept?.id || 1,
        status: 'ACTIVE',
        created_at: now, updated_at: now,
        created_by: null, updated_by: null,
        is_deleted: 0,
      });
      console.log(`[feishu] 新用户注册: ${feishuUser.name} (${openId})`);
    } else {
      // 更新已有用户的飞书信息
      const updates: any = { updated_at: new Date().toISOString() };
      if (feishuUser.name) updates.name = feishuUser.name;
      if (feishuUser.avatar_url) updates.avatar_url = feishuUser.avatar_url;
      if (feishuUser.email) updates.email = feishuUser.email;
      if (feishuUser.mobile) updates.mobile = feishuUser.mobile;
      await userStore.update(user.id, updates);
    }

    const token = generateToken({
      id: user.id, open_id: user.open_id, name: user.name,
      role: user.role, department_id: user.department_id,
    });

    // 重定向到前端，URL 参数里带 token
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login/callback?token=${encodeURIComponent(token)}`
    );
  } catch (e: any) {
    console.error('[feishu] 登录回调失败:', e.message);
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent(e.message)}`
    );
  }
});

// 飞书 SSO 回调（POST 版本，兼容前端 fetch 调用）
authRoutes.post('/feishu/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ code: 400, message: '缺少飞书授权码' }); return; }

    if (!isFeishuConfigured()) {
      // 飞书未配置时降级为 mock 模式
      const userStore = getStore<any>('sys_user');
      const user = await userStore.findOne(u => u.open_id === code && u.is_deleted === 0);
      if (!user) { res.status(404).json({ code: 404, message: '用户不存在' }); return; }
      const token = generateToken({
        id: user.id, open_id: user.open_id, name: user.name,
        role: user.role, department_id: user.department_id,
      });
      res.json({ code: 0, data: { token, user: { id: user.id, name: user.name, role: user.role, department_id: user.department_id } } });
      return;
    }

    const { userAccessToken, openId } = await exchangeCodeForToken(code);
    const feishuUser = await getUserInfo(userAccessToken);

    const userStore = getStore<any>('sys_user');
    let user = await userStore.findOne(u => u.open_id === openId && u.is_deleted === 0);

    if (!user) {
      const deptStore = getStore<any>('sys_department');
      const depts = await deptStore.find(d => d.is_deleted === 0);
      const defaultDept = depts[0];
      const now = new Date().toISOString();
      user = await userStore.insert({
        open_id: openId, union_id: feishuUser.union_id || null,
        name: feishuUser.name || `飞书用户`,
        employee_no: feishuUser.employee_no || null,
        mobile: feishuUser.mobile || null, email: feishuUser.email || null,
        avatar_url: feishuUser.avatar_url || null,
        role: 'EMPLOYEE', department_id: defaultDept?.id || 1,
        status: 'ACTIVE', created_at: now, updated_at: now,
        created_by: null, updated_by: null, is_deleted: 0,
      });
      console.log(`[feishu] 新用户注册: ${feishuUser.name} (${openId})`);
    }

    const token = generateToken({
      id: user.id, open_id: user.open_id, name: user.name,
      role: user.role, department_id: user.department_id,
    });

    res.json({
      code: 0, data: {
        token,
        user: { id: user.id, name: user.name, role: user.role, department_id: user.department_id },
      },
    });
  } catch (e: any) {
    console.error('[feishu] 登录失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 简单登录（传 open_id，飞书未配置或开发模式使用）
authRoutes.post('/feishu/login', async (req: Request, res: Response) => {
  try {
    const { open_id } = req.body;
    const store = getStore<any>('sys_user');
    const user = await store.findOne(u => u.open_id === open_id && u.is_deleted === 0);

    if (!user) { res.status(401).json({ code: 401, message: '用户不存在或未授权' }); return; }
    if (user.status !== 'ACTIVE') { res.status(403).json({ code: 403, message: '账号已停用' }); return; }

    const token = generateToken({
      id: user.id, open_id: user.open_id, name: user.name,
      role: user.role, department_id: user.department_id,
    });

    res.json({ code: 0, data: { token, user: { id: user.id, name: user.name, role: user.role, department_id: user.department_id } } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

authRoutes.get('/me', async (req: Request, res: Response) => {
  try {
    const userStore = getStore<any>('sys_user');
    let user: any = null;

    const devUserId = req.headers['x-user-id'] as string;
    if (devUserId && process.env.NODE_ENV !== 'production') {
      user = await userStore.findOne(u => u.id === Number(devUserId) && u.is_deleted === 0);
    }

    if (!user) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
          user = await userStore.findOne(u => u.id === decoded.id && u.is_deleted === 0);
        } catch { /* token invalid */ }
      }
    }

    if (!user) { res.status(401).json({ code: 401, message: '未登录' }); return; }

    const deptStore = getStore<any>('sys_department');
    const dept = await deptStore.findById(user.department_id);

    const { is_deleted, ...safeUser } = user;
    res.json({ code: 0, data: { ...safeUser, department_name: dept?.name || '', menus: getMenusByRole(user.role) } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

function getMenusByRole(role: string) {
  const baseMenus = [{ key: 'workbench', label: '工作台', path: '/workbench', icon: 'HomeOutlined' }];
  const employeeMenus = [...baseMenus,
    { key: 'my-applications', label: '我的申请', path: '/my-applications', icon: 'FileTextOutlined' },
    { key: 'new-application', label: '发起申请', path: '/new-application', icon: 'PlusCircleOutlined' },
  ];
  const managerMenus = [...baseMenus,
    { key: 'dispatch', label: '派车管理', path: '/dispatch', icon: 'CarOutlined' },
    { key: 'consumption', label: '消耗核验', path: '/consumption', icon: 'CheckCircleOutlined' },
    { key: 'subsidy', label: '补助核算', path: '/subsidy', icon: 'DollarOutlined' },
    { key: 'vehicles', label: '车辆管理', path: '/vehicles', icon: 'ToolOutlined' },
    { key: 'drivers', label: '司机管理', path: '/drivers', icon: 'UserOutlined' },
    { key: 'dashboard', label: '数据看板', path: '/dashboard', icon: 'DashboardOutlined' },
  ];
  const approverMenus = [...baseMenus,
    { key: 'approvals', label: '待审批', path: '/approvals', icon: 'AuditOutlined' },
  ];
  const driverMenus = [...baseMenus,
    { key: 'consumption', label: '消耗录入', path: '/consumption', icon: 'CheckCircleOutlined' },
    { key: 'vehicles', label: '车辆台账', path: '/vehicles', icon: 'ToolOutlined' },
    { key: 'drivers', label: '司机状态', path: '/drivers', icon: 'UserOutlined' },
  ];
  const adminMenus = [...managerMenus,
    { key: 'users', label: '用户管理', path: '/users', icon: 'TeamOutlined' },
  ];
  switch (role) {
    case 'SYSTEM_ADMIN': return adminMenus;
    case 'ADMIN_MANAGER': return managerMenus;
    case 'L1_APPROVER': case 'L2_APPROVER': return approverMenus;
    case 'DRIVER': return driverMenus;
    default: return employeeMenus;
  }
}
