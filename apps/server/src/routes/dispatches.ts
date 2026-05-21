import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const dispatchRoutes = Router();
const dispatchRoles = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];
const now = () => new Date().toISOString();

// 自动释放超时未收车的派车单（预计结束时间 + 30分钟后仍未点击收车）
export async function autoReleaseOverdue() {
  const dispatchStore = getStore<any>('car_dispatch_record');
  const vehicleStore = getStore<any>('car_vehicle');
  const driverStore = getStore<any>('car_driver');
  const appStore = getStore<any>('car_application');
  const consumptionStore = getStore<any>('car_consumption_record');
  const notifyStore = getStore<any>('msg_notification_log');
  const logStore = getStore<any>('car_application_operation_log');

  const inProgress = await dispatchStore.find(d => d.status === 'IN_PROGRESS');
  const cutoff = Date.now() - 30 * 60 * 1000; // 超过预计结束时间 30 分钟

  for (const d of inProgress) {
    const app = await appStore.findOne(a => a.id === d.application_id && a.is_deleted === 0);
    if (!app || !app.return_at) continue;

    const returnAt = new Date(app.return_at).getTime();
    if (returnAt > cutoff) continue; // 还没超时

    // 超时自动释放
    const ts = now();
    await dispatchStore.update(d.id, { actual_return_at: ts, status: 'COMPLETED', updated_at: ts });
    await vehicleStore.update(d.vehicle_id, { status: 'AVAILABLE', updated_at: ts });
    await driverStore.update(d.driver_id, { status: 'AVAILABLE', updated_at: ts });

    // 若无消耗记录，申请单推进到"待确认"
    const existingConsumption = await consumptionStore.findOne(c => c.application_id === d.application_id && c.is_deleted !== 1);
    if (!existingConsumption) {
      await appStore.update(d.application_id, { status: 'PENDING_CONFIRM', updated_at: ts });
    }

    // 通知司机
    await notifyStore.insert({
      recipient_id: d.driver_id,
      recipient_name: d.driver_name,
      notification_type: 'SYSTEM',
      title: '系统自动收车',
      content: `派车单 ${app.application_no} 已超过预计结束时间 30 分钟，系统已自动收车，请尽快补录消耗数据。`,
      is_read: 0,
      related_application_id: d.application_id,
      created_at: ts,
    });

    await logStore.insert({
      application_id: d.application_id,
      operation: 'AUTO_RETURN',
      operator_id: 0,
      operator_name: '系统',
      from_status: 'IN_PROGRESS',
      to_status: existingConsumption ? 'IN_PROGRESS' : 'PENDING_CONFIRM',
      detail: `超时自动收车（预计结束 ${app.return_at}）`,
      created_at: ts,
    });

    console.log(`[dispatch] 自动收车: dispatch #${d.id} application #${d.application_id} vehicle #${d.vehicle_id} driver #${d.driver_id}`);
  }
}

