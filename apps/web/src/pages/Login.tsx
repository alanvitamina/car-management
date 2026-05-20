import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App, Divider, Space } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { authApi } from '../api';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();

  const handleLoginSuccess = (data: any) => {
    const { token, user } = data;
    localStorage.setItem('token', token);
    localStorage.setItem('uid', String(user.id));
    message.success('登录成功');
    navigate('/workbench');
  };

  // URL 参数处理 + 自动登录检测
  useEffect(() => {
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const mode = searchParams.get('mode');

    if (error) {
      message.error(`飞书登录失败: ${error}`);
      return;
    }

    if (token) {
      localStorage.setItem('token', token);
      authApi.getMe().then(res => {
        if (res.data.code === 0) {
          const user = res.data.data;
          localStorage.setItem('uid', String(user.id));
          message.success(`欢迎，${user.name}`);
          navigate('/workbench', { replace: true });
        }
      }).catch(() => message.error('登录验证失败'));
      return;
    }

    if (code) {
      setLoading(true);
      authApi.login({ code })
        .then(res => { if (res.data.code === 0) handleLoginSuccess(res.data.data); })
        .catch(() => message.error('飞书登录失败，请手动输入账号'))
        .finally(() => setLoading(false));
      return;
    }

    // 自动登录：已有有效 token 直接进系统
    if (mode !== 'switch' && mode !== 'manual') {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        setLoading(true);
        authApi.getMe().then(res => {
          if (res.data.code === 0) {
            localStorage.setItem('uid', String(res.data.data.id));
            navigate('/workbench', { replace: true });
          } else {
            localStorage.removeItem('token');
          }
        }).catch(() => localStorage.removeItem('token'))
          .finally(() => setLoading(false));
      }
    }
  }, []);

  // 飞书 OAuth：跳转飞书授权页
  const handleFeishuLogin = async () => {
    setFeishuLoading(true);
    try {
      const res = await authApi.getAuthUrl();
      if (res.data.code === 0 && res.data.data.url) {
        window.location.href = res.data.data.url;
      } else {
        message.error('飞书登录未配置，请使用手动登录');
      }
    } catch {
      message.error('获取飞书登录地址失败');
    } finally {
      setFeishuLoading(false);
    }
  };

  // 手动登录（开发模式 / 飞书未配置）
  const onFinish = async (values: { open_id: string }) => {
    setLoading(true);
    try {
      const res = await authApi.login({ open_id: values.open_id });
      if (res.data.code === 0) handleLoginSuccess(res.data.data);
    } catch {
      message.error('登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CarOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 16 }}>公务用车管理系统</Title>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            type="primary"
            icon={<span style={{ fontSize: 18 }}>飞</span>}
            loading={feishuLoading}
            onClick={handleFeishuLogin}
            block
            size="large"
            style={{ height: 48, fontSize: 16, background: '#3370ff', borderColor: '#3370ff' }}
          >
            飞书账号登录
          </Button>

          <Divider plain>开发模式手动登录</Divider>

          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="open_id" label="用户 ID" rules={[{ required: true, message: '请输入用户ID' }]}>
              <Input placeholder="输入 open_id，如 admin / emp01 / manager" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="default" htmlType="submit" loading={loading} block>
                登录系统
              </Button>
            </Form.Item>
          </Form>
        </Space>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            测试账号: admin / manager / emp01 / l1_approver / driver01
          </Text>
        </div>
      </Card>
    </div>
  );
}
