"use client";

import { useEffect, useRef, useState } from "react";

type ProductKey = "web" | "mobile" | "extension" | "library" | "agent";

type Product = {
  key: ProductKey;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  label: string;
};

const navGroups = [
  { label: "学生专区", columns: [["LMS 集成", "Canvas", "Blackboard", "Brightspace", "Moodle", "Everytime", "Echo360", "CyberCampus"], ["大学与课程分析", "AskSia 图书馆", "澳大利亚专区", "美国专区"]] },
  { label: "实用工具", columns: [["实用工具", "速查表生成器", "效率工具包", "AI 计算器", "作业解答器", "转录与翻译", "AI摘要器", "AI导师"]] },
  { label: "资源", columns: [["资源", "博客", "帮助中心", "2026 白皮书", "新闻"]] },
];

const quickLinks = ["作业解答", "转录 & 翻译", "测验", "论文", "AI 检测", "AI Tutor", "College AI", "文件摘要", "YouTube 摘要", "闪卡", "课程导图", "速查表", "双重编码"];

const schoolLogos = [11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 30];
const exams = ["SAT", "ACT", "AP Exams", "GRE", "GMAT", "LSAT", "MCAT", "TOEFL", "IELTS", "TOEIC", "Duolingo English Test", "수능", "토익", "TOPIK", "KAT", "高考 Gaokao", "HSK", "普通話水平測試", "英語能力測驗", "Abitur", "TestDaF", "Telc Deutsch", "DSH", "Goethe-Zertifikat", "共通テスト", "JLPT N1", "英検", "漢字検定", "Baccalauréat", "DELF B2", "DALF C1", "TCF", "Brevet", "Selectividad EBAU", "DELE C2", "SIELE", "NEET", "JEE Advanced", "CAT", "UPSC", "Cambridge A-Levels", "IB Diploma", "GCSE", "Scottish Highers", "教育能力", "Gaokao 物理", "Kangaroo Math", "AMC 10/12"];

const products: Product[] = [
  { key: "web", eyebrow: "🖥 网页应用", title: "一切尽在一处。", description: "上传任何材料——PDF、幻灯片、讲座、YouTube、图片——AskSia 即刻将其转化为 10+ 种学习工具。", bullets: ["AI 摘要、速查表、闪卡和测验，秒级完成", "30+ 种语言的实时转录和翻译", "带有可视化解释的逐步问题解答"], cta: "试用网页应用 →", label: "app.asksia.ai/pro" },
  { key: "mobile", eyebrow: "📱 移动应用", title: "随时随地学习。", description: "对准任何题目拍照。录制任何讲座。AskSia 秒速理解。", bullets: ["拍照即获解释、公式求解", "讲座实时录制，自动识别发言者", "学习材料按课程整理——支持离线"], cta: "获取应用 →", label: "AskSia · iOS & Android" },
  { key: "extension", eyebrow: "🧩 浏览器扩展", title: "AskSia 在你的 LMS 中。", description: "自动绑定 Canvas、Blackboard 和 Brightspace。AskSia 无需你动手即可了解你的整个课程。", bullets: ["一键同步：阅读材料、幻灯片和作业", "在 LMS 中直接向 AskSia 提问，无需离开页面", "自动识别课程结构并生成学习路径"], cta: "安装扩展 →", label: "Canvas · Blackboard · Brightspace" },
  { key: "library", eyebrow: "📚 资料库", title: "你的知识，井然有序。", description: "所有课程、讲座和阅读材料集中在一个可搜索的知识库里。", bullets: ["按课程、学期和主题整理", "从每份资料生成摘要与关键概念", "随时回到你上次学习的位置"], cta: "浏览资料库 →", label: "AskSia Library" },
  { key: "agent", eyebrow: "✦ AskSia 智能体", title: "一个真正懂你课程的智能体。", description: "AskSia 连接你的资料和课程大纲，在你需要的时候给出基于上下文的答案。", bullets: ["围绕你的课程资料回答，而不是泛泛搜索", "把问题拆成清晰的学习步骤", "把洞见、笔记和下一步行动放在一起"], cta: "认识 AskSia 智能体 →", label: "Your personal study copilot" },
];

