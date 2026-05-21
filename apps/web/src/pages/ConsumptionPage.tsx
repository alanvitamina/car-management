import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, InputNumber, Input, Select, DatePicker, Space, Card, Typography, App, Descriptions, Upload, Image, Switch, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, CameraOutlined, ScanOutlined, LoadingOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { consumptionApi, dispatchApi, authApi } from '../api';
import { fmtTime } from '../utils/format';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

function toLocalString(d: any) {
  if (!d) return undefined;
  return dayjs(d).format('YYYY-MM-DDTHH:mm:ss');
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ConsumptionPage() {
  const [data, setData] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recordModal, setRecordModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [startFileList, setStartFileList] = useState<UploadFile[]>([]);
  const [endFileList, setEndFileList] = useState<UploadFile[]>([]);
  const [ocrLoading, setOcrLoading] = useState<'start' | 'end' | null>(null);
  const [role, setRole] = useState('');
  const { message } = App.useApp();

  const isAdmin = role === 'SYSTEM_ADMIN' || role === 'ADMIN_MANAGER';

  const fetchData = () => {
    setLoading(true);
    consumptionApi.list({ pageSize: 50 }).then(res => setData(res.data.data.list || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    authApi.getMe().then(res => setRole(res.data.data?.role || ''));
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await consumptionApi.remove(id);
      message.success('已删除');
      fetchData();
    } catch { message.error('删除失败'); }
  };

  const handleExport = async () => {
    try {
      const res = await consumptionApi.export();
      const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consumptions_${dayjs().format('YYYYMMDD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch { message.error('导出失败'); }
  };

  const openRecordModal = async () => {
    try {
      const res = await consumptionApi.myDispatches();
      setDispatches(res.data.data || []);
    } catch { setDispatches([]); }
    setFormData({});
    setStartFileList([]);
    setEndFileList([]);
    setOcrLoading(null);
    setRecordModal(true);
  };

  const [returnLoading, setReturnLoading] = useState(false);

  const handleReturn = async (dispatchId: number) => {
    setReturnLoading(true);
    try {
      const res = await dispatchApi.returnVehicle(dispatchId);
      message.success(`收车成功：${res.data.data.vehicle} / ${res.data.data.driver} 已释放`);
      // 刷新派车列表
      const refresh = await consumptionApi.myDispatches();
      setDispatches(refresh.data.data || []);
    } catch (e: any) {
      message.error(e.response?.data?.message || '收车失败');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleDispatchSelect = (dispatchId: number) => {
    const d = dispatches.find(d => d.id === dispatchId);
    if (d) {
      setFormData({
        ...formData,
        dispatch_id: d.id,
        application_id: d.application_id,
        application_no: d.application_no,
      });
    }
  };

  // 上传+OCR：上传照片后自动调用OCR识别里程和时间
  const handleUpload = async (type: 'start' | 'end', file: File) => {
    try {
      const base64 = await readFileAsBase64(file);
      const uploadRes = await consumptionApi.uploadPhoto(base64);
      const url = uploadRes.data.data.url;
      const newFormData: any = { ...formData };

      // 构建文件列表用于预览
      const uploadFile: UploadFile = {
        uid: `${type}-${Date.now()}`,
        name: file.name,
        status: 'done',
        url: url,
        thumbUrl: url,
      };

      if (type === 'start') {
        newFormData.start_photo_url = url;
        setStartFileList([uploadFile]);
      } else {
        newFormData.end_photo_url = url;
        setEndFileList([uploadFile]);
      }
      setFormData(newFormData);

      // OCR 自动识别
      setOcrLoading(type);
      try {
        const ocrRes = await consumptionApi.ocrPhoto(url);
        const extracted = ocrRes.data.data;
        if (extracted) {
          if (extracted.mileage != null) {
            if (type === 'start') {
              newFormData.start_mileage = extracted.mileage;
            } else {
              newFormData.end_mileage = extracted.mileage;
            }
            message.success(`识别到里程 ${extracted.mileage} km，已自动填入`);
          }
          if (extracted.timestamp) {
            const ts = dayjs(extracted.timestamp);
            if (ts.isValid()) {
              const key = type === 'start' ? 'actual_departure_at' : 'actual_return_at';
              newFormData[key] = ts;
              message.success(`识别到时间 ${ts.format('YYYY-MM-DD HH:mm')}，已自动填入`);
            }
          }
          if (extracted.mileage == null && !extracted.timestamp) {
            message.info('未能从照片中识别到有效数据，请手动填写');
          }
        }
        setFormData({ ...newFormData });
      } catch {
        // OCR 失败不影响上传，静默处理
      } finally {
        setOcrLoading(null);
      }
    } catch { message.error('上传失败'); }
  };

  const handleRecord = async () => {
    if (!formData.application_id) { message.warning('请选择派车记录'); return; }
    if (!formData.start_mileage && formData.start_mileage !== 0) { message.warning('请输入出发里程'); return; }
    if (!formData.end_mileage && formData.end_mileage !== 0) { message.warning('请输入返回里程'); return; }
    if (selectedDispatch?.application_type === 'PRIVATE' && formData.is_long_distance == null) { message.warning('私车公用请选择单程是否超过100公里'); return; }
    setActionLoading(true);
    try {
      const payload = {
        ...formData,
        actual_departure_at: toLocalString(formData.actual_departure_at),
        actual_return_at: toLocalString(formData.actual_return_at),
      };
      await consumptionApi.create(payload);
      message.success('录入成功');
      setRecordModal(false);
      fetchData();
    } catch { message.error('录入失败'); }
    finally { setActionLoading(false); }
  };

  const handleConfirm = async (id: number) => {
    setActionLoading(true);
    try { await consumptionApi.confirm(id); message.success('已确认，等待行政经理复核'); fetchData(); }
    catch { message.error('操作失败'); }
    finally { setActionLoading(false); }
  };

  const handleAdminConfirm = async (id: number) => {
    setActionLoading(true);
    try { await consumptionApi.adminConfirm(id); message.success('复核通过'); fetchData(); }
    catch { message.error('操作失败'); }
    finally { setActionLoading(false); }
  };

  const selectedDispatch = dispatches.find(d => d.id === formData.dispatch_id);

  const columns: ColumnsType<any> = [
    { title: '申请编号', dataIndex: 'application_no', width: 180 },
    { title: '类型', dataIndex: 'application_type', width: 90,
      render: (v: string) => <Tag color={v === 'OFFICIAL' ? 'blue' : 'green'}>{v === 'OFFICIAL' ? '公务' : '私车'}</Tag> },
    { title: '出发时间', dataIndex: 'actual_departure_at', width: 150, render: (v: string) => fmtTime(v) },
    { title: '返回时间', dataIndex: 'actual_return_at', width: 150, render: (v: string) => fmtTime(v) },
    { title: '时长(h)', dataIndex: 'duration_minutes', width: 70, render: (v: number) => v ? (v / 60).toFixed(1) : '-' },
    { title: '起止里程', width: 140, render: (_: any, r: any) => `${r.start_mileage || '-'} → ${r.end_mileage || '-'}` },
    { title: '行驶里程', dataIndex: 'total_mileage', width: 80, render: (v: number) => v ? `${v}km` : '-' },
    { title: '路桥费', dataIndex: 'toll_amount', width: 80 },
    { title: '停车费', dataIndex: 'parking_amount', width: 80 },
    { title: '车杂费', dataIndex: 'other_amount', width: 80 },
    { title: '合计', dataIndex: 'total_amount', width: 80, render: (v: number) => <strong>¥{v}</strong> },
    { title: '录入人', dataIndex: 'recorded_by_name', width: 90 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          PENDING_CONFIRM: { color: 'warning', text: '待确认' },
          PENDING_L2_CONFIRM: { color: 'processing', text: '待复核' },
          CONFIRMED: { color: 'success', text: '已确认' },
          REJECTED: { color: 'error', text: '已驳回' },
        };
        const item = map[v] || { color: 'default', text: v };
        return <Tag color={item.color}>{item.text}</Tag>;
      } },
    { title: '操作', width: isAdmin ? 200 : 140, render: (_: any, r: any) => (
      <Space size={4}>
        {r.status === 'PENDING_CONFIRM' && <Button size="small" type="primary" onClick={() => handleConfirm(r.id)}>确认</Button>}
        {r.status === 'PENDING_L2_CONFIRM' && <Button size="small" type="primary" onClick={() => handleAdminConfirm(r.id)}>复核通过</Button>}
        {isAdmin && (
          <Popconfirm title="确定删除此记录？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>消耗管理</Title>
        <Space>
          {isAdmin && <Button icon={<ExportOutlined />} onClick={handleExport}>导出CSV</Button>}
          <Button type="primary" onClick={openRecordModal}>录入消耗</Button>
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} scroll={{ x: 1400 }} />
      </Card>

      <Modal title="录入车辆消耗" open={recordModal} onOk={handleRecord} onCancel={() => setRecordModal(false)} confirmLoading={actionLoading} width={640}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4 }}>选择派车记录 <span style={{ color: 'red' }}>*</span></div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择正在执行中的派车记录"
              value={formData.dispatch_id}
              onChange={handleDispatchSelect}
              options={dispatches.map((d: any) => ({
                label: `${d.application_no} — ${d.vehicle_plate} / ${d.driver_name} (${d.origin}→${d.destination})`,
                value: d.id,
              }))}
            />
          </div>

          {selectedDispatch && (
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="申请人">{selectedDispatch.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="车辆">{selectedDispatch.vehicle_plate}</Descriptions.Item>
              <Descriptions.Item label="出发地">{selectedDispatch.origin}</Descriptions.Item>
              <Descriptions.Item label="目的地">{selectedDispatch.destination}</Descriptions.Item>
            </Descriptions>
          )}

          {dispatches.length > 0 && (() => {
            const targetDispatch = formData.dispatch_id ? selectedDispatch : (dispatches.length === 1 ? dispatches[0] : null);
            if (!targetDispatch || targetDispatch.status === 'COMPLETED') return null;
            return (
            <div style={{ padding: '8px 12px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#ad6800' }}>行程结束？点击"我已收车"即可释放车辆和司机，消耗数据可稍后补录。</span>
              <Button size="small" type="primary" danger loading={returnLoading}
                onClick={() => handleReturn(targetDispatch.id)}
              >我已收车</Button>
            </div>
            );
          })()}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>实际出发时间</div>
          {selectedDispatch?.application_type === 'PRIVATE' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f', marginBottom: 0 }}>
              <span>单程是否超过100公里 <span style={{ color: 'red' }}>*</span></span>
              <Switch
                checked={formData.is_long_distance}
                onChange={v => setFormData({ ...formData, is_long_distance: v })}
                checkedChildren={'是(>100km)'}
                unCheckedChildren={'否(≤100km)'}
              />
              <span style={{ fontSize: 12, color: '#888' }}>决定补助单价：是→1.0元/km，否→0.8元/km</span>
            </div>
          )}

              <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }}
                value={formData.actual_departure_at ? dayjs(formData.actual_departure_at) : undefined}
                onChange={v => setFormData({ ...formData, actual_departure_at: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>实际返回时间</div>
              <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }}
                value={formData.actual_return_at ? dayjs(formData.actual_return_at) : undefined}
                onChange={v => setFormData({ ...formData, actual_return_at: v })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>出发里程 (km) <span style={{ color: 'red' }}>*</span></div>
              <InputNumber style={{ width: '100%' }} value={formData.start_mileage} onChange={v => setFormData({ ...formData, start_mileage: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>返回里程 (km) <span style={{ color: 'red' }}>*</span></div>
              <InputNumber style={{ width: '100%' }} value={formData.end_mileage} onChange={v => setFormData({ ...formData, end_mileage: v })} />
            </div>
            <div style={{ flex: 0, minWidth: 80 }}>
              <div style={{ marginBottom: 4 }}>行驶里程</div>
              <div style={{ lineHeight: '32px', fontWeight: 700, color: '#1677ff' }}>
                {formData.start_mileage != null && formData.end_mileage != null
                  ? `${formData.end_mileage - formData.start_mileage} km`
                  : '-'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>路桥费 (元)</div>
              <InputNumber style={{ width: '100%' }} value={formData.toll_amount} onChange={v => setFormData({ ...formData, toll_amount: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>停车费 (元)</div>
              <InputNumber style={{ width: '100%' }} value={formData.parking_amount} onChange={v => setFormData({ ...formData, parking_amount: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>车杂费 (元)</div>
              <InputNumber style={{ width: '100%' }} value={formData.other_amount} onChange={v => setFormData({ ...formData, other_amount: v })} />
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>实际行程路线</div>
            <TextArea rows={2} placeholder="简述实际行驶路线" value={formData.route_description} onChange={e => setFormData({ ...formData, route_description: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>出发里程表照片（带水印）</div>
              <Upload
                beforeUpload={(file) => { handleUpload('start', file); return false; }}
                fileList={startFileList}
                listType="picture-card"
                accept="image/*"
                maxCount={1}
                onRemove={() => {
                  setStartFileList([]);
                  setFormData({ ...formData, start_photo_url: null });
                }}
              >
                {startFileList.length === 0 && (
                  <div>
                    {ocrLoading === 'start' ? <LoadingOutlined /> : <CameraOutlined />}
                    <div style={{ marginTop: 8 }}>
                      {ocrLoading === 'start' ? '识别中...' : '点击上传'}
                    </div>
                  </div>
                )}
              </Upload>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>返回里程表照片（带水印）</div>
              <Upload
                beforeUpload={(file) => { handleUpload('end', file); return false; }}
                fileList={endFileList}
                listType="picture-card"
                accept="image/*"
                maxCount={1}
                onRemove={() => {
                  setEndFileList([]);
                  setFormData({ ...formData, end_photo_url: null });
                }}
              >
                {endFileList.length === 0 && (
                  <div>
                    {ocrLoading === 'end' ? <LoadingOutlined /> : <CameraOutlined />}
                    <div style={{ marginTop: 8 }}>
                      {ocrLoading === 'end' ? '识别中...' : '点击上传'}
                    </div>
                  </div>
                )}
              </Upload>
            </div>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
