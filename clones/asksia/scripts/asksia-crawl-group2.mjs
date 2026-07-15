async (page) => {
  const routes = ['/summarize', '/tools/youtube-video-summarizer', '/tools/flashcard-maker'];
  const result = [];
  for (const route of routes) {
    await page.goto(`https://www.asksia.ai${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(400);
    result.push(await page.evaluate(() => ({ url: location.href, title: document.title, headings: [...document.querySelectorAll('h1,h2,h3')].map((el) => el.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 16), buttons: [...document.querySelectorAll('button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((el) => el.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(-20), inputs: [...document.querySelectorAll('input,textarea,select')].map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder') })).slice(-15), text: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 2400) })));
  }
  return result;
}
