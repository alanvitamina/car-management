import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Modal, Select, Space, Card, Typography, App, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { dispatchApi, vehicleApi, driverApi } from '../api';

const { Title } = Typography;

export default function DispatchPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dispatchModal, setDispatchModal] = useState<{ open: boolean; app: any }>({ open: false, app: null });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<number>();
  const [selectedDriver, setSelectedDriver] = useState<number>();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const fetchPending = () => {
    setLoading(true);
    dispatchApi.pending().then(res => setPending(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPending(); }, []);

  const openDispatchModal = async (app: any) => {
    setDispatchModal({ open: true, app });
    const [vRes, dRes] = await Promise.all([
      vehicleApi.available({ departure_at: app.departure_at, return_at: app.return_at }),
      driverApi.available({ departure_at: app.departure_at, return_at: app.return_at }),
    ]);
    setVehicles(vRes.data.data || []);
    setDrivers(dRes.data.data || []);
  };

  const handleDispatch = async () => {
    if (!selectedVehicle || !selectedDriver || !dispatchModal.app) return;
    setActionLoading(true);
    try {
      await dispatchApi.create({ application_id: dispatchModal.app.id, vehicle_id: selectedVehicle, driver_id: selectedDriver });
      message.success('派车成功');
      setDispatchModal({ open: false, app: null });
      setSelectedVehicle(undefined);
      setSelectedDriver(undefined);
      fetchPending();
    } catch { message.error('派车失败'); }
    finally { setActionLoading(false); }
  };

  const columns: ColumnsType<any> = [
    { title: '申请编号', dataIndex: 'application_no', width: 180,
      render: (v: string, r: any) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a> },
    { title: '类型', dataIndex: 'application_type', width: 100,
      render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
    { title: '申请人', dataIndex: 'applicant_name', width: 100 },
    { title: '目的地', dataIndex: 'destination' },
    { title: '出发', dataIndex: 'departure_at', width: 170 },
    { title: '返回', dataIndex: 'return_at', width: 170 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={v === 'PENDING_DISPATCH' ? 'warning' : 'processing'}>{v === 'PENDING_DISPATCH' ? '待派车' : '已预占'}</Tag> },
    { title: '操作', width: 120, render: (_: any, r: any) => (
      r.status === 'PENDING_DISPATCH'
        ? <Button type="primary" size="small" onClick={() => openDispatchModal(r)}>派车</Button>
        : <Button size="small" onClick={() => navigate(`/applications/${r.id}`)}>查看</Button>
    )},
  ];

  return (
    <div>
      <Title level={4}>派车管理</Title>
      <Card>
        <Table columns={columns} dataSource={pending} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal title="派车" open={dispatchModal.open} onOk={handleDispatch} onCancel={() => setDispatchModal({ open: false, app: null })} confirmLoading={actionLoading} width={600}>
        {dispatchModal.app && (
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="申请编号">{dispatchModal.app.application_no}</Descriptions.Item>
            <Descriptions.Item label="申请人">{dispatchModal.app.applicant_name}</Descriptions.Item>
            <Descriptions.Item label="出发">{dispatchModal.app.departure_at}</Descriptions.Item>
            <Descriptions.Item label="返回">{dispatchModal.app.return_at}</Descriptions.Item>
            <Descriptions.Item label="目的地" span={2}>{dispatchModal.app.destination}</Descriptions.Item>
          </Descriptions>
        )}
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8 }}>选择车辆</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择可用车辆"
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              options={vehicles.map(v => ({ label: `${v.plate_number} ${v.brand} ${v.model} (${v.seats}座)`, value: v.id }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>选择司机</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择可用司机"
              value={selectedDriver}
              onChange={setSelectedDriver}
              options={drivers.map(d => ({ label: `${d.name} (${d.mobile})`, value: d.id }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
