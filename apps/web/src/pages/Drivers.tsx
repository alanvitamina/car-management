import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Card, Typography, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { driverApi, authApi, feishuApi } from '../api';

const { Title } = Typography;

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];

export default function Drivers() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [role, setRole] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const isAdmin = ADMIN_ROLES.includes(role);

  const fetchData = () => {
    setLoading(true);
    driverApi.list({ pageSize: 50 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

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

  const handleSave = async () => {
    const values = await form.validateFields();
    setActionLoading(true);
    try {
      if (editing) {
        await driverApi.update(editing.id, values);
        message.success('更新成功');
      } else {
        await driverApi.create(values);
        message.success('添加成功');
      }
      setModalOpen(false); setEditing(null); form.resetFields(); fetchData();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const columns: ColumnsType<any> = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '手机号', dataIndex: 'mobile', width: 130 },
    { title: '驾驶证号', dataIndex: 'license_number', width: 160 },
    { title: '驾照类型', dataIndex: 'license_type', width: 90 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          AVAILABLE: { color: 'success', text: '空闲' },
          ON_TRIP: { color: 'processing', text: '出车中' },
          REST: { color: 'warning', text: '休息' },
          OFF: { color: 'default', text: '休假' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.text || v}</Tag>;
      }},
    { title: '入职日期', dataIndex: 'hired_date', width: 120 },
    ...(isAdmin ? [{ title: '操作', width: 160, render: (_: any, r: any) => (
      <Space>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
        <Button size="small" danger onClick={async () => { await driverApi.remove(r.id); fetchData(); }}>删除</Button>
      </Space>
    )}] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>司机管理</Title>
        <Space>
          {role === 'SYSTEM_ADMIN' && <Button icon={<SyncOutlined />} onClick={handleSync} loading={syncLoading}>从飞书同步</Button>}
          {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>添加司机</Button>}
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal title={editing ? '编辑司机' : '添加司机'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} confirmLoading={actionLoading}>
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="关联用户 ID" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mobile" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="license_number" label="驾驶证号"><Input /></Form.Item>
          <Form.Item name="license_type" label="驾照类型">
            <Select options={[{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' }]} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { label: '空闲', value: 'AVAILABLE' }, { label: '出车中', value: 'ON_TRIP' },
              { label: '休息', value: 'REST' }, { label: '休假', value: 'OFF' },
            ]} />
          </Form.Item>
          <Form.Item name="hired_date" label="入职日期"><Input placeholder="2024-01-01" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
