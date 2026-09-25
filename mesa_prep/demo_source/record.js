// Records the EcoConnectAI product demo: per step -> TTS narration + screencast clip, then mux + concat.
const puppeteer = require('/private/tmp/claude-501/-Users-kuldeepraj-Major-Project-EconnectAI/f1c6a345-205b-4a98-a2aa-d3d68866068a/scratchpad/tools/node_modules/puppeteer-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const FF = path.join(HERE, '../tools/bin/ffmpeg');
const OUT = path.join(HERE, 'out'); const AUD = path.join(OUT, 'audio'); const CLIP = path.join(OUT, 'clips'); const SEG = path.join(OUT, 'segs');
for (const d of [OUT, AUD, CLIP, SEG]) fs.mkdirSync(d, { recursive: true });
const BASE = 'http://localhost:3000';
const STEPS = require('./steps.js');
const ONLY = process.argv[2] ? process.argv[2].split(',').filter(Boolean).map(Number) : null;   // debug: record subset
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- TTS
const SUBS = [[/\bIIC\b/g, 'I I C'], [/\bI O U\b/g, 'I O U'], [/\bUNB7\b/g, 'U N B 7'], [/\bP(\d{2})\b/g, (m, a) => 'P ' + Number(a)],
  [/\bC(\d)\b/g, 'C $1'], [/\bB0\b/g, 'B zero'], [/\bB7\b/g, 'B 7'], [/\bVembanad Kol\b/g, 'Vembanaad Kole'], [/\bBhitarkanika\b/g, 'Bhitar-kanika'],
  [/\bMannar\b/g, 'Mannaar'], [/\bSundarbans\b/g, 'Sunder-bunns'], [/\bKerala\b/g, 'Kay-rala'], [/\bOdisha\b/g, 'Oh-disha'], [/\bI D\b/g, 'I D'],
  [/\bS Q Lite\b/g, 'S Q Lite'], [/\bA I detected\b/g, 'A I detected']];
const speech = t => SUBS.reduce((s, [a, b]) => s.replace(a, b), t);
function tts(i, text) {
  const f = path.join(AUD, `a${String(i).padStart(2, '0')}.aiff`);
  execFileSync('say', ['-v', 'Daniel', '-r', '172', '-o', f, speech(text)]);
  const info = execFileSync('afinfo', [f]).toString();
  return { f, dur: parseFloat(info.match(/estimated duration: ([\d.]+)/)[1]) };
}

// ---------------------------------------------------------------- in-page overlays
const CURSOR_JS = `(() => { const install = () => { if (!document.body) return setTimeout(install, 30); if (document.getElementById('__cur')) return;
 const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important} #__chap{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(15,32,26,.88);color:#e8fff1;font:600 15px -apple-system,Helvetica,Arial;padding:7px 16px;border-radius:999px;z-index:2147483645;pointer-events:none;letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.25)}';
 document.head.appendChild(st);
 const c = document.createElement('div'); c.id = '__cur'; c.style.cssText = 'position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(' + (window.__cx||800) + 'px,' + (window.__cy||450) + 'px)';
 c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2.5l6.6 18.2 2.6-7.4 7.3-2.7z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
 document.body.appendChild(c);
 const r = document.createElement('div'); r.id = '__ring'; r.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f59e0b;z-index:2147483646;pointer-events:none;opacity:0;left:0;top:0';
 document.body.appendChild(r);
 document.addEventListener('mousemove', e => { window.__cx = e.clientX; window.__cy = e.clientY; c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
 document.addEventListener('mousedown', e => { r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.animate([{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.7)' }], { duration: 650 }); }, true);
}; install(); })();`;

const OVERLAY_HTML = `<div style="position:absolute;inset:0;background:rgba(10,20,15,.55);display:flex;align-items:center;justify-content:center">
<div style="background:#fff;border-radius:14px;padding:28px 34px;width:1020px;font:16px -apple-system,Helvetica,Arial;color:#1c211e;box-shadow:0 20px 60px rgba(0,0,0,.35)">
<div style="font-size:13px;letter-spacing:.14em;color:#0f5132;font-weight:800;text-transform:uppercase">How a click becomes a result · overlay added for this video</div>
<div style="display:flex;gap:12px;align-items:stretch;margin-top:18px">
${[['Browser', 'Next.js 16 · React · Leaflet · React Flow', '#56605a'], ['API', 'FastAPI (Python) · JWT roles · ≈50 endpoints', '#1a4b8c'], ['Database', 'SQLite · 15 tables: users, runs, detections, alerts, field tasks, evidence, projects, scenarios, reports, audit log', '#3b2f7a'], ['Run files', 'outputs/runs/&lt;area&gt;/&lt;run&gt;: patches.geojson, graph.json, criticality.csv, restoration.json · rasters & checkpoints on disk', '#0f5132'], ['Analysis', 'ecoconnect: U-Net inference (PyTorch) · patch graph · IIC · leave-one-out · scenarios', '#8a5a00']]
  .map(([h, t, c], i) => `${i ? '<div style="align-self:center;font-size:26px;color:#0f5132">→</div>' : ''}<div style="flex:1;border-radius:10px;background:${c};color:#fff;padding:14px 12px"><div style="font-weight:800;font-size:18px">${h}</div><div style="font-size:13.5px;margin-top:6px;line-height:1.35;opacity:.95">${t}</div></div>`).join('')}
</div>
<div style="margin-top:16px;font-size:14.5px;color:#43504a">Example from this demo: <b>Remove Patch</b> → POST /api/runs/kerala-coast/latest/what-if → graph rebuilt without P17 → IIC recomputed → −27.0 % shown on the card. <b>Create task</b> → POST /api/field-tasks → row in field_tasks + audit_log.</div>
</div></div>`;

// ---------------------------------------------------------------- driver helpers
function driver(page) {
  const st = { x: 800, y: 450 };
  const d = {};
  let CH = '';
  d.ensure = async () => { try { await page.evaluate(CURSOR_JS); if (CH) await page.evaluate(t => { let e = document.getElementById('__chap'); if (!e) { e = document.createElement('div'); e.id = '__chap'; document.body.appendChild(e); } if (e.textContent !== t) e.textContent = t; }, CH); } catch (e) { } };
  d.chapter = async text => { CH = text; await page.evaluate(CURSOR_JS).catch(() => { }); await page.evaluate(t => { let e = document.getElementById('__chap'); if (!e) { e = document.createElement('div'); e.id = '__chap'; document.body.appendChild(e); } e.textContent = t; }, text).catch(() => { }); };
  d.go = async url => { try { await page.goto(BASE + url, { waitUntil: 'load', timeout: 30000 }); await sleep(1500); } catch (e) { console.log('  goto timeout', url); } await d.ensure(); page.__restartCast && page.__restartCast(); await page.mouse.move(st.x, st.y); };
  d.wait = ms => sleep(ms);
  d.rect = async t => {
    if (t.xy) return { x: t.xy[0], y: t.xy[1] };
    return page.evaluate(t => {
      const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden'; };
      let els;
      if (t.sel) els = [...document.querySelectorAll(t.sel)].filter(vis);
      else {
        const tags = t.tag || 'button,a,label,span,div,p,h1,h2,h3,h4,td,th,li,strong,b';
        const want = t.text.toLowerCase();
        els = [...document.querySelectorAll(tags)].filter(e => vis(e) && (e.innerText || '').toLowerCase().includes(want));
        els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
      }
      if (t.region) els = els.filter(e => { const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; return cx >= t.region[0] && cy >= t.region[1] && cx <= t.region[2] && cy <= t.region[3]; });
      const e = els[t.index || 0]; if (!e) return null;
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = e.getBoundingClientRect();
      return { x: r.x + Math.min(r.width / 2, 160), y: r.y + r.height / 2 };
    }, t);
  };
  d.moveTo = async (t, ms = 900) => {
    const r = await d.rect(t); if (!r) { console.log('  !! not found', JSON.stringify(t)); return null; }
    const n = Math.max(12, Math.round(ms / 16)), sx = st.x, sy = st.y;
    for (let i = 1; i <= n; i++) { const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await page.mouse.move(sx + (r.x - sx) * e, sy + (r.y - sy) * e); await sleep(ms / n); }
    st.x = r.x; st.y = r.y; return r;
  };
  d.click = async (t, o = {}) => {
    let r = await d.moveTo(o.xy && !(await d.rect(t)) ? { xy: o.xy } : t);
    if (!r) return false;
    if (o.xOffset) { await d.moveTo({ xy: [r.x + o.xOffset, r.y] }, 400); r = { x: r.x + o.xOffset, y: r.y }; }
    await sleep(350); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(300); await d.ensure(); return true;
  };
  d.jsClick = async text => { await page.evaluate(text => { const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes(text)); b && b.click(); }, text); await sleep(300); await d.ensure(); };
  d.jsClickStart = async text => { await page.evaluate(text => { const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim().startsWith(text)); b && b.click(); }, text); await sleep(300); await d.ensure(); };
  d.submitActive = async () => { await page.evaluate(() => { const i = [...document.querySelectorAll('input,textarea')].find(e => (e.value || '').includes('Why is P17')); if (!i) return; const f = i.closest('form'); if (f && f.requestSubmit) { f.requestSubmit(); return; } let n = i.parentElement; for (let k = 0; k < 4 && n; k++, n = n.parentElement) { const bs = [...n.querySelectorAll('button')]; if (bs.length) { bs[bs.length - 1].click(); return; } } }); await sleep(300); };
  d.wheel = async (x, y, dy, n) => { await d.moveTo({ xy: [x, y] }, 500); for (let i = 0; i < n; i++) { await page.mouse.wheel({ deltaY: dy }); await sleep(450); } };
  d.scrollIn = async ([x, y], total) => { await d.moveTo({ xy: [x, y] }, 500); const n = 8; for (let i = 0; i < n; i++) { await page.mouse.wheel({ deltaY: total / n }); await sleep(90); } };
  d.scrollTop = async () => { await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelectorAll('main,[class*=overflow-y-auto]').forEach(e => e.scrollTo({ top: 0, behavior: 'smooth' })); }); await sleep(800); };
  d.type = async text => { await page.keyboard.type(text, { delay: 45 }); };
  d.key = async k => { await page.keyboard.press(k); };
  d.fill = async (sel, text) => { await d.click({ sel }); await page.keyboard.type(text, { delay: 18 }); await sleep(250); };
  d.select = async (idx, value) => {
    await page.evaluate((idx, value) => { const s = document.querySelectorAll('select')[idx]; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(s, value); s.dispatchEvent(new Event('change', { bubbles: true })); }, idx, value);
    await sleep(300); await d.ensure();
  };
  d.selectEl = async (_sel, optText) => {
    await page.evaluate(optText => { const s = [...document.querySelectorAll('form select')].find(s => [...s.options].some(o => o.text.includes(optText))); if (!s) return; const o = [...s.options].find(o => o.text.includes(optText)); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); s.scrollIntoView({ block: 'nearest' }); }, optText);
    const r = await page.evaluate(optText => { const s = [...document.querySelectorAll('form select')].find(s => [...s.options].some(o => o.text.includes(optText))); if (!s) return null; const b = s.getBoundingClientRect(); return [b.x + 60, b.y + b.height / 2]; }, optText);
    if (r) await d.moveTo({ xy: r }, 600);
  };
  d.search = async text => { await d.click({ sel: 'input[placeholder^="Search"]' }); await page.evaluate(() => { const i = document.querySelector('input[placeholder^="Search"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); }); await sleep(250); await d.type(text); await sleep(900); await page.keyboard.press('Enter'); await sleep(1200); await d.ensure(); };
  d.clickPatch = async (near, fills) => {
    const r = await page.evaluate((near, fills) => {
      const map = document.querySelector('.leaflet-container').getBoundingClientRect();
      const cands = [...document.querySelectorAll('.leaflet-overlay-pane path')].map(p => {
        const b = p.getBoundingClientRect(); const f = (p.getAttribute('fill') || '').toLowerCase();
        return { p, f, cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height };
      }).filter(o => fills.includes(o.f) && o.w >= 6 && o.h >= 6 && o.cx > map.x + 20 && o.cx < map.x + map.width - 250 && o.cy > map.y + 20 && o.cy < map.y + map.height - 40);
      cands.sort((a, b) => Math.hypot(a.cx - near[0], a.cy - near[1]) - Math.hypot(b.cx - near[0], b.cy - near[1]));
      for (const o of cands) {
        const b = o.p.getBoundingClientRect();
        for (let k = 0; k < 40; k++) { const x = b.x + Math.random() * b.width, y = b.y + Math.random() * b.height; if (document.elementFromPoint(x, y) === o.p) return { x, y }; }
      }
      return null;
    }, near, fills);
    if (!r) { console.log('  !! no patch path found'); return; }
    await d.moveTo({ xy: [r.x, r.y] }, 900); await sleep(400); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(400);
  };
  d.hoverPatch = async (near, fills) => {
    const r = await page.evaluate((near, fills) => { const c = [...document.querySelectorAll('.leaflet-overlay-pane path')].map(p => { const b = p.getBoundingClientRect(); return { f: (p.getAttribute('fill') || '').toLowerCase(), x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }; }).filter(o => fills.includes(o.f) && o.w > 4); c.sort((a, b) => Math.hypot(a.x - near[0], a.y - near[1]) - Math.hypot(b.x - near[0], b.y - near[1])); return c[0] || null; }, near, fills);
    if (r) await d.moveTo({ xy: [r.x + 14, r.y] }, 900);
  };
  d.ensureSelected = async id => {
    const ok = await page.evaluate(id => { const h = [...document.querySelectorAll('div,section')].find(e => (e.innerText || '').startsWith('Selected Patch')); return !!h && h.innerText.includes(id); }, id);
    if (!ok) { console.log('  re-selecting', id); await d.search(id); await sleep(1500); }
  };
  d.clickNode = async id => {
    const r = await page.evaluate(id => { const n = document.querySelector(`.react-flow__node[data-id="${id}"]`); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
    if (!r) { console.log('  !! node not found', id); await page.evaluate(id => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.startsWith(id)); b && b.click(); }, id); return; }
    await d.moveTo({ xy: [r.x, r.y] }, 900); await sleep(400); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(300);
  };
  d.overlay = async on => { await page.evaluate((on, html) => { let e = document.getElementById('__ov'); if (!on) { e && e.remove(); return; } e = document.createElement('div'); e.id = '__ov'; e.style.cssText = 'position:fixed;inset:0;z-index:2147483600'; e.innerHTML = html; document.body.appendChild(e); }, on, OVERLAY_HTML); await d.ensure(); };
  return d;
}

// ---------------------------------------------------------------- main
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 }, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  page.on('dialog', dlg => dlg.dismiss());
  await page.evaluateOnNewDocument(CURSOR_JS);
  // start signed out, on a clean slate
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' }); await page.evaluate(() => localStorage.clear());
  if (ONLY && ONLY[0] > 3) await page.evaluate(async () => { const r = await fetch('http://localhost:8000/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'demo1234' }) }); const j = await r.json(); localStorage.setItem('ecoconnect:token', j.token); });
  if (ONLY && ONLY[0] > 3) { await page.goto(BASE + '/command', { waitUntil: 'load' }); await sleep(4000); }
  const cdp = await page.createCDPSession();
  const d = driver(page);
  const meta = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (ONLY && !ONLY.includes(i)) continue;
    const s = STEPS[i];
    const a = tts(i, s.say);
        await d.chapter(s.ch);
    const fdir = path.join(CLIP, `f${String(i).padStart(2, '0')}`); fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir);
    const frames = []; let fn = 0;
    const onFrame = f => { const name = path.join(fdir, `${String(fn++).padStart(6, '0')}.jpg`); fs.writeFileSync(name, Buffer.from(f.data, 'base64')); frames.push({ t: f.metadata.timestamp, name }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => { }); };
    cdp.on('Page.screencastFrame', onFrame);
    const t0 = Date.now();
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 2 });
    page.__restartCast = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 2 }).catch(() => { });
    await sleep(250);
    try { await d.chapter(s.ch); await s.act(d); await d.chapter(s.ch); } catch (e) { console.log(`  !! step ${i} error: ${e.message}`); }
    const rest = a.dur * 1000 + 700 - (Date.now() - t0);
    if (rest > 0) await sleep(rest);
    const tEnd = Date.now();
    await cdp.send('Page.stopScreencast').catch(() => { }); cdp.off('Page.screencastFrame', onFrame);
    const vd = (tEnd - t0) / 1000;
    // ffconcat with wall-clock durations (first frame also covers the gap from t0)
    const lines = ['ffconcat version 1.0'];
    frames.forEach((f, k) => { const start = k === 0 ? t0 / 1000 : f.t; const next = k + 1 < frames.length ? frames[k + 1].t : tEnd / 1000; lines.push(`file '${f.name}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`); });
    if (frames.length) lines.push(`file '${frames[frames.length - 1].name}'`);
    fs.writeFileSync(path.join(fdir, 'list.ffconcat'), lines.join('\n'));
    meta.push({ i, dur: Math.max(vd, a.dur + 0.5), audio: a.f, list: path.join(fdir, 'list.ffconcat'), adur: a.dur, frames: frames.length });
    fs.writeFileSync(path.join(OUT, `meta_${String(i).padStart(2, '0')}.json`), JSON.stringify(meta[meta.length - 1]));
    console.log(`step ${String(i).padStart(2)} frames ${frames.length} audio ${a.dur.toFixed(1)}s video ${vd.toFixed(1)}s  ${s.ch}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
})();
