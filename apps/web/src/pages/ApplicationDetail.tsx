import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Timeline, Tag, Button, Space, Modal, Input, Typography, Skeleton, App, Popconfirm } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { applicationApi, authApi } from '../api';
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
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();
  const { message } = App.useApp();

  useEffect(() => {
    if (id) applicationApi.detail(Number(id)).then(res => setApp(res.data.data)).finally(() => setLoading(false));
    authApi.getMe().then(res => setCurrentUser(res.data.data));
  }, [id]);

  const handleSubmit = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await applicationApi.submit(Number(id)); message.success('已提交'); fetchDetail(); }
    catch { message.error('提交失败'); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await applicationApi.cancel(Number(id), cancelReason); message.success('已取消'); setCancelModal(false); fetchDetail(); }
    catch { message.error('取消失败'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await applicationApi.remove(Number(id)); message.success('已删除'); navigate('/my-applications'); }
    catch { message.error('删除失败'); }
    finally { setActionLoading(false); }
  };

  const fetchDetail = () => {
    if (id) applicationApi.detail(Number(id)).then(res => setApp(res.data.data));
  };

  if (loading) return <Skeleton active />;
  if (!app) return <div>申请不存在</div>;

  const canSubmit = app.status === 'DRAFT';
  const isApplicant = currentUser?.id === app.applicant_id;
  const isSysAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const canCancel = isApplicant && ['DRAFT', 'PENDING_L1', 'PENDING_L2', 'PENDING_DISPATCH', 'RESERVED'].includes(app.status);
  const canDelete = isSysAdmin && ['DRAFT', 'REJECTED', 'CANCELLED', 'COMPLETED'].includes(app.status);
  const canEdit = app.status === 'DRAFT';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={4}>申请详情 - {app.application_no}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="申请编号">{app.application_no}</Descriptions.Item>
          <Descriptions.Item label="申请类型">
            <Tag color={app.application_type === 'OFFICIAL' ? 'blue' : 'green'}>
              {app.application_type === 'OFFICIAL' ? '公务用车' : '私车公用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={statusMap[app.status]?.color}>{statusMap[app.status]?.text || app.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{app.applicant_name}</Descriptions.Item>
          <Descriptions.Item label="申请部门">{app.applicant_department_name}</Descriptions.Item>
          <Descriptions.Item label="出发时间">{fmtTime(app.departure_at)}</Descriptions.Item>
          <Descriptions.Item label="返回时间">{fmtTime(app.return_at)}</Descriptions.Item>
          <Descriptions.Item label="出发地点">{app.origin}</Descriptions.Item>
          <Descriptions.Item label="目的地">{app.destination}</Descriptions.Item>
          <Descriptions.Item label="乘车人数">{app.passenger_count}</Descriptions.Item>
          <Descriptions.Item label="用车事由" span={2}>{app.reason}</Descriptions.Item>
          <Descriptions.Item label="一级审批人">{app.l1_approver_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="二级审批人">{app.l2_approver_name || '-'}</Descriptions.Item>
          {app.remark && <Descriptions.Item label="备注" span={2}>{app.remark}</Descriptions.Item>}
          {app.cancel_reason && <Descriptions.Item label="取消原因" span={2}>{app.cancel_reason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      {/* 派车记录 */}
      {app.dispatch_records?.length > 0 && (
        <Card title="派车记录" style={{ marginBottom: 16 }}>
          {app.dispatch_records.map((d: any) => (
            <Descriptions key={d.id} column={2} bordered size="small" style={{ marginBottom: 8 }}>
              <Descriptions.Item label="车牌号">{d.vehicle_plate}</Descriptions.Item>
              <Descriptions.Item label="司机">{d.driver_name}</Descriptions.Item>
              <Descriptions.Item label="派车类型">
                <Tag>{d.dispatch_type === 'ORIGINAL' ? '首次派车' : '改派'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag>{d.status}</Tag>
              </Descriptions.Item>
              {d.actual_departure_at && <Descriptions.Item label="实际出发">{fmtTime(d.actual_departure_at)}</Descriptions.Item>}
              {d.actual_return_at && <Descriptions.Item label="实际返回">{fmtTime(d.actual_return_at)}</Descriptions.Item>}
            </Descriptions>
          ))}
        </Card>
      )}

      {/* 操作日志 */}
      <Card title="操作记录" style={{ marginBottom: 16 }}>
        <Timeline
          items={(app.operation_logs || []).map((log: any) => ({
            children: (
              <div>
                <div><strong>{log.operator_name}</strong> {log.operation}</div>
                {log.detail && <div style={{ color: '#666', fontSize: 12 }}>{log.detail}</div>}
                <div style={{ color: '#999', fontSize: 12 }}>{fmtTime(log.created_at)}</div>
              </div>
            ),
          }))}
        />
      </Card>

      {/* 操作按钮 */}
      <Card>
        <Space>
          {canSubmit && <Button type="primary" loading={actionLoading} onClick={handleSubmit}>提交申请</Button>}
          {canEdit && <Button onClick={() => navigate(`/new-application?edit=${id}`)}>编辑</Button>}
          {canCancel && (
            <Button danger onClick={() => setCancelModal(true)}>取消申请</Button>
          )}
          {canDelete && (
            <Popconfirm title="确定删除此申请？" description="删除后不在列表中显示，不可恢复" onConfirm={handleDelete} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Button danger type="dashed" icon={<DeleteOutlined />} loading={actionLoading}>删除申请</Button>
            </Popconfirm>
          )}
          {app.status === 'CANCELLED' && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => navigate(`/new-application?copy_from=${id}`)}>重新发起</Button>
          )}
          {app.status === 'REJECTED' && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => navigate(`/new-application?copy_from=${id}`)}>修改后重新提交</Button>
          )}
          <Button onClick={() => navigate(-1)}>返回</Button>
        </Space>
      </Card>

      <Modal title="取消申请" open={cancelModal} onOk={handleCancel} onCancel={() => setCancelModal(false)} confirmLoading={actionLoading}>
        <Input.TextArea rows={3} placeholder="请输入取消原因" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
      </Modal>
    </div>
  );
}
