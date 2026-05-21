import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Card, Typography, App, Tree, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ImportOutlined } from '@ant-design/icons';
import { driverApi, authApi, feishuApi } from '../api';

const { Title } = Typography;

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];

export default function Drivers() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [role, setRole] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  // 导入司机
  const [importModal, setImportModal] = useState(false);
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(role);

  const fetchData = () => {
    setLoading(true);
    driverApi.list({ pageSize: 50 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

  const openImportModal = async () => {
    setImportModal(true);
    setCheckedKeys([]);
    try {
      const res = await feishuApi.orgTree();
      const tree = res.data.data?.tree || [];
      setOrgTree(tree);
      if (res.data.data?.mock) {
        message.info('飞书未配置，显示模拟数据');
      }
    } catch {
      setOrgTree([]);
      message.error('获取组织架构失败');
    }
  };

  // 递归转换组织架构为 Tree 数据（部门在前、人员在后，匹配飞书显示顺序）
  const toTreeData = (nodes: any[]): any[] => {
    return nodes.map((dept: any) => ({
      title: `${dept.name} (${(dept.users || []).length}人)`,
      key: `dept:${dept.feishu_department_id || dept.name}`,
      selectable: false,
      children: [
        ...toTreeData(dept.children || []),
        ...(dept.users || []).map((u: any) => ({
          title: `${u.name}${u.employee_no ? ` (${u.employee_no})` : ''}${u.mobile ? ` - ${u.mobile}` : ''}`,
          key: `user:${dept.feishu_department_id}:${u.open_id}`,
          isLeaf: true,
          user: u,
        })),
      ],
    }));
  };

  const treeData = useMemo(() => toTreeData(orgTree), [orgTree]);

  const handleImportDrivers = async () => {
    if (checkedKeys.length === 0) {
      message.warning('请至少选择一个用户');
      return;
    }
    // 收集选中用户（递归遍历嵌套部门树，按 open_id 去重）
    const seenOpenIds = new Set<string>();
    const selectedUsers: any[] = [];
    function collect(depts: any[]) {
      for (const dept of depts) {
        for (const u of (dept.users || [])) {
          if (checkedKeys.includes(`user:${dept.feishu_department_id}:${u.open_id}`) && !seenOpenIds.has(u.open_id)) {
            seenOpenIds.add(u.open_id);
            selectedUsers.push(u);
          }
        }
        if (dept.children) collect(dept.children);
      }
    }
    collect(orgTree);
    setImporting(true);
    try {
      const res = await feishuApi.importDrivers(selectedUsers);
      const d = res.data.data;
      message.success(res.data.message || `成功导入 ${d.created} 名司机`);
      setImportModal(false);
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.message || '导入失败');
    } finally {
      setImporting(false);
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
          {role === 'SYSTEM_ADMIN' && <Button icon={<ImportOutlined />} onClick={openImportModal}>从飞书导入司机</Button>}
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
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="从飞书导入司机"
        open={importModal}
        onOk={handleImportDrivers}
        onCancel={() => setImportModal(false)}
        confirmLoading={importing}
        width={520}
        okText={`导入选中 (${checkedKeys.length})`}
      >
        <Alert type="info" message="勾选需要导入为司机的用户，已是司机的用户会自动跳过" style={{ marginBottom: 12 }} />
        {treeData.length > 0 ? (
          <Tree
            checkable
            selectable={false}
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={(keys) => setCheckedKeys(keys as string[])}
            defaultExpandAll={false}
            defaultExpandedKeys={orgTree.map((d: any) => `dept:${d.feishu_department_id || d.name}`)}
            style={{ maxHeight: 400, overflow: 'auto' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>加载中...</div>
        )}
      </Modal>
    </div>
  );
}
