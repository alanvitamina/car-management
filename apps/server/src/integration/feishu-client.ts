const BASE_URL = 'https://open.feishu.cn/open-apis';

// App Access Token 缓存（有效期约 2 小时，提前 5 分钟刷新）
let cachedAppToken: { token: string; expiresAt: number } | null = null;

function getAppId(): string { return process.env.FEISHU_APP_ID || ''; }
function getAppSecret(): string { return process.env.FEISHU_APP_SECRET || ''; }

export function isFeishuConfigured(): boolean {
  return !!(getAppId() && getAppSecret());
}

async function feishuRequest<T = any>(method: 'GET' | 'POST', path: string, body?: any, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as any;
  if (json.code !== 0) {
    throw new Error(`飞书 API 错误 [${path}]: code=${json.code} msg=${json.msg}`);
  }
  return json as T;
}

// ============================================================
// App Access Token（服务端调用飞书 API 使用）
// ============================================================
export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.token;
  }

  const data = await feishuRequest<{ app_access_token: string; expire: number }>(
    'POST', '/auth/v3/app_access_token/internal',
    { app_id: getAppId(), app_secret: getAppSecret() }
  );

  cachedAppToken = {
    token: data.app_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000, // 提前 5 分钟刷新
  };

  return cachedAppToken.token;
}

// ============================================================
// 用户认证（OAuth 回调使用）
// ============================================================
export interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  employee_no?: string;
  avatar_url?: string;
}

export async function exchangeCodeForToken(code: string): Promise<{ userAccessToken: string; openId: string }> {
  const appToken = await getAppAccessToken();
  const data = await feishuRequest<{ data: { access_token: string; open_id: string } }>(
    'POST', '/authen/v1/access_token',
    { grant_type: 'authorization_code', code },
    appToken
  );
  return { userAccessToken: data.data.access_token, openId: data.data.open_id };
}

export async function getUserInfo(userAccessToken: string): Promise<FeishuUserInfo> {
  const data = await feishuRequest<{ data: FeishuUserInfo }>('GET', '/authen/v1/user_info', undefined, userAccessToken);
  return data.data;
}

// ============================================================
// 通讯录同步
// ============================================================
export async function getDepartmentList(parentDeptId?: string): Promise<any[]> {
  const appToken = await getAppAccessToken();
  let allItems: any[] = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ page_size: '50' });
    if (parentDeptId) params.set('parent_department_id', parentDeptId);
    if (pageToken) params.set('page_token', pageToken);

    const data = await feishuRequest<{ data: { items: any[]; has_more: boolean; page_token: string } }>(
      'GET', `/contact/v3/departments?${params.toString()}`, undefined, appToken
    );
    allItems = allItems.concat(data.data.items || []);
    pageToken = data.data.page_token;
    if (!data.data.has_more) break;
  } while (true);

  return allItems;
}

export async function getDepartmentAllUsers(deptId: string): Promise<any[]> {
  const appToken = await getAppAccessToken();
  let allItems: any[] = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ department_id_type: 'open_department_id', page_size: '50', department_id: deptId });
    if (pageToken) params.set('page_token', pageToken);

    const data = await feishuRequest<{ data: { items: any[]; has_more: boolean; page_token: string } }>(
      'GET', `/contact/v3/users?${params.toString()}`, undefined, appToken
    );
    allItems = allItems.concat(data.data.items || []);
    pageToken = data.data.page_token;
    if (!data.data.has_more) break;
  } while (true);

  return allItems;
}

// ============================================================
// 审批实例
// ============================================================
export async function createApprovalInstance(
  approvalCode: string,
  formValues: any[],
  approvers: { openId: string; level: 'l1' | 'l2' }[]
): Promise<string> {
  const appToken = await getAppAccessToken();

  const nodeApproverList = approvers.map(a => ({
    key: a.level,
    value: [{ id: a.openId, type: 'open_id' }],
  }));

  const body = {
    approval_code: approvalCode,
    form: JSON.stringify(formValues),
    node_approver_user_id_list: nodeApproverList,
    open_id: approvers[0]?.openId || '',
  };

  const data = await feishuRequest<{ data: { instance_code: string } }>(
    'POST', '/approval/v4/instances', body, appToken
  );
  return data.data.instance_code;
}

// ============================================================
// 消息发送
// ============================================================
export async function sendFeishuMessage(
  openId: string,
  content: string,
  title?: string
): Promise<string> {
  const appToken = await getAppAccessToken();

  const msgContent = title
    ? JSON.stringify([{ tag: 'text', text: `**${title}**\n${content}` }])
    : JSON.stringify([{ tag: 'text', text: content }]);

  const body = {
    receive_id: openId,
    receive_id_type: 'open_id',
    msg_type: 'post',
    content: msgContent,
  };

  const data = await feishuRequest<{ data: { message_id: string } }>(
    'POST', '/im/v1/messages', body, appToken
  );
  return data.data.message_id;
}
