async (page) => {
  const snapshot = async () => page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === '学生专区');
    const nav = button?.closest('header') || button?.parentElement?.parentElement?.parentElement;
    const styles = nav ? getComputedStyle(nav) : null;
    const visible = [...document.querySelectorAll('body *')].filter((el) => { const text = el.textContent?.trim(); const rect = el.getBoundingClientRect(); return text && ['LMS 集成','实用工具','帮助中心'].includes(text) && rect.width > 0 && rect.height > 0; }).map((el) => el.textContent.trim());
    return { scrollY, nav: styles ? { position: styles.position, top: styles.top, background: styles.background, boxShadow: styles.boxShadow, height: styles.height } : null, visibleMenuText: [...new Set(visible)] };
  });
  const results = { initial: await snapshot() };
  await page.evaluate(() => scrollTo(0, 950));
  await page.waitForTimeout(300);
  results.scrolled = await snapshot();
  await page.getByRole('button', { name: '学生专区' }).click();
  results.studentsOpen = await snapshot();
  await page.getByRole('button', { name: '实用工具' }).click();
  results.toolsOpen = await snapshot();
  await page.getByRole('button', { name: '资源' }).click();
  results.resourcesOpen = await snapshot();
  return results;
}
