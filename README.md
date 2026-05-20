# 公务用车管理系统

## 项目简介

本项目是独立的公务用车管理 Web 系统，覆盖公务用车与私车公用的申请、审批、派车、执行、确认、核算与分析全流程，通过飞书提供统一入口、审批触达与消息通知能力。

项目的长期目标不是单纯替换一个审批表单，而是为后续 Agent 落地提供稳定、结构化、可执行的业务底座，逐步减少行政经理在派车、催办、核验、核算等环节上的人工工作量。

## 当前阶段

**第一版代码已可运行。** 前后端均在本地开发环境中正常启动，覆盖以下能力：

- 用车申请（公务/私车）与状态流转
- 飞书 OAuth 真实登录（自动注册 + 组织架构同步）
- 审批流程（飞书审批实例创建 + 回调处理）
- 车辆与司机档案管理
- 派车与冲突校验
- 消耗录入与双审确认（用车人确认 → 行政经理复核，含水印照片上传 + OCR）
- 私车公用里程补助核算（is_long_distance 决定单价）
- 司机加班核算（季节×日期类型×时段窗口×倍数）
- 节假日自动识别（timor.tech API，含国务院调休）
- 工作台看板与通知
- MySQL 生产模式支持（JSON 开发 / MySQL 生产，通过 DB_TYPE 环境变量切换）

实际技术栈与设计文档存在差异（见下方说明）。

## 实际技术栈

| 层 | 实际使用 | 设计文档(V1) |
|---|---------|-------------|
| 前端 | React 19 + TypeScript + Vite + Ant Design 5 | React + TypeScript + Vite + Ant Design |
| 后端 | Express + TypeScript (tsx) | Java 21 + Spring Boot 3.5 |
| 存储 | JSON 文件 (data/*.json) | MySQL 8.0 |
| OCR | tesseract.js | 未涉及 |
| 节假日 | timor.tech API | 未涉及 |

> **说明**：V1 设计文档在代码实现前编写，当时推荐 Java/Spring Boot + MySQL。实际开发中为快速出 MVP，选用了 Express + TypeScript + JSON 文件存储。数据库切换至 MySQL 的计划保留，详见 sql/ 目录下的建表脚本。**CLAUDE.md 是当前实现的最新参考。**

## 开发相关

- 开发规范、路由清单、编码约定：见 [CLAUDE.md](CLAUDE.md)
- 启动方式：`cd apps/web && npm run dev`（前端 5173）+ `cd apps/server && npm run dev`（后端 8080）
- 测试账号：admin(1) / manager(2) / emp01(3) / l1_approver(4) / driver01(5)
- 开发模式通过 `x-user-id` header 模拟登录

## 文档目录

所有 V1/V2 设计文档已归档至 `docs/design/`，详见 [docs/README.md](docs/README.md)。

> **注意**：设计文档基于 Java/Spring Boot/MySQL 编写，实际实现为 Express + TypeScript + JSON。业务规则和流程设计仍有参考价值，技术细节以 [CLAUDE.md](CLAUDE.md) 和代码为准。

### 快速索引

| 文档 | 说明 |
|------|------|
| [docs/design/需求冻结清单与未决事项V1.md](docs/design/需求冻结清单与未决事项V1.md) | 第一期范围冻结与关键决策 |
| [docs/design/业务规则清单V1.md](docs/design/业务规则清单V1.md) | 业务规则字典（最常参考） |
| [docs/design/接口设计文档V1.md](docs/design/接口设计文档V1.md) | API 清单与字段定义（合并版） |
| [docs/design/数据模型设计文档V1.md](docs/design/数据模型设计文档V1.md) | 实体关系与表结构（合并版） |
| [docs/design/页面清单与页面原型定稿V2.md](docs/design/页面清单与页面原型定稿V2.md) | 页面规格 |
| [docs/design/飞书与OA集成设计说明V2.md](docs/design/飞书与OA集成设计说明V2.md) | 飞书集成方案 |
| [docs/design/核心流程图与状态机V1.md](docs/design/核心流程图与状态机V1.md) | Mermaid 流程图与状态机 |
| [docs/design/系统架构与流程边界V1.md](docs/design/系统架构与流程边界V1.md) | 系统边界与架构设计 |
| [docs/design/需求分析文档V1.md](docs/design/需求分析文档V1.md) | 功能模块与角色权限 |
| [docs/design/测试与验收方案V1.md](docs/design/测试与验收方案V1.md) | 验收场景与检查清单 |

### 原始需求

- [公务用车管理系统PRD.docx](公务用车管理系统PRD.docx)

## 第一阶段交付范围（当前状态）

- [x] 飞书入口与身份识别（OAuth 真实登录）
- [x] 车辆和司机档案管理
- [x] 用车申请（含变更申请）
- [x] 飞书审批集成（真实审批实例创建 + 回调处理）
- [x] 派车与冲突校验
- [x] 公务用车消耗录入与双审确认
- [x] 私车公用录入与行政核验
- [x] 私车公用补助核算（is_long_distance 决定单价）
- [x] 司机补助核算（季节×日期类型×时段窗口×倍数）
- [x] 基础看板和通知
- [x] 飞书组织架构真实同步
- [x] 生产环境 MySQL 切换（MysqlStore 已实现，DB_TYPE 切换）
- [ ] Agent 能力接入
