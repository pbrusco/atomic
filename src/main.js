  const KEY = "atomic-habit-v1";
  const DEFAULTS = {
    habit: "Flexiones",
    startDate: todayISO(),
    startAmt: 3,
    increment: 1,
    everyDays: 2,
    goal: 50,
    completed: {}
  };

  const $ = (id) => document.getElementById(id);

  function todayISO(d = new Date()) {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    const ad = new Date(a + "T00:00:00");
    const bd = new Date(b + "T00:00:00");
    return Math.round((bd - ad) / 86400000);
  }
  function targetForDay(s, dayIdx) {
    if (dayIdx < 0) return null;
    const v = s.startAmt + Math.floor(dayIdx / s.everyDays) * s.increment;
    return Math.min(v, s.goal);
  }
  function dayReachingGoal(s) {
    if (s.goal <= s.startAmt) return 0;
    const stepsNeeded = Math.ceil((s.goal - s.startAmt) / s.increment);
    return stepsNeeded * s.everyDays;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove("show"), 1800);
  }

  let state = load();

  const RING_CIRC = 2 * Math.PI * 54; // ~339.292

  function render() {
    const today = todayISO();
    const dayIdx = daysBetween(state.startDate, today);
    const target = dayIdx < 0 ? state.startAmt : targetForDay(state, dayIdx);
    const goalDay = dayReachingGoal(state);

    $("target").textContent = target ?? "—";
    $("unit").textContent = state.habit.toLowerCase();
    $("dateLabel").textContent = dayIdx < 0
      ? `Empieza en ${-dayIdx} día${-dayIdx === 1 ? "" : "s"}`
      : `Hoy te tocan`;

    const isBumpDay = dayIdx >= 0 && dayIdx % state.everyDays === 0 && dayIdx > 0 && target < state.goal;
    $("target").classList.toggle("bumped", isBumpDay);

    if (dayIdx < 0) {
      $("meta").innerHTML = `Empezás con <b>${state.startAmt} ${state.habit.toLowerCase()}</b> el <b>${state.startDate}</b>.`;
    } else if (target >= state.goal) {
      $("meta").innerHTML = `Llegaste a la meta de <b>${state.goal}</b>. Sostenelo. 🎯`;
    } else {
      const nextBumpIn = state.everyDays - (dayIdx % state.everyDays);
      $("meta").innerHTML = `Próximo aumento a <b>${target + state.increment}</b> en <b>${nextBumpIn} día${nextBumpIn === 1 ? "" : "s"}</b>.`;
    }

    const isDone = !!state.completed[today];
    const btn = $("doneBtn");
    btn.textContent = isDone ? "Hecho hoy" : `Marcar hoy como hecho`;
    btn.classList.toggle("done", isDone);

    const pct = goalDay > 0 ? Math.min(1, Math.max(0, Math.max(dayIdx, 0) / goalDay)) : 1;
    const ring = $("ringFill");
    ring.style.setProperty("--ring-circ", RING_CIRC);
    ring.style.strokeDasharray = RING_CIRC.toFixed(3);
    ring.style.strokeDashoffset = (RING_CIRC * (1 - pct)).toFixed(3);

    $("progressText").innerHTML = dayIdx < 0
      ? `Sin empezar`
      : `Día <b>${dayIdx + 1}</b> · ${goalDay + 1} en total`;
    $("goalText").innerHTML = `Meta <b>${state.goal}</b>`;

    $("streak").textContent = currentStreak();
    $("total").textContent = Object.keys(state.completed).filter(k => state.completed[k]).length;

    renderDays(dayIdx);

    $("habit").value = state.habit;
    $("startDate").value = state.startDate;
    $("startAmt").value = state.startAmt;
    $("increment").value = state.increment;
    $("everyDays").value = state.everyDays;
    $("goal").value = state.goal;
    if (document.activeElement !== $("daysAgo")) {
      $("daysAgo").value = Math.max(0, dayIdx);
    }
    if (document.activeElement !== $("backup")) {
      $("backup").value = JSON.stringify(state, null, 2);
    }
    renderPreview();
  }

  function renderPreview() {
    const settings = readSettingsFromForm();
    if (!settings) return;
    const today = todayISO();
    const dayIdx = daysBetween(settings.startDate, today);
    const t = dayIdx < 0 ? settings.startAmt : targetForDay(settings, dayIdx);
    const goalDay = dayReachingGoal(settings);
    const habit = settings.habit.toLowerCase();
    let line;
    if (dayIdx < 0) {
      line = `Empezás en <b>${-dayIdx}</b> día${-dayIdx === 1 ? "" : "s"} con <b>${settings.startAmt}</b> ${habit}.`;
    } else if (t >= settings.goal) {
      line = `Hoy ya estás en la meta: <b>${settings.goal}</b> ${habit}.`;
    } else {
      const left = Math.max(0, goalDay - dayIdx);
      line = `Hoy te tocan <b>${t}</b> ${habit}. Llegás a la meta en <b>${left}</b> día${left === 1 ? "" : "s"}.`;
    }
    $("preview").innerHTML = line;
  }

  function readSettingsFromForm() {
    try {
      return {
        habit: $("habit").value.trim() || "Hábito",
        startDate: $("startDate").value || todayISO(),
        startAmt: Math.max(0, parseInt($("startAmt").value, 10) || 0),
        increment: Math.max(1, parseInt($("increment").value, 10) || 1),
        everyDays: Math.max(1, parseInt($("everyDays").value, 10) || 1),
        goal: Math.max(1, parseInt($("goal").value, 10) || 1),
      };
    } catch { return null; }
  }

  function currentStreak() {
    let n = 0;
    const d = new Date();
    const today = todayISO(d);
    // Don't break the streak just because today isn't done yet:
    // if today is unmarked, start counting from yesterday.
    if (!state.completed[today]) d.setDate(d.getDate() - 1);
    while (state.completed[todayISO(d)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    if (n === 0 && !state.completed[today]) {
      const dayIdx = daysBetween(state.startDate, today);
      if (dayIdx >= 0) {
        return 1;
      }
    }
    return n;
  }

  function renderDays(todayIdx) {
    const root = $("days");
    root.innerHTML = "";
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = todayISO(d);
      const idx = daysBetween(state.startDate, k);
      const el = document.createElement("div");
      el.className = "day";
      if (state.completed[k]) el.classList.add("done");
      if (i === 0) el.classList.add("today");
      if (idx < 0) el.classList.add("future");
      const t = idx < 0 ? "—" : targetForDay(state, idx);
      el.title = `${k} · meta ${t}${state.completed[k] ? " · hecho" : ""} · tocá para cambiar`;
      el.dataset.date = k;
      el.addEventListener("click", () => {
        if (idx < 0) return;
        state.completed[k] = !state.completed[k];
        save(state);
        toast(state.completed[k] ? `Registrado ${k}` : `Desmarcado ${k}`);
        render();
      });
      root.appendChild(el);
    }
  }

  function buildShareMessage() {
    const today = todayISO();
    const dayIdx = daysBetween(state.startDate, today);
    const habit = state.habit.toLowerCase();
    const streak = currentStreak();
    const total = Object.keys(state.completed).filter(k => state.completed[k]).length;
    const target = dayIdx < 0 ? state.startAmt : targetForDay(state, dayIdx);
    const goalDay = dayReachingGoal(state);
    const dayLabel = dayIdx < 0 ? `empiezo en ${-dayIdx} día${-dayIdx === 1 ? "" : "s"}` : `día ${dayIdx + 1}`;
    const lines = [
      `⚡ Mi progreso con *${state.habit}*`,
      `📅 ${dayLabel}`,
      target != null ? `🎯 Hoy: ${target} ${habit}` : null,
      `🔥 Racha: ${streak} día${streak === 1 ? "" : "s"}`,
      `✅ Total: ${total}`,
      target != null && target < state.goal && goalDay > 0
        ? `🏁 Meta ${state.goal} en ${Math.max(0, goalDay - Math.max(dayIdx, 0))} día${(goalDay - Math.max(dayIdx, 0)) === 1 ? "" : "s"}`
        : target != null && target >= state.goal ? `🏆 ¡Meta alcanzada!` : null,
    ].filter(Boolean);
    lines.push("", APP_URL);
    return lines.join("\n");
  }

  const APP_URL = "https://pbrusco.github.io/atomic/";

  function buildRoutineMessage() {
    const habit = state.habit.toLowerCase();
    const goalDay = dayReachingGoal(state);
    const routine = {
      habit: state.habit,
      startDate: todayISO(),
      startAmt: state.startAmt,
      increment: state.increment,
      everyDays: state.everyDays,
      goal: state.goal,
      completed: {}
    };
    const json = JSON.stringify(routine);
    return [
      `⚡ Mi rutina en *Atomic*: *${state.habit}*`,
      `Empezás con *${state.startAmt}* ${habit} y sumás *+${state.increment}* cada *${state.everyDays}* día${state.everyDays === 1 ? "" : "s"}, hasta llegar a *${state.goal}* en ${goalDay} días.`,
      ``,
      `¿Querés seguirla?`,
      `1) Abrí ${APP_URL}`,
      `2) Andá a *Ajustes → Copia de seguridad*`,
      `3) Pegá esto y tocá *Restaurar*:`,
      ``,
      json
    ].join("\n");
  }

  function openWhatsApp(text) {
    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
  }

  $("shareBtn").addEventListener("click", () => openWhatsApp(buildShareMessage()));
  $("shareRoutineBtn").addEventListener("click", () => openWhatsApp(buildRoutineMessage()));

  $("doneBtn").addEventListener("click", () => {
    const k = todayISO();
    state.completed[k] = !state.completed[k];
    save(state);
    const btn = $("doneBtn");
    btn.classList.add("pop-anim");
    setTimeout(() => btn.classList.remove("pop-anim"), 350);
    toast(state.completed[k] ? "¡Listo!" : "Desmarcado");
    render();
  });

  $("saveBtn").addEventListener("click", () => {
    const form = readSettingsFromForm();
    state = { ...state, ...form };
    save(state);
    toast("Ajustes guardados");
    $("settings").open = false;
    render();
  });

  $("daysAgo").addEventListener("input", () => {
    const n = parseInt($("daysAgo").value, 10);
    if (isNaN(n) || n < 0) return;
    const d = new Date();
    d.setDate(d.getDate() - n);
    $("startDate").value = todayISO(d);
    renderPreview();
  });
  $("startDate").addEventListener("input", renderPreview);
  ["habit","startAmt","increment","everyDays","goal"].forEach(id => {
    $(id).addEventListener("input", renderPreview);
  });

  $("copyBtn").addEventListener("click", async () => {
    const text = JSON.stringify(state, null, 2);
    $("backup").value = text;
    try {
      await navigator.clipboard.writeText(text);
      toast("Copia en el portapapeles");
    } catch {
      $("backup").select();
      toast("Copiala a mano");
    }
  });

  $("restoreBtn").addEventListener("click", () => {
    const raw = $("backup").value.trim();
    if (!raw) { toast("Pegá una copia primero"); return; }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { toast("No es JSON válido"); return; }
    if (typeof parsed !== "object" || !parsed.startDate) {
      toast("Formato inválido"); return;
    }
    if (!confirm("¿Reemplazar tus datos con esta copia?")) return;
    state = { ...DEFAULTS, ...parsed, completed: parsed.completed || {} };
    save(state);
    toast("Restaurado");
    render();
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("¿Borrar todos los datos y ajustes?")) return;
    localStorage.removeItem(KEY);
    state = load();
    save(state);
    toast("Borrado");
    render();
  });

  // Welcome modal
  const welcome = $("welcome");
  let selectedPreset = null;
  function openWelcome() {
    welcome.classList.add("show");
    $("welcomeHabit").value = "";
    selectedPreset = null;
    document.querySelectorAll(".preset").forEach(p => p.classList.remove("selected"));
    const first = document.querySelector(".preset[data-habit='Flexiones']");
    if (first) { first.classList.add("selected"); selectedPreset = first; }
  }
  function closeWelcome() { welcome.classList.remove("show"); }

  document.querySelectorAll(".preset").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset").forEach(p => p.classList.remove("selected"));
      btn.classList.add("selected");
      selectedPreset = btn;
      $("welcomeHabit").value = "";
    });
  });
  $("welcomeHabit").addEventListener("input", () => {
    if ($("welcomeHabit").value.trim()) {
      document.querySelectorAll(".preset").forEach(p => p.classList.remove("selected"));
      selectedPreset = null;
    }
  });
  function applyWelcomeChoice() {
    const customName = $("welcomeHabit").value.trim();
    if (customName) {
      state = { ...state, habit: customName, startDate: todayISO() };
    } else if (selectedPreset) {
      const d = selectedPreset.dataset;
      state = {
        ...state,
        habit: d.habit,
        startAmt: parseInt(d.start, 10),
        goal: parseInt(d.goal, 10),
        increment: parseInt(d.inc, 10),
        everyDays: parseInt(d.every, 10),
        startDate: todayISO(),
      };
    } else {
      state = { ...state, startDate: todayISO() };
    }
    save(state);
  }
  $("welcomeStart").addEventListener("click", () => {
    applyWelcomeChoice();
    closeWelcome();
    render();
    toast("A construir el hábito");
  });
  $("welcomeCustom").addEventListener("click", () => {
    applyWelcomeChoice();
    closeWelcome();
    $("settings").open = true;
    render();
    $("settings").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (!localStorage.getItem(KEY)) {
    save(state);
    openWelcome();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ——— Install (PWA) ———
  const installBtn = $("installBtn");
  let deferredPrompt = null;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    && !/crios|fxios/i.test(navigator.userAgent);

  // Android/desktop Chromium: capture the real install prompt.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) installBtn.hidden = false;
  });

  // iOS Safari has no programmatic prompt — show a manual hint instead.
  if (isIOS && !isStandalone) {
    installBtn.hidden = false;
    installBtn.dataset.ios = "1";
  }

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === "accepted") installBtn.hidden = true;
      return;
    }
    if (installBtn.dataset.ios) {
      toast("Tocá Compartir → Añadir a inicio");
    }
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    deferredPrompt = null;
    toast("¡Instalada!");
  });

  render();
