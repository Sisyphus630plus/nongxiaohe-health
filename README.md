# 农小禾健康 Agent

面向大学生与年轻人群的 AI 健康生活助手。原生 HTML/CSS/JS 单页应用，提供「可离线运行的本地版」与「云端版」两种形态。

## 功能
- 注册 / 登录（手机号 + 密码，二次验证码演示值 888888）
- 健康自测 → 评分模型 + 规则引擎生成运动 / 饮食 / 作息方案
- 双模式：健身模式 / 健康模式，各 4 页
- 健康档案、打卡积分、农小禾慧选商城积分兑换、社区广场互动
- 管理员：产品增删改、用户档案与购物车查看、搜索

## 目录
- `docs/index.html` — 可离线运行的单文件演示版（GitHub Pages 入口，无外部依赖）
- `source/` — 云端版源码（入口 `index.html`，依赖 WorkBuddy Cloud SDK，需在绑定应用内运行）

## 在线地址
- 本地版（干净链接，GitHub Pages）：部署后见仓库 Pages
- 云端完整版：https://nongxiaohe-health.app.workbuddy.host/?sharecode=4PXAEFKUYL

## 技术栈
- 前端：原生 HTML / CSS / JavaScript，hash 路由
- 云端：PostgreSQL + 行级安全（RLS）+ 只读 RPC（SECURITY DEFINER）
- 数据：业务数据存云端，浏览器仅保存会话令牌

## 演示边界
- 验证码为本地演示固定值 888888，不发送真实短信
- AI 问答与方案基于规则引擎生成，仅供健康记录参考，不构成医疗诊断
