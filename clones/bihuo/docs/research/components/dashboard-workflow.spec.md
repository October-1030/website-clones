# 工作流和工具底栏

参考desktop/bottom截图，原站rail与console-footer样式。

工作流卡padding28px，标题18/28，header底padding4、margin-bottom28；四组3/3/3/1节点、组间24px和虚线，阶段标签12px等宽、tracking.16em。节点图标52×52、radius8、accent8%底色，18px图标。编号12/18、标签14/21，节点gap8.8px。hover底色accent16%、边accent45%。1200px以下两组一排；手机长标签ellipsis。

原站10个步骤的名称/图标/顺序保存在dashboard-data.ts。查看教程打开教程；步骤原站跳业务页，本地打开明确的演示说明。

底栏padding28px，gap24；992px以上右帮助列宽320px、左边线和32px padding。下载按钮padding12px13.6px、图标40px、文案15px/22.5、版本12px/18，没有文案行间gap。三项Windows1.8.4、Mac1.8.3、插件1.1.6.4。原站帮助按钮只有文字和右箭头，无左图标。手机堆叠。

导出DashboardWorkflow和DashboardFooter，二者共享同一数据模块。本地下载入口不下载软件；帮助打开教程。
