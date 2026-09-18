const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR_ROOT = 'g:\\kpr hackathon\\screenshots';
const OUT_DIR_PUB = 'g:\\kpr hackathon\\frontend\\public\\screenshots';
const OUT_DIR_BRAIN = 'C:\\Users\\Acer\\.gemini\\antigravity-ide\\brain\\e80d5ba3-aab2-48ea-bf8a-14726fbae90f\\screenshots';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 1000 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await sleep(2500);

  // Click Scenario 4 to see AI SOC Override and radar chart
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s4 = btns.find(b => b.textContent.includes('Scenario 4') || b.textContent.includes('Leaked Credential'));
    if (s4) s4.click();
  });
  await sleep(1500);

  const s4Path = path.join(OUT_DIR_ROOT, '04b_scenario_4_full_explainability.png');
  await page.screenshot({ path: s4Path, fullPage: true });
  fs.copyFileSync(s4Path, path.join(OUT_DIR_PUB, '04b_scenario_4_full_explainability.png'));
  fs.copyFileSync(s4Path, path.join(OUT_DIR_BRAIN, '04b_scenario_4_full_explainability.png'));

  // Click Scenario 1 to see clean radar chart
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const s1 = btns.find(b => b.textContent.includes('Scenario 1') || b.textContent.includes('Trusted Corporate Baseline'));
    if (s1) s1.click();
  });
  await sleep(1500);

  const s1Path = path.join(OUT_DIR_ROOT, '01b_scenario_1_full_explainability.png');
  await page.screenshot({ path: s1Path, fullPage: true });
  fs.copyFileSync(s1Path, path.join(OUT_DIR_PUB, '01b_scenario_1_full_explainability.png'));
  fs.copyFileSync(s1Path, path.join(OUT_DIR_BRAIN, '01b_scenario_1_full_explainability.png'));

  await browser.close();
  console.log('Full explainability screenshots saved successfully!');
}

main().catch(console.error);
