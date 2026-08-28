import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config.js";
import { Brain, ConvoMsg } from "./brain.js";
import { speak } from "./tts.js";

const run = promisify(exec);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const vendorDir = join(__dirname, "..", "node_modules");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function sanitizePath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const p = decoded === "/" ? "/index.html" : decoded;
  return normalize(join(publicDir, p));
}

/* ==================== SYSTEM STATS ==================== */
async function getSystemStats() {
  const stats: Record<string, number> = {};
  try { const { stdout } = await run("pmset -g batt"); const m = stdout.match(/(\d+)%/); stats.battery = m ? parseInt(m[1], 10) : -1; } catch { stats.battery = -1; }
  try {
    const { stdout } = await run("sysctl hw.memsize"); const memMatch = stdout.match(/hw\.memsize:\s+(\d+)/); const totalMem = memMatch ? parseInt(memMatch[1], 10) : 0;
    if (totalMem > 0) { const { stdout: vm } = await run("vm_stat"); const pa = parseInt((vm.match(/Pages active:\s+(\d+)/) || [])[1] || "0", 10); const pw = parseInt((vm.match(/Pages wired down:\s+(\d+)/) || [])[1] || "0", 10); stats.memory = Math.round(((pa + pw) * 16384 / totalMem) * 100); }
    try { const { stdout: topOut } = await run("top -l 1 -n 0 | grep 'CPU usage'"); const cm = topOut.match(/(\d+\.?\d*)%/); stats.cpu = cm ? Math.round(parseFloat(cm[1])) : 0; } catch { stats.cpu = 0; }
  } catch { stats.memory = -1; stats.cpu = -1; }
  try { const { stdout } = await run("df -h / | tail -1"); const parts = stdout.trim().split(/\s+/); stats.disk = parseInt(parts[4] || "0", 10); } catch { stats.disk = -1; }
  return stats;
}

/* ==================== WEATHER ==================== */
const WORLD_CITIES = [
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "Dubai", lat: 25.20, lon: 55.27 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Berlin", lat: 52.52, lon: 13.41 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Seoul", lat: 37.57, lon: 126.98 },
  { name: "Hyderabad", lat: 17.39, lon: 78.49 },
];

const WMO_CODES: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Slight showers", 81: "Moderate showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm" };

async function getWeather() {
  const results: Record<string, unknown>[] = [];
  const lats = WORLD_CITIES.map(c => c.lat).join(",");
  const lons = WORLD_CITIES.map(c => c.lon).join(",");
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const { stdout } = await run(`curl -s --max-time 8 '${url}'`);
    const data = JSON.parse(stdout);
    const items = Array.isArray(data) ? data : [data];
    for (let i = 0; i < WORLD_CITIES.length && i < items.length; i++) {
      const city = WORLD_CITIES[i], wx = items[i]?.current;
      if (wx) results.push({ city: city.name, temp: Math.round(wx.temperature_2m ?? 0), humidity: wx.relative_humidity_2m ?? 0, wind: Math.round(wx.wind_speed_10m ?? 0), condition: WMO_CODES[wx.weather_code ?? 0] ?? "Unknown", code: wx.weather_code ?? 0 });
    }
  } catch { for (const city of WORLD_CITIES) results.push({ city: city.name, temp: 0, humidity: 0, wind: 0, condition: "Unavailable", code: 0 }); }
  return results;
}

/* ==================== MARKET DATA ==================== */
const STOCK_SYMBOLS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "BTC-USD", "ETH-USD", "^GSPC"];

