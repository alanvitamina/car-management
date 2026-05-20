import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Select, Card, Typography, App, Descriptions, Tabs, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CaretRightOutlined } from '@ant-design/icons';
import { subsidyApi, applicationApi } from '../api';
import { fmtTime } from '../utils/format';

const { Title, Text, Paragraph } = Typography;

export default function SubsidyPage() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [calcModal, setCalcModal] = useState<'private' | 'driver' | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const { message } = App.useApp();

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      subsidyApi.settlements({ pageSize: 50 }),
      subsidyApi.rules(),
    ]).then(([sRes, rRes]) => {
      setSettlements(sRes.data.data.list || []);
      setRules(rRes.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const openCalcModal = async (type: 'private' | 'driver') => {
    try {
      const res = await applicationApi.list({ status: 'COMPLETED', pageSize: 50 });
      setApplications(res.data.data.list || []);
    } catch { setApplications([]); }
    setFormData({});
    setSelectedApp(null);
    setCalcResult(null);
    setCalcModal(type);
  };

  const handleAppSelect = (appId: number) => {
    const app = applications.find(a => a.id === appId);
    setSelectedApp(app || null);
    setFormData({ ...formData, application_id: appId });
  };

  const handleCalculate = async () => {
    if (!formData.application_id) { message.warning('请选择申请单'); return; }
    setActionLoading(true);
    try {
      let res;
      if (calcModal === 'private') {
        res = await subsidyApi.calculatePrivateCar({ application_id: formData.application_id });
      } else {
        res = await subsidyApi.calculateDriver({ application_id: formData.application_id });
      }
      setCalcResult(res.data.data);
      message.success('核算完成');
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.message || '核算失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnsType<any> = [
    { title: '申请编号', dataIndex: 'application_no', width: 180 },
    { title: '申请人', dataIndex: 'applicant_name', width: 90 },
    { title: '类型', dataIndex: 'settlement_type', width: 90,
      render: (v: string) => <Tag color={v === 'PRIVATE_CAR' ? 'green' : 'orange'}>{v === 'PRIVATE_CAR' ? '私车补助' : '司机加班'}</Tag> },
    { title: '核算里程', dataIndex: 'approved_mileage', width: 90, render: (v: number) => v ? `${v}km` : '-' },
    { title: '里程补助', dataIndex: 'mileage_subsidy', width: 90, render: (v: number) => v ? `¥${v}` : '-' },
    { title: '加班(h)', dataIndex: 'overtime_hours', width: 80, render: (v: number) => v ?? '-' },
    { title: '出车次数', dataIndex: 'driver_trip_count', width: 80 },
    { title: '合计', dataIndex: 'total_subsidy', width: 100, render: (v: number) => <strong>{v != null ? `¥${v}` : '-'}</strong> },
    { title: '核算人', dataIndex: 'calculated_by_name', width: 90 },
    { title: '时间', dataIndex: 'calculated_at', width: 155, render: (v: string) => fmtTime(v) },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
  ];

  const privateCarRules = rules.filter(r => r.rule_type === 'PRIVATE_CAR_MILEAGE').sort((a, b) => (a.min_value || 0) - (b.min_value || 0));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>补助核算</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => openCalcModal('private')}>私车里程核算</Button>
          <Button onClick={() => openCalcModal('driver')}>司机加班核算</Button>
        </div>
      </div>

      {/* 补助规则详细说明 */}
      <Card title="补助计算规则" style={{ marginBottom: 16 }}>
        <Collapse
          bordered={false}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
          items={[
            {
              key: 'private',
              label: <Text strong>私车公用里程补助规则（分档计价）</Text>,
              children: (
                <div>
                  <Paragraph>
                    私车公用补助按<Text strong>行政经理确认后的核算里程</Text>计算，过路过桥费、停车费据实报销，不单独核算油耗和车耗补贴。
                  </Paragraph>
                  <Table
                    dataSource={privateCarRules}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '档位', dataIndex: 'rule_name', width: 200 },
                      { title: '里程区间', width: 200, render: (_: any, r: any) => {
                        if (r.max_value == null) return `> ${r.min_value} 公里`;
                        return `${r.min_value} ~ ${r.max_value} 公里`;
                      }},
                      { title: '单价', dataIndex: 'unit_price', width: 120, render: (v: number) => `${v} 元/公里` },
                      { title: '说明', dataIndex: 'description' },
                    ]}
                    style={{ marginBottom: 12 }}
                  />
                  <Paragraph type="secondary">
                    核算公式：补助金额 = 核算里程 × 档位单价。例如：核算里程 80km → 80 × 0.8 = ¥64；核算里程 150km → 150 × 1.0 = ¥150。
                  </Paragraph>
                  <Paragraph type="secondary">
                    过路过桥费、停车费已据实报销，不在补助中重复计算。
                  </Paragraph>
                </div>
              ),
            },
            {
              key: 'driver',
              label: <Text strong>司机加班核算规则（季节×日期类型×时段窗口×倍数）</Text>,
              children: (
                <div>
                  <Title level={5}>1. 季节划分</Title>
                  <Table
                    dataSource={[
                      { season: '冬季', period: '每年10月1日 ~ 次年4月30日', morning: '< 08:30', noon: '12:00 ~ 13:00', evening: '> 17:30' },
                      { season: '夏季', period: '每年5月1日 ~ 9月30日', morning: '< 08:30', noon: '12:00 ~ 13:30', evening: '> 18:00' },
                    ]}
                    rowKey="season"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '季节', dataIndex: 'season', width: 60 },
                      { title: '时间范围', dataIndex: 'period', width: 200 },
                      { title: '早间加班', dataIndex: 'morning', width: 100 },
                      { title: '午间加班', dataIndex: 'noon', width: 120 },
                      { title: '晚间加班', dataIndex: 'evening', width: 100 },
                    ]}
                    style={{ marginBottom: 12 }}
                  />

                  <Title level={5}>2. 日期类型与倍数</Title>
                  <Table
                    dataSource={[
                      { type: '工作日', rule: '只计算加班时段窗口内的时长，出车前另加1小时、收车后另加1小时', multiplier: '×1' },
                      { type: '周末（周六/周日）', rule: '全部用车时长计入加班，出车前另加1小时、收车后另加1小时', multiplier: '×2' },
                      { type: '法定节假日', rule: '全部用车时长计入加班，出车前另加1小时、收车后另加1小时', multiplier: '×3' },
                    ]}
                    rowKey="type"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '日期类型', dataIndex: 'type', width: 140 },
                      { title: '加班计算规则', dataIndex: 'rule' },
                      { title: '倍数', dataIndex: 'multiplier', width: 60 },
                    ]}
                    style={{ marginBottom: 12 }}
                  />

                  <Paragraph type="secondary" style={{ marginTop: 12 }}>
                    法定节假日通过联网 API 自动识别（含国务院调休安排），无需手动维护。核算公式：加班总时长 = 工作日加班时数 × 1 + 周末加班时数 × 2 + 节假日加班时数 × 3。
                    核算结果推送人资部门统一处理加班费用，系统中不直接计算金额。
                  </Paragraph>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card title="核算记录">
        <Table columns={columns} dataSource={settlements} rowKey="id" loading={loading} pagination={false} scroll={{ x: 1300 }} />
      </Card>

      <Modal
        title={calcModal === 'private' ? '私车公用里程补助核算' : '公务用车司机加班核算'}
        open={calcModal !== null}
        onOk={handleCalculate}
        onCancel={() => setCalcModal(null)}
        confirmLoading={actionLoading}
        width={700}
      >
        {calcModal === 'private' && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="补助规则">
                {privateCarRules.length > 0
                  ? privateCarRules.map(r => `${r.rule_name}: ${r.unit_price}元/公里`).join(' | ')
                  : '未配置'}
              </Descriptions.Item>
              <Descriptions.Item label="核算说明">
                系统根据确认后的核算里程自动匹配档位单价。过路过桥费、停车费据实报销，不在补助中重复计算。
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>选择已完成的私车公用申请</div>
              <Select
                style={{ width: '100%' }}
                placeholder="选择申请单"
                value={formData.application_id}
                onChange={handleAppSelect}
                options={applications
                  .filter(a => a.application_type === 'PRIVATE')
                  .map(a => ({ label: `${a.application_no} — ${a.applicant_name} (${a.destination})`, value: a.id }))}
              />
            </div>
          </>
        )}

        {calcModal === 'driver' && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="核算说明">
                系统根据派车记录的实际出发/返回时间，按季节、日期类型（工作日/周末/节假日）、加班时段窗口自动计算加班时数并应用倍数。核算结果推送人资统一处理。
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>选择已完成的公务用车申请</div>
              <Select
                style={{ width: '100%' }}
                placeholder="选择申请单"
                value={formData.application_id}
                onChange={handleAppSelect}
                options={applications
                  .filter(a => a.application_type === 'OFFICIAL')
                  .map(a => ({ label: `${a.application_no} — ${a.applicant_name} (${a.destination})`, value: a.id }))}
              />
            </div>
          </>
        )}

        {calcResult && calcModal === 'private' && (
          <Card size="small" style={{ marginTop: 12, backgroundColor: '#f6ffed' }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="核算里程">{calcResult.total_mileage} km</Descriptions.Item>
              <Descriptions.Item label="单程>100km">
                <Tag color={calcResult.is_long_distance ? 'orange' : 'green'}>{calcResult.is_long_distance ? '是 (>100km)' : '否 (≤100km)'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="适用档位">{calcResult.applied_rule}</Descriptions.Item>
              <Descriptions.Item label="档位单价">¥{calcResult.unit_price}/km</Descriptions.Item>
              <Descriptions.Item label="里程补助"><Text strong>¥{calcResult.mileage_subsidy}</Text></Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {calcResult && calcModal === 'driver' && (
          <Card size="small" style={{ marginTop: 12, backgroundColor: '#fff7e6' }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="出车次数">{calcResult.driver_trip_count}次</Descriptions.Item>
              <Descriptions.Item label="工作日加班">{calcResult.workday_hours}h ×1</Descriptions.Item>
              <Descriptions.Item label="周末加班">{calcResult.weekend_hours}h ×2</Descriptions.Item>
              <Descriptions.Item label="节假日加班">{calcResult.holiday_hours}h ×3</Descriptions.Item>
              <Descriptions.Item label="核算加班总时长" span={2}><Text strong>{calcResult.overtime_hours}h</Text></Descriptions.Item>
            </Descriptions>
            {calcResult.trips?.map((trip: any, i: number) => (
              <Card key={i} size="small" style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>出车 {i + 1}: {trip.driver_name} / {trip.vehicle_plate}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {fmtTime(trip.departure_at)} → {fmtTime(trip.return_at)}
                </div>
                {trip.details?.map((d: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: '#999' }}>{d}</div>
                ))}
              </Card>
            ))}
          </Card>
        )}
      </Modal>
    </div>
  );
}
