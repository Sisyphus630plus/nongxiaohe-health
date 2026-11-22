# 农小禾健康 · 一日三餐，顺时而食

面向大学生的 AI 健康配餐助手。6 个问题测出身体数据与口味偏好，按预算与忌口自动配好一周食谱，算到每一元；小禾 AI 记得你的口味，随时能聊。

## 功能
- 手机号登录（未注册自动建号；演示环境验证码在页面内显示）
- 6 问题问卷 → 定制一周健康方案（按预算、忌口、过敏、慢病禁忌配）
- 四大标签：陪伴 / 记录 / 慧选 / 我的
- 小禾 AI 对话（意图识别 + 大模型兜底）
- 慧选商城与心愿单
- 树洞社区（打卡 / 发帖 / 互动）
- 运营中台：慧选产品、健康档案、心愿单、订单、广场管理

## 目录
- `docs/index.html` — 应用入口
- `docs/css/app.css` — 样式
- `docs/js/app.js` — 路由与交互
- `docs/js/data.js` — 数据层
- `docs/js/engine.js` — 配餐 / 推荐 / 评分引擎
- `docs/js/chat.js` — 小禾 AI 对话（意图识别 + `/api/llm` 兜底）
- `docs/js/cloud.js` — WorkBuddy 云端数据同步
- `docs/img/` — 图片资源

## 运行
以 `docs/` 为站点根目录，入口 `index.html`。完整功能需要：
- WorkBuddy Cloud SDK（CDN 引入）
- 后端 `/api/llm`（AI 对话）
- 云端数据表 `nxh_docs`（WorkBuddy 云服务）

## 线上
https://nongxiaohe-health-35480.app.workbuddy.host/?sharecode=NAANFN6TIT
