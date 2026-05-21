import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Button, Card, Typography, Space, App, Modal, Select, Form, Tree, Alert, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SyncOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { userApi, authApi, feishuApi } from '../api';

const { Title } = Typography;

const roleMap: Record<string, { color: string; text: string }> = {
  SYSTEM_ADMIN: { color: 'red', text: '系统管理员' },
  ADMIN_MANAGER: { color: 'orange', text: '行政经理' },
  L1_APPROVER: { color: 'blue', text: '一级审批人' },
  L2_APPROVER: { color: 'blue', text: '二级审批人' },
  DRIVER: { color: 'green', text: '司机' },
  EMPLOYEE: { color: 'default', text: '普通员工' },
};

export default function Users() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [role, setRole] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm] = Form.useForm();
  const { message } = App.useApp();

  // 同步范围选择
  const [syncModal, setSyncModal] = useState(false);
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [syncCheckedKeys, setSyncCheckedKeys] = useState<string[]>([]);

  const isAdmin = role === 'SYSTEM_ADMIN';

  const fetchData = () => {
    setLoading(true);
    userApi.list({ pageSize: 100 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await userApi.remove(id);
      message.success('已删除');
      fetchData();
    } catch { message.error('删除失败'); }
  };

  const handleEditUser = async () => {
    const values = await editForm.validateFields();
    try {
      await userApi.update(editingUser.id, values);
      message.success('更新成功');
      setEditModal(false); setEditingUser(null); fetchData();
    } catch { message.error('更新失败'); }
  };

  const openSyncModal = async () => {
    setSyncModal(true);
    setSyncCheckedKeys([]);
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

  const handleSync = async () => {
    if (syncCheckedKeys.length === 0) {
      message.warning('请至少选择一个部门或用户');
      return;
    }
    // 分离部门和用户选择
    const deptIds: string[] = [];
    const userIds: string[] = [];
    for (const key of syncCheckedKeys) {
      if (key.startsWith('dept:')) {
        deptIds.push(key.substring(5));
      } else if (key.startsWith('user:')) {
        // key 格式: user:dept_id:open_id
        const parts = key.split(':');
        if (parts.length >= 3) userIds.push(parts[2]);
      }
    }

    setSyncLoading(true);
    try {
      const res = await feishuApi.syncOrg({
        department_ids: deptIds.length > 0 ? deptIds : undefined,
        user_open_ids: userIds.length > 0 ? userIds : undefined,
      });
      const d = res.data.data;
      message.success(`同步完成：部门新增${d.departments?.added || 0} 更新${d.departments?.updated || 0}，用户新增${d.users?.added || 0} 更新${d.users?.updated || 0}`);
      setSyncModal(false);
      fetchData();
    } catch {
      message.warning('同步失败，请检查飞书配置');
    } finally {
      setSyncLoading(false);
    }
  };

  const columns: ColumnsType<any> = [
    { title: 'ID', dataIndex: 'id', width: 60, fixed: 'left' as const },
    { title: '姓名', dataIndex: 'name', width: 100, ellipsis: true },
    { title: '工号', dataIndex: 'employee_no', width: 100 },
    { title: '手机号', dataIndex: 'mobile', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    { title: '角色', dataIndex: 'role', width: 120,
      render: (v: string) => <Tag color={roleMap[v]?.color}>{roleMap[v]?.text || v}</Tag> },
    { title: '部门', dataIndex: 'department_name', width: 100, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'success' : 'default'}>{v === 'ACTIVE' ? '正常' : '停用'}</Tag> },
    ...(isAdmin ? [{ title: '操作', width: 130, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(r); editForm.setFieldsValue(r); setEditModal(true); }}>编辑</Button>
          <Popconfirm title="确定删除此用户？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        {isAdmin && <Button icon={<SyncOutlined />} onClick={openSyncModal}>从飞书同步</Button>}
      </div>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} scroll={{ x: 900 }} />
      </Card>

      <Modal title="编辑用户" open={editModal} onOk={handleEditUser} onCancel={() => { setEditModal(false); setEditingUser(null); }}>
        <Form form={editForm} layout="vertical">
          <Form.Item label="姓名"><span>{editingUser?.name}</span></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { label: '系统管理员', value: 'SYSTEM_ADMIN' },
              { label: '行政经理', value: 'ADMIN_MANAGER' },
              { label: '一级审批人', value: 'L1_APPROVER' },
              { label: '二级审批人', value: 'L2_APPROVER' },
              { label: '司机', value: 'DRIVER' },
              { label: '普通员工', value: 'EMPLOYEE' },
            ]} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[
              { label: '正常', value: 'ACTIVE' },
              { label: '停用', value: 'INACTIVE' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="选择同步范围"
        open={syncModal}
        onOk={handleSync}
        onCancel={() => setSyncModal(false)}
        confirmLoading={syncLoading}
        width={520}
        okText={`开始同步 (${syncCheckedKeys.length})`}
      >
        <Alert type="info" message="勾选部门将同步该部门下全部用户，勾选用户则仅同步选中用户" style={{ marginBottom: 12 }} />
        {treeData.length > 0 ? (
          <Tree
            checkable
            selectable={false}
            treeData={treeData}
            checkedKeys={syncCheckedKeys}
            onCheck={(keys) => setSyncCheckedKeys(keys as string[])}
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
