/**
 * Mapa de fechas de vencimiento de Lecaps, Boncaps y Duales en pesos.
 *
 * Estrategia:
 * 1. Mapa hardcodeado con los bonos vivos hoy (datos confirmados de Logos).
 * 2. Si data912 devuelve un ticker que no está en el mapa, intentamos decodificarlo
 *    con un regex sobre el patrón estándar del Tesoro:
 *      - LECAP: S + DD + MES(letra) + AÑO(1 dígito)   ej: S29Y6 = 29/may/2026
 *      - BONCAP: T + DD + MES(letra) + AÑO(1 dígito)  ej: T30J7 = 30/jun/2027
 *      - BONCAP-TT: TT + MES(letra) + AÑO(2 dígitos)  ej: TTJ26 = jun/2026 (día 30 por convención)
 *
 * Cuando salgan licitaciones nuevas conviene actualizar este mapa explícitamente
 * con los datos oficiales del Tesoro, ya que el decoder es heurístico.
 *
 * Fuente: matriz de Logos Servicios Financieros (logos-serviciosfinancieros.com.ar/carry-trade)
 */

// Letra del mes (convención del Tesoro)
//  E=enero F=febrero M=marzo A=abril Y=mayo J=junio L=julio G=agosto S=septiembre O=octubre N=noviembre D=diciembre
const MONTH_LETTER = {
  E: 1,  F: 2,  M: 3,  A: 4,  Y: 5,  J: 6,
  L: 7,  G: 8,  S: 9,  O: 10, N: 11, D: 12,
};

// Mapa hardcodeado: ticker -> { type, maturityDate (ISO), capitalizable }
//   type: 'lecap' | 'boncap' | 'dual' | 'cer'
//   capitalizable: true para Lecaps/Boncaps a tasa fija (paga capital + interés al vto)
export const BOND_REGISTRY = {
  // ─── Lecaps (S) — todas capitalizan al vencimiento ───
  S29Y6: { type: 'lecap', maturityDate: '2026-05-29', capitalizable: true },
  S30J6: { type: 'lecap', maturityDate: '2026-06-30', capitalizable: true },
  S31L6: { type: 'lecap', maturityDate: '2026-07-31', capitalizable: true },
  S31G6: { type: 'lecap', maturityDate: '2026-08-31', capitalizable: true },
  S30O6: { type: 'lecap', maturityDate: '2026-10-30', capitalizable: true },
  S30N6: { type: 'lecap', maturityDate: '2026-11-30', capitalizable: true },

  // ─── Boncaps (T) — capitalizan al vencimiento ───
  T30J6: { type: 'boncap', maturityDate: '2026-06-30', capitalizable: true },
  T15E7: { type: 'boncap', maturityDate: '2027-01-15', capitalizable: true },
  T30A7: { type: 'boncap', maturityDate: '2027-04-30', capitalizable: true },
  T31Y7: { type: 'boncap', maturityDate: '2027-05-31', capitalizable: true },
  T30J7: { type: 'boncap', maturityDate: '2027-06-30', capitalizable: true },

  // ─── Boncaps TT (capitalizan al vto, día 30 por convención salvo TTS26 que es 15) ───
  TTJ26: { type: 'boncap', maturityDate: '2026-06-30', capitalizable: true },
  TTS26: { type: 'boncap', maturityDate: '2026-09-15', capitalizable: true },
  TTD26: { type: 'boncap', maturityDate: '2026-12-15', capitalizable: true },
};

/**
 * Decoder regex como fallback. Intenta extraer la fecha del ticker.
 * Returns { type, maturityDate, capitalizable } | null
 */
export function decodeTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return null;
  const t = ticker.toUpperCase().trim();

  // Patrón TT: TT + LETRA_MES + 2_DIGITOS_AÑO  (ej. TTJ26)
  const ttMatch = /^TT([EFMAYJLGSOND])(\d{2})$/.exec(t);
  if (ttMatch) {
    const month = MONTH_LETTER[ttMatch[1]];
    const year = 2000 + parseInt(ttMatch[2], 10);
    if (!month) return null;
    // Día 30 por convención (TTS26 es el único excepción, ya hardcodeado)
    return {
      type: 'boncap',
      maturityDate: isoDate(year, month, 30),
      capitalizable: true,
    };
  }

  // Patrón S/T standard: [ST] + DD + LETRA_MES + 1_DIGITO_AÑO  (ej. S29Y6, T30J7)
  const stMatch = /^([ST])(\d{2})([EFMAYJLGSOND])(\d)$/.exec(t);
  if (stMatch) {
    const prefix = stMatch[1];
    const day = parseInt(stMatch[2], 10);
    const month = MONTH_LETTER[stMatch[3]];
    const year = 2020 + parseInt(stMatch[4], 10);
    if (!month || day < 1 || day > 31) return null;
    return {
      type: prefix === 'S' ? 'lecap' : 'boncap',
      maturityDate: isoDate(year, month, day),
      capitalizable: true,
    };
  }

  return null;
}

function isoDate(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Resuelve un ticker. Primero intenta el mapa hardcodeado, después el decoder.
 * @returns { type, maturityDate, capitalizable, source: 'registry'|'decoded' } | null
 */
export function resolveBond(ticker) {
  if (BOND_REGISTRY[ticker]) {
    return { ...BOND_REGISTRY[ticker], source: 'registry' };
  }
  const decoded = decodeTicker(ticker);
  if (decoded) {
    return { ...decoded, source: 'decoded' };
  }
  return null;
}

/** Días desde hoy hasta la fecha de vencimiento (ART, 24:00) */
export function daysToMaturity(maturityDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mat = new Date(maturityDate + 'T00:00:00');
  return Math.max(0, Math.round((mat - today) / 86400000));
}
