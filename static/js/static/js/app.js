/**
 * Nexus UI — production SPA
 * Web Audio SFX + GSAP motion + backend v2 (provider, latency, ui)
 */
const API = "https://nexus-backend-production-9065.up.railway.app";

const state = {
  connected: [],
  servers: [],
  presets: [],
  packs: [],
  plans: [],
  tools: [],
  usage: null,
  settings: {},
  catalogCategory: "all",
  busy: false,
  obStep: 0,
  obRole: null,
};

const TITLES = {
  chat: "Чат",
  lifestyle: "Бытовая польза",
  packs: "Сценарии",
  connectors: "Коннекторы",
  builder: "Архитектура",
  business: "Мой бизнес",
  pricing: "Тарифы",
  learn: "Обучение",
  usage: "Usage",
  settings: "Настройки",
};

const LEARN = [
  { t: "1. Что такое коннектор?", b: "MCP-сервис: подключили Canva, карты или салон — агент получает tools." },
  { t: "2. Демо за 30 секунд", b: "Нажмите «✦ Демо» или спросите про погоду / маникюр." },
  { t: "3. Бытовая польза", b: "Еда, такси, салоны — голосом и в чате." },
  { t: "4. Для бизнеса", b: "Раздел «Мой бизнес» — заявка, клиенты находят вас в поиске." },
  { t: "5. LLM", b: "В чате: «провайдер openrouter» / «провайдер groq»." },
  { t: "6. Безопасность", b: "Ключи только на сервере. На проде — vault и audit." },
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

/* ========== Web Audio SFX ========== */
const SFX = (() => {
  let ctx = null;
  let enabled = localStorage.getItem("nexus-sfx") !== "0";

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (!enabled) return;
    try {
      const c = ac();
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.07, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (_) {}
  }

  return {
    get on() {
      return enabled;
    },
    set on(v) {
      enabled = !!v;
      localStorage.setItem("nexus-sfx", v ? "1" : "0");
    },
    unlock() {
      try {
        ac();
      } catch (_) {}
    },
    tap() {
      tone(880, 0.035, "sine", 0.035);
      tone(1320, 0.025, "sine", 0.018, 0.018);
    },
    send() {
      tone(380, 0.05, "triangle", 0.05);
      tone(620, 0.07, "sine", 0.035, 0.035);
    },
    success() {
      tone(523.25, 0.07, "sine", 0.05);
      tone(659.25, 0.09, "sine", 0.04, 0.06);
      tone(783.99, 0.11, "sine", 0.035, 0.12);
    },
    error() {
      tone(160, 0.14, "sawtooth", 0.035);
    },
    toggle() {
      tone(640, 0.045, "square", 0.025);
    },
    soft() {
      tone(520, 0.04, "sine", 0.02);
    },
  };
})();

document.addEventListener(
  "pointerdown",
  (e) => {
    if (e.target.closest("button, .nav-item, .suggestion, .life-card, .cat-tab, .tab, a.nav-item, .send-btn")) {
      SFX.unlock();
      SFX.tap();
    }
  },
  { passive: true }
);

/* ========== GSAP helpers ========== */
const Motion = {
  ok: () => typeof gsap !== "undefined",
  msgIn(el) {
    if (!this.ok() || !el) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 14, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" }
    );
  },
  fadeIn(el, delay = 0) {
    if (!this.ok() || !el) return;
    gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, delay, ease: "power2.out" });
  },
  press(el) {
    if (!this.ok() || !el) return;
    gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
  },
  shake(el) {
    if (!this.ok() || !el) return;
    gsap.fromTo(el, { x: -4 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.4)" });
  },
  toast(el) {
    if (!this.ok() || !el) {
      el && (el.style.opacity = "1");
      return;
    }
    gsap.fromTo(el, { opacity: 0, y: 16, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" });
  },
};

/* ========== Toast ========== */
function toast(msg, type = "info") {
  const c = $("#toast-wrap");
  if (!c) {
    console.log("[toast]", type, msg);
    return;
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  Motion.toast(t);
  if (type === "success") SFX.success();
  if (type === "error") SFX.error();
  setTimeout(() => {
    if (Motion.ok()) {
      gsap.to(t, {
        opacity: 0,
        y: -8,
        duration: 0.25,
        onComplete: () => t.remove(),
      });
    } else {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }
  }, 3200);
}

/* ========== Theme ========== */
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("nexus-theme", t);
  const sun = $("#icon-sun");
  const moon = $("#icon-moon");
  if (sun) sun.style.display = t === "light" ? "none" : "block";
  if (moon) moon.style.display = t === "light" ? "block" : "none";
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = t === "dark" ? "#07070c" : "#f6f6fa";
}

function initTheme() {
  setTheme(localStorage.getItem("nexus-theme") || "dark");
  $("#theme-toggle")?.addEventListener("click", () => {
    SFX.toggle();
    const cur = document.documentElement.getAttribute("data-theme");
    setTheme(cur === "dark" ? "light" : "dark");
  });
}

/* ========== Nav ========== */
function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

function showView(name) {
  if (!name || !TITLES[name]) name = "chat";
  $$(".view").forEach((v) => v.classList.remove("active"));
  $$(".nav-item").forEach((n) => n.classList.remove("active"));
  $$(".tab").forEach((t) => t.classList.remove("active"));
  $(`#view-${name}`)?.classList.add("active");
  $(`.nav-item[data-view="${name}"]`)?.classList.add("active");
  $(`.tab[data-view="${name}"]`)?.classList.add("active");
  const ht = $("#header-title");
  if (ht) ht.textContent = TITLES[name] || name;
  try {
    history.replaceState(null, "", `#${name}`);
  } catch (_) {}
  closeSidebar();
  const view = $(`#view-${name}`);
  if (view) Motion.fadeIn(view);
  if (name === "connectors") renderConnectors();
  if (name === "packs") renderPacks();
  if (name === "pricing") renderPricing();
  if (name === "builder") renderBuilder();
  if (name === "learn") renderLearn();
  if (name === "usage") renderUsage();
  if (name === "settings") fillSettings();
}

function initNav() {
  $$(".nav-item[data-view]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      showView(el.dataset.view);
    });
  });
  $$(".tab[data-view]").forEach((t) => {
    t.addEventListener("click", () => showView(t.dataset.view));
  });
  $("#menu-btn")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
    $("#overlay")?.classList.toggle("show");
  });
  $("#overlay")?.addEventListener("click", closeSidebar);
  const hash = (location.hash || "#chat").replace("#", "") || "chat";
  showView(hash);
  window.addEventListener("hashchange", () => {
    showView((location.hash || "#chat").replace("#", "") || "chat");
  });
}

