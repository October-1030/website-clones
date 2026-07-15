async (page) => page.evaluate(() => {
  const describe = (el, index) => { const rect = el.getBoundingClientRect(); const text = el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 180); return { index, tag: el.tagName, id: el.id, classes: String(el.className).slice(0, 220), top: Math.round(rect.top + scrollY), height: Math.round(rect.height), text }; };
  const candidates = [...document.body.children].flatMap((child) => [...child.children]);
  return { bodyChildren: [...document.body.children].map((el, index) => describe(el, index)), mainChildren: [...document.querySelectorAll('main > *')].map(describe), allLarge: [...document.querySelectorAll('body *')].filter((el) => { const rect = el.getBoundingClientRect(); return rect.width > 900 && rect.height > 180; }).slice(0, 100).map(describe) };
})
