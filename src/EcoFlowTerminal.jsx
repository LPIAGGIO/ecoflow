import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";
import { resolveBond, daysToMaturity, shouldIgnoreTicker, BOND_REGISTRY } from "./bondMaturities.js";
import {
  DLR_REGISTRY,
  DLR_SPOT_SEED,
  DLR_SEED_DATE,
  daysToExpiry,
  implicitTNA,
  implicitTEM,
  implicitTEA,
} from "./dlrContracts.js";
import {
  Home,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  LineChart,
  Globe,
  Landmark,
  Building2,
  Receipt,
  Percent,
  Split,
  Banknote,
  ArrowUpDown,
  Vault,
  BarChart3,
  Gauge,
  Coins,
  Radar,
  ArrowRightLeft,
  Scale,
  Spline,
  Diff,
  DollarSign,
  Calculator,
  Sigma,
  Tag,
  Repeat,
  BadgePercent,
  Activity,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Info,
  ArrowUp,
  ArrowDown,
  Pencil,
  LogOut,
  LogIn,
  User,
  Briefcase,
  Sparkles,
  ShieldCheck,
  Plus,
  X,
  Trash2,
  Filter,
  TrendingDown,
  Wallet,
  Bitcoin,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
  Label,
} from "recharts";

/* ─────────── Sistema de tokens visuales ───────────
 *
 * Adaptación de Axon Capital al contexto de terminal financiera.
 * El manual define la marca para fondos claros + impresos. Acá se
 * traduce a un dashboard oscuro estilo trading desk:
 *
 *   - Fondo principal:  Gris Axon profundizado (#0F1B2B)
 *   - Paneles/sidebar:  Azul Axon (#1A283E) — color principal de la marca
 *   - Hundidos:         Negro Axon (#0D1A29)
 *   - Texto:            Blanco Axon (#F6F7F6)
 *
 * El acento principal se sube a un derivado del Azul Axon
 * (#5B8DD6) que mantiene la familia tonal de la marca pero
 * tiene la luminancia necesaria para operar como color de
 * estado activo, links y refresh sobre fondo oscuro.
 *
 * La paleta categórica para charts se conserva (es la identidad
 * visual del sistema de viz) pero se nombra explícitamente como
 * "categórica de datos" — separada del branding institucional.
 */
const C = {
  // Base oscura — adaptación Axon
  bg: "#0F1B2B",            // Gris Axon profundo · workspace + navbar
  panel: "#1A283E",         // Azul Axon · sidebar + cards (color principal de marca)
  deep: "#0D1A29",          // Negro Axon · inputs, elementos hundidos
  text: "#F6F7F6",          // Blanco Axon · texto principal

  // Texto y bordes (basados en Blanco Axon con alpha)
  muted: "rgba(246, 247, 246, 0.62)",
  dim: "rgba(246, 247, 246, 0.38)",
  faint: "rgba(246, 247, 246, 0.10)",
  border: "rgba(246, 247, 246, 0.07)",
  borderStrong: "rgba(246, 247, 246, 0.14)",

  // Acento principal — derivado claro del Azul Axon para trabajar
  // como color de estado activo, links, focus rings, refresh.
  accent: "#5B8DD6",
  accentSoft: "rgba(91, 141, 214, 0.10)",
  accentBorder: "rgba(91, 141, 214, 0.32)",
  accentGlow: "rgba(91, 141, 214, 0.20)",

  // Status semánticos — armonizados con el azul Axon de fondo
  red: "#F87171",
  green: "#4ADE80",
  yellow: "#FACC15",

  // Paleta categórica para charts, KPIs, tickers.
  // Se conserva una paleta amplia y diferenciable porque los charts
  // financieros priorizan contraste entre series por sobre coherencia
  // de marca. Los colores están afinados para legibilidad sobre el
  // fondo Azul Axon (#1A283E) y Gris Axon (#0F1B2B).
  cat: {
    cyan: "#5B8DD6",       // azul-axon-light (acento de marca)
    emerald: "#34D399",
    yellow: "#FACC15",
    pink: "#F472B6",
    violet: "#A78BFA",
    orange: "#FB923C",
    teal: "#22D3EE",
    lime: "#A3E635",
    rose: "#FB7185",
    amber: "#FBBF24",
    indigo: "#818CF8",
  },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home, type: "single" },
  {
    id: "portfolio-ia",
    label: "Portfolio IA",
    icon: Briefcase,
    type: "single",
    badge: "BETA",
    requiresAuth: true,  // Si no hay sesión, muestra wall de login
  },
  {
    id: "bcra",
    label: "Estadísticas BCRA",
    icon: Banknote,
    type: "group",
    children: [
      { id: "bandas-cambiarias", label: "Bandas Cambiarias", icon: ArrowUpDown },
      { id: "reservas", label: "Reservas", icon: Vault },
      { id: "rem", label: "REM", icon: BarChart3 },
      { id: "tasas", label: "Tasas", icon: Gauge },
      { id: "base-monetaria", label: "Base Monetaria", icon: Coins },
    ],
  },
  {
    id: "mercado",
    label: "Mercado",
    icon: TrendingUp,
    type: "group",
    children: [
      { id: "acciones", label: "Acciones", icon: LineChart },
      { id: "cedears", label: "Cedears", icon: Globe },
      { id: "ons", label: "ONs", icon: Building2 },
      { id: "bonos", label: "Bonos Soberanos", icon: Landmark },
      { id: "lecaps", label: "Lecaps", icon: Receipt },
      { id: "cer", label: "CER", icon: Percent },
      { id: "duales", label: "Duales", icon: Split },
    ],
  },
  {
    id: "analizadores",
    label: "Analizadores",
    icon: Radar,
    type: "group",
    children: [
      { id: "compara-dolar", label: "Cotizaciones Dólar", icon: DollarSign },
      { id: "carry-trade", label: "Carry Trade", icon: ArrowRightLeft },
      { id: "futuros-caucion", label: "Futuros vs Caución", icon: Scale },
      { id: "curva-tasas", label: "Curva de Tasas", icon: Spline },
      { id: "spread-cer-fija", label: "Spread CER / Fija", icon: Diff },
    ],
  },
  {
    id: "calculadoras",
    label: "Calculadoras",
    icon: Calculator,
    type: "group",
    children: [
      { id: "calc-tasas", label: "Tasas (TNA/TEA/TEM)", icon: Sigma },
      { id: "calc-precio-bonos", label: "Precio de Bonos", icon: Tag },
      { id: "calc-mep-ccl", label: "MEP / CCL", icon: Repeat },
      { id: "calc-comisiones", label: "Comisiones", icon: BadgePercent },
    ],
  },
];