/* ========== API ========== */
async function api(path, opts = {}) {
  if (!API && path.startsWith("/api/")) {
    const err = new Error("API не настроен");
    err.code = "NO_API";
    throw err;
  }
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail || data?.message || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

/* ========== Loaders ========== */
async function loadCatalog() {
  try {
    const data = await api("/api/catalog");
    state.servers = data.servers || data || [];
    state.presets = data.presets || [];
  } catch {
    state.servers = [
      { id: "weather", name: "Weather", description: "Погода", category: "demo", icon: "🌤" },
      { id: "geo-ru", name: "Гео РФ", description: "Места", category: "geo", icon: "🗺" },
      { id: "local-booking", name: "Локальный бизнес", description: "Бронь", category: "lifestyle", icon: "🏪" },
    ];
    state.presets = [];
  }
}

async function loadSettings() {
  try {
    state.settings = (await api("/api/settings")) || {};
  } catch {
    state.settings = { plan_id: "free", display_name: "Demo User", demo_mode: true };
  }
  const name = state.settings.display_name || "Demo User";
  const plan = state.settings.plan_id || "free";
  const un = $("#user-name");
  const up = $("#user-plan");
  if (un) un.textContent = name;
  if (up) up.textContent = plan === "free" ? "Старт · демо" : plan;
  const st = $("#status-text");
  if (st && state.settings.providers?.active) st.textContent = state.settings.providers.active;
  else if (st && state.settings.llm_provider) st.textContent = state.settings.llm_provider;
}

async function loadConnected() {
  try {
    state.connected = (await api("/api/connected")) || [];
  } catch {
    state.connected = [];
  }
  const badge = $("#conn-badge");
  if (badge) badge.textContent = String(state.connected.length || 0);
}

async function loadTools() {
  try {
    state.tools = (await api("/api/tools")) || [];
  } catch {
    state.tools = [];
  }
}

async function loadPacks() {
  try {
    const data = await api("/api/packs");
    state.packs = data.packs || data || [];
  } catch {
    state.packs = [
      { id: "lifestyle-home", name: "Бытовая польза", description: "Еда, такси", icon: "🏠" },
      { id: "smm-starter", name: "SMM Starter", description: "Контент", icon: "✨" },
    ];
  }
}

async function loadPlans() {
  try {
    const data = await api("/api/plans");
    state.plans = data.plans || data || [];
  } catch {
    state.plans = [
      { id: "free", name: "Старт", price: "0 ₽", features: ["Демо", "Чат"] },
      { id: "creator", name: "Creator", price: "990 ₽", featured: true, features: ["LLM", "Сценарии"] },
      { id: "business", name: "Business", price: "2990 ₽", features: ["Команда", "Приоритет"] },
    ];
  }
}

async function loadUsage() {
  try {
    state.usage = await api("/api/usage");
  } catch {
    state.usage = { total_calls: 0, successful_calls: 0, total_revenue_usd: 0 };
  }
  renderUsage();
}

/* ========== Renderers ========== */
function renderConnectors() {
  const grid = $("#connectors-grid");
  const tabs = $("#cat-tabs");
  if (!grid) return;
  const items = [...(state.servers || []), ...(state.presets || [])];
  const cats = ["all", ...new Set(items.map((i) => i.category || "other"))];
  if (tabs) {
    tabs.innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="cat-tab ${state.catalogCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`
      )
      .join("");
    $$(".cat-tab", tabs).forEach((b) => {
      b.addEventListener("click", () => {
        state.catalogCategory = b.dataset.cat;
        renderConnectors();
      });
    });
  }
  const q = ($("#conn-search")?.value || "").toLowerCase();
  const filtered = items.filter((s) => {
    if (state.catalogCategory !== "all" && (s.category || "other") !== state.catalogCategory) return false;
    if (!q) return true;
    return `${s.name} ${s.id} ${s.description || ""}`.toLowerCase().includes(q);
  });
  const connectedIds = new Set((state.connected || []).map((c) => c.id));
  grid.innerHTML =
    filtered
      .map((s) => {
        const on = connectedIds.has(s.id);
        return `<div class="connector-card glass">
        <div class="conn-ico">${s.icon || "⬡"}</div>
        <h3>${esc(s.name || s.id)}</h3>
        <p>${esc(s.description || "")}</p>
        <div class="card-actions">
          ${
            s.id === "canva" || s.id === "notion" || s.auth === "oauth"
              ? `<button type="button" class="btn btn-glow btn-sm" data-oauth="${esc(s.id)}">Войти</button>`
              : on
                ? `<button type="button" class="btn btn-secondary btn-sm" data-disconnect="${esc(s.id)}">Отключить</button>`
                : `<button type="button" class="btn btn-glow btn-sm" data-connect="${esc(s.id)}">Подключить</button>`
          }
        </div>
      </div>`;
      })
      .join("") || `<p class="muted">Ничего не найдено</p>`;

  $$(".connector-card", grid).forEach((el, i) => Motion.fadeIn(el, i * 0.04));

  grid.onclick = async (e) => {
    const connect = e.target.closest("[data-connect]");
    const disconnect = e.target.closest("[data-disconnect]");
    const oauth = e.target.closest("[data-oauth]");
    try {
      if (connect) {
        await api(`/api/connect/${connect.dataset.connect}`, { method: "POST" });
        await loadConnected();
        renderConnectors();
        toast("Подключено", "success");
      } else if (disconnect) {
        await api(`/api/disconnect/${disconnect.dataset.disconnect}`, { method: "POST" });
        await loadConnected();
        renderConnectors();
        toast("Отключено", "success");
      } else if (oauth) {
        if (!API) return toast("Нужен backend", "error");
        if (oauth.dataset.oauth === "notion") {
          await api("/api/connect/notion", { method: "POST" });
          await loadConnected();
          renderConnectors();
          toast("Notion подключён", "success");
        } else {
          location.href = `${API}/api/oauth/${oauth.dataset.oauth}/start`;
        }
      }
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

function renderPacks() {
  const grid = $("#packs-grid");
  if (!grid) return;
  if (!state.packs.length) loadPacks().then(renderPacks);
  grid.innerHTML = (state.packs || [])
    .map(
      (p) => `<div class="pack-card glass">
      <div class="pack-ico">${p.icon || "◈"}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description || "")}</p>
      <button type="button" class="btn btn-glow btn-sm" data-pack="${esc(p.id)}">Активировать</button>
    </div>`
    )
    .join("");
  grid.onclick = async (e) => {
    const btn = e.target.closest("[data-pack]");
    if (!btn) return;
    try {
      await api(`/api/packs/${btn.dataset.pack}/activate`, { method: "POST" });
      toast("Пакет активирован", "success");
      showView("chat");
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

function renderPricing() {
  const grid = $("#pricing-grid");
  if (!grid) return;
  if (!state.plans.length) loadPlans().then(renderPricing);
  grid.innerHTML = (state.plans || [])
    .map(
      (p) => `<div class="price-card glass ${p.featured ? "featured" : ""}">
      <h3>${esc(p.name)}</h3>
      <div class="price">${esc(p.price || p.price_rub || "—")}</div>
      <ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <button type="button" class="btn ${p.featured ? "btn-glow" : "btn-secondary"} btn-sm">Выбрать</button>
    </div>`
    )
    .join("");
}

function renderBuilder() {
  const tools = $("#flow-tools");
  if (tools) {
    const names = (state.connected || []).map((c) => c.name || c.id);
    tools.textContent = names.length ? names.join(", ") : "Tools";
  }
}

function renderLearn() {
  const list = $("#learn-list");
  if (!list) return;
  list.innerHTML = LEARN.map((x) => `<div class="learn-item glass"><h4>${esc(x.t)}</h4><p>${esc(x.b)}</p></div>`).join("");
}

function renderUsage() {
  const cards = $("#usage-cards");
  if (!cards) return;
  const u = state.usage || {};
  cards.innerHTML = `
    <div class="usage-card glass"><div class="val">${u.total_calls ?? 0}</div><div class="lbl">Вызовы</div></div>
    <div class="usage-card glass"><div class="val">${u.successful_calls ?? 0}</div><div class="lbl">Успешные</div></div>
    <div class="usage-card glass"><div class="val">${state.connected?.length ?? 0}</div><div class="lbl">Коннекторы</div></div>
    <div class="usage-card glass"><div class="val">$${(u.total_revenue_usd ?? 0).toFixed?.(2) || "0.00"}</div><div class="lbl">Revenue</div></div>`;
}

function fillSettings() {
  const n = $("#set-name");
  const g = $("#set-grok");
  const p = $("#set-plan");
  if (n) n.value = state.settings.display_name || "";
  if (g && state.settings.grok_api_key) g.placeholder = "•••• сохранён";
  if (p) p.value = state.settings.plan_id || "free";
  const sfxBtn = $("#sfx-toggle");
  if (sfxBtn) sfxBtn.textContent = `Звук UI: ${SFX.on ? "вкл" : "выкл"}`;
}

/* ========== Chat ========== */
function appendMsg(role, text, tools = [], meta = {}) {
  const box = $("#chat-messages");
  if (!box) return;
  $("#empty-state")?.remove();
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "user" : "assistant"}`;
  let toolsHtml = "";
  if (tools?.length) {
    toolsHtml =
      `<div class="tool-chips">` +
      tools
        .map((t) => {
          const label = t.server_id === "llm" ? `llm/${t.name}` : `${t.server_id}/${t.name}`;
          return `<span class="tool-chip ${t.ok === false ? "err" : ""}">${esc(label)}</span>`;
        })
        .join("") +
      `</div>`;
  }
  let metaHtml = "";
  if (meta.provider_used || meta.latency_ms) {
    metaHtml = `<div class="meta-row">`;
    if (meta.provider_used) metaHtml += `<span class="provider-chip">${esc(meta.provider_used)}</span>`;
    if (meta.fallback_from) metaHtml += `<span class="latency">${esc(meta.fallback_from)}→</span>`;
    if (meta.latency_ms != null) metaHtml += `<span class="latency">${meta.latency_ms}ms</span>`;
    metaHtml += `</div>`;
  }
  div.innerHTML = `${esc(text).replace(/\n/g, "<br>")}${toolsHtml}${metaHtml}`;
  box.appendChild(div);
  Motion.msgIn(div);
  box.scrollTop = box.scrollHeight;
}

function showTyping() {
  const box = $("#chat-messages");
  if (!box || $("#typing-ind")) return;
  $("#empty-state")?.remove();
  const d = document.createElement("div");
  d.id = "typing-ind";
  d.className = "msg assistant";
  d.innerHTML = `<div class="typing"><i></i><i></i><i></i></div>`;
  box.appendChild(d);
  Motion.msgIn(d);
  box.scrollTop = box.scrollHeight;
}

function hideTyping() {
  $("#typing-ind")?.remove();
}

async function sendMessage() {
  const input = $("#chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || state.busy) return;
  state.busy = true;
  const sendBtn = $("#send-btn");
  if (sendBtn) sendBtn.disabled = true;
  input.value = "";
  input.style.height = "auto";
  appendMsg("user", text);
  SFX.send();
  showTyping();
  try {
    const res = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    hideTyping();
    SFX.success();
    appendMsg("assistant", res.reply || "Готово", res.tools_used || [], {
      provider_used: res.provider_used,
      fallback_from: res.fallback_from,
      latency_ms: res.latency_ms,
    });
    const st = $("#status-text");
    if (st && res.provider_used) st.textContent = res.provider_used;
    loadConnected().catch(() => {});
    loadUsage().catch(() => {});
  } catch (e) {
    hideTyping();
    SFX.error();
    if (e.code === "NO_API") {
      appendMsg("assistant", "Backend не подключён. Проверьте Railway URL в app.js.");
    } else {
      appendMsg("assistant", "Ошибка: " + e.message);
    }
    toast(e.message, "error");
  } finally {
    state.busy = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

function initChat() {
  const input = $("#chat-input");
  const sendBtn = $("#send-btn");
  if (input) {
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  sendBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    sendMessage();
  });
  $$(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (input) input.value = btn.dataset.prompt || "";
      sendMessage();
    });
  });
}

/* ========== Demo / Onboarding / Lifestyle / Business / Voice / Settings ========== */
function initDemo() {
  $("#demo-btn")?.addEventListener("click", async () => {
    try {
      const res = await api("/api/demo/activate", { method: "POST" });
      await loadConnected();
      toast("Демо: " + (res.connected || []).join(", "), "success");
      showView("chat");
      appendMsg(
        "assistant",
        "Демо включено. Попробуйте:\n• Какая погода в Токио?\n• Сгенерируй слоган\n• провайдер openrouter"
      );
    } catch (e) {
      showView("chat");
      appendMsg("assistant", "Локальное демо UI. Нужен backend для полного демо.");
      toast(e.message, "info");
    }
  });
}

function renderObStep() {
  const bd = $("#ob-backdrop");
  if (!bd) return;
  $$(".ob-step", bd).forEach((el) => {
    const n = parseInt(el.getAttribute("data-ob"), 10);
    el.hidden = n !== state.obStep;
  });
}

function showOnboarding() {
  if (localStorage.getItem("nexus-ob-done")) return;
  const bd = $("#ob-backdrop");
  if (!bd) return;
  bd.hidden = false;
  state.obStep = 0;
  renderObStep();
}

function finishOb() {
  const bd = $("#ob-backdrop");
  if (bd) bd.hidden = true;
  localStorage.setItem("nexus-ob-done", "1");
  SFX.success();
  api("/api/onboarding/complete", { method: "POST" }).catch(() => {});
}

function initOnboarding() {
  $$("[data-ob-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.obStep = Math.min((state.obStep || 0) + 1, 2);
      renderObStep();
    });
  });
  $$(".ob-role").forEach((b) => {
    b.addEventListener("click", () => {
      state.obRole = b.dataset.role;
      state.obStep = 2;
      renderObStep();
    });
  });
  $("#ob-finish")?.addEventListener("click", finishOb);
}

function initLifestyle() {
  $("#life-grid")?.addEventListener("click", (e) => {
    const card = e.target.closest(".life-card");
    if (!card) return;
    showView("chat");
    const input = $("#chat-input");
    if (input) input.value = card.dataset.prompt || "";
    setTimeout(() => sendMessage(), 120);
  });
  $("#life-voice-cta")?.addEventListener("click", () => {
    showView("chat");
    setTimeout(() => $("#voice-btn")?.click(), 200);
  });
}

function initBusiness() {
  $("#biz-submit")?.addEventListener("click", async () => {
    const body = {
      name: $("#biz-name")?.value,
      type: $("#biz-type")?.value,
      city: $("#biz-city")?.value,
      services: $("#biz-services")?.value,
      slots: $("#biz-slots")?.value,
      contact: $("#biz-contact")?.value,
    };
    try {
      const r = await api("/api/business/register", { method: "POST", body: JSON.stringify(body) });
      const out = $("#biz-result");
      if (out) out.textContent = r.message || "Заявка принята";
      toast("Заявка отправлена", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  });
}

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $("#voice-btn");
  const hint = $("#voice-hint");
  if (!btn) return;
  if (!SR) {
    btn.addEventListener("click", () => toast("Голос: Chrome или Safari", "info"));
    return;
  }
  const rec = new SR();
  rec.lang = "ru-RU";
  rec.interimResults = false;
  let listening = false;
  const stop = () => {
    listening = false;
    btn.classList.remove("listening");
    if (hint) hint.hidden = true;
  };
  rec.onresult = (ev) => {
    const text = ev.results[0][0].transcript;
    const input = $("#chat-input");
    if (input) input.value = text;
    showView("chat");
    setTimeout(() => sendMessage(), 150);
  };
  rec.onend = stop;
  rec.onerror = () => {
    stop();
    toast("Не удалось распознать речь", "error");
  };
  btn.addEventListener("click", () => {
    if (listening) {
      try {
        rec.stop();
      } catch (_) {}
      return;
    }
    listening = true;
    btn.classList.add("listening");
    if (hint) hint.hidden = false;
    SFX.soft();
    try {
      rec.start();
    } catch (_) {
      stop();
    }
  });
}

function initSettings() {
  $("#save-settings")?.addEventListener("click", async () => {
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          display_name: $("#set-name")?.value,
          grok_api_key: $("#set-grok")?.value || undefined,
          plan_id: $("#set-plan")?.value,
        }),
      });
      await loadSettings();
      toast("Сохранено", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  });
  $("#sfx-toggle")?.addEventListener("click", () => {
    SFX.on = !SFX.on;
    const b = $("#sfx-toggle");
    if (b) b.textContent = `Звук UI: ${SFX.on ? "вкл" : "выкл"}`;
    SFX.toggle();
  });
}

window.loginEmail = async function loginEmail() {
  const email = prompt("Email:");
  if (!email) return;
  try {
    const r = await api("/api/auth/email/start", { method: "POST", body: JSON.stringify({ email }) });
    const code = r.demo_code || prompt("Код из письма:");
    if (!code) return;
    const v = await api("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) });
    if (v.session_token) localStorage.setItem("nexus-session", v.session_token);
    toast("Вход выполнен", "success");
    await loadSettings();
  } catch (e) {
    toast(e.message, "error");
  }
};

$("#conn-search")?.addEventListener("input", () => renderConnectors());

/* ========== Boot ========== */
(async function boot() {
  initTheme();
  initNav();
  initChat();
  initDemo();
  initOnboarding();
  initLifestyle();
  initBusiness();
  initVoice();
  initSettings();
  try {
    await Promise.all([loadCatalog(), loadSettings(), loadConnected(), loadTools(), loadPacks(), loadPlans(), loadUsage()]);
  } catch (e) {
    console.warn(e);
  }
  renderConnectors();
  renderPacks();
  renderPricing();
  renderLearn();
  renderUsage();
  renderBuilder();
  showOnboarding();
  api("/api/health")
    .then((h) => {
      const st = $("#status-text");
      if (st) st.textContent = h.llm_provider || h.version || "online";
    })
    .catch(() => {
      const st = $("#status-text");
      if (st) st.textContent = "offline";
    });
  console.info("Nexus UI ready. API =", API, "GSAP =", Motion.ok(), "SFX =", SFX.on);
})();
