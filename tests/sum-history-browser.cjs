const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { webkit, devices } = require("playwright");

const url = pathToFileURL(path.resolve(__dirname, "..", "history", "index.html")).href;
const portrait = { width: 393, height: 852 };
const landscape = { width: 852, height: 393 };
async function inspect(page, viewport, name) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const layout = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const rows = [...document.querySelectorAll(".updates li")].map(li => {
      const date = li.querySelector("time"), desc = li.querySelector("p");
      const range = document.createRange(); range.selectNodeContents(date);
      const d = range.getBoundingClientRect(), p = desc.getBoundingClientRect();
      return { date: box(date), desc: box(desc), dateRight: d.right, descLeft: p.left,
        fontDate: getComputedStyle(date).fontSize, fontDesc: getComputedStyle(desc).fontSize };
    });
    const rootStyle = getComputedStyle(document.documentElement);
    const adjust = rootStyle.getPropertyValue("text-size-adjust").trim() || rootStyle.getPropertyValue("-webkit-text-size-adjust").trim();
    return { adjust,
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: box(document.querySelector(".panel")), rows };
  });
  assert.equal(layout.adjust, "100%", name + ": automatic text enlargement");
  assert.equal(layout.viewport, viewport.width, name + ": viewport width");
  assert(layout.scrollWidth <= viewport.width + 1, name + ": horizontal overflow");
  assert(layout.panel[0] >= -1 && layout.panel[0] + layout.panel[2] <= viewport.width + 1, name + ": panel overflow");
  assert(layout.rows.length > 0, name + ": no history entries");
  for (const row of layout.rows) assert(row.dateRight <= row.descLeft + 1, name + ": rendered date text overlaps description");
  return layout;
}
function compare(a, b, name) {
  assert.equal(a.rows.length, b.rows.length, name + ": row count");
  const geometry = x => [x.panel, ...x.rows.flatMap(r => [r.date, r.desc])].flat();
  geometry(a).forEach((v, i) => assert(Math.abs(v - geometry(b)[i]) <= 1, name + ": geometry differs at " + i));
  assert.deepEqual(a.rows.map(r => [r.fontDate, r.fontDesc]), b.rows.map(r => [r.fontDate, r.fontDesc]), name + ": font size changed");
}
(async () => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ ...devices["iPhone 14"], viewport: portrait });
    await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
    const page = await context.newPage();
    await page.goto(url);
    const initial = await inspect(page, portrait, "portrait");
    await page.setViewportSize(landscape);
    const rotated = await inspect(page, landscape, "rotated landscape");
    await page.reload();
    const reloaded = await inspect(page, landscape, "landscape reload");
    compare(rotated, reloaded, "landscape rotation vs reload");
    const fresh = await context.newPage();
    await fresh.setViewportSize(landscape);
    await fresh.goto(url);
    compare(reloaded, await inspect(fresh, landscape, "fresh landscape"), "landscape reload vs fresh");
    await fresh.close();
    await page.setViewportSize(portrait);
    compare(initial, await inspect(page, portrait, "returned portrait"), "portrait round trip");
    console.log("History mobile WebKit: PASS (portrait, rotate, landscape reload, fresh landscape, return)");
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
