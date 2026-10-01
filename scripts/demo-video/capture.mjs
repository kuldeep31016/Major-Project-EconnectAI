// Captures the real EcoConnectAI interface for the demo teaser. Needs the app running (API :8000, web :3000).
// Run from the work directory; writes PNGs next to composer.html.
import { launch } from "./cdp.mjs";
const B = process.env.APP_URL || "http://localhost:3000";

// Only two real screens appear in the story (shown still, no zoom): Command Center and Restoration Planner (C01 open).
const ui = await launch({ w: 1600, h: 900, dsf: 1.2 });
await ui.nav(B + "/command", 7000); await ui.clean(); await ui.shot("command.png");
await ui.nav(B + "/restoration", 7000); await ui.clean();
await ui.clickEl(`[...document.querySelectorAll('button,[role=button],li')].filter(e=>e.textContent.trim().startsWith('#1 C01')).pop()`); await ui.sleep(3000);
await ui.shot("restoration-c01.png");
await ui.close();
