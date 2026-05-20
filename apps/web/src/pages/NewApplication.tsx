import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, Typography, App, Radio, Divider } from 'antd';
import { CarOutlined, SendOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { deptApi, applicationApi } from '../api';
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
  const [depts, setDepts] = useState<any[]>([]);
  const [approvers, setApprovers] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const copyFromId = searchParams.get('copy_from');

  useEffect(() => {
    deptApi.tree().then(res => setDepts(res.data.data || []));
    if (copyFromId) {
      applicationApi.detail(Number(copyFromId)).then(res => {
        const app = res.data.data;
        if (app) {
          form.setFieldsValue({
            application_type: app.application_type,
            department_id: app.applicant_department_id,
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
          });
          if (app.applicant_department_id) handleDeptChange(app.applicant_department_id);
        }
      });
    }
  }, []);

  const handleDeptChange = async (deptId: number) => {
    if (!deptId) return;
    try {
      const res = await deptApi.getApprover(deptId);
      const data = res.data.data;
      setApprovers(data);
      form.setFieldsValue({
        l1_approver_id: data.l1_approver?.id,
        l1_approver_name: data.l1_approver?.name,
        l2_approver_id: data.l2_approver?.id,
        l2_approver_name: data.l2_approver?.name,
      });
    } catch { /* ignore */ }
  };

  const onFinish = async (values: any) => {
    if (!values.l1_approver_id) {
      message.warning('请先选择申请部门以确定审批人');
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
            <Radio.Group>
              <Radio.Button value="OFFICIAL">公务用车</Radio.Button>
              <Radio.Button value="PRIVATE">私车公用</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="department_id" label="申请部门" rules={[{ required: true }]}>
            <Select
              placeholder="选择部门"
              onChange={handleDeptChange}
              options={depts.map((d: any) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="origin" label="出发地点" rules={[{ required: true, message: '请输入出发地点' }]}>
            <Input placeholder="如：公司总部" />
          </Form.Item>
          <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}>
            <Input placeholder="如：市政府" />
          </Form.Item>
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

        <Card title="审批信息" style={{ marginBottom: 16 }}>
          <Form.Item name="l1_approver_name" label="一级审批人（部门负责人）">
            <Input disabled placeholder="选择部门后自动带出" />
          </Form.Item>
          <Form.Item name="l1_approver_id" hidden><Input /></Form.Item>
          <Form.Item name="l2_approver_name" label="二级审批人（行政经理）">
            <Input disabled placeholder="选择部门后自动带出" />
          </Form.Item>
          <Form.Item name="l2_approver_id" hidden><Input /></Form.Item>
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
