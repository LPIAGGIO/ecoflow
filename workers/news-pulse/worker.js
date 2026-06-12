/**
 * Worker: news-pulse — noticias de mercado argentinas, clasificadas.
 *
 * Cada corrida (PM2 cron cada 30 min) levanta RSS de Google News (queries
 * dirigidas a mercado AR) + Cronista, parsea los items, los clasifica
 * por keywords y upsertea en Supabase `market_news` (dedup por
 * title_hash). El widget "Pulso de Mercado" lee esa tabla.
 *
 * Clasificación v1 (keywords con signo, sin LLM):
 *   - dolar_dir:  +1 = la noticia empuja el dólar para ARRIBA (presión),
 *                 -1 = alivia, 0 = neutro o sin señal clara.
 *   - merval_dir: +1 = alcista para acciones/bonos AR, -1 = bajista.
 *   - relevance:  0-100 según cuántos temas de mercado toca el título.
 * Filosofía: flecha SOLO con señal clara; ante la duda, 0 (neutro).
 * El score exige |suma| >= 2 para asignar dirección — una sola palabra
 * ambigua no alcanza.
 *
 * Idempotente: title_hash (md5 de título normalizado) es UNIQUE; el
 * upsert con ignoreDuplicates no pisa clasificaciones previas.
 */

require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } }
);

const log = (m, x) => console.log(`[${new Date().toISOString()}] [INFO] ${m}`, x ? JSON.stringify(x) : '');
const logErr = (m, e) => console.error(`[${new Date().toISOString()}] [ERROR] ${m}`, e?.message || e || '');

// ── Fuentes ──────────────────────────────────────────────────────────
// Google News RSS es el agregador más robusto (junta Ámbito, Cronista,
// Infobae, LN+, etc. sin depender del RSS propio de cada diario).
const FEEDS = [
  { source: 'gnews:dolar', url: 'https://news.google.com/rss/search?q=d%C3%B3lar%20OR%20BCRA%20OR%20%22tipo%20de%20cambio%22%20when%3A1d&hl=es-419&gl=AR&ceid=AR:es-419' },
  { source: 'gnews:mercado', url: 'https://news.google.com/rss/search?q=merval%20OR%20%22riesgo%20pa%C3%ADs%22%20OR%20bonos%20OR%20acciones%20argentinas%20when%3A1d&hl=es-419&gl=AR&ceid=AR:es-419' },
  { source: 'gnews:macro', url: 'https://news.google.com/rss/search?q=FMI%20Argentina%20OR%20inflaci%C3%B3n%20OR%20reservas%20BCRA%20when%3A1d&hl=es-419&gl=AR&ceid=AR:es-419' },
];

// ── Clasificador por keywords ────────────────────────────────────────
// Cada regla: [regex, peso]. Positivo empuja la dirección "sube".
// OJO: proximidad acotada (.{0,35}) entre sujeto y verbo — un `.*` libre
// cruza cláusulas ("el riesgo país cayó... y las acciones TREPARON"
// matcheaba "riesgo país trepa" y clasificaba todo al revés; caso real
// de la primera corrida, 11/06).
// Verbos de suba/baja SIN paréntesis externos: cada regla los envuelve.
const UP_W = "sube|suben|subi[óo]|dispara\\w*|salta\\w*|trepa\\w*|vuela|vuelan|vol[óo]|volaron|escala\\w*|r[ée]cord|m[áa]ximo";
const DOWN_W = "baja|bajan|baj[óo]|cae|caen|cay[óo]|cayeron|retrocede\\w*|cede|perfora\\w*|derrumb\\w+|desplom\\w+|hund\\w+|pierde|pierden|perdi[óo]|m[ií]nimo";
const rx = (s) => new RegExp(s, "i");
const RULES_DOLAR = [
  [/devalu/i, 3], [/corrida/i, 3], [/cepo/i, 2],
  [rx(`brecha.{0,35}\\b(${UP_W})`), 3], [rx(`brecha.{0,35}\\b(cierra|achica|${DOWN_W})`), -2],
  [rx(`reservas.{0,35}\\b(${DOWN_W}|sangr[ií]a)`), 3], [rx(`reservas.{0,35}\\b(r[ée]cord|suma|acumula|compra)`), -2],
  [rx(`d[óo]lar.{0,30}\\b(${UP_W})`), 3], [rx(`d[óo]lar.{0,30}\\b(${DOWN_W}|calma|estable)`), -3],
  [rx(`blue.{0,25}\\b(${UP_W})`), 2],
  [rx(`inflaci[óo]n.{0,30}\\b(acelera|${UP_W})`), 2], [rx(`inflaci[óo]n.{0,30}\\b(desacelera|menor|${DOWN_W})`), -2],
  [/emisi[óo]n monetaria/i, 2],
  [/(tensi[óo]n|sin acuerdo|traba).{0,20}(fmi|fondo)/i, 2], [/(acuerdo|desembolso|aprob\w*).{0,25}(fmi|fondo|banco mundial)/i, -3],
  [/(menor|aleja\w*|sin) riesgo de default/i, -2], [/default|reperfil/i, 2],
  [/banda.{0,25}(rompe|presiona|techo)/i, 3], [/super[áa]vit/i, -2],
  [rx(`riesgo pa[ií]s.{0,35}\\b(${UP_W})`), 2], [rx(`riesgo pa[ií]s.{0,35}\\b(${DOWN_W})`), -2],
];
const RULES_MERVAL = [
  [rx(`merval.{0,35}\\b(${UP_W}|rally|gana)`), 3], [rx(`merval.{0,35}\\b(${DOWN_W})`), -3],
  [rx(`(acciones|adrs?).{0,35}\\b(${UP_W}|rally|ganan)`), 2], [rx(`(acciones|adrs?).{0,35}\\b(${DOWN_W})`), -2],
  [rx(`bonos.{0,35}\\b(${UP_W}|rally|ganan)`), 2], [rx(`bonos.{0,35}\\b(${DOWN_W})`), -2],
  [rx(`riesgo pa[ií]s.{0,35}\\b(${DOWN_W})`), 3], [rx(`riesgo pa[ií]s.{0,35}\\b(${UP_W})`), -3],
  [/(acuerdo|desembolso).{0,25}(fmi|fondo)/i, 2],
  [/upgrade|mejora.{0,20}calificaci[óo]n|recomienda/i, 2],
  [rx(`wall street.{0,30}\\b(${UP_W})`), 1], [rx(`wall street.{0,30}\\b(${DOWN_W})`), -1],
  [/sell.?off|p[áa]nico|derrumbe global/i, -2], [/super[áa]vit/i, 1],
  [/(menor|aleja\w*|sin) riesgo de default/i, 2], [/default|reperfil|corrida/i, -2],
  [/devalu/i, -1],
];
const TOPIC_TAGS = [
  ['dolar', /d[óo]lar|tipo de cambio|brecha|blue|mep|ccl|mayorista|banda/i],
  ['bcra', /bcra|banco central|reservas|tasas?|pases|leliq|tamar/i],
  ['merval', /merval|acciones|bolsa|byma|adr/i],
  ['bonos', /bonos?|riesgo pa[ií]s|deuda|globales|bonares/i],
  ['fmi', /fmi|fondo monetario|desembolso/i],
  ['inflacion', /inflaci[óo]n|ipc|precios/i],
  ['internacional', /fed|wall street|treasur|tasa.*eeuu|china|brasil/i],
];