const reviews = [
  ["S", "Sophie L.", "McGill", "Bilingual transcription works perfectly for Montréal lectures."],
  ["O", "Olivia T.", "Oxford", "Extension syncs my Canvas perfectly."],
  ["陈", "陈思远", "北京大学", "留学党必备，课堂录音秒变笔记。"],
  ["민", "민서 김", "연세대 · 수능", "수능 준비에 완벽해요. AI 요약 최고."],
  ["S", "佐藤 美咲", "東京大学", "講義を録音するだけでノート完成。"],
  ["J", "Jake M.", "UPenn · SAT", "Turned 3-hour sessions into 45 minutes."],
  ["A", "Amélie D.", "Sciences Po", "La transcription en français est impeccable."],
  ["V", "Valentina R.", "UNAM", "Me ayudó a entender cálculo. ¡Increíble!"],
];

const comparisonRows = [
  ["与你自己的课程资料对话", "✓", "✗", "✗", "✗", "✗", "✗"],
  ["讲座转录", "✓", "✗", "✗", "✗", "✓", "✗"],
  ["针对转录内容提问", "✓", "✗", "✗", "✗", "✗", "✗"],
  ["从录音自动生成笔记", "✓", "✗", "✗", "✗", "✗", "✗"],
  ["实时智能标记", "✓", "✗", "✗", "✗", "部分支持", "✗"],
  ["一键保存笔记", "✓", "✗", "✗", "✗", "✗", "✗"],
  ["基于课程大纲而非互联网回答", "✓", "✗", "部分支持", "✗", "✗", "✗"],
  ["PDF 与文档上传", "✓", "有限", "✓", "✗", "✗", "✗"],
  ["自动整理笔记", "✓", "✗", "✓", "✗", "✗", "✗"],
  ["生成闪卡与测验", "✓", "✗", "✗", "✗", "✗", "✓"],
  ["需要手动创建卡片", "✗", "—", "—", "—", "—", "需要手动创建卡片"],
  ["所有大学科目", "✓", "✓", "✓", "✗", "✓", "部分支持"],
  ["替代多个学习 App", "✓", "✗", "✗", "✗", "✗", "✗"],
  ["翻译支持", "✓", "✓", "部分支持", "✗", "部分支持", "✗"],
  ["移动 App", "✓", "✓", "✓", "✓", "✓", "✓"],
  ["免费计划", "✓", "✓", "有限", "✓", "有限", "✓"],
];

