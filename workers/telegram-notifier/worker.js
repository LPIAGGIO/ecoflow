/**
 * Worker telegram-notifier: servicio permanente (24/7) que conecta Midas con
 * Telegram. Dos responsabilidades, en dos loops independientes:
 *
 *   1) LINKING (long-poll getUpdates): procesa los mensajes que llegan al bot.
 *      - "/start <code>"  -> vincula el chat con el user_id de Midas (deep-link
 *                            generado desde Configuracion > Notificaciones).
 *      - "/start"         -> mensaje de bienvenida con instrucciones.
 *      - "/stop"          -> pausa las notificaciones (enabled=false).
 *      - "/ping"/"/help"  -> respuesta simple.
 *
 *   2) ALERTAS (cada 30s): evalua las price_alerts pendientes de cada usuario
 *      vinculado + habilitado que tenga la preferencia price_alerts activa, y
 *      dispara el mensaje a Telegram cuando el precio cruza el nivel.
 *
 * Resolucion de precio: replica EXACTAMENTE la logica del front (api/mtr-md.js
 * para futuros DLR, data912 para el resto), asi la alerta server-side dispara
 * igual que la del browser.
 *
 * Anti doble-disparo: el claim de la alerta es atomico
 * (update ... where triggered_at is null returning *). Quien gana la carrera
 * (este worker o el browser) es el unico que notifica. No hay doble Telegram.
 *
 * Env (.env): TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * PM2: servicio permanente fork autorestart (no es cron).
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan env vars (TELEGRAM_BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Verifica .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const API = `https://api.telegram.org/bot${TOKEN}`;
const ALERT_INTERVAL_MS = 30 * 1000;
const POLL_TIMEOUT_S = 30; // long-poll de getUpdates

// Preferencias por defecto si el usuario todavia no guardo ninguna.
const DEFAULT_PREFS = { price_alerts: true };

/* ─────────────── Telegram helpers ─────────────── */

async function tg(method, body) {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error(`[tg:${method}] error:`, j.description || r.status);
  return j;
}

function sendMessage(chatId, text) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

/* ─────────────── Resolucion de precio (espejo del front) ─────────────── */

const LAST_FRESH_MS = 30 * 60 * 1000;
const LAST_INTRADAY_MS = 36 * 60 * 60 * 1000;

// app ticker "DLRJUN26" -> true si es un futuro DLR (mismo regex que api/mtr-md).
function isDlrFuture(appTicker) {
  return /^(DLR)([A-Z]{3})(\d{2})$/.test((appTicker || "").toUpperCase().trim().replace("/", ""));
}
// symbol de la tabla "DLR/JUN26" -> app ticker "DLRJUN26".
const symbolToApp = (symbol) => (symbol || "").replace("/", "");

// Replica rowToPriceEntry de api/mtr-md.js: prioriza last fresco > mid > last
// intradia > settlement. Devuelve el precio elegido (o null).
function futurePrice(row, nowMs) {
  const last = row.last != null ? Number(row.last) : null;
  const bid = row.bid != null ? Number(row.bid) : null;
  const offer = row.ask != null ? Number(row.ask) : null;
  const settlement = row.settlement != null ? Number(row.settlement) : null;
  const midpoint = bid != null && offer != null ? (bid + offer) / 2 : null;
  const lastDate = row.last_ts ? new Date(row.last_ts).getTime() : null;
  const lastAge = lastDate != null ? nowMs - lastDate : Infinity;

  if (last != null && lastAge <= LAST_FRESH_MS) return last;
  if (midpoint != null) return midpoint;
  if (last != null && lastAge <= LAST_INTRADAY_MS) return last;
  if (settlement != null) return settlement;
  return null;
}

// Mapa de precios de futuros DLR { "DLRJUN26": 1472, ... } leyendo mtr_market_data.
async function loadFuturesMap() {
  const { data, error } = await supabase.from("mtr_market_data").select("*");
  if (error) { console.error("[futures] error:", error.message); return {}; }
  const nowMs = Date.now();
  const map = {};
  for (const row of data || []) {
    const p = futurePrice(row, nowMs);
    if (p != null) map[symbolToApp(row.symbol)] = p;
  }
  return map;
}

// Mapa de precios no-futuros { symbol: precio } desde data912 (mismas fuentes
// que /api/data912). Campo `c` = ultimo, igual que flowResolve del front.
async function loadData912Map() {
  const SOURCES = [
    "https://data912.com/live/arg_bonds",
    "https://data912.com/live/arg_notes",
    "https://data912.com/live/arg_stocks",
    "https://data912.com/live/arg_cedears",
  ];
  const map = {};
  await Promise.all(SOURCES.map(async (url) => {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Midas/0.1" } });
      if (!r.ok) return;
      const arr = await r.json();
      for (const x of Array.isArray(arr) ? arr : []) {
        if (x && x.symbol && x.c != null) map[x.symbol] = Number(x.c);
      }
    } catch (e) { console.error("[data912] error:", e.message); }
  }));
  return map;
}

/* ─────────────── Loop de alertas ─────────────── */

