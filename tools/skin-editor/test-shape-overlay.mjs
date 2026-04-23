import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen to console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Go to skin editor
  await page.goto('http://localhost:3005');

  // Wait for app to load
  await page.waitForTimeout(2000);

  // Load a chrome image first
  const filePath = '/Users/bushi/Documents/Developer/terminai/tools/skin-editor/test-chrome.png';
  await page.setInputFiles('#load-chrome', filePath).catch(() => {
    console.log('No test chrome image found, creating a region manually...');
  });

  await page.waitForTimeout(1000);

  // Click on canvas to create a region
  const canvas = await page.locator('#editor-canvas');
  await canvas.click({ position: { x: 100, y: 100 } });

  // Drag to create region
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Change type to shape-overlay
  await page.selectOption('#prop-type', 'shape-overlay');

  await page.waitForTimeout(1000);

  // Get console logs about renderer
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  // Enter preview mode
  await page.click('#toggle-preview');

  await page.waitForTimeout(2000);

  // Check if shape-overlay renderer was found
  const regionLayer = await page.locator('[data-region-id]').first();
  const regionType = await regionLayer.getAttribute('data-region-id');
  const styles = await regionLayer.evaluate(el => el.style.cssText);

  console.log('\n=== TEST RESULTS ===');
  console.log('Region ID:', regionType);
  console.log('Region styles:', styles);
  console.log('Console logs:', logs.join('\n'));

  // Take screenshot
  await page.screenshot({ path: '/Users/bushi/Documents/Developer/terminai/tools/skin-editor/test-screenshot.png' });
  console.log('Screenshot saved to test-screenshot.png');

  await browser.close();
})();