const faqs = [
  ["AskSia 与 ChatGPT 有什么不同？", "ChatGPT 提供来自互联网的泛化答案。AskSia 基于你自己上传的学习材料，包括教科书、讲座和课程大纲，因此每个回答都与你实际学习的内容相关。"],
  ["AskSia 支持哪些科目？", "所有大学科目，包括 STEM、商科、法律、人文、社会科学等。AskSia 会适应你的资料，而不是依赖固定科目列表。"],
  ["讲座转录如何工作？", "在 App 中录制现场讲座，或上传音频、视频文件。AskSia 会将其转成可搜索的转录文本，并实时自动标记关键想法、概念和待办事项。"],
  ["我可以上传 PDF 和教科书吗？", "可以。你可以将 PDF、课件和阅读资料直接上传到 AskSia。它会标出重点，并让你无需切换 App 就能针对具体章节提问。"],
  ["AskSia 可以免费使用吗？", "AskSia 提供无需信用卡的免费计划。付费计划可解锁无限上传、完整转录和高级笔记整理。"],
  ["用 AskSia 处理大学课程作业安全吗？", "AskSia 是学习工具，不是代写或复制作业的服务。它帮助你理解自己的材料。使用 AI 工具时，请始终遵守所在学校的学术诚信政策。"],
  ["AskSia 可以在手机上使用吗？", "可以。AskSia 支持 iOS、Android、网页版和 Chrome 扩展。你可以录制讲座、复习笔记，并随时随地学习。"],
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

function Header() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [promoVisible, setPromoVisible] = useState(true);
  return <>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="AskSia 首页"><img src="/images/asksia/logo.png" alt="AskSia" /></a>
        <nav className="desktop-nav" aria-label="主导航">
          {navGroups.map((group) => <div className="nav-dropdown" key={group.label}>
            <button type="button" className={`nav-pill ${open === group.label ? "is-open" : ""}`} onClick={() => setOpen(open === group.label ? null : group.label)}>{group.label}<span className="chevron">⌄</span></button>
            {open === group.label && <div className="dropdown-panel">
              {group.columns.map((column, index) => <div className="dropdown-column" key={`${group.label}-${index}`}>
                <span className="dropdown-heading">{column[0]}</span>
                {column.slice(1).map((item) => <a href="#prod" key={item} onClick={() => setOpen(null)}>{item}</a>)}
              </div>)}
            </div>}
          </div>)}
          <a className="nav-pill" href="#comparison">价格</a>
        </nav>
        <div className="header-actions">
          <button type="button" className="language-switcher">ZH-CN <span>⌄</span></button>
          <button type="button" className="login-button">登录</button>
          <a className="app-button" href="#hero">下载 App <span>🔥</span></a>
        </div>
        <button type="button" className="menu-button" aria-label="Menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? "×" : "☰"}</button>
      </div>
      {mobileOpen && <div className="mobile-menu">
        {navGroups.map((group) => <details key={group.label}><summary>{group.label}<span>⌄</span></summary><div className="mobile-submenu">{group.columns.flatMap((column) => column.slice(1)).map((item) => <a href="#prod" key={item} onClick={() => setMobileOpen(false)}>{item}</a>)}</div></details>)}
        <a href="#comparison">价格</a><a href="#hero">下载 App 🔥</a><button type="button">登录</button><span className="mobile-language">ZH-CN</span>
      </div>}
    </header>
    {promoVisible && <div className="promo-banner"><a href="#comparison">🎓 开学季限时优惠 · 领取专属折扣</a><button type="button" aria-label="Dismiss back to school promotion" onClick={() => setPromoVisible(false)}>×</button></div>}
  </>;
}

function Hero() {
  return <>
    <section id="hero" className="hero-section">
      <div className="aurora aurora-one" /><div className="aurora aurora-two" /><div className="aurora aurora-three" />
      <div className="hero-content">
        <div className="quick-links">{quickLinks.map((item, index) => <a href="#prod" key={item} style={{ "--i": index } as React.CSSProperties}>{item}</a>)}</div>
        <h1>AskSia，你的专属<br /><span>大学学习 AI 副驾</span></h1>
        <h2>今天我们 <em>学什么？</em></h2>
        <p>上传阅读材料、转录讲座、掌握任何学科——AskSia 是你跨设备、跨语言的 AI 学习助手。</p>
        <div className="hero-actions"><a className="primary-button" href="#prod">免费开始 <Arrow /></a><button className="secondary-button" type="button">▶ 添加到 Chrome</button></div>
        <div className="hero-stat"><strong>200万<span>+</span></strong><span>来自 <b>2,000+ 所大学</b> 的学生在使用</span></div>
      </div>
    </section>
    <section className="trust-strip"><div className="logo-marquee">{schoolLogos.concat(schoolLogos).map((logo, index) => <img key={`${logo}-${index}`} src={`/images/asksia/school-${logo}.png`} alt="AskSia partner university logo" />)}</div><div className="exam-marquee">{exams.concat(exams).map((exam, index) => <span key={`${exam}-${index}`}>{exam}<i>·</i></span>)}</div></section>
  </>;
}

