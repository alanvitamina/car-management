import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Skeleton, Drawer, Empty } from 'antd';
import { CarOutlined, FileTextOutlined, DollarOutlined, TeamOutlined } from '@ant-design/icons';
import { dashboardApi, applicationApi, vehicleApi, driverApi, consumptionApi, subsidyApi, dispatchApi } from '../api';
import { fmtTime } from '../utils/format';

const { Title } = Typography;

type DrawerType = 'monthly' | 'official' | 'private' | 'completed' | 'vehicles' | 'drivers' | 'costs' | 'subsidies' | 'pendingApproval' | 'pendingDispatch' | 'pendingConfirm';

const drawerConfig: Record<DrawerType, { title: string; fetcher: (api: any) => Promise<any>; columns: any[] }> = {
  monthly: {
    title: '本月申请',
    fetcher: () => applicationApi.list({ pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '类型', dataIndex: 'application_type', width: 80, render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag>{v}</Tag> },
      { title: '创建时间', dataIndex: 'created_at', width: 155, render: (v: string) => fmtTime(v) },
    ],
  },
  official: {
    title: '公务用车申请',
    fetcher: () => applicationApi.list({ application_type: 'OFFICIAL', pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '出发', dataIndex: 'departure_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '返回', dataIndex: 'return_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    ],
  },
  private: {
    title: '私车公用申请',
    fetcher: () => applicationApi.list({ application_type: 'PRIVATE', pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '出发', dataIndex: 'departure_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '返回', dataIndex: 'return_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    ],
  },
  completed: {
    title: '已完成申请',
    fetcher: () => applicationApi.list({ status: 'COMPLETED', pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '类型', dataIndex: 'application_type', width: 80, render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '完成时间', dataIndex: 'updated_at', width: 155, render: (v: string) => fmtTime(v) },
    ],
  },
  vehicles: {
    title: '车辆台账',
    fetcher: () => vehicleApi.list({ pageSize: 100 }),
    columns: [
      { title: '车牌', dataIndex: 'plate_number', width: 100 },
      { title: '品牌', dataIndex: 'brand', width: 80 },
      { title: '型号', dataIndex: 'model', width: 100 },
      { title: '座位数', dataIndex: 'seats', width: 60 },
      { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'AVAILABLE' ? 'green' : v === 'IN_USE' ? 'blue' : 'orange'}>{v === 'AVAILABLE' ? '空闲' : v === 'IN_USE' ? '使用中' : '维修'}</Tag> },
      { title: '年审日期', dataIndex: 'inspection_date', width: 100 },
      { title: '保险到期', dataIndex: 'insurance_expiry_date', width: 100 },
    ],
  },
  drivers: {
    title: '司机列表',
    fetcher: () => driverApi.list({ pageSize: 100 }),
    columns: [
      { title: '姓名', dataIndex: 'name', width: 80 },
      { title: '手机', dataIndex: 'mobile', width: 110 },
      { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'AVAILABLE' ? 'green' : 'blue'}>{v === 'AVAILABLE' ? '空闲' : '出车中'}</Tag> },
      { title: '驾驶证', dataIndex: 'license_type', width: 80 },
    ],
  },
  costs: {
    title: '本月费用明细',
    fetcher: () => consumptionApi.list({ pageSize: 100 }),
    columns: [
      { title: '申请编号', dataIndex: 'application_no', width: 170 },
      { title: '类型', dataIndex: 'application_type', width: 70, render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
      { title: '用车时长(时)', dataIndex: 'duration_minutes', width: 100, render: (v: number) => v ? (v / 60).toFixed(1) : '-' },
      { title: '里程(km)', dataIndex: 'total_mileage', width: 80 },
      { title: '路桥费', dataIndex: 'toll_amount', width: 80 },
      { title: '停车费', dataIndex: 'parking_amount', width: 80 },
      { title: '车杂费', dataIndex: 'other_amount', width: 80 },
      { title: '合计', dataIndex: 'total_amount', width: 80, render: (v: number) => <strong>¥{v?.toFixed(2)}</strong> },
    ],
  },
  subsidies: {
    title: '本月补助明细',
    fetcher: () => subsidyApi.settlements({ pageSize: 100 }),
    columns: [
      { title: '申请编号', dataIndex: 'application_no', width: 170 },
      { title: '类型', dataIndex: 'settlement_type', width: 80, render: (v: string) => <Tag color={v === 'PRIVATE_CAR' ? 'green' : 'blue'}>{v === 'PRIVATE_CAR' ? '私车公出' : '司机加班'}</Tag> },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '里程补助', dataIndex: 'mileage_subsidy', width: 90, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
      { title: '加班时数(时)', dataIndex: 'overtime_hours', width: 100, render: (v: number) => v ?? '-' },
      { title: '合计(元)', dataIndex: 'total_subsidy', width: 100, render: (v: number) => <strong>¥{v?.toFixed(2)}</strong> },
      { title: '核算人', dataIndex: 'calculated_by_name', width: 80 },
      { title: '核算时间', dataIndex: 'calculated_at', width: 155, render: (v: string) => fmtTime(v) },
    ],
  },
  pendingApproval: {
    title: '待审批申请',
    fetcher: () => applicationApi.list({ status: 'PENDING_APPROVAL', pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '类型', dataIndex: 'application_type', width: 80, render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color="gold">{v}</Tag> },
      { title: '提交时间', dataIndex: 'created_at', width: 155, render: (v: string) => fmtTime(v) },
    ],
  },
  pendingDispatch: {
    title: '待派车申请',
    fetcher: () => applicationApi.list({ status: 'PENDING_DISPATCH', pageSize: 100 }),
    columns: [
      { title: '编号', dataIndex: 'application_no', width: 180 },
      { title: '申请人', dataIndex: 'applicant_name', width: 80 },
      { title: '目的地', dataIndex: 'destination' },
      { title: '出发', dataIndex: 'departure_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '返回', dataIndex: 'return_at', width: 155, render: (v: string) => fmtTime(v) },
      { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color="orange">{v}</Tag> },
    ],
  },
  pendingConfirm: {
    title: '待确认消耗',
    fetcher: () => consumptionApi.list({ status: 'PENDING_CONFIRM', pageSize: 100 }),
    columns: [
      { title: '申请编号', dataIndex: 'application_no', width: 170 },
      { title: '类型', dataIndex: 'application_type', width: 70, render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
      { title: '录入人', dataIndex: 'recorded_by_name', width: 80 },
      { title: '里程(km)', dataIndex: 'total_mileage', width: 80 },
      { title: '费用(元)', dataIndex: 'total_amount', width: 80, render: (v: number) => `¥${v?.toFixed(2)}` },
      { title: '录入时间', dataIndex: 'created_at', width: 155, render: (v: string) => fmtTime(v) },
    ],
  },
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<{ open: boolean; type: DrawerType | null; title: string }>({ open: false, type: null, title: '' });
  const [drillData, setDrillData] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    dashboardApi.summary().then(res => setData(res.data.data)).finally(() => setLoading(false));
  }, []);

  const openDrawer = async (type: DrawerType) => {
    const cfg = drawerConfig[type];
    setDrawer({ open: true, type, title: cfg.title });
    setDrillLoading(true);
    try {
      const res = await cfg.fetcher({});
      const list = res.data.data?.list || res.data.data || [];
      setDrillData(Array.isArray(list) ? list : []);
    } catch { setDrillData([]); }
    finally { setDrillLoading(false); }
  };

  const closeDrawer = () => setDrawer({ open: false, type: null, title: '' });

  if (loading) return <Skeleton active />;

  const { monthly, vehicles, drivers, pending, costs, subsidies, expiring, recent_applications } = data || {};

  return (
    <div>
      <Title level={4}>数据看板</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #1677ff', backgroundColor: '#f0f5ff' }} onClick={() => openDrawer('monthly')}><Statistic title="本月申请" value={monthly?.total || 0} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #1677ff', backgroundColor: '#f0f5ff' }} onClick={() => openDrawer('official')}><Statistic title="公务用车" value={monthly?.official_count || 0} suffix={`/ ${monthly?.total || 0}`} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #52c41a', backgroundColor: '#f6ffed' }} onClick={() => openDrawer('private')}><Statistic title="私车公用" value={monthly?.private_count || 0} suffix={`/ ${monthly?.total || 0}`} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #52c41a', backgroundColor: '#f6ffed' }} onClick={() => openDrawer('completed')}><Statistic title="已完成" value={monthly?.completed_count || 0} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #722ed1', backgroundColor: '#f9f0ff' }} onClick={() => openDrawer('vehicles')}><Statistic title="车辆总数" value={vehicles?.total_vehicles || 0} prefix={<CarOutlined />} suffix={`可用 ${vehicles?.available_vehicles || 0}`} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #722ed1', backgroundColor: '#f9f0ff' }} onClick={() => openDrawer('drivers')}><Statistic title="司机总数" value={drivers?.total_drivers || 0} prefix={<TeamOutlined />} suffix={`空闲 ${drivers?.available_drivers || 0}`} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #fa8c16', backgroundColor: '#fff7e6' }} onClick={() => openDrawer('costs')}><Statistic title="本月费用(元)" value={costs?.total_cost || 0} prefix={<DollarOutlined />} precision={2} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ borderLeft: '3px solid #fa8c16', backgroundColor: '#fff7e6' }} onClick={() => openDrawer('subsidies')}><Statistic title="本月补助(元)" value={subsidies?.total_subsidy || 0} prefix={<DollarOutlined />} precision={2} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="待处理" style={{ borderLeft: '3px solid #faad14' }}>
            <Row gutter={16}>
              <Col span={8} style={{ cursor: 'pointer' }} onClick={() => openDrawer('pendingApproval')}><Statistic title="待审批" value={pending?.pending_approval || 0} valueStyle={{ color: pending?.pending_approval > 0 ? '#faad14' : undefined }} /></Col>
              <Col span={8} style={{ cursor: 'pointer' }} onClick={() => openDrawer('pendingDispatch')}><Statistic title="待派车" value={pending?.pending_dispatch || 0} valueStyle={{ color: pending?.pending_dispatch > 0 ? '#1677ff' : undefined }} /></Col>
              <Col span={8} style={{ cursor: 'pointer' }} onClick={() => openDrawer('pendingConfirm')}><Statistic title="待确认" value={pending?.pending_confirm || 0} valueStyle={{ color: pending?.pending_confirm > 0 ? '#52c41a' : undefined }} /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="费用明细" style={{ borderLeft: '3px solid #eb2f96' }}>
            <Row gutter={16}>
              <Col span={8}><Statistic title="路桥费" value={costs?.total_toll || 0} precision={2} /></Col>
              <Col span={8}><Statistic title="停车费" value={costs?.total_parking || 0} precision={2} /></Col>
              <Col span={8}><Statistic title="车杂费" value={costs?.total_other || 0} precision={2} /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {(expiring?.inspection?.length > 0 || expiring?.insurance?.length > 0) && (
        <Card title="即将到期提醒" style={{ marginTop: 16, borderLeft: '3px solid #ff4d4f' }}>
          {expiring.inspection?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Tag color="red">年审即将到期</Tag>
              {expiring.inspection.map((v: any) => (
                <span key={v.id} style={{ marginRight: 16 }}>🚗 {v.plate_number} ({v.inspection_date})</span>
              ))}
            </div>
          )}
          {expiring.insurance?.length > 0 && (
            <div>
              <Tag color="orange">保险即将到期</Tag>
              {expiring.insurance.map((v: any) => (
                <span key={v.id} style={{ marginRight: 16 }}>🚗 {v.plate_number} ({v.insurance_expiry_date})</span>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="最近申请" style={{ marginTop: 16 }}>
        <Table
          dataSource={recent_applications || []}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '编号', dataIndex: 'application_no', width: 180 },
            { title: '类型', dataIndex: 'application_type', width: 90,
              render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
            { title: '申请人', dataIndex: 'applicant_name', width: 100 },
            { title: '目的地', dataIndex: 'destination' },
            { title: '状态', dataIndex: 'status', width: 100,
              render: (v: string) => <Tag>{v}</Tag> },
            { title: '时间', dataIndex: 'created_at', width: 155, render: (v: string) => fmtTime(v) },
          ]}
        />
      </Card>

      <Drawer
        title={drawer.title}
        open={drawer.open}
        onClose={closeDrawer}
        width={800}
      >
        {drillData.length === 0 && !drillLoading ? (
          <Empty description="暂无数据" />
        ) : (
          <Table
            dataSource={drillData}
            rowKey="id"
            loading={drillLoading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="small"
            columns={drawer.type ? drawerConfig[drawer.type].columns : []}
          />
        )}
      </Drawer>
    </div>
  );
}
