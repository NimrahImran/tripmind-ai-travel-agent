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
  const logo = require('fs').readFileSync(path.join(__dirname, '../public/favicon.svg'), 'utf8');
  await icon.setContent(
    `<body style="margin:0;background:radial-gradient(circle at 30% 20%,#1f4c5c,#0f2e3a);display:grid;place-items:center;height:180px">${logo.replace('<svg ', '<svg width="128" height="128" ')}</body>`,
  );
  await icon.screenshot({ path: path.join(__dirname, '../public/apple-touch-icon.png') });
  await browser.close();
})();