function Mockup({ product }: { product: Product }) {
  if (product.key === "mobile") return <div className="device-mockup"><div className="device-notch" /><div className="device-screen"><div className="device-top">AskSia <span>◉</span></div><div className="audio-card"><strong>41:23</strong><span>● 正在录音</span></div><div className="transcript-line"><b>Speaker 1</b><span>So you&apos;re interested in studying some history?…</span></div><div className="transcript-line"><b>Speaker 2</b><span>Or perhaps you feel it is important to understand…</span></div><div className="study-guide"><span>Study Guide</span><div><b>📝</b>Summary · 3 pages</div><div><b>🃏</b>Flashcards · 12</div><div><b>❓</b>Quiz · 5 questions</div></div></div></div>;
  if (product.key === "extension") return <div className="extension-mockup"><div className="browser-bar"><span>◉ ◉ ◉</span><div>canvas.instructure.com/courses/2048</div></div><div className="browser-body"><aside><b>Canvas</b><span>Dashboard</span><span>课程</span><span>收件箱</span><span>帮助</span></aside><div className="canvas-content"><small>CALCULUS II · WEEK 4</small><h4>Integration by Parts</h4><p>Lecture notes, assignments, and study insights in one place.</p><div className="ask-card"><strong>AskSia</strong><span>根据本节课的内容提问…</span><b>↗</b></div></div></div></div>;
  if (product.key === "library") return <div className="library-mockup"><div className="library-sidebar"><b>AskSia Library</b><span>All courses</span><span>Calculus II</span><span>Sociology</span><span>Economics</span></div><div className="library-main"><div className="library-search">⌕ 搜索你的资料</div><div className="library-cards"><article><b>Calculus II</b><span>28 documents · 8 insights</span></article><article><b>Behavioral Economics</b><span>17 documents · 4 insights</span></article><article><b>Lecture notes</b><span>12 recordings · 30 flashcards</span></article></div></div></div>;
  if (product.key === "agent") return <div className="agent-mockup"><div className="agent-head"><span>✦ AskSia Agent</span><small>Course context on</small></div><div className="agent-message"><b>You</b><p>Can you explain the difference between these two theories?</p></div><div className="agent-answer"><b>AskSia</b><p>Based on your week 6 lecture and the assigned reading, the key difference is…</p><div className="answer-tags"><span>Week 6 lecture</span><span>Reading · p. 42</span></div></div><div className="agent-input">Ask anything about your course… <b>↗</b></div></div>;
  return <div className="web-mockup"><div className="web-sidebar"><b>✦ AskSia</b><span>+ New Chat</span><span>📁 Calculus II</span><span>📁 Sociology</span><span>📁 Economics</span></div><div className="web-main"><div className="mockup-title">Calculus II <small>⌄</small></div><div className="chat-bubble">Explain integration by parts in simple terms.</div><div className="chat-answer"><b>AskSia</b><p>Integration by parts lets you transform a difficult product into two simpler terms.</p><div className="insight-row"><span>Key Insights</span><small>Covers integration by parts and u-substitution.</small></div></div><div className="mockup-input">Ask anything about your course… <b>↗</b></div></div></div>;
}

