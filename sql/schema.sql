-- 公务用车管理系统 · MySQL 8.0 建表脚本
-- 第一期完整数据库结构

-- ============================================
-- 1. 用户与组织
-- ============================================

CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    open_id VARCHAR(64) NOT NULL COMMENT '飞书 open_id',
    union_id VARCHAR(64) DEFAULT NULL COMMENT '飞书 union_id',
    name VARCHAR(64) NOT NULL COMMENT '姓名',
    employee_no VARCHAR(32) DEFAULT NULL COMMENT '工号',
    mobile VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
    avatar_url VARCHAR(512) DEFAULT NULL COMMENT '头像 URL',
    role VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE' COMMENT '角色: EMPLOYEE/L1_APPROVER/L2_APPROVER/ADMIN_MANAGER/DRIVER/SYSTEM_ADMIN',
    department_id BIGINT NOT NULL COMMENT '部门 ID',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/INACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT DEFAULT NULL,
    updated_by BIGINT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_open_id (open_id),
    KEY idx_department_id (department_id),
    KEY idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

CREATE TABLE sys_department (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT DEFAULT NULL COMMENT '上级部门 ID',
    name VARCHAR(128) NOT NULL COMMENT '部门名称',
    feishu_department_id VARCHAR(64) DEFAULT NULL COMMENT '飞书部门 ID',
    manager_id BIGINT DEFAULT NULL COMMENT '部门负责人 user_id',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_parent_id (parent_id),
    KEY idx_manager_id (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- ============================================
-- 2. 车辆与司机
-- ============================================

CREATE TABLE car_vehicle (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plate_number VARCHAR(16) NOT NULL COMMENT '车牌号',
    brand VARCHAR(64) DEFAULT NULL COMMENT '品牌',
    model VARCHAR(64) DEFAULT NULL COMMENT '型号',
    color VARCHAR(16) DEFAULT NULL COMMENT '颜色',
    seats INT DEFAULT NULL COMMENT '座位数',
    vehicle_type VARCHAR(32) NOT NULL DEFAULT 'SEDAN' COMMENT '车辆类型: SEDAN/SUV/MPV/BUS',
    fuel_type VARCHAR(16) DEFAULT NULL COMMENT '燃油类型: GASOLINE/DIESEL/ELECTRIC/HYBRID',
    purchase_date DATE DEFAULT NULL COMMENT '购置日期',
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' COMMENT '状态: AVAILABLE/IN_USE/MAINTENANCE/SCRAPPED',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT DEFAULT NULL,
    updated_by BIGINT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_plate_number (plate_number),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车辆档案表';

CREATE TABLE car_driver (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '关联 sys_user.id',
    name VARCHAR(64) NOT NULL COMMENT '司机姓名',
    license_number VARCHAR(32) DEFAULT NULL COMMENT '驾驶证号',
    license_type VARCHAR(8) DEFAULT NULL COMMENT '驾照类型: A/B/C',
    mobile VARCHAR(20) NOT NULL COMMENT '联系电话',
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' COMMENT '状态: AVAILABLE/ON_TRIP/REST/OFF',
    hired_date DATE DEFAULT NULL COMMENT '入职日期',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT DEFAULT NULL,
    updated_by BIGINT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_user_id (user_id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='司机档案表';

-- ============================================
-- 3. 用车申请
-- ============================================

CREATE TABLE car_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_no VARCHAR(32) NOT NULL COMMENT '申请编号',
    application_type VARCHAR(16) NOT NULL COMMENT '申请类型: OFFICIAL/PRIVATE',
    applicant_id BIGINT NOT NULL COMMENT '申请人 user_id',
    applicant_name VARCHAR(64) NOT NULL COMMENT '申请人姓名',
    applicant_department_id BIGINT NOT NULL COMMENT '申请人部门 ID',
    applicant_department_name VARCHAR(128) DEFAULT NULL COMMENT '申请人部门名称',
    -- 行程信息
    departure_at DATETIME NOT NULL COMMENT '预计出发时间',
    return_at DATETIME NOT NULL COMMENT '预计返回时间',
    origin VARCHAR(256) NOT NULL COMMENT '出发地点',
    destination VARCHAR(256) NOT NULL COMMENT '目的地',
    passenger_count INT NOT NULL DEFAULT 1 COMMENT '乘车人数',
    reason VARCHAR(512) NOT NULL COMMENT '用车事由',
    -- 审批信息
    l1_approver_id BIGINT DEFAULT NULL COMMENT '一级审批人 user_id',
    l1_approver_name VARCHAR(64) DEFAULT NULL,
    l2_approver_id BIGINT DEFAULT NULL COMMENT '二级审批人(行政经理) user_id',
    l2_approver_name VARCHAR(64) DEFAULT NULL,
    l1_approved_at DATETIME DEFAULT NULL,
    l2_approved_at DATETIME DEFAULT NULL,
    -- 状态
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PENDING_L1/PENDING_L2/REJECTED/PENDING_DISPATCH/RESERVED/IN_PROGRESS/PENDING_CONFIRM/COMPLETED/CANCELLED/APPROVAL_EXCEPTION',
    -- 取消
    cancelled_at DATETIME DEFAULT NULL,
    cancelled_by BIGINT DEFAULT NULL,
    cancel_reason VARCHAR(256) DEFAULT NULL,
    -- 变更
    change_from_id BIGINT DEFAULT NULL COMMENT '变更来源申请单 ID',
    change_reason VARCHAR(256) DEFAULT NULL,
    -- 扩展
    external_ref_no VARCHAR(64) DEFAULT NULL COMMENT 'OA/外部系统编号',
    attachments JSON DEFAULT NULL COMMENT '附件列表 JSON',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT DEFAULT NULL,
    updated_by BIGINT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_application_no (application_no),
    KEY idx_applicant_id (applicant_id),
    KEY idx_status (status),
    KEY idx_application_type (application_type),
    KEY idx_departure_at (departure_at),
    KEY idx_l1_approver (l1_approver_id),
    KEY idx_l2_approver (l2_approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用车申请表';

CREATE TABLE car_application_operation_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id BIGINT NOT NULL COMMENT '申请单 ID',
    operation VARCHAR(32) NOT NULL COMMENT '操作类型: CREATE/SUBMIT/APPROVE/REJECT/CANCEL/DISPATCH/CHANGE/CONFIRM',
    operator_id BIGINT NOT NULL COMMENT '操作人 user_id',
    operator_name VARCHAR(64) NOT NULL,
    from_status VARCHAR(32) DEFAULT NULL,
    to_status VARCHAR(32) DEFAULT NULL,
    detail VARCHAR(1024) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_application_id (application_id),
    KEY idx_operator_id (operator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='申请操作日志';

-- ============================================
-- 4. 审批记录
-- ============================================

CREATE TABLE car_approval_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id BIGINT NOT NULL COMMENT '申请单 ID',
    feishu_approval_code VARCHAR(64) DEFAULT NULL COMMENT '飞书审批实例 ID',
    feishu_approval_task_id VARCHAR(64) DEFAULT NULL COMMENT '飞书审批任务 ID',
    approval_level VARCHAR(8) NOT NULL COMMENT '审批级别: L1/L2',
    approver_id BIGINT NOT NULL COMMENT '审批人 user_id',
    approver_name VARCHAR(64) NOT NULL,
    action VARCHAR(16) DEFAULT NULL COMMENT '审批动作: APPROVE/REJECT/TRANSFER/ADD_SIGNER',
    comment VARCHAR(1024) DEFAULT NULL COMMENT '审批意见',
    acted_at DATETIME DEFAULT NULL COMMENT '审批时间',
    sync_status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '飞书同步状态: PENDING/SENT/CONFIRMED/FAILED',
    raw_callback JSON DEFAULT NULL COMMENT '飞书回调原始数据',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_application_id (application_id),
    KEY idx_feishu_approval_code (feishu_approval_code),
    KEY idx_approver_id (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批记录表';

-- ============================================
-- 5. 派车记录
-- ============================================

CREATE TABLE car_dispatch_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id BIGINT NOT NULL COMMENT '申请单 ID',
    vehicle_id BIGINT NOT NULL COMMENT '车辆 ID',
    vehicle_plate VARCHAR(16) NOT NULL COMMENT '车牌号(快照)',
    driver_id BIGINT NOT NULL COMMENT '司机 ID',
    driver_name VARCHAR(64) NOT NULL COMMENT '司机姓名(快照)',
    dispatched_by BIGINT NOT NULL COMMENT '派车人 user_id',
    dispatched_by_name VARCHAR(64) NOT NULL,
    dispatch_type VARCHAR(16) NOT NULL DEFAULT 'ORIGINAL' COMMENT '派车类型: ORIGINAL/REASSIGN',
    previous_dispatch_id BIGINT DEFAULT NULL COMMENT '改派前记录 ID',
    actual_departure_at DATETIME DEFAULT NULL COMMENT '实际出发时间',
    actual_return_at DATETIME DEFAULT NULL COMMENT '实际返回时间',
    status VARCHAR(32) NOT NULL DEFAULT 'RESERVED' COMMENT 'RESERVED/IN_PROGRESS/COMPLETED/CANCELLED',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_application_id (application_id),
    KEY idx_vehicle_id (vehicle_id),
    KEY idx_driver_id (driver_id),
    KEY idx_dispatched_by (dispatched_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='派车记录表';

-- ============================================
-- 6. 消耗记录
-- ============================================

CREATE TABLE car_consumption_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id BIGINT NOT NULL COMMENT '申请单 ID',
    dispatch_id BIGINT NOT NULL COMMENT '派车记录 ID',
    record_type VARCHAR(16) NOT NULL COMMENT '记录类型: FUEL/MILEAGE/TOLL/PARKING/OTHER',
    -- 公务用车消耗
    fuel_amount DECIMAL(10,2) DEFAULT NULL COMMENT '加油金额',
    fuel_volume DECIMAL(10,2) DEFAULT NULL COMMENT '加油量(L)',
    start_mileage DECIMAL(10,2) DEFAULT NULL COMMENT '起始里程(km)',
    end_mileage DECIMAL(10,2) DEFAULT NULL COMMENT '结束里程(km)',
    actual_mileage DECIMAL(10,2) DEFAULT NULL COMMENT '实际行驶里程(km)',
    toll_amount DECIMAL(10,2) DEFAULT NULL COMMENT '过路费',
    parking_amount DECIMAL(10,2) DEFAULT NULL COMMENT '停车费',
    other_amount DECIMAL(10,2) DEFAULT NULL COMMENT '其他费用',
    -- 私车公用
    nav_mileage DECIMAL(10,2) DEFAULT NULL COMMENT '导航核验里程(km)',
    nav_source VARCHAR(256) DEFAULT NULL COMMENT '导航来源说明',
    nav_screenshot VARCHAR(512) DEFAULT NULL COMMENT '导航截图备注',
    -- 通用
    total_amount DECIMAL(12,2) DEFAULT NULL COMMENT '费用合计',
    recorded_by BIGINT NOT NULL COMMENT '录入人 user_id',
    recorded_by_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_CONFIRM' COMMENT 'PENDING_CONFIRM/CONFIRMED/REJECTED',
    confirmed_by BIGINT DEFAULT NULL COMMENT '确认人',
    confirmed_by_name VARCHAR(64) DEFAULT NULL,
    confirmed_at DATETIME DEFAULT NULL,
    reject_reason VARCHAR(256) DEFAULT NULL COMMENT '驳回原因',
    attachments JSON DEFAULT NULL COMMENT '票据附件',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_application_id (application_id),
    KEY idx_dispatch_id (dispatch_id),
    KEY idx_record_type (record_type),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消耗记录表';

-- ============================================
-- 7. 补助核算
-- ============================================

CREATE TABLE car_subsidy_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
    rule_type VARCHAR(32) NOT NULL COMMENT '规则类型: PRIVATE_CAR_MILEAGE/PRIVATE_CAR_DAY/DRIVER_SUBSIDY',
    unit_price DECIMAL(10,4) NOT NULL COMMENT '单价',
    unit VARCHAR(16) NOT NULL COMMENT '单位: KM/DAY/TRIP',
    effective_from DATE NOT NULL COMMENT '生效日期',
    effective_to DATE DEFAULT NULL COMMENT '失效日期',
    min_value DECIMAL(10,2) DEFAULT NULL COMMENT '最小值/阈值',
    max_value DECIMAL(10,2) DEFAULT NULL COMMENT '最大值/上限',
    description VARCHAR(256) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='补助规则表';

CREATE TABLE car_subsidy_settlement (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id BIGINT NOT NULL COMMENT '申请单 ID',
    settlement_type VARCHAR(32) NOT NULL COMMENT '结算类型: PRIVATE_CAR/DRIVER',
    -- 私车公用补助
    approved_mileage DECIMAL(10,2) DEFAULT NULL COMMENT '核验后里程(km)',
    mileage_unit_price DECIMAL(10,4) DEFAULT NULL COMMENT '里程单价',
    mileage_subsidy DECIMAL(12,2) DEFAULT NULL COMMENT '里程补助金额',
    day_count INT DEFAULT NULL COMMENT '用车天数',
    daily_subsidy DECIMAL(12,2) DEFAULT NULL COMMENT '每日补助',
    total_subsidy DECIMAL(12,2) NOT NULL COMMENT '补助总额',
    -- 司机补助
    driver_trip_count INT DEFAULT NULL COMMENT '出车次数',
    driver_trip_subsidy DECIMAL(12,2) DEFAULT NULL COMMENT '司机出车补助',
    -- 通用
    rule_snapshot JSON DEFAULT NULL COMMENT '核算时规则快照',
    calculated_by BIGINT NOT NULL COMMENT '核算人',
    calculated_by_name VARCHAR(64) NOT NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'CALCULATED' COMMENT 'CALCULATED/CONFIRMED',
    remark VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_application_id (application_id),
    KEY idx_settlement_type (settlement_type),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='补助核算表';

-- ============================================
-- 8. 消息通知
-- ============================================

CREATE TABLE msg_notification_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    recipient_id BIGINT NOT NULL COMMENT '接收人 user_id',
    recipient_name VARCHAR(64) NOT NULL,
    notification_type VARCHAR(32) NOT NULL COMMENT '通知类型: APPROVAL_PENDING/DISPATCH_NOTIFY/CONFIRM_REMIND/STATUS_CHANGE/SYSTEM_NOTICE',
    title VARCHAR(256) NOT NULL,
    content TEXT NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'FEISHU' COMMENT '发送渠道: FEISHU/IN_APP',
    feishu_message_id VARCHAR(64) DEFAULT NULL COMMENT '飞书消息 ID',
    send_status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '发送状态: PENDING/SENT/FAILED',
    send_at DATETIME DEFAULT NULL,
    fail_reason VARCHAR(512) DEFAULT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_recipient_id (recipient_id),
    KEY idx_notification_type (notification_type),
    KEY idx_send_status (send_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知日志';

-- ============================================
-- 9. 系统配置与日志
-- ============================================

CREATE TABLE sys_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(64) NOT NULL COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type VARCHAR(16) NOT NULL DEFAULT 'STRING' COMMENT '类型: STRING/NUMBER/JSON',
    description VARCHAR(256) DEFAULT NULL,
    updated_by BIGINT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

CREATE TABLE sys_sync_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sync_type VARCHAR(32) NOT NULL COMMENT '同步类型: USER_SYNC/DEPT_SYNC/APPROVAL_SYNC',
    sync_status VARCHAR(16) NOT NULL DEFAULT 'STARTED' COMMENT 'STARTED/RUNNING/SUCCESS/FAILED',
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    error_detail TEXT DEFAULT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME DEFAULT NULL,
    KEY idx_sync_type (sync_type),
    KEY idx_sync_status (sync_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同步日志表';

CREATE TABLE sys_integration_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    integration_type VARCHAR(32) NOT NULL COMMENT '集成类型: FEISHU_AUTH/FEISHU_APPROVAL/FEISHU_MSG/FEISHU_ORG/OA',
    request_url VARCHAR(512) DEFAULT NULL,
    request_body JSON DEFAULT NULL,
    response_body JSON DEFAULT NULL,
    status_code INT DEFAULT NULL,
    duration_ms INT DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT 'SUCCESS/FAILED',
    error_message VARCHAR(1024) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_integration_type (integration_type),
    KEY idx_status (status),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='集成日志表';

-- ============================================
-- 10. 初始数据
-- ============================================

-- 默认部门
INSERT INTO sys_department (id, parent_id, name, sort_order) VALUES
(1, NULL, '总裁办', 0),
(2, 1, '行政部', 10);

-- 默认管理员
INSERT INTO sys_user (id, open_id, name, role, department_id, employee_no) VALUES
(1, 'admin', '系统管理员', 'SYSTEM_ADMIN', 1, 'ADMIN001');
