import { getStore } from '../db/database';

/** 根据当前时间自动转换派车/车辆/司机状态 */
export async function syncTimeBasedStatus() {
  const now = new Date();
  const dispatchStore = getStore<any>('car_dispatch_record');
  const appStore = getStore<any>('car_application');
  const vehicleStore = getStore<any>('car_vehicle');
  const driverStore = getStore<any>('car_driver');

  // RESERVED → IN_PROGRESS：当前时间已过派车单的预计出发时间
  const reservedDispatches = await dispatchStore.find(d => d.status === 'RESERVED');
  for (const d of reservedDispatches) {
    const app = await appStore.findById(d.application_id);
    if (!app) continue;
    const departureAt = new Date(app.departure_at);
    if (now >= departureAt) {
      await dispatchStore.update(d.id, {
        actual_departure_at: now.toISOString(),
        status: 'IN_PROGRESS',
        updated_at: now.toISOString(),
      });
      await appStore.update(app.id, {
        status: 'IN_PROGRESS',
        updated_at: now.toISOString(),
      });

      const logStore = getStore<any>('car_application_operation_log');
      await logStore.insert({
        application_id: app.id,
        operation: 'AUTO_START_TRIP',
        operator_id: null, operator_name: '系统',
        from_status: 'RESERVED', to_status: 'IN_PROGRESS',
        detail: `系统自动出车（到达预计出发时间 ${app.departure_at}）`,
        created_at: now.toISOString(),
      });
    }
  }
}