async function alertLoop() {
  try {
    // 1) Usuarios vinculados + habilitados.
    const { data: links } = await supabase
      .from("telegram_links")
      .select("user_id,chat_id")
      .not("chat_id", "is", null)
      .eq("enabled", true);
    if (!links || links.length === 0) return;

    const userIds = links.map((l) => l.user_id);
    const chatByUser = Object.fromEntries(links.map((l) => [l.user_id, l.chat_id]));

    // 2) Preferencias de esos usuarios.
    const { data: prefRows } = await supabase
      .from("notification_prefs").select("user_id,prefs").in("user_id", userIds);
    const prefsByUser = Object.fromEntries((prefRows || []).map((p) => [p.user_id, p.prefs || {}]));
    const wantsPriceAlerts = (uid) => {
      const p = prefsByUser[uid] || DEFAULT_PREFS;
      return p.price_alerts !== false; // default ON
    };
    const activeUsers = userIds.filter(wantsPriceAlerts);
    if (activeUsers.length === 0) return;

    // 3) Alertas pendientes de esos usuarios.
    const { data: alerts } = await supabase
      .from("price_alerts")
      .select("id,user_id,ticker,price,dir")
      .is("triggered_at", null)
      .in("user_id", activeUsers);
    if (!alerts || alerts.length === 0) return;

    // 4) Cargar precios: futuros siempre; data912 solo si hay alertas no-futuro.
    const futMap = await loadFuturesMap();
    const needsData912 = alerts.some((a) => !isDlrFuture(a.ticker));
    const d912 = needsData912 ? await loadData912Map() : {};

    // 5) Evaluar y disparar.
    for (const a of alerts) {
      const tk = (a.ticker || "").toUpperCase().trim();
      const price = isDlrFuture(tk) ? futMap[tk] : d912[a.ticker];
      if (price == null) continue;
      const level = Number(a.price);
      const hit = a.dir === "up" ? price >= level : price <= level;
      if (!hit) continue;

      // Claim atomico: solo notifica quien marca triggered_at (vs el browser).
      const { data: claimed } = await supabase
        .from("price_alerts")
        .update({ triggered_at: new Date().toISOString() })
        .eq("id", a.id)
        .is("triggered_at", null)
        .select("id");
      if (!claimed || claimed.length === 0) continue; // otro lo tomo primero

      const arrow = a.dir === "up" ? "🎯 ▲" : "🛑 ▼";
      const txt = `${arrow} <b>${a.ticker}</b>\nPrecio <b>${price}</b> cruzo tu alerta (${a.dir === "up" ? "sube a" : "baja a"} ${level}).`;
      await sendMessage(chatByUser[a.user_id], txt);
      await supabase.from("notification_log").insert({
        user_id: a.user_id, kind: "price_alert",
        dedup_key: `${a.ticker}|${level}|${a.dir}`,
        title: `${a.ticker} ${level}`, body: `precio ${price}`,
      });
      console.log(`[alert] ${a.user_id} ${a.ticker} ${a.dir} ${level} @ ${price}`);
    }
  } catch (e) {
    console.error("[alertLoop] error:", e.message);
  }
}

/* ─────────────── Loop de vinculacion (getUpdates) ─────────────── */

let offset = 0;

async function handleUpdate(u) {
  offset = Math.max(offset, u.update_id + 1);
  const msg = u.message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const username = msg.from && msg.from.username ? msg.from.username : null;

  // /start <code>  -> vincular
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const code = parts[1];
    if (!code) {
      await sendMessage(chatId,
        "Hola, soy <b>Midas Alertas</b>.\n\nPara recibir notificaciones, entra a Midas → <b>Configuracion → Notificaciones</b> y toca <b>Conectar Telegram</b>. Eso te trae aca con tu codigo de vinculacion.");
      return;
    }
    const nowIso = new Date().toISOString();
    const { data: link } = await supabase
      .from("telegram_links")
      .select("user_id")
      .eq("link_code", code)
      .gt("link_code_expires_at", nowIso)
      .maybeSingle();
    if (!link) {
      await sendMessage(chatId, "Ese codigo es invalido o vencio. Genera uno nuevo desde Midas → Configuracion → Notificaciones.");
      return;
    }
    await supabase.from("telegram_links").update({
      chat_id: String(chatId), tg_username: username, linked_at: nowIso,
      link_code: null, link_code_expires_at: null, enabled: true,
      updated_at: nowIso,
    }).eq("user_id", link.user_id);
    await sendMessage(chatId, "✅ <b>Vinculado.</b> Vas a recibir aca las notificaciones que elijas en Midas. Para pausar, manda /stop.");
    console.log(`[link] user ${link.user_id} -> chat ${chatId}`);
    return;
  }

  // /stop -> pausar
  if (text.startsWith("/stop")) {
    await supabase.from("telegram_links")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("chat_id", String(chatId));
    await sendMessage(chatId, "Notificaciones pausadas. Reactivalas desde Midas → Configuracion → Notificaciones (o mandando /start con tu codigo).");
    return;
  }

  // /ping, /help
  if (text.startsWith("/ping")) { await sendMessage(chatId, "pong"); return; }
  if (text.startsWith("/help")) {
    await sendMessage(chatId, "Comandos: /start &lt;codigo&gt; para vincular, /stop para pausar, /ping para probar. La activacion y las preferencias se manejan desde Midas → Configuracion → Notificaciones.");
    return;
  }
}

async function pollLoop() {
  // Bucle infinito de long-poll. Cada getUpdates espera hasta POLL_TIMEOUT_S
  // por updates nuevos; si no hay, vuelve y reintenta.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=${POLL_TIMEOUT_S}&offset=${offset}`);
      const j = await r.json();
      if (j.ok && Array.isArray(j.result)) {
        for (const u of j.result) {
          try { await handleUpdate(u); } catch (e) { console.error("[handleUpdate]", e.message); }
        }
      }
    } catch (e) {
      console.error("[pollLoop] error:", e.message);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

/* ─────────────── Arranque ─────────────── */

console.log("[telegram-notifier] arrancando. bot OK, alert interval", ALERT_INTERVAL_MS / 1000, "s");
pollLoop();
alertLoop();
setInterval(alertLoop, ALERT_INTERVAL_MS);
