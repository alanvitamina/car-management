import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const subsidyRoutes = Router();
const mgmtRoles = ['SYSTEM_ADMIN', 'ADMIN_MANAGER'];
const now = () => new Date().toISOString();

// 节假日缓存（通过 timor.tech 免费 API 获取，自动按年加载 + 内存缓存）
let holidayCache: Set<string> = new Set();

async function loadHolidays(year: number): Promise<Set<string>> {
  try {
    const url = `https://timor.tech/api/holiday/year/${year}`;
    const res = await fetch(url);
    const json = await res.json() as { code: number; holiday?: Record<string, { holiday: boolean; name: string }> };
    if (json.code === 0 && json.holiday) {
      const holidays = new Set<string>();
      for (const [date, info] of Object.entries(json.holiday)) {
        if (info.holiday) holidays.add(`${year}-${date}`);
      }
      console.log(`[holiday] 已加载 ${year} 年法定节假日 ${holidays.size} 天`);
      return holidays;
    }
  } catch (e: any) {
    console.warn(`[holiday] API 获取 ${year} 年节假日失败: ${e.message}，降级为仅周末判断`);
  }
  return new Set();
}

// 模块加载时预加载当年+次年
(async () => {
  const y = new Date().getFullYear();
  const [a, b] = await Promise.all([loadHolidays(y), loadHolidays(y + 1)]);
  holidayCache = new Set([...a, ...b]);
})();

function isHoliday(dateStr: string): boolean {
  return holidayCache.has(dateStr.slice(0, 10));
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}

