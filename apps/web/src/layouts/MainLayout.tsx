import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, theme } from 'antd';
import {
  HomeOutlined, FileTextOutlined, PlusCircleOutlined, AuditOutlined,
  CarOutlined, CheckCircleOutlined, DollarOutlined, ToolOutlined,
  UserOutlined, TeamOutlined, SettingOutlined, LogoutOutlined, SwapOutlined,
  DashboardOutlined, BellOutlined,
} from '@ant-design/icons';
import { authApi, notificationApi } from '../api';

const { Header, Sider, Content } = Layout;

interface UserInfo {
  id: number;
  name: string;
  role: string;
  department_name: string;
  menus: MenuItem[];
}

interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: string;
}

const iconMap: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  PlusCircleOutlined: <PlusCircleOutlined />,
  AuditOutlined: <AuditOutlined />,
  CarOutlined: <CarOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  DollarOutlined: <DollarOutlined />,
  ToolOutlined: <ToolOutlined />,
  UserOutlined: <UserOutlined />,
  TeamOutlined: <TeamOutlined />,
  SettingOutlined: <SettingOutlined />,
  DashboardOutlined: <DashboardOutlined />,
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  useEffect(() => {
    authApi.getMe().then(res => setUser(res.data.data)).catch(() => navigate('/login'));
    // 获取未读通知数
    notificationApi.unreadCount().then(res => setUnread(res.data.data?.count || 0)).catch(() => {});
    const timer = setInterval(() => {
      notificationApi.unreadCount().then(res => setUnread(res.data.data?.count || 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = (user?.menus || []).map(m => ({
    key: m.path,
    icon: iconMap[m.icon] || <FileTextOutlined />,
    label: m.label,
  }));

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{ borderRight: `1px solid ${themeToken.colorBorderSecondary}` }}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 700,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          🚗 {!collapsed && '公务用车'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: themeToken.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          height: 56,
        }}>
          <Badge count={unread} size="small" style={{ marginRight: 24 }}>
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
          </Badge>
          <Dropdown menu={{
            items: [
              { key: 'role', label: `角色: ${user?.role || ''}`, disabled: true },
              { key: 'dept', label: `部门: ${user?.department_name || ''}`, disabled: true },
              { type: 'divider' },
              { key: 'switch', label: '切换账号', icon: <SwapOutlined /> },
              { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
            ],
            onClick: async ({ key }) => {
              if (key === 'switch') {
                localStorage.removeItem('token');
                localStorage.removeItem('uid');
                try {
                  const res = await authApi.getAuthUrl();
                  if (res.data.code === 0 && res.data.data.url) {
                    window.location.href = res.data.data.url;
                    return;
                  }
                } catch { /* fall through to login page */ }
                navigate('/login?mode=switch');
              }
              if (key === 'logout') {
                localStorage.removeItem('token');
                localStorage.removeItem('uid');
                navigate('/login?mode=manual');
              }
            },
          }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: themeToken.colorPrimary }} />
              <span>{user?.name || '用户'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: themeToken.colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