export default function EcoFlowTerminal() {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState({ bcra: false, mercado: false, analizadores: false, calculadoras: false });
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const baTime = now.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
  });
  const baDate = now
    .toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toUpperCase()
    .replace(/\./g, "");

  // Horario BYMA: Lun–Vie, 11:00–17:00 ART
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const marketOpen = !["Sat", "Sun"].includes(wd) && hh >= 11 && hh < 17;

  const sidebarWidth = collapsed ? 64 : 220;

  const toggleGroup = (id) => {
    if (collapsed) {
      setCollapsed(false);
      setOpen((prev) => ({ ...prev, [id]: true }));
    } else {
      setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  return (
    <div
      style={{
        fontFamily: "'Roboto', system-ui, sans-serif",
        backgroundColor: C.bg,
        color: C.text,
        height: "100vh",
        minHeight: 600,
      }}
      className="w-full flex flex-col overflow-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700;800&family=Roboto:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        html, body { background: ${C.bg}; }

        input::placeholder { color: ${C.dim}; letter-spacing: 0.01em; }
        input:focus { outline: none; }

        .eco-scroll::-webkit-scrollbar { width: 4px; }
        .eco-scroll::-webkit-scrollbar-track { background: transparent; }
        .eco-scroll::-webkit-scrollbar-thumb { background: rgba(241,245,249,0.08); }
        .eco-scroll::-webkit-scrollbar-thumb:hover { background: rgba(241,245,249,0.18); }

        .eco-grid {
          background-image:
            linear-gradient(rgba(241,245,249,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(241,245,249,0.022) 1px, transparent 1px);
          background-size: 36px 36px;
          background-position: -1px -1px;
        }

        .eco-mono { font-family: 'JetBrains Mono', 'Roboto Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .eco-display { font-family: 'Raleway', sans-serif; }

        @keyframes ecoPulseRed {
          0%, 100% { box-shadow: 0 0 0 0 rgba(224, 72, 72, 0.55); }
          50% { box-shadow: 0 0 0 5px rgba(224, 72, 72, 0); }
        }
        @keyframes ecoPulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(55, 200, 113, 0.55); }
          50% { box-shadow: 0 0 0 5px rgba(55, 200, 113, 0); }
        }
        .eco-dot-red { animation: ecoPulseRed 2.4s ease-out infinite; }
        .eco-dot-green { animation: ecoPulseGreen 2.4s ease-out infinite; }

        .eco-tooltip {
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: ${C.deep};
          border: 1px solid ${C.borderStrong};
          color: ${C.text};
          font-size: 10px;
          letter-spacing: 0.12em;
          padding: 5px 9px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 60;
          text-transform: uppercase;
          font-weight: 500;
        }
        .eco-tooltip-host:hover .eco-tooltip { opacity: 1; }

        .eco-nav-row { transition: background-color 0.15s ease, color 0.15s ease; }
        .eco-nav-row:hover { background-color: rgba(241,245,249,0.04); }

        .eco-search { transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease; }
        .eco-search:focus-within {
          border-color: ${C.accentBorder};
          background-color: ${C.bg};
          box-shadow: 0 0 0 3px ${C.accentSoft};
        }

        .eco-fade-in { animation: ecoFade 0.35s ease both; }
        @keyframes ecoFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .eco-icon-btn {
          width: 50px; height: 60px;
          display: flex; align-items: center; justify-content: center;
          color: ${C.muted}; background: transparent; border: none; cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease;
        }
        .eco-icon-btn:hover { color: ${C.text}; background-color: rgba(241,245,249,0.03); }

        .eco-toggle-btn {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          color: ${C.muted}; background: transparent; border: none; cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease;
        }
        .eco-toggle-btn:hover { color: ${C.text}; background-color: rgba(241,245,249,0.04); }

        .eco-brand-btn { transition: opacity 0.15s ease; }
        .eco-brand-btn:hover { opacity: 0.78; }
        .eco-brand-btn:active { opacity: 0.6; }
        .eco-brand-btn:focus-visible { outline: 1px solid ${C.accentBorder}; outline-offset: 4px; }

        @keyframes ecoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .eco-spin { animation: ecoSpin 0.9s linear infinite; }

        @keyframes ecoSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes ecoSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes ecoBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ecoBackdropOut { from { opacity: 1; } to { opacity: 0; } }

        .eco-refresh-btn { transition: background-color 0.15s ease, border-color 0.15s ease; }
        .eco-refresh-btn:hover:not(:disabled) {
          background-color: rgba(56, 189, 248, 0.18);
          border-color: rgba(56, 189, 248, 0.45);
        }

        .eco-table-row:hover { background-color: rgba(246, 247, 246, 0.025); }

        .eco-th-sortable:hover { color: ${C.text} !important; }
      `}</style>

      {/* ─────────── NAVBAR ─────────── */}
      <header
        style={{
          backgroundColor: C.bg,
          borderBottom: `1px solid ${C.border}`,
          height: 60,
        }}
        className="flex items-stretch flex-shrink-0"
      >
        {/* Logo block */}
        <div
          style={{
            width: sidebarWidth,
            borderRight: `1px solid ${C.border}`,
            transition: "width 0.25s ease",
          }}
          className="flex items-center px-5 flex-shrink-0 overflow-hidden"
        >
          {!collapsed ? (
            <button
              onClick={() => window.location.reload()}
              aria-label="Ir al Dashboard"
              className="eco-brand-btn"
              style={{
                display: "flex",
                alignItems: "baseline",
                fontFamily: "'Raleway', sans-serif",
                fontSize: 20,
                letterSpacing: "-0.015em",
                lineHeight: 1,
                color: C.accent,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 700 }}>eco</span>
              <span style={{ fontWeight: 400 }}>flow</span>
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              aria-label="Ir al Dashboard"
              className="eco-brand-btn mx-auto"
              style={{
                display: "flex",
                alignItems: "baseline",
                fontFamily: "'Raleway', sans-serif",
                fontSize: 18,
                letterSpacing: "-0.015em",
                lineHeight: 1,
                color: C.accent,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 700 }}>e</span>
              <span style={{ fontWeight: 400 }}>f</span>
            </button>
          )}
        </div>

        {/* Buscador */}
        <div className="flex-1 flex items-center justify-center px-6 min-w-0">
          <div
            className="eco-search flex items-center gap-3 w-full"
            style={{
              maxWidth: 520,
              border: `1px solid ${C.border}`,
              backgroundColor: C.deep,
              padding: "8px 14px",
            }}
          >
            <Search size={14} color={C.muted} strokeWidth={1.8} />
            <input
              type="text"
              placeholder="Buscar por título…"
              style={{
                background: "transparent",
                border: "none",
                color: C.text,
                fontSize: 13,
                letterSpacing: "0.01em",
                width: "100%",
                fontWeight: 400,
                fontFamily: "'Roboto', sans-serif",
              }}
            />
            <span
              className="eco-mono"
              style={{
                fontSize: 10,
                color: C.dim,
                letterSpacing: "0.08em",
                border: `1px solid ${C.border}`,
                padding: "1px 5px",
              }}
            >
              ⌘K
            </span>
          </div>
        </div>

        {/* Sección derecha */}
        <div className="flex items-stretch flex-shrink-0">
          {/* Estado mercado */}
          <div
            className="flex items-center gap-2.5 px-5"
            style={{ borderLeft: `1px solid ${C.border}` }}
          >
            <span
              className={marketOpen ? "eco-dot-green" : "eco-dot-red"}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: marketOpen ? C.green : C.red,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <div className="flex flex-col leading-tight">
              <span
                style={{
                  fontSize: 9,
                  color: C.muted,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Estado
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: C.text,
                  letterSpacing: "0.02em",
                  fontWeight: 500,
                  marginTop: 1,
                }}
              >
                {marketOpen ? "Mercado Abierto" : "Mercado Cerrado"}
              </span>
            </div>
          </div>

          {/* Reloj */}
          <div
            className="flex flex-col items-end justify-center px-5"
            style={{ borderLeft: `1px solid ${C.border}`, minWidth: 130 }}
          >
            <span
              className="eco-mono"
              style={{
                fontSize: 14,
                color: C.text,
                letterSpacing: "0.05em",
                fontWeight: 500,
                lineHeight: 1.1,
              }}
            >
              {baTime}
            </span>
            <span
              style={{
                fontSize: 9,
                color: C.dim,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              {baDate} · ART
            </span>
          </div>

          {/* Botones de íconos + perfil */}
          <div className="flex items-stretch" style={{ borderLeft: `1px solid ${C.border}` }}>
            <button className="eco-icon-btn" aria-label="Notificaciones">
              <Bell size={15} strokeWidth={1.6} />
            </button>
            <button className="eco-icon-btn" aria-label="Configuración">
              <Settings size={15} strokeWidth={1.6} />
            </button>
            <div
              className="px-4 flex items-center"
              style={{ borderLeft: `1px solid ${C.border}` }}
            >
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* ─────────── ÁREA PRINCIPAL ─────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          style={{
            width: sidebarWidth,
            backgroundColor: C.panel,
            borderRight: `1px solid ${C.border}`,
            transition: "width 0.25s ease",
          }}
          className="flex flex-col flex-shrink-0"
        >
          {/* Header del sidebar */}
          <div
            className="flex items-center px-3 flex-shrink-0"
            style={{
              borderBottom: `1px solid ${C.border}`,
              justifyContent: collapsed ? "center" : "space-between",
              height: 42,
            }}
          >
            {!collapsed && (
              <span
                style={{
                  fontSize: 9,
                  color: C.dim,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  paddingLeft: 4,
                }}
              >
                Terminal V1.0
              </span>
            )}
            <button
              className="eco-toggle-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expandir" : "Colapsar"}
            >
              {collapsed ? (
                <ChevronRight size={15} strokeWidth={1.6} />
              ) : (
                <ChevronLeft size={15} strokeWidth={1.6} />
              )}
            </button>
          </div>

          {/* Lista de navegación */}
          <nav className="flex-1 overflow-y-auto eco-scroll py-2">
            {NAV.map((item) => (
              <NavBlock
                key={item.id}
                item={item}
                collapsed={collapsed}
                isOpen={open[item.id]}
                onToggle={() => toggleGroup(item.id)}
                active={active}
                setActive={setActive}
              />
            ))}
          </nav>

          {/* Footer */}
          <div
            className="flex-shrink-0 px-3 py-2.5 flex items-center"
            style={{
              borderTop: `1px solid ${C.border}`,
              justifyContent: collapsed ? "center" : "flex-end",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: C.green,
                boxShadow: `0 0 6px ${C.green}`,
                display: "inline-block",
              }}
            />
          </div>
        </aside>

        {/* WORKSPACE */}
        <main
          className="flex-1 relative overflow-hidden eco-grid"
          style={{ backgroundColor: C.bg }}
        >
          {/* Marcas geométricas en esquinas (terminal feel) */}
          <CornerMark position="top-left" />
          <CornerMark position="top-right" />

          {/* Router del workspace según item activo */}
          <div className="absolute inset-0 overflow-auto eco-scroll" style={{ paddingBottom: 26 }}>
            {active === "compara-dolar" ? (
              <ComparaDolarModule />
            ) : active === "carry-trade" ? (
              <CarryTradeModule />
            ) : active === "futuros-caucion" ? (
              <FuturosVsCaucionModule />
            ) : active === "portfolio-ia" ? (
              <PortfolioIAModule />
            ) : (
              <EmptyWorkspace key={active} active={active} />
            )}
          </div>

          {/* Status bar inferior */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5"
            style={{
              borderTop: `1px solid ${C.border}`,
              backgroundColor: C.bg,
              height: 26,
              fontSize: 10,
              color: C.dim,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            <div className="flex items-center gap-4">
              <span
                style={{
                  color: C.muted,
                  fontFamily: "'Raleway', sans-serif",
                  letterSpacing: "-0.005em",
                  textTransform: "lowercase",
                  fontWeight: 500,
                  fontSize: 11,
                }}
              >
                <span style={{ fontWeight: 700 }}>eco</span>
                <span style={{ fontWeight: 400 }}>flow</span>
                <span style={{ marginLeft: 6, fontWeight: 400 }}>terminal</span>
              </span>
              <span style={{ color: C.faint }}>│</span>
              <span>
                {(flattenNav(NAV).find((i) => i.id === active)?.label) || active.replace(/-/g, " ")}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Buenos Aires · ART</span>
              <span style={{ color: C.faint }}>│</span>
              <span
                className="eco-mono"
                style={{
                  letterSpacing: "0.06em",
                  color: marketOpen ? C.green : C.red,
                }}
              >
                ● {marketOpen ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

function Stat({ label, value, mono }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        style={{
          fontSize: 8,
          color: C.dim,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "eco-mono" : ""}
        style={{
          fontSize: 12,
          color: C.text,
          letterSpacing: mono ? "0.04em" : "0.02em",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 24, background: C.border }} />;
}

function CornerMark({ position }) {
  const size = 12;
  const styles = {
    "top-left": { top: 12, left: 12, borderTop: `1px solid ${C.borderStrong}`, borderLeft: `1px solid ${C.borderStrong}` },
    "top-right": { top: 12, right: 12, borderTop: `1px solid ${C.borderStrong}`, borderRight: `1px solid ${C.borderStrong}` },
  };
  return (
    <span
      className="absolute"
      style={{ width: size, height: size, ...styles[position], pointerEvents: "none" }}
    />
  );
}

function NavBlock({ item, collapsed, isOpen, onToggle, active, setActive }) {
  const Icon = item.icon;
  const isSingle = item.type === "single";
  const isActive = active === item.id;
  const childActive = !isSingle && item.children?.some((c) => c.id === active);
  const showActive = isActive || childActive;

  return (
    <div className="px-2">
      <div
        className="eco-nav-row eco-tooltip-host"
        onClick={() => {
          if (isSingle) setActive(item.id);
          else onToggle();
        }}
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: collapsed ? 0 : "0 10px",
          justifyContent: collapsed ? "center" : "space-between",
          cursor: "pointer",
          color: showActive ? C.text : C.muted,
          position: "relative",
          backgroundColor: isActive ? C.accentSoft : "transparent",
          marginBottom: 1,
        }}
      >
        {isActive && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 7,
              bottom: 7,
              width: 2,
              backgroundColor: C.accent,
              boxShadow: `0 0 8px ${C.accentGlow}`,
            }}
          />
        )}
        <div className="flex items-center gap-3">
          <Icon size={16} strokeWidth={1.6} />
          {!collapsed && (
            <span
              style={{
                fontSize: 13,
                fontWeight: showActive ? 500 : 400,
                letterSpacing: "0.015em",
              }}
            >
              {item.label}
            </span>
          )}
          {!collapsed && item.badge && (
            <span
              style={{
                fontSize: 8,
                color: C.cat.violet,
                backgroundColor: "rgba(167, 139, 250, 0.10)",
                border: `1px solid rgba(167, 139, 250, 0.30)`,
                padding: "1px 5px",
                letterSpacing: "0.10em",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
        {!collapsed && !isSingle && (
          <ChevronDown
            size={13}
            strokeWidth={1.7}
            style={{
              transition: "transform 0.2s ease",
              transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
              color: C.dim,
            }}
          />
        )}
        {collapsed && <span className="eco-tooltip">{item.label}</span>}
      </div>

      {!collapsed && !isSingle && isOpen && (
        <div
          className="eco-fade-in"
          style={{
            marginLeft: 10,
            paddingLeft: 14,
            borderLeft: `1px solid ${C.border}`,
            marginTop: 2,
            marginBottom: 6,
          }}
        >
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const isChildActive = active === child.id;
            return (
              <div
                key={child.id}
                onClick={() => setActive(child.id)}
                className="eco-nav-row"
                style={{
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 10px",
                  cursor: "pointer",
                  color: isChildActive ? C.text : C.muted,
                  backgroundColor: isChildActive ? C.accentSoft : "transparent",
                  position: "relative",
                  marginBottom: 1,
                }}
              >
                {isChildActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: -15,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: C.accent,
                    }}
                  />
                )}
                <ChildIcon size={13} strokeWidth={1.6} />
                <span
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.015em",
                    fontWeight: isChildActive ? 500 : 400,
                  }}
                >
                  {child.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────── Helpers globales ─────────── */

// Aplana NAV en una lista de items con label, ícono y parent
function flattenNav(nav) {
  const out = [];
  for (const item of nav) {
    out.push({ id: item.id, label: item.label, icon: item.icon, parent: null });
    if (item.children) {
      for (const c of item.children) {
        out.push({ id: c.id, label: c.label, icon: c.icon, parent: item.label });
      }
    }
  }
  return out;
}

// Smart polling: 60s en horario hábil (Lun–Vie 11:00–18:00 ART), 30 min fuera
function getRefreshIntervalMs() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const isWeekday = !["Sat", "Sun"].includes(wd);
  const isMarketHours = hh >= 11 && hh < 18;
  // Activo (lunes a viernes 11-18 ART): 15 min · Inactivo: 30 min
  return isWeekday && isMarketHours ? 15 * 60_000 : 30 * 60_000;
}

function isActiveMarketWindow() {
  return getRefreshIntervalMs() === 15 * 60_000;
}

// Formatters
const fmtARS = (n) =>
  n == null
    ? "—"
    : n.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const fmtPct = (n) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function timeAgo(date, now) {
  if (!date) return "—";
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}

/* ─────────── Empty Workspace (placeholder de módulos no construidos) ─────────── */

/* ─────────────── Portfolio IA Module ───────────────
 *
 * Módulo de gestión de cartera personalizada con detección de oportunidades.
 *
 * Estados:
 *   1. Sin sesión → muestra <PortfolioAuthWall> con CTA grande de login Google
 *   2. Loading    → spinner (mientras Supabase resuelve la sesión inicial)
 *   3. Logueado   → dashboard real (V1: placeholder, V2: dashboard + tabla)
 *
 * El componente NO espera props — toma todo lo que necesita del AuthContext.
 *
 * Roadmap:
 *   ✓ V1 — Auth wall + scaffolding del módulo
 *   · V2 — CRUD de posiciones (modal de carga + tabla con filtros)
 *   · V3 — Dashboard inteligente (header con totales, distribución, liquidez)
 *   · V4 — Sistema de alertas de oportunidades cruzando cartera + datos mercado
 */
function PortfolioIAModule() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 size={28} color={C.muted} className="eco-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (!user) {
    return <PortfolioAuthWall />;
  }

  return <PortfolioDashboard />;
}

/**
 * Pantalla de bienvenida que invita al login. Se renderiza cuando el usuario
 * intenta acceder al módulo Portfolio IA sin estar autenticado.
 *
 * Diseño:
 *   - Card centrado verticalmente
 *   - Ícono grande de Briefcase + Sparkles para connotar "AI"
 *   - Headline corto y descriptivo
 *   - CTA prominente con el icono de Google y branding correcto
 *   - Microcopy de privacidad/seguridad debajo
 */
function PortfolioAuthWall() {
  const { signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setSigningIn(false);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <div
        className="eco-fade-in"
        style={{
          maxWidth: 520,
          width: "100%",
          backgroundColor: C.panel,
          border: `1px solid ${C.border}`,
          padding: "44px 40px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Acento de marca arriba */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: C.accent,
            boxShadow: `0 0 8px ${C.accentGlow}`,
          }}
        />

        {/* Ícono central con halo */}
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            backgroundColor: C.accentSoft,
            border: `1px solid ${C.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Briefcase size={26} color={C.accent} strokeWidth={1.6} />
          {/* Sparkle pequeño en esquina superior derecha */}
          <div
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              backgroundColor: C.bg,
              padding: 2,
            }}
          >
            <Sparkles size={12} color={C.cat.violet} strokeWidth={1.8} />
          </div>
        </div>

        {/* Eyebrow + título */}
        <div
          style={{
            fontSize: 9,
            color: C.dim,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Portfolio IA · Beta
        </div>
        <h2
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: C.text,
            letterSpacing: "-0.015em",
            margin: 0,
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Tu cartera, en un solo lugar
        </h2>

        {/* Subhead descriptivo */}
        <p
          style={{
            fontSize: 13,
            color: C.muted,
            lineHeight: 1.6,
            margin: "0 auto 28px",
            maxWidth: 380,
          }}
        >
          Cargá tus bonos, futuros, cauciones y acciones. Visualizá tu exposición
          en pesos y dólares y recibí alertas de oportunidades automáticamente.
        </p>

        {/* CTA — botón de Google grande */}
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="flex items-center justify-center gap-3"
          style={{
            width: "100%",
            maxWidth: 320,
            margin: "0 auto",
            backgroundColor: C.text,
            color: C.bg,
            border: "none",
            padding: "12px 20px",
            cursor: signingIn ? "not-allowed" : "pointer",
            opacity: signingIn ? 0.7 : 1,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'Roboto', sans-serif",
            letterSpacing: "0.01em",
            transition: "transform 120ms ease, box-shadow 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (!signingIn) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = `0 4px 12px ${C.accentGlow}`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {/* Logo de Google (SVG inline para no depender de assets externos) */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {signingIn ? "Conectando..." : "Continuar con Google"}
        </button>

        {/* Microcopy de privacidad */}
        <div
          className="flex items-center justify-center gap-2"
          style={{ marginTop: 20, fontSize: 11, color: C.dim }}
        >
          <ShieldCheck size={12} strokeWidth={1.6} />
          <span>Solo necesitás una cuenta de Gmail. Tu información es privada.</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  PORTFOLIO IA · Sub-paso 2 — CRUD de posiciones
 *
 *  Catálogo de tipos de instrumento que soporta el módulo. Cada entrada
 *  define cómo se renderiza en la UI y qué campos pide el formulario.
 *
 *  La idea es que sumar un tipo nuevo en el futuro sea modificar SOLO
 *  esta constante, no esparcir lógica en mil ifs por toda la UI.
 * ─────────────────────────────────────────────────────────────────── */
const INSTRUMENT_TYPES = {
  // Tipo "bond" UNIFICADO (visible en el dropdown). Al guardar, se mapea
  // a bond_ars o bond_usd según la moneda elegida. Las posiciones legacy
  // siguen funcionando porque bond_ars y bond_usd existen abajo.
  bond: {
    label: "Bono",
    description: "Lecaps, Boncaps, Bonares, AL30, GD30 (en ARS o USD)",
    icon: Receipt,
    color: "emerald",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 35.945.426",
    priceLabel: "Precio",
    priceHint: "Ej. 1394,50 (ARS) o 72,50 (USD)",
    defaultCurrency: "ARS",
  },
  bond_ars: {
    label: "Bono ARS",
    description: "Lecaps, Boncaps, Bonares en pesos",
    icon: Receipt,
    color: "emerald",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 35.945.426",
    priceLabel: "Precio",
    priceHint: "Ej. 1394,50",
    defaultCurrency: "ARS",
  },
  bond_usd: {
    label: "Bono USD",
    description: "AL30, GD30, Bonares hardollar",
    icon: Landmark,
    color: "cyan",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 100.000",
    priceLabel: "Precio",
    priceHint: "Ej. 72,50 USD",
    defaultCurrency: "USD",
  },
  on: {
    label: "Obligación Negociable",
    description: "ONs corporativas",
    icon: Building2,
    color: "indigo",
    quantityLabel: "Cantidad",
    priceLabel: "Precio",
    defaultCurrency: "USD",
  },
  stock: {
    label: "Acción",
    description: "Acciones argentinas (GGAL, YPF, ALUA…)",
    icon: LineChart,
    color: "yellow",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 500",
    priceLabel: "Precio",
    defaultCurrency: "ARS",
  },
  cedear: {
    label: "CEDEAR",
    description: "Acciones del exterior con ratio (AAPL, MSFT, NVDA…)",
    icon: Globe,
    color: "violet",
    quantityLabel: "Cantidad",
    priceLabel: "Precio",
    defaultCurrency: "ARS",
  },
  future: {
    label: "Futuro",
    description: "DLR, RFX20, oro y otros futuros Matba-Rofex",
    icon: TrendingUp,
    color: "pink",
    quantityLabel: "Cantidad",
    quantityHint: "Entero. Ej. 100 (DLR = 1.000 USD por contrato)",
    priceLabel: "Precio",
    priceHint: "Ej. 1456,50",
    defaultCurrency: "ARS",
    integerQuantity: true,  // futuros son contratos enteros
  },
  option: {
    label: "Opción",
    description: "Calls / Puts sobre acciones, índices, futuros",
    icon: Spline,
    color: "rose",
    quantityLabel: "Cantidad",
    priceLabel: "Precio",
    defaultCurrency: "ARS",
    integerQuantity: true,
    extraFields: ["strike", "expiry", "option_type"],
  },
  caucion: {
    label: "Caución",
    description: "Colocada o tomada en pesos / USD",
    icon: ArrowRightLeft,
    color: "teal",
    quantityLabel: "Cantidad",
    quantityHint: "Monto colocado o tomado",
    priceLabel: null,  // las cauciones no tienen "precio"
    defaultCurrency: "ARS",
    extraFields: ["rate_tna", "term_days"],
  },
  fci: {
    label: "FCI",
    description: "Fondos Comunes de Inversión",
    icon: Coins,
    color: "amber",
    quantityLabel: "Cantidad",
    priceLabel: "Precio",
    defaultCurrency: "ARS",
  },
  usd: {
    label: "USD",
    description: "Dólares físicos, MEP, CCL, Blue",
    icon: DollarSign,
    color: "lime",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 10.000",
    priceLabel: "Precio",
    priceHint: "Ej. 1450 (precio del dólar al comprarlo)",
    defaultCurrency: "USD",
  },
  crypto: {
    label: "Cripto",
    description: "BTC, ETH, USDT, USDC y otras",
    icon: Bitcoin,
    color: "orange",
    quantityLabel: "Cantidad",
    quantityHint: "Ej. 0,15 BTC o 5.000 USDT",
    priceLabel: "Precio",
    defaultCurrency: "USD",
  },
};

/**
 * Lista ordenada para los SELECTS (lo que ve el usuario en el dropdown).
 *
 * "bond" es el item unificado (en lugar de "bond_ars" + "bond_usd"):
 * el usuario elige "Bono" y la moneda determina si se persiste como
 * bond_ars o bond_usd. Las claves bond_ars y bond_usd siguen en el
 * catálogo de arriba para que las posiciones existentes editen sin
 * romperse.
 *
 * "usd" y "crypto" quedan ocultos por ahora. Para el saldo en cuenta
 * (ARS / USD / USD-CCL) se evaluará un tipo "cash" dedicado más adelante.
 */
const INSTRUMENT_TYPE_KEYS = [
  "bond", "on", "stock", "cedear",
  "future", "option", "caucion", "fci",
];

/* ─────────────── Catálogos de tickers por tipo ───────────────
 *
 * Para evitar que el usuario tipee tickers con errores (T03J6 en lugar
 * de T30J6), cuando hay una lista controlada renderizamos un Select
 * en vez de un Input.
 *
 * Cobertura:
 *   - bond:   BOND_REGISTRY (lecaps, boncaps, duales en pesos) +
 *             BONDS_USD_POPULAR (Bonares y Globales hard-dollar)
 *   - future: DLR_REGISTRY (todos los DLR Matba-Rofex)
 *   - resto:  input libre por ahora. Para acciones/CEDEARs/ONs/FCI
 *             el universo es grande (~500+ instrumentos) y necesitaríamos
 *             una API o un dataset estático, queda como tech-debt.
 *
 * Si una posición editada tiene un ticker que NO está en la lista
 * controlada (porque venía de un input libre previo o está fuera del
 * registry), el helper lo agrega como opción "(custom)" al final del
 * Select para que la edición no rompa.
 */

/** Bonos hard-dollar más populares de Argentina (no están en BOND_REGISTRY) */
const BONDS_USD_POPULAR = [
  { ticker: "AL29", description: "Bonar 2029" },
  { ticker: "AL30", description: "Bonar 2030" },
  { ticker: "AL35", description: "Bonar 2035" },
  { ticker: "AE38", description: "Bonar 2038" },
  { ticker: "AL41", description: "Bonar 2041" },
  { ticker: "GD29", description: "Global 2029" },
  { ticker: "GD30", description: "Global 2030" },
  { ticker: "GD35", description: "Global 2035" },
  { ticker: "GD38", description: "Global 2038" },
  { ticker: "GD41", description: "Global 2041" },
  { ticker: "GD46", description: "Global 2046" },
];

const MONTH_ES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function fmtMaturityShort(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}/${MONTH_ES_SHORT[m - 1]}/${String(y).slice(-2)}`;
}

/**
 * Devuelve las opciones de ticker para un tipo de instrumento.
 *
 * @param {string} instrumentType - clave de INSTRUMENT_TYPES (puede ser "bond",
 *   "bond_ars", "bond_usd", "future", etc).
 * @param {string} [currentTicker] - si la posición ya tiene un ticker que no
 *   está en la lista controlada, lo agregamos como opción "(custom)" para no
 *   romper edición.
 * @param {object} [catalog] - catálogo dinámico desde Supabase (ver
 *   useInstrumentCatalog). Forma: { stock: [...], cedear: [...], bond_usd: [...], on: [...] }.
 *   Si no se provee o está vacío, se cae al hardcoded para bonos USD y se
 *   devuelve mode="input" (libre) para stock/cedear/on.
 * @returns {{ mode: 'select' | 'input', options: Array<{value, label}> }}
 */
function getTickerOptions(instrumentType, currentTicker, catalog) {
  // Bonos: combino el registry de pesos hardcoded (filtrando duales según
  // shouldIgnoreTicker) con bonos USD del catálogo dinámico (o el hardcoded
  // popular como fallback).
  if (instrumentType === "bond" || instrumentType === "bond_ars" || instrumentType === "bond_usd") {
    const arsBonds = Object.entries(BOND_REGISTRY)
      .filter(([t]) => !shouldIgnoreTicker(t))
      .map(([t, info]) => ({
        ticker: t,
        sortKey: info.maturityDate || "9999-12-31",
        label: `${t} — ${info.type.toUpperCase()} · vto ${fmtMaturityShort(info.maturityDate)}`,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const dynamicUsdBonds = catalog?.bond_usd?.length ? catalog.bond_usd : null;
    const usdBonds = dynamicUsdBonds
      ? dynamicUsdBonds.map((b) => {
          // El endpoint enriquece description con sufijo legible:
          //   AL30  → "Bonar 2030"
          //   AL30D → "Bonar 2030 · MEP"
          //   AL30C → "Bonar 2030 · CCL"
          // Y metadata.maturityDate hereda del ticker base.
          const maturity = b.metadata?.maturityDate;
          const plaza = b.metadata?.plaza || "ars";
          const desc = b.description;
          let label;
          if (desc && maturity) {
            label = `${b.ticker} — ${desc} · vto ${fmtMaturityShort(maturity)}`;
          } else if (desc) {
            label = `${b.ticker} — ${desc}`;
          } else {
            label = b.ticker;
          }
          // Sort: agrupamos las 3 variantes (puro/D/C) consecutivas por
          // ticker base. Para eso tomamos el ticker sin último char si es
          // C o D, y agregamos un sub-orden ARS=0, MEP=1, CCL=2.
          const plazaOrder = plaza === "ars" ? "0" : plaza === "mep" ? "1" : "2";
          const sortKey = maturity
            ? `${maturity}_${plazaOrder}`
            : `Z_${b.ticker}`;
          return { ticker: b.ticker, sortKey, label };
        })
      : BONDS_USD_POPULAR.map((b) => ({
          ticker: b.ticker,
          sortKey: `Z_${b.ticker}`,
          label: `${b.ticker} — ${b.description}`,
        }));

    const all = [...arsBonds, ...usdBonds].sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
    return ensureCurrentInOptions(all, currentTicker, "select");
  }

  // Futuros: hardcoded en DLR_REGISTRY (data912 no los provee).
  if (instrumentType === "future") {
    const opts = DLR_REGISTRY.map((c) => ({
      ticker: c.ticker,
      sortKey: c.maturityDate,
      label: `${c.displayTicker} — vto ${fmtMaturityShort(c.maturityDate)}`,
    })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return ensureCurrentInOptions(opts, currentTicker, "select");
  }

  // Stock / CEDEAR / ON: usar catálogo dinámico si está poblado, sino input libre.
  if (instrumentType === "stock" || instrumentType === "cedear" || instrumentType === "on") {
    const list = catalog?.[instrumentType];
    if (list && list.length > 0) {
      const opts = list
        .map((row) => ({
          ticker: row.ticker,
          sortKey: row.ticker,
          label: row.description ? `${row.ticker} — ${row.description}` : row.ticker,
        }))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      return ensureCurrentInOptions(opts, currentTicker, "select");
    }
    // Catálogo vacío todavía (cargando o BD sin datos): input libre.
    return { mode: "input", options: [] };
  }

  // Resto (caucion, option, fci): input libre por ahora.
  return { mode: "input", options: [] };
}

/**
 * Si el ticker actual no está en la lista, lo agregamos al final
 * como opción "(custom)" para que editar una posición vieja no falle.
 */
function ensureCurrentInOptions(opts, currentTicker, mode) {
  const formatted = opts.map((o) => ({ value: o.ticker, label: o.label }));
  if (
    currentTicker &&
    currentTicker.trim() &&
    !formatted.some((o) => o.value === currentTicker)
  ) {
    formatted.push({
      value: currentTicker,
      label: `${currentTicker} — (cargado manualmente)`,
    });
  }
  return { mode, options: formatted };
}

/* ─────────────── Resolución de moneda desde ticker + tipo ───────────────
 *
 * Dado un instrument_type y un ticker, devuelve la moneda SUGERIDA en la
 * que se opera y si esa sugerencia es fuerte (suggested=true) o si el
 * tipo no permite inferir nada (suggested=false).
 *
 * IMPORTANTE: el campo de moneda en el form es SIEMPRE editable. La
 * sugerencia solo se usa para preseleccionar el valor al elegir ticker.
 * El usuario puede cambiarla después si su broker convierte internamente
 * (ej. comprar AL30 contra USD-MEP en algunos brokers).
 *
 * Reglas según mercado argentino (BYMA / Matba-Rofex):
 *   - Bonos ARS (lecaps, boncaps, etc.)        → ARS
 *   - Bono USD puro (AL30, GD30, etc.)         → ARS
 *   - Bono USD sufijo D (AL30D, GD30D, etc.)   → USD-MEP
 *   - Bono USD sufijo C (AL30C, GD30C, etc.)   → USD-CCL
 *   - Acciones / CEDEARs / ONs                  → ARS
 *   - Futuros DLR                               → ARS
 *   - Cauciones / Opciones / FCI                → sin sugerencia
 *
 * @returns {{ currency: string|null, suggested: boolean }}
 */
function resolveCurrencyFromTicker(instrumentType, ticker) {
  // Tipos donde no podemos inferir moneda — el user elige libre, sin hint
  if (
    instrumentType === "caucion" ||
    instrumentType === "option" ||
    instrumentType === "fci"
  ) {
    return { currency: null, suggested: false };
  }

  // Tipos siempre en ARS (sin importar el ticker)
  if (
    instrumentType === "bond_ars" ||
    instrumentType === "stock" ||
    instrumentType === "cedear" ||
    instrumentType === "on" ||
    instrumentType === "future"
  ) {
    return { currency: "ARS", suggested: true };
  }

  // Bonos USD (instrument_type === "bond_usd" o "bond" virtual con ticker USD):
  // el sufijo del ticker determina la moneda sugerida.
  if (instrumentType === "bond_usd" || instrumentType === "bond") {
    if (!ticker) {
      // Bono virtual sin ticker todavía: por default sugerimos ARS
      // (operación en el bono puro sin sufijo). Cuando el user elija
      // ticker con sufijo, se reasigna.
      return { currency: "ARS", suggested: true };
    }

    // Si el ticker pertenece a BOND_REGISTRY (lecaps, boncaps, etc.),
    // es un bono ARS aunque el instrument_type del form diga "bond".
    if (BOND_REGISTRY[ticker]) {
      return { currency: "ARS", suggested: true };
    }

    // Sufijos de plaza
    const lastChar = ticker.charAt(ticker.length - 1);
    if (lastChar === "C") return { currency: "USD-CCL", suggested: true };
    if (lastChar === "D") return { currency: "USD-MEP", suggested: true };

    // Bono USD puro (AL30, GD30, etc.) → ARS
    return { currency: "ARS", suggested: true };
  }

  // Tipo desconocido — fallback editable sin sugerencia
  return { currency: null, suggested: false };
}

/**
 * Normaliza monedas legacy (USD genérico, USD-Blue) a USD-MEP para que
 * posiciones cargadas con el modelo viejo se editen sin error.
 */
function normalizeLegacyCurrency(currency) {
  if (currency === "USD" || currency === "USD-Blue") return "USD-MEP";
  return currency || "ARS";
}

/**
 * Monedas soportadas para entry_currency.
 *
 * El modelo refleja la cuenta comitente real en Argentina:
 *   - ARS:     pesos
 *   - USD-MEP: dólares vía bonos sufijo D (AL30D, GD30D, etc.)
 *   - USD-CCL: dólares vía bonos sufijo C (AL30C, GD30C, etc.)
 *
 * NO existe "USD oficial" o "USD Blue" como moneda válida en cuenta
 * comitente: si el user deposita USD físicos, al operarlos el broker
 * los considera USD-MEP. Para pasar a CCL hay que hacer canje (comprar
 * AL30D y vender AL30C, o viceversa).
 *
 * Posiciones legacy con USD / USD-Blue se normalizan al cargarlas
 * (ver AddPositionDrawer) para no romper edición.
 */
const CURRENCIES = [
  { code: "ARS",     label: "Pesos (ARS)" },
  { code: "USD-MEP", label: "Dólar MEP" },
  { code: "USD-CCL", label: "Dólar CCL" },
];


/* ─────────────── Hook: useInstrumentCatalog ───────────────
 *
 * Lee el catálogo de tickers desde la tabla `public.instruments` de Supabase
 * (poblada por /api/refresh-instruments una vez al día con datos de data912).
 *
 * Caching:
 *   - Cache en memoria a nivel módulo (sobrevive entre re-mounts del drawer
 *     pero no entre recargas de página).
 *   - Cache en sessionStorage (sobrevive recargas suaves dentro de la sesión).
 *   - Stale-while-revalidate: si tenemos cache lo mostramos inmediato y
 *     refrescamos en background.
 *
 * Lazy refresh on-demand:
 *   - Después de leer el catálogo, dispara fire-and-forget POST a
 *     /api/refresh-instruments. El endpoint ignora el llamado si el último
 *     refresh fue hace < 12hs, así que esto es seguro de hacer en cada apertura.
 *
 * Si la query falla (BD caída, sin internet), devolvemos catalog vacío y los
 * tipos sin lista degradan automáticamente a input libre.
 */

const INSTRUMENT_CATALOG_TYPES = ["stock", "cedear", "bond_usd", "on"];
const INSTRUMENT_CATALOG_CACHE_KEY = "ecoflow_instrument_catalog_v1";

// Cache a nivel módulo (sobrevive re-mounts del componente)
let _moduleCatalogCache = null;

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(INSTRUMENT_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(catalog) {
  try {
    sessionStorage.setItem(INSTRUMENT_CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    /* sessionStorage puede no estar disponible en private mode */
  }
}

function useInstrumentCatalog() {
  // Inicializamos con cache (módulo > sessionStorage > vacío) para evitar
  // el flash de "input libre" mientras carga.
  const initial =
    _moduleCatalogCache ||
    readSessionCache() ||
    { stock: [], cedear: [], bond_usd: [], on: [] };

  const [catalog, setCatalog] = useState(initial);
  const [loading, setLoading] = useState(_moduleCatalogCache == null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: rows, error: err } = await supabase
          .from("instruments")
          .select("ticker, instrument_type, description, metadata")
          .in("instrument_type", INSTRUMENT_CATALOG_TYPES)
          .order("ticker", { ascending: true });

        if (err) throw err;
        if (!mounted) return;

        const grouped = { stock: [], cedear: [], bond_usd: [], on: [] };
        for (const row of rows || []) {
          if (grouped[row.instrument_type]) {
            grouped[row.instrument_type].push(row);
          }
        }

        _moduleCatalogCache = grouped;
        writeSessionCache(grouped);
        setCatalog(grouped);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "No se pudo cargar el catálogo");
        setLoading(false);
        // Si falla pero tenemos cache, lo dejamos visible. El usuario no
        // pierde funcionalidad.
      }
    })();

    // Lazy refresh on-demand: fire-and-forget al endpoint, que internamente
    // decide si correr o no según el threshold de 12hs.
    fetch("/api/refresh-instruments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      /* silencioso: si falla no afecta al user */
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { catalog, loading, error };
}


/* ─────────────── Hook: useDashboardFx ───────────────
 *
 * Lee las cotizaciones FX desde /api/dolares (que ya proxea dolarapi.com).
 * El dashboard del Portfolio necesita 4 valores: Mayorista, MEP, CCL, Blue.
 *
 * Cache:
 *   - sessionStorage: si ya hay datos, los muestra inmediato y refresca atrás.
 *   - Stale-while-revalidate: el user no ve un loader si tenemos cache previo.
 *
 * Estructura del retorno:
 *   {
 *     fx: { mayorista, mep, ccl, blue }  // cada uno: { buy, sell, mid, change }
 *     loading,
 *     error,
 *     lastUpdated,
 *     refresh: () => void,
 *   }
 *
 * El campo `change` es la variación porcentual del valor mid respecto al
 * cierre anterior. Como dolarapi no expone histórico, lo calculamos como
 * diff entre el `sell` y el `compra` que aporte el endpoint cuando estén
 * disponibles. Si no, queda en null y la UI muestra "-".
 */

const DASHBOARD_FX_KEYS = ["mayorista", "bolsa", "contadoconliqui", "blue"];
const FX_LABEL_MAP = {
  mayorista: "Mayorista",
  bolsa: "MEP",
  contadoconliqui: "CCL",
  blue: "Blue",
};
const FX_INTERNAL_MAP = {
  mayorista: "mayorista",
  bolsa: "mep",
  contadoconliqui: "ccl",
  blue: "blue",
};

const FX_CACHE_KEY = "ecoflow_dashboard_fx_v1";

function readFxCache() {
  try {
    const raw = sessionStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeFxCache(payload) {
  try {
    sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage puede fallar en private mode */
  }
}

function useDashboardFx() {
  const cached = readFxCache();
  const [fx, setFx] = useState(cached?.fx || null);
  const [lastUpdated, setLastUpdated] = useState(cached?.lastUpdated || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setError(null);
    (async () => {
      try {
        const r = await fetch("/api/dolares");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const arr = await r.json();
        if (!Array.isArray(arr)) throw new Error("Respuesta inválida");

        const result = {};
        for (const apiKey of DASHBOARD_FX_KEYS) {
          const match = arr.find(
            (d) => (d.casa || "").toLowerCase() === apiKey.toLowerCase()
          );
          const internalKey = FX_INTERNAL_MAP[apiKey];
          if (!match) {
            result[internalKey] = null;
            continue;
          }
          const buy = Number(match.compra) || null;
          const sell = Number(match.venta) || null;
          const mid = buy && sell ? (buy + sell) / 2 : sell || buy;
          result[internalKey] = {
            label: FX_LABEL_MAP[apiKey],
            buy,
            sell,
            mid,
            // dolarapi no da histórico — dejamos placeholder por ahora
            change: null,
            updatedAt: match.fechaActualizacion
              ? new Date(match.fechaActualizacion)
              : null,
          };
        }

        if (!mounted) return;
        const now = new Date().toISOString();
        setFx(result);
        setLastUpdated(now);
        setLoading(false);
        writeFxCache({ fx: result, lastUpdated: now });
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Error cargando cotizaciones");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { fx, loading, error, lastUpdated, refresh };
}


/* ─────────────── Hook: useUserPositions ───────────────
 *
 * Encapsula toda la interacción con la tabla `public.positions` de Supabase.
 *
 * Provee:
 *   - positions:   array de filas (filtradas por user, ordenadas por fecha)
 *   - loading:     true durante el primer load
 *   - error:       mensaje de error si falla algo
 *   - addPosition: crea una posición nueva
 *   - updatePosition: edita una existente
 *   - deletePosition: borra una existente
 *   - refresh:     recarga el listado
 *
 * Consideraciones:
 *   - RLS de Supabase asegura que cada user solo ve lo suyo, pero
 *     igualmente filtramos por user_id en el cliente como segunda barrera.
 *   - El user_id se asigna automáticamente en addPosition desde useAuth.
 *   - No usamos realtime subscriptions todavía — simple recarga al modificar.
 */
function useUserPositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .order("entry_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setPositions([]);
    } else {
      setPositions(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addPosition = useCallback(async (payload) => {
    if (!user) throw new Error("No hay sesión activa");
    const row = { ...payload, user_id: user.id };
    const { data, error: err } = await supabase
      .from("positions")
      .insert([row])
      .select()
      .single();
    if (err) throw err;
    setPositions((prev) => [data, ...prev]);
    return data;
  }, [user]);

  const updatePosition = useCallback(async (id, patch) => {
    const { data, error: err } = await supabase
      .from("positions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (err) throw err;
    setPositions((prev) => prev.map((p) => (p.id === id ? data : p)));
    return data;
  }, []);

  const deletePosition = useCallback(async (id) => {
    const { error: err } = await supabase
      .from("positions")
      .delete()
      .eq("id", id);
    if (err) throw err;
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { positions, loading, error, addPosition, updatePosition, deletePosition, refresh };
}


/* ─────────────── Helpers de formato ─────────────── */

function fmtNumber(n, opts = {}) {
  if (n == null || isNaN(n)) return "—";
  const { maxDecimals = 2, minDecimals = 0 } = opts;
  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

function fmtCurrencyValue(value, currency) {
  if (value == null || isNaN(value)) return "—";
  const symbol = currency === "ARS" ? "$" :
                 currency === "USD" || currency?.startsWith("USD") ? "u$s" : "";
  return `${symbol} ${fmtNumber(value, { maxDecimals: 2 })}`;
}

function fmtDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}


/* ─────────────── DASHBOARD OVERVIEW (Sub-paso 3) ───────────────
 *
 * Componente separado que renderiza la "experiencia tipo Balanz":
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Banda FX: 4 cards Mayorista / MEP / CCL / Blue     │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Toggle moneda valuación: ARS / USD-MEP / USD-CCL   │
 *   ├─────────────────────────────────────────────────────┤
 *   │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
 *   │  │  Total   │ │ Distrib. │ │ Liquidez Proy.   │    │
 *   │  │  $ XXX   │ │ ░░░ donut│ │ 30d / 90d toggle │    │
 *   │  │  +X,XX%  │ │ Inst/Mon │ │ ARS/MEP/CCL      │    │
 *   │  └──────────┘ └──────────┘ └──────────────────┘    │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Flujos Proyectados (V1: lista próximos 5 vtos)    │
 *   └─────────────────────────────────────────────────────┘
 *
 * Recibe `positions` desde el padre (PortfolioDashboard) para no duplicar
 * la lectura de Supabase. Las cotizaciones FX se traen con useDashboardFx().
 *
 * Para precios actuales de bonos (cálculo del valor de cartera) usaremos
 * en futuras iteraciones data912 vía /api/bonos y /api/letras. Por ahora
 * V1 valúa todo a entry_price (costo) — sirve para tener layout funcional
 * y los números reales los conectamos al final.
 */

function DashboardOverview({ positions }) {
  const { fx, loading: fxLoading, error: fxError, lastUpdated, refresh: refreshFx } = useDashboardFx();

  // Toggle de moneda de valuación: ARS / USD-MEP / USD-CCL
  const [valuationCurrency, setValuationCurrency] = useState("ARS");

  // Toggle Distribución: instrumentos / monedas
  const [distView, setDistView] = useState("instruments");

  // Toggle Liquidez Proyectada ventana
  const [liquidityWindow, setLiquidityWindow] = useState("30d");

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 1. Banda FX */}
      <FxBand fx={fx} loading={fxLoading} error={fxError} onRefresh={refreshFx} lastUpdated={lastUpdated} />

      {/* 2. Toggle moneda de valuación */}
      <div className="flex items-center justify-between gap-3" style={{ marginTop: 16, marginBottom: 14 }}>
        <ValuationToggle
          value={valuationCurrency}
          onChange={setValuationCurrency}
        />
        <span style={{ fontSize: 11, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
          Cartera valuada en {valuationCurrency === "ARS" ? "Pesos" : valuationCurrency === "USD-MEP" ? "Dólar MEP" : "Dólar CCL"}
        </span>
      </div>

      {/* 3. Tres cards principales lado a lado */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <TotalCard
          positions={positions}
          fx={fx}
          valuationCurrency={valuationCurrency}
        />
        <DistributionCard
          positions={positions}
          fx={fx}
          valuationCurrency={valuationCurrency}
          view={distView}
          onViewChange={setDistView}
        />
        <LiquidityCard
          positions={positions}
          fx={fx}
          valuationCurrency={valuationCurrency}
          window={liquidityWindow}
          onWindowChange={setLiquidityWindow}
        />
      </div>

      {/* 4. Flujos proyectados (V1: lista simple) */}
      <FlowsSection positions={positions} />
    </div>
  );
}


/* ─────────────── FX Band: 4 cards de cotizaciones ─────────────── */

function FxBand({ fx, loading, error, onRefresh, lastUpdated }) {
  const items = [
    { key: "mayorista", label: "Mayorista" },
    { key: "mep",       label: "Dólar MEP"  },
    { key: "ccl",       label: "Dólar CCL"  },
    { key: "blue",      label: "Dólar Blue" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.22em", color: C.dim, textTransform: "uppercase", fontWeight: 600 }}>
          Cotizaciones del día
        </span>
        <button
          onClick={onRefresh}
          className="eco-refresh-btn"
          disabled={loading}
          style={{
            backgroundColor: "transparent",
            border: `1px solid ${C.border}`,
            color: C.muted,
            padding: "4px 10px",
            fontSize: 10.5,
            fontFamily: "'Roboto', sans-serif",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={11} strokeWidth={1.8} className={loading ? "eco-spin" : undefined} />
          {loading ? "Cargando" : "Actualizar"}
        </button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {items.map((it) => (
          <FxCard key={it.key} label={it.label} data={fx?.[it.key]} loading={loading && !fx} />
        ))}
      </div>
      {error && !fx && (
        <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>
          Error cargando cotizaciones: {error}
        </div>
      )}
    </div>
  );
}

function FxCard({ label, data, loading }) {
  const sell = data?.sell;
  const buy = data?.buy;
  const placeholder = loading || !data;

  return (
    <div
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 76,
      }}
    >
      <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {placeholder ? (
        <div style={{ height: 26, display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 18, color: C.dim, fontFamily: "'JetBrains Mono', monospace" }}>—</span>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span
            style={{
              fontSize: 19,
              fontWeight: 600,
              color: C.text,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "-0.01em",
            }}
          >
            {fmtCurrencyValue(sell || buy, "ARS")}
          </span>
        </div>
      )}
      {!placeholder && buy && sell && (
        <span style={{ fontSize: 10.5, color: C.dim, fontFamily: "'JetBrains Mono', monospace" }}>
          Compra {fmtCurrencyValue(buy, "ARS")}
        </span>
      )}
    </div>
  );
}


/* ─────────────── Toggle de moneda de valuación ─────────────── */

function ValuationToggle({ value, onChange }) {
  const options = [
    { key: "ARS",     label: "ARS" },
    { key: "USD-MEP", label: "USD MEP" },
    { key: "USD-CCL", label: "USD CCL" },
  ];
  return (
    <div
      className="flex"
      style={{
        backgroundColor: C.deep,
        border: `1px solid ${C.border}`,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              backgroundColor: active ? C.accent : "transparent",
              color: active ? C.bg : C.muted,
              border: "none",
              padding: "5px 14px",
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              fontFamily: "'Roboto', sans-serif",
              letterSpacing: "0.02em",
              transition: "background-color 120ms ease, color 120ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


/* ─────────────── Card 1: Total de cartera ─────────────── */

function TotalCard({ positions, fx, valuationCurrency }) {
  // V1: valuamos al entry_price (costo). En V2 conectamos data912 para
  // bonos con precio actualizado y un current_price manual para acciones.
  const totals = useMemo(
    () => computePortfolioTotals(positions, fx, valuationCurrency),
    [positions, fx, valuationCurrency]
  );

  const tcLine = useMemo(() => {
    if (!fx) return null;
    const parts = [];
    if (fx.mep?.sell) parts.push(`MEP ${fmtCurrencyValue(fx.mep.sell, "ARS")}`);
    if (fx.ccl?.sell) parts.push(`CCL ${fmtCurrencyValue(fx.ccl.sell, "ARS")}`);
    return parts.join(" · ");
  }, [fx]);

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={cardTitleStyle()}>Total</span>
      </div>

      <div className="flex items-baseline gap-3" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: C.text,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-0.02em",
          }}
        >
          {totals.value !== null
            ? fmtCurrencyValue(totals.value, valuationCurrency === "ARS" ? "ARS" : "USD")
            : "—"}
        </span>
      </div>

      {/* Variación día (placeholder hasta tener current_price) */}
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 12, fontFamily: "'Roboto', sans-serif" }}>
        Variación día —
        <span style={{ marginLeft: 6, color: C.faint, fontSize: 10.5 }}>
          (requiere precios actualizados)
        </span>
      </div>

      {tcLine && (
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
          {tcLine}
        </div>
      )}

      {totals.unvalued > 0 && (
        <div
          className="flex items-center gap-1"
          style={{
            marginTop: 10,
            fontSize: 10.5,
            color: C.yellow,
            fontFamily: "'Roboto', sans-serif",
          }}
        >
          <AlertTriangle size={11} strokeWidth={1.8} />
          <span>{totals.unvalued} {totals.unvalued === 1 ? "posición" : "posiciones"} sin precio actualizado</span>
        </div>
      )}
    </div>
  );
}


/* ─────────────── Card 2: Distribución ─────────────── */

function DistributionCard({ positions, fx, valuationCurrency, view, onViewChange }) {
  const slices = useMemo(() => {
    const totals = computePortfolioTotals(positions, fx, valuationCurrency);
    if (!totals.value || totals.value <= 0) return [];

    const groups = view === "monedas"
      ? groupByCurrency(positions, fx, valuationCurrency)
      : groupByCategory(positions, fx, valuationCurrency);

    const total = Object.values(groups).reduce((acc, v) => acc + v, 0);
    if (total <= 0) return [];

    return Object.entries(groups)
      .filter(([_, v]) => v > 0)
      .map(([key, value], idx) => ({
        key,
        label: prettifyGroupKey(key, view),
        value,
        pct: (value / total) * 100,
        color: PROVIDER_COLORS[idx % PROVIDER_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, fx, valuationCurrency, view]);

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={cardTitleStyle()}>Distribución</span>
        <div className="flex" style={{ backgroundColor: C.deep, border: `1px solid ${C.border}`, padding: 2 }}>
          {[
            { key: "instruments", label: "Instrumentos" },
            { key: "monedas",     label: "Monedas" },
          ].map((opt) => {
            const active = view === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onViewChange(opt.key)}
                style={{
                  backgroundColor: active ? C.accent : "transparent",
                  color: active ? C.bg : C.muted,
                  border: "none",
                  padding: "3px 8px",
                  fontSize: 9.5,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "'Roboto', sans-serif",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {slices.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, padding: "20px 0", textAlign: "center" }}>
          Sin datos para distribuir
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <DonutChart slices={slices} size={106} />
          <div className="flex flex-col" style={{ flex: 1, gap: 6, minWidth: 0 }}>
            {slices.slice(0, 5).map((s) => (
              <div key={s.key} className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <span style={{ width: 8, height: 8, backgroundColor: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Roboto', sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 11, color: C.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                  {s.pct.toFixed(1)}%
                </span>
              </div>
            ))}
            {slices.length > 5 && (
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
                +{slices.length - 5} más
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DonutChart({ slices, size = 100 }) {
  const radius = size / 2 - 4;
  const innerRadius = radius * 0.6;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {slices.map((s, idx) => {
        const fraction = s.value / total;
        const startAngle = cumulative * Math.PI * 2 - Math.PI / 2;
        cumulative += fraction;
        const endAngle = cumulative * Math.PI * 2 - Math.PI / 2;

        const largeArc = fraction > 0.5 ? 1 : 0;
        const x1 = cx + Math.cos(startAngle) * radius;
        const y1 = cy + Math.sin(startAngle) * radius;
        const x2 = cx + Math.cos(endAngle) * radius;
        const y2 = cy + Math.sin(endAngle) * radius;
        const x3 = cx + Math.cos(endAngle) * innerRadius;
        const y3 = cy + Math.sin(endAngle) * innerRadius;
        const x4 = cx + Math.cos(startAngle) * innerRadius;
        const y4 = cy + Math.sin(startAngle) * innerRadius;

        const d = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
          "Z",
        ].join(" ");

        return <path key={idx} d={d} fill={s.color} />;
      })}
    </svg>
  );
}


/* ─────────────── Card 3: Liquidez Proyectada ─────────────── */

function LiquidityCard({ positions, fx, valuationCurrency, window: windowKey, onWindowChange }) {
  const breakdown = useMemo(
    () => computeLiquidityBreakdown(positions, fx, valuationCurrency, windowKey),
    [positions, fx, valuationCurrency, windowKey]
  );

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={cardTitleStyle()}>Liquidez proyectada</span>
        <div className="flex" style={{ backgroundColor: C.deep, border: `1px solid ${C.border}`, padding: 2 }}>
          {[
            { key: "30d", label: "30 días" },
            { key: "90d", label: "90 días" },
          ].map((opt) => {
            const active = windowKey === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onWindowChange(opt.key)}
                style={{
                  backgroundColor: active ? C.accent : "transparent",
                  color: active ? C.bg : C.muted,
                  border: "none",
                  padding: "3px 8px",
                  fontSize: 9.5,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "'Roboto', sans-serif",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5" style={{ marginBottom: 6 }}>
        {[
          { key: "ARS",      label: "Pesos" },
          { key: "USD-MEP",  label: "USD MEP" },
          { key: "USD-CCL",  label: "USD CCL" },
        ].map((row) => {
          const v = breakdown[row.key] ?? 0;
          const display = v > 0
            ? fmtCurrencyValue(v, row.key === "ARS" ? "ARS" : "USD")
            : "—";
          return (
            <div key={row.key} className="flex items-center justify-between">
              <span style={{ fontSize: 11.5, color: C.muted, fontFamily: "'Roboto', sans-serif" }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, color: v > 0 ? C.text : C.dim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                {display}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: C.dim, marginTop: 10, fontFamily: "'Roboto', sans-serif", lineHeight: 1.4 }}>
        Incluye bonos, ONs, cauciones, futuros y opciones que vencen en la ventana elegida.
      </div>
    </div>
  );
}


/* ─────────────── Sección Flujos Proyectados (V1: placeholder) ─────────────── */

function FlowsSection({ positions }) {
  const upcomingMaturities = useMemo(() => {
    const now = new Date();
    const events = [];
    for (const p of positions) {
      const t = p.instrument_type;
      const ticker = (p.ticker || "").toUpperCase();
      // Bonos ARS — vencimientos del registry
      if (t === "bond_ars" && BOND_REGISTRY[ticker]?.maturityDate) {
        events.push({
          ticker,
          type: "Bono ARS",
          date: BOND_REGISTRY[ticker].maturityDate,
          quantity: p.quantity,
          currency: p.entry_currency,
        });
      }
      // Cauciones — vencimiento = entry_date + plazo
      if (t === "caucion" && p.entry_date && p.extra?.term_days) {
        const start = new Date(p.entry_date);
        const end = new Date(start.getTime() + Number(p.extra.term_days) * 86400000);
        events.push({
          ticker: p.ticker || "Caución",
          type: "Caución",
          date: end.toISOString().slice(0, 10),
          quantity: p.quantity,
          currency: p.entry_currency,
        });
      }
      // Futuros DLR — fecha de vencimiento del registry
      if (t === "future") {
        const contract = DLR_REGISTRY.find((c) => c.ticker === ticker);
        if (contract?.maturityDate) {
          events.push({
            ticker,
            type: "Futuro",
            date: contract.maturityDate,
            quantity: p.quantity,
            currency: p.entry_currency,
          });
        }
      }
    }
    return events
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [positions]);

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={cardTitleStyle()}>Flujos proyectados</span>
        <span style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
          Próximos 5 vencimientos
        </span>
      </div>

      {upcomingMaturities.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, padding: "16px 0", textAlign: "center" }}>
          No hay vencimientos próximos en tu cartera
        </div>
      ) : (
        <div className="flex flex-col">
          {upcomingMaturities.map((e, idx) => (
            <div
              key={`${e.ticker}-${idx}`}
              className="flex items-center justify-between"
              style={{
                padding: "8px 0",
                borderBottom: idx < upcomingMaturities.length - 1 ? `1px solid ${C.border}` : "none",
              }}
            >
              <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, minWidth: 70 }}>
                  {e.ticker}
                </span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Roboto', sans-serif" }}>
                  {e.type}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtMaturityShort(e.date)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─────────────── Helpers de cálculo ─────────────── */

function cardBaseStyle() {
  return {
    backgroundColor: C.panel,
    border: `1px solid ${C.border}`,
    padding: "16px 18px",
    minHeight: 180,
  };
}

function cardTitleStyle() {
  return {
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
    fontFamily: "'Roboto', sans-serif",
  };
}

/**
 * Convierte un valor desde su moneda original a la moneda de valuación.
 * Si no hay FX disponible o la moneda no se puede mapear, retorna null.
 */
function convertValue(amount, fromCurrency, toCurrency, fx) {
  if (amount == null || isNaN(amount)) return null;
  if (fromCurrency === toCurrency) return amount;

  // Mismas monedas vía alias
  if (
    (fromCurrency === "USD-MEP" && toCurrency === "USD-MEP") ||
    (fromCurrency === "USD-CCL" && toCurrency === "USD-CCL")
  ) return amount;

  if (!fx) return null;

  // Tasa ARS por unidad de moneda extranjera
  const ratesArs = {
    "ARS":     1,
    "USD-MEP": fx.mep?.sell || null,
    "USD-CCL": fx.ccl?.sell || null,
  };
  const fromRate = ratesArs[fromCurrency];
  const toRate = ratesArs[toCurrency];
  if (!fromRate || !toRate) return null;

  // amount en ARS = amount * fromRate; luego dividir por toRate
  return (amount * fromRate) / toRate;
}

/**
 * Calcula el valor de mercado de una posición.
 * V1: si tenemos current_price (futuro) lo usamos; sino caemos a entry_price.
 * Para cauciones, retornamos el monto colocado/tomado a su valor nominal.
 */
function positionValue(p) {
  const price = p.current_price ?? p.entry_price;
  if (price == null) {
    // Cauciones: el valor es directamente la cantidad (es plata)
    if (p.instrument_type === "caucion") return Number(p.quantity) || 0;
    return null;
  }
  const qty = Number(p.quantity) || 0;
  // Bonos: precio cada 100 VN
  if (p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd" || p.instrument_type === "on") {
    return (qty * Number(price)) / 100;
  }
  // Futuros: contrato * multiplicador * precio. DLR multiplicador típico = 1000.
  if (p.instrument_type === "future") {
    const mult = 1000;
    return qty * mult * Number(price);
  }
  // Opciones: contrato * 100 * prima (placeholder)
  if (p.instrument_type === "option") {
    return qty * 100 * Number(price);
  }
  // Acciones, CEDEARs, FCI, USD, Cripto: cantidad * precio
  return qty * Number(price);
}

function computePortfolioTotals(positions, fx, valuationCurrency) {
  let total = 0;
  let unvalued = 0;
  let valuedAny = false;

  for (const p of positions) {
    // Para venta corta de futuros, el "valor" se invierte (es deuda nominal)
    // pero para V1 lo dejamos absoluto — se ajustará en V2 con P&L real.
    let raw = positionValue(p);
    if (raw == null) {
      unvalued++;
      continue;
    }
    valuedAny = true;
    const converted = convertValue(raw, p.entry_currency || "ARS", valuationCurrency, fx);
    if (converted == null) {
      unvalued++;
      continue;
    }
    total += converted;
  }

  return {
    value: valuedAny ? total : null,
    unvalued,
  };
}

function groupByCategory(positions, fx, valuationCurrency) {
  const result = {};
  for (const p of positions) {
    const raw = positionValue(p);
    if (raw == null) continue;
    const v = convertValue(raw, p.entry_currency || "ARS", valuationCurrency, fx);
    if (v == null) continue;
    const cat = simplifyCategory(p.instrument_type);
    result[cat] = (result[cat] || 0) + v;
  }
  return result;
}

function groupByCurrency(positions, fx, valuationCurrency) {
  const result = {};
  for (const p of positions) {
    const raw = positionValue(p);
    if (raw == null) continue;
    const v = convertValue(raw, p.entry_currency || "ARS", valuationCurrency, fx);
    if (v == null) continue;
    const cur = p.entry_currency || "ARS";
    result[cur] = (result[cur] || 0) + v;
  }
  return result;
}

/**
 * Mapea los 11 instrument_types a 5 categorías de alto nivel para el donut.
 */
function simplifyCategory(instrumentType) {
  switch (instrumentType) {
    case "bond_ars":
      return "Renta Fija ARS";
    case "bond_usd":
    case "on":
      return "Renta Fija USD";
    case "stock":
    case "cedear":
      return "Renta Variable";
    case "future":
    case "option":
      return "Cobertura";
    case "caucion":
    case "fci":
    case "usd":
      return "Liquidez";
    case "crypto":
      return "Cripto";
    default:
      return "Otros";
  }
}

function prettifyGroupKey(key, view) {
  if (view === "monedas") {
    if (key === "ARS")     return "Pesos";
    if (key === "USD-MEP") return "USD MEP";
    if (key === "USD-CCL") return "USD CCL";
    if (key === "USD")     return "USD";
    return key;
  }
  return key;
}

/**
 * Suma vencimientos en la ventana elegida y devuelve el total por moneda.
 */
function computeLiquidityBreakdown(positions, fx, valuationCurrency, windowKey) {
  const days = windowKey === "30d" ? 30 : 90;
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 86400000);

  const result = { ARS: 0, "USD-MEP": 0, "USD-CCL": 0 };

  for (const p of positions) {
    const matDate = getPositionMaturity(p);
    if (!matDate) continue;
    const md = new Date(matDate);
    if (md < now || md > cutoff) continue;

    const raw = positionValue(p);
    if (raw == null) continue;
    const cur = p.entry_currency || "ARS";
    if (result[cur] != null) {
      result[cur] += raw;
    }
  }

  return result;
}

function getPositionMaturity(p) {
  const t = p.instrument_type;
  const ticker = (p.ticker || "").toUpperCase();
  if (t === "bond_ars" && BOND_REGISTRY[ticker]?.maturityDate) {
    return BOND_REGISTRY[ticker].maturityDate;
  }
  if (t === "future") {
    const c = DLR_REGISTRY.find((x) => x.ticker === ticker);
    if (c) return c.maturityDate;
  }
  if (t === "caucion" && p.entry_date && p.extra?.term_days) {
    const start = new Date(p.entry_date);
    return new Date(start.getTime() + Number(p.extra.term_days) * 86400000)
      .toISOString().slice(0, 10);
  }
  if (t === "option" && p.extra?.expiry) {
    return p.extra.expiry;
  }
  return null;
}


/* ─────────────── Dashboard real del módulo Portfolio IA ───────────────
 *
 * Layout del Sub-paso 2:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Header: "Hola, X" + descripción + botón "+Agregar" │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Filtros (chips: Todos · Bonos · Futuros · …)       │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Tabla de posiciones (o EmptyState si no hay)       │
 *   └─────────────────────────────────────────────────────┘
 *
 * El dashboard "tipo Balanz" con KPIs arriba viene en el Sub-paso 3.
 */
function PortfolioDashboard() {
  const { user } = useAuth();
  const { positions, loading, error, addPosition, updatePosition, deletePosition } = useUserPositions();

  // Estados UI
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [filter, setFilter] = useState("all");
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const firstName = displayName.split(" ")[0];

  // Filtrado de posiciones
  const filteredPositions = useMemo(() => {
    if (filter === "all") return positions;
    // El filtro virtual "bond" matchea tanto bond_ars como bond_usd
    if (filter === "bond") {
      return positions.filter(
        (p) => p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd"
      );
    }
    return positions.filter((p) => p.instrument_type === filter);
  }, [positions, filter]);

  // Tipos presentes en cartera (para mostrar solo chips relevantes).
  // Colapsamos bond_ars/bond_usd en un único "bond" para alinear con
  // el dropdown del drawer y la columna Tipo de la tabla.
  const presentTypes = useMemo(() => {
    const set = new Set();
    for (const p of positions) {
      if (p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd") {
        set.add("bond");
      } else {
        set.add(p.instrument_type);
      }
    }
    return Array.from(set);
  }, [positions]);

  const openCreate = () => {
    setEditingPosition(null);
    setDrawerOpen(true);
  };

  const openEdit = (position) => {
    setEditingPosition(position);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingPosition(null);
  };

  const handleSubmit = async (payload) => {
    if (editingPosition) {
      await updatePosition(editingPosition.id, payload);
    } else {
      await addPosition(payload);
    }
    closeDrawer();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmingDelete) return;
    await deletePosition(confirmingDelete.id);
    setConfirmingDelete(null);
  };

  return (
    <div className="px-7 py-6 eco-fade-in" style={{ position: "relative" }}>
      {/* Header del módulo */}
      <div
        className="flex items-center gap-3"
        style={{ marginBottom: 6, fontSize: 9, letterSpacing: "0.22em", color: C.dim, textTransform: "uppercase", fontWeight: 600 }}
      >
        <span>Portfolio IA</span>
        <span style={{ color: C.faint }}>·</span>
        <span>Beta</span>
      </div>

      <div className="flex items-end justify-between gap-4" style={{ marginBottom: 26 }}>
        <div>
          <h1
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 26,
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.015em",
              margin: 0,
              marginBottom: 6,
            }}
          >
            Hola, {firstName}
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, maxWidth: 640 }}>
            Cargá tus posiciones para ver tu cartera consolidada y descubrir oportunidades.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2"
          style={{
            backgroundColor: C.accent,
            color: C.bg,
            border: "none",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Roboto', sans-serif",
            letterSpacing: "0.01em",
            transition: "transform 120ms ease, box-shadow 120ms ease",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 4px 12px ${C.accentGlow}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Plus size={15} strokeWidth={2.2} />
          Agregar posición
        </button>
      </div>

      {/* Estado de error */}
      {error && (
        <div
          className="flex items-center gap-2"
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.08)",
            border: `1px solid rgba(248, 113, 113, 0.30)`,
            color: C.red,
            padding: "10px 14px",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={13} strokeWidth={1.8} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading inicial */}
      {loading && positions.length === 0 ? (
        <div className="flex items-center justify-center" style={{ padding: "80px 0" }}>
          <Loader2 size={24} color={C.muted} className="eco-spin" strokeWidth={1.5} />
        </div>
      ) : positions.length === 0 ? (
        <PortfolioEmptyState onAdd={openCreate} />
      ) : (
        <>
          {/* Sub-paso 3: Dashboard tipo Balanz */}
          <DashboardOverview positions={positions} />

          {/* Tabla de posiciones (heredada del Sub-paso 2) */}
          <div style={{ marginBottom: 8, fontSize: 9, letterSpacing: "0.22em", color: C.dim, textTransform: "uppercase", fontWeight: 600 }}>
            Posiciones cargadas
          </div>

          {/* Filtros (chips por tipo) */}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 16 }}>
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`Todas (${positions.length})`}
            />
            {presentTypes.map((type) => {
              const meta = INSTRUMENT_TYPES[type];
              if (!meta) return null;
              const count =
                type === "bond"
                  ? positions.filter(
                      (p) => p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd"
                    ).length
                  : positions.filter((p) => p.instrument_type === type).length;
              return (
                <FilterChip
                  key={type}
                  active={filter === type}
                  onClick={() => setFilter(type)}
                  label={`${meta.label} (${count})`}
                  color={meta.color}
                />
              );
            })}
          </div>

          {/* Tabla de posiciones */}
          <PositionsTable
            positions={filteredPositions}
            onEdit={openEdit}
            onDelete={(p) => setConfirmingDelete(p)}
          />
        </>
      )}

      {/* Drawer lateral de carga/edición */}
      {drawerOpen && (
        <AddPositionDrawer
          editingPosition={editingPosition}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      )}

      {/* Modal de confirmación de borrado */}
      {confirmingDelete && (
        <DeleteConfirmModal
          position={confirmingDelete}
          onCancel={() => setConfirmingDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}


/* ─────────────── Empty state (sin posiciones) ─────────────── */
function PortfolioEmptyState({ onAdd }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        padding: "60px 40px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 18px",
          backgroundColor: C.accentSoft,
          border: `1px solid ${C.accentBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Wallet size={22} color={C.accent} strokeWidth={1.6} />
      </div>
      <h3
        style={{
          fontSize: 17,
          color: C.text,
          margin: 0,
          marginBottom: 8,
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 600,
        }}
      >
        Tu cartera está vacía
      </h3>
      <p style={{ fontSize: 12, color: C.muted, margin: "0 auto 24px", maxWidth: 420, lineHeight: 1.6 }}>
        Empezá cargando tus bonos, futuros, cauciones, acciones o lo que tengas. Cada
        operación se carga como una transacción independiente.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2"
        style={{
          backgroundColor: C.accent,
          color: C.bg,
          border: "none",
          padding: "10px 18px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Roboto', sans-serif",
          margin: "0 auto",
        }}
      >
        <Plus size={15} strokeWidth={2.2} />
        Agregar primera posición
      </button>
    </div>
  );
}


/* ─────────────── Filter chip (botón pill) ─────────────── */
function FilterChip({ active, onClick, label, color }) {
  const tint = color ? C.cat[color] : C.accent;
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: active ? `${tint}1A` : "transparent",
        border: `1px solid ${active ? tint : C.border}`,
        color: active ? tint : C.muted,
        padding: "5px 12px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.02em",
        cursor: "pointer",
        fontFamily: "'Roboto', sans-serif",
        transition: "all 120ms ease",
        borderRadius: 4,
      }}
    >
      {label}
    </button>
  );
}


/* ─────────────── Tabla de posiciones ─────────────── */
function PositionsTable({ positions, onEdit, onDelete }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Roboto', sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <PTh>Tipo</PTh>
              <PTh>Op.</PTh>
              <PTh>Ticker</PTh>
              <PTh align="right">Cantidad</PTh>
              <PTh align="right">Precio</PTh>
              <PTh>Moneda</PTh>
              <PTh>Fecha</PTh>
              <PTh>Notas</PTh>
              <PTh align="right" style={{ width: 90 }}>{""}</PTh>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <PositionRow
                key={p.id}
                position={p}
                onEdit={() => onEdit(p)}
                onDelete={() => onDelete(p)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PTh({ children, align = "left", style = {} }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "11px 14px",
        fontSize: 9,
        fontWeight: 600,
        color: C.dim,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function PTd({ children, align = "left", style = {} }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "12px 14px",
        fontSize: 12.5,
        color: C.text,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}


/* ─────────────── Fila de posición ─────────────── */
function PositionRow({ position, onEdit, onDelete }) {
  const meta = INSTRUMENT_TYPES[position.instrument_type] || {};
  const TypeIcon = meta.icon || Activity;
  const typeColor = meta.color ? C.cat[meta.color] : C.muted;
  const isSell = position.operation_type === "sell";

  // Para bond_ars y bond_usd mostramos "Bono" unificado: la moneda real
  // ya aparece en su propia columna, así que distinguir ARS/USD acá
  // duplica info y desincroniza con el dropdown del drawer ("Bono").
  const displayLabel =
    position.instrument_type === "bond_ars" || position.instrument_type === "bond_usd"
      ? "Bono"
      : (meta.label || position.instrument_type);

  return (
    <tr
      style={{
        borderBottom: `1px solid ${C.border}`,
        transition: "background-color 100ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.015)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <PTd>
        <div className="flex items-center gap-2">
          <TypeIcon size={13} color={typeColor} strokeWidth={1.7} />
          <span style={{ fontSize: 11.5, color: C.muted }}>{displayLabel}</span>
        </div>
      </PTd>
      <PTd>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            padding: "2px 7px",
            borderRadius: 3,
            color: isSell ? C.red : C.green,
            backgroundColor: isSell ? "rgba(248,113,113,0.10)" : "rgba(74,222,128,0.10)",
            border: `1px solid ${isSell ? "rgba(248,113,113,0.30)" : "rgba(74,222,128,0.30)"}`,
          }}
        >
          {isSell ? "VENTA" : "COMPRA"}
        </span>
      </PTd>
      <PTd>
        <span className="eco-mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
          {position.ticker}
        </span>
      </PTd>
      <PTd align="right">
        <span className="eco-mono">{fmtNumber(position.quantity, { maxDecimals: 8 })}</span>
      </PTd>
      <PTd align="right">
        <span className="eco-mono">
          {position.entry_price != null ? fmtNumber(position.entry_price, { maxDecimals: 4 }) : "—"}
        </span>
      </PTd>
      <PTd>
        <span style={{ fontSize: 11.5, color: C.muted }}>{position.entry_currency}</span>
      </PTd>
      <PTd>
        <span style={{ fontSize: 11.5, color: C.muted }}>{fmtDateShort(position.entry_date)}</span>
      </PTd>
      <PTd>
        <span style={{ fontSize: 11, color: C.dim, maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={position.notes || ""}>
          {position.notes || "—"}
        </span>
      </PTd>
      <PTd align="right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            aria-label="Editar"
            style={{
              backgroundColor: "transparent",
              border: `1px solid transparent`,
              color: C.dim,
              padding: 5,
              cursor: "pointer",
              transition: "all 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = C.accent;
              e.currentTarget.style.borderColor = C.accentBorder;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = C.dim;
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <Pencil size={12} strokeWidth={1.8} />
          </button>
          <button
            onClick={onDelete}
            aria-label="Borrar"
            style={{
              backgroundColor: "transparent",
              border: `1px solid transparent`,
              color: C.dim,
              padding: 5,
              cursor: "pointer",
              transition: "all 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = C.red;
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.40)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = C.dim;
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <Trash2 size={12} strokeWidth={1.8} />
          </button>
        </div>
      </PTd>
    </tr>
  );
}


/* ─────────────── Modal: confirmar borrado ─────────────── */
function DeleteConfirmModal({ position, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(2px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="eco-fade-in"
        style={{
          backgroundColor: C.panel,
          border: `1px solid ${C.borderStrong}`,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        <div
          className="flex items-center gap-3"
          style={{ marginBottom: 14 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              backgroundColor: "rgba(248,113,113,0.10)",
              border: `1px solid rgba(248,113,113,0.30)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={16} color={C.red} strokeWidth={1.8} />
          </div>
          <h3 style={{ margin: 0, fontSize: 15, color: C.text, fontFamily: "'Raleway', sans-serif", fontWeight: 600 }}>
            Borrar posición
          </h3>
        </div>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          ¿Seguro querés borrar la operación de{" "}
          <strong style={{ color: C.text }}>{position.ticker}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              padding: "8px 14px",
              fontSize: 12,
              cursor: deleting ? "not-allowed" : "pointer",
              fontFamily: "'Roboto', sans-serif",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            style={{
              backgroundColor: C.red,
              border: "none",
              color: "#fff",
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: deleting ? "not-allowed" : "pointer",
              fontFamily: "'Roboto', sans-serif",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Borrando..." : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─────────────── Drawer: agregar / editar posición ───────────────
 *
 * Drawer lateral derecho con form inteligente que se adapta al tipo
 * de instrumento elegido. Cada tipo tiene sus propios labels, hints
 * y campos extra (ej. cauciones tienen tasa TNA y plazo).
 *
 * El form arma un "payload" que matchea el schema de la tabla positions
 * y lo pasa a onSubmit. La persistencia se hace en el componente padre.
 */
function AddPositionDrawer({ editingPosition, onClose, onSubmit }) {
  const isEditing = Boolean(editingPosition);

  // Catálogo dinámico de tickers (acciones, CEDEARs, ONs, bonos USD).
  // Para los demás tipos sigue usándose el hardcoded de bondMaturities.js
  // y dlrContracts.js. El hook trae sessionStorage cache instantáneo si
  // existe, así que el dropdown raramente queda en estado "loading".
  const { catalog: instrumentCatalog } = useInstrumentCatalog();

  // Estado del form. Si editamos, prellenamos con los valores existentes.
  const [form, setForm] = useState(() => {
    if (editingPosition) {
      // Mapeo virtual: bond_ars y bond_usd se muestran como "bond"
      // unificado en el dropdown. La moneda real (ARS/USD/MEP/CCL/Blue)
      // sigue en entry_currency y al guardar volvemos a desambiguar.
      const persistedType = editingPosition.instrument_type;
      const formType =
        persistedType === "bond_ars" || persistedType === "bond_usd"
          ? "bond"
          : persistedType;
      return {
        instrument_type: formType,
        operation_type: editingPosition.operation_type || "buy",
        ticker: editingPosition.ticker || "",
        quantity: editingPosition.quantity ?? "",
        entry_price: editingPosition.entry_price ?? "",
        entry_currency: normalizeLegacyCurrency(editingPosition.entry_currency),
        entry_date: editingPosition.entry_date || new Date().toISOString().slice(0, 10),
        notes: editingPosition.notes || "",
        // extra fields desde el JSONB
        rate_tna: editingPosition.extra?.rate_tna ?? "",
        term_days: editingPosition.extra?.term_days ?? "",
        strike: editingPosition.extra?.strike ?? "",
        expiry: editingPosition.extra?.expiry ?? "",
        option_type: editingPosition.extra?.option_type ?? "call",
      };
    }
    return {
      instrument_type: "bond",
      operation_type: "buy",
      ticker: "",
      quantity: "",
      entry_price: "",
      entry_currency: "ARS",
      entry_date: new Date().toISOString().slice(0, 10),
      notes: "",
      rate_tna: "",
      term_days: "",
      strike: "",
      expiry: "",
      option_type: "call",
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Animación de salida: cuando el user cancela (backdrop / X / Cancelar / ESC),
  // marcamos closing=true para disparar ecoSlideOut y recién al terminar la
  // animación llamamos al onClose del padre (que desmonta el componente).
  // El submit exitoso NO pasa por aquí porque el feedback de "guardado" es
  // mejor cuando el cierre es instantáneo.
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    if (closing || submitting) return;
    setClosing(true);
  };

  // Cuando cambia el tipo, ajustamos la moneda por defecto si todavía no editaste
  const meta = INSTRUMENT_TYPES[form.instrument_type] || INSTRUMENT_TYPES.bond;

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => ({ ...e, [key]: null }));
    }
  };

  /**
   * Cuando cambia el TIPO de instrumento.
   *
   * Reset agresivo: blanqueamos ticker, quantity, entry_price y campos
   * extra contextuales (rate_tna, term_days, strike, expiry, option_type).
   * Mantenemos fecha y notas, que son del meta-evento de la operación y
   * no dependen del instrumento.
   *
   * La moneda se recalcula con resolveCurrencyFromTicker (al no haber
   * ticker todavía, queda en el default del tipo: ARS para casi todos,
   * null/editable para cauciones / opciones / fci).
   */
  const handleTypeChange = (newType) => {
    setForm((f) => {
      const { currency, suggested } = resolveCurrencyFromTicker(newType, "");
      const newCurrency = suggested
        ? currency
        : (currency || INSTRUMENT_TYPES[newType]?.defaultCurrency || "ARS");
      return {
        ...f,
        instrument_type: newType,
        // Reset de campos dependientes del tipo
        ticker: "",
        quantity: "",
        entry_price: "",
        // Extras (todos blanqueados para que el form siguiente arranque limpio)
        rate_tna: "",
        term_days: "",
        strike: "",
        expiry: "",
        option_type: "call",
        // Moneda: arranca con la sugerencia del tipo (editable después)
        entry_currency: newCurrency,
      };
    });
    // Limpiar errores asociados al form anterior
    setErrors({});
  };

  /**
   * Cuando cambia el TICKER.
   *
   * Reset de quantity, entry_price y extras. La moneda se PRESELECCIONA
   * según resolveCurrencyFromTicker pero queda editable para que el user
   * pueda reflejar conversiones internas del broker:
   *   - Si el ticker tiene sufijo C → USD-CCL
   *   - Si tiene sufijo D → USD-MEP
   *   - Si es bono ARS o puro USD → ARS
   *   - etc.
   */
  const handleTickerChange = (newTicker) => {
    setForm((f) => {
      const { currency, suggested } = resolveCurrencyFromTicker(
        f.instrument_type,
        newTicker
      );
      return {
        ...f,
        ticker: newTicker,
        // Resetear cantidad y precio porque el contexto cambió
        quantity: "",
        entry_price: "",
        // Si el ticker tiene sugerencia, la aplicamos como default. El user
        // puede modificarla después si su broker convierte internamente.
        entry_currency: suggested && currency ? currency : f.entry_currency,
      };
    });
    if (errors.ticker || errors.quantity || errors.entry_price) {
      setErrors((e) => ({ ...e, ticker: null, quantity: null, entry_price: null }));
    }
  };

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closing, submitting]);

  // Validación
  const validate = () => {
    const errs = {};
    if (!form.ticker.trim()) errs.ticker = "Ticker requerido";
    if (form.ticker.length > 16) errs.ticker = "Máximo 16 caracteres";

    const qty = Number(form.quantity);
    if (!form.quantity || isNaN(qty) || qty <= 0) {
      errs.quantity = "Cantidad debe ser mayor a 0";
    } else if (meta.integerQuantity && !Number.isInteger(qty)) {
      errs.quantity = "Debe ser un número entero";
    }

    // Precio: solo obligatorio si el tipo lo tiene definido
    if (meta.priceLabel != null) {
      const price = Number(form.entry_price);
      if (form.entry_price === "" || isNaN(price) || price <= 0) {
        errs.entry_price = "Precio debe ser mayor a 0";
      }
    }

    if (!form.entry_date) errs.entry_date = "Fecha requerida";

    // Validaciones específicas
    if (form.instrument_type === "caucion") {
      const tna = Number(form.rate_tna);
      if (form.rate_tna === "" || isNaN(tna) || tna < 0) {
        errs.rate_tna = "Tasa TNA requerida";
      }
      const term = Number(form.term_days);
      if (form.term_days === "" || isNaN(term) || term <= 0 || !Number.isInteger(term)) {
        errs.term_days = "Plazo en días entero";
      }
    }

    if (form.instrument_type === "option") {
      const k = Number(form.strike);
      if (form.strike === "" || isNaN(k) || k <= 0) errs.strike = "Strike requerido";
      if (!form.expiry) errs.expiry = "Vencimiento requerido";
    }

    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // Armar el payload limpio para la BD
    const extra = {};
    if (form.instrument_type === "caucion") {
      extra.rate_tna = Number(form.rate_tna);
      extra.term_days = Number(form.term_days);
    }
    if (form.instrument_type === "option") {
      extra.strike = Number(form.strike);
      extra.expiry = form.expiry;
      extra.option_type = form.option_type;
    }

    // El tipo "bond" del form es virtual: lo desambiguamos a bond_ars o
    // bond_usd antes de mandarlo a la BD, donde el enum sigue siendo
    // bond_ars / bond_usd.
    //
    // El criterio NO es la moneda elegida (porque AL30 puro se opera en
    // ARS pero es un bono USD), sino la presencia del ticker en BOND_REGISTRY:
    //   - Si está en BOND_REGISTRY (lecaps, boncaps, duales) → bond_ars
    //   - Caso contrario (AL30, GD30, AL30D, GD30C, etc.)    → bond_usd
    const persistedType =
      form.instrument_type === "bond"
        ? (BOND_REGISTRY[form.ticker.trim().toUpperCase()] ? "bond_ars" : "bond_usd")
        : form.instrument_type;

    const payload = {
      instrument_type: persistedType,
      operation_type: form.operation_type,
      ticker: form.ticker.trim().toUpperCase(),
      quantity: Number(form.quantity),
      entry_price: meta.priceLabel != null && form.entry_price !== "" ? Number(form.entry_price) : null,
      entry_currency: form.entry_currency,
      entry_date: form.entry_date,
      notes: form.notes.trim() || null,
      extra,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setErrors({ _form: err.message || "Error al guardar" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop (respeta los 26px del status bar inferior del workspace) */}
      <div
        onClick={requestClose}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 26,
          left: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          zIndex: 90,
          animation: closing
            ? "ecoBackdropOut 220ms ease-in forwards"
            : "ecoBackdropIn 220ms ease-out",
        }}
      />
      {/* Drawer (respeta los 26px del status bar inferior del workspace) */}
      <div
        className="eco-drawer"
        onAnimationEnd={(e) => {
          // Solo desmontamos cuando termina la animación de salida del drawer.
          // Filtramos por animationName para no reaccionar a la de entrada.
          if (closing && e.animationName === "ecoSlideOut") {
            onClose();
          }
        }}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 26,
          width: "min(560px, 100vw)",
          backgroundColor: C.panel,
          borderLeft: `1px solid ${C.borderStrong}`,
          zIndex: 91,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Roboto', sans-serif",
          animation: closing
            ? "ecoSlideOut 220ms ease-in forwards"
            : "ecoSlideIn 220ms ease-out",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "18px 24px",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600 }}>
              {isEditing ? "Editar posición" : "Nueva posición"}
            </div>
            <h3
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: 18,
                fontWeight: 600,
                color: C.text,
                margin: 0,
                marginTop: 2,
                letterSpacing: "-0.01em",
              }}
            >
              {meta.label}
            </h3>
          </div>
          <button
            onClick={requestClose}
            aria-label="Cerrar"
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* Body scrolleable */}
        <div className="eco-scroll" style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Tipo de instrumento */}
          <FormSection label="Instrumento">
            <Select
              value={form.instrument_type}
              onChange={handleTypeChange}
              options={INSTRUMENT_TYPE_KEYS.map((key) => ({
                value: key,
                label: INSTRUMENT_TYPES[key].label,
              }))}
            />
            <FieldHint>{meta.description}</FieldHint>
          </FormSection>

          {/* Tipo de operación.
           *
           * Para cauciones la jerga del mercado es "Colocar" (prestar plata
           * a tasa) y "Tomar" (pedirla prestada). Para todo lo demás son
           * compra/venta clásicas. Los valores internos siguen siendo
           * "buy" y "sell" para no romper la BD ni la lógica de cálculo.
           */}
          <FormSection label="Operación">
            <div className="flex gap-2">
              <ToggleButton
                active={form.operation_type === "buy"}
                onClick={() => setField("operation_type", "buy")}
                color="green"
              >
                {form.instrument_type === "caucion" ? "Colocar" : "Comprar"}
              </ToggleButton>
              <ToggleButton
                active={form.operation_type === "sell"}
                onClick={() => setField("operation_type", "sell")}
                color="red"
              >
                {form.instrument_type === "caucion" ? "Tomar" : "Vender"}
              </ToggleButton>
            </div>
          </FormSection>

          {/* Ticker.
           *
           * Para tipos con lista controlada renderizamos un Select para
           * evitar tipeos erróneos (T03J6 vs T30J6):
           *   - bond  → BOND_REGISTRY (ARS) + catálogo dinámico USD
           *   - future → DLR_REGISTRY hardcoded
           *   - stock / cedear / on → catálogo dinámico desde Supabase
           *
           * Si el catálogo dinámico todavía no cargó (primer login) o data912
           * está caído, stock/cedear/on caen a Input libre como fallback.
           */}
          {(() => {
            const { mode, options } = getTickerOptions(
              form.instrument_type,
              form.ticker,
              instrumentCatalog,
            );
            if (mode === "select") {
              return (
                <FormSection label="Ticker" error={errors.ticker}>
                  <Select
                    value={form.ticker}
                    onChange={handleTickerChange}
                    options={[
                      { value: "", label: "Elegí un ticker..." },
                      ...options,
                    ]}
                    hasError={Boolean(errors.ticker)}
                  />
                </FormSection>
              );
            }
            return (
              <FormSection label="Ticker" error={errors.ticker}>
                <Input
                  value={form.ticker}
                  onChange={(v) => handleTickerChange(v.toUpperCase())}
                  placeholder={
                    form.instrument_type === "stock" ? "GGAL, YPF, ALUA..." :
                    form.instrument_type === "cedear" ? "AAPL, MSFT, NVDA..." :
                    form.instrument_type === "caucion" ? "CAUCION..." :
                    "Código del instrumento"
                  }
                  hasError={Boolean(errors.ticker)}
                />
              </FormSection>
            );
          })()}

          {/* Cantidad */}
          <FormSection label={meta.quantityLabel} error={errors.quantity} hint={meta.quantityHint}>
            <Input
              type="number"
              value={form.quantity}
              onChange={(v) => setField("quantity", v)}
              placeholder={meta.integerQuantity ? "Entero" : "0,00"}
              step={meta.integerQuantity ? "1" : "any"}
              hasError={Boolean(errors.quantity)}
            />
          </FormSection>

          {/* Precio (solo si aplica) */}
          {meta.priceLabel && (
            <FormSection label={meta.priceLabel} error={errors.entry_price} hint={meta.priceHint}>
              <Input
                type="number"
                value={form.entry_price}
                onChange={(v) => setField("entry_price", v)}
                placeholder="0,00"
                step="any"
                hasError={Boolean(errors.entry_price)}
              />
            </FormSection>
          )}

          {/* Moneda + Fecha lado a lado.
           *
           * La moneda se PRESELECCIONA según el ticker (ARS para puros,
           * USD-MEP para sufijo D, USD-CCL para C, etc.) pero queda
           * editable. Algunos brokers convierten internamente y permiten
           * comprar AL30 contra USD-MEP, por ejemplo, así que el usuario
           * tiene que poder reflejar eso.
           */}
          {(() => {
            const { suggested: currencySuggested } = resolveCurrencyFromTicker(
              form.instrument_type,
              form.ticker
            );
            return (
              <div className="grid grid-cols-2 gap-3">
                <FormSection
                  label="Moneda"
                  hint={currencySuggested ? "Sugerida según el ticker" : undefined}
                >
                  <Select
                    value={form.entry_currency}
                    onChange={(v) => setField("entry_currency", v)}
                    options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
                  />
                </FormSection>
                <FormSection label="Fecha" error={errors.entry_date}>
                  <Input
                    type="date"
                    value={form.entry_date}
                    onChange={(v) => setField("entry_date", v)}
                    hasError={Boolean(errors.entry_date)}
                  />
                </FormSection>
              </div>
            );
          })()}

          {/* Campos extra: caución */}
          {form.instrument_type === "caucion" && (
            <div className="grid grid-cols-2 gap-3">
              <FormSection label="Tasa TNA (%)" error={errors.rate_tna} hint="Ej. 32,5">
                <Input
                  type="number"
                  value={form.rate_tna}
                  onChange={(v) => setField("rate_tna", v)}
                  placeholder="0,00"
                  step="any"
                  hasError={Boolean(errors.rate_tna)}
                />
              </FormSection>
              <FormSection label="Plazo (días)" error={errors.term_days} hint="Ej. 1, 7, 30">
                <Input
                  type="number"
                  value={form.term_days}
                  onChange={(v) => setField("term_days", v)}
                  placeholder="1"
                  step="1"
                  hasError={Boolean(errors.term_days)}
                />
              </FormSection>
            </div>
          )}

          {/* Campos extra: opción */}
          {form.instrument_type === "option" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormSection label="Tipo">
                  <Select
                    value={form.option_type}
                    onChange={(v) => setField("option_type", v)}
                    options={[
                      { value: "call", label: "Call" },
                      { value: "put", label: "Put" },
                    ]}
                  />
                </FormSection>
                <FormSection label="Strike" error={errors.strike}>
                  <Input
                    type="number"
                    value={form.strike}
                    onChange={(v) => setField("strike", v)}
                    placeholder="0,00"
                    step="any"
                    hasError={Boolean(errors.strike)}
                  />
                </FormSection>
              </div>
              <FormSection label="Vencimiento" error={errors.expiry}>
                <Input
                  type="date"
                  value={form.expiry}
                  onChange={(v) => setField("expiry", v)}
                  hasError={Boolean(errors.expiry)}
                />
              </FormSection>
            </>
          )}

          {/* Notas */}
          <FormSection label="Notas (opcional)">
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Cualquier comentario sobre esta operación..."
              rows={3}
              style={{
                width: "100%",
                backgroundColor: C.deep,
                border: `1px solid ${C.border}`,
                color: C.text,
                padding: "9px 12px",
                fontSize: 12.5,
                fontFamily: "'Roboto', sans-serif",
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
            />
          </FormSection>

          {/* Error general */}
          {errors._form && (
            <div
              className="flex items-center gap-2"
              style={{
                backgroundColor: "rgba(248,113,113,0.08)",
                border: `1px solid rgba(248,113,113,0.30)`,
                color: C.red,
                padding: "10px 12px",
                fontSize: 12,
                marginTop: 16,
              }}
            >
              <AlertTriangle size={13} strokeWidth={1.8} />
              <span>{errors._form}</span>
            </div>
          )}

          {/* Acciones (inline, justo después del contenido — estilo Balanz).
           *
           * Se ubican al final del body en vez de un footer fijo abajo: si
           * el form es chico los botones aparecen cerca del último campo
           * (no al fondo del drawer con un océano de espacio en blanco).
           * Si el form es largo, scrollean junto con el resto.
           */}
          <div
            className="flex items-center justify-end gap-2"
            style={{ marginTop: 24 }}
          >
            <button
              onClick={requestClose}
              disabled={submitting}
              style={{
                backgroundColor: "transparent",
                border: `1px solid ${C.border}`,
                color: C.muted,
                padding: "9px 16px",
                fontSize: 12.5,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "'Roboto', sans-serif",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                backgroundColor: C.accent,
                color: C.bg,
                border: "none",
                padding: "9px 18px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "'Roboto', sans-serif",
                opacity: submitting ? 0.7 : 1,
                minWidth: 110,
              }}
            >
              {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar posición"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


/* ─────────────── Form helpers (Inputs/Selects/Sections) ─────────────── */

function FormSection({ label, error, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 10.5,
          color: C.muted,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && !error && <FieldHint>{hint}</FieldHint>}
      {error && (
        <div style={{ fontSize: 10.5, color: C.red, marginTop: 4, letterSpacing: "0.01em" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function FieldHint({ children }) {
  return (
    <div style={{ fontSize: 10.5, color: C.dim, marginTop: 4, letterSpacing: "0.01em" }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", step, hasError }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      style={{
        width: "100%",
        backgroundColor: C.deep,
        border: `1px solid ${hasError ? C.red : C.border}`,
        color: C.text,
        padding: "9px 12px",
        fontSize: 12.5,
        fontFamily: type === "number" ? "'JetBrains Mono', monospace" : "'Roboto', sans-serif",
        outline: "none",
        transition: "border-color 120ms ease",
      }}
      onFocus={(e) => {
        if (!hasError) e.currentTarget.style.borderColor = C.accent;
      }}
      onBlur={(e) => {
        if (!hasError) e.currentTarget.style.borderColor = C.border;
      }}
    />
  );
}

function Select({ value, onChange, options, hasError, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%",
        backgroundColor: disabled ? "rgba(13,26,41,0.5)" : C.deep,
        border: `1px solid ${hasError ? C.red : C.border}`,
        color: disabled ? C.muted : C.text,
        padding: "9px 12px",
        fontSize: 12.5,
        fontFamily: "'Roboto', sans-serif",
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function ToggleButton({ active, onClick, children, color }) {
  const tint = color === "green" ? C.green : color === "red" ? C.red : C.accent;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        backgroundColor: active ? `${tint}1A` : C.deep,
        border: `1px solid ${active ? tint : C.border}`,
        color: active ? tint : C.muted,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontFamily: "'Roboto', sans-serif",
        transition: "all 120ms ease",
      }}
    >
      {children}
    </button>
  );
}




function EmptyWorkspace({ active }) {
  const item = flattenNav(NAV).find((i) => i.id === active);
  const Icon = item?.icon || Activity;
  const isDashboard = active === "dashboard";

  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 eco-fade-in">
        <div
          style={{
            width: 56,
            height: 56,
            border: `1px solid ${C.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            backgroundColor: C.panel,
            boxShadow: `0 0 24px ${C.accentGlow}`,
          }}
        >
          <Icon size={20} color={C.accent} strokeWidth={1.6} />
          <span style={{ position: "absolute", top: -1, left: -1, width: 5, height: 5, background: C.accent }} />
          <span style={{ position: "absolute", bottom: -1, right: -1, width: 5, height: 5, background: C.accent }} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span
            className="eco-display"
            style={{
              fontSize: 13,
              letterSpacing: "0.36em",
              color: C.text,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {item?.label || "Espacio de Trabajo"}
          </span>
          <span
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {isDashboard ? "Layout v1.0 — Esperando módulo" : "Módulo en construcción"}
          </span>
        </div>

        {isDashboard && (
          <div
            className="flex items-center"
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 16,
              marginTop: 4,
              width: 320,
              justifyContent: "space-between",
            }}
          >
            <Stat label="Sesión" value="Activa" />
            <Divider />
            <Stat label="Latencia" value="12 ms" mono />
            <Divider />
            <Stat label="Build" value="1.0.0" mono />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Compara Dólar Module ─────────── */



const STABLE_TABS = [
  { id: "ccl",  label: "USD CCL", accent: C.cat.yellow },
  { id: "usdt", label: "USDT",    accent: C.cat.emerald },
  { id: "usdc", label: "USDC",    accent: C.cat.violet },
];

const DOLLAR_TYPES = [
  { id: "oficial",   label: "Oficial",   apiKey: "oficial",         color: C.cat.cyan },
  { id: "mep",       label: "MEP",       apiKey: "bolsa",           color: C.cat.emerald },
  { id: "ccl",       label: "CCL",       apiKey: "contadoconliqui", color: C.cat.yellow },
  { id: "blue",      label: "Blue",      apiKey: "blue",            color: C.cat.violet },
  { id: "tarjeta",   label: "Tarjeta",   apiKey: "tarjeta",         color: C.cat.pink },
  { id: "mayorista", label: "Mayorista", apiKey: "mayorista",       color: C.cat.teal },
];

// Brechas a calcular: (numerador / denominador) − 1
const BRECHAS = [
  { num: "ccl",     den: "mep",     label: "CCL / MEP" },
  { num: "mep",     den: "oficial", label: "MEP / Oficial" },
  { num: "ccl",     den: "oficial", label: "CCL / Oficial" },
  { num: "blue",    den: "oficial", label: "Blue / Oficial" },
  { num: "tarjeta", den: "oficial", label: "Tarjeta / Oficial" },
  { num: "ccl",     den: "blue",    label: "CCL / Blue" },
];

const PROVIDER_COLORS = [
  C.cat.cyan, C.cat.emerald, C.cat.yellow, C.cat.pink, C.cat.violet,
  C.cat.orange, C.cat.teal, C.cat.lime, C.cat.rose, C.cat.amber, C.cat.indigo,
];

const colorForId = (id, idx = 0) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PROVIDER_COLORS[(h + idx) % PROVIDER_COLORS.length];
};

function ComparaDolarModule() {
  const [stableTab, setStableTab] = useState("ccl");
  const [direction, setDirection] = useState("buy");
  const [sortKey, setSortKey] = useState(null); // null = use direction default
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"
  const [usdData, setUsdData] = useState([]);
  const [stableData, setStableData] = useState({ ccl: [], usdt: [], usdc: [] });
  const [prevSnapshot, setPrevSnapshot] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [now, setNow] = useState(new Date());
  const [intervalMode, setIntervalMode] = useState(isActiveMarketWindow() ? "active" : "idle");

  useEffect(() => {
    const i = setInterval(() => {
      setNow(new Date());
      setIntervalMode(isActiveMarketWindow() ? "active" : "idle");
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const fetchAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (usdData.length === 0) setLoading(true);

    try {
      const snapshot = {};
      [...usdData, ...stableData.ccl, ...stableData.usdt, ...stableData.usdc].forEach((r) => {
        if (r.buy != null && r.sell != null) {
          snapshot[r.id] = { mid: (r.buy + r.sell) / 2 };
        }
      });

      const fiatRes = await fetch("/api/dolares");
      if (!fiatRes.ok) throw new Error("API dólares respondió " + fiatRes.status);
      const fiat = await fiatRes.json();

      const usdRows = DOLLAR_TYPES.map((t) => {
        const match = fiat.find(
          (d) => (d.casa || "").toLowerCase() === t.apiKey.toLowerCase(),
        );
        return {
          id: `usd-${t.id}`,
          typeId: t.id,
          name: t.label,
          color: t.color,
          buy: match?.compra ?? null,
          sell: match?.venta ?? null,
          updatedAt: match?.fechaActualizacion ? new Date(match.fechaActualizacion) : null,
        };
      });

      let usdtRows = [];
      try {
        const r = await fetch("/api/usdt");
        if (r.ok) {
          const j = await r.json();
          usdtRows = Object.entries(j)
            .filter(([_, v]) => v && typeof v === "object" && (v.totalAsk || v.ask))
            .map(([name, v]) => ({
              id: `usdt-${name}`,
              name: prettyExchange(name),
              buy: v.totalBid || v.bid || null,
              sell: v.totalAsk || v.ask || null,
              updatedAt: v.time ? new Date(v.time * 1000) : new Date(),
            }))
            .filter((r) => r.buy && r.sell);
        }
      } catch (e) { console.warn("USDT failed", e); }

      let usdcRows = [];
      try {
        const r = await fetch("/api/usdc");
        if (r.ok) {
          const j = await r.json();
          usdcRows = Object.entries(j)
            .filter(([_, v]) => v && typeof v === "object" && (v.totalAsk || v.ask))
            .map(([name, v]) => ({
              id: `usdc-${name}`,
              name: prettyExchange(name),
              buy: v.totalBid || v.bid || null,
              sell: v.totalAsk || v.ask || null,
              updatedAt: v.time ? new Date(v.time * 1000) : new Date(),
            }))
            .filter((r) => r.buy && r.sell);
        }
      } catch (e) { console.warn("USDC failed", e); }

      // CCL para tab "USD CCL" — usa el mismo dato fiat de dolarapi (un solo proveedor por ahora)
      const cclMatch = fiat.find(
        (d) => (d.casa || "").toLowerCase() === "contadoconliqui",
      );
      const cclRows = cclMatch
        ? [
            {
              id: `ccl-${cclMatch.casa}`,
              name: cclMatch.nombre || "CCL",
              buy: cclMatch.compra ?? null,
              sell: cclMatch.venta ?? null,
              updatedAt: cclMatch.fechaActualizacion ? new Date(cclMatch.fechaActualizacion) : null,
            },
          ].filter((r) => r.buy && r.sell)
        : [];

      setUsdData(usdRows);
      setStableData({ ccl: cclRows, usdt: usdtRows, usdc: usdcRows });
      if (Object.keys(snapshot).length > 0) setPrevSnapshot(snapshot);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || "Error al cargar cotizaciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timeoutId;
    const schedule = () => {
      const ms = getRefreshIntervalMs();
      timeoutId = setTimeout(() => { fetchAll(); schedule(); }, ms);
    };
    schedule();
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMode]);

  // Enriquecer USD con var
  const enrichedUsd = usdData.map((r) => {
    const mid = r.buy != null && r.sell != null ? (r.buy + r.sell) / 2 : null;
    const prev = prevSnapshot[r.id];
    const variation = mid != null && prev?.mid ? ((mid - prev.mid) / prev.mid) * 100 : null;
    return { ...r, mid, variation };
  });

  // Map por typeId para cálculo de brechas
  const usdByType = Object.fromEntries(enrichedUsd.map((r) => [r.typeId, r]));
  const brechaRows = BRECHAS.map((b) => {
    const num = usdByType[b.num];
    const den = usdByType[b.den];
    const numMid = num?.mid;
    const denMid = den?.mid;
    const value = numMid != null && denMid != null && denMid !== 0
      ? ((numMid - denMid) / denMid) * 100
      : null;
    return { ...b, value };
  });

  // Active stable rows
  const activeStable = (stableData[stableTab] || []).map((r, idx) => {
    const mid = r.buy != null && r.sell != null ? (r.buy + r.sell) / 2 : null;
    const prev = prevSnapshot[r.id];
    const variation = mid != null && prev?.mid ? ((mid - prev.mid) / prev.mid) * 100 : null;
    const spreadPct = r.buy != null && r.sell != null && r.buy ? ((r.sell - r.buy) / r.buy) * 100 : null;
    return { ...r, mid, variation, spreadPct, color: colorForId(r.id, idx) };
  });

  // Click en header: si era la misma columna, invierte dirección. Si es nueva, usa default según columna.
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default por columna: "buy" y "sell" desc (más alto primero); "spread"/"var" asc
      setSortDir(key === "buy" || key === "sell" ? "desc" : "asc");
    }
  };

  const sortedStable = [...activeStable].sort((a, b) => {
    // Sort manual tiene prioridad
    if (sortKey) {
      const fieldMap = { buy: "buy", sell: "sell", spread: "spreadPct", var: "spreadPct" };
      const field = fieldMap[sortKey];
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    // Sin sort manual: ordena según direction (default original)
    if (direction === "buy") {
      if (a.sell == null) return 1;
      if (b.sell == null) return -1;
      return a.sell - b.sell;
    }
    if (a.buy == null) return 1;
    if (b.buy == null) return -1;
    return b.buy - a.buy;
  });

  const validBuys = activeStable.filter((r) => r.buy != null);
  const validSells = activeStable.filter((r) => r.sell != null);
  const bestForSelling = validBuys.length ? validBuys.reduce((a, b) => (a.buy >= b.buy ? a : b)) : null;
  const bestForBuying = validSells.length ? validSells.reduce((a, b) => (a.sell <= b.sell ? a : b)) : null;
  const lowestSpread = activeStable
    .filter((r) => r.spreadPct != null)
    .reduce((acc, r) => (acc == null || r.spreadPct < acc.spreadPct ? r : acc), null);

  const isStale = lastFetch && (now - lastFetch) / 1000 > (intervalMode === "active" ? 1080 : 2100);

  return (
    <div className="px-6 py-5 eco-fade-in" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5">
        <div className="flex flex-col gap-1.5">
          <span
            style={{
              fontSize: 9,
              color: C.dim,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Analizadores · Cotizaciones Dólar
          </span>
          <h1
            className="eco-display"
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: C.text,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Cotizaciones Dólar
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <StatusPill error={error} loading={loading || refreshing} isStale={isStale} lastFetch={lastFetch} now={now} />
          <RefreshButton onClick={() => fetchAll(true)} spinning={refreshing} />
        </div>
      </div>

      {/* Error inline */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 mb-5"
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.08)",
            border: `1px solid rgba(248, 113, 113, 0.25)`,
          }}
        >
          <AlertTriangle size={16} color={C.red} strokeWidth={1.8} />
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
              No se pudieron cargar las cotizaciones
            </span>
            <span style={{ fontSize: 11, color: C.muted }}>{error}</span>
          </div>
        </div>
      )}

      {/* Sección 1: TIPOS DE DÓLAR */}
      <SectionLabel>Tipos de Dólar</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {enrichedUsd.map((row) => (
          <DolarTypeCard key={row.id} row={row} loading={loading} />
        ))}
      </div>

      {/* Brecha card */}
      <BrechaCard rows={brechaRows} loading={loading} />

      {/* Divider */}
      <div className="my-7" style={{ height: 1, backgroundColor: C.border }} />

      {/* Sección 2: Por Exchange */}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <StableTabs
          value={stableTab}
          onChange={(t) => { setStableTab(t); setSortKey(null); }}
        />
        <span style={{ width: 1, height: 26, backgroundColor: C.border }} />
        <DirectionTabs value={direction} onChange={setDirection} />
        <div className="flex-1" />
        <span
          style={{
            fontSize: 10,
            color: C.dim,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {sortedStable.length} {stableTab === "ccl" ? (sortedStable.length === 1 ? "fuente" : "fuentes") : "exchanges"}
        </span>
      </div>

      {/* 3 best cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <BestCard
          icon={ArrowDown}
          iconColor={C.green}
          label="Mejor para Comprar"
          provider={bestForBuying}
          priceLabel="Comprás a"
          priceField="sell"
          valueColor={C.green}
          accentTop={C.green}
        />
        <BestCard
          icon={ArrowUp}
          iconColor={C.red}
          label="Mejor para Vender"
          provider={bestForSelling}
          priceLabel="Vendés a"
          priceField="buy"
          valueColor={C.red}
          accentTop={C.red}
        />
        <BestCard
          icon={Activity}
          iconColor={C.cat.yellow}
          label="Menor Spread"
          provider={lowestSpread}
          priceLabel="Compra/Venta"
          priceField="spreadPct"
          valueColor={C.cat.yellow}
          accentTop={C.cat.yellow}
          isPercent
          subValue={
            lowestSpread && lowestSpread.buy != null && lowestSpread.sell != null
              ? `· $${fmtARS(lowestSpread.sell - lowestSpread.buy)}`
              : null
          }
        />
      </div>

      {/* Ranking card */}
      <RankingCard
        title={stableTab === "ccl" ? "Ranking de Fuentes" : "Ranking de Exchanges"}
        subtitle={
          sortKey
            ? `Ordenado por ${
                { buy: "Vendés a", sell: "Comprás a", spread: "Spread", var: "Var" }[sortKey]
              } (${sortDir === "asc" ? "menor a mayor" : "mayor a menor"})`
            : direction === "buy"
            ? "Ordenado por menor venta (te lo venden más barato)"
            : "Ordenado por mayor compra (te pagan más por venderlo)"
        }
        rows={sortedStable}
        loading={loading && sortedStable.length === 0}
        bestForBuying={bestForBuying}
        bestForSelling={bestForSelling}
        direction={direction}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        accentTop={C.cat.pink}
      />

      {/* Footer */}
      <div
        className="flex flex-wrap items-center gap-2 mt-5"
        style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase" }}
      >
        <span>fuentes:</span>
        <span style={{ color: C.muted }}>dolarapi.com</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>criptoya.com</span>
        <span style={{ color: C.faint }}>·</span>
        <span>auto-refresh:</span>
        <span style={{ color: C.muted }}>
          {intervalMode === "active" ? "15 min · horario hábil" : "30 min · fuera de horario"}
        </span>
        <span style={{ color: C.faint }}>·</span>
        <span>última act:</span>
        <span style={{ color: C.muted }}>{timeAgo(lastFetch, now)}</span>
      </div>
    </div>
  );
}

/* ─────────── Helpers de display ─────────── */

function prettyExchange(name) {
  const map = {
    binance: "Binance", binancep2p: "Binance P2P", bitso: "Bitso",
    buenbit: "Buenbit", letsbit: "Letsbit", lemoncash: "Lemon",
    fiwind: "Fiwind", ripio: "Ripio", satoshitango: "SatoshiTango",
    decrypto: "Decrypto", belo: "Belo", cocoscrypto: "Cocos Crypto",
    saldo: "Saldo", trubit: "TruBit", tiendacrypto: "TiendaCrypto",
    cryptomkt: "CryptoMKT", paydece: "Paydece", calypso: "Calypso",
    eluter: "Eluter", takenos: "Takenos", vibrant: "Vibrant",
    paxful: "Paxful", coinex: "CoinEx", bingx: "BingX",
    plus: "Plus", reba: "Reba", uala: "Ualá", cocos: "Cocos",
  };
  const k = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return map[k] || name.charAt(0).toUpperCase() + name.slice(1);
}

/* ─────────── Subcomponentes ─────────── */

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="eco-display"
        style={{
          fontSize: 11,
          color: C.text,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {children}
      </span>
      <span style={{ flex: 1, height: 1, backgroundColor: C.border }} />
    </div>
  );
}

function DolarTypeCard({ row, loading }) {
  const hasData = row.buy != null && row.sell != null;
  const variation = row.variation;

  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${row.color}`,
        padding: "13px 14px",
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="eco-display"
          style={{
            fontSize: 13,
            color: row.color,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {row.name}
        </span>
        {variation != null && (
          <span
            className="flex items-center gap-1"
            style={{
              fontSize: 10,
              color: variation >= 0 ? C.green : C.red,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {variation >= 0 ? <ArrowUp size={9} strokeWidth={2.5} /> : <ArrowDown size={9} strokeWidth={2.5} />}
            {variation >= 0 ? "+" : ""}
            {variation.toFixed(2)}%
          </span>
        )}
      </div>

      {loading && !hasData ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 size={14} color={C.dim} className="eco-spin" strokeWidth={1.8} />
        </div>
      ) : hasData ? (
        <div className="grid grid-cols-2 gap-2 flex-1">
          <PriceBlock label="Compra" value={row.buy} />
          <PriceBlock label="Venta" value={row.sell} />
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1" style={{ color: C.dim, fontSize: 11 }}>
          —
        </div>
      )}
    </div>
  );
}

function PriceBlock({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontSize: 9,
          color: C.dim,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {label}
      </span>
      <span
        className="eco-mono"
        style={{
          fontSize: 16,
          color: C.text,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          lineHeight: 1.1,
        }}
      >
        ${fmtARS(value)}
      </span>
    </div>
  );
}

function BrechaCard({ rows, loading }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${C.cat.orange}`,
        padding: "14px 18px",
      }}
    >
      <CardHeader icon={Diff} iconColor={C.cat.orange} label="Brecha Cambiaria" />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={14} color={C.dim} className="eco-spin" strokeWidth={1.8} />
        </div>
      ) : (
        <div
          className="grid gap-x-6 gap-y-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {rows.map((b, i) => (
            <BrechaRow key={i} label={b.label} value={b.value} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrechaRow({ label, value }) {
  // Color por magnitud: <5% verde, 5-30% yellow, >30% red
  let color = C.muted;
  if (value != null) {
    const abs = Math.abs(value);
    if (abs < 5) color = C.green;
    else if (abs < 30) color = C.cat.yellow;
    else color = C.red;
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span
        style={{
          fontSize: 11.5,
          color: C.muted,
          letterSpacing: "0.02em",
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {label}
      </span>
      <span
        className="eco-mono"
        style={{
          fontSize: 13,
          color: color,
          fontWeight: 600,
          letterSpacing: "0.01em",
        }}
      >
        {value != null ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"}
      </span>
    </div>
  );
}

function CardHeader({ icon: Icon, iconColor, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} color={iconColor} strokeWidth={2.2} />
      <span
        style={{
          fontSize: 9.5,
          color: C.text,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          fontWeight: 500,
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function BestCard({ icon, iconColor, label, provider, priceLabel, priceField, valueColor, accentTop, isPercent, subValue }) {
  const value = provider
    ? isPercent
      ? `${provider[priceField]?.toFixed(2)}%`
      : `$${fmtARS(provider[priceField])}`
    : "—";

  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${accentTop}`,
        padding: "16px 18px",
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardHeader icon={icon} iconColor={iconColor} label={label} />

      {provider ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <ProviderAvatar name={provider.name} color={provider.color} size={20} />
            <span
              className="eco-display"
              style={{
                fontSize: 17,
                color: valueColor,
                fontWeight: 700,
                letterSpacing: "-0.005em",
              }}
            >
              {provider.name}
            </span>
          </div>

          <span
            style={{
              fontSize: 10,
              color: C.dim,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
              fontFamily: "'Roboto', sans-serif",
            }}
          >
            {priceLabel}
          </span>

          <div className="mt-auto pt-2 flex items-baseline gap-2 flex-wrap">
            <div
              className="eco-mono"
              style={{
                fontSize: 24,
                color: valueColor,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.05,
              }}
            >
              {value}
            </div>
            {subValue && (
              <div
                className="eco-mono"
                style={{
                  fontSize: 13,
                  color: C.muted,
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                {subValue}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1" style={{ color: C.dim, fontSize: 12 }}>
          —
        </div>
      )}
    </div>
  );
}

function ProviderAvatar({ name, color, size = 18 }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        color: C.bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: "'Roboto', sans-serif",
      }}
    >
      {letter}
    </span>
  );
}

function StableTabs({ value, onChange }) {
  return (
    <div className="inline-flex gap-1.5">
      {STABLE_TABS.map((t) => (
        <PillButton
          key={t.id}
          active={value === t.id}
          onClick={() => onChange(t.id)}
          label={t.label}
          activeColor={t.accent}
        />
      ))}
    </div>
  );
}

function DirectionTabs({ value, onChange }) {
  return (
    <div className="inline-flex gap-1.5">
      <PillButton
        active={value === "sell"}
        onClick={() => onChange("sell")}
        label="Mejor Compra"
        activeColor={C.accent}
      />
      <PillButton
        active={value === "buy"}
        onClick={() => onChange("buy")}
        label="Mejor Venta"
        activeColor={C.accent}
      />
    </div>
  );
}

function PillButton({ active, onClick, label, activeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        backgroundColor: active ? `${activeColor}1F` : C.deep,
        color: active ? activeColor : C.muted,
        border: `1px solid ${active ? activeColor + "55" : C.border}`,
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.04em",
        cursor: "pointer",
        transition: "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        fontFamily: "'Roboto', sans-serif",
        borderRadius: 4,
      }}
    >
      {label}
    </button>
  );
}

function StatusPill({ error, loading, isStale, lastFetch, now }) {
  let dotColor = C.green;
  let dotClass = "eco-dot-green";
  let label = "Live";

  if (error) {
    dotColor = C.red;
    dotClass = "eco-dot-red";
    label = "Error";
  } else if (loading) {
    dotColor = C.yellow;
    dotClass = "";
    label = "Cargando…";
  } else if (isStale) {
    dotColor = C.yellow;
    dotClass = "";
    label = "Desactualizado";
  }

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5"
      style={{ backgroundColor: C.deep, border: `1px solid ${C.border}`, borderRadius: 4 }}
    >
      <span
        className={dotClass}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: dotColor,
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 10.5, color: C.text, letterSpacing: "0.04em", fontWeight: 500, fontFamily: "'Roboto', sans-serif" }}>
        {label}
      </span>
      <span style={{ width: 1, height: 11, backgroundColor: C.border }} />
      <span className="eco-mono" style={{ fontSize: 10, color: C.muted, letterSpacing: "0.02em" }}>
        {timeAgo(lastFetch, now)}
      </span>
    </div>
  );
}

function RefreshButton({ onClick, spinning }) {
  return (
    <button
      onClick={onClick}
      disabled={spinning}
      className="eco-refresh-btn flex items-center gap-2 px-3 py-1.5"
      style={{
        backgroundColor: C.accentSoft,
        border: `1px solid ${C.accentBorder}`,
        color: C.accent,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        cursor: spinning ? "not-allowed" : "pointer",
        opacity: spinning ? 0.7 : 1,
        fontFamily: "'Roboto', sans-serif",
        borderRadius: 4,
      }}
    >
      <RefreshCw
        size={12}
        strokeWidth={2}
        style={{ animation: spinning ? "ecoSpin 0.9s linear infinite" : "none" }}
      />
      Refresh
    </button>
  );
}

/**
 * UserMenu — slot del navbar para login/logout y datos del usuario.
 *
 * Tres estados visuales:
 *   1. loading           → mientras Supabase resuelve la sesión (esqueleto)
 *   2. no autenticado    → botón "Entrar" minimalista
 *   3. autenticado       → avatar (iniciales o foto Google) + dropdown
 *                          con email + botón Cerrar sesión
 *
 * Este componente NO requiere props — consume directamente del AuthContext.
 * Asume que <AuthProvider> envuelve toda la app (ver main.jsx).
 *
 * Decisión de diseño: mantener el ancho/alto del antiguo placeholder "EF"
 * para no shiftear el resto del navbar entre estados. El avatar es 30x30
 * con borde sutil; el dropdown se renderiza absolutamente posicionado
 * abajo a la derecha para no afectar el layout horizontal.
 */
function UserMenu() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Cerrar el dropdown al hacer click afuera
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      // Si el click está dentro del menú, no cerramos. El menú tiene la clase
      // eco-user-menu-root que evaluamos en closest().
      if (!e.target.closest?.(".eco-user-menu-root")) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleLogin = async () => {
    setActioning(true);
    try {
      await signInWithGoogle();
      // El redirect de Google se va a llevar al user fuera de la app, no
      // hay que setActioning(false) — al volver, el componente se re-monta.
    } catch (e) {
      setActioning(false);
    }
  };

  const handleLogout = async () => {
    setActioning(true);
    try {
      await signOut();
      setOpen(false);
    } catch {} finally {
      setActioning(false);
    }
  };

  // ── Estado 1: loading (esqueleto del mismo tamaño que avatar) ──
  if (loading) {
    return (
      <div
        style={{
          width: 30,
          height: 30,
          border: `1px solid ${C.borderStrong}`,
          backgroundColor: C.panel,
          opacity: 0.4,
        }}
      />
    );
  }

  // ── Estado 2: no autenticado (botón Entrar minimalista) ──
  if (!user) {
    return (
      <button
        onClick={handleLogin}
        disabled={actioning}
        title="Iniciar sesión con Google"
        className="flex items-center gap-2"
        style={{
          backgroundColor: C.accentSoft,
          border: `1px solid ${C.accentBorder}`,
          color: C.accent,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.04em",
          padding: "6px 12px",
          cursor: actioning ? "not-allowed" : "pointer",
          opacity: actioning ? 0.7 : 1,
          fontFamily: "'Roboto', sans-serif",
          borderRadius: 4,
        }}
      >
        <LogIn size={12} strokeWidth={2} />
        {actioning ? "Conectando..." : "Entrar"}
      </button>
    );
  }

  // ── Estado 3: autenticado ──
  // Calculamos iniciales como fallback si no hay foto.
  const displayName = user.user_metadata?.full_name || user.email || "Usuario";
  const email = user.email || "";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="eco-user-menu-root" style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        style={{
          width: 30,
          height: 30,
          border: `1px solid ${open ? C.accent : C.borderStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          letterSpacing: "0.05em",
          fontWeight: 700,
          color: C.text,
          backgroundColor: C.panel,
          cursor: "pointer",
          padding: 0,
          overflow: "hidden",
          transition: "border-color 120ms ease",
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span className="eco-display">{initials || "?"}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 240,
            backgroundColor: C.panel,
            border: `1px solid ${C.borderStrong}`,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            zIndex: 50,
            fontFamily: "'Roboto', sans-serif",
          }}
        >
          {/* Header del dropdown: nombre + email */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.3 }}>
              {displayName}
            </div>
            {email && email !== displayName && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.3, wordBreak: "break-all" }}>
                {email}
              </div>
            )}
          </div>

          {/* Acciones */}
          <button
            onClick={handleLogout}
            disabled={actioning}
            className="flex items-center gap-2.5 w-full"
            style={{
              padding: "10px 14px",
              backgroundColor: "transparent",
              border: "none",
              color: C.muted,
              fontSize: 12,
              cursor: actioning ? "not-allowed" : "pointer",
              textAlign: "left",
              fontFamily: "'Roboto', sans-serif",
              transition: "background-color 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = C.deep;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = C.muted;
            }}
          >
            <LogOut size={13} strokeWidth={1.8} />
            {actioning ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}

function RankingCard({ title, subtitle, rows, loading, bestForBuying, bestForSelling, direction, sortKey, sortDir, onSort, accentTop }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${accentTop}`,
        padding: "16px 18px",
      }}
    >
      <CardHeader icon={BarChart3} iconColor={accentTop} label={title} />
      <p
        style={{
          fontSize: 11,
          color: C.muted,
          letterSpacing: "0.02em",
          marginTop: -4,
          marginBottom: 14,
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {subtitle}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={18} color={C.accent} className="eco-spin" strokeWidth={1.8} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-12" style={{ color: C.muted, fontSize: 12 }}>
          Sin datos disponibles
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <Th align="left" width={36}>#</Th>
                <Th align="left">Proveedor</Th>
                <Th align="right" sortable sortKey="buy"
                    activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}
                    emphasized={direction === "sell" && !sortKey}>Vendés a</Th>
                <Th align="right" sortable sortKey="sell"
                    activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}
                    emphasized={direction === "buy" && !sortKey}>Comprás a</Th>
                <Th align="right" sortable sortKey="spread"
                    activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>Spread</Th>
                <Th align="right" sortable sortKey="var"
                    activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>Var</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isBestBuy = bestForSelling && row.id === bestForSelling.id;
                const isBestSell = bestForBuying && row.id === bestForBuying.id;
                const buyHi = direction === "sell" && isBestBuy;
                const sellHi = direction === "buy" && isBestSell;
                return (
                  <tr key={row.id} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <Td align="left" mono>
                      <span style={{ color: C.dim, fontSize: 11 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </Td>
                    <Td align="left">
                      <div className="flex items-center gap-2.5">
                        <ProviderAvatar name={row.name} color={row.color} size={20} />
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {row.name}
                        </span>
                      </div>
                    </Td>
                    <Td align="right" mono highlighted={buyHi}>
                      {row.buy != null ? `$${fmtARS(row.buy)}` : "—"}
                    </Td>
                    <Td align="right" mono highlighted={sellHi}>
                      {row.sell != null ? `$${fmtARS(row.sell)}` : "—"}
                    </Td>
                    <Td align="right" mono>
                      {row.buy != null && row.sell != null ? (
                        <span style={{ color: C.muted }}>${fmtARS(row.sell - row.buy)}</span>
                      ) : "—"}
                    </Td>
                    <Td align="right" mono>
                      {row.spreadPct != null ? (
                        <span style={{ color: C.muted }}>{row.spreadPct.toFixed(2)}%</span>
                      ) : (
                        <span style={{ color: C.dim }}>—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align, emphasized, width, sortable, sortKey, activeSortKey, sortDir, onSort }) {
  const isActive = sortable && activeSortKey === sortKey;
  const color = isActive ? C.accent : emphasized ? C.accent : C.dim;
  const indicator = isActive ? (sortDir === "asc" ? "▲" : "▼") : sortable ? "↕" : null;

  return (
    <th
      onClick={sortable ? () => onSort(sortKey) : undefined}
      className={sortable ? "eco-th-sortable" : ""}
      style={{
        padding: "10px 14px",
        textAlign: align,
        fontSize: 9,
        color: color,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        fontWeight: 600,
        fontFamily: "'Roboto', sans-serif",
        width: width,
        cursor: sortable ? "pointer" : "default",
        userSelect: "none",
        transition: "color 0.15s ease",
      }}
    >
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
      }}>
        {children}
        {indicator && (
          <span style={{
            fontSize: 8,
            opacity: isActive ? 1 : 0.45,
            letterSpacing: 0,
          }}>{indicator}</span>
        )}
      </span>
    </th>
  );
}

function Td({ children, align, mono, highlighted }) {
  return (
    <td
      style={{
        padding: "13px 14px",
        textAlign: align,
        fontSize: 12.5,
        color: highlighted ? C.accent : C.text,
        fontWeight: highlighted ? 600 : 400,
        fontFamily: mono
          ? "'JetBrains Mono', 'Roboto Mono', ui-monospace, monospace"
          : "'Roboto', sans-serif",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
        letterSpacing: mono ? "0.02em" : "normal",
      }}
    >
      {children}
    </td>
  );
}

/* ─────────── Carry Trade Module ─────────── */

// Banda BCRA: arrancó 14/04/2025, piso=$1000 / techo=$1400, crawling peg ±1%/mes
// Hasta 31/12/2025 evoluciona con crawling peg fijo del 1% mensual.
// Desde 01/01/2026 evoluciona según inflación T-2 del REM.
const BAND_START_DATE = "2025-04-14";
const BAND_START_FLOOR = 1000;
const BAND_START_CEILING = 1400;
const BAND_CRAWL_RATE_MONTHLY = 0.01; // 1% mensual hasta 31/12/2025

const CARRY_MODES = [
  {
    id: "byDollar",
    label: "Por Dólar",
    sublabel: "Equilibrio vs Oficial · MEP · Blue · CCL",
    icon: Coins,
    color: "#5B8DD6",       // accent (azul-axon-light)
    soft: "rgba(91, 141, 214, 0.12)",
    border: "rgba(91, 141, 214, 0.45)",
  },
  {
    id: "byBands",
    label: "Bandas BCRA + REM",
    sublabel: "Escenarios Piso · REM · Techo",
    icon: Landmark,
    color: "#FACC15",       // yellow
    soft: "rgba(250, 204, 21, 0.12)",
    border: "rgba(250, 204, 21, 0.45)",
  },
  {
    id: "manual",
    label: "Dólar Manual",
    sublabel: "Ingresá tu propio escenario",
    icon: Pencil,
    color: "#F472B6",       // pink
    soft: "rgba(244, 114, 182, 0.12)",
    border: "rgba(244, 114, 182, 0.45)",
  },
];

const SCENARIOS = [
  { id: "floor",   label: "Piso BCRA",   color: C.green,  desc: "Optimista — peso se aprecia al piso" },
  { id: "rem",     label: "REM",         color: C.accent, desc: "Realista — proyección REM (BCRA)" },
  { id: "ceiling", label: "Techo BCRA",  color: C.red,    desc: "Conservador — peso al techo" },
];

/**
 * Calcula el valor de la banda (piso o techo) a una fecha dada.
 */
function projectBand(targetDate, boundary, remIpcByMonth = {}) {
  const start = new Date(BAND_START_DATE + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  if (target <= start) return boundary === "floor" ? BAND_START_FLOOR : BAND_START_CEILING;

  let value = boundary === "floor" ? BAND_START_FLOOR : BAND_START_CEILING;

  let cursor = new Date(start);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);

  while (cursor <= target) {
    const y = cursor.getFullYear();
    let rate;
    if (y < 2026) {
      rate = boundary === "floor" ? -BAND_CRAWL_RATE_MONTHLY : BAND_CRAWL_RATE_MONTHLY;
    } else {
      const ipcCursor = new Date(cursor);
      ipcCursor.setMonth(ipcCursor.getMonth() - 2);
      const ipcKey = `${ipcCursor.getFullYear()}-${String(ipcCursor.getMonth() + 1).padStart(2, "0")}`;
      const ipc = remIpcByMonth[ipcKey];
      const monthlyInfl = ipc != null ? ipc / 100 : 0.02;
      rate = boundary === "floor" ? -monthlyInfl : monthlyInfl;
    }
    value = value * (1 + rate);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return value;
}

function projectREMTC(targetDate, remTcByMonth = {}) {
  const target = new Date(targetDate + "T00:00:00");
  const targetYM = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  if (remTcByMonth[targetYM] != null) return remTcByMonth[targetYM];
  const sortedKeys = Object.keys(remTcByMonth).sort();
  let lastBefore = null;
  for (const k of sortedKeys) {
    if (k <= targetYM) lastBefore = k;
  }
  return lastBefore ? remTcByMonth[lastBefore] : null;
}

function CarryTradeModule() {
  const [mode, setMode] = useState("byDollar");
  const [bondsRaw, setBondsRaw] = useState([]);
  const [remTc, setRemTc] = useState({});
  const [remIpc, setRemIpc] = useState({});
  const [fxRates, setFxRates] = useState({}); // { oficial, blue, mep, ccl }
  const [scenario, setScenario] = useState("ceiling");
  const [manualUsd, setManualUsd] = useState(""); // input modo manual
  const [usdAmount, setUsdAmount] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [now, setNow] = useState(new Date());
  const [intervalMode, setIntervalMode] = useState(isActiveMarketWindow() ? "active" : "idle");

  useEffect(() => {
    const i = setInterval(() => {
      setNow(new Date());
      setIntervalMode(isActiveMarketWindow() ? "active" : "idle");
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const fetchAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (bondsRaw.length === 0) setLoading(true);

    try {
      // 1) Bonos (data912 /arg_bonds) + Letras (data912 /arg_notes) en paralelo
      const [bondsRes, letrasRes] = await Promise.all([
        fetch("/api/bonos"),
        fetch("/api/letras"),
      ]);
      if (!bondsRes.ok) throw new Error("API bonos respondió " + bondsRes.status);

      const bonds = await bondsRes.json();
      let letras = [];
      if (letrasRes.ok) {
        letras = await letrasRes.json();
      } else {
        console.warn("API letras falló:", letrasRes.status);
      }

      // Merge — prioriza letras si hay duplicados (caso raro)
      const seen = new Set();
      const combined = [];
      for (const item of [...letras, ...bonds]) {
        if (item?.symbol && !seen.has(item.symbol)) {
          seen.add(item.symbol);
          combined.push(item);
        }
      }
      setBondsRaw(combined);

      // 2) Cotizaciones FX desde dolarapi
      try {
        const fxRes = await fetch("/api/dolares");
        if (fxRes.ok) {
          const fx = await fxRes.json();
          const rates = {};
          fx.forEach((d) => {
            const casa = (d.casa || "").toLowerCase();
            if (casa === "oficial") rates.oficial = d.venta;
            else if (casa === "blue") rates.blue = d.venta;
            else if (casa === "bolsa") rates.mep = d.venta;
            else if (casa === "contadoconliqui") rates.ccl = d.venta;
          });
          setFxRates(rates);
        }
      } catch (e) { console.warn("FX fetch failed", e); }

      // 3) REM tipo de cambio
      try {
        const remRes = await fetch("/api/rem-tipo-cambio");
        if (remRes.ok) {
          const remData = await remRes.json();
          const map = {};
          (remData.datos || []).forEach((d) => {
            if (d.periodo && d.mediana != null) map[d.periodo] = d.mediana;
          });
          setRemTc(map);
        }
      } catch (e) { console.warn("REM tipo_cambio failed", e); }

      // 4) REM IPC
      try {
        const ipcRes = await fetch("/api/rem-ipc");
        if (ipcRes.ok) {
          const ipcData = await ipcRes.json();
          const map = {};
          (ipcData.datos || []).forEach((d) => {
            if (d.periodo && d.mediana != null) map[d.periodo] = d.mediana;
          });
          setRemIpc(map);
        }
      } catch (e) { console.warn("REM ipc_general failed", e); }

      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    let timeoutId;
    const schedule = () => {
      const ms = getRefreshIntervalMs();
      timeoutId = setTimeout(() => { fetchAll(); schedule(); }, ms);
    };
    schedule();
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line
  }, [intervalMode]);

  // Procesamiento base de bonos: filtra Lecaps/Boncaps + agrega métricas comunes
  const processedBonds = useMemo(() => {
    if (bondsRaw.length === 0) return [];

    // Diagnóstico para consola del navegador
    const accepted = [];
    const rejectedNoMap = [];
    const rejectedExpired = [];
    const rejectedNoPrice = [];
    let ignoredCount = 0;

    const result = bondsRaw
      .map((row) => {
        const ticker = row.symbol;

        // Filtro silencioso: ignorar ruido (AE, AL, GD, X*, etc.)
        if (shouldIgnoreTicker(ticker)) { ignoredCount++; return null; }

        const resolved = resolveBond(ticker);
        if (!resolved) { rejectedNoMap.push(ticker); return null; }

        const days = daysToMaturity(resolved.maturityDate);
        if (days <= 0) { rejectedExpired.push(ticker); return null; }

        const priceArs = (row.px_ask || row.c) ? (row.px_ask || row.c) : null;
        if (!priceArs || priceArs <= 0) { rejectedNoPrice.push(ticker); return null; }

        accepted.push(ticker);

        // Pago final del bono: si está en el registry usamos el dato real (verificado en
        // rendimientos.co), sino fallback a $100 VN (aproximación que subestima el rendimiento).
        const valorFinal = resolved.finalPayoff ?? 100;
        const hasFinalPayoff = resolved.finalPayoff != null;

        const roiArs = valorFinal / priceArs - 1;
        const tirAnual = Math.pow(1 + roiArs, 365 / days) - 1;
        const tem = Math.pow(1 + roiArs, 30 / days) - 1;
        const tea = Math.pow(1 + tem, 12) - 1;

        return {
          ticker, type: resolved.type, source: resolved.source,
          maturityDate: resolved.maturityDate, days, priceArs, valorFinal,
          hasFinalPayoff, roiArs, tirAnual, tem, tea,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days);

    if (typeof window !== "undefined") {
      console.log("🔍 [Carry Trade] Diagnóstico de bonos:", {
        totalRecibidos: bondsRaw.length,
        ignoradosRuido: ignoredCount,
        aceptados: accepted,
        rechazadosSinMapa: rejectedNoMap,
        rechazadosVencidos: rejectedExpired,
        rechazadosSinPrecio: rejectedNoPrice,
      });
    }

    return result;
  }, [bondsRaw]);

  // Bonos separados por tipo (para tablas separadas en modo "Por Dólar")
  const lecaps = processedBonds.filter((b) => b.type === "lecap");
  const boncaps = processedBonds.filter((b) => b.type === "boncap");

  // Cálculo del dólar de equilibrio
  // Eq = dolar_actual × (valorFinal / priceArs)
  const equilibriumFor = (bond, fxNow) => {
    if (!fxNow || !bond) return null;
    return fxNow * (bond.valorFinal / bond.priceArs);
  };

  // Carry vs MEP: ROI USD asumiendo que el MEP al vencimiento queda igual al actual
  // Es el caso "optimista" pero el más legible para evaluar de un vistazo si el bono carrye bien.
  // Fórmula: ROI USD = (1 + ROI_ARS) × (MEP_actual / MEP_futuro) - 1
  // Como asumimos MEP_futuro = MEP_actual: ROI USD = ROI_ARS  (con esa cotización fija)
  // Pero seguimos la fórmula completa por consistencia con los otros modos.
  const carryVsMep = (bond) => {
    const mepNow = fxRates.mep;
    if (!mepNow || !bond) return null;
    const arsAtMaturity = mepNow * (1 + bond.roiArs); // ARS por cada $1 USD invertido (a MEP actual)
    return (arsAtMaturity / mepNow) / 1 - 1; // = ROI_ARS, expresado claro
  };

  // Para Modo Bandas: dólar de salida según escenario
  const exitFxByScenario = (bond) => ({
    floor: projectBand(bond.maturityDate, "floor", remIpc),
    ceiling: projectBand(bond.maturityDate, "ceiling", remIpc),
    rem: projectREMTC(bond.maturityDate, remTc),
  });

  // ROI USD = (capital_final_ARS / dolar_salida) / capital_inicial_USD - 1
  const roiUsd = (bond, exitFx, mepEntry) => {
    if (!exitFx || !mepEntry) return null;
    const arsInvested = usdAmount * mepEntry;
    const arsAtMaturity = arsInvested * (1 + bond.roiArs);
    return (arsAtMaturity / exitFx) / usdAmount - 1;
  };

  const isStale = lastFetch && (now - lastFetch) / 1000 > (intervalMode === "active" ? 1080 : 2100);
  const activeMode = CARRY_MODES.find((m) => m.id === mode);

  return (
    <div className="px-6 py-5 eco-fade-in" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500 }}>
            Analizadores · Carry Trade
          </span>
          <h1 className="eco-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: C.text, lineHeight: 1.1, margin: 0 }}>
            Carry Trade Terminal
          </h1>
          <p style={{ fontSize: 11.5, color: C.muted, letterSpacing: "0.005em", maxWidth: 680, margin: "4px 0 0 0", lineHeight: 1.5 }}>
            Vendés USD a MEP, comprás bono en pesos, mantenés al vencimiento, recomprás USD. Análisis bajo distintos escenarios.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <StatusPill error={error} loading={loading || refreshing} isStale={isStale} lastFetch={lastFetch} now={now} />
          <RefreshButton onClick={() => fetchAll(true)} spinning={refreshing} />
        </div>
      </div>

      {/* Error inline */}
      {error && (
        <div className="flex items-start gap-3 p-4 mb-5" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.25)` }}>
          <AlertTriangle size={16} color={C.red} strokeWidth={1.8} />
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>No se pudieron cargar los datos</span>
            <span style={{ fontSize: 11, color: C.muted }}>{error}</span>
          </div>
        </div>
      )}

      {/* MODE TOGGLE */}
      <SectionLabel>Modo de Análisis</SectionLabel>
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {CARRY_MODES.map((m) => (
          <ModeCard key={m.id} mode={m} active={mode === m.id} onClick={() => setMode(m.id)} />
        ))}
      </div>

      {/* CONTENIDO POR MODO */}
      {mode === "byDollar" && (
        <ByDollarMode
          lecaps={lecaps}
          boncaps={boncaps}
          fxRates={fxRates}
          loading={loading}
          equilibriumFor={equilibriumFor}
          carryVsMep={carryVsMep}
          remIpc={remIpc}
        />
      )}

      {mode === "byBands" && (
        <ByBandsMode
          bonds={processedBonds}
          fxRates={fxRates}
          scenario={scenario}
          setScenario={setScenario}
          usdAmount={usdAmount}
          setUsdAmount={setUsdAmount}
          loading={loading}
          exitFxByScenario={exitFxByScenario}
          roiUsd={roiUsd}
        />
      )}

      {mode === "manual" && (
        <ManualMode
          bonds={processedBonds}
          fxRates={fxRates}
          manualUsd={manualUsd}
          setManualUsd={setManualUsd}
          usdAmount={usdAmount}
          setUsdAmount={setUsdAmount}
          loading={loading}
          roiUsd={roiUsd}
        />
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 mt-7" style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase" }}>
        <span>fuentes:</span>
        <span style={{ color: C.muted }}>data912.com</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>API REM (BCRA)</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>dolarapi.com</span>
        <span style={{ color: C.faint }}>·</span>
        <span>auto-refresh:</span>
        <span style={{ color: C.muted }}>
          {intervalMode === "active" ? "15 min · horario hábil" : "30 min · fuera de horario"}
        </span>
        <span style={{ color: C.faint }}>·</span>
        <span>última act:</span>
        <span style={{ color: C.muted }}>{timeAgo(lastFetch, now)}</span>
      </div>

      <p style={{ fontSize: 10, color: C.dim, marginTop: 12, lineHeight: 1.5, maxWidth: 720 }}>
        Precios de data912.com con delay ~2h respecto a BYMA. Cálculo asume VN=$100 al vencimiento (Lecaps/Boncaps capitalizables).
        Bandas BCRA: crawling 1%/mes hasta 31/12/2025, luego inflación T-2 del REM. Para operaciones reales consultar tu plataforma de trading.
      </p>
    </div>
  );
}

/* ─────────── ModeCard (toggle) ─────────── */

function ModeCard({ mode, active, onClick }) {
  const Icon = mode.icon;
  return (
    <button
      onClick={onClick}
      className="eco-mode-card"
      style={{
        cursor: "pointer",
        textAlign: "left",
        padding: "14px 16px",
        backgroundColor: active ? mode.soft : C.panel,
        border: `1px solid ${active ? mode.border : C.border}`,
        borderTop: `2px solid ${active ? mode.color : C.border}`,
        color: "inherit",
        fontFamily: "inherit",
        position: "relative",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span
          style={{
            width: 28,
            height: 28,
            backgroundColor: active ? mode.color : C.deep,
            border: `1px solid ${active ? "transparent" : C.border}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 0.18s ease",
          }}
        >
          <Icon size={14} color={active ? C.bg : mode.color} strokeWidth={2} />
        </span>
        <span
          className="eco-display"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: active ? mode.color : C.text,
            letterSpacing: "-0.005em",
          }}
        >
          {mode.label}
        </span>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: 0, letterSpacing: "0.005em", lineHeight: 1.4 }}>
        {mode.sublabel}
      </p>
      {active && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: mode.color,
            boxShadow: `0 0 8px ${mode.color}`,
          }}
        />
      )}
    </button>
  );
}

/* ─────────── Modo 1: Por Dólar ─────────── */

function ByDollarMode({ lecaps, boncaps, fxRates, loading, equilibriumFor, carryVsMep, remIpc }) {
  const allBonds = [...lecaps, ...boncaps].sort((a, b) => a.days - b.days);
  return (
    <>
      {/* KPIs de cotizaciones */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <FxKpi label="Oficial" value={fxRates.oficial} color={C.cat.cyan} />
        <FxKpi label="MEP" value={fxRates.mep} color={C.cat.emerald} />
        <FxKpi label="Blue" value={fxRates.blue} color={C.cat.violet} />
        <FxKpi label="CCL" value={fxRates.ccl} color={C.cat.yellow} />
      </div>

      {/* Callout — explicación de la matriz */}
      <div
        className="flex items-start gap-2 mb-3 px-4 py-3"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.04)",
          borderLeft: `2px solid ${C.cat.orange}`,
        }}
      >
        <Info size={13} color={C.cat.orange} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
          Cada celda muestra el <span style={{ color: C.text, fontWeight: 500 }}>retorno en USD</span> si entrás
          a MEP actual ($
          {fxRates.mep ? fmtARS(fxRates.mep) : "—"}) y vendés al dólar de la columna al vencimiento del bono. La columna{" "}
          <span style={{ color: C.cat.cyan, fontWeight: 500 }}>MEP Actual</span> usa el MEP de hoy como salida (escenario
          base — el peso no se mueve). La columna <span style={{ color: C.cat.cyan, fontWeight: 500 }}>Carry Techo</span>{" "}
          usa el techo de la banda BCRA proyectado a la fecha de vto del bono (crawling 1%/mes hasta dic-2025, luego
          REM IPC T-2).
        </p>
      </div>

      {/* Matriz de Carry vs Escenarios */}
      <div>
        <div
          className="mb-2 px-1"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <SectionLabel>Matriz de Carry por Escenario</SectionLabel>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500, textAlign: "center" }}>
            MEP Actual{" "}
            <span className="eco-mono" style={{ color: C.cat.emerald, fontWeight: 600, marginLeft: 6, fontSize: 12, letterSpacing: 0 }}>
              ${fxRates.mep ? fmtARS(fxRates.mep) : "—"}
            </span>
          </div>
          <div />
        </div>
        <ScenarioMatrix
          bonds={allBonds}
          fxRates={fxRates}
          remIpc={remIpc}
          loading={loading}
        />
      </div>

      {/* Callout — explicación de la tabla BE. */}
      <div
        className="flex items-start gap-2 mt-7 mb-3 px-4 py-3"
        style={{
          backgroundColor: "rgba(56, 189, 248, 0.04)",
          borderLeft: `2px solid ${C.accent}`,
        }}
      >
        <Info size={13} color={C.accent} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
          Las columnas <span style={{ color: C.text, fontWeight: 500 }}>BE.</span> muestran el{" "}
          <span style={{ color: C.text, fontWeight: 500 }}>dólar de breakeven</span>: el valor que tendría que
          tener el dólar al vencimiento para que el carry trade empate con quedarse en USD. Si el dólar termina{" "}
          <span style={{ color: C.green, fontWeight: 500 }}>por debajo</span>, ganás contra USD; si termina{" "}
          <span style={{ color: C.red, fontWeight: 500 }}>por encima</span>, perdés.
          <br />
          La columna <span style={{ color: C.text, fontWeight: 500 }}>Carry vs MEP</span> muestra el{" "}
          <span style={{ color: C.text, fontWeight: 500 }}>retorno en USD</span> asumiendo que el MEP al
          vencimiento queda igual al actual ($
          {fxRates.mep ? fmtARS(fxRates.mep) : "—"}). Es el escenario base — verde positivo = ganás, rojo
          negativo = perdés.
        </p>
      </div>

      {/* Tabla unificada: LECAPs + BONCAPs ordenados por días al vencimiento */}
      <div>
        <SectionLabel>Letras y Bonos Capitalizables</SectionLabel>
        <EquilibriumTable
          bonds={allBonds}
          fxRates={fxRates}
          loading={loading}
          equilibriumFor={equilibriumFor}
          carryVsMep={carryVsMep}
          accentTop={C.cat.cyan}
        />
      </div>

      {/* Gráfico Dólar Breakeven */}
      <div className="mt-7">
        <div
          className="flex items-start gap-2 mb-3 px-4 py-3"
          style={{
            backgroundColor: "rgba(167, 139, 250, 0.04)",
            borderLeft: `2px solid ${C.cat.violet}`,
          }}
        >
          <Info size={13} color={C.cat.violet} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
            Cada punto es un bono ubicado en su <span style={{ color: C.text, fontWeight: 500 }}>dólar de equilibrio</span> (eje Y) vs su{" "}
            <span style={{ color: C.text, fontWeight: 500 }}>fecha de vencimiento</span> (eje X). Los bonos{" "}
            <span style={{ color: C.green, fontWeight: 500 }}>por encima del techo BCRA</span> son los más atractivos: incluso si el peso se devalúa
            hasta el techo de la banda, el carry sigue ganando contra USD. Podés probar otros MEP de cálculo en el input de arriba.
          </p>
        </div>
        <SectionLabel>Dólar Breakeven · Bonos vs Banda BCRA</SectionLabel>
        <BreakevenChart
          bonds={allBonds}
          fxRates={fxRates}
          remIpc={remIpc}
          loading={loading}
        />
      </div>
    </>
  );
}

function FxKpi({ label, value, color }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${color}`,
        padding: "8px 12px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </div>
      <div className="eco-mono" style={{ fontSize: 14, color: C.text, fontWeight: 600, letterSpacing: "-0.005em" }}>
        {value != null ? `$${fmtARS(value)}` : "—"}
      </div>
    </div>
  );
}

function EquilibriumTable({ bonds, fxRates, loading, equilibriumFor, carryVsMep, accentTop }) {
  if (loading) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${accentTop}`, padding: "40px 18px" }} className="flex items-center justify-center">
        <Loader2 size={18} color={C.accent} className="eco-spin" strokeWidth={1.8} />
      </div>
    );
  }
  if (bonds.length === 0) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${accentTop}`, padding: "40px 18px", color: C.muted, fontSize: 12 }} className="flex items-center justify-center">
        Sin bonos disponibles
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${accentTop}`, padding: "10px 14px" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <Th align="left">Ticker</Th>
              <Th align="right">Precio</Th>
              <Th align="right">Días</Th>
              <Th align="right">TEM</Th>
              <Th align="right">TNA</Th>
              <Th align="right">TEA</Th>
              <Th align="right">BE. Oficial</Th>
              <Th align="right">BE. MEP</Th>
              <Th align="right">BE. Blue</Th>
              <Th align="right">BE. CCL</Th>
              <Th align="right" emphasized>Carry vs MEP</Th>
            </tr>
          </thead>
          <tbody>
            {bonds.map((b) => {
              // Carry vs MEP = ROI USD asumiendo que MEP queda igual al actual al vencimiento
              const carry = carryVsMep(b);
              const carryColor = carryColorFromValue(carry);
              return (
                <tr key={b.ticker} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Td align="left">
                    <span style={{ color: typeColor(b.type), fontWeight: 600, fontSize: 13 }}>{b.ticker}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 8,
                        padding: "2px 6px",
                        border: `1px solid ${typeColor(b.type)}`,
                        color: typeColor(b.type),
                        letterSpacing: "0.16em",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        fontFamily: "'Roboto', sans-serif",
                        opacity: 0.85,
                      }}
                    >
                      {typeLabel(b.type)}
                    </span>
                  </Td>
                  <Td align="right" mono>${fmtARS(b.priceArs)}</Td>
                  <Td align="right" mono><span style={{ color: C.muted }}>{b.days}</span></Td>
                  <Td align="right" mono><span style={{ color: C.muted }}>{fmtPct(b.tem * 100)}</span></Td>
                  <Td align="right" mono><span style={{ color: C.muted }}>{fmtPct(b.tirAnual * 100)}</span></Td>
                  <Td align="right" mono><span style={{ color: C.muted }}>{fmtPct(b.tea * 100)}</span></Td>
                  <Td align="right" mono>{eqCell(equilibriumFor(b, fxRates.oficial))}</Td>
                  <Td align="right" mono>{eqCell(equilibriumFor(b, fxRates.mep))}</Td>
                  <Td align="right" mono>{eqCell(equilibriumFor(b, fxRates.blue))}</Td>
                  <Td align="right" mono>{eqCell(equilibriumFor(b, fxRates.ccl))}</Td>
                  <Td align="right" mono>
                    <span style={{ color: carryColor, fontWeight: 600 }}>
                      {carry != null ? fmtPct(carry * 100) : "—"}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function eqCell(v) {
  if (v == null) return "—";
  return `$${fmtARS(v)}`;
}

// Carry vs MEP: positivo = ganás en USD (verde), negativo = perdés (rojo)
function carryColorFromValue(carry) {
  if (carry == null) return C.muted;
  if (carry < -0.05) return "#F87171";   // < -5% rojo fuerte
  if (carry < 0)     return "#FB923C";   // -5% a 0 naranja
  if (carry < 0.05)  return "#FACC15";   // 0-5% amarillo (bajo)
  if (carry < 0.15)  return "#A3E635";   // 5-15% verde claro
  return "#4ADE80";                       // > 15% verde fuerte
}

/* ─────────── Matriz de Carry por Escenario ─────────── */

/**
 * Devuelve el color de fondo (heatmap) según ROI USD.
 * Verde fuerte = mucho carry, blanco = neutral, rojo fuerte = pérdida grande.
 */
function matrixCellColor(roi) {
  if (roi == null || isNaN(roi)) return "transparent";
  // Saturación máxima a ±25%
  const clamped = Math.max(-0.25, Math.min(0.25, roi));
  const intensity = Math.abs(clamped) / 0.25; // 0..1
  if (clamped >= 0) {
    // Verde: opacity creciente
    return `rgba(74, 222, 128, ${(intensity * 0.32).toFixed(3)})`;
  } else {
    return `rgba(248, 113, 113, ${(intensity * 0.32).toFixed(3)})`;
  }
}

function matrixCellTextColor(roi) {
  if (roi == null || isNaN(roi)) return C.muted;
  if (roi >= 0.10) return "#4ADE80";
  if (roi >= 0)    return "#A3E635";
  if (roi > -0.05) return "#FACC15";
  if (roi > -0.15) return "#FB923C";
  return "#F87171";
}

function ScenarioMatrix({ bonds, fxRates, remIpc, loading }) {
  const mepNow = fxRates.mep;

  if (loading) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.orange}`, padding: 24, textAlign: "center" }}>
        <Loader2 size={20} color={C.muted} className="animate-spin inline-block" />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Cargando datos...</div>
      </div>
    );
  }

  if (!bonds || bonds.length === 0 || !mepNow) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.orange}`, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>Sin datos para construir la matriz.</span>
      </div>
    );
  }

  // Centro: MEP actual redondeado a la centena
  const center = Math.round(mepNow / 100) * 100;
  // 6 escenarios fijos: -300, -200, -100, 0, +100, +200 respecto al centro
  // + 1 escenario "MEP actual" insertado en el medio. Se ordena por fx ascendente.
  const fixedScenarios = [-100, 0, 100].map((delta) => ({
    label: String(center + delta),
    fx: center + delta,
    isCurrent: false,
  }));
  const currentScenario = {
    label: "MEP",
    fx: mepNow,
    isCurrent: true,
  };
  const scenarios = [...fixedScenarios, currentScenario].sort((a, b) => a.fx - b.fx);

  // ROI USD para un bono dado un FX de salida.
  // Fórmula: invierto $1 USD a MEP_now → recibo finalPayoff/priceArs pesos → vendo a fxOut.
  // ROI USD = (mepNow * (finalPayoff/priceArs)) / fxOut - 1
  // Equivale a: (1 + roiArs) * (mepNow / fxOut) - 1
  const roiUsdAt = (bond, fxOut) => {
    if (!fxOut || !bond || bond.roiArs == null) return null;
    return (1 + bond.roiArs) * (mepNow / fxOut) - 1;
  };

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.orange}`, padding: "10px 14px" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <Th align="left">Ticker</Th>
              <Th align="right">Precio</Th>
              <Th align="right">Días</Th>
              <Th align="right">TEM</Th>
              <Th align="right">TNA</Th>
              <Th align="right">TEA</Th>
              {scenarios.map((s) => {
                if (s.isCurrent) {
                  return (
                    <th
                      key="current"
                      align="right"
                      style={{
                        padding: "10px 10px",
                        fontSize: 9,
                        color: C.cat.cyan,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        textAlign: "right",
                        borderLeft: `3px solid ${C.cat.cyan}`,
                        borderRight: `3px solid ${C.cat.cyan}`,
                      }}
                    >
                      MEP Actual
                    </th>
                  );
                }
                return (
                  <Th key={s.label} align="right">
                    Carry {s.label}
                  </Th>
                );
              })}
              <th
                align="right"
                style={{
                  padding: "10px 10px",
                  fontSize: 9,
                  color: C.accent,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  fontFamily: "'Roboto', sans-serif",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                Carry Techo
              </th>
            </tr>
          </thead>
          <tbody>
            {bonds.map((b) => {
              const ceilingFx = projectBand(b.maturityDate, "ceiling", remIpc);
              const ceilingRoi = roiUsdAt(b, ceilingFx);
              return (
                <tr key={b.ticker} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Td align="left">
                    <span style={{ color: typeColor(b.type), fontWeight: 600, fontSize: 12 }}>{b.ticker}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 8,
                        padding: "2px 6px",
                        border: `1px solid ${typeColor(b.type)}`,
                        color: typeColor(b.type),
                        letterSpacing: "0.16em",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        fontFamily: "'Roboto', sans-serif",
                        opacity: 0.85,
                      }}
                    >
                      {typeLabel(b.type)}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    ${fmtARS(b.priceArs)}
                  </Td>
                  <Td align="right" mono>
                    <span style={{ color: C.muted }}>{b.days}</span>
                  </Td>
                  <Td align="right" mono>
                    <span style={{ color: C.muted }}>{fmtPct(b.tem * 100)}</span>
                  </Td>
                  <Td align="right" mono>
                    <span style={{ color: C.muted }}>{fmtPct(b.tirAnual * 100)}</span>
                  </Td>
                  <Td align="right" mono>
                    <span style={{ color: C.muted }}>{fmtPct(b.tea * 100)}</span>
                  </Td>
                  {scenarios.map((s) => {
                    const roi = roiUsdAt(b, s.fx);
                    if (s.isCurrent) {
                      return (
                        <td
                          key="current"
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            backgroundColor: matrixCellColor(roi),
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 700,
                            color: matrixCellTextColor(roi),
                            borderLeft: `3px solid ${C.cat.cyan}`,
                            borderRight: `3px solid ${C.cat.cyan}`,
                          }}
                        >
                          {roi != null ? fmtPct(roi * 100) : "—"}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={s.label}
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          backgroundColor: matrixCellColor(roi),
                          fontFamily: "'JetBrains Mono', monospace",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          color: matrixCellTextColor(roi),
                        }}
                      >
                        {roi != null ? fmtPct(roi * 100) : "—"}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      backgroundColor: matrixCellColor(ceilingRoi),
                      fontFamily: "'JetBrains Mono', monospace",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: matrixCellTextColor(ceilingRoi),
                      borderLeft: `1px solid ${C.border}`,
                    }}
                  >
                    {ceilingRoi != null ? fmtPct(ceilingRoi * 100) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

/* ─────────── Gráfico Dólar Breakeven ─────────── */

/**
 * Convierte fecha ISO (YYYY-MM-DD) a timestamp para el eje X
 */
function isoToTimestamp(iso) {
  return new Date(iso + "T12:00:00Z").getTime();
}

/**
 * Genera una serie de puntos para la banda BCRA (piso o techo)
 * desde "hoy" hasta la fecha del bono más lejano + 1 mes.
 */
function generateBandSeries(bonds, boundary, remIpc) {
  if (!bonds || bonds.length === 0) return [];
  const today = new Date();
  // Fecha más lejana entre los bonos + 30 días de padding
  const maxDate = bonds.reduce((acc, b) => {
    const d = new Date(b.maturityDate);
    return d > acc ? d : acc;
  }, today);
  const endDate = new Date(maxDate);
  endDate.setDate(endDate.getDate() + 30);

  // Generar puntos cada ~15 días
  const points = [];
  const cursor = new Date(today);
  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    const fx = projectBand(iso, boundary, remIpc);
    if (fx) points.push({ x: cursor.getTime(), y: fx });
    cursor.setDate(cursor.getDate() + 15);
  }
  return points;
}

/**
 * Tooltip de las bandas BCRA en el gráfico Dólar Breakeven.
 * Se muestra al hover sobre las líneas (techo/piso). Recharts lo dispara
 * cuando el cursor está cerca del eje X de cualquier serie de Line.
 *
 * NOTA: Los bonos del scatter NO usan este tooltip — tienen su propio
 * tooltip manual (`hoveredPoint`) gestionado en el `renderDot` para
 * tener mejor posicionamiento. Cuando hay un bono hover, este tooltip
 * se oculta vía `suppress` para evitar duplicación.
 */
function BandsTooltip({ active, payload, suppress }) {
  if (suppress) return null;
  if (!active || !payload || !payload.length) return null;

  const ceilingEntry = payload.find((p) => p.dataKey === "ceiling");
  const floorEntry = payload.find((p) => p.dataKey === "floor");

  if (!ceilingEntry && !floorEntry) return null;

  // Fecha (timestamp) — bandSeries comparte el eje X entre las dos líneas
  const xValue = ceilingEntry?.payload?.x ?? floorEntry?.payload?.x;
  const dateStr = xValue
    ? new Date(xValue).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  // Brecha entre piso y techo (informativo)
  const ceiling = ceilingEntry?.value;
  const floor = floorEntry?.value;
  const brecha = (ceiling != null && floor != null) ? ((ceiling / floor - 1) * 100) : null;

  return (
    <div
      style={{
        backgroundColor: C.deep,
        border: `1px solid ${C.borderStrong}`,
        padding: "9px 12px",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        minWidth: 190,
      }}
    >
      <div style={{ color: C.muted, fontSize: 10, marginBottom: 6, letterSpacing: "0.04em" }}>
        {dateStr}
      </div>
      {ceilingEntry && (
        <div style={{ color: C.red, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>Techo BCRA</span>
          <span style={{ color: C.text, fontWeight: 600 }}>${fmtARS(ceiling)}</span>
        </div>
      )}
      {floorEntry && (
        <div style={{ color: C.green, display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
          <span>Piso BCRA</span>
          <span style={{ color: C.text, fontWeight: 600 }}>${fmtARS(floor)}</span>
        </div>
      )}
      {brecha != null && (
        <div
          style={{
            color: C.muted,
            fontSize: 10,
            marginTop: 6,
            paddingTop: 6,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span>Brecha banda</span>
          <span style={{ color: C.text }}>{fmtPct(brecha)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Componente principal del gráfico Dólar Breakeven
 */
function BreakevenChart({ bonds, fxRates, remIpc, loading }) {
  const mepNow = fxRates.mep;
  const [customMep, setCustomMep] = useState("");
  // hoveredPoint: { ticker, type, days, maturityDate, y, cx, cy } | null
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (loading) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: 24, textAlign: "center" }}>
        <Loader2 size={20} color={C.muted} className="animate-spin inline-block" />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Cargando datos...</div>
      </div>
    );
  }

  if (!bonds || bonds.length === 0 || !mepNow) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>Sin datos para construir el gráfico.</span>
      </div>
    );
  }

  // MEP a usar para los cálculos: si hay valor custom válido, usar ese
  // Parse formato AR: "1.448,50" → 1448.50
  // Primero saco puntos (separador miles), después coma → punto decimal
  const customMepNum = parseFloat(customMep.replace(/\./g, "").replace(",", "."));
  const effectiveMep = customMepNum > 0 ? customMepNum : mepNow;
  const usingCustom = customMepNum > 0;

  // Puntos del scatter: cada bono → { x: timestamp_vto, y: dolar_breakeven, ticker, ... }
  const scatterData = bonds.map((b) => {
    const beY = effectiveMep * (b.valorFinal / b.priceArs);
    const ceilingAtMat = projectBand(b.maturityDate, "ceiling", remIpc);
    const floorAtMat = projectBand(b.maturityDate, "floor", remIpc);
    return {
      x: isoToTimestamp(b.maturityDate),
      y: beY,
      ticker: b.ticker,
      type: b.type,
      days: b.days,
      maturityDate: b.maturityDate,
      // Bandas proyectadas a la fecha de vencimiento (para tooltip)
      ceilingAtMat,
      floorAtMat,
      // Distancia % del Dólar BE al techo. Positivo = BE > techo (carry robusto al peor escenario).
      distToCeiling: ceilingAtMat ? (beY / ceilingAtMat - 1) * 100 : null,
    };
  });

  // Series de bandas BCRA (piso y techo proyectados)
  const ceilingSeries = generateBandSeries(bonds, "ceiling", remIpc);
  const floorSeries = generateBandSeries(bonds, "floor", remIpc);

  // Combinar bandas en una serie con campos floor/ceiling para Area
  const bandSeries = ceilingSeries.map((c, i) => ({
    x: c.x,
    ceiling: c.y,
    floor: floorSeries[i]?.y ?? c.y,
  }));

  // Eje Y dinámico con padding 10%
  const allYValues = [
    ...scatterData.map((d) => d.y),
    ...ceilingSeries.map((d) => d.y),
    ...floorSeries.map((d) => d.y),
    effectiveMep,
  ].filter((v) => v != null && !isNaN(v));
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const padY = (maxY - minY) * 0.1;
  const yDomain = [Math.floor((minY - padY) / 50) * 50, Math.ceil((maxY + padY) / 50) * 50];

  // Eje X: desde hoy hasta el bono más lejano + 30d
  const today = Date.now();
  const maxX = Math.max(...scatterData.map((d) => d.x)) + 30 * 24 * 60 * 60 * 1000;

  // Custom dot que muestra el ticker arriba
  const renderDot = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isHovered = hoveredPoint?.ticker === payload.ticker;
    const color = typeColor(payload.type);
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={isHovered ? 6 : 4}
          fill={color}
          stroke={C.bg}
          strokeWidth={1.5}
          style={{ cursor: "pointer", transition: "r 0.15s ease" }}
          onMouseEnter={() => setHoveredPoint({ ...payload, cx, cy })}
          onMouseLeave={() => setHoveredPoint(null)}
        />
        <text
          x={cx}
          y={cy - 9}
          textAnchor="middle"
          fill={color}
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={600}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {payload.ticker}
        </text>
      </g>
    );
  };

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: "14px 14px 18px" }}>
      {/* Input dólar personalizado */}
      <div className="flex items-center gap-3 mb-4 px-1" style={{ flexWrap: "wrap" }}>
        <label style={{ fontSize: 10, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500 }}>
          MEP de cálculo
        </label>
        <input
          type="text"
          value={customMep}
          onChange={(e) => setCustomMep(e.target.value)}
          placeholder={fmtARS(mepNow)}
          style={{
            backgroundColor: C.deep,
            border: `1px solid ${usingCustom ? C.cat.violet : C.border}`,
            color: C.text,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            padding: "6px 12px",
            width: 130,
            outline: "none",
          }}
        />
        {usingCustom ? (
          <span style={{ fontSize: 11, color: C.cat.violet, fontFamily: "'JetBrains Mono', monospace" }}>
            usando ${fmtARS(effectiveMep)} (custom)
          </span>
        ) : (
          <span style={{ fontSize: 11, color: C.muted }}>
            usando MEP actual · vacío para reset
          </span>
        )}
      </div>

      {/* Gráfico */}
      <div style={{ width: "100%", height: 520, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 70, bottom: 60, left: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} opacity={0.4} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[today, maxX]}
              tickFormatter={(t) => {
                // Capitaliza primera letra del mes para que se vea como en bonistas
                const d = new Date(t);
                const month = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
                const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
                return `${monthCap} ${d.getFullYear()}`;
              }}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
              allowDuplicatedCategory={false}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
              minTickGap={40}
            >
              <Label
                value="Fecha de Vencimiento"
                position="insideBottom"
                offset={-50}
                style={{ fill: C.dim, fontSize: 11, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}
              />
            </XAxis>
            <YAxis
              type="number"
              domain={yDomain}
              tickFormatter={(v) => `$${fmtARS(v)}`}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
              width={70}
            >
              <Label
                value="Valor en ARS"
                angle={-90}
                position="insideLeft"
                offset={-5}
                style={{ textAnchor: "middle", fill: C.dim, fontSize: 11, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}
              />
            </YAxis>
            <RechartsTooltip
              content={(props) => <BandsTooltip {...props} suppress={!!hoveredPoint} />}
              cursor={hoveredPoint ? false : { stroke: C.borderStrong, strokeDasharray: "3 3", strokeWidth: 1 }}
              isAnimationActive={false}
              wrapperStyle={{ outline: "none" }}
            />

            {/* Línea horizontal del MEP actual o custom */}
            <ReferenceLine
              y={effectiveMep}
              stroke={C.cat.emerald}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{
                value: usingCustom ? `MEP custom $${fmtARS(effectiveMep)}` : `MEP $${fmtARS(effectiveMep)}`,
                position: "right",
                fill: C.cat.emerald,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            />

            {/* Banda BCRA: techo (línea roja punteada) */}
            <Line
              data={bandSeries}
              type="monotone"
              dataKey="ceiling"
              xAxisId={0}
              yAxisId={0}
              stroke={C.red}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Techo BCRA"
              connectNulls
            />
            {/* Banda BCRA: piso (línea verde punteada) */}
            <Line
              data={bandSeries}
              type="monotone"
              dataKey="floor"
              xAxisId={0}
              yAxisId={0}
              stroke={C.green}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Piso BCRA"
              connectNulls
            />

            {/* Scatter de los bonos */}
            <Scatter
              data={scatterData}
              dataKey="y"
              xAxisId={0}
              yAxisId={0}
              shape={renderDot}
              isAnimationActive={false}
              name="Bonos"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Tooltip manual: solo aparece al hacer hover sobre un punto del scatter */}
        {hoveredPoint && (
          <div
            style={{
              position: "absolute",
              left: hoveredPoint.cx + 14,
              top: hoveredPoint.cy - 8,
              backgroundColor: C.deep,
              border: `1px solid ${C.borderStrong}`,
              padding: "9px 12px",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              pointerEvents: "none",
              zIndex: 10,
              minWidth: 200,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Header: ticker + tipo */}
            <div style={{ color: typeColor(hoveredPoint.type), fontWeight: 700, marginBottom: 6 }}>
              {hoveredPoint.ticker}
              <span style={{ color: C.muted, marginLeft: 8, fontWeight: 400, fontSize: 10 }}>
                {typeLabel(hoveredPoint.type)}
              </span>
            </div>

            {/* Vto + días */}
            <div style={{ color: C.muted, fontSize: 10, marginBottom: 6, letterSpacing: "0.04em" }}>
              Vto: {hoveredPoint.maturityDate} · {hoveredPoint.days}d
            </div>

            {/* Dólar BE + bandas, ordenado de mayor a menor por valor.
                Así el BE queda visualmente entre las bandas si está en el medio,
                arriba si supera el techo, o abajo si está bajo el piso. */}
            {[
              { key: "be",      label: "Dólar BE",   value: hoveredPoint.y,             color: typeColor(hoveredPoint.type) },
              { key: "ceiling", label: "Techo BCRA", value: hoveredPoint.ceilingAtMat,  color: C.red },
              { key: "floor",   label: "Piso BCRA",  value: hoveredPoint.floorAtMat,    color: C.green },
            ]
              .filter((r) => r.value != null)
              .sort((a, b) => b.value - a.value)
              .map((r, idx) => (
                <div
                  key={r.key}
                  style={{
                    color: r.color,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    marginTop: idx === 0 ? 0 : 2,
                  }}
                >
                  <span>{r.label}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>${fmtARS(r.value)}</span>
                </div>
              ))}

            {/* BE vs Techo: indica si el carry resiste al peor escenario */}
            {hoveredPoint.distToCeiling != null && (
              <div
                style={{
                  fontSize: 10,
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: `1px solid ${C.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  color: C.muted,
                }}
              >
                <span>BE vs Techo</span>
                <span
                  style={{
                    color: hoveredPoint.distToCeiling >= 0 ? C.green : C.red,
                    fontWeight: 600,
                  }}
                >
                  {hoveredPoint.distToCeiling >= 0 ? "+" : ""}{fmtPct(hoveredPoint.distToCeiling)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leyenda inferior */}
      <div className="flex items-center justify-center gap-5 mt-3 px-1" style={{ flexWrap: "wrap", fontSize: 10, color: C.muted, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.cat.cyan }} />
          <span>Lecap</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.cat.lime }} />
          <span>Boncap</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 14, height: 1, borderTop: `2px dashed ${C.red}` }} />
          <span>Techo BCRA proyectado</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 14, height: 1, borderTop: `2px dashed ${C.green}` }} />
          <span>Piso BCRA proyectado</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 14, height: 1, borderTop: `2px dashed ${C.cat.emerald}` }} />
          <span>MEP {usingCustom ? "custom" : "actual"}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Modo 2: Bandas BCRA + REM ─────────── */

function ByBandsMode({ bonds, fxRates, scenario, setScenario, usdAmount, setUsdAmount, loading, exitFxByScenario, roiUsd }) {
  const mepEntry = fxRates.mep;
  const activeScenarioObj = SCENARIOS.find((s) => s.id === scenario);

  const enriched = bonds.map((b) => {
    const fx = exitFxByScenario(b);
    return {
      ...b,
      exitFx: fx,
      roiUsdScenario: roiUsd(b, fx[scenario], mepEntry),
    };
  });

  const leadBond = enriched
    .filter((b) => b.roiUsdScenario != null)
    .reduce((a, b) => (a == null || b.roiUsdScenario > a.roiUsdScenario ? b : a), null);

  return (
    <>
      {/* Inputs row: MEP de entrada (read only) + Monto USD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <FxKpi label="MEP de Entrada" value={mepEntry} color={C.accent} />
        <UsdInputCard usdAmount={usdAmount} setUsdAmount={setUsdAmount} mep={mepEntry} />
      </div>

      {/* Scenario tabs */}
      <SectionLabel>Escenario de Salida</SectionLabel>
      <div className="mb-5">
        <div className="inline-flex gap-1.5 mb-2">
          {SCENARIOS.map((s) => (
            <PillButton
              key={s.id}
              active={scenario === s.id}
              onClick={() => setScenario(s.id)}
              label={s.label}
              activeColor={s.color}
            />
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 4, marginBottom: 0 }}>
          {activeScenarioObj?.desc}
        </p>
      </div>

      {/* Lead bond */}
      <div className="mb-5">
        <LeadBondCard bond={leadBond} scenario={scenario} />
      </div>

      {/* Tabla */}
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.accent}`, padding: "16px 18px" }}>
        <CardHeader icon={BarChart3} iconColor={C.accent} label="Universo de Bonos" />
        <p style={{ fontSize: 11, color: C.muted, marginTop: -4, marginBottom: 14, fontFamily: "'Roboto', sans-serif" }}>
          Ordenado por días al vencimiento. ROI USD calculado con escenario activo.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} color={C.accent} className="eco-spin" strokeWidth={1.8} />
          </div>
        ) : enriched.length === 0 ? (
          <div className="flex items-center justify-center py-12" style={{ color: C.muted, fontSize: 12 }}>
            Sin bonos disponibles
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Th align="left">Ticker</Th>
                  <Th align="left">Tipo</Th>
                  <Th align="right">Vto</Th>
                  <Th align="right">Días</Th>
                  <Th align="right">Precio</Th>
                  <Th align="right">TIR Anual</Th>
                  <Th align="right">Dólar Salida</Th>
                  <Th align="right" emphasized>ROI USD</Th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((b) => {
                  const isLead = leadBond && b.ticker === leadBond.ticker;
                  const roi = b.roiUsdScenario;
                  const roiColor = roi == null ? C.dim : roi >= 0 ? C.green : C.red;
                  const exitFx = b.exitFx[scenario];
                  return (
                    <tr key={b.ticker} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: isLead ? "rgba(244,114,182,0.06)" : "transparent" }}>
                      <Td align="left">
                        <span style={{ color: typeColor(b.type), fontWeight: 600, fontSize: 13 }}>{b.ticker}</span>
                        {isLead && (
                          <span style={{ marginLeft: 8, fontSize: 8, padding: "2px 5px", border: `1px solid ${C.cat.pink}`, color: C.cat.pink, letterSpacing: "0.14em", fontWeight: 600 }}>
                            LIDER
                          </span>
                        )}
                      </Td>
                      <Td align="left">
                        <span style={{ fontSize: 10, color: typeColor(b.type), letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
                          {b.type}
                        </span>
                      </Td>
                      <Td align="right" mono>{formatDate(b.maturityDate)}</Td>
                      <Td align="right" mono><span style={{ color: C.muted }}>{b.days}</span></Td>
                      <Td align="right" mono>${fmtARS(b.priceArs)}</Td>
                      <Td align="right" mono><span style={{ color: C.muted }}>{fmtPct(b.tirAnual * 100)}</span></Td>
                      <Td align="right" mono><span style={{ color: C.muted }}>{exitFx ? `$${fmtARS(exitFx)}` : "—"}</span></Td>
                      <Td align="right" mono>
                        <span style={{ color: roiColor, fontWeight: 600 }}>
                          {roi != null ? fmtPct(roi * 100) : "—"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function LeadBondCard({ bond, scenario }) {
  if (!bond) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "20px 22px", minHeight: 132 }}>
        <CardHeader icon={Sigma} iconColor={C.cat.pink} label="Bono Líder de Flujo" />
        <div className="flex items-center justify-center" style={{ minHeight: 80, color: C.dim, fontSize: 12 }}>
          Esperando datos…
        </div>
      </div>
    );
  }
  const roi = bond.roiUsdScenario;
  const roiColor = roi == null ? C.muted : roi >= 0 ? C.green : C.red;
  const exitFx = bond.exitFx[scenario];

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "20px 22px" }}>
      <CardHeader icon={Sigma} iconColor={C.cat.pink} label="Bono Líder de Flujo" />
      <div className="flex flex-wrap items-end justify-between gap-6 mt-3">
        <div className="flex flex-col">
          <span className="eco-display" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em", color: C.cat.pink, lineHeight: 1 }}>
            {bond.ticker}
          </span>
          <span style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            {bond.type.toUpperCase()} · Vence {formatDate(bond.maturityDate)} · {bond.days}d
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          <Metric label="ROI USD" value={roi != null ? fmtPct(roi * 100) : "—"} color={roiColor} large />
          <Metric label="ROI ARS" value={fmtPct(bond.roiArs * 100)} color={C.text} large />
          <Metric label="TIR Anual" value={fmtPct(bond.tirAnual * 100)} color={C.muted} />
          <Metric label="TEM" value={fmtPct(bond.tem * 100)} color={C.muted} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <KeyVal k="Precio compra" v={`$${fmtARS(bond.priceArs)}`} />
        <KeyVal k={`Dólar salida (${scenario})`} v={exitFx ? `$${fmtARS(exitFx)}` : "—"} />
      </div>
    </div>
  );
}

function Metric({ label, value, color, large }) {
  return (
    <div className="flex flex-col" style={{ minWidth: 0, maxWidth: 180 }}>
      <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </span>
      <span className="eco-mono" style={{
        fontSize: large ? 22 : 16,
        fontWeight: 600,
        color: color,
        letterSpacing: "-0.005em",
        marginTop: 2,
        lineHeight: 1.05,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}

function KeyVal({ k, v }) {
  return (
    <div className="flex items-baseline gap-2">
      <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 500 }}>{k}:</span>
      <span className="eco-mono" style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function UsdInputCard({ usdAmount, setUsdAmount, mep }) {
  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.yellow}`, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        Monto a Invertir
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span style={{ fontSize: 19, color: C.muted, fontWeight: 400 }}>$</span>
        <input
          type="number"
          value={usdAmount}
          onChange={(e) => setUsdAmount(parseFloat(e.target.value) || 0)}
          style={{
            background: "transparent",
            border: "none",
            color: C.text,
            fontSize: 19,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
            outline: "none",
            width: "100%",
            minWidth: 0,
            padding: 0,
          }}
        />
        <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          USD
        </span>
      </div>
      {mep && (
        <p style={{ fontSize: 10.5, color: C.dim, marginTop: 6, marginBottom: 0 }}>
          Equivale a ${fmtARS(usdAmount * mep)} ARS
        </p>
      )}
    </div>
  );
}

/* ─────────── Modo 3: Manual ─────────── */

function ManualMode({ bonds, fxRates, manualUsd, setManualUsd, usdAmount, setUsdAmount, loading, roiUsd }) {
  const mepEntry = fxRates.mep;
  const customExitFx = parseFloat(manualUsd) || null;

  const enriched = bonds.map((b) => ({
    ...b,
    roiUsdManual: roiUsd(b, customExitFx, mepEntry),
  }));

  const leadBond = customExitFx
    ? enriched
        .filter((b) => b.roiUsdManual != null)
        .reduce((a, b) => (a == null || b.roiUsdManual > a.roiUsdManual ? b : a), null)
    : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <FxKpi label="MEP Actual" value={mepEntry} color={C.accent} />
        <UsdInputCard usdAmount={usdAmount} setUsdAmount={setUsdAmount} mep={mepEntry} />
        <ManualUsdInput value={manualUsd} onChange={setManualUsd} />
      </div>

      {!customExitFx && (
        <div style={{ backgroundColor: C.panel, border: `1px dashed ${C.border}`, padding: 24, textAlign: "center", color: C.muted, fontSize: 12 }}>
          Ingresá un valor de dólar de salida arriba para calcular el ROI USD de los bonos
        </div>
      )}

      {customExitFx && (
        <>
          {/* Lead bond */}
          <div className="mb-5">
            <ManualLeadBond bond={leadBond} customExitFx={customExitFx} />
          </div>

          {/* Tabla */}
          <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "16px 18px" }}>
            <CardHeader icon={BarChart3} iconColor={C.cat.pink} label={`ROI con dólar salida = $${fmtARS(customExitFx)}`} />
            <p style={{ fontSize: 11, color: C.muted, marginTop: -4, marginBottom: 14 }}>
              Ordenado por días al vencimiento.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} color={C.accent} className="eco-spin" strokeWidth={1.8} />
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <Th align="left">Ticker</Th>
                      <Th align="left">Tipo</Th>
                      <Th align="right">Vto</Th>
                      <Th align="right">Días</Th>
                      <Th align="right">Precio</Th>
                      <Th align="right">TIR Anual</Th>
                      <Th align="right" emphasized>ROI USD</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map((b) => {
                      const isLead = leadBond && b.ticker === leadBond.ticker;
                      const roi = b.roiUsdManual;
                      const roiColor = roi == null ? C.dim : roi >= 0 ? C.green : C.red;
                      return (
                        <tr key={b.ticker} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: isLead ? "rgba(244,114,182,0.06)" : "transparent" }}>
                          <Td align="left">
                            <span style={{ color: typeColor(b.type), fontWeight: 600, fontSize: 13 }}>{b.ticker}</span>
                            {isLead && (
                              <span style={{ marginLeft: 8, fontSize: 8, padding: "2px 5px", border: `1px solid ${C.cat.pink}`, color: C.cat.pink, letterSpacing: "0.14em", fontWeight: 600 }}>
                                LIDER
                              </span>
                            )}
                          </Td>
                          <Td align="left">
                            <span style={{ fontSize: 10, color: typeColor(b.type), letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
                              {b.type}
                            </span>
                          </Td>
                          <Td align="right" mono>{formatDate(b.maturityDate)}</Td>
                          <Td align="right" mono><span style={{ color: C.muted }}>{b.days}</span></Td>
                          <Td align="right" mono>${fmtARS(b.priceArs)}</Td>
                          <Td align="right" mono><span style={{ color: C.muted }}>{fmtPct(b.tirAnual * 100)}</span></Td>
                          <Td align="right" mono>
                            <span style={{ color: roiColor, fontWeight: 600 }}>
                              {roi != null ? fmtPct(roi * 100) : "—"}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function ManualUsdInput({ value, onChange }) {
  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        Dólar de Salida (Manual)
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span style={{ fontSize: 19, color: C.muted, fontWeight: 400 }}>$</span>
        <input
          type="number"
          value={value}
          placeholder="ej. 1850"
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: "transparent",
            border: "none",
            color: C.text,
            fontSize: 19,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
            outline: "none",
            width: "100%",
            minWidth: 0,
            padding: 0,
          }}
        />
        <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          ARS
        </span>
      </div>
      <p style={{ fontSize: 10.5, color: C.dim, marginTop: 6, marginBottom: 0 }}>
        Tu escenario al vencimiento
      </p>
    </div>
  );
}

function ManualLeadBond({ bond, customExitFx }) {
  if (!bond) return null;
  const roi = bond.roiUsdManual;
  const roiColor = roi == null ? C.muted : roi >= 0 ? C.green : C.red;

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "20px 22px" }}>
      <CardHeader icon={Sigma} iconColor={C.cat.pink} label="Bono Líder con tu Escenario" />
      <div className="flex flex-wrap items-end justify-between gap-6 mt-3">
        <div className="flex flex-col">
          <span className="eco-display" style={{ fontSize: 32, fontWeight: 700, color: C.cat.pink, lineHeight: 1 }}>
            {bond.ticker}
          </span>
          <span style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            {bond.type.toUpperCase()} · Vence {formatDate(bond.maturityDate)} · {bond.days}d
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          <Metric label="ROI USD" value={roi != null ? fmtPct(roi * 100) : "—"} color={roiColor} large />
          <Metric label="ROI ARS" value={fmtPct(bond.roiArs * 100)} color={C.text} large />
          <Metric label="Dólar salida" value={`$${fmtARS(customExitFx)}`} color={C.muted} />
        </div>
      </div>
    </div>
  );
}

/* ─────────── Futuros vs Caución Module ─────────── */

const DLR_PRICES_LS_KEY = "ecoflow:dlrPrices";
const DLR_PRICES_TS_LS_KEY = "ecoflow:dlrPricesUpdatedAt";
const CAUCION_LS_KEY = "ecoflow:caucionRate";
const CAUCION_MODE_LS_KEY = "ecoflow:caucionMode";  // "auto" | "manual"

/** Lee precios de DLR desde localStorage. Devuelve {} si no hay nada. */
function readStoredDlrPrices() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DLR_PRICES_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readStoredDlrTimestamp() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DLR_PRICES_TS_LS_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

function readStoredCaucion() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CAUCION_LS_KEY);
    return raw ? parseFloat(raw) : null;
  } catch {
    return null;
  }
}

/** Lee el modo de caución persistido. Default: "auto" si nunca se eligió. */
function readStoredCaucionMode() {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(CAUCION_MODE_LS_KEY);
    return raw === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Extrae la tasa de caución de "1 día" de la respuesta de A3 Mercados.
 *
 * La API devuelve un array de operaciones de cauciones agrupadas por plazo.
 * Cada entrada tiene `codigoPlazo` (string), `ultimatasa` (decimal),
 * `volumenAcumulado`, `moneda`, etc. Para el carry trade nos interesa el
 * plazo más corto disponible (idealmente "001" = 1 día) en pesos ($).
 *
 * Estrategia:
 *   1. Filtrar solo cauciones en pesos.
 *   2. Buscar plazo "001" (1d) — fuente preferida.
 *   3. Si no hay 1d, tomar el plazo más corto disponible.
 *   4. Devolver la `ultimatasa` (TNA) de esa entrada.
 *
 * Devuelve { rate, plazo, volumen } o null si no hay datos parseables.
 */
function extractCaucion1d(a3Data) {
  if (!Array.isArray(a3Data) || a3Data.length === 0) return null;

  // Filtrar pesos. La API puede usar "$" o "ARS" según el campo.
  const pesos = a3Data.filter((c) => {
    const m = (c.moneda || "").trim();
    return m === "$" || m.toUpperCase() === "ARS";
  });
  if (pesos.length === 0) return null;

  // Preferir plazo "001"
  let target = pesos.find((c) => (c.codigoPlazo || c.plazo || "").trim() === "001");

  // Si no, tomar el plazo más corto (parseInt del codigoPlazo)
  if (!target) {
    const sorted = [...pesos].sort((a, b) => {
      const pa = parseInt((a.codigoPlazo || a.plazo || "999"), 10) || 999;
      const pb = parseInt((b.codigoPlazo || b.plazo || "999"), 10) || 999;
      return pa - pb;
    });
    target = sorted[0];
  }

  const rate = target?.ultimatasa ?? target?.tasaPP ?? null;
  if (rate == null || isNaN(rate) || rate <= 0) return null;

  return {
    rate: parseFloat(rate),
    plazo: (target.plazo || target.codigoPlazo || "").trim(),
    volumen: target.volumenAcumulado ?? null,
  };
}

/** Devuelve el precio efectivo de un contrato: stored si hay, sino el seed. */
function priceForContract(contract, storedPrices) {
  const stored = storedPrices[contract.ticker];
  if (stored != null && stored > 0) return stored;
  return contract.priceSeed;
}

/** Color del spread vs caución: positivo (futuro caro) = rojo, negativo (barato) = verde. */
function spreadColor(spreadPct) {
  if (spreadPct == null || isNaN(spreadPct)) return C.muted;
  if (spreadPct < -2) return "#4ADE80";  // barato fuerte
  if (spreadPct < 0)  return "#A3E635";  // barato leve
  if (spreadPct < 2)  return "#FACC15";  // neutro
  if (spreadPct < 5)  return "#FB923C";  // caro leve
  return "#F87171";                       // caro fuerte
}

function FuturosVsCaucionModule() {
  // ─── State ──────────────────────────────────────────────
  const [spotMayorista, setSpotMayorista] = useState(null);
  const [remTc, setRemTc] = useState({});
  const [storedPrices, setStoredPrices] = useState(() => readStoredDlrPrices());
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(() => readStoredDlrTimestamp());

  // Caución: doble fuente. `caucionAuto` viene de A3 Mercados (preferido).
  // `caucionManual` es el override que persiste en localStorage. El modo
  // dicta cuál se muestra. Si A3 falla, caemos automáticamente a manual
  // (o a 32 default si nunca se editó).
  const [caucionAuto, setCaucionAuto] = useState(null);          // { rate, plazo, volumen } | null
  const [caucionManual, setCaucionManual] = useState(() => readStoredCaucion() ?? 32);
  const [caucionMode, setCaucionMode] = useState(() => readStoredCaucionMode());

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBuffer, setEditorBuffer] = useState({});
  const [editorCaucion, setEditorCaucion] = useState(String(readStoredCaucion() ?? 32));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [now, setNow] = useState(new Date());
  const [intervalMode, setIntervalMode] = useState(isActiveMarketWindow() ? "active" : "idle");

  // Calculadora manual
  const [calcSpot, setCalcSpot] = useState("");
  const [calcFuturo, setCalcFuturo] = useState("");
  const [calcDays, setCalcDays] = useState("");

  // Explicación didáctica (cerrada por default, los users que ya saben no la abren)
  const [explainerOpen, setExplainerOpen] = useState(false);

  // Tasa de caución efectiva: la que se usa en cálculos y se muestra como KPI.
  // Si el modo es auto y A3 respondió, usamos auto. Sino caemos a manual.
  const caucionRate = (caucionMode === "auto" && caucionAuto?.rate != null)
    ? caucionAuto.rate
    : caucionManual;

  // Tick para "now" en el StatusPill
  useEffect(() => {
    const i = setInterval(() => {
      setNow(new Date());
      setIntervalMode(isActiveMarketWindow() ? "active" : "idle");
    }, 1000);
    return () => clearInterval(i);
  }, []);

  // ─── Estrategia de fetching ─────────────────────────────
  //
  // Hay 3 fuentes con cadencias muy distintas:
  //   - Spot mayorista (dolarapi):  cambia intra-día → refrescar periódico
  //   - REM tipo de cambio (BCRA):  publicación mensual → fetch único al cargar
  //   - Caución A3 (snapshot):      cambia solo con redeploy → fetch único al cargar
  //
  // Por eso separamos:
  //   * fetchInitial()  → trae todo. Se usa al montar el módulo y en refresh manual.
  //   * fetchSpotOnly() → solo dólar mayorista. Se dispara por el timer cada 15 min.
  //
  // Esto evita gastar tiempo y bandwidth llamando endpoints que nunca cambian
  // entre fetches, y respeta los límites de las fuentes externas.

  /** Trae solamente el spot mayorista. Para uso del timer periódico. */
  const fetchSpotOnly = async () => {
    try {
      const fxRes = await fetch("/api/dolares");
      if (fxRes.ok) {
        const fx = await fxRes.json();
        const may = fx.find((d) => (d.casa || "").toLowerCase() === "mayorista");
        if (may?.venta) setSpotMayorista(may.venta);
      }
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      console.warn("spot refresh failed", e);
    }
  };

  /** Fetch inicial / refresh manual: trae todas las fuentes. */
  const fetchInitial = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (spotMayorista == null) setLoading(true);

    try {
      // 1) FX → buscamos casa "mayorista"
      const fxRes = await fetch("/api/dolares");
      if (fxRes.ok) {
        const fx = await fxRes.json();
        const may = fx.find((d) => (d.casa || "").toLowerCase() === "mayorista");
        if (may?.venta) setSpotMayorista(may.venta);
        else if (spotMayorista == null) setSpotMayorista(DLR_SPOT_SEED);
      } else if (spotMayorista == null) {
        setSpotMayorista(DLR_SPOT_SEED);
      }

      // 2) REM tipo de cambio (publicación mensual — fetch único)
      try {
        const remRes = await fetch("/api/rem-tipo-cambio");
        if (remRes.ok) {
          const remData = await remRes.json();
          const map = {};
          (remData.datos || []).forEach((d) => {
            if (d.periodo && d.mediana != null) map[d.periodo] = d.mediana;
          });
          setRemTc(map);
        }
      } catch (e) { console.warn("REM tipo_cambio failed", e); }

      // 3) Caución desde snapshot estático A3 (cambia solo con redeploy)
      try {
        const cauRes = await fetch("/api/a3-cauciones");
        if (cauRes.ok) {
          const cauData = await cauRes.json();
          const parsed = extractCaucion1d(cauData);
          if (parsed) {
            // Capturamos el timestamp del snapshot para mostrar "actualizado hace X"
            const snapshotAt = cauRes.headers.get("X-Snapshot-Generated-At")
              || cauRes.headers.get("x-snapshot-generated-at");
            setCaucionAuto({
              ...parsed,
              snapshotAt: snapshotAt ? new Date(snapshotAt) : null,
            });
          }
        } else {
          // 404/500 → no rompemos, dejamos caer al manual
          console.warn("A3 cauciones devolvió", cauRes.status);
        }
      } catch (e) { console.warn("A3 cauciones failed", e); }

      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || "Error al cargar datos");
      if (spotMayorista == null) setSpotMayorista(DLR_SPOT_SEED);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Alias para el botón Refresh manual del header (mantiene API esperada)
  const fetchAll = fetchInitial;

  // Mount: traer todo
  useEffect(() => { fetchInitial(); /* eslint-disable-next-line */ }, []);

  // Timer periódico: solo refrescar el spot mayorista
  useEffect(() => {
    let timeoutId;
    const schedule = () => {
      const ms = getRefreshIntervalMs();
      timeoutId = setTimeout(() => { fetchSpotOnly(); schedule(); }, ms);
    };
    schedule();
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line
  }, [intervalMode]);

  // ─── Procesamiento de contratos ────────────────────────
  const spot = spotMayorista ?? DLR_SPOT_SEED;

  const contracts = useMemo(() => {
    return DLR_REGISTRY
      .map((c) => {
        const days = daysToExpiry(c.maturityDate);
        const price = priceForContract(c, storedPrices);
        if (days <= 0) return null;
        return {
          ...c,
          price,
          days,
          tna: implicitTNA(price, spot, days),
          tem: implicitTEM(price, spot, days),
          tea: implicitTEA(price, spot, days),
        };
      })
      .filter(Boolean);
  }, [storedPrices, spot]);

  // Tasa forward entre contratos consecutivos (devaluación implícita mes a mes)
  const contractsWithForward = useMemo(() => {
    return contracts.map((c, i) => {
      if (i === 0) {
        // Primer contrato: forward vs spot (= TEM implícita ajustada al spread temporal)
        const dF = c.days;
        const fwd = dF > 0 ? Math.pow(c.price / spot, 30 / dF) - 1 : null;
        return { ...c, forwardTEM: fwd };
      }
      const prev = contracts[i - 1];
      const dGap = c.days - prev.days;
      if (dGap <= 0) return { ...c, forwardTEM: null };
      const fwd = Math.pow(c.price / prev.price, 30 / dGap) - 1;
      return { ...c, forwardTEM: fwd };
    });
  }, [contracts, spot]);

  // KPI: Devaluación REM como TNA implícita (proyectada al horizonte del ultimo contrato del REM)
  const remDevTNA = useMemo(() => {
    if (!spot || Object.keys(remTc).length === 0) return null;
    // Tomamos el ultimo periodo del REM disponible
    const sortedKeys = Object.keys(remTc).sort();
    if (!sortedKeys.length) return null;
    const lastKey = sortedKeys[sortedKeys.length - 1];
    const fxFuturo = remTc[lastKey];
    if (!fxFuturo) return null;
    // Calcular días desde hoy hasta el ultimo dia del periodo
    const [yr, mo] = lastKey.split("-").map(Number);
    const targetDate = new Date(yr, mo, 0); // último día del mes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((targetDate - today) / 86400000));
    return implicitTNA(fxFuturo, spot, days);
  }, [remTc, spot]);

  // TNA implícita promedio de los contratos cortos (los primeros 3)
  const tnaProm = useMemo(() => {
    const slice = contractsWithForward.slice(0, 3).filter((c) => c.tna != null);
    if (!slice.length) return null;
    return slice.reduce((acc, c) => acc + c.tna, 0) / slice.length;
  }, [contractsWithForward]);

  const isStale = lastFetch && (now - lastFetch) / 1000 > (intervalMode === "active" ? 1080 : 2100);

  // ─── Editor de precios ─────────────────────────────────
  const openEditor = () => {
    // Inicializar buffer con valores actuales
    const buf = {};
    contracts.forEach((c) => {
      buf[c.ticker] = String(c.price);
    });
    setEditorBuffer(buf);
    setEditorCaucion(String(caucionRate));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorBuffer({});
  };

  const saveEditor = () => {
    // Parse y filtrar valores válidos
    const newPrices = {};
    Object.entries(editorBuffer).forEach(([ticker, val]) => {
      const parsed = parseFloat(String(val).replace(",", "."));
      if (parsed > 0) newPrices[ticker] = parsed;
    });
    setStoredPrices(newPrices);
    const ts = new Date();
    setPricesUpdatedAt(ts);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DLR_PRICES_LS_KEY, JSON.stringify(newPrices));
      window.localStorage.setItem(DLR_PRICES_TS_LS_KEY, ts.toISOString());
    }
    // Caución → guardar como manual y cambiar modo
    const cau = parseFloat(String(editorCaucion).replace(",", "."));
    if (cau > 0) {
      setCaucionManual(cau);
      setCaucionMode("manual");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CAUCION_LS_KEY, String(cau));
        window.localStorage.setItem(CAUCION_MODE_LS_KEY, "manual");
      }
    }
    setEditorOpen(false);
  };

  /** Vuelve al modo auto (usar el valor de A3). */
  const switchToAutoCaucion = () => {
    setCaucionMode("auto");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CAUCION_MODE_LS_KEY, "auto");
    }
  };

  const resetSeed = () => {
    setStoredPrices({});
    setPricesUpdatedAt(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DLR_PRICES_LS_KEY);
      window.localStorage.removeItem(DLR_PRICES_TS_LS_KEY);
    }
    closeEditor();
  };

  // Calculadora manual
  const calcSpotN = parseFloat(String(calcSpot).replace(/\./g, "").replace(",", "."));
  const calcFuturoN = parseFloat(String(calcFuturo).replace(/\./g, "").replace(",", "."));
  const calcDaysN = parseInt(calcDays, 10);
  const calcTNA = implicitTNA(calcFuturoN, calcSpotN, calcDaysN);
  const calcTEM = implicitTEM(calcFuturoN, calcSpotN, calcDaysN);
  const calcTEA = implicitTEA(calcFuturoN, calcSpotN, calcDaysN);

  return (
    <div className="px-6 py-5 eco-fade-in" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500 }}>
            Analizadores · Futuros vs Caución
          </span>
          <h1 className="eco-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: C.text, lineHeight: 1.1, margin: 0 }}>
            Dólar Futuro · Tasa Implícita
          </h1>
          <p style={{ fontSize: 11.5, color: C.muted, letterSpacing: "0.005em", maxWidth: 720, margin: "4px 0 0 0", lineHeight: 1.5 }}>
            Curva de contratos DLR (Matba-Rofex) y devaluación que están descontando. Compará contra caución pesos y proyección REM para detectar arbitrajes.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <StatusPill error={error} loading={loading || refreshing} isStale={isStale} lastFetch={lastFetch} now={now} />
          <RefreshButton onClick={() => fetchAll(true)} spinning={refreshing} />
        </div>
      </div>

      {/* Error inline */}
      {error && (
        <div className="flex items-start gap-3 p-4 mb-5" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.25)` }}>
          <AlertTriangle size={16} color={C.red} strokeWidth={1.8} />
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>No se pudieron cargar los datos</span>
            <span style={{ fontSize: 11, color: C.muted }}>{error}</span>
          </div>
        </div>
      )}

      {/* KPIs comparativos */}
      <SectionLabel>Indicadores de Referencia</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Spot Mayorista"
          value={spotMayorista ? `$${fmtARS(spotMayorista)}` : "—"}
          sub="BCRA A 3500"
          color={C.cat.cyan}
        />
        <CaucionKpi
          rate={caucionRate}
          mode={caucionMode}
          auto={caucionAuto}
          onSwitchToAuto={switchToAutoCaucion}
          now={now}
        />
        <KpiCard
          label="Dev. REM Implícita"
          value={remDevTNA != null ? fmtPct(remDevTNA * 100) : "—"}
          sub="TNA proyección REM"
          color={C.cat.emerald}
        />
        <KpiCard
          label="Tasa Implícita Prom."
          value={tnaProm != null ? fmtPct(tnaProm * 100) : "—"}
          sub="TNA · 3 contratos cortos"
          color={C.cat.violet}
        />
      </div>

      {/* Leyenda de los chips de estado del KPI Caución 1d.
          Aparece como un callout sutil para que el usuario entienda qué
          significa cada estado sin tener que pasar el mouse por el chip. */}
      <div
        className="flex items-start gap-2 mb-5 px-4 py-2.5"
        style={{
          backgroundColor: "rgba(246, 247, 246, 0.025)",
          borderLeft: `2px solid ${C.faint}`,
        }}
      >
        <Info size={12} color={C.dim} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 3 }} />
        <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6, letterSpacing: "0.005em" }}>
          <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 500 }}>Caución 1d:</span>{" "}
          <ChipInline color={C.green} bg="rgba(74, 222, 128, 0.10)" border="rgba(74, 222, 128, 0.30)">Auto</ChipInline> tasa de A3 Mercados (snapshot reciente).{" "}
          <ChipInline color={C.cat.violet} bg="rgba(167, 139, 250, 0.10)" border="rgba(167, 139, 250, 0.30)">Manual</ChipInline> override del usuario o sin datos disponibles (feriado, fuera de horario, snapshot no actualizado).{" "}
          <ChipInline color={C.yellow} bg="rgba(250, 204, 21, 0.10)" border="rgba(250, 204, 21, 0.30)">Viejo</ChipInline> snapshot con más de 24 horas — pendiente de actualización.
        </p>
      </div>

      {/* Editor de precios — barra superior */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 mb-3 px-4 py-2.5"
        style={{
          backgroundColor: C.panel,
          borderLeft: `2px solid ${C.cat.violet}`,
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            Precios
          </span>
          {pricesUpdatedAt ? (
            <span style={{ fontSize: 11, color: C.muted }}>
              Editados {timeAgo(pricesUpdatedAt, now)} · {pricesUpdatedAt.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: C.muted }}>
              Datos seed · {DLR_SEED_DATE}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pricesUpdatedAt && (
            <button
              onClick={resetSeed}
              style={{
                fontSize: 10,
                color: C.muted,
                backgroundColor: "transparent",
                border: `1px solid ${C.border}`,
                padding: "5px 10px",
                cursor: "pointer",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Reset seed
            </button>
          )}
          <button
            onClick={editorOpen ? closeEditor : openEditor}
            style={{
              fontSize: 10,
              color: editorOpen ? C.cat.violet : C.text,
              backgroundColor: editorOpen ? "rgba(167,139,250,0.10)" : C.cat.violet,
              border: `1px solid ${C.cat.violet}`,
              padding: "5px 12px",
              cursor: "pointer",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <Pencil size={10} strokeWidth={2} style={{ display: "inline-block", marginRight: 6, verticalAlign: -1 }} />
            {editorOpen ? "Cancelar" : "Editar precios"}
          </button>
        </div>
      </div>

      {/* Editor expandido */}
      {editorOpen && (
        <PriceEditor
          contracts={contracts}
          buffer={editorBuffer}
          setBuffer={setEditorBuffer}
          caucion={editorCaucion}
          setCaucion={setEditorCaucion}
          onSave={saveEditor}
          onCancel={closeEditor}
        />
      )}

      {/* Callout — explicación de la tabla */}
      <div
        className="flex items-start gap-2 mb-3 px-4 py-3"
        style={{
          backgroundColor: "rgba(56, 189, 248, 0.04)",
          borderLeft: `2px solid ${C.accent}`,
        }}
      >
        <Info size={13} color={C.accent} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
          La <span style={{ color: C.text, fontWeight: 500 }}>TNA implícita</span> es la devaluación anualizada que descuenta cada contrato vs el mayorista actual ($
          {spotMayorista ? fmtARS(spotMayorista) : "—"}). La <span style={{ color: C.text, fontWeight: 500 }}>Forward TEM</span> es la devaluación esperada mes a mes entre dos contratos consecutivos.{" "}
          <span style={{ color: C.green, fontWeight: 500 }}>vs Caución negativo</span> = futuro barato (vender futuro + colocar pesos en caución captura el spread).{" "}
          <span style={{ color: C.red, fontWeight: 500 }}>vs Caución positivo</span> = futuro caro (mercado descuenta más devaluación que la tasa pesos).
        </p>
      </div>

      {/* Tabla de contratos */}
      <SectionLabel>Curva de Futuros DLR</SectionLabel>
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.cyan}`, padding: "10px 14px" }}>
        {loading && contracts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} color={C.accent} className="eco-spin" strokeWidth={1.8} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Th align="left">Contrato</Th>
                  <Th align="right">Vto</Th>
                  <Th align="right">Días</Th>
                  <Th align="right">Precio</Th>
                  <Th align="right">TNA</Th>
                  <Th align="right">TEM</Th>
                  <Th align="right">TEA</Th>
                  <Th align="right">Forward TEM</Th>
                  <Th align="right" emphasized>vs Caución</Th>
                </tr>
              </thead>
              <tbody>
                {contractsWithForward.map((c) => {
                  const tnaPct = c.tna != null ? c.tna * 100 : null;
                  const spreadVsCaucion = (tnaPct != null && caucionRate) ? (tnaPct - caucionRate) : null;
                  const sColor = spreadColor(spreadVsCaucion);
                  return (
                    <tr key={c.ticker} className="eco-table-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <Td align="left">
                        <span style={{ color: C.cat.cyan, fontWeight: 600, fontSize: 13 }}>{c.displayTicker}</span>
                      </Td>
                      <Td align="right" mono>{formatDate(c.maturityDate)}</Td>
                      <Td align="right" mono><span style={{ color: C.muted }}>{c.days}</span></Td>
                      <Td align="right" mono>${fmtARS(c.price)}</Td>
                      <Td align="right" mono>
                        <span style={{ color: C.text, fontWeight: 500 }}>
                          {tnaPct != null ? fmtPct(tnaPct) : "—"}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        <span style={{ color: C.muted }}>
                          {c.tem != null ? fmtPct(c.tem * 100) : "—"}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        <span style={{ color: C.muted }}>
                          {c.tea != null ? fmtPct(c.tea * 100) : "—"}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        <span style={{ color: C.cat.emerald }}>
                          {c.forwardTEM != null ? fmtPct(c.forwardTEM * 100) : "—"}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        <span style={{ color: sColor, fontWeight: 600 }}>
                          {spreadVsCaucion != null ? `${spreadVsCaucion >= 0 ? "+" : ""}${fmtPct(spreadVsCaucion)}` : "—"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Curva de tasas implícitas */}
      <div className="mt-7">
        <div
          className="flex items-start gap-2 mb-3 px-4 py-3"
          style={{
            backgroundColor: "rgba(167, 139, 250, 0.04)",
            borderLeft: `2px solid ${C.cat.violet}`,
          }}
        >
          <Info size={13} color={C.cat.violet} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
            Cada punto es la <span style={{ color: C.text, fontWeight: 500 }}>TNA implícita</span> de un contrato. Si la curva está{" "}
            <span style={{ color: C.green, fontWeight: 500 }}>por debajo</span> de la línea de caución, el futuro está descontando menos devaluación que la tasa pesos —
            arbitraje clásico: vender futuro y colocar caución. Si está <span style={{ color: C.red, fontWeight: 500 }}>por encima</span>, el mercado descuenta salto cambiario o crisis de pesos.
          </p>
        </div>
        <SectionLabel>Curva de Tasas Implícitas</SectionLabel>
        <ImplicitRatesChart
          contracts={contractsWithForward}
          caucion={caucionRate}
          remDevTNA={remDevTNA}
        />
      </div>

      {/* Calculadora manual */}
      <div className="mt-7">
        <SectionLabel>Calculadora de Tasa Implícita</SectionLabel>
        <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.pink}`, padding: "16px 18px" }}>
          <CardHeader icon={Calculator} iconColor={C.cat.pink} label="Probá tu propio escenario" />
          <p style={{ fontSize: 11, color: C.muted, marginTop: -4, marginBottom: 14 }}>
            Ingresá Spot, Futuro y días al vencimiento. Útil para evaluar contratos no listados o escenarios hipotéticos.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <CalcInput label="Spot (ARS)" value={calcSpot} onChange={setCalcSpot} placeholder={fmtARS(spot)} />
            <CalcInput label="Futuro (ARS)" value={calcFuturo} onChange={setCalcFuturo} placeholder="ej. 1500" />
            <CalcInput label="Días al Vto" value={calcDays} onChange={setCalcDays} placeholder="ej. 90" type="number" />
          </div>
          <div className="grid grid-cols-3 gap-3" style={{ paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <CalcOutput label="TNA implícita" value={calcTNA != null ? fmtPct(calcTNA * 100) : "—"} color={C.cat.cyan} />
            <CalcOutput label="TEM implícita" value={calcTEM != null ? fmtPct(calcTEM * 100) : "—"} color={C.cat.emerald} />
            <CalcOutput label="TEA implícita" value={calcTEA != null ? fmtPct(calcTEA * 100) : "—"} color={C.cat.violet} />
          </div>
        </div>
      </div>

      {/* Bloque didáctico expandible — explica las fórmulas usadas */}
      <div className="mt-7" style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.cyan}` }}>
        <button
          onClick={() => setExplainerOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: C.text,
            textAlign: "left",
          }}
        >
          <div className="flex items-center gap-2.5">
            <BookOpenCheckIcon />
            <div className="flex flex-col">
              <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
                Cómo se calcula
              </span>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 500, marginTop: 2 }}>
                Tasas implícitas: TNA, TEM y TEA explicadas paso a paso
              </span>
            </div>
          </div>
          <ChevronDown
            size={16}
            color={C.muted}
            strokeWidth={1.6}
            style={{
              transform: explainerOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>

        {explainerOpen && (
          <div style={{ padding: "4px 18px 18px", borderTop: `1px solid ${C.border}` }}>
            <CalcExplainer />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 mt-7" style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase" }}>
        <span>fuentes:</span>
        <span style={{ color: C.muted }}>Matba-Rofex</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>A3 Mercados</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>dolarapi.com</span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>API REM (BCRA)</span>
      </div>
    </div>
  );
}

/* ─────────── Subcomponentes Futuros vs Caución ─────────── */

function KpiCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${color}`,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </div>
      <div className="eco-mono" style={{ fontSize: 18, color: C.text, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * KPI especializado de Caución 1d. Muestra el origen (A3 vs manual) en el
 * subtítulo y un mini-botón "auto" cuando el usuario está en override manual
 * pero hay un valor de A3 disponible al cual volver.
 */
/**
 * Chip pequeño usado en leyendas inline (ej. la guía de estados del
 * KPI Caución 1d). Mantiene el mismo estilo visual que los chips
 * reales del CaucionKpi para que el usuario pueda asociar cada uno
 * con su estado correspondiente.
 */
/**
 * Icono "BookOpenCheck" — un ícono SVG inline (no usamos lucide-react acá
 * porque lucide no exporta este icono específico en versiones viejas).
 * Mantiene el mismo grosor de stroke que el resto del set.
 */
function BookOpenCheckIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: C.cat.cyan }}
    >
      <path d="M12 21V7" />
      <path d="m16 12 2 2 4-4" />
      <path d="M22 6V4a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4 4 4 0 0 0-4-4H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6a1 1 0 0 0 1-1v-1.3" />
    </svg>
  );
}

/**
 * Bloque didáctico que explica paso a paso cómo se calculan las tasas
 * implícitas. Se renderiza dentro de un panel colapsable. Está pensado
 * para que un usuario sin background financiero entienda qué significa
 * cada columna de la tabla y la diferencia conceptual entre TNA, TEM y
 * TEA. Usa un ejemplo concreto con valores realistas para que se pueda
 * seguir paso a paso con calculadora en mano.
 */
function CalcExplainer() {
  return (
    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, letterSpacing: "0.005em" }}>
      <p style={{ margin: "10px 0 4px" }}>
        Toda <strong style={{ color: C.text, fontWeight: 600 }}>tasa implícita</strong> de un futuro de dólar
        parte de tres datos: el precio del contrato (<ExplainerVar>F</ExplainerVar>), el dólar spot de hoy
        (<ExplainerVar>S</ExplainerVar>) y los días que faltan hasta el vencimiento.
      </p>

      <ExplainerSection title="TNA — Tasa Nominal Anual" color={C.cat.cyan}>
        <ExplainerFormula>
          TNA = ( F / S − 1 ) × ( 365 / días )
        </ExplainerFormula>
        <p style={{ margin: "6px 0" }}>
          Mide cuánto subió el dólar entre hoy y el vencimiento, anualizado de forma <em>lineal</em>.
          Es la métrica más usada en mercado porque la <strong style={{ color: C.text }}>caución también
          se cotiza en TNA</strong>, y permite comparar directamente.
        </p>
        <ExplainerExample
          rows={[
            ["Datos", "F = 1.474 · S = 1.391 · días = 91"],
            ["Subió el dólar", "1.474 / 1.391 − 1 = 5,97%"],
            ["Anualizado", "5,97% × (365 / 91) = 23,93%"],
          ]}
        />
        <p style={{ margin: "8px 0 0", color: C.dim, fontSize: 11 }}>
          Lectura: <em>"si el dólar siguiera subiendo a este ritmo todo el año, cerraría 23,93% más arriba"</em>.
        </p>
      </ExplainerSection>

      <ExplainerSection title="TEM — Tasa Efectiva Mensual" color={C.cat.emerald}>
        <ExplainerFormula>
          TEM = ( F / S )<sup>30 / días</sup> − 1
        </ExplainerFormula>
        <p style={{ margin: "6px 0" }}>
          Mide cuánto sube el dólar <em>cada mes</em>, asumiendo capitalización compuesta. Sirve para
          comparar contra <strong style={{ color: C.text }}>inflación mensual</strong> y contra el
          crawling-peg del BCRA (~2% mensual).
        </p>
        <ExplainerExample
          rows={[
            ["Ratio futuro/spot", "1.474 / 1.391 = 1,0597"],
            ["Elevado a 30/días", "1,0597 ^ (30 / 91) = 1,0193"],
            ["Resta 1", "1,0193 − 1 = 1,93%"],
          ]}
        />
        <p style={{ margin: "8px 0 0", color: C.dim, fontSize: 11 }}>
          Lectura: <em>"al ritmo de subir 1,93% mes a mes, el dólar llega al precio del futuro en 91 días"</em>.
        </p>
      </ExplainerSection>

      <ExplainerSection title="TEA — Tasa Efectiva Anual" color={C.cat.violet}>
        <ExplainerFormula>
          TEA = ( F / S )<sup>365 / días</sup> − 1
        </ExplainerFormula>
        <p style={{ margin: "6px 0" }}>
          Igual que la TEM pero anualizada. Es la TNA "compuesta". Siempre va a ser un poco más alta que la
          TNA porque incluye el efecto de capitalización. Para el mismo ejemplo: TEA ≈ 26,17% vs TNA = 23,93%.
        </p>
      </ExplainerSection>

      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          backgroundColor: "rgba(56, 189, 248, 0.04)",
          borderLeft: `2px solid ${C.accent}`,
        }}
      >
        <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
          Forward TEM
        </span>
        <p style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.6 }}>
          La columna <strong style={{ color: C.text }}>Forward TEM</strong> de la tabla aplica la fórmula
          de TEM pero entre <em>dos contratos consecutivos</em> (en vez de spot vs futuro). Te dice qué
          devaluación implícita está descontando el mercado <strong style={{ color: C.text }}>mes a mes</strong>:
          ej. cuánto sube de mayo a junio, de junio a julio, etc. Útil para detectar saltos cambiarios
          esperados en alguna ventana específica.
        </p>
      </div>
    </div>
  );
}

/** Variable inline en el explicador (F, S, días). */
function ExplainerVar({ children }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: C.text,
        backgroundColor: C.deep,
        padding: "1px 6px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

/** Una sección dentro del explicador (TNA / TEM / TEA). */
function ExplainerSection({ title, color, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 10,
          color,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** Caja con la fórmula matemática destacada. */
function ExplainerFormula({ children }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        color: C.text,
        backgroundColor: C.deep,
        padding: "10px 14px",
        margin: "6px 0",
        textAlign: "center",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </div>
  );
}

/** Tabla mini con un ejemplo paso a paso. */
function ExplainerExample({ rows }) {
  return (
    <div
      style={{
        backgroundColor: "rgba(246, 247, 246, 0.02)",
        padding: "8px 12px",
        marginTop: 6,
        fontSize: 11.5,
      }}
    >
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>
        Ejemplo · DLR/JUL26
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i}>
              <td style={{ padding: "3px 12px 3px 0", color: C.muted, verticalAlign: "top", whiteSpace: "nowrap" }}>
                {label}
              </td>
              <td style={{ padding: "3px 0", color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChipInline({ color, bg, border, children }) {
  return (
    <span
      style={{
        fontSize: 8,
        color,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        padding: "1px 5px",
        letterSpacing: "0.10em",
        fontWeight: 600,
        textTransform: "uppercase",
        verticalAlign: "1px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function CaucionKpi({ rate, mode, auto, onSwitchToAuto, now }) {
  const isAuto = mode === "auto" && auto?.rate != null;

  // Calcular antigüedad del snapshot. Si tiene >24h, marca como "viejo".
  const snapshotAt = auto?.snapshotAt;
  let snapshotAge = null;     // string "hace X" o null
  let snapshotStale = false;  // true si > 24h
  if (snapshotAt && now) {
    const diffMs = now - snapshotAt;
    snapshotAge = timeAgo(snapshotAt, now);
    snapshotStale = diffMs > 24 * 60 * 60 * 1000;
  }

  const subText = isAuto
    ? (snapshotAge
        ? `A3 · plazo ${auto.plazo || "1d"} · ${snapshotAge}`
        : `A3 Mercados · plazo ${auto.plazo || "1d"}`)
    : (auto?.rate != null ? "Manual · override activo" : "Manual · sin datos A3");

  return (
    <div
      style={{
        backgroundColor: C.panel,
        borderTop: `2px solid ${C.cat.yellow}`,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          Caución 1d
        </div>
        {/* Indicador del origen (chip mini) — verde auto, amarillo si snapshot viejo, violeta manual */}
        {isAuto ? (
          <span
            title={snapshotStale
              ? "Snapshot con más de 24hs · pendiente de actualización"
              : "Tasa desde snapshot A3 Mercados"}
            style={{
              fontSize: 8,
              color: snapshotStale ? C.yellow : C.green,
              backgroundColor: snapshotStale ? "rgba(250, 204, 21, 0.10)" : "rgba(74, 222, 128, 0.10)",
              border: `1px solid ${snapshotStale ? "rgba(250, 204, 21, 0.30)" : "rgba(74, 222, 128, 0.30)"}`,
              padding: "1px 5px",
              letterSpacing: "0.10em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {snapshotStale ? "Viejo" : "Auto"}
          </span>
        ) : (
          <span
            title="Override manual activo"
            style={{
              fontSize: 8,
              color: C.cat.violet,
              backgroundColor: "rgba(167, 139, 250, 0.10)",
              border: `1px solid rgba(167, 139, 250, 0.30)`,
              padding: "1px 5px",
              letterSpacing: "0.10em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Manual
          </span>
        )}
      </div>
      <div className="eco-mono" style={{ fontSize: 18, color: C.text, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.1 }}>
        {rate != null ? fmtPct(rate) : "—"}
      </div>
      <div className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
        <span style={{ fontSize: 10, color: C.muted }}>{subText}</span>
        {/* Botón "Volver a auto" — solo visible si hay override y existe valor de A3 */}
        {!isAuto && auto?.rate != null && (
          <button
            onClick={onSwitchToAuto}
            style={{
              fontSize: 9,
              color: C.green,
              backgroundColor: "transparent",
              border: `1px solid rgba(74, 222, 128, 0.30)`,
              padding: "2px 7px",
              cursor: "pointer",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            ← Auto ({fmtPct(auto.rate)})
          </button>
        )}
      </div>
    </div>
  );
}

function PriceEditor({ contracts, buffer, setBuffer, caucion, setCaucion, onSave, onCancel }) {
  const updateField = (ticker, val) => {
    setBuffer((prev) => ({ ...prev, [ticker]: val }));
  };

  return (
    <div
      style={{
        backgroundColor: C.deep,
        border: `1px solid ${C.cat.violet}`,
        padding: "16px 18px",
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 10, color: C.cat.violet, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
        Editor de precios manual
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: "0 0 14px 0", lineHeight: 1.5 }}>
        Copiá los precios del visor MtR (columna "Ajuste Ant." o "Últ.") y pegá acá. Se guardan en tu navegador.
      </p>

      {/* Grilla de precios DLR */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        {contracts.map((c) => (
          <div key={c.ticker} className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 500 }}>
              {c.displayTicker}
            </label>
            <input
              type="text"
              value={buffer[c.ticker] ?? ""}
              onChange={(e) => updateField(c.ticker, e.target.value)}
              placeholder={String(c.priceSeed)}
              style={{
                backgroundColor: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                padding: "6px 10px",
                outline: "none",
                width: "100%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Caución */}
      <div
        className="grid gap-3 mb-4"
        style={{
          gridTemplateColumns: "minmax(160px, 1fr) 1fr",
          paddingTop: 14,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, color: C.dim, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 500 }}>
            Caución 1d (TNA %)
          </label>
          <input
            type="text"
            value={caucion}
            onChange={(e) => setCaucion(e.target.value)}
            placeholder="32"
            style={{
              backgroundColor: C.bg,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              padding: "6px 10px",
              outline: "none",
              width: "100%",
            }}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          style={{
            fontSize: 11,
            color: C.muted,
            backgroundColor: "transparent",
            border: `1px solid ${C.border}`,
            padding: "7px 14px",
            cursor: "pointer",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          style={{
            fontSize: 11,
            color: C.bg,
            backgroundColor: C.cat.violet,
            border: `1px solid ${C.cat.violet}`,
            padding: "7px 16px",
            cursor: "pointer",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function CalcInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 10, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          backgroundColor: C.deep,
          border: `1px solid ${C.border}`,
          color: C.text,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          padding: "8px 12px",
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
}

function CalcOutput({ label, value, color }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </span>
      <span className="eco-mono" style={{ fontSize: 20, color, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  );
}

/* ─────────── Curva de Tasas Implícitas (gráfico) ─────────── */

function ImplicitRatesChart({ contracts, caucion, remDevTNA }) {
  if (!contracts || contracts.length === 0) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>Sin datos para construir el gráfico.</span>
      </div>
    );
  }

  // Datos del scatter: x = días, y = TNA implícita (%)
  const scatterData = contracts
    .filter((c) => c.tna != null)
    .map((c) => ({
      x: c.days,
      y: c.tna * 100,
      ticker: c.displayTicker,
      maturityDate: c.maturityDate,
    }));

  if (scatterData.length === 0) {
    return (
      <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: 24, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>Sin tasas calculables — verificar spot y precios.</span>
      </div>
    );
  }

  const minX = 0;
  const maxX = Math.max(...scatterData.map((d) => d.x)) + 30;
  const allY = [
    ...scatterData.map((d) => d.y),
    caucion,
    remDevTNA != null ? remDevTNA * 100 : null,
  ].filter((v) => v != null && !isNaN(v));
  const minY = Math.min(...allY) - 3;
  const maxY = Math.max(...allY) + 3;
  const yDomain = [Math.floor(minY / 2) * 2, Math.ceil(maxY / 2) * 2];

  // Línea de la curva (los mismos puntos del scatter, conectados)
  const curveLine = [...scatterData].sort((a, b) => a.x - b.x);

  const renderDot = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4.5} fill={C.cat.cyan} stroke={C.bg} strokeWidth={1.5} />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill={C.cat.cyan}
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={600}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {payload.ticker.replace("DLR/", "")}
        </text>
      </g>
    );
  };

  const tooltipContent = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload.find((p) => p.payload && p.payload.ticker);
    if (!pt) return null;
    const data = pt.payload;
    return (
      <div
        style={{
          backgroundColor: C.deep,
          border: `1px solid ${C.borderStrong}`,
          padding: "9px 12px",
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
          minWidth: 180,
        }}
      >
        <div style={{ color: C.cat.cyan, fontWeight: 700, marginBottom: 6 }}>
          {data.ticker}
        </div>
        <div style={{ color: C.muted, fontSize: 10, marginBottom: 6 }}>
          Vto: {data.maturityDate} · {data.x}d
        </div>
        <div style={{ color: C.text, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: C.muted }}>TNA implícita</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{fmtPct(data.y)}</span>
        </div>
        {caucion != null && (
          <div
            style={{
              fontSize: 10,
              marginTop: 6,
              paddingTop: 6,
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              color: C.muted,
            }}
          >
            <span>vs Caución</span>
            <span style={{ color: spreadColor(data.y - caucion), fontWeight: 600 }}>
              {data.y - caucion >= 0 ? "+" : ""}{fmtPct(data.y - caucion)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: C.panel, borderTop: `2px solid ${C.cat.violet}`, padding: "14px 14px 18px" }}>
      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 24, right: 70, bottom: 50, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} opacity={0.4} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[minX, maxX]}
              tickFormatter={(v) => `${v}d`}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
              height={40}
            >
              <Label
                value="Días al vencimiento"
                position="insideBottom"
                offset={-30}
                style={{ fill: C.dim, fontSize: 11, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}
              />
            </XAxis>
            <YAxis
              type="number"
              domain={yDomain}
              tickFormatter={(v) => `${fmtPct(v)}`}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
              width={60}
            >
              <Label
                value="TNA implícita"
                angle={-90}
                position="insideLeft"
                offset={5}
                style={{ textAnchor: "middle", fill: C.dim, fontSize: 11, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}
              />
            </YAxis>
            <RechartsTooltip
              content={tooltipContent}
              cursor={{ stroke: C.borderStrong, strokeDasharray: "3 3", strokeWidth: 1 }}
              isAnimationActive={false}
              wrapperStyle={{ outline: "none" }}
            />

            {/* Línea horizontal: caución actual */}
            {caucion != null && (
              <ReferenceLine
                y={caucion}
                stroke={C.cat.yellow}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={{
                  value: `Caución ${fmtPct(caucion)}`,
                  position: "right",
                  fill: C.cat.yellow,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}
              />
            )}

            {/* Línea horizontal: dev. REM */}
            {remDevTNA != null && (
              <ReferenceLine
                y={remDevTNA * 100}
                stroke={C.cat.emerald}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={{
                  value: `REM ${fmtPct(remDevTNA * 100)}`,
                  position: "right",
                  fill: C.cat.emerald,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}
              />
            )}

            {/* Curva uniendo los puntos */}
            <Line
              data={curveLine}
              type="monotone"
              dataKey="y"
              xAxisId={0}
              yAxisId={0}
              stroke={C.cat.cyan}
              strokeWidth={1.5}
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls
            />

            {/* Scatter de los contratos */}
            <Scatter
              data={scatterData}
              dataKey="y"
              xAxisId={0}
              yAxisId={0}
              shape={renderDot}
              isAnimationActive={false}
              name="DLR"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda inferior */}
      <div className="flex items-center justify-center gap-5 mt-3 px-1" style={{ flexWrap: "wrap", fontSize: 10, color: C.muted, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.cat.cyan }} />
          <span>Contratos DLR</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 14, height: 1, borderTop: `2px dashed ${C.cat.yellow}` }} />
          <span>Caución 1d</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 14, height: 1, borderTop: `2px dashed ${C.cat.emerald}` }} />
          <span>REM proyectado</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Helpers compartidos ─────────── */

function typeColor(type) {
  switch (type) {
    case "lecap": return C.cat.cyan;
    case "boncap": return C.cat.lime;
    case "dual": return C.cat.violet;
    case "cer": return C.cat.pink;
    default: return C.text;
  }
}

function typeLabel(type) {
  switch (type) {
    case "lecap": return "Lecap";
    case "boncap": return "Boncap";
    case "dual": return "Dual";
    case "cer": return "CER";
    default: return type;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }).replace(/\./g, "");
}
