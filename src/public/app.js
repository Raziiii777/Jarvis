(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    brand: $("brand-name"), conn: $("conn-status"), status: $("status-text"),
    log: $("log"), live: $("live"),
    btnListen: $("btn-listen"), toggleAlways: $("toggle-always"), toggleVoice: $("toggle-voice"),
    typeBox: $("type-box"), btnSend: $("btn-send"), toast: $("toast"),
    clockTime: $("clock-time"), clockAmPm: $("clock-ampm"),
    clockDate: $("clock-date"), clockDay: $("clock-day"),
    sysBattery: $("sys-battery"), sysMemory: $("sys-memory"),
    sysCpu: $("sys-cpu"), sysDisk: $("sys-disk"),
    sysBatteryBar: $("sys-battery-bar"), sysMemoryBar: $("sys-memory-bar"),
    sysCpuBar: $("sys-cpu-bar"), sysDiskBar: $("sys-disk-bar"),
    sysUptime: $("sys-uptime"),
    memoryStream: $("memory-stream"), tickerText: $("ticker-text"),
    matrixBg: $("matrix-bg"),
    localTemp: $("local-temp"), localCond: $("local-cond"),
    weatherGrid: $("weather-grid"),
    marketList: $("market-list"),
    techList: $("tech-list"),
    breakingList: $("breaking-list"),
    radioPlay: $("radio-play"), radioIcon: $("radio-icon"),
    radioStation: $("radio-station"), radioStatus: $("radio-status"),
  };

  const cfg = { name: "JARVIS", wakeWords: ["jarvis", "hey jarvis"], audioReply: true };
  const state = { alwaysListen: true, pushMode: false, armed: false, thinking: false, speaking: false };
  let ws = null, recog = null, recogStarted = false, utterance = "";
  let processTimer = null, pushTimer = null, armedTimer = null, speechBlockUntil = 0;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ==================== I18N ==================== */
  let currentLang = "en";
  const i18n = {
    en: { system_status:"SYSTEM STATUS", battery:"Battery", memory:"Memory", cpu:"CPU", disk:"Disk", uptime:"Uptime", global_weather:"GLOBAL WEATHER", local:"Local", us_stocks:"US MARKETS", memory_stream:"MEMORY STREAM", world_map:"WORLD MAP", active_node:"Active Node", weather_station:"Weather Station", news_source:"News Source", communication_log:"COMMUNICATION LOG", type_command:"Type a command...", world_regions:"WORLD REGIONS", tech_news:"TECHNOLOGY", breaking_news:"BREAKING NEWS", live_radio:"LIVE RADIO", standby:"STANDBY", listening:"LISTENING", thinking:"THINKING", replying:"REPLYING" },
    hi: { system_status:"सिस्टम स्थिति", battery:"बैटरी", memory:"मेमोरी", cpu:"सीपीयू", disk:"डिस्क", uptime:"अपटाइम", global_weather:"विश्व मौसम", local:"स्थानीय", us_stocks:"अमेरिकी बाज़ार", memory_stream:"मेमोरी स्ट्रीम", world_map:"विश्व मानचित्र", communication_log:"संचार लॉग", type_command:"कमांड टाइप करें...", world_regions:"विश्व क्षेत्र", tech_news:"तकनीक", breaking_news:"ताज़ा ख़बर", live_radio:"लाइव रेडियो", standby:"तैयार", listening:"सुन रहा हूँ", thinking:"सोच रहा हूँ", replying:"बोल रहा हूँ" },
    ur: { system_status:"سسٹم حالت", battery:"بیٹری", memory:"میموری", cpu:"سی پی یو", disk:"ڈسک", uptime:"آپ ٹائم", global_weather:"عالمی موسم", local:"مقامی", us_stocks:"امریکی بازار", memory_stream:"میموری سٹریم", world_map:"عالمی نقشہ", communication_log:"کمیونیکیشن لاگ", type_command:"کمانڈ ٹائپ کریں...", world_regions:"عالمی علاقے", tech_news:"ٹیکنالوجی", breaking_news:"بریکنگ نیوز", live_radio:"لائیو ریڈیو", standby:"تیار", listening:"سن رہا ہوں", thinking:"سوچ رہا ہوں", replying:"بول رہا ہوں" },
    zh: { system_status:"系统状态", battery:"电池", memory:"内存", cpu:"处理器", disk:"磁盘", uptime:"运行时间", global_weather:"全球天气", local:"本地", us_stocks:"美国市场", memory_stream:"内存流", world_map:"世界地图", communication_log:"通信日志", type_command:"输入命令...", world_regions:"世界区域", tech_news:"科技", breaking_news:"突发新闻", live_radio:"直播电台", standby:"待命", listening:"监听中", thinking:"思考中", replying:"回复中" },
    ja: { system_status:"システムステータス", battery:"バッテリー", memory:"メモリ", cpu:"CPU", disk:"ディスク", uptime:"稼働時間", global_weather:"世界の天気", local:"ローカル", us_stocks:"米国市場", memory_stream:"メモリストリーム", world_map:"世界地図", communication_log:"通信ログ", type_command:"コマンドを入力...", world_regions:"世界の地域", tech_news:"テクノロジー", breaking_news:"速報", live_radio:"ライブラジオ", standby:"待機中", listening:"受信中", thinking:"思考中", replying:"応答中" },
  };

  function setLang(lang) {
    currentLang = lang;
    const t = i18n[lang] || i18n.en;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (t[key]) el.placeholder = t[key];
    });
    if (lang === "ur") document.documentElement.setAttribute("dir", "rtl");
    else document.documentElement.removeAttribute("dir");
  }
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setLang(btn.dataset.lang);
    });
  });

  /* ==================== MATRIX RAIN ==================== */
  function initMatrix() {
    const canvas = els.matrixBg, ctx = canvas.getContext("2d");
    let w, h, columns, drops;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}[]|/<>~";
    const fontSize = 14;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; columns = Math.floor(w / fontSize); drops = Array(columns).fill(1); }
    function draw() {
      ctx.fillStyle = "rgba(4,6,13,0.06)"; ctx.fillRect(0, 0, w, h);
      ctx.font = fontSize + "px monospace";
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize, y = drops[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.7 ? "#7df4ff" : Math.random() > 0.4 ? "#2fd6ff" : "rgba(47,214,255,0.4)";
        ctx.fillText(char, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    resize(); window.addEventListener("resize", resize); setInterval(draw, 50);
  }

  /* ==================== CLOCK ==================== */
  function updateClock() {
    const now = new Date();
    let h = now.getHours(); const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    els.clockTime.textContent = `${h}:${m}:${s}`;
    els.clockAmPm.textContent = ap;
    els.clockDate.textContent = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }).toUpperCase();
    els.clockDay.textContent = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  }

  /* ==================== SYSTEM STATS ==================== */
  let uptimeStart = Date.now();
  async function fetchStats() {
    try {
      const res = await fetch("/api/stats"); if (!res.ok) return;
      const d = await res.json();
      if (d.battery >= 0) { els.sysBattery.textContent = d.battery + "%"; els.sysBatteryBar.style.width = d.battery + "%"; els.sysBatteryBar.style.background = d.battery < 20 ? "var(--danger)" : "var(--cyan)"; }
      if (d.memory >= 0) { els.sysMemory.textContent = d.memory + "%"; els.sysMemoryBar.style.width = d.memory + "%"; }
      if (d.cpu >= 0) { els.sysCpu.textContent = d.cpu + "%"; els.sysCpuBar.style.width = d.cpu + "%"; }
      if (d.disk >= 0) { els.sysDisk.textContent = d.disk + "%"; els.sysDiskBar.style.width = d.disk + "%"; }
    } catch {}
  }
  function updateUptime() {
    const e = Math.floor((Date.now() - uptimeStart) / 1000);
    const hh = Math.floor(e / 3600), mm = Math.floor((e % 3600) / 60), ss = e % 60;
    els.sysUptime.textContent = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  }

  /* ==================== MEMORY STREAM ==================== */
  const memChars = "01アイウエオカキクケコ{}[]<>/\\|=+-*&^%$#@!";
  let memLines = [];
  function addMemLine() {
    let line = ""; const len = 10 + Math.floor(Math.random() * 18);
    for (let i = 0; i < len; i++) line += memChars[Math.floor(Math.random() * memChars.length)];
    memLines.push(line); if (memLines.length > 12) memLines.shift();
    els.memoryStream.textContent = memLines.join("\n");
  }

  /* ==================== WORLD MAP (Leaflet) ==================== */
  let map = null, mapMarkers = [];
  function initMap() {
    if (!window.L) { console.warn("Leaflet not loaded"); return; }
    map = L.map("world-map", {
      center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 8,
      zoomControl: false, attributionControl: false, scrollWheelZoom: true,
      worldCopyJump: true
    });
    /* blue-tinted map: use standard OSM tiles (reliable) + CSS makes it blue */
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: "abc", maxZoom: 19
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    /* fix size after layout settles so map isn't black */
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    setTimeout(() => { if (map) map.invalidateSize(); }, 1000);
    window.addEventListener("resize", () => { if (map) map.invalidateSize(); });

    // Add weather cities
    const cities = [
      { name: "New York", lat: 40.71, lon: -74.01 },
      { name: "London", lat: 51.51, lon: -0.13 },
      { name: "Tokyo", lat: 35.68, lon: 139.69 },
      { name: "Sydney", lat: -33.87, lon: 151.21 },
      { name: "Dubai", lat: 25.20, lon: 55.27 },
      { name: "Singapore", lat: 1.35, lon: 103.82 },
      { name: "Mumbai", lat: 19.08, lon: 72.88 },
      { name: "Berlin", lat: 52.52, lon: 13.41 },
      { name: "Sao Paulo", lat: -23.55, lon: -46.63 },
      { name: "Lagos", lat: 6.52, lon: 3.38 },
      { name: "Seoul", lat: 37.57, lon: 126.98 },
      { name: "Hyderabad", lat: 17.39, lon: 78.49 },
    ];
    const newsHubs = [
      { name: "BBC London", lat: 51.51, lon: -0.13 },
      { name: "CNN Atlanta", lat: 33.75, lon: -84.39 },
      { name: "NHK Tokyo", lat: 35.68, lon: 139.69 },
    ];
    const techHubs = [
      { name: "Silicon Valley", lat: 37.39, lon: -122.08 },
      { name: "Shenzhen", lat: 22.54, lon: 114.06 },
      { name: "Bangalore", lat: 12.97, lon: 77.59 },
    ];

    const cyanIcon = L.divIcon({ className: "", html: '<div style="width:8px;height:8px;border-radius:50%;background:#2fd6ff;box-shadow:0 0 8px #2fd6ff;border:1px solid rgba(47,214,255,0.5);"></div>', iconSize: [8, 8], iconAnchor: [4, 4] });
    const greenIcon = L.divIcon({ className: "", html: '<div style="width:7px;height:7px;border-radius:50%;background:#00ff88;box-shadow:0 0 6px #00ff88;"></div>', iconSize: [7, 7], iconAnchor: [4, 4] });
    const amberIcon = L.divIcon({ className: "", html: '<div style="width:7px;height:7px;border-radius:50%;background:#ffb900;box-shadow:0 0 6px #ffb900;"></div>', iconSize: [7, 7], iconAnchor: [4, 4] });

    cities.forEach(c => {
      const m = L.marker([c.lat, c.lon], { icon: cyanIcon }).addTo(map).bindPopup('<b>' + c.name + '</b><br>Loading weather...');
      mapMarkers.push({ marker: m, city: c.name, type: "weather" });
    });
    newsHubs.forEach(c => L.marker([c.lat, c.lon], { icon: amberIcon }).addTo(map).bindPopup('<b>' + c.name + '</b><br>News Source'));
    techHubs.forEach(c => L.marker([c.lat, c.lon], { icon: greenIcon }).addTo(map).bindPopup('<b>' + c.name + '</b><br>Tech Hub'));
  }

  function updateMapWeather(weatherData) {
    if (!map || !weatherData) return;
    weatherData.forEach(wx => {
      const entry = mapMarkers.find(m => m.city === wx.city && m.type === "weather");
      if (entry) {
        entry.marker.setPopupContent('<b>' + wx.city + '</b><br>' + wx.temp + '°C — ' + wx.condition + '<br>Wind: ' + wx.wind + ' km/h | Humidity: ' + wx.humidity + '%');
      }
    });
  }

  /* ==================== WEATHER ==================== */
  function tempClass(t) { return t >= 35 ? "hot" : t >= 25 ? "warm" : t <= 10 ? "cold" : ""; }
  async function fetchWeather() {
    try {
      const res = await fetch("/api/weather"); if (!res.ok) return;
      const data = await res.json();
      if (!data.cities?.length) return;
      const local = data.cities.find(c => c.city === "Hyderabad") || data.cities[0];
      if (local) { els.localTemp.textContent = local.temp + "°C"; els.localCond.textContent = local.condition; }
      els.weatherGrid.innerHTML = "";
      for (const city of data.cities) {
        const div = document.createElement("div"); div.className = "wx-city";
        div.innerHTML = '<span class="wx-name">' + city.city + '</span><span class="wx-temp ' + tempClass(city.temp) + '">' + city.temp + '°</span><span class="wx-cond">' + city.condition + '</span>';
        els.weatherGrid.appendChild(div);
      }
      updateMapWeather(data.cities);
    } catch {}
  }

  /* ==================== MARKET DATA ==================== */
  async function fetchMarket() {
    try {
      const res = await fetch("/api/market"); if (!res.ok) return;
      const data = await res.json();
      if (!data.stocks?.length) return;
      els.marketList.innerHTML = "";
      for (const stock of data.stocks) {
        const row = document.createElement("div"); row.className = "market-row";
        const dir = stock.change >= 0 ? "up" : "down";
        const sign = stock.change >= 0 ? "+" : "";
        row.innerHTML = '<span class="market-sym">' + stock.symbol + '</span><span class="market-price">$' + stock.price + '</span><span class="market-change ' + dir + '">' + sign + stock.change + '%</span>';
        els.marketList.appendChild(row);
      }
    } catch {}
  }

  /* ==================== TECH NEWS ==================== */
  async function fetchTech() {
    try {
      const res = await fetch("/api/tech"); if (!res.ok) return;
      const data = await res.json();
      if (!data.items?.length) return;
      els.techList.innerHTML = "";
      for (const item of data.items) {
        const div = document.createElement("div"); div.className = "news-item";
        div.innerHTML = '<span class="news-source">' + item.source + '</span> ' + item.title;
        if (item.link && item.link !== "#") { div.style.cursor = "pointer"; div.addEventListener("click", () => window.open(item.link, "_blank")); }
        els.techList.appendChild(div);
      }
    } catch {}
  }

  /* ==================== BREAKING NEWS ==================== */
  async function fetchBreaking() {
    try {
      const res = await fetch("/api/breaking"); if (!res.ok) return;
      const data = await res.json();
      if (!data.items?.length) return;
      els.breakingList.innerHTML = "";
      for (const item of data.items) {
        const div = document.createElement("div");
        div.className = "news-item" + (item.alert ? " alert" : "");
        div.innerHTML = '<span class="news-source">' + item.source + '</span> ' + item.title;
        els.breakingList.appendChild(div);
      }
    } catch {}
  }

  /* ==================== NEWS TICKER ==================== */
  const defaultHeadlines = ["System initialized - all modules online", "Neural network loaded - ready for interaction", "Voice recognition active - listening for commands", "Quantum core synchronized - processing available", "Security protocols engaged - all channels secure", "Data streams nominal - no anomalies detected", "Memory banks indexed - search functions ready", "Global network handshake complete - connectivity stable"];
  let currentHeadlines = [...defaultHeadlines], headlineIndex = 0;
  function rotateHeadline() { headlineIndex = (headlineIndex + 1) % currentHeadlines.length; els.tickerText.textContent = currentHeadlines[headlineIndex]; }
  async function fetchNews() {
    try {
      const res = await fetch("/api/news"); if (!res.ok) return;
      const data = await res.json();
      if (data.headlines?.length > 0) { currentHeadlines = data.headlines; headlineIndex = 0; els.tickerText.textContent = currentHeadlines[0]; }
      if (data.regions) {
        const map = { "Americas": "region-americas", "Europe": "region-europe", "Middle East": "region-mideast", "Asia": "region-asia", "Global": "region-global" };
        for (const [r, c] of Object.entries(data.regions)) { const el = $(map[r]); if (el) el.textContent = c; }
      }
    } catch {}
  }

  /* ==================== RADIO ==================== */
  let audio = null, playing = false;
  function setupRadio() {
    document.querySelectorAll(".radio-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".radio-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        els.radioStation.textContent = btn.textContent;
        if (playing) stopRadio();
        playRadio(btn.dataset.stream);
      });
    });
    els.radioPlay.addEventListener("click", () => {
      if (playing) { stopRadio(); } else {
        const active = document.querySelector(".radio-btn.active");
        playRadio(active?.dataset.stream || "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service");
      }
    });
  }
  function playRadio(url) {
    if (audio) { audio.pause(); audio = null; }
    audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.play().then(() => {
      playing = true;
      els.radioIcon.classList.add("playing");
      els.radioStatus.textContent = "PLAYING";
      els.radioStatus.style.color = "var(--green)";
      els.radioPlay.textContent = "⏸";
    }).catch(() => {
      els.radioStatus.textContent = "BLOCKED - CLICK TO RETRY";
      els.radioStatus.style.color = "var(--amber)";
    });
    audio.onerror = () => { playing = false; els.radioIcon.classList.remove("playing"); els.radioStatus.textContent = "STREAM ERROR"; els.radioStatus.style.color = "var(--danger)"; els.radioPlay.textContent = "▶"; };
  }
  function stopRadio() {
    if (audio) { audio.pause(); audio = null; }
    playing = false;
    els.radioIcon.classList.remove("playing");
    els.radioStatus.textContent = "PAUSED";
    els.radioStatus.style.color = "var(--text-dim)";
    els.radioPlay.textContent = "▶";
  }

  /* ==================== WEBSOCKET ==================== */
  function connect() {
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => { els.conn.textContent = "ONLINE"; els.conn.classList.add("badge-on"); els.conn.classList.remove("badge-off"); toast("Connected to " + cfg.name); };
    ws.onclose = () => { els.conn.textContent = "OFFLINE"; els.conn.classList.remove("badge-on"); els.conn.classList.add("badge-off"); setState("idle"); setTimeout(connect, 1500); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "config") { cfg.name = (m.name || "Jarvis").toUpperCase(); cfg.wakeWords = m.wakeWords || cfg.wakeWords; cfg.audioReply = m.audioReply !== false; els.toggleVoice.checked = cfg.audioReply; els.brand.textContent = cfg.name; }
      else if (m.type === "thinking") { setState("thinking"); }
      else if (m.type === "reply") { if (m.silent) { setState("listening"); return; } setState("speaking"); addLog("jarvis", m.text); const ms = Math.min(4000, 700 + m.text.length * 45); speechBlockUntil = Date.now() + ms + 1200; setTimeout(() => setState("listening"), ms); }
    };
  }

  /* ==================== SPEECH RECOGNITION ==================== */
  function initRecognition() {
    if (!SR) { toast("Speech recognition not supported. Use Safari or Chrome."); els.btnListen.disabled = true; return; }
    recog = new SR(); recog.continuous = true; recog.interimResults = true; recog.lang = "en-US";
    recog.onresult = (event) => {
      let finals = [], interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) { const r = event.results[i]; if (r.isFinal) finals.push(r[0].transcript.trim()); else interim += r[0].transcript; }
      els.live.textContent = interim ? "... " + interim : "";
      for (const seg of finals) { if (seg) handleFinal(seg); }
    };
    recog.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Microphone permission denied."); else if (e.error !== "aborted") toast("Speech error: " + e.error); };
    recog.onend = () => { recogStarted = false; if (!state.thinking && !state.speaking) setState("idle"); autoRestart(); };
    try { recog.start(); recogStarted = true; } catch {}
  }
  function autoRestart() { if (!recog || !document.hasFocus()) return; setTimeout(() => { if (!recogStarted && recog) { try { recog.start(); recogStarted = true; } catch {} } }, 400); }
  function handleFinal(seg) {
    if (Date.now() < speechBlockUntil) return;
    const lower = seg.toLowerCase().trim(); if (!lower) return;
    if (!state.pushMode && !state.alwaysListen && !state.armed) { const w = matchWake(lower); if (!w) return; state.armed = true; keepArmed(); const cmd = stripWake(lower, w); if (cmd) appendCommand(cmd); return; }
    appendCommand(lower);
  }
  function appendCommand(seg) { utterance = (utterance ? utterance + " " : "") + seg; els.live.textContent = "... " + utterance; clearTimeout(processTimer); processTimer = setTimeout(processUtterance, 1600); }
  function processUtterance() { const t = utterance.trim(); utterance = ""; els.live.textContent = ""; if (t) sendSpeech(t); if (!state.alwaysListen) state.armed = false; clearTimeout(pushTimer); }
  function keepArmed() { clearTimeout(armedTimer); armedTimer = setTimeout(() => { state.armed = false; }, 30000); }
  function matchWake(text) { for (const w of cfg.wakeWords) { const idx = text.indexOf(w); if (idx >= 0 && idx <= 6) return w; } return null; }
  function stripWake(text, w) { const idx = text.indexOf(w); if (idx < 0) return text; return text.slice(idx + w.length).replace(/^[\s,.:]+/, "").trim(); }
  function sendSpeech(text) { addLog("you", text); if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: "speech", text })); setState("thinking"); } }

  /* ==================== UI STATE ==================== */
  function setState(s) {
    const t = i18n[currentLang] || i18n.en;
    const map = { idle: t.standby || "STANDBY", listening: t.listening || "LISTENING", thinking: t.thinking || "THINKING", speaking: t.replying || "REPLYING" };
    document.body.className = "state-" + (s === "idle" || s === "listening" || s === "thinking" || s === "speaking" ? s : "idle");
    els.status.textContent = map[s] || "STANDBY";
  }
  function addLog(who, text) {
    const row = document.createElement("div"); row.className = "msg " + who;
    const whoEl = document.createElement("span"); whoEl.className = "who"; whoEl.textContent = who === "you" ? "YOU" : cfg.name;
    const body = document.createElement("span"); body.className = "body"; body.textContent = text;
    row.append(whoEl, body); els.log.appendChild(row); els.log.scrollTop = els.log.scrollHeight;
  }
  let toastTimer = null;
  function toast(text) { els.toast.textContent = text; els.toast.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2600); }

  /* ==================== CONTROLS ==================== */
  els.btnListen.addEventListener("pointerdown", () => { state.pushMode = true; els.btnListen.classList.add("holding"); setState("listening"); });
  els.btnListen.addEventListener("pointerup", () => { clearTimeout(pushTimer); pushTimer = setTimeout(() => { const t = utterance.trim(); utterance = ""; if (t) sendSpeech(t); state.pushMode = false; state.armed = false; els.btnListen.classList.remove("holding"); setState(state.alwaysListen ? "listening" : "idle"); }, 300); });
  els.toggleAlways.addEventListener("change", (e) => { state.alwaysListen = e.target.checked; state.armed = e.target.checked; setState(e.target.checked ? "listening" : "idle"); toast(state.alwaysListen ? "Always listening" : "Wake word only"); });
  els.toggleVoice.addEventListener("change", (e) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "voice", enabled: e.target.checked })); });
  els.btnSend.addEventListener("click", () => sendTyped());
  els.typeBox.addEventListener("keydown", (e) => { if (e.key === "Enter") sendTyped(); });
  function sendTyped() { const t = els.typeBox.value.trim(); if (!t) return; els.typeBox.value = ""; sendSpeech(t); }

  /* ==================== VISUALIZER ==================== */
  let analyser = null;
  async function startVisualizer() {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); analyser = ctx.createAnalyser(); analyser.fftSize = 256; src.connect(analyser); tick(); } catch {}
  }
  function tick() { requestAnimationFrame(tick); if (!analyser) return; const buf = new Uint8Array(analyser.fftSize / 2); analyser.getByteFrequencyData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i]; window.__micLevel = Math.min(1, (sum / buf.length / 255) * 2.2); }

  /* ==================== BOOT ==================== */
  els.toggleAlways.checked = state.alwaysListen;
  setState(state.alwaysListen ? "listening" : "idle");

  connect(); initRecognition(); startVisualizer(); initMatrix(); setupRadio(); initMap();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(updateUptime, 1000);
  setInterval(fetchStats, 5000); fetchStats();
  setInterval(addMemLine, 300); for (let i = 0; i < 12; i++) addMemLine();
  fetchNews(); setInterval(rotateHeadline, 8000); setInterval(fetchNews, 120000);
  fetchWeather(); setInterval(fetchWeather, 600000);
  fetchMarket(); setInterval(fetchMarket, 30000);
  fetchTech(); setInterval(fetchTech, 120000);
  fetchBreaking(); setInterval(fetchBreaking, 60000);
  setInterval(() => { if (recog && !recogStarted && !state.thinking && !state.speaking) autoRestart(); }, 3000);
})();
