// Renders public/og-image.jpg (1200x630 share card) and the touch icon.
// Run with: node scripts/make-images.cjs   (needs Playwright installed)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.join(__dirname, 'og.html'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '../public/og-image.jpg'), type: 'jpeg', quality: 86 });

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(
    `<body style="margin:0;background:#0f2e3a;display:grid;place-items:center;height:180px">
      <svg width="132" height="132" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#f4b13f"/><path d="M16 6.5l3.2 9.5L16 25.5l-3.2-9.5z" fill="#0f2e3a"/><circle cx="16" cy="16" r="2.2" fill="#f4b13f"/></svg></body>`,
  );
  await icon.screenshot({ path: path.join(__dirname, '../public/apple-touch-icon.png') });
  await browser.close();
})();
