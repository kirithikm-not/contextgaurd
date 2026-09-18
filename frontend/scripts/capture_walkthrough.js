const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = 'C:\\Users\\Acer\\.gemini\\antigravity-ide\\brain\\e80d5ba3-aab2-48ea-bf8a-14726fbae90f\\screenshots';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('Launching Chrome with Puppeteer Core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 950 }
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(2500);

  // 1. Scenario 1 (Default Allow)
  console.log('Capturing Scenario 1 (Allow)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s1 = btns.find(b => b.textContent.includes('Trusted Corporate Baseline') || b.textContent.includes('Scenario 1'));
    if (s1) s1.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_scenario_1_allow.png'), fullPage: false });

  // 2. Scenario 2 (Challenge)
  console.log('Capturing Scenario 2 (Challenge)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s2 = btns.find(b => b.textContent.includes('2:30 AM') || b.textContent.includes('Scenario 2'));
    if (s2) s2.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_scenario_2_challenge.png'), fullPage: false });

  // 3. Scenario 3 (Restrict + AI Agent)
  console.log('Capturing Scenario 3 (Restrict + AI Agent)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s3 = btns.find(b => b.textContent.includes('Impossible Travel') || b.textContent.includes('Scenario 3'));
    if (s3) s3.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_scenario_3_restrict.png'), fullPage: false });

  // 4. Scenario 4 (Deny + AI Override)
  console.log('Capturing Scenario 4 (Deny + AI Override)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s4 = btns.find(b => b.textContent.includes('Leaked Credential') || b.textContent.includes('Scenario 4'));
    if (s4) s4.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_scenario_4_deny_override.png'), fullPage: false });

  // 5. Knob Tuner Tab & Live Mutation
  console.log('Navigating to Signal Knob-Tuner...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const tunerTab = tabs.find(b => b.textContent.includes('Signal Knob-Tuner'));
    if (tunerTab) tunerTab.click();
  });
  await sleep(1200);

  // Move sliders & toggles
  console.log('Mutating sliders (Failed Logins & Off-Hours)...');
  await page.evaluate(() => {
    const ranges = Array.from(document.querySelectorAll('input[type="range"]'));
    if (ranges[0]) {
      ranges[0].value = '3'; // 3 AM
      ranges[0].dispatchEvent(new Event('input', { bubbles: true }));
      ranges[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (ranges[1]) {
      ranges[1].value = '6'; // 6 failed logins
      ranges[1].dispatchEvent(new Event('input', { bubbles: true }));
      ranges[1].dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Click 'Re-Calculate Risk Live'
    const btns = Array.from(document.querySelectorAll('button'));
    const calcBtn = btns.find(b => b.textContent.includes('Re-Calculate Risk Live'));
    if (calcBtn) calcBtn.click();
  });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_knob_tuner_live_mutation.png'), fullPage: false });

  // 6. Continuous Session Drift Tab
  console.log('Navigating to Continuous Session Drift...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const driftTab = tabs.find(b => b.textContent.includes('Continuous Session Drift'));
    if (driftTab) driftTab.click();
  });
  await sleep(1200);

  console.log('Running Session Drift sequence...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent.includes('Run Live Session Drift Simulation'));
    if (runBtn) runBtn.click();
  });
  await sleep(3500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_session_drift_timeline.png'), fullPage: false });

  // 7. Audit Trail Tab
  console.log('Navigating to Audit Trail...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const auditTab = tabs.find(b => b.textContent.includes('Audit Trail'));
    if (auditTab) auditTab.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_audit_log_table.png'), fullPage: false });

  // 8. WebSocket Stream Live Badge Inspection
  console.log('Navigating back to Decision Console with WebSocket stream...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const consoleTab = tabs.find(b => b.textContent.includes('Decision Console'));
    if (consoleTab) consoleTab.click();
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_websocket_live_console.png'), fullPage: false });

  console.log('All screenshots captured successfully in:', OUTPUT_DIR);
  await browser.close();
}

run().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
