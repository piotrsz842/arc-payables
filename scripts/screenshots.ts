/**
 * Screenshots of every page, phone and desktop, using the Edge browser
 * already installed on this computer (Playwright, no browser download).
 * Signs in as a LOCAL test account (localhost only).
 *
 *   npm run screenshots -- [email] [base]      saves PNGs to docs/screenshots/
 * Password comes from TEST_SIGNUP2_PASSWORD (.env); never printed.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const email = process.argv[2] ?? "test-author-2@example.com";
const base = process.argv[3] ?? "http://localhost:3000";
const password = process.env.TEST_SIGNUP2_PASSWORD;
if (!password) throw new Error("TEST_SIGNUP2_PASSWORD missing in .env");
if (!/^http:\/\/localhost/.test(base)) throw new Error("Screenshots sign in with a test account: localhost only.");

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 860 } } as const;

async function shoot(page: Page, name: string, path: string) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`saved ${OUT}/${name}.png`);
}

for (const [label, viewport] of Object.entries(sizes)) {
  // Signed out: landing.
  const anon = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await shoot(anon, `${label}-landing`, "/");
  await anon.close();

  // Signed in.
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button:has-text("Sign in")')]);
  for (const [name, path] of [
    ["home", "/"],
    ["ask", "/ask"],
    ["earnings", "/earnings"],
    ["study", "/study"],
    ["upload", "/notes/new"],
    ["note", process.env.SCREENSHOT_NOTE_PATH ?? "/"],
    ["signup", "/signup"],
  ] as const) {
    await shoot(page, `${label}-${name}`, path);
  }
  // Earnings with the Advanced crypto option opened.
  await page.goto(`${base}/earnings`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Advanced")');
  await page.click("text=Send to a crypto wallet");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${label}-earnings-advanced.png`, fullPage: true });
  console.log(`saved ${OUT}/${label}-earnings-advanced.png`);
  // One real question (costs about $0.001 on Haiku): the chat with its summary chips and answer.
  if (label === "phone" && process.argv.includes("--chat")) {
    await page.goto(`${base}/ask?q=${encodeURIComponent("CPSC 221: why does quicksort take O(n^2) on sorted input?")}`);
    await page.waitForSelector("text=Helpful?", { timeout: 120_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/phone-chat-answer.png`, fullPage: true });
    await page.click("text=Details");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/phone-chat-details.png`, fullPage: true });
    console.log(`saved ${OUT}/phone-chat-answer.png and phone-chat-details.png`);
  }
  await page.close();
}
await browser.close();
