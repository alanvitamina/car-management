import { getStore } from './database';

export async function seedIfEmpty() {
  const deptStore = getStore<any>('sys_department');
  if (await deptStore.count() > 0) return;

  const now = new Date().toISOString();

  // 部门
  await deptStore.insert({ parent_id: null, name: '总裁办', feishu_department_id: null, manager_id: null, sort_order: 0, created_at: now, updated_at: now, is_deleted: 0 });
  await deptStore.insert({ parent_id: 1, name: '行政部', feishu_department_id: null, manager_id: null, sort_order: 10, created_at: now, updated_at: now, is_deleted: 0 });
  await deptStore.insert({ parent_id: 1, name: '技术部', feishu_department_id: null, manager_id: 4, sort_order: 20, created_at: now, updated_at: now, is_deleted: 0 });

  // 用户
  const userStore = getStore<any>('sys_user');
  await userStore.insert({ open_id: 'admin', union_id: null, name: '系统管理员', employee_no: '001', mobile: '13800000001', email: 'admin@company.com', avatar_url: null, role: 'SYSTEM_ADMIN', department_id: 1, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });
  await userStore.insert({ open_id: 'manager', union_id: null, name: '李经理', employee_no: '002', mobile: '13800000002', email: 'manager@company.com', avatar_url: null, role: 'ADMIN_MANAGER', department_id: 2, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });
  await userStore.insert({ open_id: 'emp01', union_id: null, name: '张小明', employee_no: '003', mobile: '13800000003', email: 'zhangxm@company.com', avatar_url: null, role: 'EMPLOYEE', department_id: 3, leader_open_id: null, leader_user_id: 4, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });
  await userStore.insert({ open_id: 'l1_approver', union_id: null, name: '王部长', employee_no: '004', mobile: '13800000004', email: 'wangbz@company.com', avatar_url: null, role: 'L1_APPROVER', department_id: 3, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });
  await userStore.insert({ open_id: 'driver01', union_id: null, name: '赵司机', employee_no: '005', mobile: '13800000005', email: null, avatar_url: null, role: 'DRIVER', department_id: 2, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });
  await userStore.insert({ open_id: 'vp001', union_id: null, name: '常务副总裁', employee_no: '006', mobile: '13800000006', email: 'vp@company.com', avatar_url: null, role: 'SENIOR_VP', department_id: 1, status: 'ACTIVE', created_at: now, updated_at: now, created_by: null, updated_by: null, is_deleted: 0 });

  // 司机
  const driverStore = getStore<any>('car_driver');
  await driverStore.insert({ user_id: 5, name: '赵司机', license_number: 'DL20240001', license_type: 'C', mobile: '13800000005', status: 'AVAILABLE', hired_date: '2024-01-15', remark: null, created_at: now, updated_at: now, created_by: 1, updated_by: 1, is_deleted: 0 });

  // 车辆
  const vehicleStore = getStore<any>('car_vehicle');
  await vehicleStore.insert({ plate_number: '京A00123', brand: '别克', model: 'GL8 2024', color: '黑色', seats: 7, vehicle_type: 'MPV', fuel_type: 'GASOLINE', purchase_date: '2023-06-01', inspection_date: '2026-06-15', insurance_expiry_date: '2026-07-20', status: 'AVAILABLE', remark: null, created_at: now, updated_at: now, created_by: 1, updated_by: 1, is_deleted: 0 });
  await vehicleStore.insert({ plate_number: '京A00456', brand: '奥迪', model: 'A6L 2024', color: '黑色', seats: 5, vehicle_type: 'SEDAN', fuel_type: 'GASOLINE', purchase_date: '2024-01-10', inspection_date: '2026-08-01', insurance_expiry_date: '2026-05-28', status: 'AVAILABLE', remark: null, created_at: now, updated_at: now, created_by: 1, updated_by: 1, is_deleted: 0 });
  await vehicleStore.insert({ plate_number: '京A00789', brand: '丰田', model: '考斯特', color: '白色', seats: 20, vehicle_type: 'BUS', fuel_type: 'DIESEL', purchase_date: '2022-03-15', inspection_date: '2025-12-01', insurance_expiry_date: '2025-11-15', status: 'AVAILABLE', remark: null, created_at: now, updated_at: now, created_by: 1, updated_by: 1, is_deleted: 0 });

  // 补助规则
  const ruleStore = getStore<any>('car_subsidy_rule');
  await ruleStore.insert({ rule_name: '私车里程补助(≤100km)', rule_type: 'PRIVATE_CAR_MILEAGE', unit_price: 0.80, unit: 'KM', effective_from: '2024-01-01', effective_to: null, min_value: 0, max_value: 100, description: '单次核算里程≤100公里时，按0.8元/公里', created_at: now, updated_at: now, is_deleted: 0 });
  await ruleStore.insert({ rule_name: '私车里程补助(>100km)', rule_type: 'PRIVATE_CAR_MILEAGE', unit_price: 1.00, unit: 'KM', effective_from: '2024-01-01', effective_to: null, min_value: 100, max_value: null, description: '单次核算里程>100公里时，按1.0元/公里', created_at: now, updated_at: now, is_deleted: 0 });

  // 已完成测试数据：完整用车流程
  const t = (h: number, m = 0) => new Date(`2026-05-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`).toISOString();
  const appStore = getStore<any>('car_application');
  const app = await appStore.insert({
    application_no: 'GC20260510A00001', application_type: 'OFFICIAL',
    applicant_id: 3, applicant_name: '张小明', applicant_department_id: 3, applicant_department_name: '技术部',
    departure_at: t(9), return_at: t(17),
    origin: '公司总部', destination: '市政府会议中心', passenger_count: 3,
    reason: '参加智慧城市项目汇报会议',
    l1_approver_id: 4, l1_approver_name: '王部长',
    l2_approver_id: 2, l2_approver_name: '李经理',
    status: 'COMPLETED', attachments: null, remark: '需携带演示设备',
    cancelled_at: null, cancelled_by: null, cancel_reason: null,
    change_from_id: null, change_reason: null, external_ref_no: null,
    created_at: t(9), updated_at: t(18), created_by: 3, updated_by: 3, is_deleted: 0,
  });

  // 审批记录
  const approvalStore = getStore<any>('car_approval_record');
  await approvalStore.insert({ application_id: app.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L1', approver_id: 4, approver_name: '王部长', action: 'APPROVED', comment: '同意，注意安全', acted_at: t(10), sync_status: 'SENT', raw_callback: null, created_at: t(9, 5), updated_at: t(10) });
  await approvalStore.insert({ application_id: app.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L2', approver_id: 2, approver_name: '李经理', action: 'APPROVED', comment: '批准', acted_at: t(11), sync_status: 'SENT', raw_callback: null, created_at: t(10), updated_at: t(11) });

  // 派车记录
  const dispatchStore = getStore<any>('car_dispatch_record');
  await dispatchStore.insert({ application_id: app.id, vehicle_id: 1, vehicle_plate: '京A00123', driver_id: 1, driver_name: '赵司机', dispatched_by: 1, dispatched_by_name: '系统管理员', dispatch_type: 'ORIGINAL', previous_dispatch_id: null, actual_departure_at: t(9, 15), actual_return_at: t(16, 45), status: 'COMPLETED', remark: null, created_at: t(14), updated_at: t(18) });

  // 消耗记录（已确认）
  const consumptionStore = getStore<any>('car_consumption_record');
  await consumptionStore.insert({ application_id: app.id, dispatch_id: 1, recorded_by: 5, recorded_by_name: '赵司机', actual_departure_at: t(9, 15), actual_return_at: t(16, 45), duration_minutes: 450, start_mileage: 12350, end_mileage: 12430, total_mileage: 80, toll_amount: 50, parking_amount: 30, other_amount: 0, total_amount: 80, route_description: '公司→市政府→公司，途经三环路', start_photo_url: null, end_photo_url: null, status: 'CONFIRMED', confirmed_by: 1, confirmed_by_name: '系统管理员', confirmed_at: t(18), reject_reason: null, created_at: t(17, 30), updated_at: t(18) });

  // 操作日志
  const logStore = getStore<any>('car_application_operation_log');
  await logStore.insert({ application_id: app.id, operation: 'CREATE', operator_id: 3, operator_name: '张小明', from_status: null, to_status: 'DRAFT', detail: '创建申请', created_at: t(9) });
  await logStore.insert({ application_id: app.id, operation: 'SUBMIT', operator_id: 3, operator_name: '张小明', from_status: 'DRAFT', to_status: 'PENDING_L1', detail: '提交申请', created_at: t(9, 5) });
  await logStore.insert({ application_id: app.id, operation: 'APPROVE', operator_id: 4, operator_name: '王部长', from_status: 'PENDING_L1', to_status: 'PENDING_L2', detail: '一级审批通过', created_at: t(10) });
  await logStore.insert({ application_id: app.id, operation: 'APPROVE', operator_id: 2, operator_name: '李经理', from_status: 'PENDING_L2', to_status: 'PENDING_DISPATCH', detail: '二级审批通过', created_at: t(11) });
  await logStore.insert({ application_id: app.id, operation: 'DISPATCH', operator_id: 1, operator_name: '系统管理员', from_status: 'PENDING_DISPATCH', to_status: 'RESERVED', detail: '派车: 京A00123 / 赵司机', created_at: t(14) });
  await logStore.insert({ application_id: app.id, operation: 'START_TRIP', operator_id: 5, operator_name: '赵司机', from_status: 'RESERVED', to_status: 'IN_PROGRESS', detail: '出车', created_at: t(9, 15) });
  await logStore.insert({ application_id: app.id, operation: 'RECORD_CONSUMPTION', operator_id: 5, operator_name: '赵司机', from_status: 'IN_PROGRESS', to_status: 'PENDING_CONFIRM', detail: '录入消耗: 里程80km 费用¥80', created_at: t(17, 30) });
  await logStore.insert({ application_id: app.id, operation: 'CONFIRM_CONSUMPTION', operator_id: 1, operator_name: '系统管理员', from_status: 'PENDING_CONFIRM', to_status: 'COMPLETED', detail: '确认消耗', created_at: t(18) });

  // 待录入消耗测试数据：IN_PROGRESS 的派车但未填消耗
  const today = new Date();
  const td = (h: number, m = 0) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const app2 = await appStore.insert({
    application_no: 'GC20260515B00001', application_type: 'OFFICIAL',
    applicant_id: 3, applicant_name: '张小明', applicant_department_id: 3, applicant_department_name: '技术部',
    departure_at: td(8), return_at: td(18),
    origin: '公司总部', destination: '首都国际机场T3', passenger_count: 2,
    reason: '接重要客户来访',
    l1_approver_id: 4, l1_approver_name: '王部长',
    l2_approver_id: 2, l2_approver_name: '李经理',
    status: 'IN_PROGRESS', attachments: null, remark: null,
    cancelled_at: null, cancelled_by: null, cancel_reason: null,
    change_from_id: null, change_reason: null, external_ref_no: null,
    created_at: td(7), updated_at: td(8), created_by: 3, updated_by: 3, is_deleted: 0,
  });

  await approvalStore.insert({ application_id: app2.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L1', approver_id: 4, approver_name: '王部长', action: 'APPROVED', comment: '同意', acted_at: td(7, 30), sync_status: 'SENT', raw_callback: null, created_at: td(7), updated_at: td(7, 30) });
  await approvalStore.insert({ application_id: app2.id, feishu_approval_code: null, feishu_approval_task_id: null, approval_level: 'L2', approver_id: 2, approver_name: '李经理', action: 'APPROVED', comment: '批准', acted_at: td(7, 45), sync_status: 'SENT', raw_callback: null, created_at: td(7, 30), updated_at: td(7, 45) });

  await dispatchStore.insert({ application_id: app2.id, vehicle_id: 1, vehicle_plate: '京A00123', driver_id: 1, driver_name: '赵司机', dispatched_by: 1, dispatched_by_name: '系统管理员', dispatch_type: 'ORIGINAL', previous_dispatch_id: null, actual_departure_at: td(8, 10), actual_return_at: null, status: 'IN_PROGRESS', remark: null, created_at: td(7, 50), updated_at: td(8, 10) });

  await logStore.insert({ application_id: app2.id, operation: 'CREATE', operator_id: 3, operator_name: '张小明', from_status: null, to_status: 'DRAFT', detail: '创建申请', created_at: td(7) });
  await logStore.insert({ application_id: app2.id, operation: 'SUBMIT', operator_id: 3, operator_name: '张小明', from_status: 'DRAFT', to_status: 'PENDING_L1', detail: '提交申请', created_at: td(7, 5) });
  await logStore.insert({ application_id: app2.id, operation: 'APPROVE', operator_id: 4, operator_name: '王部长', from_status: 'PENDING_L1', to_status: 'PENDING_L2', detail: '一级审批通过', created_at: td(7, 30) });
  await logStore.insert({ application_id: app2.id, operation: 'APPROVE', operator_id: 2, operator_name: '李经理', from_status: 'PENDING_L2', to_status: 'PENDING_DISPATCH', detail: '二级审批通过', created_at: td(7, 45) });
  await logStore.insert({ application_id: app2.id, operation: 'DISPATCH', operator_id: 1, operator_name: '系统管理员', from_status: 'PENDING_DISPATCH', to_status: 'RESERVED', detail: '派车: 京A00123 / 赵司机', created_at: td(7, 50) });
  await logStore.insert({ application_id: app2.id, operation: 'START_TRIP', operator_id: 5, operator_name: '赵司机', from_status: 'RESERVED', to_status: 'IN_PROGRESS', detail: '出车', created_at: td(8, 10) });

  // 更新车辆和司机状态为使用中
  await vehicleStore.update(1, { status: 'IN_USE', updated_at: td(8, 10) });
  await driverStore.update(1, { status: 'ON_TRIP', updated_at: td(8, 10) });

  console.log('[seed] 初始数据已注入（含演示流程 + 待录入消耗测试数据）');
}
