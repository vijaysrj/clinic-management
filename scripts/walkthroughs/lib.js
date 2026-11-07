const { chromium } = require('playwright');
const B = 'http://localhost:3000';
const INIT = `
(() => {
  const css = \`
  #demo-cap{position:fixed;left:12px;right:12px;margin:0 auto;width:fit-content;bottom:var(--cap-bottom,28px);top:var(--cap-top,auto);z-index:2147483647;max-width:900px;
    background:rgba(17,32,30,.92);color:#fff;font:600 var(--cap-size,20px)/1.35 Inter,system-ui,sans-serif;padding:12px 20px;border-radius:14px;
    text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .25s;pointer-events:none}
  #demo-cap:empty{opacity:0}
  #demo-cur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(21,128,107,.35);
    border:2px solid #15806b;pointer-events:none;transition:transform .12s;left:-50px;top:-50px}
  #demo-cur.down{transform:scale(.7);background:rgba(21,128,107,.6)}
  #demo-title{position:fixed;inset:0;z-index:2147483647;background:#15806b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px;transition:opacity .4s}
  #demo-title h1{font-size:var(--title-size,52px);font-weight:700;margin:0;letter-spacing:-.02em}
  #demo-title p{font-size:calc(var(--title-size,52px)*.42);opacity:.85;margin:12px 0 0}\`;
  const mount = () => {
    if (document.getElementById('demo-cap')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'demo-cap'; c.textContent = sessionStorage.getItem('demoCap') || ''; document.body.appendChild(c);
    const k = document.createElement('div'); k.id = 'demo-cur'; document.body.appendChild(k);
    const xy = sessionStorage.getItem('demoXY'); if (xy) { const [x,y] = xy.split(','); k.style.left = x+'px'; k.style.top = y+'px'; }
    addEventListener('mousemove', e => { k.style.left = e.clientX+'px'; k.style.top = e.clientY+'px'; sessionStorage.setItem('demoXY', e.clientX+','+e.clientY); }, true);
    addEventListener('mousedown', () => k.classList.add('down'), true);
    addEventListener('mouseup', () => k.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
})();`;

async function start({ name, width, height, capSize = '20px', titleSize = '52px', capTop = false, dir }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, recordVideo: { dir, size: { width, height } } });
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(`addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--cap-size','${capSize}');document.documentElement.style.setProperty('--title-size','${titleSize}');${capTop ? "document.documentElement.style.setProperty('--cap-top','10px');document.documentElement.style.setProperty('--cap-bottom','auto');" : ''}})`);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  const wait = (ms) => page.waitForTimeout(ms);
  const api = {
    page, wait,
    async cap(text, ms = 0) { await page.evaluate((t) => { sessionStorage.setItem('demoCap', t); const c = document.getElementById('demo-cap'); if (c) c.textContent = t; }, text); if (ms) await wait(ms); },
    async title(h, p, ms = 2200) {
      await page.evaluate(([h, p]) => { const d = document.createElement('div'); d.id = 'demo-title'; d.innerHTML = '<h1></h1><p></p>'; d.querySelector('h1').textContent = h; d.querySelector('p').textContent = p; document.body.appendChild(d); }, [h, p]);
      await wait(ms);
      await page.evaluate(() => { const d = document.getElementById('demo-title'); d.style.opacity = '0'; setTimeout(() => d.remove(), 450); });
      await wait(500);
    },
    async move(loc) {
      await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (!b) return;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await wait(200);
    },
    async click(loc, after = 700) { loc = typeof loc === 'string' ? page.locator(loc).first() : loc; await loc.waitFor(); await api.move(loc); await loc.click(); await wait(after); },
    async type(loc, text, after = 400) { loc = typeof loc === 'string' ? page.locator(loc).first() : loc; await api.click(loc, 150); await loc.fill(''); await loc.pressSequentially(text, { delay: 65 }); await wait(after); },
    async finish() { const v = page.video(); await ctx.close(); await browser.close(); const p = await v.path(); require('fs').renameSync(p, `${dir}/${name}.webm`); console.log('saved', name); },
  };
  return api;
}
module.exports = { start, B };
