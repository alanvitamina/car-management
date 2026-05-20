-- 公务用车管理系统 建表 SQL 草案 V1
-- 默认数据库: MySQL 8.0+
-- 字符集: utf8mb4
-- 说明:
-- 1. 本草案优先满足第一期业务闭环
-- 2. 业务关系暂以应用层保证, 本版不强制添加外键约束
-- 3. 所有业务表默认采用逻辑删除字段 is_deleted

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_department` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `feishu_department_id` VARCHAR(64) NOT NULL COMMENT '飞书部门ID',
  `department_name` VARCHAR(128) NOT NULL COMMENT '部门名称',
  `parent_id` BIGINT DEFAULT NULL COMMENT '上级部门ID',
  `leader_user_id` BIGINT DEFAULT NULL COMMENT '部门负责人用户ID',
  `department_status` VARCHAR(32) NOT NULL DEFAULT 'ENABLED' COMMENT '部门状态: ENABLED/DISABLED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_feishu_department_id` (`feishu_department_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_leader_user_id` (`leader_user_id`),
  KEY `idx_department_status` (`department_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='部门表';


CREATE TABLE IF NOT EXISTS `sys_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `feishu_user_id` VARCHAR(64) NOT NULL COMMENT '飞书用户ID',
  `feishu_open_id` VARCHAR(64) DEFAULT NULL COMMENT '飞书open_id',
  `user_name` VARCHAR(64) NOT NULL COMMENT '用户姓名',
  `mobile` VARCHAR(32) DEFAULT NULL COMMENT '手机号',
  `email` VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  `department_id` BIGINT DEFAULT NULL COMMENT '所属部门ID',
  `manager_user_id` BIGINT DEFAULT NULL COMMENT '上级用户ID',
  `user_status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '用户状态: ACTIVE/DISABLED',
  `role_tags` JSON DEFAULT NULL COMMENT '角色标签JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_feishu_user_id` (`feishu_user_id`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_manager_user_id` (`manager_user_id`),
  KEY `idx_user_status` (`user_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';


CREATE TABLE IF NOT EXISTS `car_vehicle` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `vehicle_no` VARCHAR(64) NOT NULL COMMENT '车辆编号',
  `plate_no` VARCHAR(32) NOT NULL COMMENT '车牌号',
  `vehicle_model` VARCHAR(128) NOT NULL COMMENT '车辆型号',
  `seat_count` INT DEFAULT NULL COMMENT '座位数',
  `owner_department_id` BIGINT DEFAULT NULL COMMENT '归属部门ID',
  `vehicle_status` VARCHAR(32) NOT NULL DEFAULT 'IDLE' COMMENT '车辆状态: IDLE/RESERVED/IN_USE/MAINTENANCE/DISABLED',
  `insurance_expire_date` DATE DEFAULT NULL COMMENT '保险到期日',
  `maintenance_date` DATE DEFAULT NULL COMMENT '最近保养日期',
  `annual_inspection_date` DATE DEFAULT NULL COMMENT '年检日期',
  `manager_user_id` BIGINT DEFAULT NULL COMMENT '车辆管理员用户ID',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vehicle_no` (`vehicle_no`),
  UNIQUE KEY `uk_plate_no` (`plate_no`),
  KEY `idx_owner_department_id` (`owner_department_id`),
  KEY `idx_manager_user_id` (`manager_user_id`),
  KEY `idx_vehicle_status` (`vehicle_status`),
  KEY `idx_insurance_expire_date` (`insurance_expire_date`),
  KEY `idx_maintenance_date` (`maintenance_date`),
  KEY `idx_annual_inspection_date` (`annual_inspection_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='车辆表';


CREATE TABLE IF NOT EXISTS `car_driver` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` BIGINT NOT NULL COMMENT '对应用户ID',
  `driver_name` VARCHAR(64) NOT NULL COMMENT '司机姓名冗余',
  `mobile` VARCHAR(32) DEFAULT NULL COMMENT '联系方式冗余',
  `owner_department_id` BIGINT DEFAULT NULL COMMENT '归属部门ID',
  `license_type` VARCHAR(64) DEFAULT NULL COMMENT '准驾车型',
  `driver_status` VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' COMMENT '司机状态: AVAILABLE/RESERVED/IN_USE/REST/LEAVE/DISABLED',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_owner_department_id` (`owner_department_id`),
  KEY `idx_driver_status` (`driver_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='司机表';


CREATE TABLE IF NOT EXISTS `car_application` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_no` VARCHAR(64) NOT NULL COMMENT '申请单号',
  `applicant_user_id` BIGINT NOT NULL COMMENT '申请人用户ID',
  `applicant_department_id` BIGINT NOT NULL COMMENT '申请部门ID',
  `use_car_type` VARCHAR(32) NOT NULL COMMENT '用车类型: OFFICIAL/PRIVATE',
  `start_time` DATETIME NOT NULL COMMENT '用车开始时间',
  `end_time` DATETIME NOT NULL COMMENT '用车结束时间',
  `purpose` VARCHAR(500) NOT NULL COMMENT '用车事由',
  `destination` VARCHAR(500) NOT NULL COMMENT '目的地',
  `first_approver_user_id` BIGINT NOT NULL COMMENT '一级审批人用户ID',
  `second_approver_user_id` BIGINT NOT NULL COMMENT '二级审批人用户ID',
  `first_approval_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '一级审批状态: PENDING/APPROVED/REJECTED/WITHDRAWN',
  `second_approval_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '二级审批状态: PENDING/APPROVED/REJECTED/WITHDRAWN',
  `application_status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '申请主状态',
  `current_approval_instance_id` VARCHAR(128) DEFAULT NULL COMMENT '当前飞书审批实例ID',
  `original_application_id` BIGINT DEFAULT NULL COMMENT '原申请单ID, 用于变更或重提',
  `cancel_reason` VARCHAR(500) DEFAULT NULL COMMENT '取消原因',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_application_no` (`application_no`),
  KEY `idx_applicant_user_id` (`applicant_user_id`),
  KEY `idx_applicant_department_id` (`applicant_department_id`),
  KEY `idx_application_status` (`application_status`),
  KEY `idx_use_car_type` (`use_car_type`),
  KEY `idx_current_approval_instance_id` (`current_approval_instance_id`),
  KEY `idx_start_end_time` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用车申请表';


CREATE TABLE IF NOT EXISTS `car_application_operation_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT NOT NULL COMMENT '申请单ID',
  `operation_type` VARCHAR(64) NOT NULL COMMENT '操作类型: SUBMIT/CANCEL/CHANGE/RECREATE/DISPATCH/CONFIRM等',
  `operator_user_id` BIGINT NOT NULL COMMENT '操作人用户ID',
  `before_status` VARCHAR(32) DEFAULT NULL COMMENT '变更前状态',
  `after_status` VARCHAR(32) DEFAULT NULL COMMENT '变更后状态',
  `operation_comment` VARCHAR(1000) DEFAULT NULL COMMENT '操作说明',
  `extra_payload` JSON DEFAULT NULL COMMENT '扩展信息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_application_id` (`application_id`),
  KEY `idx_operator_user_id` (`operator_user_id`),
  KEY `idx_operation_type` (`operation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='申请操作日志表';


CREATE TABLE IF NOT EXISTS `car_approval_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT NOT NULL COMMENT '申请单ID',
  `approval_instance_id` VARCHAR(128) NOT NULL COMMENT '飞书审批实例ID',
  `approval_node_type` VARCHAR(32) NOT NULL COMMENT '审批节点类型: L1/L2/ADD_SIGN/COUNTER_SIGN',
  `node_sort` INT NOT NULL DEFAULT 1 COMMENT '节点排序',
  `approver_user_id` BIGINT NOT NULL COMMENT '当前审批人用户ID',
  `from_user_id` BIGINT DEFAULT NULL COMMENT '移交来源用户ID',
  `action_type` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '动作类型: PENDING/APPROVE/REJECT/WITHDRAW/TRANSFER/ADD_SIGN/COUNTER_SIGN',
  `action_result` VARCHAR(32) NOT NULL DEFAULT 'PROCESSING' COMMENT '动作结果: PROCESSING/APPROVED/REJECTED/WITHDRAWN',
  `action_comment` VARCHAR(1000) DEFAULT NULL COMMENT '审批意见',
  `callback_payload` JSON DEFAULT NULL COMMENT '飞书回调原始数据',
  `acted_at` DATETIME DEFAULT NULL COMMENT '审批动作时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_application_id` (`application_id`),
  KEY `idx_approval_instance_id` (`approval_instance_id`),
  KEY `idx_approver_user_id` (`approver_user_id`),
  KEY `idx_approval_node_type` (`approval_node_type`),
  KEY `idx_action_result` (`action_result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批记录表';


CREATE TABLE IF NOT EXISTS `car_dispatch_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT NOT NULL COMMENT '申请单ID',
  `vehicle_id` BIGINT NOT NULL COMMENT '车辆ID',
  `driver_id` BIGINT NOT NULL COMMENT '司机ID',
  `dispatch_status` VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED' COMMENT '派车状态: ASSIGNED/RELEASED/REDISPATCHED/COMPLETED',
  `dispatched_by` BIGINT NOT NULL COMMENT '派车人用户ID',
  `dispatch_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '派车时间',
  `actual_departure_at` DATETIME DEFAULT NULL COMMENT '实际出车时间',
  `actual_return_at` DATETIME DEFAULT NULL COMMENT '实际收车时间',
  `release_time` DATETIME DEFAULT NULL COMMENT '释放时间',
  `release_reason` VARCHAR(500) DEFAULT NULL COMMENT '释放原因',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_application_id` (`application_id`),
  KEY `idx_vehicle_id` (`vehicle_id`),
  KEY `idx_driver_id` (`driver_id`),
  KEY `idx_dispatch_status` (`dispatch_status`),
  KEY `idx_vehicle_dispatch_status` (`vehicle_id`, `dispatch_status`),
  KEY `idx_driver_dispatch_status` (`driver_id`, `dispatch_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='派车记录表';


CREATE TABLE IF NOT EXISTS `car_consumption_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT NOT NULL COMMENT '申请单ID',
  `record_type` VARCHAR(32) NOT NULL COMMENT '记录类型: OFFICIAL/PRIVATE',
  `recorder_user_id` BIGINT NOT NULL COMMENT '记录人用户ID',
  `confirmer_user_id` BIGINT NOT NULL COMMENT '确认人或核验人用户ID',
  `start_place` VARCHAR(255) DEFAULT NULL COMMENT '起点',
  `end_place` VARCHAR(255) DEFAULT NULL COMMENT '终点',
  `start_mileage` DECIMAL(10,2) DEFAULT NULL COMMENT '出车前里程',
  `end_mileage` DECIMAL(10,2) DEFAULT NULL COMMENT '结束后里程',
  `actual_mileage` DECIMAL(10,2) DEFAULT NULL COMMENT '记录总里程',
  `navigation_mileage` DECIMAL(10,2) DEFAULT NULL COMMENT '导航核验里程',
  `settlement_mileage` DECIMAL(10,2) DEFAULT NULL COMMENT '最终核算里程',
  `fuel_fee` DECIMAL(12,2) DEFAULT NULL COMMENT '油费',
  `toll_fee` DECIMAL(12,2) DEFAULT NULL COMMENT '路桥费',
  `parking_fee` DECIMAL(12,2) DEFAULT NULL COMMENT '停车费',
  `other_fee` DECIMAL(12,2) DEFAULT NULL COMMENT '其他费用',
  `departure_photo_url` VARCHAR(500) DEFAULT NULL COMMENT '出车前里程照片URL',
  `departure_photo_time` DATETIME DEFAULT NULL COMMENT '出车前照片EXIF拍摄时间',
  `return_photo_url` VARCHAR(500) DEFAULT NULL COMMENT '收车后里程照片URL',
  `return_photo_time` DATETIME DEFAULT NULL COMMENT '收车后照片EXIF拍摄时间',
  `time_source` VARCHAR(32) NOT NULL DEFAULT 'EXIF' COMMENT '时间来源: EXIF/MANUAL',
  `verification_comment` VARCHAR(1000) DEFAULT NULL COMMENT '核验说明',
  `confirm_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '确认状态: PENDING/CONFIRMED/REJECTED',
  `reject_reason` VARCHAR(500) DEFAULT NULL COMMENT '驳回原因',
  `submitted_at` DATETIME DEFAULT NULL COMMENT '提交时间',
  `confirmed_at` DATETIME DEFAULT NULL COMMENT '确认时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_application_id` (`application_id`),
  KEY `idx_record_type` (`record_type`),
  KEY `idx_recorder_user_id` (`recorder_user_id`),
  KEY `idx_confirmer_user_id` (`confirmer_user_id`),
  KEY `idx_confirm_status` (`confirm_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用车消耗记录表';


CREATE TABLE IF NOT EXISTS `car_subsidy_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `rule_type` VARCHAR(32) NOT NULL COMMENT '规则类型: PRIVATE_SUBSIDY/DRIVER_SUBSIDY',
  `rule_name` VARCHAR(128) NOT NULL COMMENT '规则名称',
  `version_no` VARCHAR(32) NOT NULL COMMENT '版本号',
  `effective_start_date` DATE NOT NULL COMMENT '生效开始日期',
  `effective_end_date` DATE DEFAULT NULL COMMENT '生效结束日期',
  `rule_content` JSON NOT NULL COMMENT '规则内容JSON',
  `rule_status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '规则状态: ACTIVE/INACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_rule_type` (`rule_type`),
  KEY `idx_rule_status` (`rule_status`),
  KEY `idx_effective_start_date` (`effective_start_date`),
  KEY `idx_effective_end_date` (`effective_end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='补助规则表';


CREATE TABLE IF NOT EXISTS `car_subsidy_settlement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT NOT NULL COMMENT '申请单ID',
  `settlement_type` VARCHAR(32) NOT NULL COMMENT '核算类型: PRIVATE_SUBSIDY/DRIVER_SUBSIDY',
  `target_user_id` BIGINT NOT NULL COMMENT '补助对象用户ID',
  `rule_id` BIGINT NOT NULL COMMENT '命中规则ID',
  `rule_snapshot` JSON NOT NULL COMMENT '规则快照JSON',
  `base_value` DECIMAL(10,2) NOT NULL COMMENT '核算基数, 如里程或时长',
  `multiplier` DECIMAL(10,2) DEFAULT NULL COMMENT '倍数',
  `amount` DECIMAL(12,2) NOT NULL COMMENT '补助金额',
  `settlement_detail` JSON DEFAULT NULL COMMENT '核算明细JSON',
  `settlement_status` VARCHAR(32) NOT NULL DEFAULT 'GENERATED' COMMENT '核算状态: GENERATED/CONFIRMED/EXPORTED',
  `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_application_id` (`application_id`),
  KEY `idx_target_user_id` (`target_user_id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_settlement_type` (`settlement_type`),
  KEY `idx_settlement_status` (`settlement_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='补助核算表';


CREATE TABLE IF NOT EXISTS `msg_notification_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `application_id` BIGINT DEFAULT NULL COMMENT '关联申请单ID',
  `receiver_user_id` BIGINT NOT NULL COMMENT '接收人用户ID',
  `notify_type` VARCHAR(32) NOT NULL COMMENT '通知类型: APPROVAL/DISPATCH/CONFIRM/REMINDER',
  `channel` VARCHAR(32) NOT NULL DEFAULT 'FEISHU' COMMENT '发送渠道',
  `content_summary` VARCHAR(500) DEFAULT NULL COMMENT '内容摘要',
  `send_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '发送状态: PENDING/SENT/FAILED',
  `retry_count` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
  `sent_at` DATETIME DEFAULT NULL COMMENT '发送时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_application_id` (`application_id`),
  KEY `idx_receiver_user_id` (`receiver_user_id`),
  KEY `idx_notify_type` (`notify_type`),
  KEY `idx_send_status` (`send_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通知记录表';


CREATE TABLE IF NOT EXISTS `sys_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_group` VARCHAR(64) NOT NULL COMMENT '配置分组',
  `config_key` VARCHAR(128) NOT NULL COMMENT '配置键',
  `config_value` JSON NOT NULL COMMENT '配置值JSON',
  `config_status` VARCHAR(32) NOT NULL DEFAULT 'ENABLED' COMMENT '配置状态: ENABLED/DISABLED',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_group_key` (`config_group`, `config_key`),
  KEY `idx_config_status` (`config_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置表';


CREATE TABLE IF NOT EXISTS `sys_sync_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sync_type` VARCHAR(32) NOT NULL COMMENT '同步类型: USER/DEPARTMENT',
  `source_system` VARCHAR(32) NOT NULL COMMENT '来源系统: FEISHU/OA',
  `sync_status` VARCHAR(32) NOT NULL COMMENT '同步状态: SUCCESS/FAILED/PARTIAL_SUCCESS',
  `sync_count` INT DEFAULT NULL COMMENT '同步条数',
  `error_message` VARCHAR(2000) DEFAULT NULL COMMENT '错误信息',
  `started_at` DATETIME DEFAULT NULL COMMENT '开始时间',
  `finished_at` DATETIME DEFAULT NULL COMMENT '结束时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_sync_type` (`sync_type`),
  KEY `idx_source_system` (`source_system`),
  KEY `idx_sync_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='同步日志表';


CREATE TABLE IF NOT EXISTS `sys_integration_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `biz_type` VARCHAR(32) NOT NULL COMMENT '业务类型: APPROVAL/MESSAGE/LOGIN/SYNC',
  `biz_id` VARCHAR(128) DEFAULT NULL COMMENT '业务主键, 如申请单号或审批实例号',
  `request_url` VARCHAR(500) DEFAULT NULL COMMENT '请求地址',
  `request_payload` JSON DEFAULT NULL COMMENT '请求报文JSON',
  `response_payload` JSON DEFAULT NULL COMMENT '响应报文JSON',
  `call_status` VARCHAR(32) NOT NULL COMMENT '调用状态: SUCCESS/FAILED',
  `error_message` VARCHAR(2000) DEFAULT NULL COMMENT '错误信息',
  `called_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '调用时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  KEY `idx_biz_type` (`biz_type`),
  KEY `idx_biz_id` (`biz_id`),
  KEY `idx_call_status` (`call_status`),
  KEY `idx_called_at` (`called_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='集成调用日志表';


CREATE TABLE IF NOT EXISTS `sys_calendar_day` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `calendar_date` DATE NOT NULL COMMENT '日历日期',
  `year_no` INT NOT NULL COMMENT '年份',
  `month_no` INT NOT NULL COMMENT '月份',
  `day_no` INT NOT NULL COMMENT '日',
  `weekday_no` TINYINT NOT NULL COMMENT '星期, 1-7',
  `is_weekend` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否周末',
  `is_statutory_holiday` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否法定节假日',
  `is_adjusted_workday` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否调休工作日',
  `holiday_name` VARCHAR(64) DEFAULT NULL COMMENT '节假日名称',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` BIGINT DEFAULT NULL COMMENT '更新人',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_calendar_date` (`calendar_date`),
  KEY `idx_year_month` (`year_no`, `month_no`),
  KEY `idx_is_weekend` (`is_weekend`),
  KEY `idx_is_statutory_holiday` (`is_statutory_holiday`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='日历与节假日支撑表';


-- 建议后续按需补充:
-- 1. 附件表 sys_attachment / biz_attachment_relation
-- 2. 多版本消耗记录字段 version_no / is_latest
-- 3. 若需兼容OA流程编号, 可为 car_application 增加 external_process_no

