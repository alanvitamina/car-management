import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';

export const dashboardRoutes = Router();

dashboardRoutes.get('/summary', async (_req: Request, res: Response) => {
  try {
    const appStore = getStore<any>('car_application');
    const vehicleStore = getStore<any>('car_vehicle');
    const driverStore = getStore<any>('car_driver');
    const consumptionStore = getStore<any>('car_consumption_record');
    const settlementStore = getStore<any>('car_subsidy_settlement');

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const allApps = await appStore.find(a => a.is_deleted === 0);
    const monthApps = allApps.filter(a => a.created_at?.startsWith(thisMonth));

    const monthly = {
      total: monthApps.length,
      official_count: monthApps.filter(a => a.application_type === 'OFFICIAL').length,
      private_count: monthApps.filter(a => a.application_type === 'PRIVATE').length,
      completed_count: monthApps.filter(a => a.status === 'COMPLETED').length,
      rejected_count: monthApps.filter(a => a.status === 'REJECTED').length,
      active_count: monthApps.filter(a => ['PENDING_L1', 'PENDING_L2', 'PENDING_DISPATCH', 'RESERVED', 'IN_PROGRESS', 'PENDING_CONFIRM'].includes(a.status)).length,
    };

    const allVehicles = await vehicleStore.find(v => v.is_deleted === 0);
    const vehicles = {
      total_vehicles: allVehicles.length,
      available_vehicles: allVehicles.filter(v => v.status === 'AVAILABLE').length,
      in_use_vehicles: allVehicles.filter(v => v.status === 'IN_USE').length,
      maintenance_vehicles: allVehicles.filter(v => v.status === 'MAINTENANCE').length,
    };

    const allDrivers = await driverStore.find(d => d.is_deleted === 0);
    const drivers = {
      total_drivers: allDrivers.length,
      available_drivers: allDrivers.filter(d => d.status === 'AVAILABLE').length,
      on_trip_drivers: allDrivers.filter(d => d.status === 'ON_TRIP').length,
    };

    const pending = {
      pending_approval: allApps.filter(a => (a.status === 'PENDING_L1' || a.status === 'PENDING_L2')).length,
      pending_dispatch: allApps.filter(a => a.status === 'PENDING_DISPATCH').length,
      pending_confirm: (await consumptionStore.find(c => c.status === 'PENDING_CONFIRM')).length,
    };

    const monthConsumptions = await consumptionStore.find(c => c.created_at?.startsWith(thisMonth));
    const costs = {
      total_toll: monthConsumptions.reduce((s, c) => s + (c.toll_amount || 0), 0),
      total_parking: monthConsumptions.reduce((s, c) => s + (c.parking_amount || 0), 0),
      total_other: monthConsumptions.reduce((s, c) => s + (c.other_amount || 0), 0),
      total_cost: monthConsumptions.reduce((s, c) => s + (c.total_amount || 0), 0),
    };

    // 即将到期的年审/保险提醒（30天内）
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const soonStr = soon.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const expiring = {
      inspection: allVehicles.filter(v => v.inspection_date && v.inspection_date >= todayStr && v.inspection_date <= soonStr),
      insurance: allVehicles.filter(v => v.insurance_expiry_date && v.insurance_expiry_date >= todayStr && v.insurance_expiry_date <= soonStr),
    };

    const monthSettlements = await settlementStore.find(s => s.created_at?.startsWith(thisMonth));
    const subsidies = {
      private_car_subsidy: monthSettlements.filter(s => s.settlement_type === 'PRIVATE_CAR').reduce((sum, s) => sum + (s.total_subsidy || 0), 0),
      driver_subsidy: monthSettlements.filter(s => s.settlement_type === 'DRIVER').reduce((sum, s) => sum + (s.total_subsidy || 0), 0),
      total_subsidy: monthSettlements.reduce((sum, s) => sum + (s.total_subsidy || 0), 0),
    };

    const recent = [...allApps].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

    res.json({ code: 0, data: { monthly, vehicles, drivers, pending, costs, subsidies, expiring, recent_applications: recent } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

dashboardRoutes.get('/trend', async (_req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_application');
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }

    const allApps = await store.find(a => a.is_deleted === 0);
    const trend = months.map(m => {
      const apps = allApps.filter(a => a.created_at?.startsWith(m));
      return {
        month: m, total: apps.length,
        official: apps.filter(a => a.application_type === 'OFFICIAL').length,
        private: apps.filter(a => a.application_type === 'PRIVATE').length,
      };
    });

    res.json({ code: 0, data: trend });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
