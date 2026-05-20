import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Tag, Button, Typography, Skeleton } from 'antd';
import { FileTextOutlined, CarOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { userApi, applicationApi } from '../api';
import { fmtTime } from '../utils/format';

const { Title } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  DRAFT: { color: 'default', text: '草稿' },
  PENDING_L1: { color: 'processing', text: '一级审批中' },
  PENDING_L2: { color: 'processing', text: '二级审批中' },
  REJECTED: { color: 'error', text: '已驳回' },
  PENDING_DISPATCH: { color: 'warning', text: '待派车' },
  RESERVED: { color: 'warning', text: '已预占' },
  IN_PROGRESS: { color: 'processing', text: '执行中' },
  PENDING_CONFIRM: { color: 'warning', text: '待确认' },
  COMPLETED: { color: 'success', text: '已完成' },
  CANCELLED: { color: 'default', text: '已取消' },
  APPROVAL_EXCEPTION: { color: 'error', text: '审批异常' },
};

export default function Workbench() {
  const [todo, setTodo] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      userApi.todoSummary(),
      applicationApi.list({ page: 1, pageSize: 5 }),
    ]).then(([todoRes, appRes]) => {
      setTodo(todoRes.data.data);
      setRecent(appRes.data.data.list);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton active />;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>工作台</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {todo?.pendingApproval > 0 && (
          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/approvals')}>
              <Statistic title="待审批" value={todo.pendingApproval} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
        )}
        {todo?.pendingDispatch > 0 && (
          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/dispatch')}>
              <Statistic title="待派车" value={todo.pendingDispatch} prefix={<CarOutlined />} valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
        )}
        {todo?.pendingConfirm > 0 && (
          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/consumption')}>
              <Statistic title="待确认消耗" value={todo.pendingConfirm} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        )}
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/my-applications')}>
            <Statistic title="我的申请" value={todo?.myApplications || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card
            title="最近申请"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/new-application')}>发起申请</Button>}
          >
            <List
              dataSource={recent}
              renderItem={(item: any) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/applications/${item.id}`)}
                  extra={item.application_type === 'OFFICIAL' ? <Tag color="blue">公务用车</Tag> : <Tag color="green">私车公用</Tag>}
                >
                  <List.Item.Meta
                    title={`${item.application_no} - ${item.applicant_name}`}
                    description={`${item.destination} · ${fmtTime(item.departure_at)}`}
                  />
                  <Tag color={statusMap[item.status]?.color}>{statusMap[item.status]?.text || item.status}</Tag>
                </List.Item>
              )}
              locale={{ emptyText: '暂无申请记录' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="快捷操作">
            <Button type="primary" block style={{ marginBottom: 12 }} icon={<PlusOutlined />} onClick={() => navigate('/new-application')}>
              发起用车申请
            </Button>
            <Button block style={{ marginBottom: 12 }} onClick={() => navigate('/my-applications')}>
              查看我的申请
            </Button>
            {todo?.pendingApproval > 0 && (
              <Button block style={{ marginBottom: 12 }} onClick={() => navigate('/approvals')}>
                审批待办 ({todo.pendingApproval})
              </Button>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
