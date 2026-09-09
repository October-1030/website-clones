# BookDialog

Target src/components/BookDialog.tsx; reference original-create.png and create-dialog.json.
Centered600px dialog on#0006 backdrop; surface#f8fafc,radius20px,padding16px; title16px. Title field36px,border#cbd5e1,radius3px,focused#55759b. Two64px high type options,12px gap,radius13px; selected border2px#8082e6. Description textarea80px; rounded primary submit. Mobile viewport-24px.
Text: 创建作品后可使用AI功能; 作品名称*; 请输入作品名称; 作品类型; 不同类型将启用对应的AI创作工具与提示词; 小说/章纲·正文·续写; 剧本/集纲·场景·对白; 作品简介（选填。不影响AI生成内容）; 请输入作品简介; 高级设置; 提交.
Default title新建作品,max30; description max500. Type selection click-driven. Submit adds a local book, never transmits to source site. Input validation disallows whitespace-only titles. Advanced section is a local capability explanation rather than unobserved original backend options.
