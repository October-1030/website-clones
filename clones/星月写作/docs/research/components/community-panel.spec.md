# CommunityPanel

Target: src/components/CommunityPanel.tsx. Screenshot: docs/design-references/original-desktop.png.
Interaction model: click-driven actions; independent vertical native scrolling. No scroll animation.
At 1440×900 the panel is x1144 y121, 280px wide and fills available height (744px).
It is hidden below 1200px; main content owns responsive layout.
Container: background #f8fafc, border .8px #cbd5e1, radius16px, shadow 0 8px 24px rgba(55,65,81,.12).
Header: height42.8px; padding6px 12px; title 网文社区,16px bold,#27313e; flex buttons 我要分享 and 更多,14px; chevron icon before each.
Scroll body: padding 10px; signup banner 64px high,purple tinted #eee9fb,rounded16px,border1px #ded9ec. Purple40px icon tile; title 每日签到领福利,14px bold; subtitle 签到可领取更多奖励,11px gray; right 去签到 arrow,12px purple.
Article buttons use 14px/21px text, padding10px 6px, bottom1px #f0f1f5; two-line clamp. First two rows purple #7366df with purple pin; remaining rows #27313e with tiny purple dot.
Bottom centered 查看更多. Hover article text purple; transition color .2s.
Provide props onArticle(title:string),onShare(),onMore(),onCheckIn(). No external requests, no account data.
Use Tailwind utilities and CSS variables defined by foundation; no inline styles; named export, strict TS.
Verbatim article titles:
【故事】8.20日更新【全模型测评】总结，选取建议，新人入门，老手进阶，不再选择困难
版规-使用论坛之前必看，否则可能会永久封号
现在开新书，各位大佬的数据怎么样啊？
侧边栏显示不全，提个小建议
前文关联建议！！！
写作关联
【最新优化审稿4.0】效果爆炸，准确识别内容的每一个设定、伏笔、逻辑关系，完美查缺补漏，不崩人设！
【月澜天歌】新更新的封面提示词，效果爆炸级提升，简单明了上手快，只需简单限制一下便可得到满意的封面
【月澜天歌】一本书如何用最简单的方法写出爆款开头和真人味十足的内容？邪修方案告诉你
【月澜天歌】更新提示词炸出来了忠实粉丝，智慧5.6模型直出两万字0AI率，月入15000续写提示词
咱星月能不能也把备忘录，生成的大纲做成这样的主题？
【自用长篇全流程公开！简单实用！】
我收到了共用账号的警告
能不能出一个作品当日已打卡或者已更新的选项
【米丢】❤️分享两个用来做自媒体之类的提示词、公众号、xhs、今日头条；另一个是用来写宣传片剧本的❤
求求了！工作流能不能增加提示词的字数上限？
【青蛙】朱雀人工率100%的续写提示词，免审稿免去痕，不好用回来打我
【AI去痕】朱雀100%人工率的AI去痕提示词
桀桀桀桀，道爷俺成了！
反映个拆书字数的问题