async function getMarket() {
  const stocks: { symbol: string; price: string; change: number }[] = [];

  // Fetch stocks in parallel using v8 chart API (v7 quote is rate-limited)
  const stockPromises = STOCK_SYMBOLS.filter(s => !s.includes("BTC") && !s.includes("ETH")).map(async (sym) => {
    try {
      const { stdout } = await run(`curl -s --max-time 8 -H 'User-Agent: Mozilla/5.0' 'https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d' 2>/dev/null || true`);
      if (!stdout) return null;
      const data = JSON.parse(stdout);
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0;
      return { symbol: sym, price: price ? price.toFixed(2) : "--", change };
    } catch { return null; }
  });

  // Fetch crypto from CoinGecko (free, no key)
  const cryptoPromise = (async () => {
    try {
      const { stdout } = await run(`curl -s --max-time 8 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true' 2>/dev/null || true`);
      if (!stdout) return [];
      const data = JSON.parse(stdout);
      const results: { symbol: string; price: string; change: number }[] = [];
      if (data.bitcoin) results.push({ symbol: "BTC", price: data.bitcoin.usd?.toLocaleString() ?? "--", change: parseFloat((data.bitcoin.usd_24h_change ?? 0).toFixed(2)) });
      if (data.ethereum) results.push({ symbol: "ETH", price: data.ethereum.usd?.toLocaleString() ?? "--", change: parseFloat((data.ethereum.usd_24h_change ?? 0).toFixed(2)) });
      return results;
    } catch { return []; }
  })();

  const [stockResults, cryptoResults] = await Promise.all([
    Promise.all(stockPromises),
    cryptoPromise,
  ]);

  for (const r of stockResults) { if (r) { r.symbol = r.symbol === "^GSPC" ? "S&P 500" : r.symbol; stocks.push(r); } }
  stocks.push(...cryptoResults);

  if (stocks.length === 0) {
    for (const s of STOCK_SYMBOLS) stocks.push({ symbol: s.replace("-USD", "").replace("^", ""), price: "--", change: 0 });
  }

  return { stocks };
}

/* ==================== BREAKING NEWS ==================== */
async function getBreaking() {
  const items: { title: string; source: string; alert: boolean }[] = [];
  const feeds = [
    { name: "BBC Alerts", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { name: "CNN Breaking", url: "http://rss.cnn.com/rss/edition.rss" },
    { name: "Reuters", url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best" },
  ];

  const seenTitles = new Set<string>();
  for (const feed of feeds) {
    try {
      const { stdout } = await run(`curl -s --max-time 5 -L '${feed.url}' 2>/dev/null || true`);
      const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
      let match; let count = 0;
      while ((match = regex.exec(stdout)) !== null && count < 3) {
        const title = (match[1] || match[2] || "").trim();
        if (!title || title.length < 10 || title.includes("RSS") || title.includes("<")) continue;
        const lower = title.toLowerCase();
        const skip = ["bbc news", "cnn", "reuters", "reuters news agency", "top stories", "breaking news", "latest news", "home", "menu"];
        if (skip.some(s => lower === s || lower.startsWith(s + " -"))) continue;
        const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTitles.has(normalized)) continue;
        seenTitles.add(normalized);
        const alert = lower.includes("breaking") || lower.includes("emergency") || lower.includes("accident") || lower.includes("killed") || lower.includes("earthquake") || lower.includes("flood") || lower.includes("war") || lower.includes("attack") || lower.includes("crash") || lower.includes("dead");
        items.push({ title, source: feed.name, alert });
        count++;
      }
    } catch { /* skip */ }
  }

  if (items.length === 0) items.push({ title: "Scanning global feeds for alerts...", source: "System", alert: false });
  return { items: items.slice(0, 10) };
}

/* ==================== TECH NEWS ==================== */
const TECH_SOURCES = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Wired", url: "https://www.wired.com/feed/rss" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { name: "Hacker News", url: "https://hnrss.org/frontpage?points=50" },
];

