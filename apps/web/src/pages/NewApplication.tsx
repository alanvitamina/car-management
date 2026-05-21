import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, Typography, App, Radio, Divider, Switch, Space, Tag } from 'antd';
import { CarOutlined, SendOutlined, SaveOutlined } from '@ant-design/icons';
import { deptApi, applicationApi, userApi } from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

function toLocalString(d: any) {
  if (!d) return undefined;
  return dayjs(d).format('YYYY-MM-DDTHH:mm:ss');
}

export default function NewApplication() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [approvers, setApprovers] = useState<any>(null);
  const [appType, setAppType] = useState<string>('');
  const [is300km, setIs300km] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const copyFromId = searchParams.get('copy_from');

  useEffect(() => {
    userApi.simple().then(res => setUsers(res.data.data || []));
    if (copyFromId) {
      applicationApi.detail(Number(copyFromId)).then(res => {
        const app = res.data.data;
        if (app) {
          // Find the original applicant in user list for pre-fill
          const u = { id: app.applicant_id, name: app.applicant_name, department_id: app.applicant_department_id };
          setSelectedUser(u);
          setAppType(app.application_type);
          if (app.is_long_distance_300km) setIs300km(true);
          form.setFieldsValue({
            application_type: app.application_type,
            applicant_id: app.applicant_id,
            is_long_distance_300km: app.is_long_distance_300km || false,
            origin: app.origin,
            destination: app.destination,
            departure_at: app.departure_at ? dayjs(app.departure_at) : undefined,
            return_at: app.return_at ? dayjs(app.return_at) : undefined,
            passenger_count: app.passenger_count,
            reason: app.reason,
            remark: app.remark,
            l1_approver_name: app.l1_approver_name,
            l1_approver_id: app.l1_approver_id,
            l2_approver_name: app.l2_approver_name,
            l2_approver_id: app.l2_approver_id,
            l3_approver_name: app.l3_approver_name,
            l3_approver_id: app.l3_approver_id,
          });
          if (app.applicant_department_id) handleUserChange(app.applicant_id, app.applicant_department_id);
        }
      });
    }
  }, []);

  const handleUserChange = async (userId: number, deptId?: number) => {
    const user = users.find(u => u.id === userId);
    setSelectedUser(user || null);
    const dept = deptId || user?.department_id;
    if (!dept) return;
    form.setFieldsValue({ department_id: dept });
    try {
      const res = await deptApi.getApprover(dept, userId);
      const data = res.data.data;
      setApprovers(data);
      const is300km = form.getFieldValue('is_long_distance_300km');
      const l2 = is300km && data.l2_vp_approver ? data.l2_vp_approver : data.l2_approver;
      form.setFieldsValue({
        l1_approver_id: data.l1_approver?.id,
        l1_approver_name: data.l1_approver?.name,
        l2_approver_id: l2?.id,
        l2_approver_name: l2?.name,
        l3_approver_id: is300km ? data.l2_approver?.id : null,
        l3_approver_name: is300km ? data.l2_approver?.name : null,
      });
    } catch { /* ignore */ }
  };

  // 切换300km时重新设置审批人
  const handle300kmChange = (v: boolean) => {
    setIs300km(v);
    form.setFieldsValue({ is_long_distance_300km: v });
    if (!approvers) return;
    const l2 = v && approvers.l2_vp_approver ? approvers.l2_vp_approver : approvers.l2_approver;
    form.setFieldsValue({
      l2_approver_id: l2?.id,
      l2_approver_name: l2?.name,
      l3_approver_id: v ? approvers.l2_approver?.id : null,
      l3_approver_name: v ? approvers.l2_approver?.name : null,
    });
  };

  const onFinish = async (values: any) => {
    if (!values.applicant_id) {
      message.warning('请选择用车人');
      return;
    }
    if (!values.l1_approver_id) {
      message.warning('未找到该用车人部门的审批人，请联系管理员配置');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...values,
        departure_at: toLocalString(values.departure_at),
        return_at: toLocalString(values.return_at),
        passenger_count: values.passenger_count || 1,
      };

      const res = await applicationApi.create(payload);
      const app = res.data.data;
      await applicationApi.submit(app.id);
      message.success('申请已提交');
      navigate(`/applications/${app.id}`);
    } catch (e: any) {
      message.error(e.response?.data?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const onSaveDraft = async () => {
    const values = form.getFieldsValue();
    if (!values.application_type) { message.warning('请选择用车类型'); return; }
    setLoading(true);
    try {
      const payload = {
        ...values,
        departure_at: toLocalString(values.departure_at),
        return_at: toLocalString(values.return_at),
        passenger_count: values.passenger_count || 1,
      };
      const res = await applicationApi.create(payload);
      message.success('草稿已保存');
      navigate(`/applications/${res.data.data.id}`);
    } catch (e: any) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={4}>
        <CarOutlined /> {copyFromId ? '重新发起用车申请' : '发起用车申请'}
        {copyFromId && <span style={{ fontSize: 14, color: '#999', marginLeft: 12 }}>基于已取消单据重新填写</span>}
      </Title>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ passenger_count: 1 }}>
        <Card title="行程信息" style={{ marginBottom: 16 }}>
          <Form.Item name="application_type" label="用车类型" rules={[{ required: true, message: '请选择用车类型' }]}>
            <Radio.Group onChange={e => { setAppType(e.target.value); setIs300km(false); }}>
              <Radio.Button value="OFFICIAL">公务用车</Radio.Button>
              <Radio.Button value="PRIVATE">私车公用</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="applicant_id" label="用车人" rules={[{ required: true, message: '请选择用车人' }]}>
            <Select
              showSearch
              placeholder="搜索并选择用车人"
              onChange={(val: number) => handleUserChange(val)}
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={users.map((u: any) => ({
                label: `${u.name}${u.employee_no ? ` (${u.employee_no})` : ''} — ${u.department_name || ''}`,
                value: u.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="department_id" hidden><Input /></Form.Item>
          {selectedUser && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontSize: 13, color: '#666' }}>
              用车人部门：<strong>{selectedUser.department_name || '未分配部门'}</strong>
              {!selectedUser.department_id && <span style={{ color: '#ff4d4f', marginLeft: 8 }}>该用户未分配部门，无法自动加载审批人</span>}
            </div>
          )}
          <Form.Item name="origin" label="出发地点" rules={[{ required: true, message: '请输入出发地点' }]}>
            <Input placeholder="如：公司总部" />
          </Form.Item>
          <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}>
            <Input placeholder="如：市政府" />
          </Form.Item>
          {appType === 'OFFICIAL' && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
              <Space>
                <span>单程是否超过300公里 <span style={{ color: 'red' }}>*</span></span>
                <Switch
                  checked={is300km}
                  onChange={handle300kmChange}
                  checkedChildren="是(>300km)"
                  unCheckedChildren="否(≤300km)"
                />
              </Space>
              <div style={{ fontSize: 12, color: '#ad6800', marginTop: 4 }}>
                超过300公里需增加常务副总裁审批
              </div>
            </div>
          )}
          <Form.Item name="is_long_distance_300km" hidden><Input /></Form.Item>
          <Form.Item name="departure_at" label="预计出发时间" rules={[{ required: true }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="return_at" label="预计返回时间" rules={[{ required: true }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="passenger_count" label="乘车人数">
            <InputNumber min={1} max={50} />
          </Form.Item>
          <Form.Item name="reason" label="用车事由" rules={[{ required: true, message: '请输入用车事由' }]}>
            <TextArea rows={3} placeholder="请简要说明用车事由" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="其他需要说明的事项" />
          </Form.Item>
        </Card>

        <Card title={<Space>审批信息 {approvers?.l1_approver && <Tag color="blue">已加载</Tag>}</Space>} style={{ marginBottom: 16 }}>
          <Form.Item name="l1_approver_name" label="一级审批 · 部门负责人">
            <Input disabled placeholder="选择用车人后自动带出" />
          </Form.Item>
          <Form.Item name="l1_approver_id" hidden><Input /></Form.Item>
          <Form.Item name="l2_approver_name" label={is300km ? '二级审批 · 常务副总裁' : '二级审批 · 行政经理'}>
            <Input disabled placeholder="选择用车人后自动带出" />
          </Form.Item>
          <Form.Item name="l2_approver_id" hidden><Input /></Form.Item>
          {is300km && (
            <>
              <Form.Item name="l3_approver_name" label="三级审批 · 行政经理">
                <Input disabled placeholder="选择用车人后自动带出" />
              </Form.Item>
              <Form.Item name="l3_approver_id" hidden><Input /></Form.Item>
            </>
          )}
        </Card>

        <Divider />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {copyFromId && <div style={{ flex: 1, color: '#999', fontSize: 13 }}>已自动填充原单据信息，可修改后重新提交</div>}
          <Button icon={<SaveOutlined />} onClick={onSaveDraft} loading={loading}>保存草稿</Button>
          <Button type="primary" icon={<SendOutlined />} htmlType="submit" loading={loading} size="large">提交申请</Button>
        </div>
      </Form>
    </div>
  );
}