dispatchRoutes.get('/pending', requireRole(...dispatchRoles), async (_req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const list = await store.find(a => ['PENDING_DISPATCH', 'RESERVED'].includes(a.status) && a.is_deleted === 0);
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    res.json({ code: 0, data: { list } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

dispatchRoutes.post('/', requireRole(...dispatchRoles), async (req: Request, res: Response) => {
  try {
    // 先释放超时未收车的资源
    await autoReleaseOverdue();

    const appStore = getStore<any>('car_application');
    const vehicleStore = getStore<any>('car_vehicle');
    const driverStore = getStore<any>('car_driver');
    const dispatchStore = getStore<any>('car_dispatch_record');

    const { application_id, vehicle_id, driver_id } = req.body;
    const app = await appStore.findOne(a => a.id === application_id && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (app.status !== 'PENDING_DISPATCH') { res.status(400).json({ code: 400, message: '当前状态不可派车' }); return; }

    const vehicle = await vehicleStore.findOne(v => v.id === vehicle_id && v.is_deleted === 0);
    if (!vehicle || vehicle.status !== 'AVAILABLE') { res.status(400).json({ code: 400, message: '车辆不可用' }); return; }

    const driver = await driverStore.findOne(d => d.id === driver_id && d.is_deleted === 0);
    if (!driver || driver.status !== 'AVAILABLE') { res.status(400).json({ code: 400, message: '司机不可用' }); return; }

    // 冲突校验
    if (!req.body.force) {
      const conflicts = await dispatchStore.find(d =>
        (d.vehicle_id === vehicle_id || d.driver_id === driver_id) &&
        ['RESERVED', 'IN_PROGRESS'].includes(d.status) &&
        !(d.actual_return_at < app.departure_at || d.actual_departure_at > app.return_at)
      );
      if (conflicts.length > 0) {
        res.status(409).json({ code: 409, message: '车辆或司机在选定时间段已被占用', conflict_count: conflicts.length }); return;
      }
    }

    await dispatchStore.insert({ application_id, vehicle_id, vehicle_plate: vehicle.plate_number, driver_id, driver_name: driver.name, dispatched_by: req.user!.id, dispatched_by_name: req.user!.name, dispatch_type: 'ORIGINAL', previous_dispatch_id: null, actual_departure_at: null, actual_return_at: null, status: 'RESERVED', remark: req.body.remark || null, created_at: now(), updated_at: now() });

    await appStore.update(application_id, { status: 'RESERVED', updated_by: req.user!.id, updated_at: now() });
    await vehicleStore.update(vehicle_id, { status: 'IN_USE', updated_at: now() });
    await driverStore.update(driver_id, { status: 'ON_TRIP', updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id, operation: 'DISPATCH', operator_id: req.user!.id, operator_name: req.user!.name, from_status: 'PENDING_DISPATCH', to_status: 'RESERVED', detail: `派车: ${vehicle.plate_number} / ${driver.name}`, created_at: now() });

    // 发送通知给司机
    const notifyStore = getStore<any>('msg_notification_log');
    await notifyStore.insert({
      recipient_id: driver.user_id, recipient_name: driver.name,
      notification_type: 'DISPATCH', title: '新的派车任务',
      content: `您有一个新的出车任务：${app.application_no}，${app.origin} → ${app.destination}，车辆 ${vehicle.plate_number}，预计出发 ${app.departure_at}`,
      is_read: 0, related_application_id: application_id,
      created_at: now(),
    });

    res.json({ code: 0, data: { vehicle: vehicle.plate_number, driver: driver.name, status: 'RESERVED' } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

dispatchRoutes.put('/:id/reassign', requireRole(...dispatchRoles), async (req: Request, res: Response) => {
  try {
    const dispatchStore = getStore<any>('car_dispatch_record');
    const vehicleStore = getStore<any>('car_vehicle');
    const driverStore = getStore<any>('car_driver');

    const record = await dispatchStore.findById(Number(req.params.id));
    if (!record) { res.status(404).json({ code: 404, message: '派车记录不存在' }); return; }
    if (!['RESERVED', 'IN_PROGRESS'].includes(record.status)) { res.status(400).json({ code: 400, message: '当前状态不支持改派' }); return; }

    const { vehicle_id, driver_id, remark } = req.body;

    await vehicleStore.update(record.vehicle_id, { status: 'AVAILABLE', updated_at: now() });
    await driverStore.update(record.driver_id, { status: 'AVAILABLE', updated_at: now() });
    await dispatchStore.update(record.id, { status: 'CANCELLED', updated_at: now() });

    const vehicle = await vehicleStore.findOne(v => v.id === (vehicle_id || record.vehicle_id) && v.is_deleted === 0);
    const driver = await driverStore.findOne(d => d.id === (driver_id || record.driver_id) && d.is_deleted === 0);

    await dispatchStore.insert({ application_id: record.application_id, vehicle_id: vehicle!.id, vehicle_plate: vehicle!.plate_number, driver_id: driver!.id, driver_name: driver!.name, dispatched_by: req.user!.id, dispatched_by_name: req.user!.name, dispatch_type: 'REASSIGN', previous_dispatch_id: record.id, actual_departure_at: null, actual_return_at: null, status: 'RESERVED', remark: remark || '改派', created_at: now(), updated_at: now() });

    await vehicleStore.update(vehicle!.id, { status: 'IN_USE', updated_at: now() });
    await driverStore.update(driver!.id, { status: 'ON_TRIP', updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: record.application_id, operation: 'REASSIGN', operator_id: req.user!.id, operator_name: req.user!.name, from_status: record.status, to_status: 'RESERVED', detail: `改派: ${record.vehicle_plate}→${vehicle!.plate_number}`, created_at: now() });

    res.json({ code: 0, data: { old_vehicle: record.vehicle_plate, new_vehicle: vehicle!.plate_number, old_driver: record.driver_name, new_driver: driver!.name } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

dispatchRoutes.post('/:id/start', requireRole(...dispatchRoles, 'DRIVER'), async (req: Request, res: Response) => {
  try {
    const dispatchStore = getStore<any>('car_dispatch_record');
    const appStore = getStore<any>('car_application');

    const record = await dispatchStore.findById(Number(req.params.id));
    if (!record) { res.status(404).json({ code: 404, message: '派车记录不存在' }); return; }
    if (record.status !== 'RESERVED') { res.status(400).json({ code: 400, message: '当前状态不可出车' }); return; }

    await dispatchStore.update(record.id, { actual_departure_at: now(), status: 'IN_PROGRESS', updated_at: now() });
    await appStore.update(record.application_id, { status: 'IN_PROGRESS', updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({ application_id: record.application_id, operation: 'START_TRIP', operator_id: req.user!.id, operator_name: req.user!.name, from_status: 'RESERVED', to_status: 'IN_PROGRESS', detail: '出车', created_at: now() });

    res.json({ code: 0, data: { status: 'IN_PROGRESS' } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 司机手动收车：释放车辆和司机资源
dispatchRoutes.post('/:id/return', async (req: Request, res: Response) => {
  try {
    const dispatchStore = getStore<any>('car_dispatch_record');
    const vehicleStore = getStore<any>('car_vehicle');
    const driverStore = getStore<any>('car_driver');
    const appStore = getStore<any>('car_application');
    const consumptionStore = getStore<any>('car_consumption_record');

    const record = await dispatchStore.findById(Number(req.params.id));
    if (!record) { res.status(404).json({ code: 404, message: '派车记录不存在' }); return; }
    if (record.status !== 'IN_PROGRESS') { res.status(400).json({ code: 400, message: '当前状态不可收车' }); return; }

    const ts = now();
    await dispatchStore.update(record.id, { actual_return_at: ts, status: 'COMPLETED', updated_at: ts });
    await vehicleStore.update(record.vehicle_id, { status: 'AVAILABLE', updated_at: ts });
    await driverStore.update(record.driver_id, { status: 'AVAILABLE', updated_at: ts });

    // 若无消耗记录，申请单从"执行中"推进到"待确认"，表示行程已结束、等待补录消耗
    const existingConsumption = await consumptionStore.findOne(c => c.application_id === record.application_id && c.is_deleted !== 1);
    if (!existingConsumption) {
      await appStore.update(record.application_id, { status: 'PENDING_CONFIRM', updated_at: ts });
    }

    const logStore = getStore<any>('car_application_operation_log');
    const app = await appStore.findOne((a: any) => a.id === record.application_id);
    await logStore.insert({
      application_id: record.application_id,
      operation: 'DRIVER_RETURN',
      operator_id: req.user!.id,
      operator_name: req.user!.name,
      from_status: 'IN_PROGRESS',
      to_status: existingConsumption ? 'IN_PROGRESS' : 'PENDING_CONFIRM',
      detail: `司机手动收车${app ? `（${app.application_no}）` : ''}`,
      created_at: ts,
    });

    res.json({ code: 0, data: { status: 'COMPLETED', vehicle: record.vehicle_plate, driver: record.driver_name } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
