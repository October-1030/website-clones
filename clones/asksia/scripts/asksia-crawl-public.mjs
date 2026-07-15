async (page) => {
  const routes = [
    '/solver/homework-solver', '/transcribe', '/tools/quiz-generator', '/generator/essay-generator', '/ai-tutor', '/ai-college', '/summarize', '/tools/youtube-video-summarizer', '/tools/flashcard-maker', '/tools/visual-map-generator', '/cheatsheet', '/zh-CN/pro', '/zh-CN/super', '/zh-CN/pricing', '/zh-CN/app/chrome-extension', '/zh-CN/faq'
  ];
  const result = [];
  for (const route of routes) {
    try {
      await page.goto(`https://www.asksia.ai${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(450);
      const data = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        headings: [...document.querySelectorAll('h1,h2,h3')].map((el) => el.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 20),
        buttons: [...document.querySelectorAll('button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((el) => el.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30),
        inputs: [...document.querySelectorAll('input,textarea,select')].map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder'), name: el.getAttribute('name') })).slice(0, 30),
        links: [...document.querySelectorAll('a[href]')].map((el) => ({ text: el.textContent?.trim().replace(/\s+/g, ' '), href: el.getAttribute('href') })).filter((item) => item.text || item.href).slice(0, 30),
        text: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 1600),
      }));
      result.push(data);
    } catch (error) {
      result.push({ route, error: String(error) });
    }
  }
  return result;
}