function ProductSuite() {
  const [active, setActive] = useState<ProductKey>("web");
  const refs = useRef<Record<ProductKey, HTMLDivElement | null>>({ web: null, mobile: null, extension: null, library: null, agent: null });
  const select = (key: ProductKey) => { setActive(key); refs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  return <section id="prod" className="product-section">
    <div className="product-heading"><span className="eyebrow">产品套件</span><h2>一个生态系统。<br />满足你所有的学习方式。</h2><p>五款产品，一个账户——从上传到理解的完整学习基础设施。</p><a className="small-primary" href="#hero">免费开始 <Arrow /></a></div>
    <div className="product-tabs" role="tablist">{products.map((product) => <button type="button" role="tab" aria-selected={active === product.key} className={active === product.key ? "active" : ""} onClick={() => select(product.key)} key={product.key}>{product.key === "web" ? "网页应用" : product.key === "mobile" ? "移动端" : product.key === "extension" ? "扩展" : product.key === "library" ? "资料库" : "AskSia 智能体"}</button>)}</div>
    <div className="product-list">{products.map((product) => <div className={`product-row ${active === product.key ? "active" : ""}`} key={product.key} ref={(node) => { refs.current[product.key] = node; }}>
      <div className="product-copy"><span className="eyebrow">{product.eyebrow}</span><h3>{product.title}</h3><p>{product.description}</p><ul>{product.bullets.map((bullet) => <li key={bullet}><span>✓</span>{bullet}</li>)}</ul><a className="text-link" href="#hero">{product.cta}</a></div><div className="product-visual"><Mockup product={product} /><span className="mockup-label">{product.label}</span></div>
    </div>)}</div>
  </section>;
}

function Reviews() { return <section id="reviews" className="reviews-section"><div className="reviews-heading"><span className="eyebrow">用户好评</span><h2>受到全球学生<br />的喜爱。</h2><p>200万+ 学生遍布 2,000+ 所大学，信赖 AskSia 助力学习。</p></div><div className="review-orbit"><div className="orbit-globe"><span>✦</span><span>AskSia</span><small>2M+ students</small></div>{reviews.map(([initial, name, school, quote], index) => <article className={`review-card review-card-${index + 1}`} key={name}><b>★★★★★</b><p>“{quote}”</p><footer><span>{initial}</span><div><strong>{name}</strong><small>{school}</small></div></footer></article>)}</div></section>; }

function Comparison() { return <section id="comparison" className="comparison-section"><div className="comparison-card"><span className="eyebrow">工具对比</span><h2>AskSia 与其他 AI 学习工具的对比</h2><p>大多数 AI 工具是为通用场景而建。AskSia 专为学生设计，围绕你的资料、讲座和课程作业展开。下面是它与学生最常从中切换过来的工具的对比。</p><div className="comparison-table-wrap"><table><thead><tr>{["功能", "AskSia", "ChatGPT", "Notion AI", "Photomath", "Otter.ai", "Quizlet"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{comparisonRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={`${row[0]}-label`}>{cell}</th> : <td className={cell === "✓" ? "yes" : cell === "✗" ? "no" : "partial"} key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div></div><div className="faq-card"><span className="eyebrow">FAQ</span><h2>常见问题</h2><div className="faq-lead"><h3>AskSia 是什么？它如何工作？</h3><p>AskSia 是面向大学生的 AI 学习平台。上传你的讲座、PDF 和阅读资料后，AskSia 会进行转录、提炼关键概念、整理笔记，并基于你的真实课程内容回答问题。全球 2,000+ 所大学已有 200万+ 学生使用。</p></div><div className="faq-grid">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>; }

function Footer() { const footerGroups = [["产品", "AskSia 3.0 Pro", "AskSia Super", "Chrome", "macOS", "Windows", "价格"], ["AI 工具", "YouTube 摘要器", "闪卡生成器", "思维导图生成器", "测验生成器", "AI 检测器", "引用生成器"], ["与我们合作", "机构合作", "Student Beans", "推广合作", "新闻媒体", "职业"], ["公司", "关于我们", "联系我们", "法律与政策", "服务协议", "成绩信心保障", "常见问题"]]; return <footer className="site-footer"><div className="footer-glow" /><div className="footer-content"><div className="footer-contact"><h2>让我们保持联系</h2><div className="socials">{[0, 1, 2, 3, 4, 5].map((social) => <a href="#hero" key={social}><img src={`/images/asksia/social-${social}.svg`} alt="" /></a>)}</div></div><div className="footer-groups">{footerGroups.map(([title, ...links]) => <div key={title}><b>{title}</b>{links.map((link) => <a href="#hero" key={link}>{link}</a>)}</div>)}</div></div><div className="footer-bottom"><span>© 2026 AskSia. Built for students.</span><span>学术诚信 · 隐私 · 服务协议</span></div></footer>; }

export default function AskSiaLanding() { useEffect(() => { document.documentElement.lang = "zh-CN"; }, []); return <div id="top" className="asksia-page"><Header /><main><Hero /><ProductSuite /><Reviews /><Comparison /></main><Footer /></div>; }
