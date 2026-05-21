# 公务用车管理系统 · 开发规范

## 技术栈
- 前端：React 19 + TypeScript + Vite + Ant Design 5
- 后端：Express + TypeScript (tsx 热重载)
- 存储：JSON 文件存储 (data/*.json)，生产环境切换 MySQL
- OCR：tesseract.js（水印时间提取 + 里程数识别）
- 节假日：timor.tech 免费 API 自动获取（含国务院调休），内存缓存
- 端口：前端 5173，后端 8080

## 启动方式
```bash
# 前端
cd apps/web && npm run dev

# 后端
cd apps/server && npm run dev

# 同时启动
npm run dev
```

## 目录结构
```
apps/
  web/          # React 前端
    src/pages/   # 页面组件
    src/api/     # API 调用 (index.ts 导出所有 API)
    src/layouts/ # 布局组件
  server/       # Express 后端
    src/routes/  # API 路由（每个模块一个文件）
    src/db/      # 数据层 (database.ts + seed.ts)
    src/middleware/ # 中间件 (auth.ts)
    data/        # JSON 数据文件 + uploads/ 照片目录
  agent/        # Python Agent（预留）
sql/            # MySQL 生产环境建表脚本
infra/          # Docker/Nginx 配置
docs/           # 需求与设计文档（V1 设计阶段产物，实际实现见本文件和代码）
```

## API 路由清单
| 模块 | 路径前缀 | 关键端点 |
|------|---------|---------|
| auth | /api/auth | GET /me, GET /feishu/auth-url, GET /feishu/callback, GET /feishu/entry (飞书应用主页SSO), POST /feishu/login, POST /feishu/callback |
| users | /api/users | GET /, GET /todo-summary, GET /simple, PUT /:id (角色/状态编辑，仅系统管理员), DELETE /:id (仅系统管理员) |
| departments | /api/departments | GET /tree, GET /:id/approver |
| vehicles | /api/vehicles | CRUD + GET /available |
| drivers | /api/drivers | CRUD + GET /available |
| applications | /api/applications | CRUD + POST /:id/submit, /:id/cancel, /:id/change, DELETE /:id (系统管理员软删除) |
| approvals | /api/approvals | GET /pending, POST /:id/approve, /:id/reject |
| dispatches | /api/dispatches | GET /pending, POST /, PUT /:id/reassign, POST /:id/start |
| consumptions | /api/consumptions | CRUD + GET /my-dispatches, GET /export, POST /upload-photo, POST /ocr-photo, POST /:id/confirm, POST /:id/admin-confirm, POST /:id/reject, DELETE /:id |
| subsidies | /api/subsidies | GET /rules, PUT /rules/:id, POST /calculate/private-car, POST /calculate/driver, GET /driver-overtime-summary, GET /settlements, DELETE /settlements/:id, GET /settlements/export |
| dashboard | /api/dashboard | GET /summary, GET /trend |
| notifications | /api/notifications | CRUD + GET /unread-count, PUT /:id/read |
| feishu | /api/feishu | GET /org-tree (递归完整组织架构), POST /sync-org (支持 department_ids/user_open_ids 过滤范围), POST /import-drivers (选中飞书用户导入司机), POST /create-approval, POST /send-message |
| init | /api/init | GET / (数据库初始化) |
| configs | /api/configs | 系统配置 |
| health | /api/health | 健康检查 |

## 编码约定
- 后端 API 统一返回 `{ code: 0, data: ... }` 或 `{ code: 非0, message: "..." }`
- 前端 API 调用统一通过 `src/api/index.ts` 导出
- 页面组件放在 `src/pages/`，一个文件一个页面
- 开发模式用 `x-user-id` header 模拟登录，传用户 ID（数字），无需真实 token
- 测试账号：admin(1) / manager(2) / emp01(3) / l1_approver(4) / driver01(5) / vp001(6)

## 状态流转
- 普通申请：DRAFT → PENDING_L1(直属上级) → PENDING_L2(行政经理) → PENDING_DISPATCH → RESERVED → IN_PROGRESS → PENDING_CONFIRM → PENDING_L2_CONFIRM → COMPLETED
- 长途>300km：DRAFT → PENDING_L1(直属上级) → PENDING_L2(常务副总裁) → PENDING_L3(行政经理) → PENDING_DISPATCH → ...（同上）
- 司机提前收车：IN_PROGRESS 时司机点击"已返回" → 派车单 COMPLETED、车辆/司机释放，申请单同步推进到 PENDING_CONFIRM（等待后补录消耗）。超时30分钟系统自动收车同样触发此流转。

## 角色清单
| 角色 | 值 | 说明 |
|------|----|------|
| 系统管理员 | SYSTEM_ADMIN | 全部权限 |
| 行政经理 | ADMIN_MANAGER | 派车、审批、管理 |
| 常务副总裁 | SENIOR_VP | 长途>300km的二级审批 |
| 一级审批人 | L1_APPROVER | 申请人的直属上级（从飞书用户 leader_user_id 解析） |
| 二级审批人 | L2_APPROVER | 行政级审批 |
| 司机 | DRIVER | 出车/收车/录入消耗 |
| 普通员工 | EMPLOYEE | 发起申请 |

## 审批人加载逻辑
- 直属上级（L1）：飞书同步时存储用户 leader_user_id → leader_open_id，同步后解析为本地 leader_user_id。选择用车人后从用户 leader_user_id 查找直属上级，无直属上级时回退到部门负责人
- 行政经理（L2/L3）：系统查找 role=ADMIN_MANAGER 的用户
- 常务副总裁（L2 长途）：系统查找 role=SENIOR_VP 的用户，仅当 is_long_distance_300km=true 时启用

## 补助核算规则
### 私车公用（is_long_distance 决定单价）
- 消耗录入时填报人选择"单程是否超过100公里"（仅私车类型显示，必填）
- 核算时直接读取 is_long_distance 字段：
  - is_long_distance=true → 1.0元/km
  - is_long_distance=false → 0.8元/km
- 过路过桥费、停车费据实报销，不重复计算

### 司机加班（季节×日期类型×时段窗口×倍数）
- 冬季(10-4月): 早<8:30, 午12-13, 晚>17:30
- 夏季(5-9月): 早<8:30, 午12-13:30, 晚>18:00
- 工作日只算加班窗口内时长(+出车前1h+收车后1h)，×1
- 周末全部时长(+出车前1h+收车后1h)，×2
- 法定节假日全部时长(+出车前1h+收车后1h)，×3
- 节假日通过 timor.tech API 自动获取（含国务院调休安排）
- 核算结果推送人资，系统不直接计算金额

## 照片上传与 OCR
- 上传：POST /api/consumptions/upload-photo (base64)
- 存储：data/uploads/，通过 /uploads 路径静态访问
- Vite 开发代理：/uploads → localhost:8080（vite.config.ts 已配置）
- OCR：POST /api/consumptions/ocr-photo
  - 水印时间提取：OCR 文字中匹配日期/时间模式
  - EXIF 时间提取：JPEG 二进制解析 DateTimeOriginal 标签
  - 里程提取：tesseract.js eng 语言包，过滤年份后取最大5-6位数字
  - 前端上传后自动调用 OCR，识别结果自动填入表单字段

## 前端页面清单（已实现）
| 页面 | 文件 | 路由 |
|------|------|------|
| 工作台 | Dashboard.tsx | / |
| 用车申请 | MyApplications.tsx | /my-applications |
| 申请详情 | ApplicationDetail.tsx | /applications/:id |
| 待派车 | DispatchPage.tsx | /dispatch |
| 消耗管理 | ConsumptionPage.tsx | /consumptions |
| 车辆管理 | Vehicles.tsx | /vehicles |
| 司机管理 | Drivers.tsx | /drivers |
| 补助核算 | SubsidyPage.tsx | /subsidies |
| 用户管理 | Users.tsx | /users |