function getSeason(dateStr: string): 'WINTER' | 'SUMMER' {
  const m = parseInt(dateStr.slice(5, 7), 10);
  return (m >= 10 || m <= 4) ? 'WINTER' : 'SUMMER';
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 计算司机在指定日期范围内的加班时数
function calcDriverOvertime(departureAt: string, returnAt: string): {
  totalOvertimeHours: number;
  workdayHours: number;
  weekendHours: number;
  holidayHours: number;
  details: string[];
} {
  const depart = new Date(departureAt);
  const ret = new Date(returnAt);
  if (ret <= depart) return { totalOvertimeHours: 0, workdayHours: 0, weekendHours: 0, holidayHours: 0, details: [] };

  let workdayHours = 0;
  let weekendHours = 0;
  let holidayHours = 0;
  const details: string[] = [];

  // 按天遍历
  const cursor = new Date(depart);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(ret);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const dayStr = toLocalDateStr(cursor);
    const season = getSeason(dayStr);
    const holiday = isHoliday(dayStr);
    const weekend = isWeekend(dayStr);
    const isWorkday = !holiday && !weekend;

    // 当天有效时段
    const dayStart = new Date(Math.max(depart.getTime(), cursor.getTime()));
    const dayEnd = new Date(Math.min(ret.getTime(), cursor.getTime() + 86400000 - 1));

    if (dayEnd > dayStart) {
      const dayStartMin = dayStart.getHours() * 60 + dayStart.getMinutes();
      const dayEndMin = dayEnd.getHours() * 60 + dayEnd.getMinutes();

      if (isWorkday) {
        // 工作日：只计算加班区间内的小时
        const otWindows = season === 'WINTER'
          ? [[0, 8 * 60 + 30], [12 * 60, 13 * 60], [17 * 60 + 30, 24 * 60]]
          : [[0, 8 * 60 + 30], [12 * 60, 13 * 60 + 30], [18 * 60, 24 * 60]];

        let overlapMin = 0;
        otWindows.forEach(([ws, we]) => {
          const s = Math.max(dayStartMin, ws);
          const e = Math.min(dayEndMin, we);
          if (e > s) overlapMin += (e - s);
        });

        // +1h 早出 +1h 晚归（如果当天有出车）
        overlapMin += 60; // 早出加1小时
        overlapMin += 60; // 晚归加1小时

        const h = Math.round(overlapMin / 60 * 100) / 100;
        workdayHours += h;
        details.push(`${dayStr} 工作日(${season === 'WINTER' ? '冬' : '夏'}) ${(overlapMin / 60).toFixed(1)}h ×1`);
      } else if (weekend && !holiday) {
        // 周末：全部时长 + 出车前1h + 收车后1h
        const totalMin = (dayEnd.getTime() - dayStart.getTime()) / 60000 + 120;
        const h = Math.round(totalMin / 60 * 100) / 100;
        weekendHours += h;
        details.push(`${dayStr} 周末 ${(totalMin / 60).toFixed(1)}h ×2`);
      } else {
        // 法定节假日：全部时长 + 出车前1h + 收车后1h
        const totalMin = (dayEnd.getTime() - dayStart.getTime()) / 60000 + 120;
        const h = Math.round(totalMin / 60 * 100) / 100;
        holidayHours += h;
        details.push(`${dayStr} 法定假日 ${(totalMin / 60).toFixed(1)}h ×3`);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const totalOvertimeHours = Math.round((workdayHours * 1 + weekendHours * 2 + holidayHours * 3) * 100) / 100;

  return { totalOvertimeHours, workdayHours: Math.round(workdayHours * 100) / 100, weekendHours: Math.round(weekendHours * 100) / 100, holidayHours: Math.round(holidayHours * 100) / 100, details };
}

subsidyRoutes.get('/rules', async (_req: Request, res: Response) => {
  try {
    const list = await getStore<any>('car_subsidy_rule').find(r => r.is_deleted === 0);
    res.json({ code: 0, data: list });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

subsidyRoutes.put('/rules/:id', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const updated = await getStore<any>('car_subsidy_rule').update(Number(req.params.id), { ...req.body, updated_at: now() });
    res.json({ code: 0, data: updated });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 私车公用里程补助核算（按"单程是否超100公里"决定单价）
subsidyRoutes.post('/calculate/private-car', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const appStore = getStore<any>('car_application');
    const consumptionStore = getStore<any>('car_consumption_record');
    const settlementStore = getStore<any>('car_subsidy_settlement');
    const { application_id } = req.body;

    const app = await appStore.findOne(a => a.id === application_id && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }
    if (app.application_type !== 'PRIVATE') { res.status(400).json({ code: 400, message: '仅私车公用类型可核算' }); return; }

    const consumptions = await consumptionStore.find(c => c.application_id === application_id && c.status === 'CONFIRMED');
    if (consumptions.length === 0) { res.status(400).json({ code: 400, message: '该申请尚无已确认的消耗记录' }); return; }

    const totalMileage = consumptions.reduce((s, c) => s + (c.total_mileage || 0), 0);
    const isLongDistance = consumptions.some(c => c.is_long_distance === true);

    const unitPrice = isLongDistance ? 1.0 : 0.8;
    const ruleName = isLongDistance ? '私车里程补助(>100km)' : '私车里程补助(≤100km)';
    const mileageSubsidy = Math.round(totalMileage * unitPrice * 100) / 100;

    const settlement = await settlementStore.insert({
      application_id, settlement_type: 'PRIVATE_CAR',
      approved_mileage: totalMileage,
      mileage_unit_price: unitPrice,
      mileage_subsidy: mileageSubsidy,
      day_count: null, daily_subsidy: null,
      total_subsidy: mileageSubsidy,
      overtime_minutes: null, overtime_hours: null,
      driver_trip_count: null, driver_trip_subsidy: null,
      rule_snapshot: JSON.stringify({ rule: ruleName, unit_price: unitPrice, total_mileage: totalMileage, is_long_distance: isLongDistance }),
      calculated_by: req.user!.id,
      calculated_by_name: req.user!.name, calculated_at: now(), status: 'CALCULATED',
      remark: null, created_at: now(), updated_at: now(),
    });

    res.json({ code: 0, data: { ...settlement, total_mileage: totalMileage, applied_rule: ruleName, unit_price: unitPrice, is_long_distance: isLongDistance } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 公务用车司机加班核算
subsidyRoutes.post('/calculate/driver', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const appStore = getStore<any>('car_application');
    const dispatchStore = getStore<any>('car_dispatch_record');
    const settlementStore = getStore<any>('car_subsidy_settlement');
    const { application_id } = req.body;

    const app = await appStore.findOne(a => a.id === application_id && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    const dispatches = await dispatchStore.find(d => d.application_id === application_id && d.status === 'COMPLETED');

    const tripResults: any[] = [];
    let totalOvertime = 0;
    let totalWorkday = 0;
    let totalWeekend = 0;
    let totalHoliday = 0;

    dispatches.forEach(d => {
      if (d.actual_departure_at && d.actual_return_at) {
        const result = calcDriverOvertime(d.actual_departure_at, d.actual_return_at);
        totalOvertime += result.totalOvertimeHours;
        totalWorkday += result.workdayHours;
        totalWeekend += result.weekendHours;
        totalHoliday += result.holidayHours;
        tripResults.push({
          dispatch_id: d.id,
          driver_name: d.driver_name,
          vehicle_plate: d.vehicle_plate,
          departure_at: d.actual_departure_at,
          return_at: d.actual_return_at,
          ...result,
        });
      }
    });

    totalOvertime = Math.round(totalOvertime * 100) / 100;
    totalWorkday = Math.round(totalWorkday * 100) / 100;
    totalWeekend = Math.round(totalWeekend * 100) / 100;
    totalHoliday = Math.round(totalHoliday * 100) / 100;

    const totalRawMinutes = dispatches.reduce((s, d) => {
      if (!d.actual_departure_at || !d.actual_return_at) return s;
      return s + Math.round((new Date(d.actual_return_at).getTime() - new Date(d.actual_departure_at).getTime()) / 60000);
    }, 0);

    const settlement = await settlementStore.insert({
      application_id, settlement_type: 'DRIVER',
      approved_mileage: null, mileage_unit_price: null, mileage_subsidy: null,
      day_count: null, daily_subsidy: null,
      total_subsidy: 0,
      overtime_minutes: totalRawMinutes,
      overtime_hours: totalOvertime,
      driver_trip_count: dispatches.length, driver_trip_subsidy: null,
      rule_snapshot: JSON.stringify({ season: getSeason(new Date().toISOString()), workday_hours: totalWorkday, weekend_hours: totalWeekend, holiday_hours: totalHoliday, trips: tripResults }),
      calculated_by: req.user!.id,
      calculated_by_name: req.user!.name, calculated_at: now(), status: 'CALCULATED',
      remark: `司机核算加班 ${totalOvertime}h (工作日${totalWorkday}h + 周末${totalWeekend}h×2 + 节假日${totalHoliday}h×3)，推送人资统一核算`,
      created_at: now(), updated_at: now(),
    });

    res.json({ code: 0, data: { ...settlement, overtime_hours: totalOvertime, workday_hours: totalWorkday, weekend_hours: totalWeekend, holiday_hours: totalHoliday, trips: tripResults } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

subsidyRoutes.get('/driver-overtime-summary', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const dispatchStore = getStore<any>('car_dispatch_record');
    const { month, driver_id } = req.query;

    const allDispatches = await dispatchStore.find(d => d.status === 'COMPLETED' && d.actual_departure_at && d.actual_return_at);

    let filtered = allDispatches;
    if (month) {
      const m = String(month);
      filtered = filtered.filter(d => (d.actual_departure_at || '').startsWith(m));
    }
    if (driver_id) {
      filtered = filtered.filter(d => d.driver_id === Number(driver_id));
    }

    const byDriver: Record<number, any> = {};
    filtered.forEach(d => {
      if (!byDriver[d.driver_id]) {
        byDriver[d.driver_id] = { driver_id: d.driver_id, driver_name: d.driver_name, trip_count: 0, total_overtime_hours: 0, total_raw_minutes: 0, trips: [] };
      }
      const rawMin = Math.round((new Date(d.actual_return_at).getTime() - new Date(d.actual_departure_at).getTime()) / 60000);
      const otResult = calcDriverOvertime(d.actual_departure_at, d.actual_return_at);
      byDriver[d.driver_id].trip_count += 1;
      byDriver[d.driver_id].total_overtime_hours += otResult.totalOvertimeHours;
      byDriver[d.driver_id].total_raw_minutes += rawMin;
      byDriver[d.driver_id].trips.push({ dispatch_id: d.id, application_id: d.application_id, vehicle_plate: d.vehicle_plate, departure_at: d.actual_departure_at, return_at: d.actual_return_at, overtime_hours: otResult.totalOvertimeHours, raw_minutes: rawMin });
    });

    const summary = Object.values(byDriver).map((d: any) => ({
      ...d,
      total_overtime_hours: Math.round(d.total_overtime_hours * 100) / 100,
    }));

    res.json({ code: 0, data: { summary, total_drivers: summary.length } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

subsidyRoutes.get('/settlements', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_subsidy_settlement');
    const appStore = getStore<any>('car_application');
    const { application_id, settlement_type } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.all();
    if (application_id) list = list.filter(s => s.application_id === Number(application_id));
    if (settlement_type) list = list.filter(s => s.settlement_type === settlement_type);

    const total = list.length;
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    list = list.slice((page - 1) * pageSize, page * pageSize);

    const enriched = await Promise.all(list.map(async s => {
      const app = await appStore.findById(s.application_id);
      return { ...s, application_no: app?.application_no || '', application_type: app?.application_type || '', applicant_name: app?.applicant_name || '' };
    }));

    res.json({ code: 0, data: { list: enriched, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
