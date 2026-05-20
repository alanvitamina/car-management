import { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, Typography, Space, App, Modal, Select, Form } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SyncOutlined, EditOutlined } from '@ant-design/icons';
import { userApi, authApi, feishuApi } from '../api';

const { Title } = Typography;

const roleMap: Record<string, { color: string; text: string }> = {
  SYSTEM_ADMIN: { color: 'red', text: '系统管理员' },
  ADMIN_MANAGER: { color: 'orange', text: '行政经理' },
  L1_APPROVER: { color: 'blue', text: '一级审批人' },
  L2_APPROVER: { color: 'blue', text: '二级审批人' },
  DRIVER: { color: 'green', text: '司机' },
  EMPLOYEE: { color: 'default', text: '普通员工' },
};

export default function Users() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [role, setRole] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm] = Form.useForm();
  const { message } = App.useApp();

  const isAdmin = role === 'SYSTEM_ADMIN';

  const fetchData = () => {
    setLoading(true);
    userApi.list({ pageSize: 100 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

  const handleEditUser = async () => {
    const values = await editForm.validateFields();
    try {
      await userApi.update(editingUser.id, values);
      message.success('更新成功');
      setEditModal(false); setEditingUser(null); fetchData();
    } catch { message.error('更新失败'); }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res = await feishuApi.syncOrg();
      const d = res.data.data;
      message.success(`同步完成：部门新增${d.departments?.added || 0} 更新${d.departments?.updated || 0}，用户新增${d.users?.added || 0} 更新${d.users?.updated || 0}`);
      fetchData();
    } catch {
      message.warning('同步失败，请检查飞书配置');
    } finally {
      setSyncLoading(false);
    }
  };

  const columns: ColumnsType<any> = [
    { title: 'ID', dataIndex: 'id', width: 60, fixed: 'left' as const },
    { title: '姓名', dataIndex: 'name', width: 100, ellipsis: true },
    { title: '工号', dataIndex: 'employee_no', width: 100 },
    { title: '手机号', dataIndex: 'mobile', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    { title: '角色', dataIndex: 'role', width: 120,
      render: (v: string) => <Tag color={roleMap[v]?.color}>{roleMap[v]?.text || v}</Tag> },
    { title: '部门', dataIndex: 'department_name', width: 100, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'success' : 'default'}>{v === 'ACTIVE' ? '正常' : '停用'}</Tag> },
    ...(isAdmin ? [{ title: '操作', width: 80, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(r); editForm.setFieldsValue(r); setEditModal(true); }}>编辑</Button>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        {isAdmin && <Button icon={<SyncOutlined />} onClick={handleSync} loading={syncLoading}>从飞书同步</Button>}
      </div>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} scroll={{ x: 900 }} />
      </Card>

      <Modal title="编辑用户" open={editModal} onOk={handleEditUser} onCancel={() => { setEditModal(false); setEditingUser(null); }}>
        <Form form={editForm} layout="vertical">
          <Form.Item label="姓名"><span>{editingUser?.name}</span></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { label: '系统管理员', value: 'SYSTEM_ADMIN' },
              { label: '行政经理', value: 'ADMIN_MANAGER' },
              { label: '一级审批人', value: 'L1_APPROVER' },
              { label: '二级审批人', value: 'L2_APPROVER' },
              { label: '司机', value: 'DRIVER' },
              { label: '普通员工', value: 'EMPLOYEE' },
            ]} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[
              { label: '正常', value: 'ACTIVE' },
              { label: '停用', value: 'INACTIVE' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