function classify(text) {
  const score = (rules) => rules.reduce((s, [re, w]) => (re.test(text) ? s + w : s), 0);
  const sd = score(RULES_DOLAR);
  const sm = score(RULES_MERVAL);
  const topics = TOPIC_TAGS.filter(([, re]) => re.test(text)).map(([t]) => t);
  // relevancia: temas tocados (hasta 60) + intensidad de señal (hasta 40)
  const relevance = Math.min(100, topics.length * 20 + Math.min(40, (Math.abs(sd) + Math.abs(sm)) * 5));
  return {
    dolar_dir: sd >= 2 ? 1 : sd <= -2 ? -1 : 0,
    merval_dir: sm >= 2 ? 1 : sm <= -2 ? -1 : 0,
    topics,
    relevance,
  };
}

// ── Parser RSS mínimo (sin dependencias) ─────────────────────────────
function decodeEntities(s) {
  return (s || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '').trim();
}
function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeEntities(m[1]) : null;
    };
    const title = pick('title');
    const link = pick('link');
    const pub = pick('pubDate');
    if (!title || !link) continue;
    items.push({ title, link, published_at: pub ? new Date(pub).toISOString() : null });
  }
  return items;
}

async function main() {
  log('Inicio news-pulse');
  const rows = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 (MidasTerminal news-pulse)' } });
      if (!res.ok) { logErr(`${feed.source}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseRss(xml);
      log(`${feed.source}: ${items.length} items`);
      for (const it of items) {
        // Google News mete " - Fuente" al final del título; lo separamos.
        let title = it.title;
        let source = feed.source;
        const m = title.match(/^(.*)\s-\s([^-]{2,40})$/);
        if (feed.source.startsWith('gnews') && m) { title = m[1].trim(); source = m[2].trim(); }
        const norm = title.toLowerCase().replace(/[^a-záéíóúüñ0-9]+/g, ' ').trim();
        if (norm.length < 15) continue;
        const cls = classify(title);
        if (cls.topics.length === 0) continue; // sin tema de mercado → afuera
        rows.push({
          title, link: it.link, published_at: it.published_at, source,
          ...cls,
          title_hash: crypto.createHash('md5').update(norm).digest('hex'),
        });
      }
    } catch (e) { logErr(`${feed.source} falló`, e); }
  }

  // dedup interno por hash (entre feeds)
  const byHash = new Map();
  for (const r of rows) if (!byHash.has(r.title_hash)) byHash.set(r.title_hash, r);
  const unique = Array.from(byHash.values());
  log(`Items únicos con tema de mercado: ${unique.length}`);

  let inserted = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { error } = await supabase.from('market_news').upsert(batch, { onConflict: 'title_hash', ignoreDuplicates: true });
    if (error) { logErr('upsert', error); process.exit(1); }
    inserted += batch.length;
  }

  // retención: 14 días (la tabla no necesita historia larga)
  await supabase.from('market_news').delete().lt('fetched_at', new Date(Date.now() - 14 * 86400000).toISOString());

  log('Fin OK', { procesadas: inserted });
  process.exit(0);
}

main().catch((e) => { logErr('main', e); process.exit(1); });