async function getTechNews() {
  const items: { title: string; source: string; link: string }[] = [];
  const seenTitles = new Set<string>();
  await Promise.allSettled(TECH_SOURCES.map(async (feed) => {
    try {
      const { stdout } = await run(`curl -s --max-time 6 -L '${feed.url}' 2>/dev/null || true`);
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
      const linkRegex = /<link>(.*?)<\/link>/g;
      const titles: string[] = [];
      const skip = ["rss", "home", "menu", "top stories", "breaking news", "latest news", "all content"];
      let match;
      while ((match = titleRegex.exec(stdout)) !== null) { const t = (match[1] || match[2] || "").trim(); if (t && t.length > 10 && !t.includes("RSS") && !t.includes("<") && !skip.some(s => t.toLowerCase().includes(s))) titles.push(t); }
      const links: string[] = [];
      while ((match = linkRegex.exec(stdout)) !== null) { const l = (match[1] || "").trim(); if (l && l.startsWith("http")) links.push(l); }
      let count = 0;
      for (let i = 0; i < titles.length && count < 3; i++) {
        const normalized = titles[i].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTitles.has(normalized)) continue;
        seenTitles.add(normalized);
        const clean = titles[i].replace(/&#\d+;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
        items.push({ title: clean, source: feed.name, link: links[i] || "#" });
        count++;
      }
    } catch { /* skip */ }
  }));
  if (items.length === 0) items.push({ title: "Scanning tech feeds...", source: "System", link: "#" });
  return { items: items.slice(0, 15) };
}

/* ==================== GLOBAL NEWS ==================== */
const NEWS_SOURCES = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "Europe" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "Middle East" },
  { name: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss", region: "Americas" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", region: "Europe" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", region: "Americas" },
  { name: "NHK World", url: "https://www3.nhk.or.jp/rss/news/cat0.xml", region: "Asia" },
];

const fallbackHeadlines = ["System initialized — all modules online", "Neural network loaded — ready for interaction", "Voice recognition active — listening for commands", "Quantum core synchronized — processing available", "Security protocols engaged — all channels secure", "Data streams nominal — no anomalies detected", "Memory banks indexed — search functions ready", "Global network handshake complete — connectivity stable"];

function parseRSS(xml: string, sourceName: string, region: string, maxItems: number) {
  const items: { title: string; source: string; region: string }[] = [];
  const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
  let match; let count = 0;
  const skip = ["bbc news", "cnn", "reuters", "reuters news agency", "al jazeera", "the guardian", "npr", "nhk", "top stories", "breaking news", "latest news", "home", "menu", "rss"];
  while ((match = regex.exec(xml)) !== null && count < maxItems) {
    const title = (match[1] || match[2] || "").trim();
    if (!title || title.length < 10 || title.includes("<")) continue;
    const lower = title.toLowerCase();
    if (skip.some(s => lower === s || lower.startsWith(s + " -"))) continue;
    items.push({ title, source: sourceName, region }); count++;
  }
  return items;
}

async function getGlobalNews() {
  const allItems: { title: string; source: string; region: string }[] = [];
  const sources: Record<string, string[]> = {};
  const regions: Record<string, number> = {};
  await Promise.allSettled(NEWS_SOURCES.map(async (src) => {
    try {
      const { stdout } = await run(`curl -s --max-time 6 -L '${src.url}' 2>/dev/null || true`);
      const items = parseRSS(stdout, src.name, src.region, 5);
      sources[src.name] = items.map(i => i.title);
      items.forEach(i => { allItems.push(i); regions[i.region] = (regions[i.region] || 0) + 1; });
    } catch { sources[src.name] = []; }
  }));
  if (allItems.length === 0) return { headlines: fallbackHeadlines, sources: { System: fallbackHeadlines }, regions: { Global: 1 } };
  for (let i = allItems.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [allItems[i], allItems[j]] = [allItems[j], allItems[i]]; }
  return { headlines: allItems.slice(0, 30).map(i => `[${i.source}] ${i.title}`), sources, regions };
}

/* quality inspection */
let inspectionCount = 0;
function logInspection(label: string, ok: boolean, detail?: string) {
  inspectionCount++;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[inspect ${ts}] #${inspectionCount} ${ok ? "PASS" : "FAIL"} — ${label}${detail ? " — " + detail : ""}`);
}

