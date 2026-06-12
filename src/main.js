  const KEY = "atomic-habit-v1";
  const NOTIF_KEY = "atomic-notif-v1";
  const NOTIF_DEFAULTS = { enabled: false, morningTime: "08:00", eveningTime: "21:00" };
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

  function loadNotifSettings() {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      return raw ? { ...NOTIF_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIF_DEFAULTS };
    } catch { return { ...NOTIF_DEFAULTS }; }
  }
  function saveNotifSettings(n) { localStorage.setItem(NOTIF_KEY, JSON.stringify(n)); }

  let notifSettings = loadNotifSettings();
  let _notifTimers = [];

  function clearNotifTimers() {
    _notifTimers.forEach(clearTimeout);
    _notifTimers = [];
  }

  function showNotif(title, body, tag) {
    if (Notification.permission !== "granted") return;
    navigator.serviceWorker?.ready.then(reg => {
      reg.showNotification(title, { body, icon: "./icon.svg", badge: "./icon.svg", tag });
    }).catch(() => {
      try { new Notification(title, { body, icon: "./icon.svg" }); } catch {}
    });
  }

  function scheduleNotifications() {
    clearNotifTimers();
    if (!notifSettings.enabled || Notification.permission !== "granted") return;

    const today = todayISO();
    const dayIdx = daysBetween(state.startDate, today);
    if (dayIdx < 0) return;

    const target = targetForDay(state, dayIdx);
    const now = new Date();

    const [mh, mm] = notifSettings.morningTime.split(":").map(Number);
    const morning = new Date(); morning.setHours(mh, mm, 0, 0);
    const msToMorning = morning - now;
    if (msToMorning > 0) {
      _notifTimers.push(setTimeout(() => {
        showNotif(
          `⚡ ${target} ${state.habit.toLowerCase()} hoy`,
          `Día ${dayIdx + 1} de tu hábito. ¡A por ello!`,
          "atomic-morning"
        );
      }, msToMorning));
    }

    const [eh, em] = notifSettings.eveningTime.split(":").map(Number);
    const evening = new Date(); evening.setHours(eh, em, 0, 0);
    const msToEvening = evening - now;
    if (msToEvening > 0) {
      _notifTimers.push(setTimeout(() => {
        if (!state.completed[todayISO()]) {
          showNotif(
            `⚡ ¿Hiciste tus ${state.habit.toLowerCase()}?`,
            `Todavía no marcaste el hábito de hoy. ¡Quedan ${target}!`,
            "atomic-evening"
          );
        }
      }, msToEvening));
    }
  }

  function renderNotifUI() {
    const el = $("notifEnabled");
    if (!el) return;
    el.checked = notifSettings.enabled && Notification.permission === "granted";
    $("notifTimes").hidden = !el.checked;
    $("notifMorning").value = notifSettings.morningTime;
    $("notifEvening").value = notifSettings.eveningTime;
    const hint = $("notifHint");
    if (hint) hint.textContent = Notification.permission === "denied"
      ? "Permiso denegado. Activalo en la configuración del navegador."
      : "Funciona mejor con la app instalada en tu pantalla de inicio.";
  }

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
    $("dateLabel").classList.toggle("pre-start", dayIdx < 0);

    const isBumpDay = dayIdx > 0 && dayIdx % state.everyDays === 0 && target < state.goal;
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
    btn.disabled = dayIdx < 0;

    const pct = goalDay > 0 ? Math.min(1, Math.max(dayIdx, 0) / goalDay) : 1;
    const ring = $("ringFill");
    ring.style.setProperty("--ring-circ", RING_CIRC);
    ring.style.strokeDasharray = RING_CIRC.toFixed(3);
    ring.style.strokeDashoffset = (RING_CIRC * (1 - pct)).toFixed(3);

    const doneCount = Object.keys(state.completed).filter(k => state.completed[k]).length;
    $("progressText").innerHTML = dayIdx < 0
      ? `Sin empezar`
      : dayIdx < goalDay
        ? `Día <b>${dayIdx + 1}</b> de <b>${goalDay + 1}</b>`
        : `Día <b>${dayIdx + 1}</b>`;
    $("goalText").innerHTML = dayIdx >= 0 && doneCount > 0
      ? `<b>${Math.round(doneCount / (dayIdx + 1) * 100)}%</b> completados`
      : `Meta <b>${state.goal}</b>`;

    const streak = currentStreak();
    $("streak").textContent = `${streak}${getStreakEmoji(streak, goalDay + 1)}`;
    $("total").textContent = Object.keys(state.completed).filter(k => state.completed[k]).length;

    renderDays(dayIdx, streak);

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

  function dateForDayIdx(startDate, idx) {
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + idx);
    return todayISO(d);
  }

  function getStreakEmoji(streak, totalDays) {
    if (streak <= 0) return "";
    const pct = totalDays > 0 ? streak / totalDays : 0;
    if (pct >= 1.0) return " 🏆";
    if (pct >= 0.75) return " 👑";
    if (pct >= 0.5) return " 🚀";
    if (pct >= 0.25) return " 💪";
    if (pct >= 0.1) return " 🔥";
    return " ⚡";
  }

  function currentStreak() {
    let n = 0;
    const today = todayISO();
    const dayIdx = daysBetween(state.startDate, today);
    if (dayIdx < 0) return 0;

    let startCheckIdx = dayIdx;
    if (!state.completed[today]) {
      startCheckIdx = dayIdx - 1;
    }

    for (let i = startCheckIdx; i >= 0; i--) {
      const k = dateForDayIdx(state.startDate, i);
      if (state.completed[k]) {
        n++;
      } else {
        break;
      }
    }
    return n;
  }

  function toggleDay(k) {
    if (state.completed[k]) {
      delete state.completed[k];
    } else {
      state.completed[k] = true;
    }
    save(state);
  }

  function renderDays(todayIdx, streak) {
    const root = $("days");
    root.innerHTML = "";
    const today = new Date();
    const todayStr = todayISO();

    let streakStart = null, streakEnd = null;
    if (streak > 0) {
      const endIdx = state.completed[todayStr] ? todayIdx : todayIdx - 1;
      streakEnd = dateForDayIdx(state.startDate, endIdx);
      streakStart = dateForDayIdx(state.startDate, endIdx - streak + 1);
    }

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
      if (streakStart && k >= streakStart && k <= streakEnd && state.completed[k]) el.classList.add("streak");
      const t = idx < 0 ? "—" : targetForDay(state, idx);
      el.title = idx < 0
        ? `${k} · sin empezar`
        : `${k} · meta ${t}${state.completed[k] ? " · hecho" : ""} · tocá para cambiar`;
      el.dataset.date = k;
      const dayNum = document.createElement("span");
      dayNum.className = "day-num";
      dayNum.textContent = d.getDate();
      el.appendChild(dayNum);
      el.addEventListener("click", () => {
        if (idx < 0) return;
        toggleDay(k);
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
      `🎯 Hoy: ${target} ${habit}`,
      `🔥 Racha: ${streak} día${streak === 1 ? "" : "s"}`,
      `✅ Total: ${total}`,
      target < state.goal && goalDay > 0
        ? `🏁 Meta ${state.goal} en ${Math.max(0, goalDay - Math.max(dayIdx, 0))} día${(goalDay - Math.max(dayIdx, 0)) === 1 ? "" : "s"}`
        : target >= state.goal ? `🏆 ¡Meta alcanzada!` : null,
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
    const today = todayISO();
    if (daysBetween(state.startDate, today) < 0) return;
    toggleDay(today);
    const btn = $("doneBtn");
    btn.classList.add("pop-anim");
    setTimeout(() => btn.classList.remove("pop-anim"), 350);
    toast(state.completed[today] ? "¡Listo!" : "Desmarcado");
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
  $("startDate").addEventListener("input", () => {
    const v = $("startDate").value;
    if (v) $("daysAgo").value = Math.max(0, daysBetween(v, todayISO()));
    renderPreview();
  });
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
    state = { ...DEFAULTS, startDate: todayISO(), completed: {} };
    save(state);
    toast("Borrado");
    openWelcome();
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
    let hasControllerOnLoad = !!navigator.serviceWorker.controller;

    function getSWVersion(sw) {
      return new Promise(resolve => {
        const ch = new MessageChannel();
        ch.port1.onmessage = e => resolve(e.data);
        sw.postMessage("GET_VERSION", [ch.port2]);
        setTimeout(() => resolve(null), 500);
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasControllerOnLoad) {
        if (document.hidden) {
          sessionStorage.setItem("just-updated", "1");
          window.location.reload();
        } else {
          const banner = $("updateBanner");
          if (banner) {
            banner.hidden = false;
            $("updateBtn").onclick = () => {
              $("updateBtn").textContent = "Cargando…";
              $("updateBtn").disabled = true;
              sessionStorage.setItem("just-updated", "1");
              window.location.reload();
            };
            const oldVer = (sessionStorage.getItem("sw-version") || "atomic-dev").replace("atomic-", "");
            getSWVersion(navigator.serviceWorker.controller).then(newRaw => {
              const newVer = newRaw ? newRaw.replace("atomic-", "") : null;
              const vEl = $("updateVersion");
              if (vEl && newVer) vEl.textContent = `${oldVer} → ${newVer}`;
            });
          }
        }
      }
      hasControllerOnLoad = true;
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js")
        .then(reg => {
          if (reg.active) getSWVersion(reg.active).then(v => {
            if (v) sessionStorage.setItem("sw-version", v);
          });
          reg.update();
        })
        .catch(() => {});
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

  if ("Notification" in window) {
    renderNotifUI();

    $("notifEnabled").addEventListener("change", async () => {
      const el = $("notifEnabled");
      if (el.checked) {
        if (Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") {
            el.checked = false;
            renderNotifUI();
            return;
          }
        }
        notifSettings.enabled = true;
      } else {
        notifSettings.enabled = false;
        clearNotifTimers();
      }
      saveNotifSettings(notifSettings);
      $("notifTimes").hidden = !notifSettings.enabled;
      if (notifSettings.enabled) scheduleNotifications();
    });

    ["notifMorning", "notifEvening"].forEach(id => {
      $(id).addEventListener("change", () => {
        notifSettings.morningTime = $("notifMorning").value;
        notifSettings.eveningTime = $("notifEvening").value;
        saveNotifSettings(notifSettings);
        scheduleNotifications();
      });
    });
  } else {
    const s = $("notifSection");
    if (s) s.hidden = true;
  }

  scheduleNotifications();

  if (sessionStorage.getItem("just-updated")) {
    sessionStorage.removeItem("just-updated");
    toast("Actualizado ✓");
  }

  function updateOfflineBanner() {
    const b = $("offlineBanner");
    if (!b) return;
    if (!navigator.onLine && $("updateBanner").hidden) {
      b.hidden = false;
      clearTimeout(updateOfflineBanner._t);
      updateOfflineBanner._t = setTimeout(() => { b.hidden = true; }, 5000);
    } else {
      clearTimeout(updateOfflineBanner._t);
      b.hidden = true;
    }
  }
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();

  render();
