async (page) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForTimeout(200);
  return await page.evaluate(() => ({ text: document.body.innerText.slice(0, 2400), buttons: [...document.querySelectorAll('button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((el) => el.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40) }));
}
