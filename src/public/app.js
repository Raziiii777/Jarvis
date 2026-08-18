(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    brand: $("brand-name"),
    conn: $("conn-status"),
    status: $("status-text"),
    log: $("log"),
    live: $("live"),
    btnListen: $("btn-listen"),
    toggleAlways: $("toggle-always"),
    toggleVoice: $("toggle-voice"),
    typeBox: $("type-box"),
    btnSend: $("btn-send"),
    toast: $("toast"),
  };

  const cfg = { name: "JARVIS", wakeWords: ["jarvis", "hey jarvis"], audioReply: true };
  const state = { alwaysListen: true, pushMode: false, armed: false, thinking: false, speaking: false };

  let ws = null;
  let recog = null;
  let recogStarted = false;
  let utterance = "";
  let processTimer = null;
  let pushTimer = null;
  let armedTimer = null;
  let speechBlockUntil = 0;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ---------------- WebSocket ---------------- */
  function connect() {
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => {
      els.conn.textContent = "ONLINE";
      els.conn.classList.add("badge-on");
      toast("Connected to " + cfg.name);
    };
    ws.onclose = () => {
      els.conn.textContent = "OFFLINE";
      els.conn.classList.remove("badge-on");
      setState("idle");
      setTimeout(connect, 1500);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "config") {
        cfg.name = (m.name || "Jarvis").toUpperCase();
        cfg.wakeWords = m.wakeWords || cfg.wakeWords;
        cfg.audioReply = m.audioReply !== false;
        els.toggleVoice.checked = cfg.audioReply;
        els.brand.textContent = cfg.name;
      } else if (m.type === "thinking") {
        setState("thinking");
      } else if (m.type === "reply") {
        if (m.silent) {
          setState("listening");
          return;
        }
        setState("speaking");
        addLog("jarvis", m.text);
        const ms = Math.min(4000, 700 + m.text.length * 45);
        speechBlockUntil = Date.now() + ms + 1200;
        setTimeout(() => setState("listening"), ms);
      }
    };
  }

  /* ---------------- Speech recognition ---------------- */
  function initRecognition() {
    if (!SR) {
      toast("Speech recognition is not supported in this browser. Use Safari or Chrome.");
      els.btnListen.disabled = true;
      return;
    }
    recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event) => {
      let finals = [];
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finals.push(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      els.live.textContent = interim ? "… " + interim : "";
      for (const seg of finals) {
        if (!seg) continue;
        handleFinal(seg);
      }
    };

    recog.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast("Microphone permission denied. Enable it in browser settings.");
      } else if (e.error !== "aborted") {
        toast("Speech error: " + e.error);
      }
    };

    recog.onend = () => {
      recogStarted = false;
      if (!state.thinking && !state.speaking) setState("idle");
      autoRestart();
    };

    try { recog.start(); recogStarted = true; } catch { /* already running */ }
  }

  function autoRestart() {
    if (!recog || !document.hasFocus()) return;
    setTimeout(() => {
      if (!recogStarted && recog) {
        try { recog.start(); recogStarted = true; } catch { /* noop */ }
      }
    }, 400);
  }

  function handleFinal(seg) {
    if (Date.now() < speechBlockUntil) return;
    const lower = seg.toLowerCase().trim();
    if (!lower) return;

    if (!state.pushMode && !state.alwaysListen && !state.armed) {
      const w = matchWake(lower);
      if (!w) return;
      state.armed = true;
      keepArmed();
      const cmd = stripWake(lower, w);
      if (cmd) appendCommand(cmd);
      return;
    }

    appendCommand(lower);
  }

  function appendCommand(seg) {
    utterance = (utterance ? utterance + " " : "") + seg;
    els.live.textContent = "… " + utterance;
    clearTimeout(processTimer);
    processTimer = setTimeout(processUtterance, 1600);
  }

  function processUtterance() {
    const t = utterance.trim();
    utterance = "";
    els.live.textContent = "";
    if (t) sendSpeech(t);
    if (!state.alwaysListen) state.armed = false;
    clearTimeout(pushTimer);
  }

  function keepArmed() {
    clearTimeout(armedTimer);
    armedTimer = setTimeout(() => { state.armed = false; }, 30000);
  }

  function matchWake(text) {
    for (const w of cfg.wakeWords) {
      const idx = text.indexOf(w);
      if (idx >= 0 && idx <= 6) return w;
    }
    return null;
  }

  function stripWake(text, w) {
    const idx = text.indexOf(w);
    if (idx < 0) return text;
    return text.slice(idx + w.length).replace(/^[\s,.:]+/, "").trim();
  }

  function sendSpeech(text) {
    addLog("you", text);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "speech", text }));
      setState("thinking");
    }
  }

  /* ---------------- UI state ---------------- */
  function setState(s) {
    const map = {
      idle: "STANDBY",
      listening: "LISTENING",
      thinking: "THINKING",
      speaking: "REPLYING",
    };
    document.body.className = "state-" + (map[s] ? s : "idle");
    els.status.textContent = map[s] ?? "STANDBY";
  }

  function addLog(who, text) {
    const row = document.createElement("div");
    row.className = "msg " + who;
    const whoEl = document.createElement("span");
    whoEl.className = "who";
    whoEl.textContent = who === "you" ? "YOU" : cfg.name;
    const body = document.createElement("span");
    body.className = "body";
    body.textContent = text;
    row.append(whoEl, body);
    els.log.appendChild(row);
    els.log.scrollTop = els.log.scrollHeight;
  }

  let toastTimer = null;
  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
  }

  /* ---------------- Controls ---------------- */
  els.btnListen.addEventListener("pointerdown", () => {
    state.pushMode = true;
    els.btnListen.classList.add("holding");
    setState("listening");
  });
  els.btnListen.addEventListener("pointerup", () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      const t = utterance.trim();
      utterance = "";
      if (t) sendSpeech(t);
      state.pushMode = false;
      state.armed = false;
      els.btnListen.classList.remove("holding");
      setState(state.alwaysListen ? "listening" : "idle");
    }, 300);
  });

  els.toggleAlways.addEventListener("change", (e) => {
    state.alwaysListen = e.target.checked;
    state.armed = e.target.checked;
    setState(e.target.checked ? "listening" : "idle");
    toast(state.alwaysListen ? "Always listening" : "Wake word only");
  });

  els.toggleVoice.addEventListener("change", (e) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "voice", enabled: e.target.checked }));
    }
  });

  els.btnSend.addEventListener("click", () => sendTyped());
  els.typeBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendTyped();
  });

  function sendTyped() {
    const t = els.typeBox.value.trim();
    if (!t) return;
    els.typeBox.value = "";
    sendSpeech(t);
  }

  /* ---------------- Visualizer (mic glow) ---------------- */
  let analyser = null;
  let raf = null;
  async function startVisualizer() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      tick();
    } catch { /* visualizer optional */ }
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize / 2);
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    window.__micLevel = Math.min(1, (sum / buf.length / 255) * 2.2);
  }

  /* ---------------- Boot ---------------- */
  els.toggleAlways.checked = state.alwaysListen;
  setState(state.alwaysListen ? "listening" : "idle");
  connect();
  initRecognition();
  startVisualizer();
  setInterval(() => { if (recog && !recogStarted && !state.thinking && !state.speaking) autoRestart(); }, 3000);
})();
