// Minimal Chrome DevTools Protocol driver (headless Chrome + Node >= 22 built-in WebSocket); no npm dependencies.
// Minimal CDP driver: launches headless Chrome, exposes nav/eval/shot.
import { spawn } from "node:child_process";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export async function launch({ w = 1920, h = 1080, port = 9333, dsf = 1 } = {}) {
  const opts_dsf = dsf;
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${process.cwd()}/chrome-profile`,
    `--window-size=${w},${h}`, "--hide-scrollbars", "--force-device-scale-factor=1", "--no-first-run", "--disable-gpu-vsync", "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (ver.length) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  const page = ver.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: opts_dsf, mobile: false });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const api = {
    send, sleep,
    async nav(url, wait = 3000) { await send("Page.navigate", { url }); await sleep(wait); },
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value; },
    async shot(file, opts = {}) { const r = await send("Page.captureScreenshot", { format: opts.format || "png", quality: opts.quality, captureBeyondViewport: false }); (await import("node:fs")).writeFileSync(file, Buffer.from(r.data, "base64")); },
    async click(x, y) { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); },
    async rect(js) { return await api.eval(`(()=>{const e=${js}; if(!e) return null; e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`); },
    async clickEl(js) { const r = await api.rect(js); if (!r) throw new Error("not found: " + js); await api.click(r.x, r.y); },
    async clean() { await api.eval(`(()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.appendChild(s);return 1})()`); },
    async close() { try { await send("Browser.close"); } catch {} proc.kill(); },
  };
  return api;
}
