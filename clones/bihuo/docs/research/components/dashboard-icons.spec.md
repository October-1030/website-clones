# 仪表盘SVG图标

来源：dashboard-svg.json，原站实际渲染的DOM SVG。scripts/extract-icons.mjs生成TypeScript名字映射和命名导出DashIcon。

按原viewBox、path、stroke、fill保留几何。尺寸1em，currentColor继承调用方；图标容器inline-flex并隐藏于辅助技术，交互名称由外层按钮提供。无字体、无远程图标请求、无运行时字符串HTML注入。

包含侧栏、顶栏、工作流、分析空态、工具和帮助图标；具体名称见DashIconName类型。不同组件按原始测量设置15、17、18、20、26px等尺寸。
