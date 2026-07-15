async (page) => {
  const result = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  result.title = await page.title();
  result.heroHeading = await page.locator('#hero h1').innerText();
  await page.getByRole('button', { name: /学生专区/ }).click();
  result.desktopDropdown = await page.locator('.dropdown-panel').isVisible();
  await page.getByRole('button', { name: 'Dismiss back to school promotion' }).click();
  result.promoDismissed = (await page.locator('.promo-banner').count()) === 0;
  await page.getByRole('tab', { name: '移动端' }).click();
  result.mobileTabSelected = await page.getByRole('tab', { name: '移动端' }).getAttribute('aria-selected');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu' }).click();
  result.mobileMenu = await page.locator('.mobile-menu').isVisible();
  await page.locator('details').first().locator('summary').click();
  result.faqOpen = await page.locator('details').first().evaluate((el) => el.open);
  return result;
}
