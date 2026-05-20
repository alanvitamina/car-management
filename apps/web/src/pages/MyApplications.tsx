import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Select, Space, Card, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { applicationApi } from '../api';
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

export default function MyApplications() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const fetchData = () => {
    setLoading(true);
    applicationApi.list({ page, pageSize: 15, status, keyword: keyword || undefined })
      .then(res => { setData(res.data.data.list); setTotal(res.data.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, status]);

  const columns: ColumnsType<any> = [
    { title: '申请编号', dataIndex: 'application_no', width: 180,
      render: (v: string, r: any) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a> },
    { title: '类型', dataIndex: 'application_type', width: 100,
      render: (v: string) => v === 'OFFICIAL' ? <Tag color="blue">公务用车</Tag> : <Tag color="green">私车公用</Tag> },
    { title: '目的地', dataIndex: 'destination', ellipsis: true },
    { title: '出发时间', dataIndex: 'departure_at', width: 160, render: (v: string) => fmtTime(v) },
    { title: '返回时间', dataIndex: 'return_at', width: 160, render: (v: string) => fmtTime(v) },
    { title: '状态', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text || v}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v: string) => fmtTime(v) },
  ];

  return (
    <div>
      <Title level={4}>我的申请</Title>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索编号/目的地/事由"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 160 }}
            value={status}
            onChange={v => { setStatus(v); setPage(1); }}
            options={Object.entries(statusMap).map(([k, v]) => ({ label: v.text, value: k }))}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: 15, onChange: setPage, showTotal: t => `共 ${t} 条` }}
          onRow={record => ({ onClick: () => navigate(`/applications/${record.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </div>
  );
}
