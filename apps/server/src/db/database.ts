import fs from 'fs';
import path from 'path';
import { query, queryOne, execute, getPool } from './connection';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_TYPE = process.env.DB_TYPE || 'json';

// ============================================================
// 统一异步接口
// ============================================================
interface Store<T extends { id?: number; is_deleted?: number }> {
  all(): Promise<T[]>;
  find(predicate: (row: T) => boolean): Promise<T[]>;
  findOne(predicate: (row: T) => boolean): Promise<T | undefined>;
  findById(id: number): Promise<T | undefined>;
  insert(row: Omit<T, 'id'>): Promise<T>;
  update(id: number, updates: Partial<T>): Promise<T | undefined>;
  softDelete(id: number): Promise<boolean>;
  count(predicate?: (row: T) => boolean): Promise<number>;
  flush?(): void; // JSON only
}

// ============================================================
// JSON 文件存储（开发模式）
// ============================================================
class JsonStore<T extends { id?: number; is_deleted?: number }> implements Store<T> {
  private data: T[] = [];
  private nextId = 1;
  private filePath: string;
  private dirty = false;

  constructor(name: string) {
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.load();
    setInterval(() => this.flush(), 5000);
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        const maxId = this.data.reduce((max, r) => Math.max(max, r.id || 0), 0);
        this.nextId = maxId + 1;
      }
    } catch { this.data = []; }
  }

  flush() {
    if (!this.dirty) return;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.dirty = false;
    } catch { /* ignore */ }
  }

  async all(): Promise<T[]> { return [...this.data]; }
  async find(predicate: (row: T) => boolean): Promise<T[]> { return this.data.filter(predicate); }
  async findOne(predicate: (row: T) => boolean): Promise<T | undefined> { return this.data.find(predicate); }
  async findById(id: number): Promise<T | undefined> { return this.data.find(r => r.id === id); }

  async insert(row: Omit<T, 'id'>): Promise<T> {
    const newRow = { ...row, id: this.nextId++ } as T;
    this.data.push(newRow);
    this.dirty = true;
    return newRow;
  }

  async update(id: number, updates: Partial<T>): Promise<T | undefined> {
    const idx = this.data.findIndex(r => r.id === id);
    if (idx === -1) return undefined;
    this.data[idx] = { ...this.data[idx], ...updates, id };
    this.dirty = true;
    return this.data[idx];
  }

  async softDelete(id: number): Promise<boolean> {
    const idx = this.data.findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.data[idx] = { ...this.data[idx], is_deleted: 1 } as T;
    this.dirty = true;
    return true;
  }

  async count(predicate?: (row: T) => boolean): Promise<number> {
    return predicate ? this.data.filter(predicate).length : this.data.length;
  }
}

// ============================================================
// MySQL 存储（生产模式）
// ============================================================
class MysqlStore<T extends { id?: number; is_deleted?: number }> implements Store<T> {
  private tableName: string;

  constructor(name: string) {
    this.tableName = name;
  }

  async all(): Promise<T[]> {
    const rows = await query(`SELECT * FROM \`${this.tableName}\` WHERE is_deleted = 0`);
    return rows as T[];
  }

  async find(predicate: (row: T) => boolean): Promise<T[]> {
    const rows = await query(`SELECT * FROM \`${this.tableName}\` WHERE is_deleted = 0`);
    return (rows as T[]).filter(predicate);
  }

  async findOne(predicate: (row: T) => boolean): Promise<T | undefined> {
    const rows = await query(`SELECT * FROM \`${this.tableName}\` WHERE is_deleted = 0`);
    return (rows as T[]).find(predicate);
  }

  async findById(id: number): Promise<T | undefined> {
    const row = await queryOne(`SELECT * FROM \`${this.tableName}\` WHERE id = ? AND is_deleted = 0`, [id]);
    return row as T | undefined;
  }

  async insert(row: Omit<T, 'id'>): Promise<T> {
    const keys = Object.keys(row as any).filter(k => (row as any)[k] !== undefined);
    const values = keys.map(k => (row as any)[k]);
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.map(k => `\`${k}\``).join(', ');

    const { insertId } = await execute(
      `INSERT INTO \`${this.tableName}\` (${columns}) VALUES (${placeholders})`,
      values
    );

    const inserted = await queryOne(`SELECT * FROM \`${this.tableName}\` WHERE id = ?`, [insertId]);
    return (inserted || { ...row, id: insertId }) as T;
  }

  async update(id: number, updates: Partial<T>): Promise<T | undefined> {
    const keys = Object.keys(updates as any).filter(k => (updates as any)[k] !== undefined && k !== 'id');
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map(k => `\`${k}\` = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);

    await execute(`UPDATE \`${this.tableName}\` SET ${setClauses} WHERE id = ?`, [...values, id]);
    return this.findById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    const { affectedRows } = await execute(
      `UPDATE \`${this.tableName}\` SET is_deleted = 1 WHERE id = ?`, [id]
    );
    return affectedRows > 0;
  }

