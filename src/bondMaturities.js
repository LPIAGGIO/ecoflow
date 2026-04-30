/**
 * Mapa de fechas de vencimiento de Lecaps, Boncaps y Duales en pesos.
 *
 * Tickers que data912 devuelve y que cubrimos:
 *   - LECAPs (S):     S14G6, S15Y6, S17L6, S29Y6, S30N6, S30O6, S30S6, S31G6, S31L6
 *   - BONCAPs (T):    T15E7, T30A7, T30J6, T30J7, T31Y7
 *   - BONCAPs (TT):   TTD26, TTJ26, TTS26
 *   - DUALES (...D):  S2G6D, S2L6D, S2Y6D, SL6D, SS6D
 *
 * Excluidos del mapa:
 *   - X tickers (X15Y6, X29Y6, etc.): son el mismo subyacente operado por circuito alternativo
 *   - CER puros (BU4J6, D30S6, M31G6): no entran en V1
 *   - Hard dollar (AE/AL/GD/GE): no son carry trade en pesos
 *
 * Letras de mes (convención Tesoro):
 *   E=ene F=feb M=mar A=abr Y=may J=jun L=jul G=ago S=sep O=oct N=nov D=dic
 */

const MONTH_LETTER = {
  E: 1,  F: 2,  M: 3,  A: 4,  Y: 5,  J: 6,
  L: 7,  G: 8,  S: 9,  O: 10, N: 11, D: 12,
};

// Mapa hardcodeado: ticker -> { type, maturityDate (ISO), capitalizable }
//   type: 'lecap' | 'boncap' | 'dual' | 'cer'
export const BOND_REGISTRY = {
  // ─── Lecaps (S) — capitalizan al vencimiento ───
  S14G6: { type: "lecap", maturityDate: "2026-08-14", capitalizable: true },
  S15Y6: { type: "lecap", maturityDate: "2026-05-15", capitalizable: true },
  S17L6: { type: "lecap", maturityDate: "2026-07-17", capitalizable: true },
  S29Y6: { type: "lecap", maturityDate: "2026-05-29", capitalizable: true },
  S30N6: { type: "lecap", maturityDate: "2026-11-30", capitalizable: true },
  S30O6: { type: "lecap", maturityDate: "2026-10-30", capitalizable: true },
  S30S6: { type: "lecap", maturityDate: "2026-09-30", capitalizable: true },
  S31G6: { type: "lecap", maturityDate: "2026-08-31", capitalizable: true },
  S31L6: { type: "lecap", maturityDate: "2026-07-31", capitalizable: true },

  // ─── Boncaps (T) — capitalizan al vencimiento ───
  T15E7: { type: "boncap", maturityDate: "2027-01-15", capitalizable: true },
  T30A7: { type: "boncap", maturityDate: "2027-04-30", capitalizable: true },
  T30J6: { type: "boncap", maturityDate: "2026-06-30", capitalizable: true },
  T30J7: { type: "boncap", maturityDate: "2027-06-30", capitalizable: true },
  T31Y7: { type: "boncap", maturityDate: "2027-05-31", capitalizable: true },

  // ─── Boncaps TT (capitalizables al vto) ───
  TTJ26: { type: "boncap", maturityDate: "2026-06-30", capitalizable: true },
  TTS26: { type: "boncap", maturityDate: "2026-09-15", capitalizable: true },
  TTD26: { type: "boncap", maturityDate: "2026-12-15", capitalizable: true },

  // ─── Duales TAMAR (terminan en D) — pagan el max(fija, TAMAR cap.) al vto ───
  // Para V1 los tratamos como capitalizables a tasa fija (la rama "fija"
  // del payoff). En la práctica la rama TAMAR puede pagar más, pero
  // necesita un proyector de TAMAR que aún no tenemos.
  // Fechas verificadas con cohen.com.ar.
  S2G6D: { type: "dual", maturityDate: "2026-08-14", capitalizable: true }, // ✓ cohen
  S2L6D: { type: "dual", maturityDate: "2026-07-17", capitalizable: true }, // ✓ cohen
  S2Y6D: { type: "dual", maturityDate: "2026-05-15", capitalizable: true }, // ✓ cohen
  SL6D:  { type: "dual", maturityDate: "2026-07-31", capitalizable: true }, // ✓ cohen
  SS6D:  { type: "dual", maturityDate: "2026-09-30", capitalizable: true }, // ✓ cohen
};

