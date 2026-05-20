import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, InputNumber, Space, Card, Typography, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { vehicleApi, authApi } from '../api';

const { Title } = Typography;

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];

export default function Vehicles() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [role, setRole] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const isAdmin = ADMIN_ROLES.includes(role);

  const fetchData = () => {
    setLoading(true);
    vehicleApi.list({ pageSize: 50 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    setActionLoading(true);
    try {
      if (editing) {
        await vehicleApi.update(editing.id, values);
        message.success('更新成功');
      } else {
        await vehicleApi.create(values);
        message.success('添加成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch { /* validation error */ }
    finally { setActionLoading(false); }
  };

  const columns: ColumnsType<any> = [
    { title: '车牌号', dataIndex: 'plate_number', width: 120 },
    { title: '品牌', dataIndex: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', width: 120 },
    { title: '类型', dataIndex: 'vehicle_type', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '座位数', dataIndex: 'seats', width: 80 },
    { title: '燃油类型', dataIndex: 'fuel_type', width: 100 },
    { title: '年审日期', dataIndex: 'inspection_date', width: 110 },
    { title: '保险到期', dataIndex: 'insurance_expiry_date', width: 110 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          AVAILABLE: { color: 'success', text: '可用' },
          IN_USE: { color: 'processing', text: '使用中' },
          MAINTENANCE: { color: 'warning', text: '维护中' },
          SCRAPPED: { color: 'default', text: '已报废' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.text || v}</Tag>;
      }},
    ...(isAdmin ? [{ title: '操作', width: 160, render: (_: any, r: any) => (
      <Space>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
        <Button size="small" danger onClick={async () => { await vehicleApi.remove(r.id); fetchData(); }}>删除</Button>
      </Space>
    )}] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>车辆管理</Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>添加车辆</Button>}
      </div>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal title={editing ? '编辑车辆' : '添加车辆'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} confirmLoading={actionLoading} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="plate_number" label="车牌号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="brand" label="品牌"><Input /></Form.Item>
          <Form.Item name="model" label="型号"><Input /></Form.Item>
          <Form.Item name="color" label="颜色"><Input /></Form.Item>
          <Form.Item name="seats" label="座位数"><InputNumber min={2} max={60} /></Form.Item>
          <Form.Item name="vehicle_type" label="车辆类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '轿车', value: 'SEDAN' }, { label: 'SUV', value: 'SUV' },
              { label: 'MPV', value: 'MPV' }, { label: '巴士', value: 'BUS' },
            ]} />
          </Form.Item>
          <Form.Item name="fuel_type" label="燃油类型">
            <Select options={[
              { label: '汽油', value: 'GASOLINE' }, { label: '柴油', value: 'DIESEL' },
              { label: '电动', value: 'ELECTRIC' }, { label: '混动', value: 'HYBRID' },
            ]} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { label: '可用', value: 'AVAILABLE' }, { label: '使用中', value: 'IN_USE' },
              { label: '维护中', value: 'MAINTENANCE' }, { label: '已报废', value: 'SCRAPPED' },
            ]} />
          </Form.Item>
          <Form.Item name="inspection_date" label="年审日期"><Input placeholder="2026-06-15" /></Form.Item>
          <Form.Item name="insurance_expiry_date" label="保险到期"><Input placeholder="2026-07-20" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
