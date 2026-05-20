import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Modal, Input, Card, Typography, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { approvalApi } from '../api';
import { fmtTime } from '../utils/format';

const { Title } = Typography;

export default function Approvals() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const [rejectComment, setRejectComment] = useState('');
  const navigate = useNavigate();
  const { message } = App.useApp();

  const fetchData = () => {
    setLoading(true);
    approvalApi.pending().then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try { await approvalApi.approve(id); message.success('已审批通过'); fetchData(); }
    catch { message.error('操作失败'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try { await approvalApi.reject(rejectModal.id, rejectComment); message.success('已驳回'); setRejectModal({ open: false, id: 0 }); fetchData(); }
    catch { message.error('操作失败'); }
    finally { setActionLoading(false); }
  };

  const columns: ColumnsType<any> = [
    { title: '申请编号', dataIndex: 'application_no', width: 180,
      render: (v: string, r: any) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a> },
    { title: '类型', dataIndex: 'application_type', width: 100,
      render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
    { title: '申请人', dataIndex: 'applicant_name', width: 120 },
    { title: '部门', dataIndex: 'applicant_department_name', width: 120 },
    { title: '目的地', dataIndex: 'destination', ellipsis: true },
    { title: '出发时间', dataIndex: 'departure_at', width: 160, render: (v: string) => fmtTime(v) },
    { title: '事由', dataIndex: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color="processing">{v === 'PENDING_L1' ? '一级待审' : '二级待审'}</Tag> },
    { title: '操作', width: 200, render: (_: any, r: any) => (
      <Space>
        <Button type="primary" size="small" loading={actionLoading} onClick={() => handleApprove(r.id)}>通过</Button>
        <Button danger size="small" onClick={() => setRejectModal({ open: true, id: r.id })}>驳回</Button>
        <a onClick={() => navigate(`/applications/${r.id}`)}>详情</a>
      </Space>
    )},
  ];

  return (
    <div>
      <Title level={4}>待审批</Title>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      </Card>
      <Modal title="驳回申请" open={rejectModal.open} onOk={handleReject} onCancel={() => setRejectModal({ open: false, id: 0 })} confirmLoading={actionLoading}>
        <Input.TextArea rows={3} placeholder="请输入驳回原因" value={rejectComment} onChange={e => setRejectComment(e.target.value)} />
      </Modal>
    </div>
  );
}