/**
 * Decoder regex como fallback. Intenta extraer la fecha del ticker.
 * Cubre 2 patrones que SÍ funcionan correctamente:
 *   - TT + LETRA + 2 dígitos:           ej. TTJ26 → 30/jun/2026
 *   - [ST] + DD + LETRA + 1 dígito:     ej. S29Y6 → 29/may/2026
 *
 * NOTA: Los Duales (terminan en D) NO se decodifican por regex porque
 * el patrón "S2L6D" no es "día + mes + año + D". El "2" no es día sino
 * identificador de serie. Por lo tanto los Duales SOLO funcionan vía
 * el mapa hardcodeado verificado con cohen.com.ar.
 *
 * Devuelve null para tickers que no matchean.
 *
 * @returns { type, maturityDate, capitalizable } | null
 */
export function decodeTicker(ticker) {
  if (!ticker || typeof ticker !== "string") return null;
  const t = ticker.toUpperCase().trim();

  // Patrón TT: TT + LETRA_MES + 2 dígitos del año
  const ttMatch = /^TT([EFMAYJLGSOND])(\d{2})$/.exec(t);
  if (ttMatch) {
    const month = MONTH_LETTER[ttMatch[1]];
    const year = 2000 + parseInt(ttMatch[2], 10);
    if (!month) return null;
    return {
      type: "boncap",
      maturityDate: isoDate(year, month, 30),
      capitalizable: true,
    };
  }

  // Patrón S/T standard: [ST] + DD + LETRA + 1 dígito  (ej. S29Y6, T30J7)
  const stMatch = /^([ST])(\d{2})([EFMAYJLGSOND])(\d)$/.exec(t);
  if (stMatch) {
    const prefix = stMatch[1];
    const day = parseInt(stMatch[2], 10);
    const month = MONTH_LETTER[stMatch[3]];
    const year = 2020 + parseInt(stMatch[4], 10);
    if (!month || day < 1 || day > 31) return null;
    return {
      type: prefix === "S" ? "lecap" : "boncap",
      maturityDate: isoDate(year, month, day),
      capitalizable: true,
    };
  }

  return null;
}

function isoDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Resuelve un ticker. Primero intenta el mapa hardcodeado, después el decoder.
 * @returns { type, maturityDate, capitalizable, source: 'registry'|'decoded' } | null
 */
export function resolveBond(ticker) {
  if (BOND_REGISTRY[ticker]) {
    return { ...BOND_REGISTRY[ticker], source: "registry" };
  }
  const decoded = decodeTicker(ticker);
  if (decoded) {
    return { ...decoded, source: "decoded" };
  }
  return null;
}

/** Días desde hoy hasta la fecha de vencimiento (ART, 24:00) */
export function daysToMaturity(maturityDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mat = new Date(maturityDate + "T00:00:00");
  return Math.max(0, Math.round((mat - today) / 86400000));
}

/**
 * Decide si un ticker debe ser ignorado del universo de carry trade.
 * Excluimos: X tickers (versión MEP duplicada), bonos hard-dollar,
 * y cualquier cosa que no matchee los patrones del Tesoro.
 *
 * @returns true si debe IGNORARSE
 */
export function shouldIgnoreTicker(ticker) {
  if (!ticker || typeof ticker !== "string") return true;
  const t = ticker.toUpperCase().trim();
  // X tickers: misma S pero negociadas por otro circuito — duplicaríamos
  if (t.startsWith("X")) return true;
  // CER puros (no en V1)
  if (t.startsWith("BU") || t.startsWith("D30") || t.startsWith("M31") || t.startsWith("DI")) return true;
  return false;
}
