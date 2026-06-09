const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
    } else {
        console.log(`[BROWSER LOG] ${msg.text()}`);
    }
  });

  console.log('Navigating to Rumani product page...');
  await page.goto('http://localhost:4321/freshmangoes-web/shop/rumani');
  
  console.log('Waiting for Add to Cart button...');
  await page.waitForSelector('button:has-text("Add Rumani to cart")');
  
  console.log('Clicking Add to Cart button...');
  await page.click('button:has-text("Add Rumani to cart")');
  
  console.log('Waiting for 3 seconds for network requests...');
  await page.waitForTimeout(3000);
  
  // Checking cart count badge
  const cartCount = await page.locator('#cart-count').textContent();
  console.log(`[RESULT] Cart count badge: ${cartCount}`);
  
  // Checking if there's any error box
  const hasErrorBox = await page.locator('.bg-red-50').count();
  if (hasErrorBox > 0) {
      const errorText = await page.locator('.bg-red-50').textContent();
      console.log(`[RESULT] Error box text: ${errorText}`);
  }
  
  await browser.close();
})();