  async count(predicate?: (row: T) => boolean): Promise<number> {
    if (!predicate) {
      const row = await queryOne(`SELECT COUNT(*) as cnt FROM \`${this.tableName}\` WHERE is_deleted = 0`);
      return (row as any)?.cnt || 0;
    }
    const all = await this.all();
    return all.filter(predicate).length;
  }
}

// ============================================================
// 全局实例管理
// ============================================================
const stores: Record<string, Store<any>> = {};

function getStore<T extends { id?: number; is_deleted?: number }>(name: string): Store<T> {
  if (!stores[name]) {
    stores[name] = DB_TYPE === 'mysql' ? new MysqlStore<T>(name) : new JsonStore<T>(name);
  }
  return stores[name];
}

// 刷新所有 JSON 存储（开发模式优雅关闭）
function flushAll(): void {
  for (const store of Object.values(stores)) {
    if (store instanceof JsonStore) store.flush();
  }
}

// ============================================================
// MySQL 表初始化
// ============================================================
async function initMysqlTables(): Promise<void> {
  if (DB_TYPE !== 'mysql') return;

  const pool = getPool();
  const tables = [
    `CREATE TABLE IF NOT EXISTS sys_user (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      open_id VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      employee_no VARCHAR(32) DEFAULT NULL,
      mobile VARCHAR(20) DEFAULT NULL,
      email VARCHAR(128) DEFAULT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE',
      department_id BIGINT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uk_open_id (open_id),
      KEY idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sys_department (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      parent_id BIGINT DEFAULT NULL,
      name VARCHAR(128) NOT NULL,
      feishu_department_id VARCHAR(64) DEFAULT NULL,
      manager_id BIGINT DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_vehicle (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      plate_number VARCHAR(16) NOT NULL,
      brand VARCHAR(64) DEFAULT NULL,
      model VARCHAR(64) DEFAULT NULL,
      color VARCHAR(16) DEFAULT NULL,
      seats INT DEFAULT NULL,
      vehicle_type VARCHAR(32) NOT NULL DEFAULT 'SEDAN',
      fuel_type VARCHAR(16) DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by BIGINT DEFAULT NULL,
      updated_by BIGINT DEFAULT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uk_plate_number (plate_number),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_driver (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      name VARCHAR(64) NOT NULL,
      license_type VARCHAR(8) DEFAULT NULL,
      mobile VARCHAR(20) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
      hired_date DATE DEFAULT NULL,
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by BIGINT DEFAULT NULL,
      updated_by BIGINT DEFAULT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_user_id (user_id),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_application (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_no VARCHAR(32) NOT NULL,
      application_type VARCHAR(16) NOT NULL,
      applicant_id BIGINT NOT NULL,
      applicant_name VARCHAR(64) NOT NULL,
      applicant_department_id BIGINT NOT NULL,
      applicant_department_name VARCHAR(128) DEFAULT NULL,
      departure_at DATETIME NOT NULL,
      return_at DATETIME NOT NULL,
      origin VARCHAR(256) NOT NULL,
      destination VARCHAR(256) NOT NULL,
      passenger_count INT NOT NULL DEFAULT 1,
      reason VARCHAR(512) NOT NULL,
      l1_approver_id BIGINT DEFAULT NULL,
      l1_approver_name VARCHAR(64) DEFAULT NULL,
      l2_approver_id BIGINT DEFAULT NULL,
      l2_approver_name VARCHAR(64) DEFAULT NULL,
      l1_approved_at DATETIME DEFAULT NULL,
      l2_approved_at DATETIME DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      cancelled_at DATETIME DEFAULT NULL,
      cancelled_by BIGINT DEFAULT NULL,
      cancel_reason VARCHAR(256) DEFAULT NULL,
      change_from_id BIGINT DEFAULT NULL,
      change_reason VARCHAR(256) DEFAULT NULL,
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by BIGINT DEFAULT NULL,
      updated_by BIGINT DEFAULT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uk_application_no (application_no),
      KEY idx_applicant_id (applicant_id),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_application_operation_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_id BIGINT NOT NULL,
      operation VARCHAR(32) NOT NULL,
      operator_id BIGINT NOT NULL,
      operator_name VARCHAR(64) NOT NULL,
      from_status VARCHAR(32) DEFAULT NULL,
      to_status VARCHAR(32) DEFAULT NULL,
      detail VARCHAR(1024) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_application_id (application_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_approval_record (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_id BIGINT NOT NULL,
      feishu_approval_code VARCHAR(64) DEFAULT NULL,
      approval_level VARCHAR(8) NOT NULL,
      approver_id BIGINT NOT NULL,
      approver_name VARCHAR(64) NOT NULL,
      action VARCHAR(16) DEFAULT NULL,
      comment VARCHAR(1024) DEFAULT NULL,
      acted_at DATETIME DEFAULT NULL,
      sync_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      raw_callback JSON DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_application_id (application_id),
      KEY idx_approver_id (approver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_dispatch_record (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_id BIGINT NOT NULL,
      vehicle_id BIGINT NOT NULL,
      vehicle_plate VARCHAR(16) NOT NULL,
      driver_id BIGINT NOT NULL,
      driver_name VARCHAR(64) NOT NULL,
      dispatched_by BIGINT NOT NULL,
      dispatched_by_name VARCHAR(64) NOT NULL,
      dispatch_type VARCHAR(16) NOT NULL DEFAULT 'ORIGINAL',
      previous_dispatch_id BIGINT DEFAULT NULL,
      actual_departure_at DATETIME DEFAULT NULL,
      actual_return_at DATETIME DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'RESERVED',
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_application_id (application_id),
      KEY idx_vehicle_id (vehicle_id),
      KEY idx_driver_id (driver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_consumption_record (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_id BIGINT NOT NULL,
      record_type VARCHAR(16) NOT NULL,
      fuel_amount DECIMAL(10,2) DEFAULT NULL,
      start_mileage DECIMAL(10,2) DEFAULT NULL,
      end_mileage DECIMAL(10,2) DEFAULT NULL,
      actual_mileage DECIMAL(10,2) DEFAULT NULL,
      toll_amount DECIMAL(10,2) DEFAULT NULL,
      parking_amount DECIMAL(10,2) DEFAULT NULL,
      other_amount DECIMAL(10,2) DEFAULT NULL,
      nav_mileage DECIMAL(10,2) DEFAULT NULL,
      nav_source VARCHAR(256) DEFAULT NULL,
      total_amount DECIMAL(12,2) DEFAULT NULL,
      recorded_by BIGINT NOT NULL,
      recorded_by_name VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING_CONFIRM',
      confirmed_by BIGINT DEFAULT NULL,
      confirmed_by_name VARCHAR(64) DEFAULT NULL,
      confirmed_at DATETIME DEFAULT NULL,
      reject_reason VARCHAR(256) DEFAULT NULL,
      attachments JSON DEFAULT NULL,
      departure_photo_url VARCHAR(500) DEFAULT NULL,
      return_photo_url VARCHAR(500) DEFAULT NULL,
      departure_photo_time DATETIME DEFAULT NULL,
      return_photo_time DATETIME DEFAULT NULL,
      time_source VARCHAR(32) DEFAULT NULL,
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_application_id (application_id),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_subsidy_rule (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      rule_name VARCHAR(128) NOT NULL,
      rule_type VARCHAR(32) NOT NULL,
      unit_price DECIMAL(10,4) NOT NULL,
      unit VARCHAR(16) NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE DEFAULT NULL,
      min_value DECIMAL(10,2) DEFAULT NULL,
      max_value DECIMAL(10,2) DEFAULT NULL,
      description VARCHAR(256) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS car_subsidy_settlement (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      application_id BIGINT NOT NULL,
      settlement_type VARCHAR(32) NOT NULL,
      approved_mileage DECIMAL(10,2) DEFAULT NULL,
      mileage_unit_price DECIMAL(10,4) DEFAULT NULL,
      mileage_subsidy DECIMAL(12,2) DEFAULT NULL,
      total_subsidy DECIMAL(12,2) NOT NULL,
      driver_trip_count INT DEFAULT NULL,
      driver_trip_subsidy DECIMAL(12,2) DEFAULT NULL,
      rule_snapshot JSON DEFAULT NULL,
      calculated_by BIGINT NOT NULL,
      calculated_by_name VARCHAR(64) NOT NULL,
      calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(32) NOT NULL DEFAULT 'CALCULATED',
      remark VARCHAR(512) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_application_id (application_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS msg_notification_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      recipient_id BIGINT NOT NULL,
      recipient_name VARCHAR(64) NOT NULL,
      notification_type VARCHAR(32) NOT NULL,
      title VARCHAR(256) NOT NULL,
      content TEXT NOT NULL,
      channel VARCHAR(16) NOT NULL DEFAULT 'IN_APP',
      send_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      send_at DATETIME DEFAULT NULL,
      fail_reason VARCHAR(512) DEFAULT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_recipient_id (recipient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sys_config (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      config_key VARCHAR(64) NOT NULL,
      config_value TEXT NOT NULL,
      config_type VARCHAR(16) NOT NULL DEFAULT 'STRING',
      description VARCHAR(256) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_config_key (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sys_integration_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      integration_type VARCHAR(32) NOT NULL,
      request_url VARCHAR(512) DEFAULT NULL,
      request_body JSON DEFAULT NULL,
      response_body JSON DEFAULT NULL,
      status_code INT DEFAULT NULL,
      duration_ms INT DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
      error_message VARCHAR(1024) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const sql of tables) {
    await pool.execute(sql);
  }
  console.log('[db] MySQL tables initialized');
}

// Express 扩展类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        open_id: string;
        name: string;
        role: string;
        department_id: number;
      };
    }
  }
}

export { JsonStore, MysqlStore, getStore, initMysqlTables, flushAll, DB_TYPE };
export type { Store };
