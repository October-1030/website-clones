# 本地hash路由入口

本地结构组件，无独立视觉。useSyncExternalStore订阅hashchange，SSR默认仪表盘，#/auth/*切换AuthApp，其余路径为DashboardApp。保留原站hash URL形式。

已实现#/dashboard、#/auth/login、#/auth/register。其他业务链接由仪表盘展示演示说明，不编造后台页面。无session、token、cookie、账号密码或聊天持久化。无外部资源。