export function startServer(brain: Brain): void {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = req.url ?? "/";

      if (rawPath === "/api/stats") {
        const stats = await getSystemStats();
        logInspection("system-stats", stats.battery !== -1);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(stats)); return;
      }
      if (rawPath === "/api/weather") {
        const weather = await getWeather();
        logInspection("weather", weather.length > 0 && weather[0].temp !== 0, `${weather.length} cities`);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ cities: weather })); return;
      }
      if (rawPath === "/api/news") {
        const news = await getGlobalNews();
        logInspection("global-news", news.headlines.length > 0, `${news.headlines.length} headlines`);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(news)); return;
      }
      if (rawPath === "/api/market") {
        const market = await getMarket();
        logInspection("market", market.stocks.length > 0, `${market.stocks.length} stocks`);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(market)); return;
      }
      if (rawPath === "/api/breaking") {
        const breaking = await getBreaking();
        logInspection("breaking", breaking.items.length > 0, `${breaking.items.length} alerts`);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(breaking)); return;
      }
      if (rawPath === "/api/tech") {
        const tech = await getTechNews();
        logInspection("tech-news", tech.items.length > 0, `${tech.items.length} items`);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(tech)); return;
      }
      if (rawPath === "/api/inspect") {
        const results: Record<string, boolean> = {};
        try { await getSystemStats(); results.systemStats = true; } catch { results.systemStats = false; }
        try { const w = await getWeather(); results.weather = w.length > 0; } catch { results.weather = false; }
        try { const n = await getGlobalNews(); results.globalNews = n.headlines.length > 0; } catch { results.globalNews = false; }
        try { const m = await getMarket(); results.market = m.stocks.length > 0; } catch { results.market = false; }
        try { const b = await getBreaking(); results.breaking = b.items.length > 0; } catch { results.breaking = false; }
        const allOk = Object.values(results).every(Boolean);
        logInspection("full-inspection", allOk, JSON.stringify(results));
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ pass: allOk, results, inspections: inspectionCount })); return;
      }

      if (rawPath.startsWith("/vendor/")) {
        const vp = normalize(join(vendorDir, rawPath.slice("/vendor/".length)));
        if (vp.startsWith(vendorDir)) { const data = await readFile(vp); res.writeHead(200, { "Content-Type": MIME[extname(vp)] ?? "application/octet-stream", "Cache-Control": "no-store" }); res.end(data); return; }
        res.writeHead(403); res.end("Forbidden"); return;
      }

      const filePath = sanitizePath(rawPath);
      if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end("Forbidden"); return; }
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    } catch { res.writeHead(404); res.end("Not found"); }
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    console.log("[ws] client connected");
    let audioReply = config.audioReply;
    ws.send(JSON.stringify({ type: "config", name: config.name, wakeWords: config.wakeWords, audioReply }));
    ws.on("message", async (raw) => {
      let msg: { type: string; text?: string; enabled?: boolean };
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.type === "ping") { ws.send(JSON.stringify({ type: "pong" })); return; }
      if (msg.type === "voice") { audioReply = msg.enabled !== false; return; }
      if (msg.type === "speech" && msg.text) {
        const text = msg.text.trim();
        console.log(`[in]  ${text}`);
        ws.send(JSON.stringify({ type: "thinking" }));
        try {
          const replyMsg: ConvoMsg = await brain.respond(text, []);
          const reply = replyMsg.content ?? "";
          if (reply.trim()) { console.log(`[out] ${reply}`); ws.send(JSON.stringify({ type: "reply", text: reply, source: brain.hasLLM ? "llm" : "local" })); if (audioReply) void speak(reply); }
          else { ws.send(JSON.stringify({ type: "reply", text: "", silent: true })); }
        } catch (e) { ws.send(JSON.stringify({ type: "reply", text: `I hit an error: ${e instanceof Error ? e.message : String(e)}` })); }
      }
    });
    ws.on("close", () => console.log("[ws] client disconnected"));
  });

  setInterval(async () => {
    try {
      const results: Record<string, boolean> = {};
      try { await getSystemStats(); results.systemStats = true; } catch { results.systemStats = false; }
      try { const w = await getWeather(); results.weather = w.length > 0; } catch { results.weather = false; }
      try { const n = await getGlobalNews(); results.globalNews = n.headlines.length > 0; } catch { results.globalNews = false; }
      logInspection("periodic", Object.values(results).every(Boolean));
    } catch {}
  }, 60000);

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`\n  ${config.name} is online.`);
    console.log(`  Local:   http://127.0.0.1:${config.port}`);
    console.log(`  Network: http://${getLocalIP()}:${config.port}\n`);
  });
}
