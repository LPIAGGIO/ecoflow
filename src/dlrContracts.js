/**
 * Mapa de contratos de Dólar Futuro (DLR) de Matba-Rofex.
 *
 * Convención de tickers Matba-Rofex: DLR/{MES_3LETRAS}{AA}, donde el mes es
 * en español (ABR, MAY, JUN, JUL, AGO, SEP, OCT, NOV, DIC, ENE, FEB, MAR).
 * Aquí los normalizamos sin "/" para usar como id: "DLRMAY26".
 *
 * Vencimiento: último día hábil del mes del contrato (regla MtR).
 * Liquidación: contra Comunicación BCRA "A 3500" (mayorista), en pesos por
 * cada USD 1 del contrato (1.000 USD por contrato es el tamaño físico).
 *
 * Excluidos del registry:
 *   - DLR/...M (posiciones "Mayoristas" — duplican la curva, mismo precio)
 *   - DLR/{MES1}/{MES2} (rolls / spreads entre dos vencimientos)
 *   - ABR26 (vence el día del seed, días <= 0)
 *
 * Seed actualizado al 30/04/2026 con datos de matbarofex.primary.ventures.
 * Spot mayorista (DLR MTR) al mismo timestamp: $1.381,8.
 *
 * El registry sirve como fallback. La UI permite al usuario actualizar
 * los precios manualmente y los persiste en localStorage hasta que
 * tengamos un endpoint público que los devuelva en JSON.
 */

const MONTH_LETTER_AR = {
  ENE: 1, FEB: 2,  MAR: 3,  ABR: 4,  MAY: 5,  JUN: 6,
  JUL: 7, AGO: 8,  SEP: 9,  OCT: 10, NOV: 11, DIC: 12,
};

/**
 * Último día hábil del mes (lun-vie, sin feriados argentinos).
 * Aproximación razonable: si el último día calendario cae sábado,
 * retrocedo a viernes; si cae domingo, retrocedo a viernes.
 * Para vencimientos exactos consultar calendario MtR.
 */
function lastBusinessDayOfMonth(year, month) {
  // month es 1-12
  const d = new Date(Date.UTC(year, month, 0)); // día 0 del mes siguiente = último día del mes
  const dow = d.getUTCDay(); // 0=dom, 6=sab
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Decodifica el sufijo MES+AA y devuelve { year, month, maturityDate }.
 * Ejemplo: "MAY26" → { year: 2026, month: 5, maturityDate: "2026-05-29" }
 */
function decodeDlrSuffix(suffix) {
  const m = /^([A-Z]{3})(\d{2})$/.exec(suffix);
  if (!m) return null;
  const month = MONTH_LETTER_AR[m[1]];
  const year = 2000 + parseInt(m[2], 10);
  if (!month) return null;
  return { year, month, maturityDate: lastBusinessDayOfMonth(year, month) };
}

// Lista canónica de contratos vigentes al 30/04/2026 con sus precios seed.
// Ticker, mes, año y precio "Ajuste Ant." de la captura matbarofex.primary.ventures.
const DLR_SEED_RAW = [
  { suffix: "MAY26", priceSeed: 1416.0 },
  { suffix: "JUN26", priceSeed: 1443.5 },
  { suffix: "JUL26", priceSeed: 1474.0 },
  { suffix: "AGO26", priceSeed: 1504.0 },
  { suffix: "SEP26", priceSeed: 1535.0 },
  { suffix: "OCT26", priceSeed: 1564.5 },
  { suffix: "NOV26", priceSeed: 1594.5 },
  { suffix: "DIC26", priceSeed: 1625.0 },
  { suffix: "ENE27", priceSeed: 1655.0 },
  { suffix: "FEB27", priceSeed: 1685.0 },
  { suffix: "MAR27", priceSeed: 1717.0 },
];

/**
 * Registry final consumido por el módulo.
 * Cada entrada: { ticker, suffix, maturityDate, priceSeed }
 * Ordenado por fecha de vencimiento ascendente.
 */
export const DLR_REGISTRY = DLR_SEED_RAW
  .map(({ suffix, priceSeed }) => {
    const decoded = decodeDlrSuffix(suffix);
    if (!decoded) return null;
    return {
      ticker: `DLR${suffix}`,
      displayTicker: `DLR/${suffix}`, // formato pizarra MtR
      suffix,
      maturityDate: decoded.maturityDate,
      priceSeed,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));

/**
 * Spot mayorista (BCRA Com. A 3500) al momento de la captura.
 * Se usa como fallback si /api/dolares no devuelve la casa "mayorista".
 */
export const DLR_SPOT_SEED = 1381.8;

/** Fecha del seed (para mostrar en UI cuando no hay datos editados). */
export const DLR_SEED_DATE = "2026-04-30";

/** Días entre hoy y la fecha de vencimiento (>=0). */
export function daysToExpiry(maturityDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(maturityDate + "T00:00:00");
  return Math.max(0, Math.round((exp - today) / 86400000));
}

/**
 * Tasa Nominal Anual implícita (365 días).
 * TNA = (Futuro/Spot - 1) × 365/días
 */
export function implicitTNA(futuro, spot, days) {
  if (!futuro || !spot || !days || days <= 0) return null;
  return (futuro / spot - 1) * (365 / days);
}

/**
 * Tasa Efectiva Mensual implícita (30 días).
 * TEM = (Futuro/Spot)^(30/días) - 1
 */
export function implicitTEM(futuro, spot, days) {
  if (!futuro || !spot || !days || days <= 0) return null;
  return Math.pow(futuro / spot, 30 / days) - 1;
}

/**
 * Tasa Efectiva Anual implícita (365 días, capitalización compuesta).
 * TEA = (Futuro/Spot)^(365/días) - 1
 */
export function implicitTEA(futuro, spot, days) {
  if (!futuro || !spot || !days || days <= 0) return null;
  return Math.pow(futuro / spot, 365 / days) - 1;
}
