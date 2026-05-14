import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  FileText,
  BookOpen,
  Activity,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
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
  Check,
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
  {
    id: "reportes",
    label: "Reportes",
    icon: FileText,
    type: "group",
    children: [
      { id: "libro-operaciones", label: "Libro de operaciones", icon: BookOpen },
    ],
  },
];

export default function EcoFlowTerminal() {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState({ bcra: false, mercado: false, analizadores: false, calculadoras: false, reportes: false });
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
              <PortfolioIAModule onNavigate={setActive} />
            ) : active === "libro-operaciones" ? (
              <LibroOperacionesModule />
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
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const isWeekday = !["Sat", "Sun"].includes(wd);

  // BYMA opera:
  //   - Pre-apertura:        10:30 - 11:00 (precios se actualizan, pero
  //                          no se ejecutan órdenes hasta la apertura).
  //   - Negociación continua:11:00 - 17:00
  //   - Subasta de cierre:   17:00 - 17:05
  //
  // Como data912 publica precios desde la pre-apertura, consideramos
  // "mercado activo" desde 10:30 hasta 17:30 (margen post-cierre para
  // capturar últimas actualizaciones del feed).
  //
  // Usamos lógica de minutos para que 10:30 sea exacto y no 10:00.
  const nowMinutes = hh * 60 + mm;
  const START_MINUTES = 10 * 60 + 30; // 10:30
  const END_MINUTES = 17 * 60 + 30;   // 17:30
  const isMarketHours = nowMinutes >= START_MINUTES && nowMinutes < END_MINUTES;

  // Activo (lun a vie 10:30 a 17:30 ART): refresh cada 15 min.
  // Inactivo: cada 30 min.
  return isWeekday && isMarketHours ? 15 * 60_000 : 30 * 60_000;
}

function isActiveMarketWindow() {
  return getRefreshIntervalMs() === 15 * 60_000;
}

// Día hábil completo (lun-vie 00:00-23:59 ART). A diferencia de
// isActiveMarketWindow (que solo es true en horario de operación
// 10:30-17:30), esto cubre el día calendario entero, lo que permite
// que "P&L HOY" se siga mostrando hasta medianoche y se resetee a 0
// a las 00:00 del día siguiente.
function isWithinTradingDay() {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
  }).formatToParts(new Date()).find((p) => p.type === "weekday")?.value;
  return !["Sat", "Sun"].includes(wd);
}

// Período donde "P&L HOY" tiene sentido: lun-vie ≥ 10:30 ART (apertura
// del mercado) hasta 23:59 ART (medianoche). Antes de 10:30 del día
// hábil → P&L HOY = 0 (el mercado todavía no abrió hoy, no hay nada que
// medir contra el cierre de ayer). Después de 23:59 → 0 hasta que vuelva
// a abrir el próximo día hábil. Fin de semana → 0 todo el día.
function isTradingDayAndMarketOpened() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value;
  if (["Sat", "Sun"].includes(wd)) return false;
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hh * 60 + mm >= 10 * 60 + 30; // >= 10:30 ART
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
function PortfolioIAModule({ onNavigate }) {
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

  return <PortfolioDashboard onNavigate={onNavigate} />;
}


/* ─────────────── LibroOperacionesModule ───────────────
 *
 * Pantalla "Libro de operaciones" — el registro completo de TODOS los
 * movimientos del usuario, con filtros básicos y paginación.
 *
 * Filtros (F2 — opción B):
 *   - Tipo de instrumento (chips: Todos / Bono / Stock / Cedear / Futuro / etc.)
 *   - Compra / Venta / Ambas
 *   - Rango de fechas (desde / hasta — opcional)
 *
 * Paginación: 50 ops por página, ordenadas por fecha desc.
 *
 * Para auditoría: muestra cada operación tal cual se cargó (sin
 * consolidar). Es la vista "fuente de verdad" del Modelo A.
 */
function LibroOperacionesModule() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 size={28} color={C.muted} className="eco-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (!user) return <PortfolioAuthWall />;

  return <LibroOperacionesView />;
}

function LibroOperacionesView() {
  const { positions, loading, error, updatePosition, deletePosition } = useUserPositions();
  const bondPricesState = useBondPrices();
  // Hook de cash: necesario para mostrar y editar/borrar movements manuales
  // (deposits/withdrawals) en el libro. Los automáticos (sale_proceeds /
  // purchase_cost) NO se muestran porque ya están representados por la
  // position que los originó — eso evita duplicar info.
  const cashState = useCashMovements();

  // Filtros UI
  const [filterType, setFilterType] = useState("all");        // "all" | instrument_type | "cash"
  const [filterOperation, setFilterOperation] = useState("all"); // "all" | "buy" | "sell"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Estado de edición / borrado (igual que PortfolioDashboard, en stub)
  const [editingPosition, setEditingPosition] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  // Movement bajo edición / pendiente de borrado.
  const [editingCashMovement, setEditingCashMovement] = useState(null);
  const [confirmingDeleteCash, setConfirmingDeleteCash] = useState(null);

  const handleUpdateCurrentPrice = useCallback(async (positionId, newPrice) => {
    const patch = {
      current_price: newPrice,
      current_price_updated_at: newPrice == null ? null : new Date().toISOString(),
    };
    try {
      await updatePosition(positionId, patch);
    } catch (e) {
      console.error("Error actualizando precio:", e);
    }
  }, [updatePosition]);

  // Reseteamos página cuando cambia un filtro
  useEffect(() => { setPage(1); }, [filterType, filterOperation, dateFrom, dateTo]);

  // Solo nos interesan los movements MANUALES (los automáticos los
  // representan las positions correspondientes; mostrar ambos sería
  // duplicar info en pantalla).
  const manualMovements = useMemo(() => {
    return (cashState.movements || []).filter(
      (m) => !m.related_position_id &&
             (m.movement_type === "deposit" || m.movement_type === "withdrawal")
    );
  }, [cashState.movements]);

  // Aplicamos filtros + sort sobre el merge de positions + cash movements.
  // Cada item del array final lleva un campo `_kind` ("position" |
  // "cash_movement") y un `item` con el dato original — formato que
  // PositionsTable ya sabe renderizar.
  const filtered = useMemo(() => {
    const items = [];

    // Helper: ¿la operation type filtra como "buy" o "sell"?
    const matchesOpFilter = (kind, opOrType) => {
      if (filterOperation === "all") return true;
      if (kind === "position") {
        if (filterOperation === "buy") return opOrType !== "sell";
        return opOrType === "sell";
      }
      // Cash: deposit cuenta como "buy" (entrada de plata), withdrawal como "sell"
      // (salida). Es la analogía más cercana — si la cambia algún día, ajustar.
      if (filterOperation === "buy") return opOrType === "deposit";
      return opOrType === "withdrawal";
    };

    // 1) Positions
    if (filterType === "all" || filterType !== "cash") {
      let posRows = [...(positions || [])];
      // Filtro tipo (solo si no es "all" ni "cash")
      if (filterType !== "all" && filterType !== "cash") {
        if (filterType === "bond") {
          posRows = posRows.filter((p) =>
            p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd"
          );
        } else {
          posRows = posRows.filter((p) => p.instrument_type === filterType);
        }
      }
      for (const p of posRows) {
        if (!matchesOpFilter("position", p.operation_type)) continue;
        if (dateFrom && (p.entry_date || "") < dateFrom) continue;
        if (dateTo && (p.entry_date || "") > dateTo) continue;
        items.push({
          _kind: "position",
          item: p,
          sortDate: p.entry_date || "",
          sortCreated: p.created_at || "",
        });
      }
    }

    // 2) Cash movements manuales
    if (filterType === "all" || filterType === "cash") {
      for (const m of manualMovements) {
        if (!matchesOpFilter("cash_movement", m.movement_type)) continue;
        if (dateFrom && (m.movement_date || "") < dateFrom) continue;
        if (dateTo && (m.movement_date || "") > dateTo) continue;
        items.push({
          _kind: "cash_movement",
          item: m,
          sortDate: m.movement_date || "",
          sortCreated: m.created_at || "",
        });
      }
    }

    // Sort por fecha desc, created_at desc como tiebreaker
    items.sort((a, b) => {
      if (a.sortDate !== b.sortDate) return b.sortDate.localeCompare(a.sortDate);
      return (b.sortCreated || "").localeCompare(a.sortCreated || "");
    });

    return items;
  }, [positions, manualMovements, filterType, filterOperation, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Tipos presentes para chips dinámicos
  const presentTypes = useMemo(() => {
    const set = new Set();
    for (const p of (positions || [])) {
      if (p.instrument_type === "bond_ars" || p.instrument_type === "bond_usd") {
        set.add("bond");
      } else {
        set.add(p.instrument_type);
      }
    }
    return Array.from(set);
  }, [positions]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 size={28} color={C.muted} className="eco-spin" strokeWidth={1.5} />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 32, color: C.red, fontSize: 13 }}>
        Error cargando operaciones: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px 80px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: C.dim,
          textTransform: "uppercase",
          fontWeight: 600,
        }}>
          Reportes · Beta
        </span>
      </div>
      <h1 style={{
        fontFamily: "'Raleway', sans-serif",
        fontWeight: 700,
        fontSize: 32,
        color: C.text,
        margin: 0,
        marginBottom: 6,
      }}>
        Libro de operaciones
      </h1>
      <p style={{ fontSize: 13, color: C.muted, marginTop: 0, marginBottom: 24 }}>
        Registro completo de todos tus movimientos — {(positions?.length || 0) + manualMovements.length} en total
        {manualMovements.length > 0 && (
          <span style={{ color: C.dim }}>
            {" "}({positions?.length || 0} operaciones · {manualMovements.length} movimientos de efectivo)
          </span>
        )}.
      </p>

      {/* Filtros */}
      <div style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        padding: "16px 18px",
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: C.dim,
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 12,
        }}>
          Filtros
        </div>

        {/* Chips por tipo */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Instrumento
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip
              active={filterType === "all"}
              onClick={() => setFilterType("all")}
              label={`Todos (${(positions?.length || 0) + manualMovements.length})`}
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
                  active={filterType === type}
                  onClick={() => setFilterType(type)}
                  label={`${meta.label} (${count})`}
                  color={meta.color}
                />
              );
            })}
            {/* Chip especial "Efectivo": filtra solo cash movements manuales.
                Solo se muestra si hay al menos uno cargado. */}
            {manualMovements.length > 0 && (
              <FilterChip
                active={filterType === "cash"}
                onClick={() => setFilterType("cash")}
                label={`Efectivo (${manualMovements.length})`}
              />
            )}
          </div>
        </div>

        {/* Chips por op */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tipo de operación
          </div>
          <div className="flex items-center gap-2">
            <FilterChip
              active={filterOperation === "all"}
              onClick={() => setFilterOperation("all")}
              label="Todas"
            />
            <FilterChip
              active={filterOperation === "buy"}
              onClick={() => setFilterOperation("buy")}
              label="Compras / Ingresos"
            />
            <FilterChip
              active={filterOperation === "sell"}
              onClick={() => setFilterOperation("sell")}
              label="Ventas / Retiros"
            />
          </div>
        </div>

        {/* Rango de fechas */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Desde
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                backgroundColor: C.deep,
                border: `1px solid ${C.border}`,
                color: C.text,
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hasta
            </div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                backgroundColor: C.deep,
                border: `1px solid ${C.border}`,
                color: C.text,
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
              }}
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{
                marginTop: 18,
                fontSize: 11,
                color: C.dim,
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>

      {/* Resultados header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: C.dim,
          textTransform: "uppercase",
          fontWeight: 600,
        }}>
          Resultados ({filtered.length})
        </span>
        {totalPages > 1 && (
          <span style={{ fontSize: 10, color: C.dim }}>
            Página {page} de {totalPages}
          </span>
        )}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div
          style={{
            backgroundColor: C.panel,
            border: `1px solid ${C.border}`,
            padding: "32px",
            textAlign: "center",
            fontSize: 13,
            color: C.dim,
          }}
        >
          {(positions?.length === 0 && manualMovements.length === 0)
            ? "Todavía no cargaste ninguna operación ni movimiento de efectivo."
            : "No hay registros que coincidan con los filtros aplicados."}
        </div>
      ) : (
        <PositionsTable
          rows={pagedRows}
          bondPrices={bondPricesState.prices}
          onEdit={(p) => setEditingPosition(p)}
          onDelete={(p) => setConfirmingDelete(p)}
          onUpdatePrice={handleUpdateCurrentPrice}
          onEditCashMovement={(m) => setEditingCashMovement(m)}
          onDeleteCashMovement={(m) => setConfirmingDeleteCash(m)}
        />
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 16 }}>
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            style={paginationBtnStyle(page === 1)}
          >
            ‹‹
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={paginationBtnStyle(page === 1)}
          >
            ‹
          </button>
          <span style={{ fontSize: 11, color: C.muted, padding: "0 12px" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={paginationBtnStyle(page === totalPages)}
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            style={paginationBtnStyle(page === totalPages)}
          >
            ››
          </button>
        </div>
      )}

      {/* Modales (reusados del dashboard) */}
      {confirmingDelete && (
        <DeleteConfirmModal
          position={confirmingDelete}
          onCancel={() => setConfirmingDelete(null)}
          onConfirm={async () => {
            try {
              await deletePosition(confirmingDelete.id);
            } finally {
              setConfirmingDelete(null);
            }
          }}
        />
      )}

      {/* Modal de edición de cash movement (reusado del dashboard) */}
      {editingCashMovement && (
        <CashMovementModal
          type={editingCashMovement.movement_type}
          editingMovement={editingCashMovement}
          onCancel={() => setEditingCashMovement(null)}
          onSubmit={async (payload) => {
            await cashState.updateManualMovement(editingCashMovement.id, payload);
            setEditingCashMovement(null);
          }}
        />
      )}

      {/* Modal de confirmación de borrado de cash movement */}
      {confirmingDeleteCash && (
        <DeleteCashMovementModal
          movement={confirmingDeleteCash}
          onCancel={() => setConfirmingDeleteCash(null)}
          onConfirm={async () => {
            await cashState.deleteManualMovement(confirmingDeleteCash.id);
            setConfirmingDeleteCash(null);
          }}
        />
      )}
    </div>
  );
}

function paginationBtnStyle(disabled) {
  return {
    backgroundColor: C.panel,
    border: `1px solid ${C.border}`,
    color: disabled ? C.dim : C.muted,
    padding: "5px 10px",
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'JetBrains Mono', monospace",
    minWidth: 32,
  };
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
    quantityLabel: "Cantidad / VN",
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
    quantityLabel: "Cantidad / VN",
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
    quantityLabel: "Cantidad / VN",
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
    quantityLabel: "Cantidad / VN",
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
    quantityLabel: "Cantidad / VN",
    quantityHint: "Cuotapartes",
    priceLabel: "Precio",
    priceHint: "VCP (valor cuotaparte)",
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
/**
 * Detecta si un ticker LOOKS como bono soberano del Tesoro/Estado argentino,
 * para excluirlo del dropdown de Acciones / CEDEARs / ONs / Futuros donde
 * no corresponde.
 *
 * Tickers que matchean (heurística por patrón):
 *   - Lecaps / Boncaps:  S29Y6, T30J6, TTM26, TTJ26, etc.
 *   - Hard-dollar:       AL30, GD30, AE38, GE39, etc.
 *   - Variantes plaza:   AL30C, AL30D (sufijos C/D para CCL/MEP).
 *
 * Si está en BOND_REGISTRY o matchea uno de estos patrones, lo consideramos
 * "looks like a sovereign bond" y lo filtramos del catálogo dinámico.
 *
 * Esta heurística es DEFENSIVA, no autoritativa: si la BD viene bien
 * categorizada el filtro no excluye nada legítimo. Si la BD viene sucia
 * (caso actual con boncaps clasificados como stock), el filtro los oculta.
 */
function looksLikeSovereignBond(ticker) {
  if (!ticker || typeof ticker !== "string") return false;
  const t = ticker.toUpperCase().trim();
  if (BOND_REGISTRY[t]) return true;
  // Lecaps/Boncaps Tesoro: S29Y6, T30J6, TTJ26, etc.
  if (/^(S\d{2}[A-Z]\d|T\d{2}[A-Z]\d|TT[A-Z]\d{2})$/.test(t)) return true;
  // Hard-dollar Bonares/Globales (con o sin sufijo C/D de plaza):
  // AL29, AL30, AE38, GD30, GE29, etc.
  if (/^(AL|AE|GD|GE)\d{2,3}[CD]?$/.test(t)) return true;
  // Bonos legacy: TVPA/TVPE/TVPP/TVPY (cupones PBI), TX26/TX28/TX31 (Boncer),
  // PR/DI/DA/PB/PA (Discount/Par y derivados). Suelen aparecer mal
  // categorizados como stock_arg en data912.
  if (/^TVP[A-Z]?[CD]?$/.test(t)) return true;
  if (/^TX\d{2}[CD]?$/.test(t)) return true;
  if (/^(PR|DI|DA|PB|PA)\d/.test(t)) return true;
  return false;
}

/**
 * Patrón de Bonares (AL) y Globales (GD) hard-dollar, con sufijos C/D
 * opcionales que indican plaza (CCL/MEP).
 */
const BONAR_PATTERN = /^AL\d{2,3}[CD]?$/;
const GLOBAL_PATTERN = /^GD\d{2,3}[CD]?$/;
const HARD_DOLLAR_OTHER = /^(AE|GE)\d{2,3}[CD]?$/;


/* ─────────────── STOCK_REGISTRY (acciones argentinas BYMA) ─────────────
 *
 * Descripciones de las acciones argentinas que cotizan en BYMA. La idea es
 * darle al usuario el nombre de la empresa al lado del ticker en el
 * dropdown del drawer (sino le quedan sólo los códigos sin contexto).
 *
 * Cobertura: panel principal del Merval + secundario con liquidez
 * razonable. Si aparece un ticker fuera del registry (panel chico, OPAs
 * recientes, etc.) cae al grupo "Otros".
 *
 * Las plaza-variants (sufijo D para MEP, C para CCL) NO están listadas
 * acá — se derivan automáticamente del ticker base + sufijo.
 *
 * Si se agrega una empresa nueva, alcanza con sumar el ticker con su
 * descripción legible. No hace falta tocar más código.
 */
const STOCK_REGISTRY = {
  // Panel principal Merval
  "ALUA":    "Aluar S.A.",
  "BBAR":    "BBVA Argentina",
  "BMA":     "Banco Macro",
  "BYMA":    "Bolsas y Mercados Argentinos",
  "CEPU":    "Central Puerto",
  "COME":    "Soc. Comercial del Plata",
  "CRES":    "Cresud",
  "CVH":     "Cablevisión Holding",
  "EDN":     "Edenor",
  "GGAL":    "Grupo Financiero Galicia",
  "HARG":    "Holcim Argentina",
  "LOMA":    "Loma Negra",
  "METR":    "MetroGas",
  "MIRG":    "Mirgor",
  "PAMP":    "Pampa Energía",
  "SUPV":    "Grupo Supervielle",
  "TECO2":   "Telecom Argentina",
  "TGNO4":   "Transportadora de Gas del Norte",
  "TGSU2":   "Transportadora de Gas del Sur",
  "TRAN":    "Transener",
  "TXAR":    "Ternium Argentina",
  "VALO":    "Banco de Valores",
  "YPFD":    "YPF",

  // Panel general
  "AGRO":    "Agrometal",
  "AUSO":    "Autopistas del Sol",
  "BHIP":    "Banco Hipotecario",
  "BOLT":    "Boldt",
  "BPAT":    "Banco Patagonia",
  "CADO":    "Carlos Casado",
  "CAPX":    "Capex",
  "CARC":    "Carboclor",
  "CECO2":   "Central Costanera",
  "CELU":    "Celulosa Argentina",
  "CGPA2":   "Camuzzi Gas Pampeana",
  "CTIO":    "Consultatio",
  "DGCE":    "Distribuidora de Gas Cuyana (Clase E)",
  "DGCU2":   "Distribuidora Gas Cuyana",
  "DOME":    "Domec",
  "DYCA":    "Dycasa",
  "ECOG":    "Ecogas Inversiones",
  "EDSH":    "Edesur Holdings",
  "FERR":    "Ferrum",
  "FIPL":    "Fiplasto",
  "GAMI":    "Garovaglio y Zorraquín",
  "GARO":    "Garovaglio y Zorraquín",
  "GBAN":    "Gas Natural BAN",
  "GCDI":    "Grupo Concesionario del Oeste",
  "GCLA":    "Grupo Clarín",
  "GRIM":    "Grimoldi",
  "HAVA":    "Havanna",
  "HSAT":    "Hidroeléctrica Sat",
  "IEB":     "I.E.B. (Inversora Eléctrica Buenos Aires)",
  "INAG":    "Instituto Rosenbusch",
  "INTR":    "Compañía Introductora de Buenos Aires",
  "INVJ":    "Inversora Juramento",
  "IRSA":    "IRSA Inversiones y Representaciones",
  "LEDE":    "Ledesma",
  "LONG":    "Longvie",
  "MERA":    "Meranol",
  "MOLA":    "Molinos Agro",
  "MOLI":    "Molinos Río de la Plata",
  "MORI":    "Morixe",
  "OEST":    "Oeste Editorial",
  "PATA":    "Importadora y Exportadora de la Patagonia",
  "POLL":    "Polledo",
  "RAGH":    "Rosario Administradora",
  "REGE":    "Regente Bursátil",
  "RICH":    "Laboratorios Richmond",
  "RIGO":    "Rigolleau",
  "ROSE":    "Instituto Rosenbusch",
  "SAMI":    "San Miguel",
  "SEMI":    "Semino",
  "TGLT":    "TGLT",
  "A3":      "A3 Mercados",
};


/* ─────────────── STOCK_PLAZA_ALIASES ─────────────
 *
 * Tickers de plaza USD que NO siguen el patrón estándar (ticker_base + D
 * o ticker_base + C). Algunas empresas tienen sus variantes plaza con
 * codificación distinta porque el ticker base tiene número o sufijo
 * que se trunca.
 *
 * Ejemplos del catálogo BYMA:
 *   TECO2 (Telecom Argentina ARS)  →  TECOD (MEP) — el "2" se cae
 *   TGNO4 (TGN ARS)                →  TGN4D (MEP) — re-shuffle
 *   TGSU2 (TGS ARS)                →  TGSUD (MEP) — el "2" se cae
 *
 * Mapping ticker_variant → { base, plaza }. detectPlaza() consulta
 * primero acá antes de aplicar la heurística genérica de sufijo.
 */
const STOCK_PLAZA_ALIASES = {
  "TECOD":   { base: "TECO2", plaza: "USD-MEP" },
  "TECOC":   { base: "TECO2", plaza: "USD-CCL" },
  "TGN4D":   { base: "TGNO4", plaza: "USD-MEP" },
  "TGN4C":   { base: "TGNO4", plaza: "USD-CCL" },
  "TGSUD":   { base: "TGSU2", plaza: "USD-MEP" },
  "TGSUC":   { base: "TGSU2", plaza: "USD-CCL" },
};


/* ─────────────── CEDEAR_REGISTRY ─────────────
 *
 * CEDEARs (Certificados de Depósito Argentinos) de las empresas más
 * operadas. La lista completa de BYMA tiene ~600 CEDEARs, acá ponemos
 * los ~80 más populares — el resto cae a "Otros" pero sigue listándose.
 *
 * El sufijo D significa MEP (USD), y C significa CCL (USD CCL).
 *   AAPL  → Apple Inc.
 *   AAPLD → Apple Inc. (USD MEP)
 *   AAPLC → Apple Inc. (USD CCL)
 *
 * Acá listamos solo el ticker base ARS. Las variantes USD se derivan.
 */
const CEDEAR_REGISTRY = {
  // Big Tech / FAANG / Hardware
  "AAPL":  "Apple Inc.",
  "MSFT":  "Microsoft Corp.",
  "GOOGL": "Alphabet (Google) Class A",
  "AMZN":  "Amazon.com Inc.",
  "META":  "Meta Platforms (Facebook)",
  "NFLX":  "Netflix Inc.",
  "TSLA":  "Tesla Inc.",
  "NVDA":  "NVIDIA Corp.",
  "AMD":   "Advanced Micro Devices",
  "INTC":  "Intel Corp.",
  "ORCL":  "Oracle Corp.",
  "CRM":   "Salesforce Inc.",
  "ADBE":  "Adobe Inc.",
  "PYPL":  "PayPal Holdings",
  "SHOP":  "Shopify Inc.",
  "UBER":  "Uber Technologies",
  "PLTR":  "Palantir Technologies",
  "BABA":  "Alibaba Group",
  "TSM":   "Taiwan Semiconductor",
  "MELI":  "MercadoLibre",
  "SPOT":  "Spotify Technology",
  "SNAP":  "Snap Inc.",
  "PINS":  "Pinterest Inc.",
  "ZM":    "Zoom Video",
  "ROKU":  "Roku Inc.",
  "TWLO":  "Twilio Inc.",
  "ABNB":  "Airbnb Inc.",
  "DOCU":  "DocuSign Inc.",
  "SNOW":  "Snowflake Inc.",
  "PATH":  "UiPath Inc.",
  "EBAY":  "eBay Inc.",
  "ETSY":  "Etsy Inc.",
  "BIDU":  "Baidu Inc.",
  "JD":    "JD.com Inc.",
  "PDD":   "PDD Holdings (Pinduoduo)",
  "NTES":  "NetEase Inc.",
  "JOYY":  "JOYY Inc.",
  "TCOM":  "Trip.com Group",
  "BIIB":  "Biogen Inc.",
  "GLOB":  "Globant S.A.",
  "ASML":  "ASML Holding",
  "AVGO":  "Broadcom Inc.",
  "QCOM":  "Qualcomm Inc.",
  "TXN":   "Texas Instruments",
  "MU":    "Micron Technology",
  "AMAT":  "Applied Materials",
  "LRCX":  "Lam Research",
  "ADI":   "Analog Devices",
  "MRVL":  "Marvell Technology",
  "INFY":  "Infosys Ltd.",
  "WBO":   "Warner Bros. Discovery",
  "CSCO":  "Cisco Systems",
  "IBM":   "IBM Corp.",
  "HPQ":   "HP Inc.",
  "DELL":  "Dell Technologies",
  "ADP":   "Automatic Data Processing",
  "MSI":   "Motorola Solutions",
  "NOW":   "ServiceNow Inc.",
  "TEAM":  "Atlassian Corp.",
  "WDAY":  "Workday Inc.",
  "VRSN":  "VeriSign Inc.",
  "PANW":  "Palo Alto Networks",
  "FSLR":  "First Solar Inc.",
  "SE":    "Sea Limited",
  "NIO":   "NIO Inc.",
  "XPEV":  "XPeng Inc.",
  "RBLX":  "Roblox Corp.",
  "U":     "Unity Software",
  "COIN":  "Coinbase Global",
  "RIOT":  "Riot Platforms",
  "MSTR":  "MicroStrategy",
  "MARA":  "Marathon Digital",
  "HUT":   "Hut 8 Mining",
  "IREN":  "Iris Energy",
  "SATL":  "Satellogic",
  "ASTS":  "AST SpaceMobile",
  "RKLB":  "Rocket Lab USA",
  "JMIA":  "Jumia Technologies",
  "GRMN":  "Garmin Ltd.",
  "EA":    "Electronic Arts",
  "SWKS":  "Skyworks Solutions",
  "SE_":   "Sea Limited",
  "ARM":   "Arm Holdings",
  "DECK":  "Deckers Outdoor",
  "ANF":   "Abercrombie & Fitch",
  "URBN":  "Urban Outfitters",
  "RGTI":  "Rigetti Computing",
  "OKLO":  "Oklo Inc.",
  "BMNR":  "Bitmine Immersion",
  "ADS":   "Alliance Data Systems",
  "CEG":   "Constellation Energy",
  "FDX":   "FedEx Corp.",
  "HWM":   "Howmet Aerospace",
  "KGC":   "Kinross Gold",
  "LVS":   "Las Vegas Sands",
  "UL":    "Unilever PLC",
  "UNH":   "UnitedHealth Group",
  "UNP":   "Union Pacific",
  "CLS":   "Celestica Inc.",
  "CRWV":  "CoreWeave",
  "TEM":   "Tempus AI",
  "VST":   "Vistra Corp.",
  "TRVV":  "Trivve Inc.",
  "AI":    "C3.ai Inc.",
  "ALAB":  "Astera Labs",
  "PD":    "PagerDuty",
  "UPST":  "Upstart Holdings",
  "TRIP":  "TripAdvisor",
  "BX":    "Blackstone",
  "BKNG":  "Booking Holdings",
  "EXPE":  "Expedia Group",
  "CSCO_":  "Cisco Systems",

  // Bancos / Financieras
  "JPM":   "JPMorgan Chase",
  "BAC":   "Bank of America",
  "WFC":   "Wells Fargo",
  "C":     "Citigroup Inc.",
  "GS":    "Goldman Sachs",
  "MS":    "Morgan Stanley",
  "V":     "Visa Inc.",
  "MA":    "Mastercard Inc.",
  "AXP":   "American Express",
  "BRKB":  "Berkshire Hathaway B",
  "USB":   "U.S. Bancorp",
  "SCHW":  "Charles Schwab",
  "BK":    "Bank of New York Mellon",
  "AIG":   "American International Group",
  "AEG":   "Aegon N.V.",
  "ALL":   "Allstate Corp.",
  "TROW":  "T. Rowe Price",
  "LNC":   "Lincoln National",
  "STT":   "State Street",
  "FNMA":  "Fannie Mae",
  "BCS":   "Barclays plc",
  "ING":   "ING Group",
  "DB":    "Deutsche Bank",
  "HSB":   "HSBC Holdings",
  "BBV":   "BBVA",
  "SAN":   "Banco Santander",
  "LYG":   "Lloyds Banking Group",
  "MUFG":  "Mitsubishi UFJ Financial",
  "MFG":   "Mizuho Financial",
  "NMR":   "Nomura Holdings",
  "KB":    "KB Financial Group",
  "TD":    "Toronto-Dominion Bank",
  "RY":    "Royal Bank of Canada",
  "BMO":   "Bank of Montreal",
  "BNS":   "Bank of Nova Scotia",
  "CM":    "Canadian Imperial Bank",
  "ITUB":  "Itaú Unibanco",
  "ITUB3": "Itaú Unibanco PN (B3)",
  "BBD":   "Banco Bradesco",
  "BBDC":  "Banco Bradesco",
  "BBDC3": "Banco Bradesco PN (B3)",
  "BSBR":  "Banco Santander Brasil",
  "BBAS3": "Banco do Brasil (B3)",
  "BCS_":   "Barclays",
  "WF":    "Woori Financial Group",
  "GL":    "Globe Life Inc.",
  "SPGI":  "S&P Global Inc.",

  // Healthcare / Pharma
  "JNJ":   "Johnson & Johnson",
  "PFE":   "Pfizer Inc.",
  "MRK":   "Merck & Co.",
  "ABBV":  "AbbVie Inc.",
  "BMY":   "Bristol-Myers Squibb",
  "LLY":   "Eli Lilly & Co.",
  "AMGN":  "Amgen Inc.",
  "GILD":  "Gilead Sciences",
  "MRNA":  "Moderna Inc.",
  "VRTX":  "Vertex Pharmaceuticals",
  "REGN":  "Regeneron Pharmaceuticals",
  "ISRG":  "Intuitive Surgical",
  "DHR":   "Danaher Corp.",
  "TMO":   "Thermo Fisher Scientific",
  "MDT":   "Medtronic plc",
  "ABT":   "Abbott Laboratories",
  "CVS":   "CVS Health",
  "CAH":   "Cardinal Health",
  "SYY":   "Sysco Corp.",
  "GSK":   "GlaxoSmithKline",
  "AZN":   "AstraZeneca",
  "NVS":   "Novartis AG",
  "NOVO":  "Novo Nordisk",
  "SIEGY": "Siemens AG",

  // Consumo / Retail
  "KO":    "Coca-Cola Co.",
  "PEP":   "PepsiCo Inc.",
  "WMT":   "Walmart Inc.",
  "MCD":   "McDonald's Corp.",
  "NKE":   "Nike Inc.",
  "DIS":   "Walt Disney Co.",
  "DISN":  "Walt Disney Co.",
  "SBUX":  "Starbucks Corp.",
  "PG":    "Procter & Gamble",
  "VZ":    "Verizon Communications",
  "T":     "AT&T Inc.",
  "TMUS":  "T-Mobile US",
  "F":     "Ford Motor Co.",
  "GM":    "General Motors",
  "STLA":  "Stellantis N.V.",
  "TM":    "Toyota Motor",
  "HMY":   "Harmony Gold Mining",
  "HMC":   "Honda Motor",
  "RACE":  "Ferrari N.V.",
  "BA":    "Boeing Co.",
  "CAT":   "Caterpillar Inc.",
  "DE":    "Deere & Company",
  "GE":    "General Electric",
  "MMM":   "3M Company",
  "HD":    "Home Depot",
  "LOW":   "Lowe's Companies",
  "TGT":   "Target Corp.",
  "COST":  "Costco Wholesale",
  "MDLZ":  "Mondelez International",
  "MO":    "Altria Group",
  "PM":    "Philip Morris International",
  "CL":    "Colgate-Palmolive",
  "KMB":   "Kimberly-Clark",
  "HSY":   "Hershey Co.",
  "DEO":   "Diageo plc",
  "FMX":   "Fomento Económico Mexicano",
  "ABEV":  "Ambev S.A.",
  "ABEV3": "Ambev (B3)",
  "FD":    "Fluence Energy",
  "TJX":   "TJX Companies",
  "ROST":  "Ross Stores",
  "JCI":   "Johnson Controls",
  "MS_":    "Morgan Stanley",
  "CAR":   "Avis Budget Group",
  "DAL":   "Delta Air Lines",
  "UAL":   "United Airlines",
  "AAL":   "American Airlines",
  "LUV":   "Southwest Airlines",
  "CCL":   "Carnival Corporation",
  "RCL":   "Royal Caribbean Cruises",
  "NCLH":  "Norwegian Cruise Line",
  "MAR":   "Marriott International",
  "HOG":   "Harley-Davidson",
  "GIL":   "Gildan Activewear",
  "AAP":   "Advance Auto Parts",
  "AVY":   "Avery Dennison",
  "ACN":   "Accenture plc",
  "PCAR":  "PACCAR Inc.",

  // Energía / Oil & Gas
  "XOM":   "Exxon Mobil",
  "CVX":   "Chevron Corp.",
  "BP":    "BP p.l.c.",
  "SHEL":  "Shell plc",
  "TTE":   "TotalEnergies SE",
  "EQNR":  "Equinor ASA",
  "PBR":   "Petrobras",
  "PETR":  "Petrobras",
  "PETR3": "Petrobras (B3)",
  "VIST":  "Vista Energy",
  "OXY":   "Occidental Petroleum",
  "SLB":   "Schlumberger Ltd.",
  "BKR":   "Baker Hughes",
  "HAL":   "Halliburton Co.",
  "MOS":   "Mosaic Co.",
  "PSX":   "Phillips 66",
  "VAL3":  "Vale (B3)",
  "VALE":  "Vale S.A.",
  "VALE3": "Vale (B3)",
  "RIO":   "Rio Tinto plc",
  "FCX":   "Freeport-McMoRan",
  "GOLD":  "Barrick Gold",
  "AEM":   "Agnico Eagle Mines",
  "NEM":   "Newmont Corp.",
  "GFI":   "Gold Fields Ltd.",
  "HL":    "Hecla Mining",
  "PAAS":  "Pan American Silver",
  "CDE":   "Coeur Mining",
  "MUX":   "McEwen Mining",
  "BHP":   "BHP Group",
  "BAK":   "Braskem S.A.",
  "DD":    "DuPont de Nemours",
  "DOW":   "Dow Inc.",
  "ECL":   "Ecolab Inc.",
  "IFF":   "International Flavors & Fragrances",
  "SCCO":  "Southern Copper",
  "GGB":   "Gerdau S.A.",
  "SUZ":   "Suzano S.A.",
  "SUZB3": "Suzano (B3)",
  "CSNA3": "CSN (B3)",
  "SID":   "Companhia Siderúrgica Nacional",
  "CX":    "CEMEX S.A.B.",
  "ELP":   "Companhia Paranaense de Energía",
  "SBS":   "SABESP",
  "SBSP3": "SABESP (B3)",
  "EBR":   "Eletrobras",
  "ERI":   "Eli Lilly Argentina S.A.",
  "ERJ":   "Embraer S.A.",
  "EMBJ":  "Embraer (B3)",

  // Argentinas / Latinoamericanas en NYSE
  "YPFD":  "YPF S.A. (NYSE)",
  "GGAL":  "Galicia (NYSE)",
  "BMA":   "Banco Macro (NYSE)",
  "BBAR":  "BBVA Argentina (NYSE)",
  "PAM":   "Pampa Energía (NYSE)",
  "TGS":   "TGS (NYSE)",
  "EDN":   "Edenor (NYSE)",
  "TEO":   "Telecom Argentina (NYSE)",
  "IRS":   "IRSA (NYSE)",
  "LOMA":  "Loma Negra (NYSE)",
  "CRESY": "Cresud (NASDAQ)",
  "CRES_": "Cresud (NASDAQ)",
  "SUPV":  "Supervielle (NYSE)",
  "CEPU":  "Central Puerto (NYSE)",
  "CAAP":  "Corporación América Airports",
  "BIOX":  "Bioceres Crop Solutions",
  "TIMB":  "TIM S.A.",
  "TIMS3": "TIM S.A. (B3)",
  "ARCO":  "Arcos Dorados",
  "GPRK":  "GeoPark Ltd.",
  "AMX":   "América Móvil",
  "TV":    "Grupo Televisa",
  "ASR":   "Grupo Aeroportuario del Sureste",
  "PA":    "Pampa Energía",
  "BPA11": "Banco Patagonia (BDR)",

  // Brasil / Latam (B3)
  "MGLU3": "Magazine Luiza (B3)",
  "VIVT3": "Telefônica Brasil (B3)",
  "WEGE3": "WEG S.A. (B3)",
  "RENT3": "Localiza Rent a Car (B3)",
  "LREN3": "Lojas Renner (B3)",
  "NATU3": "Natura & Co (B3)",
  "PRIO3": "PetroRio (B3)",
  "HAPV3": "Hapvida (B3)",
  "NU":    "Nubank Holdings",
  "NAT3":  "Natura & Co",
  "STNE":  "StoneCo Ltd.",
  "PAGS":  "PagSeguro Digital",
  "INT":   "Interconexión Eléctrica",
  "VIV":   "Telefônica Brasil",
  "UGP":   "Ultrapar Participações",

  // Otros internacionales / ADRs
  "SAP":   "SAP SE",
  "SONY":  "Sony Group",
  "TXR":   "Tower Semiconductor",
  "VOD":   "Vodafone Group",
  "VC":    "Visteon Corp.",
  "NGG":   "National Grid plc",
  "PHG":   "Koninklijke Philips",
  "BAYN":  "Bayer AG",
  "KEP":   "Korea Electric Power",
  "SMSN":  "Samsung Electronics",
  "NOKA":  "Nokia Corp.",
  "AKO.B": "Embotelladora Andina Class B",
  "AKOB":  "Embotelladora Andina B",
  "FNMA_": "Fannie Mae",
  "GT":    "Goodyear Tire & Rubber",
  "WBA":   "Walgreens Boots Alliance",
  "NUE":   "Nucor Corp.",
  "INFY_": "Infosys Ltd.",
  "HOG_":   "Harley-Davidson",
  "ADGO":  "Ado Properties / Adagene",
  "BB":    "BlackBerry Ltd.",
  "ETSY_": "Etsy Inc.",
  "OXY_":   "Occidental Petroleum",
  "PKS":   "PHX Minerals",
  "X":     "United States Steel",
  "RTX":   "Raytheon Technologies",
  "HON":   "Honeywell International",
  "IBN":   "ICICI Bank",
  "HDB":   "HDFC Bank",
  "HM":    "Hartford Financial",
  "JCI_":  "Johnson Controls",
  "LMT":   "Lockheed Martin",
  "NOC":   "Northrop Grumman",
  "ITA":   "iShares Aerospace & Defense",
  "IP":    "International Paper",
  "LN":    "Lennar Corporation",
  "VLO":   "Valero Energy",
  "OXY1":  "Occidental Petroleum",
  "URBN_": "Urban Outfitters",
  "DECK_": "Deckers Outdoor",
  "EFX":   "Equifax Inc.",
  "PG_":   "Procter & Gamble",
  "MO_":    "Altria",
  "FXI":   "iShares China Large-Cap",
  "XL":    "XL Group",
  "XYZ":   "Block Inc. (Square)",
  "XPEV_": "XPeng",
  "AM":    "Antero Midstream",
  "ALA":   "AltaGas Ltd.",
  "ETR":   "Entergy Corp.",
  "EQT":   "EQT Corporation",
  "ENB":   "Enbridge Inc.",
  "TRP":   "TC Energy",
  "TC":    "TuanChe Limited",
  "CC":    "Chemours Company",
  "CL_":    "Colgate-Palmolive",
  "GLW":   "Corning Inc.",
  "CIBR":  "First Trust NASDAQ Cybersecurity ETF",
  "PA_":    "Pampa Energía",
  "PD_":    "PagerDuty",
  "B":     "Barnes Group",
  "E":     "ENI S.p.A.",
  "FC":    "Franchise Group",
  "NG":    "NovaGold Resources",
  "OXY_2": "Occidental Petroleum",
  "RBLX_": "Roblox Corp.",
  "ROST_": "Ross Stores",
  "BNG":   "BPR Bonos Globales",
  "AXIA":  "Axia Inc.",
  "BPA":   "Banco Patagonia (ADR)",
  "TXR_":  "Tower Semiconductor",
  "FD_":    "Fluence Energy",
  "KEEL":  "Keel Brands",
  "KOFM":  "Coca-Cola Femsa",
  "KOFL":  "Coca-Cola Femsa L",
  "SI":    "Silvergate Capital",
  "SDA":   "SunHydrogen Inc.",
  "SH":    "ProShares Short S&P 500",
  "SNA":   "Snap-on Inc.",
  "NXE":   "NexGen Energy Ltd.",
  "TEN":   "Tenneco Inc.",
  "PBI":   "Pitney Bowes Inc.",
  "VD":    "Visa Inc. (variant)",
  "ORLY":  "O'Reilly Automotive",
  "PSX_":   "Phillips 66",
  "ITUB3_": "Itaú Unibanco PN",
  "PETR3_": "Petrobras PN",
  "BBAS3_": "Banco do Brasil",
  "WEGE3_": "WEG S.A.",
  "MFG_":   "Mizuho Financial",

  // ETFs populares
  "SPY":   "SPDR S&P 500 ETF",
  "QQQ":   "Invesco QQQ (NASDAQ-100)",
  "TQQQ":  "ProShares UltraPro QQQ",
  "SPXL":  "Direxion Daily S&P 500 Bull 3X",
  "DIA":   "SPDR Dow Jones ETF",
  "IWM":   "iShares Russell 2000",
  "EEM":   "iShares MSCI Emerging Markets",
  "IEMG":  "iShares Core MSCI Emerging Markets",
  "EWZ":   "iShares MSCI Brazil",
  "EWY":   "iShares MSCI South Korea",
  "EWJ":   "iShares MSCI Japan",
  "EFA":   "iShares MSCI EAFE",
  "VEA":   "Vanguard FTSE Developed Markets",
  "ACWI":  "iShares MSCI ACWI",
  "GLD":   "SPDR Gold Trust",
  "SLV":   "iShares Silver Trust",
  "TLT":   "iShares 20+ Year Treasury",
  "VTI":   "Vanguard Total Stock Market",
  "VOO":   "Vanguard S&P 500",
  "VO":    "Vanguard Mid-Cap ETF",
  "IVV":   "iShares Core S&P 500",
  "IVE":   "iShares S&P 500 Value",
  "IVW":   "iShares S&P 500 Growth",
  "IJH":   "iShares Core S&P Mid-Cap",
  "IBB":   "iShares Biotechnology",
  "ARKK":  "ARK Innovation ETF",
  "USO":   "United States Oil Fund",
  "URA":   "Global X Uranium ETF",
  "GDX":   "VanEck Gold Miners ETF",
  "ICLN":  "iShares Global Clean Energy",
  "IEUR":  "iShares Core MSCI Europe",
  "ILF":   "iShares Latin America 40",
  "SMH":   "VanEck Semiconductor ETF",
  "SPHQ":  "Invesco S&P 500 Quality",
  "ESGU":  "iShares ESG Aware MSCI USA",
  "RSP":   "Invesco S&P 500 Equal Weight",
  "PSQ":   "ProShares Short QQQ",
  "VXX":   "iPath VIX Short-Term Futures",
  "VIG":   "Vanguard Dividend Appreciation",
  "XLE":   "Energy Select Sector SPDR",
  "XLF":   "Financial Select Sector SPDR",
  "XLK":   "Technology Select Sector SPDR",
  "XLV":   "Health Care Select Sector SPDR",
  "XLI":   "Industrial Select Sector SPDR",
  "XLP":   "Consumer Staples Select SPDR",
  "XLY":   "Consumer Discretionary SPDR",
  "XLU":   "Utilities Select Sector SPDR",
  "XLRE":  "Real Estate Select Sector SPDR",
  "XLB":   "Materials Select Sector SPDR",
  "XLC":   "Communication Services SPDR",
  "XME":   "SPDR S&P Metals & Mining",
  "COPX":  "Global X Copper Miners ETF",
  "ETHA":  "iShares Ethereum Trust",
  "IBIT":  "iShares Bitcoin Trust",
  "SPCE":  "Virgin Galactic",
  "LAR":   "Larimar Therapeutics",
  "LAC":   "Lithium Americas Corp.",
  "EWZ_":   "iShares MSCI Brazil",
  "MRSH":  "Marsh & McLennan",
  "YELP":  "Yelp Inc.",
  "MC":    "Moelis & Company",

  // Otros
  "BA.C":  "Boeing CCL",
  "GOGL":  "Golden Ocean Group",
  "NOK":   "Nokia",
  "PCRX":  "Pacira BioSciences",
  "HOOD":  "Robinhood Markets",
  "HOO":   "Robinhood Markets",
  "BKC*":  "Restaurant Brands International",
  "XROX":  "Xerox Holdings",
  "XP":    "XP Inc.",
};


/* ─────────────── ON_ISSUER_PREFIX (Obligaciones Negociables) ─────────────
 *
 * Las ONs (Obligaciones Negociables, bonos corporativos) tienen códigos
 * compuestos donde:
 *   - Las primeras 3 letras identifican el EMISOR (YMC = YPF, AER =
 *     Aeropuertos, MGC = Pampa Energía, etc.)
 *   - Las siguientes letras/números identifican la clase y plaza:
 *     - Sufijo O: ARS
 *     - Sufijo D: USD-MEP
 *     - Sufijo C: USD-CCL
 *
 * Ejemplos:
 *   ARC1O = Aeropuertos Arg 2000 Clase 1 ARS
 *   ARC1D = Aeropuertos Arg 2000 Clase 1 USD-MEP
 *   ARC1C = Aeropuertos Arg 2000 Clase 1 USD-CCL
 *
 * Por eso indexamos por PREFIJO (las primeras 2-3 letras del emisor)
 * en vez de ticker exacto. detectONIssuer() recorre los prefijos
 * conocidos para encontrar el emisor. Esto cubre cientos de variantes
 * con solo decenas de entradas en el registry.
 *
 * Si no se encuentra el prefijo, el ON cae a "Otros" del dropdown.
 */
const ON_ISSUER_PREFIX = {
  // YPF S.A. — series con prefijos YMC, YFC, YM3, YM4
  "YMC": "YPF",
  "YFC": "YPF",
  "YM3": "YPF",
  "YM4": "YPF",
  "YPC": "YPF",
  "YMR": "YPF (Reapertura)",

  // Pampa Energía — prefijo MGC
  "MGC": "Pampa Energía",

  // Vista Energy — VSC
  "VSC": "Vista Energy",
  "VST": "Vista Energy",

  // Telecom Argentina — TLC
  "TLC": "Telecom Argentina",

  // Mastellone Hnos. — MRC, MR3, MR4
  "MRC": "Mastellone Hnos.",
  "MR3": "Mastellone Hnos.",
  "MR4": "Mastellone Hnos.",

  // Aeropuertos Argentina 2000 — AER, ARC
  "AER": "Aeropuertos Argentina 2000",
  "ARC": "Aeropuertos Argentina 2000",

  // IRSA — IRC
  "IRC": "IRSA Inv. y Representaciones",

  // Banco Patagonia — BPC
  "BPC": "Banco Patagonia",

  // Tecpetrol — TTC
  "TTC": "Tecpetrol",

  // Cresud — CSD, CS3, CS4, CS5, CS6
  "CSD": "Cresud",
  "CS3": "Cresud",
  "CS4": "Cresud",
  "CS5": "Cresud",
  "CS6": "Cresud",

  // Genneia — GNC, GN4
  "GNC": "Genneia",
  "GN4": "Genneia",

  // Compañía General de Combustibles (CGC)
  "CGC": "CGC (Compañía General de Combustibles)",

  // Banco Galicia — BGC
  "BGC": "Banco Galicia",

  // Capex S.A. — emisora de energía
  "CAC": "Capex S.A.",

  // Loma Negra — LOC
  "LOC": "Loma Negra",

  // Banco Comafi — BAC (es uno de los códigos de emisión)
  "BAC": "Banco Comafi",

  // Banco BBVA Argentina — BYC
  "BYC": "BBVA Argentina",

  // Banco Hipotecario — BHC
  "BHC": "Banco Hipotecario",

  // Newsan — emisora de electrodomésticos / energía
  "NPC": "Newsan",

  // Toyota Compañía Financiera Argentina — TY3
  "TY3": "Toyota Compañía Financiera",

  // John Deere Credit Argentina — JNC
  "JNC": "John Deere Credit",

  // MSU Energy — MSS
  "MSS": "MSU Energy",
};

/**
 * Para un ticker de ON, devuelve el nombre del emisor si lo identifica,
 * sino null. Recorre ON_ISSUER_PREFIX buscando el prefijo más largo
 * que matchee al ticker — esto es necesario porque emitents como YPF
 * usan prefijos de 3 chars (YMC) pero hay otros con 2 chars (CS, BF).
 *
 * Sort: probamos primero los prefijos MÁS LARGOS para evitar falsos
 * positivos (ej: "YMC" debe matchear "YMC", no "YM").
 */
function detectONIssuer(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase().trim();
  // Probar prefijos de 4 chars primero (BF35, BF36...), después 3 (YMC, AER),
  // después 2 (CS, BF) — pero los de 2 son raros y se cubren con los de 3.
  // Iteramos sobre las claves del registry ordenadas por longitud descendente.
  const sortedPrefixes = Object.keys(ON_ISSUER_PREFIX).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (t.startsWith(prefix)) {
      return ON_ISSUER_PREFIX[prefix];
    }
  }
  return null;
}


/**
 * Para un ticker de ON, devuelve la plaza inferida del último char.
 *   *O → ARS
 *   *D → USD-MEP
 *   *C → USD-CCL
 *
 * Si el último char no matchea, devuelve "ARS" como default.
 */
function detectONPlaza(ticker) {
  if (!ticker) return "ARS";
  const last = ticker.toUpperCase().trim().slice(-1);
  if (last === "D") return "USD-MEP";
  if (last === "C") return "USD-CCL";
  return "ARS"; // O u otro
}


/**
 * Saca el sufijo de plaza (D = MEP, C = CCL) de un ticker, devolviendo
 * el ticker base sin sufijo y la plaza detectada.
 *
 *   "ALUAD"  → { base: "ALUA",  plaza: "USD-MEP" }
 *   "BMA.D"  → { base: "BMA",   plaza: "USD-MEP" } (caso especial con punto)
 *   "AAPLC"  → { base: "AAPL",  plaza: "USD-CCL" }
 *   "GGAL"   → { base: "GGAL",  plaza: "ARS"     }
 *
 * Cuidado con tickers que terminan naturalmente en C/D sin ser variantes
 * de plaza (ej: "AMD" termina en D pero es Advanced Micro Devices, no
 * "AM" en plaza MEP). El registry maneja esos casos: si "AMD" está en
 * el registry como base, no lo tratamos como sufijo.
 */
function detectPlaza(ticker, baseRegistry) {
  if (!ticker) return { base: ticker, plaza: "ARS" };
  const t = ticker.toUpperCase().trim();

  // 1) Aliases específicos para tickers que NO siguen el patrón estándar.
  //    Ej: "TECOD" → { base: "TECO2", plaza: "USD-MEP" } (el "2" se cae).
  //    Solo aplicamos para acciones — los CEDEARs y ONs siguen el patrón.
  if (baseRegistry === STOCK_REGISTRY && STOCK_PLAZA_ALIASES[t]) {
    return STOCK_PLAZA_ALIASES[t];
  }

  // 2) Caso especial: ticker.D (con punto) — siempre es plaza MEP
  if (t.endsWith(".D")) {
    const base = t.slice(0, -2);
    return { base, plaza: "USD-MEP" };
  }
  if (t.endsWith(".C")) {
    const base = t.slice(0, -2);
    return { base, plaza: "USD-CCL" };
  }

  // 3) Si el ticker completo está en el registry, NO le sacamos sufijo
  //    (ej: AMD, AMD es la base real). Esto evita falsos positivos.
  if (baseRegistry[t]) {
    return { base: t, plaza: "ARS" };
  }

  // 4) Si termina en D o C y al sacar el sufijo el resultado SÍ está en el
  //    registry, entonces sí es una variante de plaza.
  if (t.endsWith("D") && t.length > 2) {
    const base = t.slice(0, -1);
    if (baseRegistry[base]) {
      return { base, plaza: "USD-MEP" };
    }
  }
  if (t.endsWith("C") && t.length > 2) {
    const base = t.slice(0, -1);
    if (baseRegistry[base]) {
      return { base, plaza: "USD-CCL" };
    }
  }

  // No es variante conocida — devolvemos como está, asumiendo ARS.
  return { base: t, plaza: "ARS" };
}


function getTickerOptions(instrumentType, currentTicker, catalog) {
  // ─── Bonos: agrupados con optgroup por subtipo ─────────────────────
  // Lecaps / Boncaps / Duales vienen del registry hardcoded (BOND_REGISTRY).
  // Bonares / Globales / otros hard-dollar vienen del catálogo dinámico
  // (filtrando lo que no calza con los patrones esperados, para evitar
  // que la BD sucia filtre tickers extra como TVPA, TX26, TVPP, etc).
  if (instrumentType === "bond" || instrumentType === "bond_ars" || instrumentType === "bond_usd") {
    // Particionar BOND_REGISTRY por subtipo
    const lecaps = [];
    const boncaps = [];
    const duales = [];
    for (const [t, info] of Object.entries(BOND_REGISTRY)) {
      if (shouldIgnoreTicker(t)) continue;
      const opt = {
        value: t,
        label: `${t} — ${info.type.toUpperCase()} · vto ${fmtMaturityShort(info.maturityDate)}`,
        sortKey: info.maturityDate || "9999-12-31",
      };
      if (info.type === "lecap") lecaps.push(opt);
      else if (info.type === "boncap") boncaps.push(opt);
      else if (info.type === "dual") duales.push(opt);
    }

    // Particionar catálogo dinámico USD en Bonares / Globales / Otros
    // hard-dollar. Cualquier ticker que NO matchee uno de los 3 patrones
    // se descarta (filtro contra BD sucia).
    const bonares = [];
    const globales = [];
    const otrosUsd = [];

    const dynamicUsdBonds = catalog?.bond_usd?.length ? catalog.bond_usd : null;
    const usdSource = dynamicUsdBonds || BONDS_USD_POPULAR.map((b) => ({
      ticker: b.ticker,
      description: b.description,
      metadata: null,
    }));

    for (const b of usdSource) {
      const t = (b.ticker || "").toUpperCase();
      const maturity = b.metadata?.maturityDate;
      const desc = b.description;
      let label;
      if (desc && maturity) {
        label = `${b.ticker} — ${desc} · vto ${fmtMaturityShort(maturity)}`;
      } else if (desc) {
        label = `${b.ticker} — ${desc}`;
      } else {
        label = b.ticker;
      }
      const opt = {
        value: b.ticker,
        label,
        sortKey: maturity ? `${maturity}_${t}` : `Z_${t}`,
      };

      if (BONAR_PATTERN.test(t)) {
        bonares.push(opt);
      } else if (GLOBAL_PATTERN.test(t)) {
        globales.push(opt);
      } else if (HARD_DOLLAR_OTHER.test(t)) {
        otrosUsd.push(opt);
      }
      // Si no matchea ningún patrón hard-dollar conocido, se descarta:
      // probablemente es un ticker mal clasificado en BD (TVPA, TX26, etc.).
    }

    // Sort interno de cada grupo por su sortKey (vencimiento ascendente)
    const sortByKey = (a, b) => a.sortKey.localeCompare(b.sortKey);
    lecaps.sort(sortByKey);
    boncaps.sort(sortByKey);
    duales.sort(sortByKey);
    bonares.sort(sortByKey);
    globales.sort(sortByKey);
    otrosUsd.sort(sortByKey);

    // Construir grupos (omitir los vacíos)
    const groups = [];
    if (lecaps.length)   groups.push({ label: "Lecaps",   options: lecaps   });
    if (boncaps.length)  groups.push({ label: "Boncaps",  options: boncaps  });
    if (duales.length)   groups.push({ label: "Duales",   options: duales   });
    if (bonares.length)  groups.push({ label: "Bonares",  options: bonares  });
    if (globales.length) groups.push({ label: "Globales", options: globales });
    if (otrosUsd.length) groups.push({ label: "Otros USD", options: otrosUsd });

    // Si el ticker actual no está en ningún grupo (caso edición de
    // posición vieja con ticker custom), lo agregamos en un grupo especial
    // al final para no romper la edición.
    const allValues = new Set();
    for (const g of groups) for (const o of g.options) allValues.add(o.value);
    if (currentTicker && currentTicker.trim() && !allValues.has(currentTicker)) {
      groups.push({
        label: "Otros",
        options: [{ value: currentTicker, label: `${currentTicker} — (cargado manualmente)` }],
      });
    }

    return { mode: "select", groups };
  }

  // ─── Futuros: hardcoded en DLR_REGISTRY ─────────────────────────────
  // No usa catálogo dinámico, así que no hay riesgo de tickers extraños.
  if (instrumentType === "future") {
    const opts = DLR_REGISTRY.map((c) => ({
      ticker: c.ticker,
      sortKey: c.maturityDate,
      label: `${c.displayTicker} — vto ${fmtMaturityShort(c.maturityDate)}`,
    })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return ensureCurrentInOptions(opts, currentTicker, "select");
  }

  // ─── Stock / CEDEAR / ON: catálogo dinámico filtrado + agrupado ────────
  // El catálogo viene de Supabase (poblado por refresh de instruments).
  // A veces tiene tickers contaminados (boncaps clasificados como stock,
  // etc.) — filtramos esos defensivamente con looksLikeSovereignBond.
  //
  // Para enriquecer descripciones usamos los registries hardcoded
  // (STOCK_REGISTRY, CEDEAR_REGISTRY, ON_REGISTRY). Si un ticker está
  // ahí, mostramos "TICKER — Empresa S.A.". Si no, cae al grupo "Otros"
  // al final con solo el ticker (visual cue de que el catálogo está
  // incompleto para ese código).
  //
  // Agrupamos por plaza con <optgroup> usando detectPlaza:
  //   - Pesos     (sin sufijo D/C)
  //   - USD-MEP   (sufijo D o .D)
  //   - USD-CCL   (sufijo C o .C)
  //   - Otros     (no identificados en el registry)
  if (instrumentType === "stock" || instrumentType === "cedear") {
    const list = catalog?.[instrumentType];
    if (!list || list.length === 0) {
      return { mode: "input", options: [] };
    }

    // Elegir el registry según el tipo
    const registry = instrumentType === "stock" ? STOCK_REGISTRY : CEDEAR_REGISTRY;

    // Construimos opts con ordenación por DESCRIPCIÓN de empresa para que
    // las 3 plazas del mismo emisor queden contiguas:
    //   ALUA   — Aluar S.A.
    //   ALUAD  — Aluar S.A. · MEP
    //   ALUAC  — Aluar S.A. · CCL
    //   BBAR   — BBVA Argentina
    //   BBARD  — BBVA Argentina · MEP
    //   ...
    // El sort principal es alfabético por descripción; el desempate es
    // por plaza (ARS=0, MEP=1, CCL=2) para que dentro de una empresa la
    // moneda local salga primero.
    const conocidos = [];
    const otros = [];

    const plazaOrder = { "ARS": "0", "USD-MEP": "1", "USD-CCL": "2" };

    for (const row of list) {
      const ticker = (row.ticker || "").toUpperCase().trim();
      if (!ticker) continue;
      if (looksLikeSovereignBond(ticker)) continue;

      const { base, plaza } = detectPlaza(ticker, registry);
      const desc = registry[base] || row.description || null;

      const plazaSuffix =
        plaza === "USD-MEP" ? " · MEP" :
        plaza === "USD-CCL" ? " · CCL" :
        "";

      const label = desc
        ? `${ticker} — ${desc}${plazaSuffix}`
        : ticker;

      const sortKey = desc
        ? `${desc.toLowerCase()}__${plazaOrder[plaza] || "9"}__${ticker}`
        : `~~~${ticker}`;

      const opt = { value: ticker, label, sortKey };

      if (!registry[base]) {
        otros.push({ ...opt, sortKey: ticker });
      } else {
        conocidos.push(opt);
      }
    }

    conocidos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    otros.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    if (otros.length === 0) {
      return { mode: "select", options: conocidos };
    }

    const groups = [];
    if (conocidos.length) {
      groups.push({
        label: instrumentType === "stock" ? "Acciones" : "CEDEARs",
        options: conocidos,
      });
    }
    groups.push({ label: "Otros (sin descripción)", options: otros });

    const allValues = new Set();
    for (const g of groups) for (const o of g.options) allValues.add(o.value);
    if (currentTicker && currentTicker.trim() && !allValues.has(currentTicker)) {
      groups.push({
        label: "Editando",
        options: [{ value: currentTicker, label: `${currentTicker} — (cargado manualmente)` }],
      });
    }

    return { mode: "select", groups };
  }

  // ─── ON (Obligaciones Negociables): emisor por prefijo ────────────────
  // Las ONs tienen códigos compuestos donde las primeras 2-3 letras
  // identifican el emisor (YMC, AER, MGC, VSC, etc.). El último char
  // identifica la plaza (O=ARS, D=MEP, C=CCL).
  // detectONIssuer() busca el emisor por prefijo más largo que matchee.
  if (instrumentType === "on") {
    const list = catalog?.[instrumentType];
    if (!list || list.length === 0) {
      return { mode: "input", options: [] };
    }

    const conocidos = [];
    const otros = [];
    const plazaOrder = { "ARS": "0", "USD-MEP": "1", "USD-CCL": "2" };

    for (const row of list) {
      const ticker = (row.ticker || "").toUpperCase().trim();
      if (!ticker) continue;
      if (looksLikeSovereignBond(ticker)) continue;

      const issuer = detectONIssuer(ticker);
      const plaza = detectONPlaza(ticker);

      const plazaSuffix =
        plaza === "USD-MEP" ? " · MEP" :
        plaza === "USD-CCL" ? " · CCL" :
        "";

      // Para ONs, el label es: TICKER — Emisor [· plaza]
      // El ticker mismo identifica la clase específica (AER1O, AER9O, AERAO
      // son clases distintas del mismo emisor — el usuario sabe cuál busca).
      const label = issuer
        ? `${ticker} — ${issuer}${plazaSuffix}`
        : ticker;

      // Sort: por emisor primero (alfabético), después plaza, después ticker.
      const sortKey = issuer
        ? `${issuer.toLowerCase()}__${plazaOrder[plaza] || "9"}__${ticker}`
        : `~~~${ticker}`;

      const opt = { value: ticker, label, sortKey };

      if (!issuer) {
        otros.push({ ...opt, sortKey: ticker });
      } else {
        conocidos.push(opt);
      }
    }

    conocidos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    otros.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    if (otros.length === 0) {
      return { mode: "select", options: conocidos };
    }

    const groups = [];
    if (conocidos.length) groups.push({ label: "ON", options: conocidos });
    groups.push({ label: "Otros (sin descripción)", options: otros });

    const allValues = new Set();
    for (const g of groups) for (const o of g.options) allValues.add(o.value);
    if (currentTicker && currentTicker.trim() && !allValues.has(currentTicker)) {
      groups.push({
        label: "Editando",
        options: [{ value: currentTicker, label: `${currentTicker} — (cargado manualmente)` }],
      });
    }

    return { mode: "select", groups };
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
 * **Fuente de verdad — BYMA (cuando disponible):**
 * Si pasamos `bondPrices` y el ticker está cargado, usamos el campo
 * `currency` de BYMA como fuente primaria — es lo que el mercado
 * efectivamente reporta (ARS/USD/EXT mapean a ARS/USD-MEP/USD-CCL).
 * Esto cubre casos que la heurística por sufijo no detecta bien:
 *   - AL30Y termina en "Y", BYMA dice USD → USD-MEP ✅ (heurística fallaba)
 *   - AL30X termina en "X", BYMA dice ARS → ARS ✅ (heurística fallaba)
 *
 * **Heurística — fallback:**
 * Si BYMA no está disponible o el ticker no matchea, caemos a las
 * reglas tradicionales por sufijo del ticker:
 *   - Bonos ARS (lecaps, boncaps, etc.)        → ARS
 *   - Bono USD puro (AL30, GD30, etc.)         → ARS
 *   - Bono USD sufijo D (AL30D, GD30D, etc.)   → USD-MEP
 *   - Bono USD sufijo C (AL30C, GD30C, etc.)   → USD-CCL
 *   - Acciones / CEDEARs / ONs                  → ARS
 *   - Futuros DLR                               → ARS
 *   - Cauciones / Opciones / FCI                → sin sugerencia
 *
 * @param {string} instrumentType — tipo del instrumento
 * @param {string} ticker — código del título
 * @param {object} [bondPrices] — opcional: map de bondPrices del hook
 *   useBondPrices, donde cada entry tiene un campo `currency` cuando viene
 *   de BYMA ("ARS"|"USD"|"EXT").
 * @returns {{ currency: string|null, suggested: boolean }}
 */
function resolveCurrencyFromTicker(instrumentType, ticker, bondPrices) {
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
    instrumentType === "stock" ||
    instrumentType === "cedear" ||
    instrumentType === "future"
  ) {
    return { currency: "ARS", suggested: true };
  }

  // Para bonos y ONs: priorizamos BYMA si tenemos data fresca para el
  // ticker. Es la fuente más confiable porque viene del propio mercado.
  if (
    (instrumentType === "bond_ars" ||
      instrumentType === "bond_usd" ||
      instrumentType === "bond" ||
      instrumentType === "on") &&
    bondPrices &&
    ticker
  ) {
    const tk = ticker.trim().toUpperCase();
    const bymaEntry = bondPrices[tk];
    // Solo usamos la moneda si realmente vino de BYMA — data912 no setea
    // este campo. Para entries data912 caemos a heurística como antes.
    if (bymaEntry?.source === "byma" && bymaEntry?.currency) {
      const mapped = mapBymaCurrencyToApp(bymaEntry.currency);
      if (mapped) return { currency: mapped, suggested: true };
    }
  }

  // bond_ars: siempre ARS (lecaps, boncaps, etc., sin sufijo de plaza).
  // Lo movemos acá DESPUÉS del lookup BYMA porque ya validamos con la
  // fuente cuando estaba disponible.
  if (instrumentType === "bond_ars" || instrumentType === "on") {
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

    // Sufijos de plaza (heurística clásica, fallback cuando no hay BYMA)
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
 * Mapea el código de moneda de BYMA al modelo interno de la app.
 *
 * BYMA reporta:
 *   "ARS" → pesos argentinos
 *   "USD" → USD MEP / contado con liqui local
 *   "EXT" → USD CCL / cable / contado con liqui exterior
 *
 * Devuelve null si el código es inesperado (defensivo: si BYMA cambia
 * el modelo, no rompemos sino que caemos al fallback heurístico).
 */
function mapBymaCurrencyToApp(bymaCurrency) {
  switch (bymaCurrency) {
    case "ARS": return "ARS";
    case "USD": return "USD-MEP";
    case "EXT": return "USD-CCL";
    default:    return null;
  }
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
        // Supabase tiene un default de 1000 filas por consulta. Como
        // tenemos ~2000 instrumentos en total (cedears + acciones + ONs +
        // bonos USD), hay que paginar manualmente con .range() hasta
        // agotar. Sin esto, los CEDEARs se cortan alrededor de la M.
        const PAGE_SIZE = 1000;
        let allRows = [];
        let from = 0;

        while (true) {
          const { data: page, error: err } = await supabase
            .from("instruments")
            .select("ticker, instrument_type, description, metadata")
            .in("instrument_type", INSTRUMENT_CATALOG_TYPES)
            .order("ticker", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (err) throw err;
          if (!page || page.length === 0) break;

          allRows = allRows.concat(page);

          // Si esta página vino con menos del page size, ya estamos al final
          if (page.length < PAGE_SIZE) break;
          from += PAGE_SIZE;

          // Safety cap: si por algún motivo la BD tiene un volumen muy
          // grande, no queremos colgar la app. 10k es muchísimo más de
          // lo razonable para nuestro catálogo.
          if (allRows.length >= 10000) break;
        }

        if (!mounted) return;

        const grouped = { stock: [], cedear: [], bond_usd: [], on: [] };
        for (const row of allRows) {
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

    // Cuando es un refresh manual (refreshKey > 0), forzamos el spinner
    // así el user ve feedback aunque la respuesta sea instantánea por cache.
    if (refreshKey > 0) setLoading(true);

    (async () => {
      try {
        // Cache buster en refresh manual: agrega ?t=timestamp para que el CDN
        // de Vercel revalide contra dolarapi. En refresh inicial no hace falta.
        const url = refreshKey > 0
          ? `/api/dolares?t=${Date.now()}`
          : "/api/dolares";
        const r = await fetch(url, refreshKey > 0 ? { cache: "no-store" } : undefined);
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


/* ─────────────── Hook: useBondPrices ───────────────
 *
 * Lee precios actualizados de bonos ARS y USD desde data912 vía
 * el endpoint consolidado /api/data912?type=...:
 *   - type=letras → /live/arg_notes  (Lecaps / Boncaps / Duales)
 *   - type=bonos  → /live/arg_bonds  (bonos USD soberanos)
 *
 * data912 expone `pct_change` (variación % vs cierre anterior) que
 * usamos para derivar el cierre del día anterior matemáticamente
 * (cierre_ayer = price / (1 + pct_change/100)). Eso permite calcular
 * P&L diario sin necesidad de snapshots históricos en BD.
 * Para BYMA, viene `previousClose` directo y `changePct` ya pre-calculado.
 *
 * Cache:
 *   - sessionStorage con TTL de 5 minutos: si los datos son recientes
 *     los devolvemos inmediato sin pegarle a la API.
 *   - Stale-while-revalidate: aunque el cache esté vencido, mostramos
 *     los datos viejos mientras refrescamos atrás.
 *
 * Estructura del retorno:
 *   {
 *     prices:    Map<ticker, { price, bid, ask, lastUpdate }>
 *     loading,
 *     error,
 *     lastFetch: ISO string,
 *     refresh:   () => void,
 *   }
 *
 * Donde `price` es el último precio cotizado (preferimos `c` que es
 * último, sino caemos a `px_ask`). El precio viene cada 100 VN para
 * bonos (consistente con el módulo Carry Trade existente).
 */

// Bump version para invalidar caches sessionStorage viejos al deployar
// el refactor de Supabase (Fase 3). Los caches v2 quedan ignorados.
const BOND_PRICES_CACHE_KEY = "ecoflow_bond_prices_v3";
// TTL bajo (5s) para casi tiempo real durante el horario de mercado. El
// hook useBondPrices además dispara un setInterval cada BOND_PRICES_LIVE_MS
// cuando el mercado está abierto para empujar los precios sin esperar a
// que el cache caduque solo por consulta.
const BOND_PRICES_TTL_MS = 5 * 1000;
const BOND_PRICES_LIVE_MS = 5 * 1000;
// Ventana en la que confiamos en intra-day de prices_cache. Si la fila
// es más vieja, la ignoramos y caemos al cierre o a BYMA/data912.
const SUPABASE_INTRADAY_FRESH_MS = 10 * 60 * 1000;
// Días hacia atrás que buscamos cierres en daily_close_prices cuando
// un ticker no operó hoy. 14 días cubre feriados largos (Semana Santa).
const SUPABASE_CLOSE_LOOKBACK_DAYS = 14;

function readBondPricesCache() {
  try {
    const raw = sessionStorage.getItem(BOND_PRICES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.lastFetch || !parsed?.prices) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBondPricesCache(payload) {
  try {
    sessionStorage.setItem(BOND_PRICES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage puede fallar en private mode */
  }
}

/**
 * Normaliza un ticker MAE al formato del frontend (BYMA-like).
 *
 * MAE cotiza con dos convenciones distintas que están en UNIDADES
 * distintas:
 *
 *   - "AL30" (sin sufijo): cotiza por 1 VN — ~828 ARS por unidad.
 *   - "AL30/CI" (con sufijo): cotiza por 100 VN — ~91300 ARS, igual
 *     que BYMA y el resto del frontend.
 *
 * Como el front asume "precio por 100 VN", solo nos sirven las filas
 * con sufijo /CI, /24hs o /48hs. Las "limpias" las descartamos.
 *
 * La "D" para USD ya viene embebida antes del slash en el ticker MAE
 * ("AL30D/CI"), así que no hay que agregarla acá.
 *
 *   "AL30/CI"   → "AL30"
 *   "AL30/24hs" → "AL30"
 *   "AL30D/CI"  → "AL30D"
 *   "AL30"      → null
 *   "S29Y6"     → null (LECAPs sin sufijo, caen al fallback)
 */
function normalizeMaeTicker(maeTicker) {
  if (!maeTicker) return null;
  const m = String(maeTicker).trim().match(/^(.+?)\/(CI|24HS|48HS)$/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

/**
 * Lee precios de bonos de Supabase: prices_cache (intra-day MAE,
 * refrescado cada minuto por worker price-cache) y daily_close_prices
 * (cierre oficial, refrescado por worker mae-boletin a las 22 ART).
 *
 * Manejo de las dos convenciones de MAE:
 *   - Tickers CON sufijo (AL30/CI, S29Y6/24hs): precios en "por 100 VN",
 *     misma unidad que BYMA/data912 y el resto del front. Se usan tal cual.
 *   - Tickers SIN sufijo (AL30, S29Y6): precios en "por 1 VN". Se usan
 *     solo si en algún momento de los últimos 14 días el ticker cotizó
 *     CON sufijo (lo llamamos "ticker dual"), y se multiplican × 100.
 *   - Tickers que nunca cotizaron con sufijo: skip (no sabemos la unidad).
 *
 * Filtro de segmentos: solo aceptamos cotizaciones spot del bono
 * (segmentos 2=TPN Bilateral, 3=ON/FF Bilateral, 4=TPN Garantizado,
 * 5=ON/FF Garantizado). Excluimos segmentos 7 (Pases-Ventas), 8 (Pases
 * con Aforo) y 9 (Cauciones) porque sus precios no representan la
 * cotización del bono — son operaciones colaterales / de financiamiento
 * con precio distinto al spot.
 *
 * Merge: intra-day fresco (< 10 min) gana sobre el último cierre.
 * Cuando hay duplicados, preferimos el de mayor `monto` (más líquido).
 */
async function fetchSupabaseBondPrices() {
  const map = {};
  const now = Date.now();

  const lookback = new Date();
  lookback.setDate(lookback.getDate() - SUPABASE_CLOSE_LOOKBACK_DAYS);
  const fromDate = lookback.toISOString().slice(0, 10);

  // Segmentos donde el precio publicado es la cotización spot del bono.
  // El resto (Pases-Ventas, Pases con Aforo, Cauciones) tienen precios
  // que no representan el valor de mercado y contaminarían la elección
  // por mayor monto.
  const SPOT_SEGMENTOS = new Set(["2", "3", "4", "5"]);

  // Set de tickers con convención dual: cotizaron CON sufijo en algún
  // momento de la ventana. Lo armamos primero recorriendo los rows del
  // boletín (filtrados a segmentos spot), después lo usamos como gate
  // para aceptar/multiplicar las filas SIN sufijo.
  const dualTickers = new Set();

  const suffixRegex = /^(.+?)\/(CI|24HS|48HS)$/i;
  function classifyTicker(rawTicker) {
    if (!rawTicker) return null;
    const t = String(rawTicker).trim();
    const m = t.match(suffixRegex);
    if (m) return { base: m[1].toUpperCase(), unitFactor: 1 };
    const baseUpper = t.toUpperCase();
    if (dualTickers.has(baseUpper)) {
      return { base: baseUpper, unitFactor: 100 };
    }
    return null;
  }

  // Convierte un valor de la BD a Number > 0, o null si es 0/null/NaN.
  // Crítico para `precio_cierre_ayer` y `prev_close` porque la lógica
  // de P&L HOY downstream requiere `prev > 0`; si guardamos 0 acá, el
  // fallback de changePct no se dispara y P&L queda en "—".
  function numPositive(v) {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ── PASO 1: Cierre oficial (últimos 14 días) ─────────────────────
  try {
    const { data: closeRows, error: closeErr } = await supabase
      .from("daily_close_prices")
      .select(
        "ticker, moneda_codigo, plazo, segmento_codigo, " +
          "precio_cierre_hoy, precio_cierre_ayer, precio_ultimo, " +
          "variacion, monto, trade_date"
      )
      .gte("trade_date", fromDate);

    if (closeErr) throw closeErr;

    // Primera pasada: identificar tickers cotizados "por 1 VN":
    //   (a) Con sufijo /CI o /24hs en el feed (caso ideal: MAE marca
    //       explícitamente la convención).
    //   (b) Sin sufijo PERO en pesos ($) con precio < 10. Heurística
    //       para bonos AR que ya no se publican con sufijo pero igual
    //       cotizan por 1 VN (e.g. T30J6 hoy: aparece como "T30J6"
    //       con precio 1.4086, nunca como "T30J6/24hs"). Si el ticker
    //       cotizara por 100 VN, su precio rondaría 100-150, no < 10.
    for (const row of closeRows || []) {
      const seg = String(row.segmento_codigo || "");
      if (!SPOT_SEGMENTOS.has(seg)) continue;
      const t = String(row.ticker || "").trim();
      const m = t.match(suffixRegex);
      if (m) {
        dualTickers.add(m[1].toUpperCase());
        continue;
      }
      // Sin sufijo: aplicar heurística solo a filas en pesos.
      if (row.moneda_codigo === "$") {
        const price = Number(row.precio_cierre_hoy);
        if (price > 0 && price < 10) {
          dualTickers.add(t.toUpperCase());
        }
      }
    }

    // Segunda pasada: agrupar por ticker normalizado.
    const closeByTicker = new Map();
    for (const row of closeRows || []) {
      const seg = String(row.segmento_codigo || "");
      if (!SPOT_SEGMENTOS.has(seg)) continue;
      const cls = classifyTicker(row.ticker);
      if (!cls) continue;
      const rawPrice = Number(row.precio_cierre_hoy);
      if (!rawPrice || rawPrice <= 0) continue;
      const price = rawPrice * cls.unitFactor;

      const existing = closeByTicker.get(cls.base);
      if (!existing) {
        closeByTicker.set(cls.base, { ...row, _price: price, _factor: cls.unitFactor });
        continue;
      }
      if (row.trade_date > existing.trade_date) {
        closeByTicker.set(cls.base, { ...row, _price: price, _factor: cls.unitFactor });
        continue;
      }
      if (row.trade_date === existing.trade_date) {
        const existingMonto = Number(existing.monto) || 0;
        const rowMonto = Number(row.monto) || 0;
        if (rowMonto > existingMonto) {
          closeByTicker.set(cls.base, { ...row, _price: price, _factor: cls.unitFactor });
        }
      }
    }

    for (const [base, row] of closeByTicker) {
      const currency =
        row.moneda_codigo === "$"
          ? "ARS"
          : row.moneda_codigo === "D"
            ? "USD"
            : null;
      const prevRaw = numPositive(row.precio_cierre_ayer);
      map[base] = {
        price: row._price,
        bid: null,
        ask: null,
        volume: row.monto != null ? Number(row.monto) : null,
        source: "mae_close",
        currency,
        changePct: row.variacion != null ? Number(row.variacion) : null,
        previousClose: prevRaw != null ? prevRaw * row._factor : null,
        tradeDate: row.trade_date,
      };
    }
  } catch (e) {
    console.warn(
      "[useBondPrices] Supabase daily_close_prices falló:",
      e.message
    );
  }

  // ── PASO 2: Intra-day (pisa cierre cuando fresco) ────────────────
  // prices_cache no incluye segmento en el sentido de daily_close (su
  // `segment_code` usa otro vocabulario: BT=Bilateral TRD, BP=Bilateral
  // PPT, GT=Garantizado TRD, GP=Garantizado PPT). MAE en /rentafija
  // devuelve solo TRD por ahora (Trading directo, precio spot), pero
  // pedimos amount y priorizamos BT > GT por las dudas y para tener
  // un criterio de desempate determinístico cuando un mismo ticker
  // aparece en varios segmentos en el mismo ciclo del worker.
  //
  // Currency: por ahora solo procesamos "$" (ARS). Los bonos USD se
  // siguen sirviendo desde BYMA hasta que tengamos el mapeo de currency
  // del feed MAE bien validado (e.g. para T30J6 hay una fila con
  // currency D y precio 0.001 que daría una catástrofe si la tomamos).
  function intraPriority(row) {
    // Segmento como prioridad absoluta. BT (Bilateral Trading) es la
    // operatoria spot más cercana al precio negociado en BYMA → primer
    // criterio. GT (Garantizado Trading) es segundo. Si aparecen BP/GP
    // (Pases), score 0 → casi nunca ganan.
    //
    // El segScore va escalado por 1e15 para que SIEMPRE gane sobre el
    // amount real (que en pesos puede llegar a miles de millones pero
    // queda bien debajo de 1e15). Sin esa separación, dos rows BT con
    // amounts ~1e10 quedan empatados por clamp y el desempate vuelve a
    // ser indeterminado.
    const seg = String(row.segment_code || "");
    const segScore =
      seg === "BT" ? 3
        : seg === "GT" ? 2
          : seg === "BP" ? 1
            : 0;
    const amountScore = Number(row.amount) || 0;
    return segScore * 1e15 + amountScore;
  }

  try {
    const { data: intraRows, error: intraErr } = await supabase
      .from("prices_cache")
      .select(
        "ticker, currency, last_price, close_price, prev_close, " +
          "variation_pct, fetched_at, segment_code, amount"
      )
      .eq("source", "mae_rentafija");

    if (intraErr) throw intraErr;

    const intraByTicker = new Map();
    for (const row of intraRows || []) {
      // Solo bonos en pesos por ahora.
      if (row.currency !== "$") continue;
      const cls = classifyTicker(row.ticker);
      if (!cls) continue;
      const rawPrice = Number(row.last_price) || Number(row.close_price);
      if (!rawPrice || rawPrice <= 0) continue;
      const age = now - new Date(row.fetched_at).getTime();
      if (age > SUPABASE_INTRADAY_FRESH_MS) continue;

      const price = rawPrice * cls.unitFactor;
      const existing = intraByTicker.get(cls.base);

      // Decisión:
      //   1) Si no hay existing, este row gana.
      //   2) Si este row es más fresco que el existing, gana.
      //   3) Si tienen el mismo fetched_at, gana el de mayor priority
      //      (BT > GT, después por amount).
      let wins = !existing;
      if (existing) {
        if (row.fetched_at > existing.fetched_at) wins = true;
        else if (row.fetched_at === existing.fetched_at) {
          wins = intraPriority(row) > intraPriority(existing);
        }
      }
      if (wins) {
        intraByTicker.set(cls.base, { ...row, _price: price, _factor: cls.unitFactor });
      }
    }

    for (const [base, row] of intraByTicker) {
      const currency = "ARS"; // ya filtramos a $
      // Cálculo de previousClose para P&L HOY:
      //   1) Si prices_cache trae prev_close > 0, usarlo (path ideal,
      //      pero el worker price-cache hoy lo guarda en 0 — bug aparte).
      //   2) Fallback: el `price` del entry existente en mae_close, que
      //      es el `precio_cierre_hoy` de la última fila del boletín.
      //      Eso representa el cierre del día hábil ANTERIOR, que es lo
      //      que querés para "P&L de hoy".
      //   3) Si ni siquiera hay close, null y el cálculo downstream cae
      //      a la derivada desde variation_pct.
      //
      // Antes usaba existing.previousClose como fallback, pero ese es el
      // `precio_cierre_ayer` de la fila del 12/05 — o sea, el cierre del
      // 11/05. Para P&L HOY del 13/05 necesitamos el cierre del 12/05.
      const existing = map[base];
      const intraPrevRaw = numPositive(row.prev_close);
      const prevClose = intraPrevRaw != null
        ? intraPrevRaw * row._factor
        : (existing?.price ?? existing?.previousClose ?? null);
      map[base] = {
        price: row._price,
        bid: null,
        ask: null,
        volume: row.amount != null ? Number(row.amount) : null,
        source: "mae_intraday",
        currency: currency || existing?.currency || null,
        // changePct se recalcula desde el nuevo prevClose para que sea
        // consistente: la variación intra-day respecto al cierre de
        // ayer, no respecto a la apertura. Si no podemos calcularlo,
        // dejamos en null y downstream se las arregla.
        changePct: prevClose != null && prevClose > 0
          ? ((row._price - prevClose) / prevClose) * 100
          : (existing?.changePct ?? null),
        previousClose: prevClose,
        fetchedAt: row.fetched_at,
      };
    }
  } catch (e) {
    console.warn(
      "[useBondPrices] Supabase prices_cache falló:",
      e.message
    );
  }

  return map;
}

function useBondPrices() {
  const cached = readBondPricesCache();
  const [prices, setPrices] = useState(cached?.prices || {});
  const [lastFetch, setLastFetch] = useState(cached?.lastFetch || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Distinguir refresh manual (click "Actualizar") vs auto (setInterval).
  // El manual muestra spinner; el auto refresca silenciosamente sin
  // tocar el botón. Si no se hace esta distinción y el auto pone
  // setLoading(true) cada 5s pero un fetch tarda 6s, el botón queda
  // "Actualizando..." de manera permanente.
  const manualRefreshRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Si tenemos cache fresco y no es refresh manual, ni nos molestamos
    if (cached && refreshKey === 0) {
      const age = Date.now() - new Date(cached.lastFetch).getTime();
      if (age < BOND_PRICES_TTL_MS) {
        setLoading(false);
        return () => { mounted = false; };
      }
    }

    setError(null);
    // Solo mostrar spinner si es refresh manual o primera carga sin cache.
    // Los refreshes automáticos del setInterval pasan en background.
    const wasManual = manualRefreshRef.current;
    manualRefreshRef.current = false;
    if (wasManual || (!cached && refreshKey === 0)) setLoading(true);

    (async () => {
      try {
        // Cache buster en refresh manual para forzar revalidación CDN
        const bust = refreshKey > 0 ? `?t=${Date.now()}` : "";
        const fetchOpts = refreshKey > 0 ? { cache: "no-store" } : undefined;

        // Lanzamos las 3 fuentes en paralelo. Si una falla, la otra
        // sigue siendo útil. La cadena de prioridad en el merge es:
        //   Supabase intra-day > Supabase close > BYMA > data912
        const [supabaseMap, bymaResult, data912Result] = await Promise.all([
          fetchSupabaseBondPrices().catch((e) => {
            console.warn("[useBondPrices] Supabase falló:", e?.message);
            return {};
          }),
          (async () => {
            try {
              const r = await fetch(`/api/byma/public-bonds${bust}`, fetchOpts);
              if (!r.ok) throw new Error(`BYMA HTTP ${r.status}`);
              const j = await r.json();
              if (!j?.ok || !Array.isArray(j.data)) {
                throw new Error("BYMA respuesta inválida");
              }
              return { data: j.data };
            } catch (e) {
              console.warn("[useBondPrices] BYMA falló:", e.message);
              return { data: null };
            }
          })(),
          (async () => {
            try {
              const [bondsRes, letrasRes] = await Promise.all([
                fetch(`/api/data912?type=bonos&_=${Date.now()}`, fetchOpts),
                fetch(`/api/data912?type=letras&_=${Date.now()}`, fetchOpts),
              ]);
              const bonds = bondsRes.ok ? await bondsRes.json() : [];
              const letras = letrasRes.ok ? await letrasRes.json() : [];
              return { bonds, letras };
            } catch (e) {
              console.warn("[useBondPrices] data912 falló:", e.message);
              return { bonds: [], letras: [] };
            }
          })(),
        ]);

        // ── PASO 1: Empezamos con BYMA como base de fallback ─────
        // BYMA Open Data (~494 bonos) llena tickers que MAE no opera
        // (CCL "AL30C", instrumentos ilíquidos, fines de semana).
        let map = {};
        if (bymaResult.data) {
          for (const bond of bymaResult.data) {
            if (!bond?.symbol) continue;
            const ticker = String(bond.symbol).trim().toUpperCase();
            const price =
              bond.last ?? bond.settlementPrice ?? bond.ask ?? null;
            if (price == null || price <= 0) continue;
            map[ticker] = {
              price: Number(price),
              bid: bond.bid,
              ask: bond.ask,
              volume: bond.volume,
              source: "byma",
              maturityDate: bond.maturityDate,
              daysToMaturity: bond.daysToMaturity,
              currency: bond.currency, // "ARS" | "USD" | "EXT"
              changePct: bond.changePct,
              previousClose: bond.previousClose,
              tradeHour: bond.tradeHour,
            };
          }
        }

        // ── PASO 2: data912 rellena huecos que BYMA no tiene ─────
        // No pisamos lo que BYMA ya proveyó.
        for (const item of [
          ...(data912Result.letras || []),
          ...(data912Result.bonds || []),
        ]) {
          if (!item?.symbol) continue;
          const ticker = String(item.symbol).trim().toUpperCase();
          if (map[ticker]) continue;
          const price = item.c ?? item.px_ask ?? null;
          if (price == null || price <= 0) continue;

          // Derivar cierre anterior desde pct_change cuando viene.
          let changePct = null;
          let previousClose = null;
          if (
            item.pct_change != null &&
            Number.isFinite(Number(item.pct_change))
          ) {
            changePct = Number(item.pct_change);
            const denom = 1 + changePct / 100;
            if (denom > 0) previousClose = Number(price) / denom;
          }

          map[ticker] = {
            price: Number(price),
            bid: item.px_bid != null ? Number(item.px_bid) : null,
            ask: item.px_ask != null ? Number(item.px_ask) : null,
            volume: item.q_op != null ? Number(item.q_op) : null,
            source: "data912",
            changePct,
            previousClose,
          };
        }

        // ── PASO 3: Supabase pisa todo (mae_intraday > mae_close) ─
        // Reglas:
        //   - mae_intraday: pisa siempre (es el feed más fresh durante
        //     horario operativo).
        //   - mae_close: solo pisa si BYMA y data912 NO trajeron price.
        //     Si BYMA o data912 ya tienen price actual, ese gana — son
        //     más cercanos a lo que Cocos muestra (BYMA-aligned) y NO
        //     dejan precios stale del cierre del día anterior.
        //
        // previousClose para P&L HOY: es CRÍTICO que sea el cierre del
        // día hábil anterior al día calendario actual. Fuentes posibles:
        //   1) prior.previousClose (BYMA/data912) — si es distinto del
        //      prior.price. Si son iguales (típico post-cierre cuando
        //      BYMA "fija" el close al last_price), es inútil.
        //   2) mae_close.price si su tradeDate < today AR — ese price
        //      ES el cierre del día anterior (latest row del boletín
        //      MAE, que se inserta a las 22:30 ART vía cron).
        //   3) mae_close.previousClose como último fallback (cierre de
        //      hace 2 días — solo si nada mejor está disponible).
        //
        // Cocos calcula su P&L HOY contra el cierre BYMA. Sería ideal
        // alinear pero a veces solo tenemos cierre MAE — diff típica
        // de ~5-7 centavos en LECAPs, manageable.
        const todayAR = (() => {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Argentina/Buenos_Aires",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(new Date());
          const y = parts.find((p) => p.type === "year")?.value;
          const m = parts.find((p) => p.type === "month")?.value;
          const d = parts.find((p) => p.type === "day")?.value;
          return `${y}-${m}-${d}`;
        })();

        for (const [ticker, supaEntry] of Object.entries(supabaseMap)) {
          const prior = map[ticker] || {};
          const priorHasFreshPrice =
            prior.price != null && prior.price > 0 && prior.source != null;
          const supaIsClose = supaEntry.source === "mae_close";

          // Candidate prev desde prior (BYMA/data912): solo válido si
          // existe Y es distinto del price (más que un epsilon). Cuando
          // post-cierre BYMA fija previousClose=price, lo descartamos.
          const priorPrev =
            prior.previousClose != null &&
            prior.previousClose > 0 &&
            prior.price != null &&
            Math.abs(Number(prior.previousClose) - Number(prior.price)) > 1e-6
              ? Number(prior.previousClose)
              : null;

          // Candidate prev desde mae_close: si la fila es del día
          // anterior al de hoy AR, su `price` (precio_cierre_hoy) ES el
          // cierre que queremos. Si la fila es de hoy AR (cron ya corrió
          // a las 22:30), `previousClose` (precio_cierre_ayer) ES el de
          // ayer.
          let maePrev = null;
          let maeCloseIsRecent = false;
          if (supaIsClose) {
            if (supaEntry.tradeDate && supaEntry.tradeDate < todayAR) {
              maePrev =
                supaEntry.price != null && supaEntry.price > 0
                  ? Number(supaEntry.price)
                  : null;
              maeCloseIsRecent = true;
            } else {
              maePrev =
                supaEntry.previousClose != null && supaEntry.previousClose > 0
                  ? Number(supaEntry.previousClose)
                  : null;
            }
          } else {
            // mae_intraday: previousClose ya viene calculado bien arriba
            maePrev =
              supaEntry.previousClose != null && supaEntry.previousClose > 0
                ? Number(supaEntry.previousClose)
                : null;
          }

          // Prioridad simplificada:
          //   1) Si mae_close tiene fila del día hábil anterior a hoy AR
          //      (= cierre real más reciente disponible), usar su price
          //      como previousClose. Esto es lo más confiable porque
          //      mae-boletin corre 22:30 ART y carga el cierre del día
          //      que termina.
          //   2) Si no hay close reciente, usar priorPrev (BYMA/data912).
          //   3) Como último fallback, usar maePrev "viejo" (precio_cierre
          //      _ayer de la fila más reciente).
          //
          // Antes intentábamos elegir entre priorPrev y maePrev con un
          // threshold de diff, pero eso fallaba en el caso típico
          // post-cambio-de-día: data912 aún reporta el prev de hace 2
          // días (diff 0.04% vs el cierre real), por debajo del umbral
          // que habíamos puesto. Esta versión es determinística: el
          // boletín MAE manda cuando está disponible.
          let finalPrev;
          if (maeCloseIsRecent && maePrev != null) {
            finalPrev = maePrev;
          } else if (priorPrev != null) {
            finalPrev = priorPrev;
          } else {
            finalPrev = maePrev;
          }

          if (supaIsClose && priorHasFreshPrice) {
            // BYMA/data912 tienen price del día. Solo aprovechamos el
            // previousClose. price y demás campos siguen siendo del prior.
            const finalPrice = Number(prior.price);
            const finalChangePct =
              finalPrev != null && finalPrev > 0 && finalPrice > 0
                ? ((finalPrice - finalPrev) / finalPrev) * 100
                : (prior.changePct ?? null);
            map[ticker] = {
              ...prior,
              previousClose: finalPrev,
              changePct: finalChangePct,
            };
          } else {
            // mae_intraday O no hay prior con price → supaEntry pisa.
            const finalPrice = Number(supaEntry.price);
            const finalChangePct =
              finalPrev != null && finalPrev > 0 && finalPrice > 0
                ? ((finalPrice - finalPrev) / finalPrev) * 100
                : (supaEntry.changePct ?? prior.changePct ?? null);
            map[ticker] = {
              ...prior,
              ...supaEntry,
              previousClose: finalPrev,
              changePct: finalChangePct,
              maturityDate: prior.maturityDate ?? supaEntry.maturityDate ?? null,
              daysToMaturity:
                prior.daysToMaturity ?? supaEntry.daysToMaturity ?? null,
            };
          }
        }

        if (!mounted) return;
        const nowIso = new Date().toISOString();
        setPrices(map);
        setLastFetch(nowIso);
        setLoading(false);
        writeBondPricesCache({ prices: map, lastFetch: nowIso });

        // Log informativo (visible en DevTools)
        const counts = Object.values(map).reduce((acc, v) => {
          acc[v.source] = (acc[v.source] || 0) + 1;
          return acc;
        }, {});
        console.info(
          `[useBondPrices] ${Object.keys(map).length} tickers cargados ` +
          `(${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ")})`
        );
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Error cargando precios");
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    manualRefreshRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-refresh casi tiempo real: cada BOND_PRICES_LIVE_MS dispara un
  // refresh, pero SOLO si el mercado AR está abierto (horario hábil
  // 11-18 ART). Fuera de eso paramos polling para no machacar las APIs
  // gratuitas (data912, BYMA Open Data) sin necesidad — los precios no
  // van a cambiar.
  useEffect(() => {
    const tick = () => {
      if (isActiveMarketWindow()) {
        // NO seteamos manualRefreshRef.current → auto-refresh sin spinner
        setRefreshKey((k) => k + 1);
      }
    };
    const id = setInterval(tick, BOND_PRICES_LIVE_MS);
    return () => clearInterval(id);
  }, []);

  return { prices, loading, error, lastFetch, refresh };
}


/* ─────────────── Hook: useStockPrices ───────────────
 *
 * Lee precios actualizados de acciones argentinas + CEDEARs desde
 * data912 vía el endpoint consolidado /api/data912?type=...:
 *   - type=acciones → /live/arg_stocks   (panel general BYMA)
 *   - type=cedears  → /live/arg_cedears  (todos los CEDEARs operados)
 *
 * data912 expone `pct_change` (variación % vs cierre anterior). Igual
 * que useBondPrices, derivamos el cierre anterior matemáticamente:
 *   previousClose = price / (1 + pct_change/100)
 * Eso permite calcular P&L diario sin snapshots históricos.
 *
 * Auto-refresh cada 5 minutos en horario activo, manual fuera.
 */
function useStockPrices() {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const bust = `?_=${Date.now()}`;

        const [stocksRes, cedearsRes] = await Promise.all([
          fetch(`/api/data912?type=acciones&_=${Date.now()}`),
          fetch(`/api/data912?type=cedears&_=${Date.now()}`),
        ]);

        const stocksArr = stocksRes.ok ? await stocksRes.json() : [];
        const cedearsArr = cedearsRes.ok ? await cedearsRes.json() : [];

        const map = {};

        const parseItem = (item) => {
          if (!item?.symbol) return;
          const ticker = String(item.symbol).trim().toUpperCase();
          if (map[ticker]) return;

          const price = item.c ?? item.px_ask ?? null;
          if (price == null || Number(price) <= 0) return;

          let changePct = null;
          let previousClose = null;
          if (item.pct_change != null && Number.isFinite(Number(item.pct_change))) {
            changePct = Number(item.pct_change);
            const denom = 1 + changePct / 100;
            if (denom > 0) {
              previousClose = Number(price) / denom;
            }
          }

          map[ticker] = {
            price: Number(price),
            bid: item.px_bid != null ? Number(item.px_bid) : null,
            ask: item.px_ask != null ? Number(item.px_ask) : null,
            volume: item.v != null ? Number(item.v) : null,
            source: "data912",
            changePct,
            previousClose,
          };
        };

        for (const item of stocksArr) parseItem(item);
        for (const item of cedearsArr) parseItem(item);

        if (!mounted) return;
        const now = new Date().toISOString();
        setPrices(map);
        setLastFetch(now);
        setLoading(false);
        setError(null);

        console.info(
          `[useStockPrices] ${Object.keys(map).length} tickers cargados ` +
          `(stocks: ${stocksArr.length}, cedears: ${cedearsArr.length})`
        );
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Error cargando precios de acciones");
        setLoading(false);
      }
    };

    fetchAll();

    const scheduleNext = () => {
      const intervalMs = isActiveMarketWindow() ? 5 * 60 * 1000 : 30 * 60 * 1000;
      timeoutId = setTimeout(() => {
        fetchAll().finally(scheduleNext);
      }, intervalMs);
    };
    scheduleNext();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { prices, loading, error, lastFetch, refresh };
}


/* ─────────────── Hook: useFuturePrices ───────────────
 *
 * Pollea precios real-time de futuros (DLR/ROFEX) vía Primary API,
 * proxy en /api/primary-md. Frecuencia adaptativa según horario:
 *
 *   - Día hábil 10:00-17:00 ART: cada 10 segundos.
 *   - Resto: cada 30 minutos (consistente con auto-refresh del dashboard).
 *
 * Devuelve un objeto `prices` con shape:
 *   {
 *     "DLRMAY26": {
 *       price:        1403.5,         // precio "elegido" por backend
 *       priceSource: "last"|"mid"|"settlement",
 *       last, bid, offer, settlement, midpoint, freshness, lastDate
 *     },
 *     ...
 *   }
 *
 * Si /api/primary-md devuelve error, mantenemos los precios anteriores
 * (graceful degradation) y exponemos `error` para mostrar en UI.
 *
 * El hook acepta `tickers` (array de strings) que puede cambiar dinámicamente.
 * Al cambiar la lista, dispara refresh inmediato.
 */
function useFuturePrices(tickers) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stringify la lista de tickers para usarla como dependencia estable en
  // los useEffect (el array como tal cambia identidad cada render).
  const tickersKey = useMemo(() => {
    if (!tickers || tickers.length === 0) return "";
    return [...tickers].map((t) => t.toUpperCase().trim()).sort().join(",");
  }, [tickers]);

  // Fetch principal: pega a /api/primary-md y mergea con state existente.
  // Si no hay tickers, no hace nada.
  useEffect(() => {
    if (!tickersKey) {
      setPrices({});
      return;
    }

    let cancelled = false;
    async function fetchPrices() {
      setLoading(true);
      try {
        const url = `/api/primary-md?symbols=${encodeURIComponent(tickersKey)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (cancelled) return;

        if (!data.ok) {
          setError(data.detail || data.error || "Error desconocido");
          return;
        }

        // Mergear preservando entries que no vinieron en este response
        // (puede pasar si el backend filtró tickers no soportados).
        setPrices((prev) => ({ ...prev, ...data.prices }));
        setLastFetch(data.fetchedAt || new Date().toISOString());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPrices();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, refreshKey]);

  // Auto-poll: 10 seg en horario hábil / 30 min fuera.
  // Usamos `tick` para forzar re-evaluación del horario en cada ciclo
  // (al cruzar las 10:30 o las 17:30, el intervalo cambia automáticamente).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!tickersKey) return;

    // Determinar frecuencia. Usamos minutos para que 10:30 / 17:30 sean
    // exactos y no 10 / 17 (cubre pre-apertura BYMA 10:30 y subasta de
    // cierre 17:00-17:05).
    const now = new Date();
    const arDateStr = now.toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const arTimeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false,
    });
    const arHour = parseInt(arTimeStr.slice(0, 2), 10);
    const arMinute = parseInt(arTimeStr.slice(3, 5), 10);
    const arNowMinutes = arHour * 60 + arMinute;
    const isMarketHours =
      arNowMinutes >= 10 * 60 + 30 &&
      arNowMinutes < 17 * 60 + 30;
    const isBizDay = !isNonBusinessDay(arDateStr);
    const intervalMs = (isMarketHours && isBizDay)
      ? 10 * 1000          // 10 seg en horario hábil
      : 30 * 60 * 1000;    // 30 min fuera

    const id = setInterval(() => {
      setRefreshKey((k) => k + 1);
      setTick((t) => t + 1);
    }, intervalMs);

    return () => clearInterval(id);
  }, [tickersKey, tick]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { prices, loading, error, lastFetch, refresh };
}


/* ─────────────── Hook: useFutureAdjustments ───────────────
 *
 * Maneja los ajustes diarios MTM de futuros ROFEX/A3.
 *
 * Modelo:
 *   ROFEX/A3 liquida diariamente la diferencia entre el settlement de
 *   hoy y el de ayer × cantidad × multiplier. Esa plata se acredita
 *   al día hábil siguiente en la cuenta comitente del usuario en su
 *   broker (Cocos en este caso).
 *
 *   Como Primary expone solo el settlement actual (no histórico),
 *   tenemos un cron diario que captura los settlements en la tabla
 *   futures_settlements_history. A partir de ahí, este hook genera
 *   filas en futures_daily_adjustments con status='pending' por cada
 *   posición × día sin ajuste registrado.
 *
 *   El usuario después confirma cada ajuste (puede editarlo si Cocos
 *   le liquidó un monto distinto) y eso crea el cash_movement asociado.
 *
 * Convenciones:
 *   - Para el primer día de la posición (o cuando no hay prev_settle
 *     en el histórico), se usa entry_price como prev_settle.
 *   - Solo se generan ajustes para días hábiles (lun-vie, no feriados
 *     BYMA) anteriores a hoy.
 *   - "Posición abierta" = grupo consolidado con netQty != 0.
 *   - Se ejecuta solo si es ≥9:00 AR (cuando ya tendría que haber
 *     llegado la liquidación de Cocos).
 *
 * Estado expuesto:
 *   - pendingAdjustments: array de filas pending listas para confirmar.
 *   - confirmedAdjustments: filas ya confirmadas (para mostrar histórico).
 *   - loading: durante el primer load.
 *   - error: si algo falla.
 *   - confirm(adjustmentId, actualAmount): confirma un ajuste creando
 *     el cash_movement asociado.
 *   - skip(adjustmentId): marca como skipped sin generar movement.
 *   - refresh(): recarga + intenta generar ajustes nuevos.
 */
function useFutureAdjustments(positions, futurePrices) {
  const { user } = useAuth();
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [confirmedAdjustments, setConfirmedAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Helper: detecta si es ≥9:00 AR de un día hábil ----
  // Solo bloquea si NO es día hábil (sábado/domingo/feriado). Durante
  // días hábiles generamos siempre que se cargue el dashboard, sin
  // importar la hora. El filtro real de "qué días procesar" lo hace
  // el loop interno usando el flag includeToday (post-cierre).
  const isBusinessDayAR = useCallback(() => {
    const arDateStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    return !isNonBusinessDay(arDateStr);
  }, []);

  // --- Genera ajustes pendientes para posiciones de futuros abiertas ----
  // Esta función NO toca filas existentes; solo crea las que faltan.
  //
  // Política de generación (Modelo "cron 7 AM día siguiente"):
  //   - No genera pendings si la hora AR < 07:00 (incluso siendo día hábil).
  //     Esto da margen a que Matba publique el settle oficial del día
  //     anterior antes de que el usuario abra la app y vea el banner.
  //   - Nunca genera pending del día corriente — solo de días pasados
  //     (controlado por el flag includeToday=false abajo).
  const generateMissingAdjustments = useCallback(async () => {
    if (!user) return;
    if (!isBusinessDayAR()) return;

    // Guarda 7 AM: respetamos la convención de cron "post-09:00 del día
    // siguiente". Si todavía no son las 7 AM en Argentina, no procesamos.
    {
      const arHourStr = new Date().toLocaleTimeString("en-GB", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour12: false,
      });
      const arHour = parseInt(arHourStr.slice(0, 2), 10);
      if (arHour < 7) return;
    }

    // 1) Posiciones de futuros abiertas (consolidando)
    if (!positions || positions.length === 0) return;

    // Tickers únicos de futuros que tiene el usuario.
    const futureTickersInPortfolio = Array.from(new Set(
      positions
        .filter((p) => p.instrument_type === "future" && p.ticker)
        .map((p) => p.ticker.toUpperCase().trim())
    ));
    if (futureTickersInPortfolio.length === 0) return;

    // Si NINGÚN ticker tiene precio en el feed Primary aún, esperamos al
    // próximo render. Esto evita generar filas pending con curr_settle
    // incorrecto (cayendo al fallback 3 = prev_settle = entry_price).
    // Una vez que useFuturePrices haya hecho su fetch, este hook se
    // re-ejecutará via dep array y procesará bien.
    const haveAnyLivePrice = futureTickersInPortfolio.some(
      (t) => futurePrices?.[t]?.price != null
    );
    if (!haveAnyLivePrice) {
      console.info("[useFutureAdjustments] Esperando feed Primary antes de generar...");
      return;
    }

    // Agrupamos por ticker para sumar netQty.
    const futureGroups = {};
    for (const p of positions) {
      if (p.instrument_type !== "future") continue;
      const ticker = (p.ticker || "").toUpperCase().trim();
      if (!ticker) continue;
      if (!futureGroups[ticker]) {
        futureGroups[ticker] = {
          ticker,
          ops: [],
          netQty: 0,
          earliestEntryDate: null,
          earliestEntryPrice: null,
          multiplier: getFutureMultiplier(p),
        };
      }
      const sign = p.operation_type === "sell" ? -1 : 1;
      const qty = Number(p.quantity) || 0;
      futureGroups[ticker].netQty += sign * qty;
      futureGroups[ticker].ops.push(p);

      const entryDate = p.entry_date || p.created_at?.slice(0, 10) || null;
      if (entryDate) {
        if (
          !futureGroups[ticker].earliestEntryDate ||
          entryDate < futureGroups[ticker].earliestEntryDate
        ) {
          futureGroups[ticker].earliestEntryDate = entryDate;
          futureGroups[ticker].earliestEntryPrice = Number(p.entry_price) || null;
        }
      }
    }

    // Filtrar grupos con netQty != 0 (es decir, posición no cerrada)
    const openGroups = Object.values(futureGroups).filter((g) => g.netQty !== 0);
    if (openGroups.length === 0) return;

    // 2) Para cada grupo, traer settlements y calcular qué ajustes faltan
    const todayAR = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    // Hora AR para decidir si incluimos hoy en la ventana de ajustes:
    //   - Si son ≥17 AR (mercado cerrado), generamos también el ajuste
    //     del día actual usando proxy (precio actual de Primary o último
    //     settle conocido). Es estimado, el usuario lo confirma cuando
    // Política de generación de pending:
    //
    //   Bajo el modelo de "cron 7 AM día siguiente" (acordado con LP en
    //   mayo 2026), el pending de un día D se genera recién cuando ya
    //   estamos en el día hábil D+1 a partir de las 7 AM AR. Eso da
    //   margen para que Matba publique el settle oficial de D y evita
    //   tener pendings "estimados" con un proxy del precio intra-día.
    //
    //   En la práctica: nunca generamos pending del día corriente. La
    //   variable `includeToday` queda en false siempre, y endDateStr es
    //   "ayer hábil" o el último día con settle disponible.
    //
    //   Esto convive con el cálculo del P&L vivo del día (Modelo B): si
    //   no hay pending del día corriente, TotalCard / ConsolidatedRow
    //   calculan P&L como (current_price - lookup.lastSettle), donde
    //   lookup.lastSettle es el settle del último adjustment registrado
    //   (típicamente, el pending de ayer).
    //
    //   IMPORTANTE: igual seguimos calculando arHour por compatibilidad
    //   con código que lo lea aguas abajo. El switch lo paramos acá.
    const arHourStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false,
    });
    const arHour = parseInt(arHourStr.slice(0, 2), 10);
    const includeToday = false; // nunca generar pending del día corriente

    const tickers = openGroups.map((g) => g.ticker);

    // Traer todos los settlements de esos tickers en bloque
    const { data: settles, error: sErr } = await supabase
      .from("futures_settlements_history")
      .select("ticker, settle_date, settlement")
      .in("ticker", tickers)
      .order("settle_date", { ascending: true });
    if (sErr) {
      console.warn("[useFutureAdjustments] Error trayendo settlements:", sErr);
      return;
    }

    // Index por ticker
    const settlesByTicker = {};
    for (const s of settles || []) {
      if (!settlesByTicker[s.ticker]) settlesByTicker[s.ticker] = [];
      settlesByTicker[s.ticker].push(s);
    }

    // Traer ajustes existentes (para no duplicar)
    const positionIds = [];
    for (const g of openGroups) {
      for (const op of g.ops) positionIds.push(op.id);
    }
    const { data: existing, error: eErr } = await supabase
      .from("futures_daily_adjustments")
      .select("position_id, adjustment_date")
      .in("position_id", positionIds);
    if (eErr) {
      console.warn("[useFutureAdjustments] Error trayendo ajustes existentes:", eErr);
      return;
    }
    const existingSet = new Set(
      (existing || []).map((r) => `${r.position_id}__${r.adjustment_date}`)
    );

    // 3) Por cada grupo + cada day disponible en settlement → calcular fila
    const rowsToInsert = [];

    for (const g of openGroups) {
      const tickerSettles = settlesByTicker[g.ticker] || [];
      if (tickerSettles.length === 0) continue;

      // Anchor op: la op MÁS VIEJA del grupo. Define entry_date y entry_price
      // que usamos como prev_settle del primer día.
      const anchorOp = g.ops.reduce(
        (a, b) => {
          const aD = a.entry_date || a.created_at?.slice(0, 10) || "9999-12-31";
          const bD = b.entry_date || b.created_at?.slice(0, 10) || "9999-12-31";
          return aD < bD ? a : b;
        },
        g.ops[0]
      );
      const anchorEntryDate =
        anchorOp.entry_date || anchorOp.created_at?.slice(0, 10) || todayAR;
      const anchorEntryPrice = Number(anchorOp.entry_price) || 0;

      // Iteramos día por día desde entry_date+1 hasta hoy-1 (día hábil
      // anterior a hoy). Para cada día, intentamos resolver el settle:
      //   - Si hay settle exacto del día → uso ese (is_estimated=false).
      //   - Si NO hay → uso el precio actual de Primary feed (live) como
      //                 proxy. Si tampoco → uso entry_price.
      // Esto cubre el caso en que Primary remarkets no actualice el settle:
      // el ajuste se genera igual con un proxy y el usuario lo confirma con
      // el monto real que le liquidó su broker.
      //
      // Si estamos post-mercado AR (≥17:00), incluimos también el ajuste
      // del día actual con un proxy. Eso permite ver el banner el mismo
      // día post-cierre sin esperar al día siguiente.
      const cursor = new Date(anchorEntryDate + "T12:00:00");
      const endDateStr = includeToday
        ? todayAR
        : (() => {
            // ayer en AR (o último día hábil)
            const d = new Date(todayAR + "T12:00:00");
            d.setDate(d.getDate() - 1);
            return d.toISOString().slice(0, 10);
          })();
      const endDate = new Date(endDateStr + "T12:00:00");
      // endDate es inclusive — la condición del loop es <=
      endDate.setHours(23, 59, 59, 999);

      // Empezamos desde el día siguiente al entry_date (el día de la compra
      // no genera ajuste — sí podría generarlo si hubo MTM ese mismo día,
      // pero por simplicidad arrancamos desde el día hábil siguiente).
      cursor.setDate(cursor.getDate() + 1);
      while (cursor.getDay() === 0 || cursor.getDay() === 6) {
        cursor.setDate(cursor.getDate() + 1);
      }

      while (cursor <= endDate) {
        const adjDate = cursor.toISOString().slice(0, 10);

        // Skip días no hábiles (feriados, fines de semana)
        if (isNonBusinessDay(adjDate)) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        // ¿Ya existe ajuste para esta posición × fecha?
        const key = `${anchorOp.id}__${adjDate}`;
        if (existingSet.has(key)) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        // Resolver prev_settle: el settle del día hábil ANTERIOR a adjDate.
        //   - Si existe en histórico → usar ese.
        //   - Si no → entry_price (es el primer día de la posición).
        let prevSettle = anchorEntryPrice;
        const prevCandidates = tickerSettles.filter(
          (x) => x.settle_date < adjDate
        );
        if (prevCandidates.length > 0) {
          prevSettle = Number(prevCandidates[prevCandidates.length - 1].settlement);
        }

        // Resolver curr_settle con cascada de fallbacks:
        //   1) Settle exacto del día en BD → preferido (is_estimated=false).
        //   2) Si NO hay y existe precio actual en feed Primary → usarlo
        //      como proxy. Es lo más cercano a "precio de cierre del día"
        //      que se puede conseguir en vivo (is_estimated=true).
        //   3) Si tampoco hay precio en feed → usar prev_settle como
        //      curr_settle (estimated_amount = 0). Conservador
        //      (is_estimated=true).
        const exactSettle = tickerSettles.find((x) => x.settle_date === adjDate);
        let currSettle;
        let isEstimated;

        if (exactSettle) {
          currSettle = Number(exactSettle.settlement);
          isEstimated = false;
        } else {
          // No hay settle oficial — buscar fallback en feed live de Primary
          const livePrice = futurePrices?.[g.ticker]?.price;
          if (livePrice != null && Number.isFinite(Number(livePrice))) {
            currSettle = Number(livePrice);
            isEstimated = true;
          } else {
            // Último recurso: prev_settle. Estimated_amount queda 0.
            currSettle = prevSettle;
            isEstimated = true;
          }
        }

        if (!Number.isFinite(currSettle) || !Number.isFinite(prevSettle)) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        const estimatedAmount =
          (currSettle - prevSettle) * g.netQty * g.multiplier;

        rowsToInsert.push({
          user_id: user.id,
          position_id: anchorOp.id,
          ticker: g.ticker,
          adjustment_date: adjDate,
          prev_settle: prevSettle,
          curr_settle: currSettle,
          net_qty: g.netQty,
          multiplier: g.multiplier,
          estimated_amount: estimatedAmount,
          is_estimated: isEstimated,
          status: "pending",
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 4) Insert (si hay algo que insertar)
    if (rowsToInsert.length > 0) {
      const { error: iErr } = await supabase
        .from("futures_daily_adjustments")
        .insert(rowsToInsert);
      if (iErr) {
        console.warn("[useFutureAdjustments] Error insertando ajustes:", iErr);
      } else {
        console.info(
          `[useFutureAdjustments] Generados ${rowsToInsert.length} ajustes pendientes`
        );
      }
    }
  }, [user, positions, futurePrices, isBusinessDayAR]);

  // --- Carga ajustes desde DB y dispara la generación ----
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        // Primero generamos los que falten (no rompe si falla)
        await generateMissingAdjustments();

        // Después leemos todo lo que hay en DB
        const { data, error: rErr } = await supabase
          .from("futures_daily_adjustments")
          .select("*")
          .eq("user_id", user.id)
          .order("adjustment_date", { ascending: false });

        if (cancelled) return;
        if (rErr) {
          setError(rErr.message);
          setLoading(false);
          return;
        }

        const pending = (data || []).filter((r) => r.status === "pending");
        const confirmed = (data || []).filter((r) => r.status === "confirmed");
        setPendingAdjustments(pending);
        setConfirmedAdjustments(confirmed);
        setLoading(false);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refreshKey, generateMissingAdjustments]);

  // --- Confirmar un ajuste: edita la fila + crea cash_movement ----
  const confirm = useCallback(
    async (adjustmentId, actualAmount) => {
      if (!user) throw new Error("No hay sesión");
      const adj = pendingAdjustments.find((a) => a.id === adjustmentId);
      if (!adj) throw new Error("Ajuste no encontrado");

      const monto = Number(actualAmount);
      if (!Number.isFinite(monto)) throw new Error("Monto inválido");

      // El modelo de cash_movements requiere amount > 0 (constraint
      // cash_movements_amount_positive). El signo se expresa via
      // movement_type: 'deposit' suma al saldo, 'withdrawal' resta.
      //
      //   monto > 0  → deposit (te acreditan ARS por ganancia)
      //   monto < 0  → withdrawal (te debitan ARS por pérdida)
      //   monto === 0 → NO creamos movement (sería violación del constraint
      //                 y un movement de $0 no aporta nada al libro).
      //                 La fila queda confirmed sin cash_movement asociado.
      let cashMovementId = null;
      if (monto !== 0) {
        const movementType = monto > 0 ? "deposit" : "withdrawal";
        const absAmount = Math.abs(monto);
        const notes = `Ajuste futuro ${adj.ticker} (${adj.adjustment_date})`;

        // related_position_id va EXPLÍCITAMENTE en null acá. El constraint
        // cash_movements_related_position_logic exige que deposit/withdrawal
        // tengan related_position_id IS NULL (solo sale_proceeds y purchase_cost
        // pueden referenciar una position). La trazabilidad de qué ajuste
        // generó este movement se mantiene del otro lado: la fila de
        // futures_daily_adjustments guarda el cash_movement_id en su columna
        // homónima (ver UPDATE más abajo). Si querés saber a qué futuro
        // corresponde un movement, hacés JOIN por esa FK; o leés la `notes`,
        // que ya incluye ticker y adjustment_date para el libro.
        const { data: cm, error: cmErr } = await supabase
          .from("cash_movements")
          .insert({
            user_id: user.id,
            movement_date: adj.adjustment_date,
            currency: "ARS",
            amount: absAmount, // siempre positivo, signo via movement_type
            movement_type: movementType,
            related_position_id: null,
            notes,
          })
          .select()
          .single();

        if (cmErr) throw cmErr;
        cashMovementId = cm.id;
      }

      // 2) Actualizar la fila de ajuste — guardamos el monto signed
      //    en actual_amount (queremos preservar el signo para futuras
      //    queries y el P&L Acreditado del Tramo 4).
      const { error: uErr } = await supabase
        .from("futures_daily_adjustments")
        .update({
          actual_amount: monto,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          cash_movement_id: cashMovementId, // null si monto === 0
        })
        .eq("id", adjustmentId);

      if (uErr) throw uErr;

      // 3) Refrescar
      setRefreshKey((k) => k + 1);
      return { cashMovementId, amount: monto };
    },
    [user, pendingAdjustments]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return {
    pendingAdjustments,
    confirmedAdjustments,
    loading,
    error,
    confirm,
    refresh,
  };
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


/* ─────────────── Cash movements: helpers + hook ───────────────
 *
 * Lógica del cash en EcoFlow:
 *
 * 1) Toda compra de bono/stock/cedear/on inyecta automáticamente un
 *    cash_movement de tipo 'purchase_cost' que resta del saldo. Toda
 *    venta inyecta un 'sale_proceeds' que suma. La fecha del movement
 *    depende del settlement (CI = entry_date, T1 = +1 día hábil).
 *
 * 2) Los depósitos (Ingresar) y retiros (Retirar) son movements puros
 *    sin position asociada — son ajustes manuales del cash.
 *
 * 3) El saldo se calcula sumando movements (firmados según movement_type).
 *    NO se persiste el saldo, se computa cada vez. Garantiza consistencia
 *    al editar/borrar operaciones (ON DELETE CASCADE).
 *
 * 4) Tipos NO incluidos en el cash automático: future, option, caucion,
 *    fci, crypto, usd. Para esos el usuario carga manualmente con
 *    Ingresar/Retirar si quiere reflejar el flujo de caja.
 */

/**
 * Tipos de instrumento que disparan un cash_movement automático al
 * crear/editar una operación.
 *
 * Bonos / ON / Stocks / CEDEARs / FCI:
 *   - Compra → purchase_cost = qty × price (con /100 para bonos/ON)
 *   - Venta  → sale_proceeds = qty × price (con /100 para bonos/ON)
 *   - Settlement determina la fecha del cash (CI = mismo día, T1 = +1 hábil)
 *
 * Futuros (lógica especial):
 *   - Compra (apertura) → NO genera cash. Es un compromiso a futuro;
 *     no hay desembolso real (solo garantías que la app no trackea).
 *   - Venta (cierre parcial o total contra una compra previa) → genera
 *     sale_proceeds POSITIVO o NEGATIVO en ARS por el P&L del par cerrado.
 *     La fecha siempre es entry_date + 1 día hábil (ROFEX liquida T+1
 *     siempre, sin importar settlement de la position).
 *   - Si la venta es short puro (sin compras previas), se trata como
 *     apertura — no genera cash hasta que hayan compras que neteen.
 */
const CASH_AUTO_TYPES = new Set(["bond_ars", "bond_usd", "on", "stock", "cedear", "fci", "future"]);

/**
 * Calcula el P&L realizado de una venta de futuro contra las compras
 * previas del mismo ticker (PPP cronológico). Si la venta es la primera
 * operación o las compras previas no alcanzan a cubrir la cantidad,
 * devuelve null (no podemos calcular cash todavía).
 *
 * @param {Object}   sellPosition  La operación de venta recién cargada
 * @param {Array}    allPositions  Todas las positions del usuario en BD
 *                                 (incluye o no a sellPosition; la función
 *                                  excluye su propio id para evitar contar
 *                                  la venta como parte del histórico)
 * @returns {number|null}  P&L en ARS (puede ser negativo), o null si
 *                         no hay compras suficientes para netear
 */
function computeFuturePnLForSell(sellPosition, allPositions) {
  if (sellPosition.instrument_type !== "future") return null;
  if (sellPosition.operation_type !== "sell") return null;

  const ticker = (sellPosition.ticker || "").toUpperCase();
  // Filtrar mismas operaciones del ticker excluyendo la venta misma.
  const others = (allPositions || []).filter((p) =>
    p.id !== sellPosition.id &&
    (p.ticker || "").toUpperCase() === ticker &&
    p.instrument_type === "future"
  );

  // Ordenar cronológicamente para calcular PPP "al momento de esta venta"
  const sellDate = sellPosition.entry_date || "9999-12-31";
  const sellCreated = sellPosition.created_at || "";
  const priorOps = others.filter((p) => {
    const pd = p.entry_date || "9999-12-31";
    if (pd < sellDate) return true;
    if (pd > sellDate) return false;
    return (p.created_at || "") < sellCreated;
  });

  let cumQty = 0;
  let cumValue = 0;
  for (const p of priorOps) {
    const qty = Number(p.quantity) || 0;
    const price = Number(p.entry_price) || 0;
    if (p.operation_type === "sell") {
      // Una venta previa redujo el lote. Mantenemos PPP, descontamos qty.
      const ppp = cumQty > 0 ? cumValue / cumQty : null;
      if (ppp != null) {
        const consumed = Math.min(qty, cumQty);
        cumQty -= consumed;
        cumValue -= consumed * ppp;
      }
    } else {
      cumQty += qty;
      cumValue += qty * price;
    }
  }

  if (cumQty <= 0) return null; // sin compras previas, no hay cierre

  const ppp = cumValue / cumQty;
  const sellQty = Number(sellPosition.quantity) || 0;
  const sellPrice = Number(sellPosition.entry_price) || 0;
  if (sellQty <= 0 || sellPrice <= 0) return null;

  // Solo se puede netear hasta cumQty (por encima sería short)
  const closedQty = Math.min(sellQty, cumQty);
  const mult = FUTURE_MULTIPLIER_DEFAULT;

  // P&L = qty × multiplicador × (precio_venta − PPP)
  return closedQty * mult * (sellPrice - ppp);
}

/**
 * Calcula el monto de cash (POSITIVO) que mueve una operación, junto
 * con el tipo de movement que corresponde.
 *
 * Para bonos / ON / stocks / cedears: monto bruto de la operación.
 * Para futuros: P&L del par cerrado (solo si es venta neteable).
 *
 * @returns {{amount: number, movement_type: string} | null}
 */
function computeCashAmountAndType(position, allPositions) {
  if (!position) return null;
  if (!CASH_AUTO_TYPES.has(position.instrument_type)) return null;
  const qty = Number(position.quantity);
  const price = Number(position.entry_price);
  if (!qty || !price || qty <= 0 || price <= 0) return null;

  // Caso futuros: ya NO generamos cash_movement automático al cerrar par.
  // El nuevo modelo (Tramo 2 de la migración a future_adjustments)
  // requiere que cada ajuste diario MTM se confirme manualmente por el
  // usuario, porque el monto que liquida Cocos suele no coincidir
  // exactamente con el calculado matemáticamente.
  // El cierre del par se considera "el último ajuste diario" y se
  // confirma igual que el resto a través del modal de acreditaciones.
  if (position.instrument_type === "future") {
    return null;
  }

  // Bonos / ON: precio cada 100 VN
  let amount;
  if (position.instrument_type === "bond_ars" || position.instrument_type === "bond_usd" || position.instrument_type === "on") {
    amount = (qty * price) / 100;
  } else {
    // Stocks, CEDEARs: qty × price directo
    amount = qty * price;
  }
  const movement_type = position.operation_type === "sell" ? "sale_proceeds" : "purchase_cost";
  return { amount, movement_type };
}

/**
 * Devuelve la fecha efectiva en la que el cash impacta el saldo, dada
 * una position con su settlement.
 *
 * Para bonos/stocks/etc: respeta settlement (CI = mismo día, T1 = +1 hábil).
 * Para futuros: SIEMPRE T+1 (ROFEX liquida así independientemente del
 * settlement registrado, que para futuros es semánticamente irrelevante).
 *
 * @returns {string|null}  YYYY-MM-DD, o null si la position no tiene fecha.
 */
function computeMovementDate(position) {
  if (!position?.entry_date) return null;
  // entry_date viene de Postgres como string YYYY-MM-DD o como objeto Date.
  // Lo normalizamos a string.
  const baseDate = typeof position.entry_date === "string"
    ? position.entry_date.slice(0, 10)
    : new Date(position.entry_date).toISOString().slice(0, 10);

  // Futuros: siempre T+1 (acreditación ROFEX al día hábil siguiente)
  if (position.instrument_type === "future") {
    return addBusinessDays(baseDate, 1);
  }

  if (position.settlement === "T1") {
    return addBusinessDays(baseDate, 1);
  }
  // CI o cualquier otro valor → mismo día (default).
  return baseDate;
}

/**
 * Construye el payload completo de un cash_movement para una position.
 * Devuelve null si la position no debe generar movement (tipo no incluido,
 * compra de futuro, venta de futuro sin neteo, datos faltantes, etc.).
 *
 * @param {Object} position      La operación recién creada/editada
 * @param {string} userId        UUID del usuario
 * @param {Array}  allPositions  Todas las positions del usuario (necesario
 *                               solo para futuros, para calcular P&L del par)
 */
function buildCashMovementPayload(position, userId, allPositions) {
  if (!CASH_AUTO_TYPES.has(position.instrument_type)) return null;
  const cashInfo = computeCashAmountAndType(position, allPositions);
  if (!cashInfo) return null;
  const movementDate = computeMovementDate(position);
  if (!movementDate) return null;
  // Para futuros la moneda del cash siempre es ARS (ROFEX liquida en pesos)
  const currency = position.instrument_type === "future"
    ? "ARS"
    : (position.entry_currency || "ARS");
  return {
    user_id: userId,
    movement_date: movementDate,
    movement_type: cashInfo.movement_type,
    currency,
    amount: cashInfo.amount,
    related_position_id: position.id,
    notes: position.instrument_type === "future"
      ? `P&L cierre futuro ${position.ticker || ""}`
      : null,
  };
}

/**
 * Hook que expone los cash_movements del usuario y deriva el saldo
 * por moneda. Es la fuente de verdad del efectivo.
 *
 * Provee:
 *   - movements:        array completo de movements (ordenado por fecha desc)
 *   - balanceByCurrency: { ARS, "USD-MEP", "USD-CCL" } saldo neto actual
 *   - balanceAt(date, currency): saldo a una fecha específica
 *   - addManualMovement(type, currency, amount, date, notes): inserta deposit/withdrawal
 *   - syncForPosition(position): inserta o actualiza el movement para una position
 *                                 (idempotente: si ya existe, lo updatea; si no, lo crea)
 *   - removeForPosition(positionId): borra el movement asociado (cascade ya lo hace
 *                                     desde la BD, pero esto refresca el state local)
 *   - loading, error, refresh
 */
function useCashMovements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setMovements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("user_id", user.id)
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setMovements([]);
    } else {
      setMovements(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Suma firmada de los amounts según movement_type:
   *   deposit, sale_proceeds → +amount
   *   withdrawal, purchase_cost → -amount
   */
  const signedAmount = (m) => {
    const sign = (m.movement_type === "deposit" || m.movement_type === "sale_proceeds") ? 1 : -1;
    return sign * Number(m.amount);
  };

  /**
   * Saldo NETO al día de hoy por moneda. Solo cuenta movements cuya
   * movement_date ya pasó (o es hoy). Los movements futuros (T+1
   * cargados hoy) NO entran al saldo CI.
   */
  const balanceByCurrency = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const result = { "ARS": 0, "USD-MEP": 0, "USD-CCL": 0 };
    for (const m of movements) {
      if (m.movement_date > today) continue; // pendientes de liquidar
      const c = m.currency;
      if (!(c in result)) continue;
      result[c] += signedAmount(m);
    }
    return result;
  }, [movements]);

  /**
   * Saldo a una fecha y moneda específica (incluye movements <= fecha).
   * Se usa en LiquidityCard para los pickers CI / T1 / 30D / 60D / 90D.
   */
  const balanceAt = useCallback((isoDate, currency) => {
    let total = 0;
    for (const m of movements) {
      if (m.movement_date > isoDate) continue;
      if (m.currency !== currency) continue;
      total += signedAmount(m);
    }
    return total;
  }, [movements]);

  /**
   * Inserta un movement manual (deposit / withdrawal). El amount debe
   * llegar SIEMPRE positivo; el signo lo da movement_type.
   */
  const addManualMovement = useCallback(async ({ movement_type, currency, amount, movement_date, notes }) => {
    if (!user) throw new Error("No hay sesión activa");
    if (!["deposit", "withdrawal"].includes(movement_type)) {
      throw new Error("addManualMovement solo acepta deposit o withdrawal");
    }
    if (!amount || amount <= 0) throw new Error("El monto debe ser positivo");

    const row = {
      user_id: user.id,
      movement_type,
      currency,
      amount,
      movement_date: movement_date || new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      related_position_id: null,
      notes: notes || null,
    };

    const { data, error: err } = await supabase
      .from("cash_movements")
      .insert([row])
      .select()
      .single();
    if (err) throw err;
    setMovements((prev) => [data, ...prev]);
    return data;
  }, [user]);

  /**
   * Sincroniza el cash_movement asociado a una position. Si ya existe
   * (related_position_id), lo updatea; si no, lo inserta. Si la position
   * no debe generar movement (tipo no incluido), borra el movement
   * existente (caso edge: cambiaste el tipo de una posición de bono a
   * futuro al editarla).
   *
   * Para futuros, necesitamos `allPositions` para calcular el P&L del par
   * cerrado (PPP cronológico contra todas las compras previas del ticker).
   * Para no-futuros allPositions es opcional (no se usa).
   */
  const syncForPosition = useCallback(async (position, allPositions) => {
    if (!user) throw new Error("No hay sesión activa");
    if (!position?.id) return;

    // Buscar movement existente en el state local. EXCLUIMOS los
    // movements de comisión (notes que empiezan con "Comisión") porque
    // esos los gestiona insertCommissionMovement y syncForPosition no
    // los tiene que tocar — son un movement aparte del principal.
    const existing = movements.find(
      (m) => m.related_position_id === position.id &&
             !((m.notes || "").startsWith("Comisión"))
    );
    const payload = buildCashMovementPayload(position, user.id, allPositions);

    if (!payload) {
      // Position no debe generar movement → borrar el existente si lo hay
      if (existing) {
        const { error: err } = await supabase
          .from("cash_movements")
          .delete()
          .eq("id", existing.id);
        if (err) throw err;
        setMovements((prev) => prev.filter((m) => m.id !== existing.id));
      }
      return null;
    }

    if (existing) {
      // Update
      const patch = {
        movement_date: payload.movement_date,
        movement_type: payload.movement_type,
        currency: payload.currency,
        amount: payload.amount,
      };
      const { data, error: err } = await supabase
        .from("cash_movements")
        .update(patch)
        .eq("id", existing.id)
        .select()
        .single();
      if (err) throw err;
      setMovements((prev) => prev.map((m) => (m.id === existing.id ? data : m)));
      return data;
    } else {
      // Insert
      const { data, error: err } = await supabase
        .from("cash_movements")
        .insert([payload])
        .select()
        .single();
      if (err) throw err;
      setMovements((prev) => [data, ...prev]);
      return data;
    }
  }, [user, movements]);

  /**
   * Refresca el state local después de borrar una position. La FK
   * ON DELETE CASCADE en la BD ya borró el movement, así que solo
   * limpiamos el array local.
   */
  const removeForPosition = useCallback((positionId) => {
    setMovements((prev) => prev.filter((m) => m.related_position_id !== positionId));
  }, []);

  /**
   * Inserta un cash_movement de tipo purchase_cost por la comisión que
   * el usuario tipeó en el form de futuros (campo opcional). Se ejecuta
   * SOLO al crear la position (no al editar) para evitar duplicar.
   *
   * Detalles:
   *   - movement_type = "purchase_cost" (los brokers facturan al cliente)
   *   - amount = position.extra.commission (lo que el user cargó)
   *   - currency = position.entry_currency
   *   - related_position_id = position.id (cumple constraint
   *     cash_movements_related_position_logic)
   *   - movement_date = entry_date + 1 día hábil (Cocos/Balanz/IOL
   *     liquidan derechos de mercado de derivados a T+1)
   *   - notes prefijadas con "Comisión" para que syncForPosition los
   *     pueda excluir del find y no se pisen.
   */
  const insertCommissionMovement = useCallback(async (position) => {
    if (!user) throw new Error("No hay sesión activa");
    if (!position?.id) return null;
    const amount = Number(position.extra?.commission);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (!position.entry_date) return null;

    // T+1 hábil: avanzamos 1 día y si cae sábado o domingo, seguimos
    // hasta el lunes. NO contemplamos feriados — el cron MAE va a
    // corregir desviaciones cuando se publique el dato oficial.
    const start = new Date(position.entry_date + "T00:00:00");
    const dt = new Date(start);
    dt.setDate(dt.getDate() + 1);
    while (dt.getDay() === 0 || dt.getDay() === 6) {
      dt.setDate(dt.getDate() + 1);
    }
    const movementDate = dt.toISOString().slice(0, 10);

    const payload = {
      user_id: user.id,
      movement_type: "purchase_cost",
      currency: position.entry_currency,
      amount,
      movement_date: movementDate,
      related_position_id: position.id,
      notes: `Comisión por derechos de mercado · ${position.ticker}`,
    };

    const { data, error: err } = await supabase
      .from("cash_movements")
      .insert([payload])
      .select()
      .single();
    if (err) throw err;
    setMovements((prev) => [data, ...prev]);
    return data;
  }, [user]);

  /**
   * Elimina un movement manual (típicamente un deposit/withdrawal cargado
   * por error). No se usa para movements asociados a positions — esos se
   * borran por cascade al borrar la position.
   *
   * Si el movement está asociado a un ajuste de futuros (existe una fila
   * en futures_daily_adjustments con cash_movement_id = movementId),
   * primero borramos esa fila. La FK con ON DELETE SET NULL no alcanza
   * porque dejaría la fila como confirmada sin movement, lo cual rompe
   * el modelo (queremos que se vuelva a generar el ajuste pendiente al
   * próximo refresh del dashboard).
   */
  const deleteManualMovement = useCallback(async (movementId) => {
    if (!user) throw new Error("No hay sesión activa");

    // 1) Si hay una fila de future_adjustment asociada, borrarla.
    //    Esto hace que el ajuste vuelva a generarse al próximo refresh
    //    (siempre que aún haya settlement en histórico para ese día).
    const { error: adjErr } = await supabase
      .from("futures_daily_adjustments")
      .delete()
      .eq("cash_movement_id", movementId);
    if (adjErr) {
      // No bloqueante: si falla, lo logueamos pero seguimos con el
      // delete del movement. La fila quedaría con cash_movement_id null
      // (por la FK ON DELETE SET NULL), que es un estado inconsistente
      // pero no rompe la app.
      console.warn("[deleteManualMovement] Error borrando ajuste asociado:", adjErr);
    }

    // 2) Borrar el cash_movement
    const { error: err } = await supabase
      .from("cash_movements")
      .delete()
      .eq("id", movementId);
    if (err) throw err;
    setMovements((prev) => prev.filter((m) => m.id !== movementId));
  }, [user]);

  /**
   * Actualiza un movement manual (deposit/withdrawal) cargado previamente.
   * Permite cambiar tipo, moneda, monto, fecha y notas. Si el cambio es
   * de deposit a withdrawal (o viceversa), el saldo se ajusta automático
   * porque el balance se recalcula a partir del log entero cada vez.
   */
  const updateManualMovement = useCallback(async (movementId, patch) => {
    if (!user) throw new Error("No hay sesión activa");
    if (patch.movement_type && !["deposit", "withdrawal"].includes(patch.movement_type)) {
      throw new Error("updateManualMovement solo acepta deposit o withdrawal");
    }
    if (patch.amount != null && patch.amount <= 0) {
      throw new Error("El monto debe ser positivo");
    }
    const { data, error: err } = await supabase
      .from("cash_movements")
      .update(patch)
      .eq("id", movementId)
      .select()
      .single();
    if (err) throw err;
    setMovements((prev) => prev.map((m) => (m.id === movementId ? data : m)));
    return data;
  }, [user]);

  return {
    movements,
    balanceByCurrency,
    balanceAt,
    addManualMovement,
    updateManualMovement,
    syncForPosition,
    removeForPosition,
    insertCommissionMovement,
    deleteManualMovement,
    loading,
    error,
    refresh,
  };
}


/* ─────────────── Helpers de formato ─────────────── */

/**
 * Formatea un número con locale es-AR (separador miles "." y decimal ",").
 *
 * Opciones:
 *   - maxDecimals: tope máximo de decimales (default 2).
 *   - minDecimals: piso mínimo de decimales (default 0).
 *   - smartDecimals: si true, detecta cuántos decimales "reales" tiene el
 *     número de origen y muestra como mínimo 2 y como máximo `maxDecimals`.
 *     Útil para precios: si BYMA reporta 139,455 lo respetamos; si reporta
 *     139,32 lo mostramos como 139,32 sin agregar ceros.
 *     IMPORTANTE: contamos los decimales del number `n` original; si lo
 *     pasás como string, usamos String(n).
 */
function fmtNumber(n, opts = {}) {
  if (n == null || isNaN(n)) return "—";
  const { maxDecimals = 2, minDecimals = 0, smartDecimals = false } = opts;

  let minF = minDecimals;
  let maxF = maxDecimals;

  if (smartDecimals) {
    // Cuántos decimales tiene el número original (sin ceros redundantes).
    // Ej: 139.455 → 3 decimales; 139.32 → 2; 1440 → 0.
    const str = String(Number(n));
    const dotIdx = str.indexOf(".");
    const realDecimals = dotIdx === -1 ? 0 : str.length - dotIdx - 1;
    // Mostrar 2 mínimo (para que precios "redondos" como 1440 se vean
    // como "1.440,00") y el máximo entre realDecimals y minDecimals,
    // pero nunca más que maxDecimals.
    minF = Math.max(2, minDecimals);
    maxF = Math.min(maxDecimals, Math.max(minF, realDecimals));
  }

  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: minF,
    maximumFractionDigits: maxF,
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
 * Para precios actuales de bonos usamos data912 vía /api/data912?type=
 * (consolidado para no llenar el cupo de funciones serverless). El hook
 * useBondPrices se encarga de fetchear y cachear esos precios.
 */

function DashboardOverview({ positions, fxState, bondPricesState, futurePricesState, stockPricesState, cashState, futureAdjustmentsState, onIngresar, onRetirar }) {
  const { fx, loading: fxLoading, error: fxError, lastUpdated: fxLastUpdated, refresh: refreshFx } = fxState;
  const { prices: bondPrices, loading: pricesLoading, error: pricesError, lastFetch: pricesLastFetch, refresh: refreshBondPrices } = bondPricesState;
  // futurePricesState viene de PortfolioDashboard (un solo hook compartido
  // entre Dashboard y ConsolidatedSection para evitar dos pollings duplicados).
  const futurePrices = futurePricesState?.prices || {};
  // stockPricesState viene del nivel PortfolioDashboard (un único hook
  // useStockPrices compartido). Si no llega (caso edge), usamos {} vacío.
  const stockPrices = stockPricesState?.prices || {};
  const balanceByCurrency = cashState?.balanceByCurrency || { "ARS": 0, "USD-MEP": 0, "USD-CCL": 0 };
  const movements = cashState?.movements || [];

  // Lookup de adjustments de futuros — usado por TotalCard y DistributionCard
  // para descontar el P&L ya acreditado del valor de los futuros (ese P&L
  // ya está en cash y sumarlo de nuevo es double-counting). Si el hook
  // todavía no cargó, queda en null y los callers caen al fallback.
  const pendingAdjustments = futureAdjustmentsState?.pendingAdjustments || [];
  const confirmedAdjustments = futureAdjustmentsState?.confirmedAdjustments || [];
  const futureAdjLookup = useMemo(
    () => buildFutureAdjLookup(pendingAdjustments, confirmedAdjustments),
    [pendingAdjustments, confirmedAdjustments]
  );

  // Toggle de moneda de valuación: ARS / USD-MEP / USD-CCL
  const [valuationCurrency, setValuationCurrency] = useState("ARS");

  // Toggle Distribución: instrumentos / monedas
  const [distView, setDistView] = useState("instruments");

  // Toggle Liquidez Proyectada ventana — default CI (saldo cash actual).
  // Antes era 30d. El cambio refleja que ahora la card prioriza mostrarte
  // CUÁNTO TENÉS DISPONIBLE HOY antes que cuánto vas a recibir adelante.
  const [liquidityWindow, setLiquidityWindow] = useState("CI");

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 1. Toggle moneda de valuación */}
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
        <ValuationToggle
          value={valuationCurrency}
          onChange={setValuationCurrency}
        />
        <span style={{ fontSize: 11, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
          Cartera valuada en {valuationCurrency === "ARS" ? "Pesos" : valuationCurrency === "USD-MEP" ? "Dólar MEP" : "Dólar CCL"}
        </span>
      </div>

      {/* 2. Tres cards principales lado a lado */}
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
          bondPrices={bondPrices}
          futurePrices={futurePrices}
          stockPrices={stockPrices}
          valuationCurrency={valuationCurrency}
          balanceByCurrency={balanceByCurrency}
          futureAdjLookup={futureAdjLookup}
          onIngresar={onIngresar}
          onRetirar={onRetirar}
        />
        <DistributionCard
          positions={positions}
          fx={fx}
          bondPrices={bondPrices}
          futurePrices={futurePrices}
          valuationCurrency={valuationCurrency}
          balanceByCurrency={balanceByCurrency}
          futureAdjLookup={futureAdjLookup}
          view={distView}
          onViewChange={setDistView}
        />
        <LiquidityCard
          positions={positions}
          fx={fx}
          bondPrices={bondPrices}
          futurePrices={futurePrices}
          valuationCurrency={valuationCurrency}
          movements={movements}
          futureAdjLookup={futureAdjLookup}
          window={liquidityWindow}
          onWindowChange={setLiquidityWindow}
        />
      </div>

      {/* 3. Línea de cotizaciones */}
      <FxLine fx={fx} error={fxError} />

      {/* 4. Flujos proyectados (V1: lista simple) */}
      <FlowsSection positions={positions} bondPrices={bondPrices} fx={fx} futurePrices={futurePrices} />
    </div>
  );
}


/* ─────────────── FX Line: una línea con cotizaciones ──────────────
 *
 * Reemplazó al FxBand de 4 cards. Ahora todas las cotizaciones (Spot,
 * MEP, CCL, Blue) se muestran en una sola línea horizontal compacta,
 * con jerarquía visual:
 *   - Header tipo dashboard arriba: "COTIZACIONES DEL DÍA · Tue, 05/05"
 *   - 4 columnas con separadores verticales entre ellas
 *   - Cada columna: nombre del dólar (uppercase, dim) + dos valores
 *     etiquetados como "Compra" (muted) y "Venta" (text destacado)
 *
 * La diferenciación compra/venta se logra con:
 *   - sub-label "Compra" / "Venta" en gris pequeñito sobre cada valor
 *   - "Compra" en color C.muted (más discreta)
 *   - "Venta" en color C.text con peso 600 (es la que más se mira en
 *     la operativa de la fintech AR)
 */

function FxLine({ fx, error }) {
  // Cada nombre incluye "(HOY)" entre paréntesis para que el usuario
  // entienda que es la cotización del día sin necesidad de un título
  // separado arriba (que ocupaba espacio vertical innecesariamente).
  const items = [
    { key: "mayorista", label: "Dólar Spot" },
    { key: "mep",       label: "Dólar MEP"  },
    { key: "ccl",       label: "Dólar CCL"  },
    { key: "blue",      label: "Dólar Blue" },
  ];

  return (
    <div
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        marginBottom: 14,
      }}
    >
      {/* Grid de 4 cotizaciones con separadores verticales — sin header
       *  arriba (el "(HOY)" en cada label cumple ese rol). El botón global
       *  Actualizar vive en el header de Posiciones consolidadas.
       */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        {items.map((it, idx) => {
          const data = fx?.[it.key];
          const buy = data?.buy;
          const sell = data?.sell;
          const empty = !data || (buy == null && sell == null);

          return (
            <div
              key={it.key}
              style={{
                padding: "8px 12px",
                borderRight: idx < items.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {/* Nombre del dólar + "(HOY)" en sufijo más tenue */}
              <span
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.18em",
                  color: C.muted,
                  textTransform: "uppercase",
                  fontWeight: 600,
                  fontFamily: "'Roboto', sans-serif",
                }}
              >
                {it.label}
                <span style={{ color: C.dim, marginLeft: 6, fontWeight: 500 }}>
                  (Hoy)
                </span>
              </span>

              {empty ? (
                <span style={{ fontSize: 13, color: C.dim, fontFamily: "'JetBrains Mono', monospace" }}>—</span>
              ) : (
                /* Dos columnas: Compra | Venta, formato compacto inline */
                <div className="flex items-baseline" style={{ gap: 14 }}>
                  <div className="flex flex-col" style={{ gap: 1 }}>
                    <span
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontFamily: "'Roboto', sans-serif",
                      }}
                    >
                      Compra
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: C.muted,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {buy != null ? fmtCurrencyValue(buy, "ARS") : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col" style={{ gap: 1 }}>
                    <span
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontFamily: "'Roboto', sans-serif",
                      }}
                    >
                      Venta
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: C.text,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {sell != null ? fmtCurrencyValue(sell, "ARS") : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && !fx && (
        <div
          style={{
            fontSize: 11,
            color: C.red,
            padding: "6px 14px",
            borderTop: `1px solid ${C.border}`,
          }}
        >
          Error cargando cotizaciones: {error}
        </div>
      )}
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

function TotalCard({ positions, fx, bondPrices, futurePrices, stockPrices, valuationCurrency, balanceByCurrency, futureAdjLookup, onIngresar, onRetirar }) {
  // V2: ahora usamos precios de mercado de data912 cuando están disponibles.
  // El P&L se calcula como market - cost. Si no hay precio actualizado para
  // alguna posición, esa cae al fallback "a costo" y aparece en pricesFromCost.
  const totals = useMemo(
    () => computePortfolioTotals(positions, fx, valuationCurrency, bondPrices, futurePrices, futureAdjLookup),
    [positions, fx, valuationCurrency, bondPrices, futurePrices, futureAdjLookup]
  );

  // P&L del día (variación intra-día desde el cierre anterior). Se suma
  // posición por posición usando computeDailyPnL, que devuelve el P&L
  // en moneda de la posición. Después convertimos a la valuationCurrency.
  // Posiciones sin pct_change disponible se ignoran (no rompen el total).
  // Reset a 0 cuando estamos fuera del período de "P&L HOY":
  //   - Fin de semana: P&L = 0 todo el día
  //   - Lun-vie 00:00 - 10:29: P&L = 0 (mercado todavía no abrió hoy)
  //   - Lun-vie 10:30 - 23:59: P&L calculado normal
  // El reset a 00:00 del día hábil es lo que cambia el "día" desde la
  // perspectiva del usuario — al apertura del mercado el contador
  // empieza limpio contra el cierre de ayer.
  const dailyTotals = useMemo(() => {
    if (!fx || !positions) return { pnl: null, base: 0, hasAny: false };
    if (!isTradingDayAndMarketOpened()) {
      return { pnl: 0, base: 0, hasAny: true, marketClosed: true };
    }
    let pnlInValuation = 0;
    let prevValueInValuation = 0;
    let hasAny = false;

    for (const p of positions) {
      const d = computeDailyPnL(p, bondPrices, futurePrices, stockPrices, futureAdjLookup);
      if (!d || d.pnl == null || !Number.isFinite(d.pnl)) continue;

      // Moneda de la posición (igual lógica que en computePortfolioTotals)
      const cur = p.currency || "ARS";
      const conv = convertValue(d.pnl, cur, valuationCurrency, fx);
      if (conv == null) continue;
      pnlInValuation += conv;
      hasAny = true;

      // Valor "ayer" de la posición (para % vs cierre anterior).
      // Aproximamos como valor_actual - pnl_diario en la misma moneda.
      const valNow = positionValueAtMarket(p, bondPrices, futurePrices, stockPrices);
      if (valNow?.value != null) {
        const valNowConv = convertValue(valNow.value, cur, valuationCurrency, fx);
        if (valNowConv != null) {
          // valor_ayer = valor_hoy - pnl_diario
          prevValueInValuation += (valNowConv - conv);
        }
      }
    }

    return {
      pnl: hasAny ? pnlInValuation : null,
      base: prevValueInValuation,
      hasAny,
    };
  }, [positions, bondPrices, futurePrices, stockPrices, fx, valuationCurrency, futureAdjLookup]);

  const showDaily = dailyTotals.hasAny && dailyTotals.pnl != null;
  const dailyIsPositive = showDaily && dailyTotals.pnl >= 0;
  const dailyColor = (!showDaily || dailyTotals.marketClosed) ? C.dim : dailyIsPositive ? C.green : C.red;
  const dailySymbol = (!showDaily || dailyTotals.marketClosed) ? "" : dailyIsPositive ? "+" : "";
  const dailyPct = (showDaily && !dailyTotals.marketClosed && dailyTotals.base > 0)
    ? (dailyTotals.pnl / dailyTotals.base) * 100
    : null;

  // Cash neto en la moneda activa: convertimos el saldo de cada moneda
  // a la valuationCurrency seleccionada y los sumamos. Si el saldo de
  // alguna moneda no se puede convertir (FX no cargó todavía), esa
  // moneda no se incluye y se loguea silenciosamente.
  const cashInValuation = useMemo(() => {
    if (!balanceByCurrency) return 0;
    let total = 0;
    for (const [cur, amount] of Object.entries(balanceByCurrency)) {
      if (!amount) continue;
      const conv = convertValue(amount, cur, valuationCurrency, fx);
      if (conv != null) total += conv;
    }
    return total;
  }, [balanceByCurrency, valuationCurrency, fx]);

  // Total efectivo en pantalla: posiciones a mercado + cash. El P&L NO
  // suma cash porque el cash no tiene "ganancia" — es plata depositada
  // o recibida por venta, ya valuada al 100% de su monto.
  const positionsValue = totals.value ?? 0;
  const totalWithCash = positionsValue + cashInValuation;

  const tcLine = useMemo(() => {
    if (!fx) return null;
    const parts = [];
    if (fx.mep?.sell) parts.push(`MEP ${fmtCurrencyValue(fx.mep.sell, "ARS")}`);
    if (fx.ccl?.sell) parts.push(`CCL ${fmtCurrencyValue(fx.ccl.sell, "ARS")}`);
    return parts.join(" · ");
  }, [fx]);

  // Si todas las posiciones cayeron al fallback "a costo" (sin precio de
  // mercado), mostramos el badge "A costo" porque el total no refleja
  // mercado real. Si al menos UNA tiene precio, mostramos "A mercado".
  const allAtCost = totals.pricesFromMarket === 0 && totals.pricesFromCost > 0;
  const valuationLabel = allAtCost ? "A costo" : "A mercado";

  // P&L visible cuando hay al menos una posición valuada a mercado real
  const showPnl = totals.pnl != null && totals.pricesFromMarket > 0;
  const pnlIsPositive = showPnl && totals.pnl >= 0;
  const pnlColor = !showPnl ? C.dim : pnlIsPositive ? C.green : C.red;
  const pnlSymbol = !showPnl ? "" : pnlIsPositive ? "+" : "";

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={cardTitleStyle()}>Total</span>
        <span style={{ fontSize: 9.5, color: C.dim, fontFamily: "'Roboto', sans-serif", letterSpacing: "0.04em" }}>
          {valuationLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-3" style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: C.text,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-0.02em",
          }}
        >
          {(totals.value !== null || cashInValuation !== 0)
            ? fmtCurrencyValue(totalWithCash, valuationCurrency === "ARS" ? "ARS" : "USD")
            : "—"}
        </span>
      </div>

      {/* P&L: aparece solo si hay precio de mercado real para al menos
          una posición. Si no, mostramos las mini-stats de antes. */}
      {showPnl ? (
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: pnlColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {pnlSymbol}{fmtCurrencyValue(totals.pnl, valuationCurrency === "ARS" ? "ARS" : "USD")}
          </span>
          {totals.pnlPct != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: pnlColor,
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: pnlIsPositive ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                padding: "2px 7px",
                borderRadius: 2,
              }}
            >
              {pnlSymbol}{totals.pnlPct.toFixed(2)}%
            </span>
          )}
          <span style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
            histórico
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontFamily: "'Roboto', sans-serif" }}>
          {totals.pricesFromMarket === 0
            ? "P&L disponible cuando haya precios actualizados"
            : "—"}
        </div>
      )}

      {/* P&L del día (variación intra-día vs cierre anterior). Línea
          secundaria: usa los mismos colores que P&L total pero más chica.
          Si no hay datos para ninguna posición (todas son cauciones, FCI,
          etc.), no la mostramos. */}
      {showDaily && (
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: dailyColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {dailySymbol}{fmtCurrencyValue(dailyTotals.pnl, valuationCurrency === "ARS" ? "ARS" : "USD")}
          </span>
          {dailyPct != null && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: dailyColor,
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: dailyIsPositive ? "rgba(74,222,128,0.10)" : "rgba(248,113,113,0.10)",
                padding: "1px 6px",
                borderRadius: 2,
              }}
            >
              {dailySymbol}{dailyPct.toFixed(2)}%
            </span>
          )}
          <span style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
            hoy
          </span>
        </div>
      )}
      {!showDaily && showPnl && (
        <div style={{ marginBottom: 12 }} />
      )}

      {tcLine && (
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
          {tcLine}
        </div>
      )}

      {totals.pricesFromCost > 0 && totals.pricesFromMarket > 0 && (
        <div
          className="flex items-center gap-1"
          style={{
            marginTop: 10,
            fontSize: 10,
            color: C.dim,
            fontFamily: "'Roboto', sans-serif",
          }}
        >
          <span>{totals.pricesFromCost} {totals.pricesFromCost === 1 ? "posición" : "posiciones"} a costo · {totals.pricesFromMarket} a mercado</span>
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
          <span>{totals.unvalued} {totals.unvalued === 1 ? "posición sin valuar" : "posiciones sin valuar"}</span>
        </div>
      )}

      {/* Botones Ingresar / Retirar (modelo Balanz).
       *
       * Se usan para cargar movimientos manuales de cash (depósitos
       * desde el banco al broker, retiros del broker al banco). Las
       * compras y ventas mueven cash automático y NO requieren tocar
       * estos botones. Si onIngresar/onRetirar no fueron pasados (caso
       * de uso fuera del PortfolioDashboard), los botones no aparecen. */}
      {(onIngresar || onRetirar) && (
        <div
          className="flex gap-2"
          style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}
        >
          {onRetirar && (
            <button
              onClick={onRetirar}
              style={{
                flex: 1,
                backgroundColor: "transparent",
                border: `1px solid ${C.border}`,
                color: C.muted,
                padding: "7px 10px",
                fontSize: 11.5,
                fontFamily: "'Roboto', sans-serif",
                fontWeight: 500,
                letterSpacing: "0.02em",
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.text;
                e.currentTarget.style.borderColor = C.borderStrong;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.muted;
                e.currentTarget.style.borderColor = C.border;
              }}
            >
              Retirar
            </button>
          )}
          {onIngresar && (
            <button
              onClick={onIngresar}
              style={{
                flex: 1,
                backgroundColor: C.accent,
                color: C.bg,
                border: "none",
                padding: "7px 10px",
                fontSize: 11.5,
                fontFamily: "'Roboto', sans-serif",
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease",
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
              Ingresar
            </button>
          )}
        </div>
      )}
    </div>
  );
}


/* ─────────────── Card 2: Distribución ───────────────
 *
 * Dos vistas distintas:
 *
 * Vista "Instrumentos" (donut + lista):
 *   - Muestra cómo está repartida tu cartera por categoría de activo
 *     (Renta Fija ARS, Renta Fija USD, Acciones, etc.).
 *   - INCLUYE una porción "Efectivo" agregada al total. Es la suma del
 *     cash en todas las monedas convertido a valuationCurrency.
 *
 * Vista "Monedas" (4 renglones sin donut, modelo Balanz):
 *   - Instrumentos: valor a mercado de TODAS las posiciones convertido
 *     a valuationCurrency. Es lo que está invertido.
 *   - Pesos: saldo cash ARS (en su moneda nativa, no convertido).
 *   - Dólares: saldo cash USD-MEP (en su moneda nativa).
 *   - US Dollar (Cable): saldo cash USD-CCL (en su moneda nativa).
 *   - La suma de los 4 renglones (cada uno en su moneda) NO equivale al
 *     total — son montos en monedas distintas. Pero da el panorama por
 *     denominación.
 */

function DistributionCard({ positions, fx, bondPrices, futurePrices, valuationCurrency, balanceByCurrency, futureAdjLookup, view, onViewChange }) {
  // Vista "Instrumentos": donut con categorías + cash como una porción más.
  const instrumentSlices = useMemo(() => {
    const groups = groupByCategory(positions, fx, valuationCurrency, bondPrices);

    // Cash agregado: convertimos cada moneda a la valuationCurrency y sumamos.
    let cashTotal = 0;
    if (balanceByCurrency) {
      for (const [cur, amount] of Object.entries(balanceByCurrency)) {
        if (!amount || amount <= 0) continue;
        const conv = convertValue(amount, cur, valuationCurrency, fx);
        if (conv != null) cashTotal += conv;
      }
    }
    if (cashTotal > 0) {
      groups["Efectivo"] = (groups["Efectivo"] || 0) + cashTotal;
    }

    const total = Object.values(groups).reduce((acc, v) => acc + v, 0);
    if (total <= 0) return [];

    return Object.entries(groups)
      .filter(([_, v]) => v > 0)
      .map(([key, value], idx) => ({
        key,
        label: key,
        value,
        pct: (value / total) * 100,
        color: PROVIDER_COLORS[idx % PROVIDER_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, fx, valuationCurrency, bondPrices, balanceByCurrency]);

  // Vista "Monedas": 4 renglones (Instrumentos + 3 cash por moneda).
  const monedaRows = useMemo(() => {
    // Renglón 1: Instrumentos = total a mercado en valuationCurrency
    const totals = computePortfolioTotals(positions, fx, valuationCurrency, bondPrices, futurePrices, futureAdjLookup);
    const instrumentsTotal = totals.value ?? 0;

    // Renglones 2-4: cash por moneda (NO convertido — en su moneda nativa).
    const ars = balanceByCurrency?.["ARS"] || 0;
    const usdMep = balanceByCurrency?.["USD-MEP"] || 0;
    const usdCcl = balanceByCurrency?.["USD-CCL"] || 0;

    return [
      {
        key: "instruments",
        label: "Instrumentos",
        amount: instrumentsTotal,
        currency: valuationCurrency,
      },
      { key: "ars",     label: "Pesos",             amount: ars,    currency: "ARS"     },
      { key: "usd_mep", label: "Dólares",           amount: usdMep, currency: "USD-MEP" },
      { key: "usd_ccl", label: "US Dollar (Cable)", amount: usdCcl, currency: "USD-CCL" },
    ];
    // futurePrices va en las deps porque computePortfolioTotals lo usa para
    // valuar los futuros a su P&L MTM. Sin esta dep, cuando llega un precio
    // fresco de Primary el `instrumentsTotal` no se recalcula y queda stale,
    // y la suma "Instrumentos + Pesos" deja de coincidir con el TOTAL de
    // TotalCard (que sí lo tiene en sus deps). Bug reportado por LP en mayo
    // 2026: TOTAL daba $84.531.993,85 vs Instrumentos+Pesos=$83.269.743 — la
    // diferencia exacta era el delta del precio del DLR multiplicado por
    // net_qty × multiplier. futureAdjLookup también se incluye porque define
    // cuánto del P&L del futuro es no acreditado (afecta el "value").
  }, [positions, fx, valuationCurrency, bondPrices, futurePrices, futureAdjLookup, balanceByCurrency]);

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

      {view === "monedas" ? (
        /* Vista Monedas: 4 renglones simples sin donut. Cada moneda
           se muestra en su propio formato. Si el saldo es 0, mostramos
           "—" para no llenar de ceros. */
        <div className="flex flex-col">
          {monedaRows.map((row, idx) => {
            const empty = !row.amount || row.amount === 0;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between"
                style={{
                  padding: "8px 0",
                  borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    fontFamily: "'Roboto', sans-serif",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: empty ? C.dim : C.text,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {empty ? "—" : fmtCurrencyValue(row.amount, row.currency === "ARS" ? "ARS" : "USD")}
                </span>
              </div>
            );
          })}
        </div>
      ) : instrumentSlices.length === 0 ? (
        /* Vista Instrumentos sin datos */
        <div style={{ fontSize: 12, color: C.dim, padding: "20px 0", textAlign: "center" }}>
          Sin datos para distribuir
        </div>
      ) : (
        /* Vista Instrumentos: donut + lista */
        <div className="flex items-center gap-3">
          <DonutChart slices={instrumentSlices} size={106} />
          <div className="flex flex-col" style={{ flex: 1, gap: 6, minWidth: 0 }}>
            {instrumentSlices.slice(0, 5).map((s) => (
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
            {instrumentSlices.length > 5 && (
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
                +{instrumentSlices.length - 5} más
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

  const total = slices.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0 || slices.length === 0) return null;

  // Filtrar slices microscópicas que rompen el rendering. Cuando una
  // slice tiene fraction ~1.0 (e.g. RF ARS al 99.9999%) y otra tiene
  // fraction ~epsilon (e.g. saldo cash residual de centavos), los
  // ángulos de inicio y fin del path SVG colapsan y el donut sale
  // vacío. Threshold conservador: 0.5% del total. Las slices bajo ese
  // umbral siguen apareciendo en la leyenda de la card (que usa el
  // array original `slices`), pero no se dibujan en el donut.
  const significantSlices = slices.filter((s) => s.value / total >= 0.005);
  if (significantSlices.length === 0) return null;
  const sigTotal = significantSlices.reduce((acc, s) => acc + s.value, 0);

  // Caso especial: una sola slice del ~100%. Un path SVG con start = end
  // colapsa a 0, así que dibujamos un anillo perfecto con un <circle>
  // que solo tiene stroke (sin fill). El stroke pintado sobre el radio
  // medio entre el outer y el inner queda como un anillo lleno.
  if (significantSlices.length === 1) {
    const ringMidRadius = (radius + innerRadius) / 2;
    const ringWidth = radius - innerRadius;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle
          cx={cx}
          cy={cy}
          r={ringMidRadius}
          fill="none"
          stroke={significantSlices[0].color}
          strokeWidth={ringWidth}
        />
      </svg>
    );
  }

  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {significantSlices.map((s, idx) => {
        const fraction = s.value / sigTotal;
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

function LiquidityCard({ positions, fx, bondPrices, futurePrices, valuationCurrency, movements, futureAdjLookup, window: windowKey, onWindowChange }) {
  const breakdown = useMemo(
    () => computeLiquidityBreakdown(positions, fx, valuationCurrency, windowKey, bondPrices, movements, futurePrices, futureAdjLookup),
    [positions, fx, valuationCurrency, windowKey, bondPrices, movements, futurePrices, futureAdjLookup]
  );

  // Mensaje de footer dinámico según el window seleccionado.
  // CI = saldo cash puro; T1+ incluye P&L no acreditado de futuros; 30d+
  // suma además vencimientos proyectados.
  const footerMessage = (() => {
    if (windowKey === "CI") {
      return "Saldo de efectivo disponible al día de hoy.";
    }
    if (windowKey === "T1") {
      return "Saldo CI más flujos que liquidan al siguiente día hábil y P&L de futuros aún no acreditado.";
    }
    return "CI + P&L no acreditado de futuros + bonos, ONs, cauciones y opciones con vencimiento en la ventana, valuados a precio de mercado actual. Al vencimiento puede variar.";
  })();

  return (
    <div style={cardBaseStyle()}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={cardTitleStyle()}>Liquidez proyectada</span>
        <div className="flex" style={{ backgroundColor: C.deep, border: `1px solid ${C.border}`, padding: 2 }}>
          {[
            { key: "CI",  label: "CI"  },
            { key: "T1",  label: "T1"  },
            { key: "30d", label: "30d" },
            { key: "60d", label: "60d" },
            { key: "90d", label: "90d" },
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
          // Mostramos saldos negativos también (rojos) — son señal útil
          // para el usuario de que tiene un descubierto en esa moneda.
          const isNegative = v < 0;
          const isZero = v === 0;
          const display = isZero
            ? "—"
            : fmtCurrencyValue(v, row.key === "ARS" ? "ARS" : "USD");
          const color = isZero ? C.dim : (isNegative ? C.red : C.text);
          return (
            <div key={row.key} className="flex items-center justify-between">
              <span style={{ fontSize: 11.5, color: C.muted, fontFamily: "'Roboto', sans-serif" }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                {display}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: C.dim, marginTop: 10, fontFamily: "'Roboto', sans-serif", lineHeight: 1.4 }}>
        {footerMessage}
      </div>
    </div>
  );
}


/* ─────────────── Sección Flujos Proyectados (V1: placeholder) ─────────────── */

function FlowsSection({ positions, bondPrices, fx, futurePrices }) {
  const upcomingMaturities = useMemo(() => {
    const now = new Date();
    const events = [];

    // Para evitar duplicados (ej: una compra y una venta del mismo
    // futuro generaban DOS filas en Flujos antes), iteramos sobre el
    // consolidado en lugar de las operaciones crudas.
    const consolidated = consolidatePositions(positions, bondPrices, futurePrices);

    for (const g of consolidated) {
      // Saltamos posiciones cerradas (cantidad neta = 0): ya no hay
      // flujo futuro sobre ellas, el P&L está realizado.
      if (g.isClosed) continue;
      // Las posiciones short de futuros tampoco generan flujo proyectado
      // típico (es un derivado vendido).
      if (g.netQty === 0) continue;

      const t = g.instrument_type;
      const ticker = (g.ticker || "").toUpperCase();
      let date = null;
      let typeLabel = null;

      if (t === "bond_ars" && BOND_REGISTRY[ticker]?.maturityDate) {
        date = BOND_REGISTRY[ticker].maturityDate;
        typeLabel = "Bono ARS";
      } else if (t === "caucion") {
        // Cauciones son no-consolidables: usamos la operación específica.
        // (groupKey incluye el id, así que cada caución sigue siendo única)
        const op = g.operations[0];
        if (op?.entry_date && op.extra?.term_days) {
          const start = new Date(op.entry_date);
          date = new Date(start.getTime() + Number(op.extra.term_days) * 86400000)
            .toISOString().slice(0, 10);
          typeLabel = "Caución";
        }
      } else if (t === "future") {
        const contract = DLR_REGISTRY.find((c) => c.ticker === ticker);
        if (contract?.maturityDate) {
          date = contract.maturityDate;
          typeLabel = "Futuro DLR";
        }
      }
      // NOTA: bond_usd queda fuera de Flujos por ahora — sus fechas de
      // vencimiento están en el catálogo dinámico (Supabase) que no
      // recibe FlowsSection. Se agregará cuando levantemos el catálogo
      // al PortfolioDashboard. Para tu cartera actual (lecaps + DLR)
      // esto no afecta nada.
      if (!date) continue;

      // Para futuros, el "monto al vencimiento" no es predecible: depende
      // del precio final del subyacente. Mostramos "—" con una nota.
      // Para todo lo demás, calculamos cantidad neta × precio efectivo.
      let amount = null;
      let amountSource = null;
      let amountNote = null;
      if (t === "future") {
        amountNote = "se realiza al vto";
      } else if (g.valueAtMarket != null) {
        amount = g.valueAtMarket;
        amountSource = g.priceSource;
      }
      events.push({
        ticker: g.ticker || "—",
        type: typeLabel,
        date,
        quantity: g.netQty,
        amount,
        amountSource,
        amountNote,
        currency: g.currency || "ARS",
      });
    }
    return events
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [positions, bondPrices]);

  return (
    <div style={{ ...cardBaseStyle(), padding: "12px 14px", minHeight: 0 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={cardTitleStyle()}>Flujos proyectados</span>
        <span style={{ fontSize: 10, color: C.dim, fontFamily: "'Roboto', sans-serif" }}>
          Próximos 5 vencimientos
        </span>
      </div>

      {upcomingMaturities.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, padding: "12px 0", textAlign: "center" }}>
          No hay vencimientos próximos en tu cartera
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={flowsThStyle("left")}>Ticker</th>
              <th style={flowsThStyle("left")}>Tipo</th>
              <th style={flowsThStyle("right")}>Cantidad</th>
              <th style={flowsThStyle("right")}>Monto estimado</th>
              <th style={flowsThStyle("center")}>Moneda</th>
              <th style={flowsThStyle("right")}>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {upcomingMaturities.map((e, idx) => {
              const isLast = idx === upcomingMaturities.length - 1;
              return (
                <tr
                  key={`${e.ticker}-${idx}`}
                  style={{
                    borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                  }}
                >
                  <td style={flowsTdStyle("left")}>
                    <span style={{ fontSize: 11.5, color: C.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {e.ticker}
                    </span>
                  </td>
                  <td style={flowsTdStyle("left")}>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Roboto', sans-serif" }}>
                      {e.type}
                    </span>
                  </td>
                  <td style={flowsTdStyle("right")}>
                    <span style={{ fontSize: 11.5, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtNumber(e.quantity, { maxDecimals: 0 })}
                    </span>
                  </td>
                  <td style={flowsTdStyle("right")}>
                    {e.amount != null ? (
                      <div className="flex flex-col items-end" style={{ gap: 1 }}>
                        <span style={{ fontSize: 11.5, color: C.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                          {fmtNumber(e.amount, { maxDecimals: 2 })}
                        </span>
                        {e.amountSource === "cost" && (
                          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            a costo
                          </span>
                        )}
                      </div>
                    ) : e.amountNote ? (
                      <div className="flex flex-col items-end" style={{ gap: 1 }}>
                        <span style={{ color: C.dim, fontSize: 11.5 }}>—</span>
                        <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          {e.amountNote}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: C.dim, fontSize: 11.5 }}>—</span>
                    )}
                  </td>
                  <td style={flowsTdStyle("center")}>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Roboto', sans-serif" }}>
                      {e.currency}
                    </span>
                  </td>
                  <td style={flowsTdStyle("right")}>
                    <span style={{ fontSize: 11.5, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtMaturityShort(e.date)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function flowsThStyle(align) {
  // Header compacto (mismo padding vertical que las cells del cuerpo
  // para mantener proporciones).
  return {
    textAlign: align,
    padding: "4px 12px",
    fontSize: 9,
    fontWeight: 600,
    color: C.dim,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontFamily: "'Roboto', sans-serif",
    borderBottom: `1px solid ${C.border}`,
  };
}

function flowsTdStyle(align) {
  // Padding ajustado para ganar densidad (antes 4×14, ahora 3×12).
  return {
    textAlign: align,
    padding: "3px 12px",
    fontSize: 11.5,
    color: C.text,
    verticalAlign: "middle",
  };
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
/**
 * Resuelve el precio "de mercado" actual de una posición.
 *
 * Prioridad (nueva, post bug de futuros editables 11/may/2026):
 *   1. p.current_price (override MANUAL del usuario) — gana siempre.
 *      El usuario es la fuente de verdad. Si lo carga, lo respetamos.
 *      Para volver al feed, el usuario tiene que borrar el current_price
 *      (botón "Resetear" en la UI de edición de precio).
 *   2. futurePrices[ticker] (Primary API tiempo real, solo para futuros).
 *   3. bondPrices[ticker]  (data912/BYMA, solo para bonos / ONs).
 *   4. stockPrices[ticker] (data912, acciones/CEDEARs con fallback al
 *      ticker base si es variante de plaza tipo AAPLD/AAPLC).
 *   5. p.entry_price (fallback a costo).
 *
 * Antes la prioridad para FUTUROS era Primary > manual ("Primary es más
 * confiable que el manual"). El problema: si el usuario quería ajustar
 * el precio a mano (porque Primary venía con un valor stale post-cierre,
 * o porque el usuario tiene un dato más fresco de su broker), el override
 * se guardaba en BD pero la UI seguía mostrando Primary. Eso confundía y
 * el usuario reportó: "edito y vuelve al de Primary".
 *
 * Ahora el manual gana siempre. Comportamiento consistente entre bonos
 * y futuros: editás → queda manual; borrás → vuelve al feed.
 *
 * Si nada está disponible, devuelve null.
 *
 * @returns {{ price: number, source: 'primary'|'manual'|'byma'|'data912'|'market'|'cost' } | null}
 */
function resolvePositionPrice(p, bondPrices, futurePrices, stockPrices) {
  const ticker = (p.ticker || "").trim().toUpperCase();

  // 1) Override manual del usuario — máxima prioridad.
  if (p.current_price != null) {
    return { price: Number(p.current_price), source: "manual" };
  }

  // 2) Para futuros, feed Primary (tiempo real).
  if (p.instrument_type === "future" && futurePrices && ticker) {
    const fp = futurePrices[ticker];
    if (fp?.price != null && !fp.error) {
      return { price: Number(fp.price), source: "primary" };
    }
  }

  // 3) Para bonos / ONs leemos del cache de precios (BYMA primero, data912
  //    como fallback — el merge ya está hecho en useBondPrices). Acá el
  //    source refleja CUÁL fuente terminó proveyendo el precio para que el
  //    badge UI lo muestre con honestidad.
  if (
    bondPrices &&
    ticker &&
    (p.instrument_type === "bond_ars" ||
      p.instrument_type === "bond_usd" ||
      p.instrument_type === "on")
  ) {
    const m = bondPrices[ticker];
    if (m?.price > 0) {
      // Mapeo del source interno al source "público" usado por el badge
      // UI. Supabase aporta dos sub-fuentes (mae_intraday, mae_close)
      // que la UI consolida bajo el badge "MAE". BYMA y data912 se
      // mantienen como labels propios.
      const src =
        m.source === "byma" || m.source === "data912"
          ? m.source
          : m.source === "mae_intraday" || m.source === "mae_close"
            ? "mae"
            : "market";
      return { price: m.price, source: src };
    }
  }

  // 3b) Para acciones / CEDEARs leemos del hook useStockPrices (data912).
  //     Para variantes de plaza (AAPLD/AAPLC) intentamos también el ticker
  //     base (AAPL) como fallback — data912 expone el base, las variantes
  //     no tienen feed propio en muchos casos.
  if (
    stockPrices &&
    ticker &&
    (p.instrument_type === "stock" || p.instrument_type === "cedear")
  ) {
    let m = stockPrices[ticker];
    if (!m?.price) {
      // Intentar base sin sufijo D/C (variante MEP/CCL → ARS base)
      const last = ticker.slice(-1);
      if ((last === "D" || last === "C") && ticker.length > 2) {
        const base = ticker.slice(0, -1);
        m = stockPrices[base];
      }
    }
    if (m?.price > 0) {
      return { price: m.price, source: "data912" };
    }
  }

  if (p.entry_price != null) {
    return { price: Number(p.entry_price), source: "cost" };
  }
  return null;
}

/* ─────────────── buildFutureAdjLookup ───────────────
 *
 * Construye un Map<position_id, summary> a partir de los adjustments
 * pending y confirmed. Cada summary tiene:
 *   - realizedPnL: SUM(actual_amount) de los confirmed para esa position.
 *     Es la plata que YA se acreditó como cash (Modelo i).
 *   - lastSettle:  curr_settle del adjustment más reciente (sea pending
 *     o confirmed). Se usa para calcular el P&L "vivo" del día como
 *     (current_price - lastSettle). Si no hay adjustments, queda null
 *     y los callers caen al fallback (fp.settlement o entry_price).
 *   - lastAdjDate: la fecha del adjustment más reciente, usada para
 *     ordenar cronológicamente.
 *
 * Pasamos este lookup a computePortfolioTotals y computeDailyPnL para
 * que el valor de los futuros refleje SOLO el P&L NO acreditado al
 * patrimonio (el acreditado ya está en cash). Antes el código sumaba
 * el P&L total contable, lo que causaba doble-conteo con el cash.
 */
function buildFutureAdjLookup(pendingAdjustments, confirmedAdjustments) {
  const lookup = new Map();

  const upsert = (adj) => {
    if (!adj || !adj.position_id) return;
    const pid = adj.position_id;
    const entry = lookup.get(pid) || {
      realizedPnL: 0,
      lastSettle: null,
      lastAdjDate: null,
    };
    // Si esta fila es más reciente que la guardada, actualizá el settle.
    if (!entry.lastAdjDate || adj.adjustment_date > entry.lastAdjDate) {
      const cs = Number(adj.curr_settle);
      if (Number.isFinite(cs)) {
        entry.lastAdjDate = adj.adjustment_date;
        entry.lastSettle = cs;
      }
    }
    lookup.set(pid, entry);
  };

  // Confirmed: además del settle, suman a realizedPnL.
  if (Array.isArray(confirmedAdjustments)) {
    for (const adj of confirmedAdjustments) {
      upsert(adj);
      if (adj.position_id) {
        const entry = lookup.get(adj.position_id);
        const amt = Number(adj.actual_amount);
        if (Number.isFinite(amt)) entry.realizedPnL += amt;
      }
    }
  }
  // Pending: solo settle (no se acreditaron todavía).
  if (Array.isArray(pendingAdjustments)) {
    for (const adj of pendingAdjustments) upsert(adj);
  }

  return lookup;
}

/**
 * Calcula el P&L diario de una posición (variación del día desde el cierre
 * anterior). Usa pct_change/previousClose del feed de precios:
 *   - Bonos / ONs: bondPrices[ticker].previousClose o changePct.
 *   - Acciones / CEDEARs: stockPrices[ticker] (con fallback a base sin sufijo).
 *   - Futuros: precio actual (LA) - settlement anterior (SE).
 *
 * Retorna { pnl, pct } o null si no hay datos suficientes.
 *   - pnl: monto absoluto en moneda de la posición (sin convertir).
 *   - pct: porcentaje vs cierre anterior.
 *
 * Para posiciones tipo "future", el P&L diario es:
 *   (precio_actual - settlement) × cantidad × multiplier
 * Para el resto:
 *   (precio_actual - cierre_ayer) × cantidad
 *
 * Si la posición no tiene precio de mercado (cae a `cost` o `manual`),
 * o si la fuente no expone cierre anterior, retorna null → la UI debe
 * mostrar "—".
 */
function computeDailyPnL(p, bondPrices, futurePrices, stockPrices, futureAdjLookup) {
  if (!p || !p.ticker) return null;
  const ticker = (p.ticker || "").trim().toUpperCase();
  const qty = Number(p.quantity) || 0;
  if (qty === 0) return null;

  // Si estamos fuera del día calendario hábil (sábado, domingo o feriado),
  // devolvemos 0 con flag marketClosed=true para que el caller pueda
  // renderizarlo en gris. Antes filtrábamos por horario operativo
  // (10:30-17:30) pero eso ocultaba el P&L HOY desde las 17:30 hasta la
  // Reset a 0 fuera del período "P&L HOY":
  //   - Fin de semana: 0
  //   - Lun-vie 00:00 - 10:29: 0 (mercado no abrió hoy todavía)
  //   - Lun-vie 10:30 - 23:59: calculado normal
  // El P&L HOY se mantiene visible post-cierre hasta medianoche para que
  // el usuario vea cuánto ganó en el día, y resetea a 0 a las 00:00 del
  // próximo día hábil sin esperar a que el mercado vuelva a abrir.
  if (!isTradingDayAndMarketOpened()) {
    return { pnl: 0, pct: 0, marketClosed: true };
  }

  // ─── Futuros ──────────────────────────────────────────────
  // El "P&L del día" del futuro es la variación desde el último settle
  // CONOCIDO (sea pending o confirmed) hasta el precio actual de Primary.
  // Prioridad de prev_settle:
  //   1) lookup.lastSettle (último adjustment registrado, refleja el
  //      verdadero estado de "lo último acreditado o por acreditar").
  //   2) fp.settlement (settle del feed Primary, fallback histórico).
  // Antes solo se usaba (2), lo que arrastraba varios días cuando había
  // pendings sin confirmar. Bajo el modelo nuevo (cron 7 AM día siguiente),
  // si hay pending, lastSettle === curr_settle del pending de ayer, y el
  // P&L del día es estrictamente intraday.
  if (p.instrument_type === "future" && futurePrices) {
    const fp = futurePrices[ticker];
    if (fp?.price != null && !fp.error) {
      const last = Number(fp.price);
      const lookupEntry = futureAdjLookup ? futureAdjLookup.get(p.id) : null;
      let settle = lookupEntry?.lastSettle != null
        ? Number(lookupEntry.lastSettle)
        : null;

      // Si no hay adjustments en BD para esta posición:
      //   - Si entry_date === HOY (la compró hoy mismo), su "base del día"
      //     es el entry_price (el usuario percibe que su día arrancó en
      //     el momento de comprar, no contra el settle de ayer del feed).
      //   - Caso contrario (posición más vieja, sin ajustes históricos
      //     porque la app aún no lleva mucho tiempo), caemos al settle
      //     del feed Primary (mejor disponible).
      if (settle == null) {
        const todayIso = new Date().toISOString().slice(0, 10);
        if (p.entry_date === todayIso && Number(p.entry_price) > 0) {
          settle = Number(p.entry_price);
        } else if (fp.settlement != null) {
          settle = Number(fp.settlement);
        }
      }

      if (Number.isFinite(last) && settle != null && Number.isFinite(settle) && settle > 0) {
        const multiplier = Number(p.extra?.contract_size) || 1000;
        // signo: COMPRA gana si sube, VENTA gana si baja.
        const sign = (p.operation_type === "sell") ? -1 : 1;
        const diffPerUnit = last - settle;
        const pnl = sign * diffPerUnit * qty * multiplier;
        const pct = (diffPerUnit / settle) * 100;
        return { pnl, pct };
      }
    }
    return null;
  }

  // ─── Bonos / ONs ──────────────────────────────────────────
  if (
    bondPrices &&
    (p.instrument_type === "bond_ars" ||
      p.instrument_type === "bond_usd" ||
      p.instrument_type === "on")
  ) {
    const m = bondPrices[ticker];
    if (m?.price > 0) {
      let prev = m.previousClose;
      if (prev == null && m.changePct != null) {
        const denom = 1 + Number(m.changePct) / 100;
        if (denom > 0) prev = Number(m.price) / denom;
      }
      // Si tenemos previousClose válido, calculamos P&L del día estándar.
      if (prev != null && prev > 0) {
        // Bonos cotizan cada 100 VN. P&L unidad = (price - prev) / 100 × cantidad
        const diffPer100 = m.price - prev;
        const sign = (p.operation_type === "sell") ? -1 : 1;
        const pnl = sign * (diffPer100 / 100) * qty;
        const pct = (diffPer100 / prev) * 100;
        return { pnl, pct };
      }
      // Sin previousClose disponible (ticker recién emitido o no
      // presente en daily_close_prices): fallback a P&L TOTAL usando el
      // PPP de la posición como base. La idea: si compraste hoy y aún
      // no hay cierre de "ayer" guardado, el único "P&L del día" que
      // tiene sentido es lo que subió respecto a tu precio de compra.
      // Cuando pase el primer cierre y se guarde en daily_close_prices,
      // este fallback dejará de dispararse y el P&L HOY será la
      // variación real intra-día.
      const ppp = Number(p.entry_price);
      if (ppp > 0) {
        const diffPer100 = m.price - ppp;
        const sign = (p.operation_type === "sell") ? -1 : 1;
        const pnl = sign * (diffPer100 / 100) * qty;
        const pct = (diffPer100 / ppp) * 100;
        return { pnl, pct };
      }
    }
    return null;
  }

  // ─── Acciones / CEDEARs ────────────────────────────────────
  if (
    stockPrices &&
    (p.instrument_type === "stock" || p.instrument_type === "cedear")
  ) {
    let m = stockPrices[ticker];
    if (!m?.price) {
      const last = ticker.slice(-1);
      if ((last === "D" || last === "C") && ticker.length > 2) {
        const base = ticker.slice(0, -1);
        m = stockPrices[base];
      }
    }
    if (m?.price > 0) {
      let prev = m.previousClose;
      if (prev == null && m.changePct != null) {
        const denom = 1 + Number(m.changePct) / 100;
        if (denom > 0) prev = Number(m.price) / denom;
      }
      if (prev != null && prev > 0) {
        const diffPerUnit = m.price - prev;
        const sign = (p.operation_type === "sell") ? -1 : 1;
        const pnl = sign * diffPerUnit * qty;
        const pct = (diffPerUnit / prev) * 100;
        return { pnl, pct };
      }
      // Sin previousClose disponible: fallback a P&L TOTAL contra PPP.
      // Mismo razonamiento que para bonos: si el ticker no tiene cierre
      // histórico, P&L HOY = lo que subió/bajó vs el precio de compra.
      const ppp = Number(p.entry_price);
      if (ppp > 0) {
        const diffPerUnit = m.price - ppp;
        const sign = (p.operation_type === "sell") ? -1 : 1;
        const pnl = sign * diffPerUnit * qty;
        const pct = (diffPerUnit / ppp) * 100;
        return { pnl, pct };
      }
    }
    return null;
  }

  // Otros tipos (caucion, fci, option, etc.): no tienen P&L diario por ahora.
  return null;
}

/**
 * Convierte un precio (cada 100 VN para bonos, unitario para acciones) en el
 * VALOR TOTAL de la posición (precio × cantidad, ajustado por convención
 * del instrumento).
 */
/* ─────────────── Modelo financiero de futuros ───────────────
 *
 * Los futuros (DLR, etc.) NO pagan capital upfront. Vos solo poneés una
 * garantía (que ya está en otra posición tuya, p.ej. el bono ARS). Por
 * eso:
 *
 *   - "Costo" del futuro = 0 (no pagaste nada al abrir)
 *   - "Valor a mercado" del futuro = P&L mark-to-market acumulado
 *     = (precio_actual − entry_price) × qty × multiplicador  (si compra)
 *     = (entry_price − precio_actual) × qty × multiplicador  (si venta)
 *
 * El **notional** (qty × multiplicador × precio) es la EXPOSICIÓN, no el
 * valor de cartera. Se muestra aparte como métrica informativa.
 *
 * Multiplicador DLR típico = 1000 (1 contrato = USD 1.000).
 */

/* ─────────────── Feriados bursátiles BYMA ───────────────
 *
 * Lista oficial de feriados del mercado argentino, embebida estática
 * porque es información determinística publicada por BYMA en diciembre
 * para el año siguiente. Mantenimiento: 1 vez por año, agregar el
 * próximo año cuando se publique.
 *
 * Fuente original: API pública de https://feriadosbursatiles.ddns.net
 * (repo público https://github.com/MarianaSardo/feriadobusatilapi).
 *
 * Para actualizar:
 *   curl https://feriadosbursatiles.ddns.net/api/feriados/2027
 *
 * Formato: Set de strings YYYY-MM-DD para lookup O(1).
 * Incluye sábados/domingos NO — los detectamos por getDay() ya que
 * cualquier sábado/domingo es no-hábil sin necesidad de lista.
 */

const BYMA_HOLIDAYS = new Set([
  // 2024 (histórico, por si alguna vez backfilleamos saldos viejos)
  "2024-01-01", "2024-02-12", "2024-02-13", "2024-03-28", "2024-03-29",
  "2024-04-01", "2024-04-02", "2024-05-01", "2024-06-17", "2024-06-20",
  "2024-06-21", "2024-07-09", "2024-10-11", "2024-11-18", "2024-12-25",
  "2024-12-31",
  // 2025
  "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02",
  "2025-04-17", "2025-04-18", "2025-05-01", "2025-06-16", "2025-06-20",
  "2025-07-09", "2025-08-15", "2025-11-21", "2025-11-24", "2025-12-08",
  "2025-12-25",
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24",
  "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15",
  "2026-07-09", "2026-07-10", "2026-08-17", "2026-10-12", "2026-11-06",
  "2026-12-07", "2026-12-08", "2026-12-24", "2026-12-25", "2026-12-31",
]);

/**
 * Devuelve true si la fecha (YYYY-MM-DD) cae en sábado, domingo o feriado
 * bursátil argentino. Útil para skip al sumar días hábiles.
 */
function isNonBusinessDay(yyyymmdd) {
  if (BYMA_HOLIDAYS.has(yyyymmdd)) return true;
  // getDay(): 0=domingo, 6=sábado. Construimos en hora local fija para
  // evitar timezone shifts (yyyy-mm-ddT12:00:00 → mediodía siempre cae
  // el día correcto sin importar la TZ del browser).
  const d = new Date(yyyymmdd + "T12:00:00");
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Suma N días hábiles a una fecha dada. Sirve para calcular T+1 a partir
 * de la fecha de operación.
 *
 * Ejemplos (asumiendo 2026-04-30 es jueves):
 *   addBusinessDays("2026-04-30", 1) → "2026-05-04"  (viernes 1° feriado, lunes feriado, viernes hábil... → en realidad acá saltamos al lunes 4)
 *   addBusinessDays("2026-04-29", 1) → "2026-04-30"  (jueves → viernes)
 *
 * @param {string} yyyymmdd  Fecha base, formato YYYY-MM-DD.
 * @param {number} n         Días hábiles a sumar (>= 0).
 * @returns {string}         Fecha resultante en formato YYYY-MM-DD.
 */
function addBusinessDays(yyyymmdd, n) {
  if (!yyyymmdd || n < 0) return yyyymmdd;
  let cursor = new Date(yyyymmdd + "T12:00:00");
  let added = 0;
  while (added < n) {
    cursor.setDate(cursor.getDate() + 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (!isNonBusinessDay(iso)) {
      added++;
    }
  }
  return cursor.toISOString().slice(0, 10);
}

const FUTURE_MULTIPLIER_DEFAULT = 1000;

function getFutureMultiplier(p) {
  // Hook para futuro: si en metadata viene un multiplicador específico
  // (ej. otros futuros que no son DLR), lo usamos. Por ahora todos 1000.
  return FUTURE_MULTIPLIER_DEFAULT;
}

/**
 * Notional de un futuro: exposición nominal (no es el costo ni el valor).
 *   notional = qty × multiplicador × precio
 *
 * Usar el precio actual si lo tenemos (p.current_price o data912 en el
 * caso de futuros lo manejamos manualmente vía current_price).
 */
function positionFutureNotional(p, bondPrices, futurePrices) {
  if (p.instrument_type !== "future") return null;
  const qty = Math.abs(Number(p.quantity) || 0);
  const resolved = resolvePositionPrice(p, bondPrices, futurePrices);
  if (!resolved) return null;
  return qty * getFutureMultiplier(p) * resolved.price;
}

/**
 * P&L mark-to-market de un futuro. Devuelve:
 *   - Para COMPRA (long):  (precio_actual − entry_price) × qty × multiplicador
 *   - Para VENTA (short):  (entry_price − precio_actual) × qty × multiplicador
 *
 * Si todavía no hay precio actual (current_price null y no hay data912
 * para futuros), el P&L es 0 (vos no perdiste ni ganaste nada todavía).
 */
function positionFuturePnL(p, bondPrices, futurePrices) {
  if (p.instrument_type !== "future") return { value: 0, source: "cost" };
  const qty = Number(p.quantity) || 0;
  if (qty === 0 || p.entry_price == null) return { value: 0, source: "cost" };

  const resolved = resolvePositionPrice(p, bondPrices, futurePrices);
  // Si no hay precio actual, asumimos que el contrato sigue valuado a entry
  // → P&L = 0.
  if (!resolved) return { value: 0, source: "cost" };

  const direction = p.operation_type === "sell" ? -1 : 1;
  const pnl = direction * qty * getFutureMultiplier(p) * (resolved.price - Number(p.entry_price));
  return { value: pnl, source: resolved.source };
}

function applyPriceToPosition(p, price) {
  const qty = Number(p.quantity) || 0;
  // Bonos / ONs: precio cada 100 VN
  if (
    p.instrument_type === "bond_ars" ||
    p.instrument_type === "bond_usd" ||
    p.instrument_type === "on"
  ) {
    return (qty * price) / 100;
  }
  // Futuros: ya NO se valúan multiplicando qty × mult × precio (ese es el
  // notional). El "valor de cartera" del futuro es solo su P&L. Se maneja
  // en positionValueAtMarket directamente, no debería caer acá.
  if (p.instrument_type === "future") {
    return qty * getFutureMultiplier(p) * price; // legacy: solo para notional
  }
  // Opciones: contrato * 100 * prima
  if (p.instrument_type === "option") {
    return qty * 100 * price;
  }
  // Acciones, CEDEARs, FCI, USD, Cripto: cantidad * precio
  return qty * price;
}

/**
 * Valor de una CAUCIÓN COLOCADORA con devengamiento prorata lineal.
 *
 * Modelo simple (Modelo cuasi-cash):
 *   Capital × (1 + TNA × días_transcurridos / 365)
 *
 * Donde:
 *   - Capital = quantity (lo que prestaste el día 0)
 *   - TNA    = extra.rate_tna (en %, ej. 80 → 0.80)
 *   - días_transcurridos = max(0, asOfDate - entry_date), capeado a term_days
 *
 * Si la caución venció (días >= term_days), el valor queda en el monto
 * total al vencimiento (no sigue devengando más allá).
 *
 * Si falta info (sin entry_date, sin rate_tna o sin term_days), devolvemos
 * el capital plano — fallback honesto.
 *
 * @param {object} p — posición caución
 * @param {string|Date} asOfDate — fecha de referencia (default = hoy)
 * @returns {number|null}
 */
function caucionValueDevengado(p, asOfDate) {
  if (!p || p.instrument_type !== "caucion") return null;
  const capital = Number(p.quantity) || 0;
  if (capital === 0) return 0;

  const tna = Number(p.extra?.rate_tna);
  const termDays = Number(p.extra?.term_days);
  if (!p.entry_date || !Number.isFinite(tna) || !Number.isFinite(termDays)) {
    return capital; // fallback: capital sin intereses
  }

  const startMs = new Date(p.entry_date + "T00:00:00").getTime();
  const refMs = asOfDate
    ? (typeof asOfDate === "string"
        ? new Date(asOfDate + "T00:00:00").getTime()
        : asOfDate.getTime())
    : Date.now();

  let daysElapsed = Math.max(0, Math.floor((refMs - startMs) / 86400000));
  daysElapsed = Math.min(daysElapsed, termDays);

  const interes = capital * (tna / 100) * (daysElapsed / 365);
  return capital + interes;
}

/**
 * Valor de la caución al vencimiento (capital + intereses TOTALES).
 * Útil para LIQUIDEZ PROYECTADA cuando la caución vence en ventana.
 */
function caucionValueAtMaturity(p) {
  if (!p || p.instrument_type !== "caucion") return null;
  const capital = Number(p.quantity) || 0;
  if (capital === 0) return 0;

  const tna = Number(p.extra?.rate_tna);
  const termDays = Number(p.extra?.term_days);
  if (!Number.isFinite(tna) || !Number.isFinite(termDays)) return capital;

  return capital * (1 + (tna / 100) * (termDays / 365));
}

/**
 * Genera un ticker auto para una caución a partir de la fecha de alta y
 * el plazo en días. Formato: CAUC-DDMMM-NND (ej. CAUC-12MAY-7D).
 *
 * Sirve como default cuando el usuario no quiere ponerle un nombre custom
 * (lo común — las cauciones son contratos privados sin ticker oficial).
 * Si querés distinguir contrapartes (BYMA / Cocos / IOL), tipeá un ticker
 * manual con esa info.
 */
function generateCaucionTicker(entryDate, termDays) {
  if (!entryDate || !Number.isFinite(Number(termDays))) return "CAUC";
  const d = new Date(entryDate + "T00:00:00");
  if (isNaN(d.getTime())) return "CAUC";
  const dd = String(d.getDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mmm = months[d.getMonth()] || "XXX";
  return `CAUC-${dd}${mmm}-${Number(termDays)}D`;
}

/**
 * Calcula la comisión "estándar de mercado" sugerida para una operación
 * de futuros, según las tarifas oficiales de A3 Mercados (ex-ROFEX).
 *
 * Sirve de referencia al usuario al cargar la operación — si Cocos /
 * Balanz / IOL lo facturan distinto, lo edita manualmente.
 *
 * Tarifas (PDF oficial A3, productos financieros):
 *   - Futuros DLR / YUAN: Negociación 0,14 + Clearing 0,06 = 0,20 fijo
 *     por contrato (Prioridad precio tiempo). + IVA 21%.
 *   - Resto de futuros financieros (Oro, Petróleo, ROFEX20, Acciones,
 *     BTC, CER): 0,0200% Neg + 0,0040% Clearing = 0,024% del notional.
 *     + IVA 21%.
 *
 * Devuelve null si el ticker es desconocido o faltan datos para calcular.
 */
function calcSuggestedFutureCommission(ticker, qty, price) {
  const t = String(ticker || "").toUpperCase();
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return null;

  const IVA = 1.21;

  // DLR / YUAN: tarifa fija por contrato (no depende del precio).
  if (t.startsWith("DLR") || t.startsWith("YUAN")) {
    const baseFeePerContract = 0.20; // 0,14 Neg + 0,06 Clearing
    return q * baseFeePerContract * IVA;
  }

  // Resto: porcentual sobre notional. Necesitamos precio.
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  const notional = q * p * 1000; // multiplier estándar de futuros financieros
  const baseFeePct = 0.024 / 100; // 0,024% en decimal
  return notional * baseFeePct * IVA;
}

/**
 * Valor de la posición a mercado actual (impacta en wealth/cartera).
 *
 *   - Cauciones: capital + intereses devengados prorata a HOY.
 *   - Bonos / ONs / Acciones / CEDEARs / FCI: cantidad × precio actual.
 *   - Futuros: solo el P&L mark-to-market (NO el notional).
 *   - Opciones: cantidad × 100 × prima.
 *
 * Retorna `{ value, source }` o null si no se puede valuar.
 */
function positionValueAtMarket(p, bondPrices, futurePrices, stockPrices) {
  // Cauciones: devengamiento prorata lineal sobre el capital colocado.
  // El valor "a mercado" hoy es capital + intereses corridos. Eso se
  // refleja directamente en TOTAL CARTERA. Y el P&L de la caución
  // (valueAtMarket - valueAtCost) son los intereses ganados a la fecha.
  if (p.instrument_type === "caucion") {
    const devengado = caucionValueDevengado(p);
    return {
      value: devengado != null ? devengado : (Number(p.quantity) || 0),
      source: "devengado",
    };
  }
  // Futuros: el "valor" que impacta en cartera es el P&L mark-to-market.
  // El notional NO se incluye (es exposición, no wealth real).
  if (p.instrument_type === "future") {
    return positionFuturePnL(p, bondPrices, futurePrices);
  }
  const resolved = resolvePositionPrice(p, bondPrices, futurePrices, stockPrices);
  if (!resolved) return null;
  return {
    value: applyPriceToPosition(p, resolved.price),
    source: resolved.source,
  };
}

/**
 * Valor de la posición a costo histórico (al entry_price exclusivamente).
 * Para futuros, el costo es 0 (no pagaste nada al abrir).
 */
function positionValueAtCost(p) {
  if (p.instrument_type === "caucion") return Number(p.quantity) || 0;
  // Futuros: no pagaste capital al abrir, solo garantía (que ya está en
  // otra posición). El costo a efectos de P&L es 0.
  if (p.instrument_type === "future") return 0;
  if (p.entry_price == null) return null;
  return applyPriceToPosition(p, Number(p.entry_price));
}

/**
 * @deprecated mantener por retrocompat si hay código viejo. Usar
 * positionValueAtMarket / positionValueAtCost.
 */
function positionValue(p) {
  const r = positionValueAtMarket(p);
  return r ? r.value : null;
}

function computePortfolioTotals(positions, fx, valuationCurrency, bondPrices, futurePrices, futureAdjLookup) {
  let totalMarket = 0;
  let totalCost = 0;
  let unvalued = 0;
  let valuedAny = false;
  let pricesFromMarket = 0; // posiciones con precio data912 / manual
  let pricesFromCost = 0;   // posiciones que cayeron al fallback
  // P&L de futuros que YA se acreditó como cash (suma de actual_amount
  // de adjustments confirmed). Lo separamos de totalMarket porque ese
  // monto ya está sumado en balanceByCurrency (cash) y duplicaríamos si
  // lo metiéramos también en value. Sin embargo SÍ debe contar para el
  // P&L "vs costo" (al usuario le importa cuánto ganó en total, no solo
  // lo no acreditado). En el return final lo sumamos al pnl.
  let realizedFuturesPnL = 0;

  // Separamos las posiciones en TRES grupos según cómo se valúan:
  //
  //  1) Futuros: vista consolidada. valor = P&L (realizado + no realizado),
  //     costo = 0. El "valor de mercado" del notional NO se incluye.
  //
  //  2) Consolidables con split (bond_ars, bond_usd, on, stock, cedear):
  //     vista consolidada para que las VENTAS resten correctamente del
  //     valor de mercado y el P&L realizado se cuente bien. Antes este
  //     loop iteraba operación por operación con positionValueAtMarket(),
  //     que NO respeta operation_type='sell' y por eso una venta de bono
  //     SUMABA al total en lugar de restar. Bug reportado por LP en mayo
  //     2026: T30J6 vendí 10M de un total de 35,9M y el "Total" de la
  //     cartera estaba inflado en ~14M.
  //
  //  3) Resto (caucion, fci, usd, crypto, option): loop individual.
  //     Estos tipos NO mezclan compras y ventas del mismo ticker (una
  //     caución colocada se cobra, no se vende; un FCI se rescata, etc).
  //     Por eso el bug del split no aplica acá.
  const futurePositions = [];
  const consolidableSplitPositions = [];
  const individualPositions = [];

  const SPLIT_TYPES = new Set(["bond_ars", "bond_usd", "on", "stock", "cedear"]);

  for (const p of positions) {
    if (p.instrument_type === "future") {
      futurePositions.push(p);
    } else if (SPLIT_TYPES.has(p.instrument_type)) {
      consolidableSplitPositions.push(p);
    } else {
      individualPositions.push(p);
    }
  }

  // ── (1) FUTUROS: vista consolidada ──────────────────────────────────
  if (futurePositions.length > 0) {
    const futureGroups = consolidatePositions(futurePositions, bondPrices, futurePrices);
    for (const g of futureGroups) {
      // El "valor de mercado" de un futuro consolidado es su P&L total
      // (realizado + no realizado). El costo es 0.
      if (g.pnl == null) continue;

      // Si tenemos lookup, calculamos el P&L acreditado del grupo
      // sumando los realizedPnL de cada operation (position_id) que
      // forma parte del grupo consolidado. Este monto ya está en cash
      // y NO debe sumarse al valor de la cartera (sería doble-conteo).
      // Lo guardamos aparte para el P&L "vs costo".
      let groupRealizedPnL = 0;
      if (futureAdjLookup && Array.isArray(g.operations)) {
        for (const op of g.operations) {
          const entry = futureAdjLookup.get(op.id);
          if (entry?.realizedPnL) groupRealizedPnL += entry.realizedPnL;
        }
      }
      // P&L NO acreditado = total contable - acreditado en cash.
      // Eso es lo que aporta al patrimonio neto hoy.
      const nonAcreditedPnL = g.pnl - groupRealizedPnL;

      const convertedNonAcredited = convertValue(nonAcreditedPnL, g.currency || "ARS", valuationCurrency, fx);
      const convertedRealized = convertValue(groupRealizedPnL, g.currency || "ARS", valuationCurrency, fx);
      if (convertedNonAcredited == null) {
        unvalued++;
        continue;
      }
      valuedAny = true;
      totalMarket += convertedNonAcredited;
      if (convertedRealized != null) realizedFuturesPnL += convertedRealized;
      // costo de futuros = 0, no suma a totalCost
      if (g.priceSource === "market" || g.priceSource === "manual" ||
          g.priceSource === "close" || g.priceSource === "primary" ||
          g.priceSource === "mae") {
        pricesFromMarket++;
      } else {
        pricesFromCost++;
      }
    }
  }

  // ── (2) CONSOLIDABLES CON SPLIT: vista consolidada ──────────────────
  // Acá entra cada grupo (bond, stock, cedear, on) que ya viene splitteado
  // por consolidatePositions:
  //   - Posición 100% abierta (sin ventas): 1 fila, valor mkt + costo normales
  //   - Cierre parcial: 2 filas (una "open" con netQty + costo, una "closed"
  //     con valor=P&L realizado y costo=0)
  //   - Cierre total: 1 fila "closed" con valor=P&L realizado y costo=0
  // Sumando linealmente, el total queda correcto porque las cerradas
  // aportan SOLO el P&L (sin doble-contar capital).
  if (consolidableSplitPositions.length > 0) {
    const groups = consolidatePositions(consolidableSplitPositions, bondPrices, futurePrices);
    for (const g of groups) {
      if (g.valueAtMarket == null) {
        unvalued++;
        continue;
      }
      const convertedMarket = convertValue(
        g.valueAtMarket, g.currency || "ARS", valuationCurrency, fx
      );
      if (convertedMarket == null) {
        unvalued++;
        continue;
      }
      valuedAny = true;
      totalMarket += convertedMarket;

      if (g.valueAtCost != null) {
        const convertedCost = convertValue(
          g.valueAtCost, g.currency || "ARS", valuationCurrency, fx
        );
        if (convertedCost != null) totalCost += convertedCost;
      }

      // Para clasificar fuente: priceSource del grupo viene de useBondPrices
      // (byma/data912/mae/manual) o "cost"/"close". Las cerradas siempre son
      // "close" → cuentan como market.
      const src = g.priceSource;
      const fromMarket =
        src === "byma" ||
        src === "data912" ||
        src === "mae" ||
        src === "market" ||
        src === "manual" ||
        src === "close";
      if (fromMarket) {
        pricesFromMarket++;
      } else {
        pricesFromCost++;
      }
    }
  }

  // ── (3) INDIVIDUALES: loop simple (caucion, fci, usd, crypto, option) ──
  for (const p of individualPositions) {
    const marketRes = positionValueAtMarket(p, bondPrices, futurePrices);
    const cost = positionValueAtCost(p);

    if (marketRes == null) {
      unvalued++;
      continue;
    }

    const convertedMarket = convertValue(
      marketRes.value, p.entry_currency || "ARS", valuationCurrency, fx
    );
    if (convertedMarket == null) {
      unvalued++;
      continue;
    }
    valuedAny = true;
    totalMarket += convertedMarket;

    if (cost != null) {
      const convertedCost = convertValue(
        cost, p.entry_currency || "ARS", valuationCurrency, fx
      );
      if (convertedCost != null) totalCost += convertedCost;
    }

    // Considerar como "from market" cualquier fuente real de mercado
    // (BYMA, data912, MAE, market legacy) o manual (override del usuario).
    // Solo "cost" cae a pricesFromCost.
    const fromMarket =
      marketRes.source === "byma" ||
      marketRes.source === "data912" ||
      marketRes.source === "mae" ||
      marketRes.source === "market" || // legacy
      marketRes.source === "manual";
    if (fromMarket) {
      pricesFromMarket++;
    } else {
      pricesFromCost++;
    }
  }

  // PNL vs costo: tiene que incluir los P&L acreditados de futuros
  // (que sacamos de totalMarket para no duplicar con cash, pero que
  // siguen contando como "ganancia respecto al costo de inicio").
  // pnl viejo  = totalMarket - totalCost = bonosPnL + futurosPnL_total
  // pnl nuevo  = (totalMarket + realizedFuturesPnL) - totalCost
  //            = bonosPnL + futurosPnL_no_acreditado + futurosPnL_acreditado
  //            = bonosPnL + futurosPnL_total      ← equivalente al viejo
  const pnl = totalMarket + realizedFuturesPnL - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : null;

  return {
    value: valuedAny ? totalMarket : null,
    valueAtCost: valuedAny ? totalCost : null,
    pnl: valuedAny ? pnl : null,
    pnlPct: valuedAny ? pnlPct : null,
    realizedFuturesPnL,
    unvalued,
    pricesFromMarket,
    pricesFromCost,
  };
}


function groupByCategory(positions, fx, valuationCurrency, bondPrices) {
  const result = {};

  // Excluir futuros (su valor es solo P&L mark-to-market, no es wealth
  // nominal — los mostramos como exposición separada).
  const nonFuture = positions.filter((p) => p.instrument_type !== "future");

  // Vista consolidada: si la posición tiene un cierre parcial, aporta
  // como (1) fila abierta con valor de mercado de netQty + (2) fila
  // cerrada con valor = P&L realizado. Sumar ambas da el valor neto
  // correcto (capital remanente + ganancia/pérdida realizada). Esto
  // arregla el bug de que una venta del mismo ticker SUMABA al donut
  // en lugar de restar (porque positionValueAtMarket no respeta
  // operation_type='sell').
  const groups = consolidatePositions(nonFuture, bondPrices);
  for (const g of groups) {
    if (g.valueAtMarket == null) continue;
    const v = convertValue(g.valueAtMarket, g.currency || "ARS", valuationCurrency, fx);
    if (v == null) continue;
    const cat = simplifyCategory(g.instrument_type);
    result[cat] = (result[cat] || 0) + v;
  }
  return result;
}

function groupByCurrency(positions, fx, valuationCurrency, bondPrices) {
  const result = {};

  // Mismo criterio: futuros excluidos del breakdown por moneda.
  const nonFuture = positions.filter((p) => p.instrument_type !== "future");

  // Vista consolidada — ver groupByCategory para detalle del fix.
  const groups = consolidatePositions(nonFuture, bondPrices);
  for (const g of groups) {
    if (g.valueAtMarket == null) continue;
    const v = convertValue(g.valueAtMarket, g.currency || "ARS", valuationCurrency, fx);
    if (v == null) continue;
    const cur = g.currency || "ARS";
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
/**
 * Calcula el saldo proyectado por moneda dentro de una ventana temporal.
 *
 * Windows soportadas:
 *   - "CI"  → saldo cash actual (movements con movement_date <= hoy)
 *   - "T1"  → CI + flujos hasta el siguiente día hábil
 *   - "30d" → CI + flujos en los próximos 30 días calendario
 *   - "60d" → CI + flujos en los próximos 60 días calendario
 *   - "90d" → CI + flujos en los próximos 90 días calendario
 *
 * "Flujos" en este contexto incluyen:
 *   - Vencimientos de bonos / ON / cauciones / opciones dentro de la ventana,
 *     valuados a precio de mercado actual (lo que se va a recibir al vencer
 *     puede variar si el precio se mueve, lo aclaramos en el footer).
 *   - Movements futuros ya cargados en cash_movements (típico: ventas T+1
 *     cargadas hoy, depósitos con fecha futura).
 *
 * El cash actual (CI) SIEMPRE se incluye como base. Las otras ventanas lo
 * acumulan sumándole los flujos esperados.
 */
function computeLiquidityBreakdown(positions, fx, valuationCurrency, windowKey, bondPrices, movements, futurePrices, futureAdjLookup) {
  const result = { ARS: 0, "USD-MEP": 0, "USD-CCL": 0 };

  const todayIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const today = new Date(todayIso + "T12:00:00");

  // 1) Saldo CI base: sumamos todos los cash_movements con fecha <= hoy.
  // Esto está disponible siempre, independiente del window seleccionado.
  if (movements && movements.length > 0) {
    for (const m of movements) {
      if (m.movement_date > todayIso) continue;
      if (!(m.currency in result)) continue;
      const sign = (m.movement_type === "deposit" || m.movement_type === "sale_proceeds") ? 1 : -1;
      result[m.currency] += sign * Number(m.amount);
    }
  }

  // 1b) Cauciones VIGENTES como cuasi-cash con devengamiento prorata.
  //
  // Modelo: una caución colocadora es plata que prestaste, devenga
  // intereses lineales hasta el vencimiento, y es muy líquida (en el
  // mercado se puede cancelar anticipadamente o esperar el vencimiento,
  // típicamente 1 día). Por eso la consideramos cuasi-cash:
  //   valor_a_hoy = capital × (1 + TNA × días_corridos / 365)
  //
  // En CI sumamos este valor devengado a hoy. En T1+ además sumamos los
  // intereses pendientes hasta vencer (ver 3b), pero el devengado a hoy
  // sigue siendo la base — así CI ≤ T1 ≤ 30d ≤ 60d ≤ 90d siempre.
  //
  // Cauciones YA VENCIDAS (maturity < hoy) se saltan acá: idealmente
  // ya deberían estar como cash_movement automático en pending (Fase 2,
  // requiere cron). Si todavía no se procesaron, no contamos ni el cash
  // ni el devengado para no inflar la liquidez con plata fantasma.
  if (positions && positions.length > 0) {
    for (const p of positions) {
      if (p.instrument_type !== "caucion") continue;
      const maturityDate = getPositionMaturity(p);
      if (!maturityDate) continue;
      // Si ya venció, saltar (no se contó como cash todavía → caso edge
      // a manejar con cash_movement automático en Fase 2).
      if (new Date(maturityDate + "T12:00:00") < today) continue;

      const devengado = caucionValueDevengado(p, todayIso);
      if (devengado == null || !Number.isFinite(devengado)) continue;
      const cur = p.currency || "ARS";
      if (cur in result) result[cur] += devengado;
    }
  }

  // 2) Si el window es CI, ya terminamos.
  if (windowKey === "CI") {
    return result;
  }

  // 3) Para T1 / 30d / 60d / 90d sumamos flujos futuros dentro de la ventana.
  let cutoff;
  if (windowKey === "T1") {
    const nextBiz = addBusinessDays(todayIso, 1);
    cutoff = new Date(nextBiz + "T12:00:00");
  } else {
    const days = windowKey === "30d" ? 30 : windowKey === "60d" ? 60 : 90;
    cutoff = new Date(today.getTime() + days * 86400000);
  }

  // Pre-cómputo: ¿cuáles positions vencen DENTRO de la ventana?
  // Las usamos para evitar doble-contar movements automáticos
  // (purchase_cost / sale_proceeds) cuya position asociada también
  // entrará al cálculo de Liquidez vía vencimiento.
  //
  // Caso típico del bug: comprás un bono S29Y6 con plazo T1. Eso
  // genera un purchase_cost con fecha mañana (sale del cash) Y la
  // position en sí entra en cartera hoy. Al vencer S29Y6 dentro de
  // la ventana, valueAtMarket sumaría su valor al vencimiento, pero
  // ese valor YA INCLUYE el millón comprado en T1. Si además sumamos
  // el movement T1 al cálculo, restamos el millón dos veces (una al
  // egresar mañana y otra implícita al vencer el bono más adelante).
  // El resultado: Liquidez quedaba ~$1.3M debajo del Total real.
  //
  // Solución: si el movement automático corresponde a una position
  // que vence DENTRO de la ventana, lo saltamos. El efecto neto sobre
  // tu cash queda absorbido por el flujo del vencimiento.
  const positionMaturesInWindow = new Set();
  if (positions && positions.length > 0) {
    for (const p of positions) {
      const md = getPositionMaturity(p);
      if (!md) continue;
      const matDate = new Date(md);
      if (matDate >= today && matDate <= cutoff) {
        positionMaturesInWindow.add(p.id);
      }
    }
  }

  // 3a) Movements futuros (ya cargados): por ej, una venta T+1 cargada hoy
  // genera un sale_proceeds con movement_date = mañana hábil.
  //
  // EXCEPCIÓN: movements automáticos cuya position asociada vence
  // dentro de la ventana NO se cuentan (ver explicación arriba).
  if (movements && movements.length > 0) {
    for (const m of movements) {
      if (m.movement_date <= todayIso) continue; // los <= hoy ya están en CI
      const md = new Date(m.movement_date + "T12:00:00");
      if (md > cutoff) continue;
      if (!(m.currency in result)) continue;

      // Skip si es movement automático y la position vence en ventana
      // (su valor está implícito en el flujo del vencimiento).
      if (m.related_position_id && positionMaturesInWindow.has(m.related_position_id)) {
        continue;
      }

      const sign = (m.movement_type === "deposit" || m.movement_type === "sale_proceeds") ? 1 : -1;
      result[m.currency] += sign * Number(m.amount);
    }
  }

  // 3b) Vencimientos / cobros de posiciones.
  //
  // Para BONOS / ONs / FCI / OPCIONES: solo aplicamos en windows >= 30d.
  // T1 raramente captura un vencimiento de bono y mezclarlo confunde
  // más que aporta.
  //
  // Para CAUCIONES: aplicamos en TODAS las windows (incluido T1), porque
  // las cauciones overnight vencen al día siguiente y T1 las captura.
  // Sumamos solo (montoTotal_al_vencer − devengado_a_hoy) = intereses
  // pendientes. El devengado_a_hoy ya está en CI (sección 1b), así que
  // sumar el total al vencer sería double-count.
  {
    const nonFuture = positions.filter((p) => p.instrument_type !== "future");
    const groups = consolidatePositions(nonFuture, bondPrices, futurePrices);

    for (const g of groups) {
      if (g.netQty === 0 || g.isClosed) continue;

      const sample = g.operations[0];
      if (!sample) continue;
      const matDate = getPositionMaturity(sample);
      if (!matDate) continue;
      const md = new Date(matDate + "T12:00:00");
      if (md < today || md > cutoff) continue;

      const cur = g.currency || "ARS";
      if (!(cur in result)) continue;

      if (sample.instrument_type === "caucion") {
        // Cauciones: sumar SOLO los intereses pendientes hasta vencer.
        // El devengado a hoy ya está en CI (1b).
        const totalAtMaturity = caucionValueAtMaturity(sample);
        const devengadoHoy = caucionValueDevengado(sample, todayIso);
        if (
          totalAtMaturity != null &&
          devengadoHoy != null &&
          Number.isFinite(totalAtMaturity) &&
          Number.isFinite(devengadoHoy)
        ) {
          result[cur] += (totalAtMaturity - devengadoHoy);
        }
      } else {
        // Bonos / ONs / FCI / Opciones: solo para windows >= 30d.
        if (windowKey === "T1") continue;
        if (g.valueAtMarket == null) continue;
        result[cur] += g.valueAtMarket;
      }
    }
  }

  // 3c) P&L NO acreditado de FUTUROS abiertos.
  //
  // El P&L "no acreditado" es la parte del P&L total contable del futuro
  // que TODAVÍA NO se reflejó como cash en la cuenta. Equivale a:
  //   nonAcreditedPnL = P&L_total_contable − SUM(actual_amount de adjustments confirmed)
  //
  // En la práctica, este monto contiene dos componentes que el usuario
  // ve día a día:
  //   (a) Pending adjustments (ajustes generados por el cron del día
  //       siguiente que esperan ser confirmados en el modal).
  //   (b) P&L vivo intraday del día corriente (todavía no se generó el
  //       pending porque el cron corre a las 7 AM del día hábil siguiente).
  //
  // ¿Por qué se suma a T1 / 30D / 60D / 90D y NO a CI?
  //   - CI = saldo cash estrictamente actual. El P&L no acreditado todavía
  //     no es cash, es una promesa que se va a materializar progresivamente
  //     a medida que el usuario confirme cada pending.
  //   - T1+ = "cuánto vas a tener disponible cuando se acrediten los
  //     próximos ajustes". Sumar el P&L no acreditado refleja eso.
  //
  // Cubrimos TODOS los futuros abiertos sin filtrar por vencimiento en
  // ventana. La razón: aunque el contrato venza dentro de 90 días o dentro
  // de 6 meses, el cash de los ajustes va goteando todos los días — no es
  // un flujo único al vencimiento como un bono. Para T1 / 30d / 60d / 90d
  // el monto relevante es el mismo: el P&L que todavía no se cobró.
  //
  // No double-counting porque:
  //   - Los acreditados YA están en cash (item 1: sumamos cash_movements
  //     incluyendo los deposits que vienen de confirmar adjustments).
  //   - El P&L no acreditado SOLO contiene lo no acreditado (lo restamos
  //     vía SUM(realizedPnL) del futureAdjLookup).
  //
  // ROFEX siempre liquida en ARS, sin importar la moneda registrada de
  // la posición.
  //
  // Defensive coding: try/catch + checks de Number.isFinite en cada suma.
  // Si consolidatePositions o el lookup devuelven algo inesperado,
  // logueamos y seguimos — preferible mostrar liquidez sin el aporte
  // de futuros que crashear la card entera.
  if (windowKey !== "CI") {
    try {
      const futures = Array.isArray(positions)
        ? positions.filter((p) => p && p.instrument_type === "future")
        : [];
      if (futures.length > 0) {
        const futureGroups = consolidatePositions(futures, bondPrices, futurePrices);
        if (Array.isArray(futureGroups)) {
          for (const g of futureGroups) {
            if (!g) continue;
            if (g.isClosed) continue;       // cerrado → su P&L ya está en cash
            if (g.netQty === 0) continue;    // neteo total → idem
            if (!Number.isFinite(g.pnl)) continue;

            // P&L acreditado del grupo: SUM(realizedPnL) de cada op del
            // grupo según el lookup. Si no hay lookup (caso edge), queda
            // 0 y sumamos el P&L total contable — equivalente al
            // comportamiento anterior del código antes del modelo
            // no-acreditado.
            let groupRealizedPnL = 0;
            if (futureAdjLookup && Array.isArray(g.operations)) {
              for (const op of g.operations) {
                if (!op || !op.id) continue;
                const entry = futureAdjLookup.get(op.id);
                if (entry && Number.isFinite(entry.realizedPnL)) {
                  groupRealizedPnL += entry.realizedPnL;
                }
              }
            }
            const nonAcreditedPnL = g.pnl - groupRealizedPnL;
            if (Number.isFinite(nonAcreditedPnL)) {
              result["ARS"] += nonAcreditedPnL;
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        "[computeLiquidityBreakdown] Error sumando P&L no acreditado de futuros:",
        err
      );
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


/* ─────────────── consolidatePositions ───────────────
 *
 * Agrupa las operaciones individuales por (ticker × moneda) y calcula
 * la "posición consolidada" del usuario sobre cada par.
 *
 * Esto es la vista que ven los brokers en su pantalla "Cartera": cuántos
 * VN tenés netos de cada bono, cuánto capital invertiste, cuánto vale
 * hoy y cuánto P&L generás.
 *
 * Reglas:
 *   - **Cantidad neta** = suma(compras) - suma(ventas).
 *   - **PPP (precio promedio ponderado)** = suma(qty_compra × precio_compra)
 *     dividido por suma(qty_compra). Solo de las compras: las ventas no
 *     mueven el PPP (Modelo "Cocos/Balanz", FIFO simplificado).
 *   - **Valor a mercado** = qty_neta × precio_actual (con la convención
 *     habitual del instrumento: /100 para bonos, ×1000 para futuros).
 *   - **Costo neto** = qty_neta × PPP (también con la convención del
 *     instrumento). Si hay short (qty_neta < 0), el costo es negativo y
 *     el P&L se interpreta al revés.
 *   - **P&L** = valor a mercado - costo neto.
 *   - **P&L %** = P&L / |costo neto| × 100.
 *
 * Identificadores:
 *   - groupKey = `${instrument_type}|${ticker}|${entry_currency}` —
 *     idéntico ticker en distintas monedas (ej. AL30D vs AL30C) son
 *     posiciones DIFERENTES porque son bonos distintos en BYMA.
 *
 * Cauciones, opciones y FCI: cada operación queda como su propio grupo
 * (consolidar cauciones de distinto plazo o tasa no tiene sentido).
 *
 * @param {Array} positions  Filas de la tabla `positions` (Modelo A)
 * @param {Object} bondPrices  Mapa ticker → { price } de useBondPrices
 * @returns {Array} grupos consolidados, ordenados por valor de mercado desc
 */
function consolidatePositions(positions, bondPrices, futurePrices) {
  if (!positions?.length) return [];

  // Tipos donde NO consolidamos: cada operación queda individual.
  // Son instrumentos donde el "ticker" no identifica unívocamente un
  // activo fungible (cauciones a distinto plazo, opciones con strike
  // distinto). Los FCI sí consolidan: comprar más cuotapartes del mismo
  // ticker es ampliar la misma posición — el VCP es uno solo para todas
  // las cuotapartes del fondo.
  const NO_CONSOLIDATE = new Set(["caucion", "option"]);

  /**
   * Construye el detalle "neteado" de operaciones para mostrar en el
   * expandible de la fila CERRADA, y calcula el P&L realizado total
   * sumando el P&L de cada par sintético.
   *
   * Reemplaza el log crudo de movimientos por pares COMPRA↔VENTA donde
   * cada par representa una venta original con su contraparte de costo
   * al PPP que tenía la posición JUSTO ANTES de esa venta.
   *
   * Ejemplo:
   *   compra 100 @ 10  → PPP en ese momento = 10
   *   venta  40 @ 12   → emite par: compra-espejo "40 @ 10" + venta "40 @ 12"
   *                       (P&L par = 40 × (12-10) = 80 raw)
   *   compra 60 @ 14   → PPP ahora = (60×10 + 60×14) / 120 = 12  (60 quedaron del lote inicial)
   *   venta  50 @ 15   → emite par: compra-espejo "50 @ 12" + venta "50 @ 15"
   *                       (P&L par = 50 × (15-12) = 150 raw)
   *
   * Las operaciones sintéticas se marcan con isSynthetic=true para que
   * la UI deshabilite los botones edit/delete (no existen en la BD).
   *
   * IMPORTANTE: El P&L "raw" devuelto NO tiene aplicada la convención
   * del instrumento (×100 para opciones, ×1000 para futuros, /100 para
   * bonos). Lo aplicamos en el caller con applyConventionToValue.
   *
   * @returns { synthetic: [...], realizedPnlRaw: number }
   */
  const buildClosedOperationsSynthetic = (g) => {
    // Ordenar cronológicamente: entry_date asc, created_at asc como tiebreaker.
    // Una operación sin entry_date va al final (caso edge).
    const sorted = [...g.operations].sort((a, b) => {
      const da = a.entry_date || "9999-12-31";
      const db = b.entry_date || "9999-12-31";
      if (da !== db) return da.localeCompare(db);
      const ca = a.created_at || "";
      const cb = b.created_at || "";
      return ca.localeCompare(cb);
    });

    // Recorremos en orden. Mantenemos PPP y qty acumulada de compras.
    // En cada VENTA emitimos UNA fila sintética "closed_pair" que
    // representa el par neteado: incluye qty, PPP del momento (entry_price)
    // y precio de venta (sell_price), todo en una sola fila visual con
    // badge CERRADA.
    let cumulativeBuyQty = 0;
    let cumulativeBuyValue = 0; // suma(qty × price) de compras
    const synthetic = [];
    let realizedPnlRaw = 0;
    let synthIdx = 0;

    for (const op of sorted) {
      const qty = Number(op.quantity) || 0;
      const price = Number(op.entry_price) || 0;
      if (op.operation_type === "sell") {
        // PPP en este momento = valor acumulado / qty acumulada
        const pppNow = cumulativeBuyQty > 0
          ? cumulativeBuyValue / cumulativeBuyQty
          : null;

        // P&L "raw" del par (sin aplicar convención del instrumento)
        if (pppNow != null) {
          realizedPnlRaw += qty * (price - pppNow);
        }

        // Fila ÚNICA "closed_pair": representa el par neteado completo.
        // - operation_type = "closed_pair" (marcador para que la UI
        //   renderice un badge CERRADA y muestre ambos precios).
        // - entry_price guarda el PPP del momento (precio compra).
        // - sell_price guarda el precio real de la venta.
        // - quantity es la qty de la venta (lo que se cerró).
        // - entry_date es la fecha de la venta.
        // - notes hereda las de la venta original (si tenía).
        synthetic.push({
          id: `${op.id}__synth_pair_${synthIdx}`,
          isSynthetic: true,
          operation_type: "closed_pair",
          ticker: op.ticker,
          instrument_type: op.instrument_type,
          quantity: qty,
          entry_price: pppNow, // PPP al momento de la venta — null si short
          sell_price: price,
          entry_currency: op.entry_currency,
          entry_date: op.entry_date, // fecha de la venta
          notes: op.notes || null,
        });

        synthIdx++;

        // En la convención PPP "Cocos/Balanz", la venta NO toca el PPP
        // de las compras pendientes. Mantenemos PPP — pero descontamos
        // qty proporcional para que el "PPP futuro" se calcule sobre
        // el remanente correcto (qtyVendida × PPP sale del valor).
        if (cumulativeBuyQty > 0 && pppNow != null) {
          const qtyToConsume = Math.min(qty, cumulativeBuyQty);
          cumulativeBuyQty -= qtyToConsume;
          cumulativeBuyValue -= qtyToConsume * pppNow;
        }
      } else {
        // COMPRA: suma al acumulado. (No emite fila al sintético porque
        // las compras puras viven en la fila ABIERTA, no acá).
        cumulativeBuyQty += qty;
        cumulativeBuyValue += qty * price;
      }
    }

    return { synthetic, realizedPnlRaw };
  };

  const groups = new Map();

  for (const p of positions) {
    const ticker = (p.ticker || "").trim().toUpperCase();
    const cur = p.entry_currency || "ARS";
    const t = p.instrument_type;

    // Si es no-consolidable, le damos un groupKey único por id
    const groupKey = NO_CONSOLIDATE.has(t)
      ? `${t}|${ticker}|${cur}|${p.id}`
      : `${t}|${ticker}|${cur}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        instrument_type: t,
        ticker,
        currency: cur,
        operations: [],
        totalBuyQty: 0,
        totalSellQty: 0,
        weightedBuyPriceNumerator: 0, // suma(qty × price) de compras
        weightedSellPriceNumerator: 0, // suma(qty × price) de ventas
        lastSellPrice: null, // precio de la última venta (por fecha)
        lastSellDate: null,  // fecha de la última venta
        firstDate: p.entry_date,
        lastDate: p.entry_date,
        notesAggregated: [],
      });
    }

    const g = groups.get(groupKey);
    g.operations.push(p);

    const qty = Number(p.quantity) || 0;
    const price = Number(p.entry_price) || 0;

    if (p.operation_type === "sell") {
      g.totalSellQty += qty;
      g.weightedSellPriceNumerator += qty * price;
      // Guardamos el precio de la última venta cronológica para que en
      // futuros con cierre (parcial o total) el "precio actual" se
      // pueda autoupdate al precio del cierre — como un override manual
      // implícito.
      if (
        price > 0 &&
        (g.lastSellDate == null || (p.entry_date && p.entry_date >= g.lastSellDate))
      ) {
        g.lastSellPrice = price;
        g.lastSellDate = p.entry_date;
      }
    } else {
      // Default es compra (incluye cauciones colocadas)
      g.totalBuyQty += qty;
      g.weightedBuyPriceNumerator += qty * price;
    }

    if (p.entry_date && p.entry_date < g.firstDate) g.firstDate = p.entry_date;
    if (p.entry_date && p.entry_date > g.lastDate) g.lastDate = p.entry_date;
    if (p.notes && p.notes.trim()) g.notesAggregated.push(p.notes);
  }

  // Calcular métricas finales para cada grupo
  const result = [];
  for (const g of groups.values()) {
    const netQty = g.totalBuyQty - g.totalSellQty;
    const ppp = g.totalBuyQty > 0
      ? g.weightedBuyPriceNumerator / g.totalBuyQty
      : null;
    const ppv = g.totalSellQty > 0
      ? g.weightedSellPriceNumerator / g.totalSellQty
      : null;

    // Posición cerrada: la cantidad neta es exactamente 0 (compras y
    // ventas se calzaron). Se separa de la consolidada principal en una
    // sección "Posiciones cerradas" porque el PnL ya es realizado y no
    // es información de cartera viva.
    //
    // Solo aplica a tipos donde "cerrada" tiene sentido (futuros, bonos,
    // acciones). Para cauciones/opciones/FCI ya van separadas vía
    // NO_CONSOLIDATE.
    const isClosed = netQty === 0 && g.totalBuyQty > 0 && g.totalSellQty > 0;

    // Resolución de precio actual: usamos el resolvePositionPrice de
    // cualquier operación del grupo (todas comparten ticker), pero
    // reemplazamos quantity por la neta y entry_price por el PPP para
    // que "current_price manual" del modelo individual no se pierda
    // a nivel grupo.
    //
    // Detectar override manual + timestamp para resolver prioridad vs cierre.
    // Si el user editó el precio manualmente DESPUÉS de la última venta,
    // ese override gana. Si fue antes, el cierre gana (porque el manual viejo
    // ya no representa el precio actual real).
    let manualOverride = null;
    let manualOverrideAt = null; // timestamp del último manual update
    for (const op of g.operations) {
      if (op.current_price != null) {
        const ts = op.current_price_updated_at;
        // Tomamos el manual override más reciente (por timestamp) como ganador.
        if (manualOverrideAt == null || (ts && ts > manualOverrideAt)) {
          manualOverride = Number(op.current_price);
          manualOverrideAt = ts;
        }
      }
    }

    let currentPrice = null;
    let priceSource = "cost";

    // NOTA: la lógica de "manualBeatsClose" (manual gana vs cierre según
    // timestamp posterior a la última venta) se eliminó cuando se unificó
    // la prioridad a "manual gana siempre". Si más adelante hace falta
    // distinguir manuales viejos de actuales, recuperar la comparación
    // entre manualOverrideAt y lastSellDate.

    // Precio Primary API: si tenemos un precio fresco vía /api/primary-md,
    // lo usamos como fuente para futuros — pero solo si NO hay manual
    // override. El override manual gana siempre (Modelo unificado:
    // "el usuario es la fuente de verdad", igual que para bonos).
    const primaryPrice = (g.instrument_type === "future" && futurePrices)
      ? futurePrices[g.ticker]?.price
      : null;

    // Orden de prioridad (unificado entre futuros, bonos, acciones):
    //   1. manualOverride (current_price cargado por el usuario) → gana siempre.
    //   2. Para futuros: primaryPrice (Matba-Rofex live).
    //   3. Para futuros con ventas: lastSellPrice (cierre del lote vendido).
    //   4. Para bonos/ONs: bondPrices del feed (BYMA/data912).
    //   5. ppp (fallback a costo).
    //
    // Bug reportado por LP en mayo/2026: para futuros, el override manual
    // se guardaba en BD pero el render seguía mostrando el precio de
    // Primary. Causa: el orden anterior priorizaba Primary > manual
    // (excepto si había una venta posterior — "manualBeatsClose"). Esto
    // hacía imposible editar el precio de un futuro abierto sin ventas.
    // Fix: el manual gana antes que cualquier otra fuente, sin importar
    // el tipo de instrumento. Si el manual está obsoleto, el usuario lo
    // borra y vuelve al feed.
    if (manualOverride != null) {
      currentPrice = manualOverride;
      priceSource = "manual";
    } else if (g.instrument_type === "future" && primaryPrice != null && primaryPrice > 0) {
      // Primary API: precio real-time de Matba-Rofex.
      currentPrice = primaryPrice;
      priceSource = "primary"; // badge "PRIMARY"
    } else if (
      g.instrument_type === "future" &&
      g.lastSellPrice != null
    ) {
      // Futuro sin Primary y sin manual: usamos el último precio de venta.
      currentPrice = g.lastSellPrice;
      priceSource = "close"; // badge "CIERRE"
    } else if (
      bondPrices &&
      ticker_isBondLike(g.instrument_type) &&
      bondPrices[g.ticker]?.price > 0
    ) {
      currentPrice = bondPrices[g.ticker].price;
      // El priceSource refleja la fuente REAL del entry (byma/data912/
      // mae_intraday/mae_close), no un genérico "market". Esto permite
      // que el badge UI muestre el label correcto y que las métricas
      // de cobertura ("X de Y a mercado") consideren MAE como fuente
      // legítima. Supabase consolida sus dos sub-fuentes bajo "mae".
      const entrySource = bondPrices[g.ticker].source;
      priceSource =
        entrySource === "byma" || entrySource === "data912"
          ? entrySource
          : entrySource === "mae_intraday" || entrySource === "mae_close"
            ? "mae"
            : "market";
    } else if (ppp != null) {
      currentPrice = ppp;
      priceSource = "cost";
    }

    // Valuación con la convención del instrumento.
    //
    // CASO ESPECIAL — Futuros:
    //   - valueAtMarket = P&L mark-to-market = qty_dirigida × mult × (price - PPP)
    //   - valueAtCost   = 0  (no pagás capital al abrir un futuro)
    //   - pnl           = valueAtMarket - valueAtCost = el P&L mismo
    //   - notional      = |qty_neta| × mult × precio_actual  (exposición, NO valor de cartera)
    //
    // Para una compra (long) de futuros, qty_neta es positiva → PnL positivo si
    // el precio sube. Para una venta (short), qty_neta es negativa → PnL
    // positivo si el precio baja. La fórmula `netQty × mult × (price - PPP)`
    // captura ambos signos correctamente.
    let valueAtMarket = null;
    let valueAtCost = null;
    let pnl = null;
    let pnlPct = null;
    let notional = null;
    let realizedPnl = null;     // P&L realizado por ventas/cierres
    let unrealizedPnl = null;   // P&L mark-to-market sobre la posición abierta

    if (g.instrument_type === "future") {
      const mult = FUTURE_MULTIPLIER_DEFAULT;

      // Construimos el sintético una sola vez. Devuelve los pares
      // COMPRA-espejo + VENTA neteados, y el P&L realizado total
      // calculado par-por-par con PPP cronológico (PPP al momento de
      // cada venta, no PPP final). Usamos esto como SOURCE OF TRUTH
      // para tanto el detalle expandible como el realizedPnl global —
      // así los números de pantalla siempre cuadran.
      const synth = (g.totalSellQty > 0)
        ? buildClosedOperationsSynthetic(g)
        : { synthetic: [], realizedPnlRaw: 0 };
      const closedOperations = synth.synthetic;

      // P&L REALIZADO: para futuros se aplica el multiplicador al raw.
      //   raw = sum(qtyVendida × (PPVenta - PPP_momento))
      //   con multiplicador: raw × FUTURE_MULTIPLIER_DEFAULT
      if (g.totalSellQty > 0) {
        realizedPnl = synth.realizedPnlRaw * mult;
      } else {
        realizedPnl = 0;
      }

      // CASO ESPECIAL — cierre parcial:
      //   Si hay ventas Y todavía queda posición abierta (netQty != 0), el
      //   grupo se DIVIDE en dos entradas separadas:
      //     - Una "abierta" con netQty contratos, sólo P&L no realizado.
      //     - Una "cerrada" con totalSellQty contratos, sólo P&L realizado.
      //   Esto evita mostrar +885k de PnL "abierto" en una posición que
      //   parcialmente ya se realizó.
      const isPartialClose = netQty !== 0 && g.totalSellQty > 0;

      if (isPartialClose) {
        // Para la entrada ABIERTA: P&L no realizado solo (netQty × mult × (current − PPP))
        let openUnrealizedPnl = 0;
        if (currentPrice != null && ppp != null && priceSource !== "cost") {
          openUnrealizedPnl = netQty * mult * (currentPrice - ppp);
        }
        const openNotional = currentPrice != null
          ? Math.abs(netQty) * mult * currentPrice
          : 0;
        const openPnlPct = openNotional > 0
          ? (openUnrealizedPnl / openNotional) * 100
          : null;

        // P&L LIFETIME del ticker: realizado de las ventas pasadas
        // + no realizado del lote actualmente vivo. Las dos filas del
        // split (abierta y cerrada) comparten el mismo lifetime porque
        // representan dos vistas de la misma historia con un ticker.
        // El usuario lo ve en el detalle expandible de cualquiera.
        const lifetimePnl = openUnrealizedPnl + realizedPnl;
        // % lifetime: sobre el notional total invertido en compras
        // (qty_total_buy × PPP × mult). Es el denominador natural para
        // futuros — los CR0SCAR no pagas capital, pero el "% de retorno
        // sobre exposición" es la métrica que tiene sentido comparar.
        const lifetimeBaseNotional = g.totalBuyQty * mult * ppp;
        const lifetimePnlPct = lifetimeBaseNotional > 0
          ? (lifetimePnl / lifetimeBaseNotional) * 100
          : null;

        // Filtrar las operations: solo las de compra van a la entrada abierta.
        // (las de venta van a la cerrada). Para el detalle expandible esto
        // significa que en la fila abierta se ven solo las compras.
        const openOperations = g.operations; // log completo: compras + ventas, sin neteo
        // closedOperations ya viene del sintético calculado arriba

        // Para la entrada CERRADA: precio actual = lastSellPrice, P&L realizado
        const closedPnl = realizedPnl;
        const initialNotional = g.totalSellQty * mult * ppp;
        const closedPnlPct = initialNotional > 0
          ? (closedPnl / initialNotional) * 100
          : null;

        // Push entrada ABIERTA
        result.push({
          groupKey: g.groupKey + "|open",
          instrument_type: g.instrument_type,
          ticker: g.ticker,
          currency: g.currency,
          operations: openOperations,
          operationsCount: openOperations.length,
          buyOpsCount: openOperations.length,
          sellOpsCount: 0,
          netQty,
          isShort: netQty < 0,
          isClosed: false,
          ppp,
          ppv: null,
          currentPrice,
          priceSource,
          valueAtMarket: openUnrealizedPnl,
          valueAtCost: 0,
          pnl: openUnrealizedPnl,
          pnlPct: openPnlPct,
          realizedPnl: 0,
          unrealizedPnl: openUnrealizedPnl,
          lifetimePnl,
          lifetimePnlPct,
          notional: openNotional,
          firstDate: g.firstDate,
          lastDate: g.lastDate,
          notesAggregated: g.notesAggregated,
        });

        // Push entrada CERRADA
        result.push({
          groupKey: g.groupKey + "|closed",
          instrument_type: g.instrument_type,
          ticker: g.ticker,
          currency: g.currency,
          operations: closedOperations,
          operationsCount: closedOperations.length,
          buyOpsCount: g.operations.filter((o) => o.operation_type !== "sell").length,
          sellOpsCount: g.operations.filter((o) => o.operation_type === "sell").length,
          netQty: 0,
          isShort: false,
          isClosed: true,
          ppp,
          ppv,
          currentPrice: g.lastSellPrice,
          priceSource: "close",
          valueAtMarket: closedPnl,
          valueAtCost: 0,
          pnl: closedPnl,
          pnlPct: closedPnlPct,
          realizedPnl: closedPnl,
          unrealizedPnl: 0,
          lifetimePnl,
          lifetimePnlPct,
          notional: 0,
          // Una info adicional útil para mostrar: cuántos contratos se cerraron
          closedQty: g.totalSellQty,
          firstDate: g.firstDate,
          lastDate: g.lastDate,
          notesAggregated: g.notesAggregated,
        });
        continue; // saltamos el push genérico de abajo
      }

      // CASOS NO PARTICULARES (sin venta, o cierre total):
      //   Cierre total (netQty = 0): solo P&L realizado. isClosed = true.
      //   Sin ventas (totalSellQty = 0): solo P&L no realizado. isClosed = false.

      // P&L NO REALIZADO (sobre netQty)
      if (netQty !== 0 && currentPrice != null && ppp != null && priceSource !== "cost") {
        unrealizedPnl = netQty * mult * (currentPrice - ppp);
      } else {
        unrealizedPnl = 0;
      }

      pnl = realizedPnl + unrealizedPnl;

      if (netQty !== 0 && currentPrice != null) {
        notional = Math.abs(netQty) * mult * currentPrice;
      } else {
        notional = 0;
      }

      valueAtMarket = pnl;
      valueAtCost = 0;

      if (notional && notional > 0) {
        pnlPct = (pnl / notional) * 100;
      } else if (isClosed && ppp != null && g.totalBuyQty > 0) {
        const initialNotional = g.totalBuyQty * mult * ppp;
        if (initialNotional > 0) pnlPct = (pnl / initialNotional) * 100;
      }
    } else {
      // ─────────────────────────────────────────────────────────────────
      //  Tipos consolidables NO-futuros (bond_ars, bond_usd, on, stock,
      //  cedear, fci, usd, crypto, option).
      //
      //  Acá replicamos la lógica de split open/closed que ya teníamos
      //  para futuros, pero usando applyConventionToValue() para respetar
      //  la convención de cada instrumento (ej. bonos /100, opciones ×100).
      //
      //  Convención PPP (Cocos/Balanz/IOL):
      //    - El PPP se calcula sólo sobre las compras y NO se mueve por
      //      ventas. Si compraste 35,9M a 139,32 y vendés 10M, el PPP de
      //      los 25,9M restantes sigue siendo 139,32.
      //    - El P&L realizado se calcula como (PPV − PPP) sobre la qty
      //      vendida, aplicando la convención del instrumento.
      // ─────────────────────────────────────────────────────────────────

      // Construimos el sintético una sola vez. Devuelve los pares
      // COMPRA-espejo + VENTA neteados, y el P&L realizado total
      // calculado par-por-par con PPP cronológico (PPP al momento de
      // cada venta, no PPP final). Source of truth tanto para el
      // detalle expandible como para realizedPnl global.
      const synth = (g.totalSellQty > 0)
        ? buildClosedOperationsSynthetic(g)
        : { synthetic: [], realizedPnlRaw: 0 };
      const closedOperations = synth.synthetic;

      // P&L REALIZADO sobre las ventas (si hubo). Aplicamos la convención
      // del instrumento al raw: para bonos /100, para opciones ×100, etc.
      // Hacemos un truco: applyConventionToValue(type, qty, price) nos
      // sirve si pasamos qty=1 y price=raw — devuelve el raw escalado.
      if (g.totalSellQty > 0) {
        // applyConventionToValue para no-futuros calcula:
        //   bonos:    (qty * price) / 100
        //   opciones: qty * 100 * price
        //   resto:    qty * price
        // Acá el "raw" ya es qty × Δprice (suma sobre los pares), así
        // que llamamos con qty=1 para que NO multiplique de nuevo, solo
        // aplique el factor (/100, ×100, o ×1).
        realizedPnl = applyConventionToValue(g.instrument_type, 1, synth.realizedPnlRaw);
      } else {
        realizedPnl = 0;
      }

      // CASO ESPECIAL — cierre parcial:
      //   netQty != 0 && hubo ventas → el grupo se DIVIDE en dos entradas:
      //     ABIERTA (netQty unidades, PPP, P&L no realizado vs precio actual)
      //     CERRADA (totalSellQty unidades, PPV, P&L realizado)
      //   Esto matchea el comportamiento que ya teníamos para futuros y
      //   replica la vista que dan Cocos / Balanz.
      const isPartialClose = netQty !== 0 && g.totalSellQty > 0;

      if (isPartialClose) {
        // ── Entrada ABIERTA: usa netQty + PPP + precio actual ──
        const openValueAtMarket = currentPrice != null
          ? applyConventionToValue(g.instrument_type, netQty, currentPrice)
          : null;
        const openValueAtCost = ppp != null
          ? applyConventionToValue(g.instrument_type, netQty, ppp)
          : null;
        const openPnl = (openValueAtMarket != null && openValueAtCost != null)
          ? openValueAtMarket - openValueAtCost
          : null;
        const openPnlPct = (openPnl != null && openValueAtCost != null && Math.abs(openValueAtCost) > 0)
          ? (openPnl / Math.abs(openValueAtCost)) * 100
          : null;

        const openOperations = g.operations; // log completo: compras + ventas, sin neteo
        // closedOperations ya viene del sintético calculado arriba

        // ── Entrada CERRADA: usa totalSellQty + PPP + PPV ──
        const closedPnl = realizedPnl;
        const closedValueAtCost = applyConventionToValue(g.instrument_type, g.totalSellQty, ppp);
        const closedPnlPct = (closedValueAtCost != null && Math.abs(closedValueAtCost) > 0)
          ? (closedPnl / Math.abs(closedValueAtCost)) * 100
          : null;

        // P&L LIFETIME del ticker: realizado de las ventas pasadas + no
        // realizado del lote vivo. Ambas filas del split lo comparten.
        // % lifetime sobre el costo total invertido en compras (toda la
        // historia). Si openPnl es null (sin precio actual), el lifetime
        // se reduce al realized.
        const lifetimePnl = (openPnl ?? 0) + closedPnl;
        const lifetimeCostBasis = applyConventionToValue(g.instrument_type, g.totalBuyQty, ppp);
        const lifetimePnlPct = (lifetimeCostBasis != null && Math.abs(lifetimeCostBasis) > 0)
          ? (lifetimePnl / Math.abs(lifetimeCostBasis)) * 100
          : null;

        // Push entrada ABIERTA
        result.push({
          groupKey: g.groupKey + "|open",
          instrument_type: g.instrument_type,
          ticker: g.ticker,
          currency: g.currency,
          operations: openOperations,
          operationsCount: openOperations.length,
          buyOpsCount: openOperations.length,
          sellOpsCount: 0,
          netQty,
          isShort: netQty < 0,
          isClosed: false,
          ppp,
          ppv: null,
          currentPrice,
          priceSource,
          valueAtMarket: openValueAtMarket,
          valueAtCost: openValueAtCost,
          pnl: openPnl,
          pnlPct: openPnlPct,
          realizedPnl: 0,
          unrealizedPnl: openPnl,
          lifetimePnl,
          lifetimePnlPct,
          notional: null,
          firstDate: g.firstDate,
          lastDate: g.lastDate,
          notesAggregated: g.notesAggregated,
        });

        // Push entrada CERRADA
        result.push({
          groupKey: g.groupKey + "|closed",
          instrument_type: g.instrument_type,
          ticker: g.ticker,
          currency: g.currency,
          operations: closedOperations,
          operationsCount: closedOperations.length,
          buyOpsCount: g.operations.filter((o) => o.operation_type !== "sell").length,
          sellOpsCount: g.operations.filter((o) => o.operation_type === "sell").length,
          netQty: 0,
          isShort: false,
          isClosed: true,
          ppp,
          ppv,
          currentPrice: g.lastSellPrice,
          priceSource: "close",
          // Para no-futuros, el "Total" de la fila cerrada lo dejamos en
          // el P&L realizado (mismo criterio que futuros): es lo que
          // efectivamente entró/salió de tu comitente al cerrar.
          valueAtMarket: closedPnl,
          valueAtCost: 0,
          pnl: closedPnl,
          pnlPct: closedPnlPct,
          realizedPnl: closedPnl,
          unrealizedPnl: 0,
          lifetimePnl,
          lifetimePnlPct,
          notional: 0,
          closedQty: g.totalSellQty,
          firstDate: g.firstDate,
          lastDate: g.lastDate,
          notesAggregated: g.notesAggregated,
        });
        continue; // saltamos el push genérico de abajo
      }

      // CASOS NO PARTICULARES (sin venta, o cierre total):
      if (isClosed) {
        // CIERRE TOTAL (netQty = 0, hubo compras y ventas que se calzaron
        // exactamente). Una sola fila cerrada con P&L realizado.
        const closedValueAtCost = (ppp != null)
          ? applyConventionToValue(g.instrument_type, g.totalSellQty, ppp)
          : null;
        valueAtMarket = realizedPnl;
        valueAtCost = 0;
        pnl = realizedPnl;
        unrealizedPnl = 0;
        pnlPct = (closedValueAtCost != null && Math.abs(closedValueAtCost) > 0)
          ? (realizedPnl / Math.abs(closedValueAtCost)) * 100
          : null;
      } else {
        // CASO STANDARD: posición abierta sin ventas (totalSellQty = 0).
        // Es la lógica que tenía el bloque antes de este fix.
        valueAtMarket = currentPrice != null
          ? applyConventionToValue(g.instrument_type, netQty, currentPrice)
          : null;
        valueAtCost = ppp != null
          ? applyConventionToValue(g.instrument_type, netQty, ppp)
          : null;
        if (valueAtMarket != null && valueAtCost != null) {
          pnl = valueAtMarket - valueAtCost;
          unrealizedPnl = pnl;
          pnlPct = Math.abs(valueAtCost) > 0
            ? (pnl / Math.abs(valueAtCost)) * 100
            : null;
        }
      }
    }

    // Para el detalle expandible: si es cierre total, mostramos pares
    // COMPRA-espejo + VENTA (sintético, ver buildClosedOperationsSynthetic).
    // Para posición abierta pura sin ventas, las operations crudas alcanzan.
    // El caso parcial se maneja arriba con su propio push.
    const operationsForRender = (isClosed && g.totalSellQty > 0)
      ? buildClosedOperationsSynthetic(g).synthetic
      : g.operations;

    result.push({
      groupKey: g.groupKey,
      instrument_type: g.instrument_type,
      ticker: g.ticker,
      currency: g.currency,
      operations: operationsForRender,
      operationsCount: operationsForRender.length,
      buyOpsCount: g.operations.filter((o) => o.operation_type !== "sell").length,
      sellOpsCount: g.operations.filter((o) => o.operation_type === "sell").length,
      netQty,
      isShort: netQty < 0,
      isClosed,
      ppp,
      ppv,
      currentPrice,
      priceSource,
      valueAtMarket,
      valueAtCost,
      pnl,
      pnlPct,
      realizedPnl,
      unrealizedPnl,
      // Para los casos no-split (fully open o fully closed), el lifetime
      // P&L coincide con pnl porque ya incluye realizedPnl + unrealizedPnl.
      lifetimePnl: pnl,
      lifetimePnlPct: pnlPct,
      notional,
      firstDate: g.firstDate,
      lastDate: g.lastDate,
      notesAggregated: g.notesAggregated,
    });
  }

  // Sort: posiciones con valor de mercado mayor primero. Las sin valor
  // (cauciones sin liquidar, opciones sin precio) van al final.
  result.sort((a, b) => {
    const av = a.valueAtMarket ?? -Infinity;
    const bv = b.valueAtMarket ?? -Infinity;
    return Math.abs(bv) - Math.abs(av);
  });

  return result;
}

/**
 * Devuelve la fecha "hoy" como string YYYY-MM-DD en zona horaria de
 * Buenos Aires. La usamos para filtrar las posiciones cerradas a las
 * del día en curso.
 */
function getTodayStringAR() {
  // "en-CA" da formato YYYY-MM-DD por defecto, perfecto para comparar
  // contra entry_date que viene de la BD en ese mismo formato.
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Toma el array de posiciones cerradas (ya consolidadas, con `operations`
 * conteniendo el sintético: pares COMPRA-espejo + VENTA real) y devuelve
 * solo las que tienen al menos una VENTA de hoy.
 *
 * Para cada fila resultante:
 *   - filtra `operations` a solo los pares cuya VENTA tiene entry_date=hoy
 *   - recalcula el P&L sumando solo esos pares
 *   - actualiza closedQty al total vendido hoy
 *
 * Las cerradas históricas (de días previos) NO aparecen — su P&L se
 * considera ya "consolidado" en el efectivo del comitente y no debería
 * mezclarse con la operativa del día. Esto evita que mañana se vean las
 * ventas de hoy mezcladas con las de mañana.
 */
function filterClosedToToday(closedGroups) {
  const today = getTodayStringAR();
  const result = [];

  for (const g of closedGroups) {
    // operations viene del sintético: 1 fila por par cerrado
    // (operation_type === "closed_pair") con entry_price = PPP del momento
    // y sell_price = precio real de la venta.
    const ops = g.operations || [];

    const todayPairs = ops.filter((p) =>
      p.operation_type === "closed_pair" && p.entry_date === today
    );

    if (todayPairs.length === 0) continue;

    // Recalcular P&L raw del día: sum(qty × (sell_price - PPP))
    let realizedPnlRaw = 0;
    let closedQtyToday = 0;
    for (const pair of todayPairs) {
      const qty = Number(pair.quantity) || 0;
      const sellPrice = Number(pair.sell_price) || 0;
      const buyPrice = pair.entry_price; // PPP — null si fue short
      if (buyPrice != null) {
        realizedPnlRaw += qty * (sellPrice - buyPrice);
      }
      closedQtyToday += qty;
    }

    // Aplicar convención del instrumento al P&L raw.
    let realizedPnl;
    if (g.instrument_type === "future") {
      realizedPnl = realizedPnlRaw * FUTURE_MULTIPLIER_DEFAULT;
    } else {
      realizedPnl = applyConventionToValue(g.instrument_type, 1, realizedPnlRaw);
    }

    // pnlPct: ratio sobre costo del lote vendido a PPP.
    let pnlPct = null;
    const valueAtCostToday = todayPairs.reduce((acc, pair) => {
      const qty = Number(pair.quantity) || 0;
      const price = pair.entry_price;
      if (price == null) return acc;
      return acc + applyConventionToValue(g.instrument_type, qty, price);
    }, 0);
    if (Math.abs(valueAtCostToday) > 0) {
      pnlPct = (realizedPnl / Math.abs(valueAtCostToday)) * 100;
    }

    result.push({
      ...g,
      operations: todayPairs,
      operationsCount: todayPairs.length,
      buyOpsCount: 0,
      sellOpsCount: todayPairs.length,
      pnl: realizedPnl,
      realizedPnl: realizedPnl,
      valueAtMarket: realizedPnl,
      valueAtCost: 0,
      pnlPct,
      closedQty: closedQtyToday,
    });
  }

  return result;
}

function ticker_isBondLike(instrumentType) {
  return (
    instrumentType === "bond_ars" ||
    instrumentType === "bond_usd" ||
    instrumentType === "on"
  );
}

function applyConventionToValue(instrumentType, qty, price) {
  // Bonos / ONs: precio cada 100 VN
  if (
    instrumentType === "bond_ars" ||
    instrumentType === "bond_usd" ||
    instrumentType === "on"
  ) {
    return (qty * price) / 100;
  }
  // Futuros: contrato * 1000 (multiplicador típico DLR)
  if (instrumentType === "future") {
    return qty * 1000 * price;
  }
  // Opciones: contrato * 100 * prima
  if (instrumentType === "option") {
    return qty * 100 * price;
  }
  return qty * price;
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
/* ─────────────── DataSourcesFooter ───────────────
 *
 * Footer estandarizado que aparece al pie de TODOS los módulos
 * (Portfolio, Carry Trade, Cotizaciones Dólar, etc.). Comunica:
 *
 *   - FUENTES: el set completo de APIs externas que la plataforma
 *     consulta en general. Mostramos siempre las mismas en todos los
 *     módulos por una decisión de transparencia: el usuario ve "estas
 *     son las fuentes de TODA la app", no solo del módulo en pantalla.
 *
 *   - AUTO-REFRESH: frecuencia + status del mercado. Recibimos el modo
 *     ya calculado vía prop (cada módulo decide qué interval usa) y
 *     traducimos a label.
 *
 *   - ÚLTIMA ACT: timestamp más reciente del módulo, formateado como
 *     tiempo relativo (hace Xs / Xm / Xh / Xd) usando timeAgo() ya
 *     existente. Re-renderiza cada segundo para que el contador siga
 *     vivo aunque no haya nuevos fetches.
 *
 * Reemplaza los footers manuales que cada módulo tenía duplicados,
 * con leves diferencias entre módulos.
 */
function DataSourcesFooter({
  lastUpdated,
  intervalMode = "idle",
  activeIntervalLabel = "5 min",
  idleIntervalLabel = "30 min",
  marginTop = 18,
}) {
  // Re-render cada segundo para que el contador "hace Xs" avance en pantalla.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Normalizar lastUpdated a Date (puede venir como Date, ISO string, o null)
  const lastDate = useMemo(() => {
    if (!lastUpdated) return null;
    if (lastUpdated instanceof Date) return lastUpdated;
    const d = new Date(lastUpdated);
    return isNaN(d.getTime()) ? null : d;
  }, [lastUpdated]);

  const intervalLabel = intervalMode === "active"
    ? `${activeIntervalLabel} · horario hábil`
    : `${idleIntervalLabel} · fuera de horario`;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        fontSize: 10,
        color: C.dim,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        marginTop,
      }}
    >
      <span>fuentes:</span>
      <span style={{ color: C.muted }}>data912.com</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>dolarapi.com</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>API REM (BCRA)</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>BYMA</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>Primary API</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>Matba-Rofex</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>A3 Mercados</span>
      <span style={{ color: C.faint }}>·</span>
      <span style={{ color: C.muted }}>criptoya.com</span>

      <span style={{ color: C.faint }}>·</span>

      <span>auto-refresh:</span>
      <span style={{ color: C.muted }}>{intervalLabel}</span>

      <span style={{ color: C.faint }}>·</span>

      <span>última act:</span>
      <span style={{ color: C.muted }}>{timeAgo(lastDate, now)}</span>
    </div>
  );
}


function PortfolioDashboard({ onNavigate }) {
  const { positions, loading, error, addPosition, updatePosition, deletePosition } = useUserPositions();

  // Hook de cash: trackea movements (deposits, withdrawals, sale_proceeds,
  // purchase_cost) y deriva el saldo por moneda. Lo usamos en TotalCard,
  // DistributionCard y LiquidityCard, además de sincronizar movements
  // automáticamente cuando se crean/editan/borran positions.
  const cashState = useCashMovements();

  // Levantamos los hooks de FX y precios de bonos al nivel del Dashboard,
  // así DashboardOverview Y PositionsTable comparten la misma instancia
  // (un solo fetch en lugar de duplicarlo).
  const fxState = useDashboardFx();
  const bondPricesState = useBondPrices();
  // Precios de acciones argentinas + CEDEARs desde data912 con pct_change
  // para calcular P&L diario sin snapshots históricos.
  const stockPricesState = useStockPrices();

  // Tickers de futuros únicos en cartera para suscribirse a Primary API.
  // Los calculamos a este nivel (PortfolioDashboard) en vez de DashboardOverview
  // porque ConsolidatedSection también necesita los precios real-time.
  const futureTickers = useMemo(() => {
    const set = new Set();
    for (const p of positions || []) {
      if (p.instrument_type === "future" && p.ticker) {
        set.add(p.ticker.toUpperCase().trim());
      }
    }
    return Array.from(set);
  }, [positions]);

  // Hook que pollea /api/primary-md cada 10s (horario hábil) o 30 min (fuera).
  // Si futureTickers está vacío, no hace ningún request.
  const futurePricesState = useFuturePrices(futureTickers);

  // Hook que maneja ajustes diarios MTM de futuros (Tramo 2 del refactor
  // de cash de futuros). Genera filas pending al cargar el dashboard
  // (≥9 AM AR de día hábil) por cada posición × día sin ajuste.
  // Expone confirm/skip que crean cash_movements al confirmar.
  const futureAdjustmentsState = useFutureAdjustments(positions, futurePricesState.prices);

  // Refresh global: el botón "Actualizar" en el header de Posiciones
  // consolidadas (y el auto-refresh inteligente) refresca las TRES
  // fuentes de precios: FX (dólar), bonos (BYMA/DATA912) y futuros
  // (Primary). Antes solo refrescaba FX + bonos, dejando los precios
  // de futuros stale hasta que el auto-poll de 10s los actualizara.
  const handleRefreshAll = useCallback(() => {
    fxState.refresh();
    bondPricesState.refresh();
    futurePricesState.refresh();
  }, [fxState, bondPricesState, futurePricesState]);
  const anyLoading = fxState.loading || bondPricesState.loading || futurePricesState.loading;

  // ─────────────── Auto-refresh inteligente ───────────────
  //
  // Refresca FX + precios de bonos automáticamente con frecuencia que
  // depende del horario:
  //
  //   - Día hábil entre 10:00 y 17:00 ART (mercado abierto BYMA/ROFEX):
  //     refresh cada 5 minutos. Los precios cambian rápido y el usuario
  //     necesita data fresca para tomar decisiones.
  //
  //   - Resto del tiempo (fines de semana, feriados, fuera de horario):
  //     refresh cada 30 minutos. Solo para mantener algo de frescura
  //     sin gastar API calls innecesarios — el mercado está cerrado.
  //
  // El cálculo del horario se hace en zona horaria Argentina (no la
  // del navegador) para que un usuario fuera del país vea el mismo
  // comportamiento que uno local. Detectamos día hábil con
  // isNonBusinessDay() que ya excluye fines de semana + feriados BYMA.
  //
  // El intervalo se recalcula cada vez que cambia la hora (al cruzar
  // las 10:30 o las 17:30, o al cambiar de día), gracias al useEffect
  // que se reejecuta con `tick`.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Determinar frecuencia según horario actual. Usamos minutos para
    // que 10:30 / 17:30 sean exactos (cubre pre-apertura BYMA y subasta
    // de cierre 17:00-17:05).
    const now = new Date();
    const arDateStr = now.toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const arTimeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false,
    });
    const arHour = parseInt(arTimeStr.slice(0, 2), 10);
    const arMinute = parseInt(arTimeStr.slice(3, 5), 10);
    const arNowMinutes = arHour * 60 + arMinute;
    const isMarketHours =
      arNowMinutes >= 10 * 60 + 30 &&
      arNowMinutes < 17 * 60 + 30;
    const isBizDay = !isNonBusinessDay(arDateStr);

    const intervalMs = (isMarketHours && isBizDay)
      ? 60 * 1000       // 1 min en horario de mercado (data fresca para trading activo)
      : 30 * 60 * 1000; // 30 min fuera de horario

    const id = setInterval(() => {
      handleRefreshAll();
      // Forzamos re-evaluación del intervalo por si cambió el horario
      // (ej: a las 17:30 cruzamos de "mercado abierto" a "cerrado")
      setTick((t) => t + 1);
    }, intervalMs);

    return () => clearInterval(id);
  }, [tick, handleRefreshAll]);

  // Estados UI
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [filter, setFilter] = useState("all");
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  // Modal de movimiento manual de cash (Ingresar / Retirar). null = cerrado.
  // Cuando está abierto, contiene el `type` ("deposit" o "withdrawal") para
  // que el modal sepa qué etiquetas y colores mostrar.
  const [cashModalType, setCashModalType] = useState(null);
  // Movement bajo edición. Si está seteado, el modal de cash arranca
  // en modo edición con los valores precargados.
  const [editingCashMovement, setEditingCashMovement] = useState(null);
  // Movement pendiente de confirmación de borrado.
  const [confirmingDeleteCash, setConfirmingDeleteCash] = useState(null);

  // Handler para edición inline de current_price desde la tabla de
  // posiciones. Acepta `null` para limpiar el override y volver al
  // precio de mercado o costo según corresponda.
  const handleUpdateCurrentPrice = useCallback(async (positionId, newPrice) => {
    const patch = {
      current_price: newPrice,
      current_price_updated_at: newPrice == null ? null : new Date().toISOString(),
    };
    try {
      await updatePosition(positionId, patch);
    } catch (e) {
      console.error("Error actualizando precio:", e);
    }
  }, [updatePosition]);

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
    let savedPosition;
    if (editingPosition) {
      savedPosition = await updatePosition(editingPosition.id, payload);
    } else {
      savedPosition = await addPosition(payload);
    }
    // Sincronizar cash_movement asociado: si la position es de tipo
    // bond_ars/bond_usd/on/stock/cedear/fci, inserta o actualiza el
    // movement correspondiente. Para futuros, solo genera cash en
    // ventas que netean contra compras previas (P&L del par cerrado,
    // ARS, T+1). Si no aplica, syncForPosition borra el movement
    // existente (caso edge: cambiaste el tipo a uno no soportado al
    // editar).
    if (savedPosition) {
      try {
        await cashState.syncForPosition(savedPosition, positions);
      } catch (err) {
        // No bloqueamos al usuario si el cash sync falla — mostramos en consola
        // y la position queda guardada. Se puede reintentar abriendo y guardando
        // de nuevo, o desde un futuro botón "Recalcular cash".
        console.error("Error sincronizando cash_movement:", err);
      }

      // Comisión de futuros: si el user la tipeó al crear, generamos un
      // cash_movement adicional (purchase_cost a T+1). Solo en ALTAS:
      // al editar la position, el flag !editingPosition del form evita
      // que extra.commission llegue al payload, por lo cual no se
      // duplica.
      if (
        !editingPosition &&
        savedPosition.instrument_type === "future" &&
        Number(savedPosition.extra?.commission) > 0
      ) {
        try {
          await cashState.insertCommissionMovement(savedPosition);
        } catch (err) {
          console.error("Error insertando cash_movement de comisión:", err);
        }
      }
    }
    closeDrawer();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmingDelete) return;
    const positionId = confirmingDelete.id;
    await deletePosition(positionId);
    // El movement asociado lo borra Postgres por ON DELETE CASCADE.
    // Acá solo limpiamos el state local del hook de cash.
    cashState.removeForPosition(positionId);
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
          <DashboardOverview
            positions={positions}
            fxState={fxState}
            bondPricesState={bondPricesState}
            futurePricesState={futurePricesState}
            stockPricesState={stockPricesState}
            cashState={cashState}
            futureAdjustmentsState={futureAdjustmentsState}
            onIngresar={() => setCashModalType("deposit")}
            onRetirar={() => setCashModalType("withdrawal")}
          />

          {/* Vista consolidada (Modelo B): agrupa por ticker × moneda × tipo */}
          <ConsolidatedSection
            positions={positions}
            filteredPositions={filteredPositions}
            bondPrices={bondPricesState.prices}
            futurePrices={futurePricesState.prices}
            stockPrices={stockPricesState.prices}
            futureAdjustmentsState={futureAdjustmentsState}
            filter={filter}
            setFilter={setFilter}
            presentTypes={presentTypes}
            onEdit={openEdit}
            onDelete={(p) => setConfirmingDelete(p)}
            onUpdatePrice={handleUpdateCurrentPrice}
            onAdd={openCreate}
            onRefresh={handleRefreshAll}
            refreshing={anyLoading}
          />

          {/* Historial de operaciones (Modelo A): lista cruda de cada
              compra/venta. Va colapsado por default — el usuario lo abre
              cuando necesita auditar movimientos. */}
          <OperationsHistorySection
            positions={filteredPositions}
            movements={cashState.movements}
            bondPrices={bondPricesState.prices}
            onEdit={openEdit}
            onDelete={(p) => setConfirmingDelete(p)}
            onUpdatePrice={handleUpdateCurrentPrice}
            onEditCashMovement={(m) => setEditingCashMovement(m)}
            onDeleteCashMovement={(m) => setConfirmingDeleteCash(m)}
            onNavigateToLibro={onNavigate ? () => onNavigate("libro-operaciones") : null}
          />

          {/* Footer informativo: fuentes globales + estado auto-refresh.
              Componente compartido con Carry Trade y Cotizaciones Dólar.
              `lastUpdated` es el max entre FX y bondPrices (lo que
              tenga el timestamp más reciente). `intervalMode` lo
              calculamos en base al horario actual. */}
          <DataSourcesFooter
            lastUpdated={(() => {
              const fx = fxState.lastUpdated ? new Date(fxState.lastUpdated).getTime() : 0;
              const px = bondPricesState.lastFetch ? new Date(bondPricesState.lastFetch).getTime() : 0;
              const max = Math.max(fx, px);
              return max ? new Date(max) : null;
            })()}
            intervalMode={isActiveMarketWindow() ? "active" : "idle"}
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

      {/* Modal de movimiento manual de cash (Ingresar / Retirar / Editar) */}
      {(cashModalType || editingCashMovement) && (
        <CashMovementModal
          type={cashModalType || editingCashMovement.movement_type}
          editingMovement={editingCashMovement}
          onCancel={() => {
            setCashModalType(null);
            setEditingCashMovement(null);
          }}
          onSubmit={async (payload) => {
            if (editingCashMovement) {
              // Modo edición: update del movement existente
              await cashState.updateManualMovement(editingCashMovement.id, payload);
            } else {
              // Modo creación: insert nuevo
              await cashState.addManualMovement(payload);
            }
            setCashModalType(null);
            setEditingCashMovement(null);
          }}
        />
      )}

      {/* Modal de confirmación de borrado de cash movement */}
      {confirmingDeleteCash && (
        <DeleteCashMovementModal
          movement={confirmingDeleteCash}
          onCancel={() => setConfirmingDeleteCash(null)}
          onConfirm={async () => {
            await cashState.deleteManualMovement(confirmingDeleteCash.id);
            setConfirmingDeleteCash(null);
          }}
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


/* ─────────────── FutureAdjustmentsBanner ───────────────
 *
 * Banner de alerta visible en la sección "Posiciones consolidadas"
 * cuando hay ajustes diarios MTM de futuros pendientes de confirmación.
 *
 * Click → abre el modal de acreditación.
 *
 * Props:
 *   count: número de ajustes pendientes.
 *   totalEstimated: suma de estimated_amount (en ARS, signed).
 *   onClick: handler del click.
 */
function FutureAdjustmentsBanner({ count, totalEstimated, onClick }) {
  const isPositive = totalEstimated >= 0;
  const sign = isPositive ? "+" : "";
  // Color de borde: amarillo siempre (es una alerta de "atención necesaria",
  // no es bueno ni malo en sí mismo).
  const accent = "#eab308"; // tailwind amber-500

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between"
      style={{
        width: "100%",
        backgroundColor: "rgba(234,179,8,0.08)",
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        padding: "12px 16px",
        marginBottom: 12,
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(234,179,8,0.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(234,179,8,0.08)";
      }}
    >
      <div className="flex items-center gap-3">
        <AlertCircle size={16} strokeWidth={2} color={accent} />
        <div className="flex flex-col">
          <span style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: C.text,
            fontFamily: "'Roboto', sans-serif",
            letterSpacing: "0.01em",
          }}>
            {count === 1
              ? "1 movimiento de futuros pendiente de acreditación"
              : `${count} movimientos de futuros pendientes de acreditación`}
          </span>
          <span style={{
            fontSize: 10.5,
            color: C.dim,
            fontFamily: "'Roboto', sans-serif",
            marginTop: 2,
          }}>
            Total estimado:&nbsp;
            <span
              className="eco-mono"
              style={{
                color: isPositive ? C.green : C.red,
                fontWeight: 500,
              }}
            >
              {sign}{fmtNumber(totalEstimated, { maxDecimals: 2 })} ARS
            </span>
          </span>
        </div>
      </div>

      <span style={{
        fontSize: 11,
        color: accent,
        fontWeight: 600,
        fontFamily: "'Roboto', sans-serif",
        letterSpacing: "0.05em",
      }}>
        Revisar →
      </span>
    </button>
  );
}


/* ─────────────── FutureAdjustmentsModal ───────────────
 *
 * Modal donde el user confirma cada ajuste diario MTM de futuros.
 * Pre-carga el monto estimado en cada input. El user puede:
 *   - Editar el monto (si Cocos liquidó distinto al estimado).
 *   - Confirmar → crea cash_movement con la fecha del ajuste.
 *
 * Si ese día no hubo movimiento real, el usuario igual confirma con
 * monto = 0 (no hay botón "Saltar" — la opción A del diseño es
 * más simple y consistente).
 *
 * Si hay varios ajustes pendientes, los muestra todos en una lista
 * scrolleable. El usuario los confirma de a uno (no hay "confirmar
 * todos" — agregar mostraría riesgo de confirmar montos mal sin querer).
 *
 * Recálculo con feed live:
 *   Si el ajuste tiene is_estimated=true (settle oficial todavía no
 *   publicado) Y hay un precio actual en futurePrices, recalculamos
 *   curr_settle y estimated_amount al MONTAR el modal. Esto cubre el
 *   caso donde el cron generó el pending con un snapshot viejo del
 *   feed y después Primary siguió moviéndose. Si el usuario cierra y
 *   reabre, vuelve a recalcular con el feed del momento (se pierde
 *   cualquier override manual). Mientras el modal queda abierto NO se
 *   recalcula automáticamente (para no pisar lo que el usuario tipeó).
 *
 * Props:
 *   adjustments: array de filas pending desde futures_daily_adjustments.
 *   futurePrices: feed de precios live (para recalcular is_estimated).
 *   onConfirm(id, actualAmount): callback al confirmar.
 *   onClose: cerrar el modal.
 */
function getAdjustmentDisplayValues(adj, futurePrices) {
  const livePrice = futurePrices?.[adj.ticker]?.price;
  const useLive = adj.is_estimated && Number.isFinite(Number(livePrice));
  const currSettle = useLive ? Number(livePrice) : Number(adj.curr_settle);
  const prevSettle = Number(adj.prev_settle);
  const netQty = Number(adj.net_qty);
  const multiplier = Number(adj.multiplier);
  const estimatedAmount = (currSettle - prevSettle) * netQty * multiplier;
  return { currSettle, prevSettle, estimatedAmount, isLive: useLive };
}

function FutureAdjustmentsModal({ adjustments, futurePrices, onConfirm, onClose }) {
  // Estado local: { [adjustmentId]: { value: string, processing: bool, error: string } }
  const [drafts, setDrafts] = useState(() => {
    const init = {};
    for (const a of adjustments) {
      const { estimatedAmount } = getAdjustmentDisplayValues(a, futurePrices);
      init[a.id] = {
        value: String(Math.round(estimatedAmount)),
        processing: false,
        error: null,
      };
    }
    return init;
  });

  // Si la lista de adjustments cambia (porque uno se confirmó/skipped y se
  // reprodujo el fetch), filtramos los que ya no están del state local.
  // Para los que sobrevivieron mantenemos su draft (no pisar lo que el
  // usuario tipeó). Los adjustments nuevos arrancan con el monto recalculado.
  useEffect(() => {
    setDrafts((prev) => {
      const next = {};
      for (const a of adjustments) {
        if (prev[a.id]) {
          next[a.id] = prev[a.id];
        } else {
          const { estimatedAmount } = getAdjustmentDisplayValues(a, futurePrices);
          next[a.id] = {
            value: String(Math.round(estimatedAmount)),
            processing: false,
            error: null,
          };
        }
      }
      return next;
    });
    // futurePrices intencionalmente FUERA de deps: no queremos pisar el
    // valor del input cuando llega un tick nuevo del feed. El recálculo
    // con feed live solo aplica al MONTAR el modal (cerrar + reabrir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments]);

  const handleConfirm = async (adj) => {
    const draft = drafts[adj.id];
    if (!draft) return;
    const monto = Number(draft.value.replace(/,/g, "."));
    if (!Number.isFinite(monto)) {
      setDrafts((prev) => ({
        ...prev,
        [adj.id]: { ...prev[adj.id], error: "Monto inválido" },
      }));
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [adj.id]: { ...prev[adj.id], processing: true, error: null },
    }));
    try {
      await onConfirm(adj.id, monto);
      // El parent re-fetch hará que adjustments se actualice y este
      // bloque se desmonte automáticamente.
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [adj.id]: {
          ...prev[adj.id],
          processing: false,
          error: e.message || "Error al confirmar",
        },
      }));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Click en el backdrop cierra el modal
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          backgroundColor: C.panel,
          border: `1px solid ${C.border}`,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div className="flex flex-col">
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              fontFamily: "'Roboto', sans-serif",
            }}>
              Acreditación de movimientos de futuros
            </span>
            <span style={{
              fontSize: 10.5,
              color: C.dim,
              marginTop: 2,
              fontFamily: "'Roboto', sans-serif",
            }}>
              {adjustments.length === 1
                ? "1 ajuste pendiente"
                : `${adjustments.length} ajustes pendientes`}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Cuerpo: lista scrolleable */}
        <div style={{
          padding: "12px 20px",
          overflowY: "auto",
          flex: 1,
        }}>
          {adjustments.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px 0",
              color: C.dim,
              fontSize: 12,
            }}>
              No hay ajustes pendientes
            </div>
          ) : (
            adjustments.map((adj) => {
              const draft = drafts[adj.id] || { value: "0", processing: false, error: null };
              // Recalculamos curr_settle y estimated_amount con feed live
              // si es_estimated. Esto refleja el último precio de Primary
              // al momento de abrir el modal — más actualizado que el
              // snapshot que dejó el cron en BD.
              const display = getAdjustmentDisplayValues(adj, futurePrices);
              const variation = display.currSettle - display.prevSettle;
              const variationPct = display.prevSettle > 0
                ? (variation / display.prevSettle) * 100
                : null;
              const variationColor = variation >= 0 ? C.green : C.red;
              const variationSign = variation >= 0 ? "+" : "";
              const estimated = display.estimatedAmount;
              const estIsPositive = estimated >= 0;

              return (
                <div
                  key={adj.id}
                  style={{
                    border: `1px solid ${C.border}`,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: C.deep,
                  }}
                >
                  {/* Header de la fila */}
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center gap-3">
                      <span
                        className="eco-mono"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.text,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {adj.ticker}
                      </span>
                      <span style={{
                        fontSize: 10.5,
                        color: C.dim,
                        fontFamily: "'Roboto', sans-serif",
                      }}>
                        {adj.adjustment_date}
                      </span>
                      {adj.is_estimated && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: "#eab308",
                          backgroundColor: "rgba(234,179,8,0.12)",
                          border: "1px solid rgba(234,179,8,0.4)",
                          padding: "2px 6px",
                          letterSpacing: "0.06em",
                          fontFamily: "'Roboto', sans-serif",
                          textTransform: "uppercase",
                        }}>
                          Estimado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cartel explicativo cuando es estimado */}
                  {adj.is_estimated && (
                    <div style={{
                      backgroundColor: "rgba(234,179,8,0.08)",
                      borderLeft: "2px solid #eab308",
                      padding: "8px 10px",
                      marginBottom: 10,
                      fontSize: 10.5,
                      lineHeight: 1.5,
                      color: C.muted,
                      fontFamily: "'Roboto', sans-serif",
                    }}>
                      El settle oficial de este día aún no se publicó.
                      El monto sugerido se calculó usando el precio actual
                      de mercado como referencia. <strong style={{ color: C.text }}>
                      Confirmá con el monto real que tu broker te liquidó</strong>.
                    </div>
                  )}

                  {/* Detalles: variación + cantidad */}
                  <div
                    className="flex items-center gap-4"
                    style={{ marginBottom: 10, fontSize: 11 }}
                  >
                    <div className="flex flex-col">
                      <span style={{
                        fontSize: 9,
                        color: C.dim,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontFamily: "'Roboto', sans-serif",
                      }}>
                        Variación settlement
                      </span>
                      <span
                        className="eco-mono"
                        style={{ color: C.text, marginTop: 2 }}
                      >
                        {fmtNumber(display.prevSettle, { maxDecimals: 2 })}
                        &nbsp;→&nbsp;
                        {fmtNumber(display.currSettle, { maxDecimals: 2 })}
                        &nbsp;
                        <span style={{ color: variationColor }}>
                          ({variationSign}{fmtNumber(variation, { maxDecimals: 2 })}
                          {variationPct != null && (
                            <>
                              {" / "}{variationSign}{variationPct.toFixed(2)}%
                            </>
                          )})
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span style={{
                        fontSize: 9,
                        color: C.dim,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontFamily: "'Roboto', sans-serif",
                      }}>
                        Cantidad neta
                      </span>
                      <span
                        className="eco-mono"
                        style={{ color: C.text, marginTop: 2 }}
                      >
                        {fmtNumber(adj.net_qty, { maxDecimals: 0 })} ×{" "}
                        {fmtNumber(adj.multiplier, { maxDecimals: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Input de monto */}
                  <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                    <div className="flex flex-col" style={{ flex: 1 }}>
                      <label style={{
                        fontSize: 9,
                        color: C.dim,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontFamily: "'Roboto', sans-serif",
                        marginBottom: 4,
                      }}>
                        Monto a acreditar (ARS)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.value}
                        onChange={(e) => setDrafts((prev) => ({
                          ...prev,
                          [adj.id]: { ...prev[adj.id], value: e.target.value, error: null },
                        }))}
                        disabled={draft.processing}
                        className="eco-mono"
                        style={{
                          backgroundColor: C.deep,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                    </div>
                    <div className="flex flex-col" style={{ paddingLeft: 8 }}>
                      <span style={{
                        fontSize: 9,
                        color: C.dim,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontFamily: "'Roboto', sans-serif",
                        marginBottom: 4,
                      }}>
                        Estimado
                      </span>
                      <span
                        className="eco-mono"
                        style={{
                          fontSize: 12.5,
                          color: estIsPositive ? C.green : C.red,
                          fontWeight: 500,
                          padding: "8px 0",
                        }}
                      >
                        {estIsPositive ? "+" : ""}{fmtNumber(estimated, { maxDecimals: 2 })}
                      </span>
                    </div>
                  </div>

                  {draft.error && (
                    <div style={{
                      fontSize: 11,
                      color: C.red,
                      marginBottom: 8,
                      fontFamily: "'Roboto', sans-serif",
                    }}>
                      {draft.error}
                    </div>
                  )}

                  {/* Botón confirmar (sin "Saltar" — si querés que un día
                       no impacte, ponés monto 0 igual). Texto explicativo
                       abajo para clarificar el uso. */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleConfirm(adj)}
                      disabled={draft.processing}
                      style={{
                        backgroundColor: C.accent,
                        border: "none",
                        color: "#fff",
                        padding: "8px 14px",
                        cursor: draft.processing ? "wait" : "pointer",
                        fontSize: 11.5,
                        fontWeight: 600,
                        fontFamily: "'Roboto', sans-serif",
                        letterSpacing: "0.02em",
                        opacity: draft.processing ? 0.6 : 1,
                        alignSelf: "flex-start",
                      }}
                    >
                      {draft.processing ? "Procesando..." : "Confirmar y acreditar"}
                    </button>
                    <span style={{
                      fontSize: 10,
                      color: C.dim,
                      fontFamily: "'Roboto', sans-serif",
                      lineHeight: 1.5,
                    }}>
                      Si Cocos te liquidó un monto distinto al estimado,
                      editalo antes de confirmar. Si ese día no hubo
                      movimiento real, dejalo en 0.
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 11.5,
              fontWeight: 500,
              fontFamily: "'Roboto', sans-serif",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─────────────── ConsolidatedSection ───────────────
 * 
 * Wrapper de la vista consolidada con su cabecera, filtros y tabla.
 */
function ConsolidatedSection({
  positions,
  filteredPositions,
  bondPrices,
  futurePrices,
  stockPrices,
  futureAdjustmentsState,
  filter,
  setFilter,
  presentTypes,
  onEdit,
  onDelete,
  onUpdatePrice,
  onAdd,
  onRefresh,
  refreshing,
}) {
  // Consolidamos sobre TODAS las positions filtradas (incluyendo cerradas).
  // Después separamos en `open` y `closed` para que cada una vaya a su
  // propia sección.
  const allConsolidated = useMemo(
    () => consolidatePositions(filteredPositions, bondPrices, futurePrices),
    [filteredPositions, bondPrices, futurePrices]
  );

  // Modal state para acreditación de ajustes futuros pendientes.
  // Se abre desde el banner y muestra la lista de ajustes pendientes
  // con inputs editables para confirmar el monto real liquidado.
  const [adjustmentsModalOpen, setAdjustmentsModalOpen] = useState(false);

  const pending = futureAdjustmentsState?.pendingAdjustments || [];
  const confirmed = futureAdjustmentsState?.confirmedAdjustments || [];
  const totalEstimated = useMemo(() => {
    return pending.reduce((sum, a) => sum + (Number(a.estimated_amount) || 0), 0);
  }, [pending]);

  // Lookup de adjustments por position_id — usado por ConsolidatedRow
  // para calcular el P&L del día del futuro contra el último settle
  // CONOCIDO en BD (no contra el fp.settlement del feed, que viene del
  // día previo de mercado y puede arrastrar varios días sin acreditar).
  const futureAdjLookup = useMemo(
    () => buildFutureAdjLookup(pending, confirmed),
    [pending, confirmed]
  );

  const open = allConsolidated.filter((g) => !g.isClosed);
  const closedAll = allConsolidated.filter((g) => g.isClosed);
  // Solo mostramos las cerradas DE HOY: filtramos los pares sintéticos
  // por fecha de venta y recalculamos P&L solo del día. Esto evita que
  // ventas de días previos se mezclen con las de hoy en la UI y en el
  // total realizado del banner.
  const closed = filterClosedToToday(closedAll);

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
        <span style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: C.dim,
          textTransform: "uppercase",
          fontWeight: 600,
        }}>
          Posiciones consolidadas ({open.length})
        </span>

        <div className="flex items-center gap-2">
          {/* Botón "Actualizar" (secundario): refresca FX + bondPrices.
              Reemplaza al botón que vivía en el header de Cotizaciones
              del día. Acción global de refresh manual. */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
              style={{
                backgroundColor: "transparent",
                border: `1px solid ${C.border}`,
                color: C.muted,
                padding: "7px 12px",
                cursor: refreshing ? "wait" : "pointer",
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "'Roboto', sans-serif",
                letterSpacing: "0.01em",
                transition: "all 120ms ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (refreshing) return;
                e.currentTarget.style.color = C.text;
                e.currentTarget.style.borderColor = C.borderStrong;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.muted;
                e.currentTarget.style.borderColor = C.border;
              }}
            >
              <RefreshCw
                size={12}
                strokeWidth={1.8}
                className={refreshing ? "eco-spin" : undefined}
              />
              {refreshing ? "Actualizando" : "Actualizar"}
            </button>
          )}

          {/* Botón "Agregar posición" — vive acá (al lado del header de la
              sección) porque es la acción principal de Posiciones
              consolidadas. Antes estaba arriba al lado del saludo, pero
              visualmente queda mejor anclado a la sección donde produce
              efecto directo. */}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-2"
              style={{
                backgroundColor: C.accent,
                color: C.bg,
                border: "none",
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 12.5,
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
              <Plus size={14} strokeWidth={2.2} />
              Agregar posición
            </button>
          )}
        </div>
      </div>

      {/* Filtros (chips por tipo) */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
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

      {/* Banner de ajustes pendientes de futuros: aparece solo si hay
          al menos un ajuste con status='pending'. Click → abre modal
          de acreditación donde el user confirma el monto real liquidado
          por el broker. */}
      {pending.length > 0 && (
        <FutureAdjustmentsBanner
          count={pending.length}
          totalEstimated={totalEstimated}
          onClick={() => setAdjustmentsModalOpen(true)}
        />
      )}

      {/* Modal de acreditación */}
      {adjustmentsModalOpen && (
        <FutureAdjustmentsModal
          adjustments={pending}
          futurePrices={futurePrices}
          onConfirm={futureAdjustmentsState.confirm}
          onClose={() => setAdjustmentsModalOpen(false)}
        />
      )}

      {open.length === 0 ? (
        <div
          style={{
            backgroundColor: C.panel,
            border: `1px solid ${C.border}`,
            padding: "20px",
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          No hay posiciones abiertas en este filtro
        </div>
      ) : (
        <ConsolidatedTable
          consolidated={open}
          bondPrices={bondPrices}
          futurePrices={futurePrices}
          stockPrices={stockPrices}
          futureAdjLookup={futureAdjLookup}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdatePrice={onUpdatePrice}
        />
      )}

      {/* Sección de posiciones cerradas (colapsable) */}
      {closed.length > 0 && (
        <ClosedPositionsSection
          closed={closed}
          bondPrices={bondPrices}
          futurePrices={futurePrices}
          stockPrices={stockPrices}
          futureAdjLookup={futureAdjLookup}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdatePrice={onUpdatePrice}
        />
      )}
    </div>
  );
}


/* ─────────────── ClosedPositionsSection ───────────────
 *
 * Sección colapsable con las posiciones que ya cerraste (cantidad neta
 * = 0). Útil para ver el P&L realizado de tus trades cerrados sin que
 * ensucien la consolidada principal.
 *
 * El P&L acá ya es REALIZADO (efectivo en tu comitente, no mark-to-market).
 */

function ClosedPositionsSection({ closed, bondPrices, futurePrices, stockPrices, futureAdjLookup, onEdit, onDelete, onUpdatePrice }) {
  const [open, setOpen] = useState(false);

  // Sumamos el P&L total de las cerradas para mostrarlo en el header
  const totalRealizedPnl = closed.reduce(
    (acc, g) => acc + (g.pnl || 0),
    0
  );

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: C.panel,
          border: `1px solid ${C.border}`,
          padding: "10px 14px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={13} strokeWidth={1.8} color={C.dim} />
            : <ChevronRight size={13} strokeWidth={1.8} color={C.dim} />}
          <span style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            color: C.dim,
            textTransform: "uppercase",
            fontWeight: 600,
          }}>
            Posiciones cerradas hoy ({closed.length})
          </span>
          <span
            className="eco-mono"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: totalRealizedPnl >= 0 ? C.green : C.red,
              marginLeft: 12,
            }}
          >
            {totalRealizedPnl >= 0 ? "+" : ""}{fmtNumber(totalRealizedPnl, { maxDecimals: 2 })}
          </span>
          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            P&L realizado
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.dim }}>
          {open ? "Click para ocultar" : "Click para ver"}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 0 }}>
          <ConsolidatedTable
            consolidated={closed}
            bondPrices={bondPrices}
            futurePrices={futurePrices}
            stockPrices={stockPrices}
            futureAdjLookup={futureAdjLookup}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdatePrice={onUpdatePrice}
            variant="closed"
          />
        </div>
      )}
    </div>
  );
}


/* ─────────────── OperationsHistorySection ───────────────
 *
 * Sección colapsable que muestra el listado plano de operaciones
 * individuales (Modelo A — auditoría / movimientos). Por default está
 * colapsada — el usuario la abre cuando necesita ver detalle de cada
 * compra/venta.
 */
/* ─────────────── OperationsHistorySection ───────────────
 *
 * Muestra "Últimas operaciones" del usuario con la siguiente lógica:
 *   - Si hubo operaciones HOY → muestra solo las de hoy.
 *   - Si no hubo nada hoy → muestra las del último día con actividad.
 *   - Tope máximo: 10 operaciones (las más recientes).
 *
 * Para ver el histórico completo, hay un link "Ver libro completo →"
 * que navega a Reportes → Libro de operaciones.
 *
 * El padding de filas es muy compacto (densidad estilo Bloomberg) porque
 * con el tiempo van a acumularse muchas operaciones día a día.
 */
function OperationsHistorySection({
  positions,
  movements,
  bondPrices,
  onEdit,
  onDelete,
  onUpdatePrice,
  onEditCashMovement,
  onDeleteCashMovement,
  onNavigateToLibro,
}) {
  const [open, setOpen] = useState(false);

  // Mergeamos positions + cash_movements manuales en una sola lista,
  // ordenada por fecha desc (con created_at como tiebreaker). Solo
  // mostramos los manuales (deposits/withdrawals) — los automáticos
  // (sale_proceeds, purchase_cost) son redundantes con la position que
  // los originó.
  //
  // Cada elemento se etiqueta con `_kind` para que la PositionsTable
  // sepa qué sub-renderer usar.
  const recentRows = useMemo(() => {
    const items = [];

    // 1) Positions (todas)
    for (const p of (positions || [])) {
      items.push({
        _kind: "position",
        item: p,
        sortDate: p.entry_date || "",
        sortCreated: p.created_at || "",
      });
    }

    // 2) Cash movements MANUALES (deposit/withdrawal sin related_position_id)
    for (const m of (movements || [])) {
      if (m.related_position_id) continue;
      if (m.movement_type !== "deposit" && m.movement_type !== "withdrawal") continue;
      items.push({
        _kind: "cash_movement",
        item: m,
        sortDate: m.movement_date || "",
        sortCreated: m.created_at || "",
      });
    }

    // Ordenar por fecha desc, created_at desc como tiebreaker
    items.sort((a, b) => {
      if (a.sortDate !== b.sortDate) return b.sortDate.localeCompare(a.sortDate);
      return b.sortCreated.localeCompare(a.sortCreated);
    });

    if (items.length === 0) return [];

    // Filtro: si hay items HOY, mostramos solo los de hoy. Si no, los
    // del último día con actividad. Tope: 10. Mismo criterio que antes
    // pero aplicado al merge.
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = items.filter((it) => it.sortDate === today);

    if (todayItems.length > 0) return todayItems.slice(0, 10);

    const lastDate = items[0].sortDate;
    if (!lastDate) return [];
    return items.filter((it) => it.sortDate === lastDate).slice(0, 10);
  }, [positions, movements]);

  // Header label: "Operaciones de hoy" o "Operaciones del DD/MMM" según el
  // día que estemos mostrando.
  const headerLabel = useMemo(() => {
    if (recentRows.length === 0) return "Últimas operaciones";
    const today = new Date().toISOString().slice(0, 10);
    const showingDate = recentRows[0].sortDate;
    if (showingDate === today) return "Operaciones de hoy";
    return `Operaciones del ${fmtDateShort(showingDate)}`;
  }, [recentRows]);

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: C.panel,
          border: `1px solid ${C.border}`,
          padding: "10px 14px",
          cursor: "pointer",
          fontFamily: "'Roboto', sans-serif",
          borderBottom: open ? "none" : `1px solid ${C.border}`,
          transition: "background-color 100ms ease",
        }}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={13} strokeWidth={1.8} color={C.muted} />
            : <ChevronRight size={13} strokeWidth={1.8} color={C.muted} />}
          <span style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            color: open ? C.text : C.muted,
            textTransform: "uppercase",
            fontWeight: 600,
          }}>
            Últimas operaciones ({recentRows.length})
          </span>
          {recentRows.length > 0 && (
            <span style={{
              fontSize: 9.5,
              color: C.dim,
              letterSpacing: "0.04em",
              marginLeft: 8,
              textTransform: "uppercase",
            }}>
              · {headerLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onNavigateToLibro && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToLibro();
              }}
              style={{
                fontSize: 10,
                color: C.accent,
                cursor: "pointer",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Ver libro completo →
            </span>
          )}
          <span style={{ fontSize: 10, color: C.dim }}>
            {open ? "Click para ocultar" : "Click para ver detalle"}
          </span>
        </div>
      </button>

      {open && (
        <PositionsTable
          rows={recentRows}
          bondPrices={bondPrices}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdatePrice={onUpdatePrice}
          onEditCashMovement={onEditCashMovement}
          onDeleteCashMovement={onDeleteCashMovement}
        />
      )}
    </div>
  );
}


/* ─────────────── ConsolidatedTable (Modelo B) ───────────────
 *
 * Vista "cartera": agrupa operaciones por ticker × moneda × tipo.
 * Cada fila muestra cantidad neta, PPP, precio actual, P&L y total.
 * Cada fila es expandible para mostrar las operaciones individuales
 * que conforman ese consolidado (estilo Cocos/Balanz).
 *
 * Recibe el array `consolidated` ya calculado por consolidatePositions().
 * Las acciones (editar, borrar, cambiar precio) operan sobre las ops
 * individuales y delegan al callback del padre.
 */
function ConsolidatedTable({ consolidated, bondPrices, futurePrices, stockPrices, futureAdjLookup, onEdit, onDelete, onUpdatePrice, variant = "open" }) {
  const [expanded, setExpanded] = useState(new Set());
  const isClosed = variant === "closed";

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
              <PTh dense style={{ width: 28 }}>{""}</PTh>
              <PTh dense>Tipo</PTh>
              <PTh dense>Ticker</PTh>
              <PTh dense align="right">Cantidad / VN</PTh>
              <PTh dense align="right">PPP</PTh>
              <PTh dense align="right">{isClosed ? "Último precio" : "Precio actual"}</PTh>
              {!isClosed && <PTh dense align="right">P&amp;L Hoy</PTh>}
              <PTh dense align="right">{isClosed ? "P&L" : "P&L Total"}</PTh>
              <PTh dense align="right">Total</PTh>
              <PTh dense>Moneda</PTh>
              <PTh dense align="right">Ops</PTh>
            </tr>
          </thead>
          <tbody>
            {consolidated.map((g) => (
              <ConsolidatedRow
                key={g.groupKey}
                group={g}
                bondPrices={bondPrices}
                futurePrices={futurePrices}
                stockPrices={stockPrices}
                futureAdjLookup={futureAdjLookup}
                expanded={expanded.has(g.groupKey)}
                onToggle={() => toggle(g.groupKey)}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdatePrice={onUpdatePrice}
                readOnlyPrice={isClosed}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function ConsolidatedRow({ group, bondPrices, futurePrices, stockPrices, futureAdjLookup, expanded, onToggle, onEdit, onDelete, onUpdatePrice, readOnlyPrice = false }) {
  const meta = INSTRUMENT_TYPES[group.instrument_type] || {};
  const TypeIcon = meta.icon || Activity;
  const typeColor = meta.color ? C.cat[meta.color] : C.muted;

  const displayLabel =
    group.instrument_type === "bond_ars" || group.instrument_type === "bond_usd"
      ? "Bono"
      : (meta.label || group.instrument_type);

  const pnlColor = group.pnl == null ? C.dim : group.pnl >= 0 ? C.green : C.red;
  const pnlSign = group.pnl == null ? "" : group.pnl >= 0 ? "+" : "";

  // P&L diario del grupo: sumamos el P&L diario de cada operación viva.
  // Para futuros usamos LA-SE; para bonos/acciones/CEDEARs usamos
  // pct_change (derivamos cierre anterior). Si ninguna op del grupo tiene
  // datos para calcularlo (típico: caucion, fci, opciones), dailyPnl=null.
  // Si el mercado AR está cerrado en sentido amplio (sábado, domingo o
  // feriado nacional), devolvemos 0 con flag marketClosed=true para
  // Reset a 0 fuera del período "P&L HOY":
  //   - Fin de semana: 0
  //   - Lun-vie 00:00 - 10:29: 0 (mercado no abrió hoy todavía)
  //   - Lun-vie 10:30 - 23:59: calculado normal
  // El P&L HOY se mantiene visible post-cierre hasta medianoche, y se
  // resetea a 0 a las 00:00 del próximo día hábil. Esto cierra el ciclo
  // diario sin esperar a la apertura, evitando que de madrugada se vea
  // el P&L del día anterior como si fuera "de hoy".
  const { dailyPnl, dailyPct, marketClosed } = useMemo(() => {
    if (!isTradingDayAndMarketOpened()) {
      return { dailyPnl: 0, dailyPct: 0, marketClosed: true };
    }
    if (!group.operations || group.operations.length === 0) {
      return { dailyPnl: null, dailyPct: null, marketClosed: false };
    }

    // Para todos los tipos no-future, el P&L diario por unidad es el mismo
    // (depende solo del precio actual y cierre anterior). Calculamos UN
    // delta y lo multiplicamos por la cantidad neta del grupo (signed):
    // así una posición SHORT genera P&L negativo si el precio sube.
    if (group.instrument_type !== "future") {
      // Tomamos cualquier op del grupo (todas tienen el mismo ticker)
      // pero le inyectamos la cantidad NETA del grupo (con signo), un
      // operation_type 'compra' (el signo ya queda capturado por netQty)
      // y el PPP agregado del grupo como entry_price. Este último sirve
      // como fallback en computeDailyPnL si el ticker no tiene cierre
      // histórico todavía (recién emitido o sin datos en
      // daily_close_prices) — en ese caso P&L HOY = P&L TOTAL hasta que
      // se guarde el primer cierre de ayer.
      const sampleOp = {
        ...group.operations[0],
        quantity: group.netQty,
        operation_type: "compra",
        entry_price: group.ppp != null ? group.ppp : group.operations[0]?.entry_price,
      };
      const d = computeDailyPnL(sampleOp, bondPrices, futurePrices, stockPrices);
      if (!d) return { dailyPnl: null, dailyPct: null, marketClosed: false };
      return { dailyPnl: d.pnl, dailyPct: d.pct, marketClosed: false };
    }

    // Futuros: cada operación tiene sign distinto (long/short).
    // Para el P&L diario del grupo agregado: tomamos el último settle
    // KNOWN del lookup (curr_settle del último adjustment pending o
    // confirmed para alguna position del grupo). Si no hay lookup o no
    // hay adjustments, caemos al fallback fp.settlement del feed Primary.
    //
    // La diferencia: lookup.lastSettle siempre apunta al settle del
    // último día con ajuste registrado en BD, así que el P&L del día
    // queda estrictamente intraday (variación desde ese settle hasta
    // current_price). fp.settlement, en cambio, es el settle "más
    // reciente" del feed Primary, que puede ser del día anterior incluso
    // si hay 3 días de ajustes pendientes acumulados — eso inflaría
    // mal el P&L del día.
    const ticker = (group.ticker || "").toUpperCase();
    const fp = futurePrices?.[ticker];
    if (!fp || fp.price == null || fp.error) {
      return { dailyPnl: null, dailyPct: null };
    }
    const last = Number(fp.price);

    let settle = null;
    if (futureAdjLookup && Array.isArray(group.operations)) {
      // Tomamos el lastSettle más reciente entre las position_ids del
      // grupo (en consolidados de futuros suele haber 1 sola anchor op).
      let bestDate = null;
      for (const op of group.operations) {
        const entry = futureAdjLookup.get(op.id);
        if (entry?.lastSettle == null) continue;
        if (bestDate == null || entry.lastAdjDate > bestDate) {
          bestDate = entry.lastAdjDate;
          settle = entry.lastSettle;
        }
      }
    }
    // Sin adjustments en BD para ninguna op del grupo:
    //   - Si TODAS las ops se abrieron HOY (primera vez que opera el
    //     ticker), el P&L del día debe medirse desde el PPP del grupo:
    //     el "día" del usuario arrancó en el momento de comprar, no
    //     contra el settle de ayer del feed.
    //   - Caso contrario, caemos al settle del feed Primary.
    if (settle == null) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const allOpsToday = group.operations.every(
        (op) => op.entry_date === todayIso
      );
      if (allOpsToday && Number(group.ppp) > 0) {
        settle = Number(group.ppp);
      } else if (fp.settlement != null) {
        settle = Number(fp.settlement);
      }
    }
    if (settle == null || !Number.isFinite(last) || !Number.isFinite(settle) || settle <= 0) {
      return { dailyPnl: null, dailyPct: null };
    }
    // Multiplier: tomamos del primer op (asumimos consistente en el grupo)
    const multiplier = Number(group.operations[0]?.extra?.contract_size) || 1000;
    const netQty = Number(group.netQty) || 0;
    if (netQty === 0) return { dailyPnl: null, dailyPct: null };
    const diffPerUnit = last - settle;
    return {
      dailyPnl: diffPerUnit * netQty * multiplier,
      dailyPct: (diffPerUnit / settle) * 100,
    };
  }, [group, bondPrices, futurePrices, stockPrices, futureAdjLookup]);

  const dailyColor = (dailyPnl == null || marketClosed) ? C.dim : dailyPnl >= 0 ? C.green : C.red;
  const dailySign = (dailyPnl == null || marketClosed) ? "" : dailyPnl >= 0 ? "+" : "";

  // Para la celda de precio editable: como el grupo puede tener varias
  // operaciones, anclamos el current_price a la operación más reciente
  // (o la primera si no hay manual). Cuando el user guarda, se actualiza
  // ese current_price en esa op específica.
  const opWithManualPrice = group.operations.find((op) => op.current_price != null);
  const anchorPositionId = opWithManualPrice?.id ?? group.operations[0]?.id ?? null;

  const resolvedForCell = {
    price: group.currentPrice,
    source: group.priceSource ?? "cost",
  };
  const sampleForCell = {
    id: anchorPositionId,
    ticker: group.ticker,
    instrument_type: group.instrument_type,
    current_price: group.priceSource === "manual" ? group.currentPrice : null,
    entry_price: group.ppp,
    quantity: group.netQty,
  };

  return (
    <>
      <tr
        style={{
          borderBottom: expanded ? "none" : `1px solid ${C.border}`,
          transition: "background-color 100ms ease",
          backgroundColor: expanded ? "rgba(91,141,214,0.04)" : "transparent",
          cursor: "pointer",
        }}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.015)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <PTd dense>
          <span style={{ color: C.dim, display: "inline-flex" }}>
            {expanded ? <ChevronDown size={13} strokeWidth={1.8} /> : <ChevronRight size={13} strokeWidth={1.8} />}
          </span>
        </PTd>
        <PTd dense>
          <div className="flex items-center gap-2">
            <TypeIcon size={13} color={typeColor} strokeWidth={1.7} />
            <span style={{ fontSize: 11.5, color: C.muted }}>{displayLabel}</span>
          </div>
        </PTd>
        <PTd dense>
          <div className="flex items-center gap-2">
            <span className="eco-mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
              {group.ticker}
            </span>
            {group.isShort && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  padding: "1px 5px",
                  borderRadius: 2,
                  color: C.red,
                  backgroundColor: "rgba(248,113,113,0.10)",
                  border: `1px solid rgba(248,113,113,0.30)`,
                }}
              >
                SHORT
              </span>
            )}
          </div>
        </PTd>
        <PTd dense align="right">
          {group.instrument_type === "future" ? (
            <div className="flex flex-col items-end" style={{ gap: 2 }}>
              <span
                className="eco-mono"
                style={{ color: group.isShort ? C.red : C.text }}
              >
                {fmtNumber(group.netQty, { maxDecimals: 0 })}
              </span>
              {group.notional != null && (
                <span
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.02em",
                  }}
                  title="Notional: exposición nominal del contrato (no es valor de cartera)"
                >
                  Notional {fmtNumber(group.notional, { maxDecimals: 0 })}
                </span>
              )}
            </div>
          ) : (
            <span
              className="eco-mono"
              style={{ color: group.isShort ? C.red : C.text }}
            >
              {fmtNumber(
                group.netQty,
                // Cripto puede tener fracciones chicas (ej. 0,00012345 BTC).
                // El resto de los tipos (bonos VN, acciones, CEDEAR, ON,
                // opciones) son enteros, así que 0 decimales mantiene la
                // tabla limpia.
                group.instrument_type === "crypto"
                  ? { maxDecimals: 8 }
                  : { maxDecimals: 0 }
              )}
            </span>
          )}
        </PTd>
        <PTd dense align="right">
          <span className="eco-mono">
            {group.ppp != null ? fmtNumber(group.ppp, { maxDecimals: 4, smartDecimals: true }) : "—"}
          </span>
        </PTd>
        <PTd dense align="right" onClick={(e) => e.stopPropagation()}>
          {readOnlyPrice ? (
            // Posición cerrada: mostramos el precio del último cierre
            // como dato fijo, sin lápiz de edición. Es info histórica.
            resolvedForCell?.price != null ? (
              <div className="flex items-center justify-end gap-2">
                <span className="eco-mono">
                  {fmtNumber(resolvedForCell.price, {
                    maxDecimals: 4,
                    // Bonos cotizan a 3 decimales en BYMA/Cocos (140.870,
                    // 130.910). Forzamos minDecimals=3 para que Midas
                    // muestre el mismo nivel de detalle.
                    minDecimals:
                      group.instrument_type === "bond_ars" ||
                      group.instrument_type === "bond_usd" ||
                      group.instrument_type === "on"
                        ? 3
                        : 0,
                    smartDecimals: true,
                  })}
                </span>
                {resolvedForCell.source === "close" && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                      padding: "1px 5px",
                      borderRadius: 2,
                      color: C.green,
                      backgroundColor: "rgba(74,222,128,0.10)",
                      textTransform: "uppercase",
                    }}
                  >
                    cierre
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: C.dim }}>—</span>
            )
          ) : (
            <EditablePriceCell
              position={sampleForCell}
              resolved={resolvedForCell}
              onSave={(newPrice) => {
                if (!anchorPositionId) return;
                onUpdatePrice(anchorPositionId, newPrice);
              }}
            />
          )}
        </PTd>
        <PTd dense align="right">
          {!readOnlyPrice && (
            dailyPnl != null ? (
              <div className="flex flex-col items-end" style={{ gap: 1 }}>
                <span
                  className="eco-mono"
                  style={{ color: dailyColor, fontWeight: 500 }}
                >
                  {dailySign}{fmtNumber(dailyPnl, { maxDecimals: 2 })}
                </span>
                {dailyPct != null && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: dailyColor,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {dailySign}{dailyPct.toFixed(2)}%
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: C.dim }}>—</span>
            )
          )}
        </PTd>
        <PTd dense align="right">
          {group.pnl != null ? (
            <div className="flex flex-col items-end" style={{ gap: 1 }}>
              <span
                className="eco-mono"
                style={{ color: pnlColor, fontWeight: 500 }}
              >
                {pnlSign}{fmtNumber(group.pnl, { maxDecimals: 2 })}
              </span>
              {group.pnlPct != null && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: pnlColor,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {pnlSign}{group.pnlPct.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: C.dim }}>—</span>
          )}
        </PTd>
        <PTd dense align="right">
          {group.valueAtMarket != null ? (
            <span className="eco-mono" style={{ fontWeight: 500 }}>
              {fmtNumber(group.valueAtMarket, { maxDecimals: 2 })}
            </span>
          ) : group.valueAtCost != null ? (
            <div className="flex flex-col items-end" style={{ gap: 1 }}>
              <span className="eco-mono" style={{ fontWeight: 500 }}>
                {fmtNumber(group.valueAtCost, { maxDecimals: 2 })}
              </span>
              <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                a costo
              </span>
            </div>
          ) : (
            <span style={{ color: C.dim }}>—</span>
          )}
        </PTd>
        <PTd dense>
          <span style={{ fontSize: 11.5, color: C.muted }}>{group.currency}</span>
        </PTd>
        <PTd dense align="right">
          <span
            style={{
              fontSize: 11,
              color: C.muted,
              fontFamily: "'JetBrains Mono', monospace",
              backgroundColor: C.deep,
              padding: "1px 7px",
              borderRadius: 2,
              border: `1px solid ${C.border}`,
            }}
          >
            {group.operations.length}
          </span>
        </PTd>
      </tr>

      {/* Fila expandida: muestra cada operación individual del grupo */}
      {expanded && (
        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
          <td colSpan={readOnlyPrice ? 10 : 11} style={{ padding: 0, backgroundColor: C.deep }}>
            {/* Padding compacto: lo justo para no pegarse a los bordes pero
                sin desperdiciar espacio vertical. Padding-left grande para
                que la columna OP del sub-table arranque alineada con TICKER
                del header padre. */}
            <div style={{ padding: "6px 14px 8px 110px" }}>
              {/* Bloque "Histórico del ticker" en línea compacta — sin
                  línea divisoria ni texto explicativo, el label ya describe.
                  En posiciones fully open sin ventas, lifetimePnl === pnl
                  y este bloque solo confirma el dato. Cuando hubo ventas
                  o cierres parciales, lifetime es la suma agregada que
                  no se ve en la fila principal. */}
              {group.lifetimePnl != null && Number.isFinite(group.lifetimePnl) && (
                <div style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: C.dim,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    fontFamily: "'Roboto', sans-serif",
                  }}>
                    Histórico
                  </span>
                  <span style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: group.lifetimePnl >= 0 ? C.green : C.red,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {group.lifetimePnl >= 0 ? "+" : ""}
                    {fmtCurrencyValue(group.lifetimePnl, group.currency === "USD-MEP" || group.currency === "USD-CCL" ? "USD" : "ARS")}
                  </span>
                  {Number.isFinite(group.lifetimePnlPct) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: group.lifetimePnl >= 0 ? C.green : C.red,
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: group.lifetimePnl >= 0 ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                      padding: "1px 6px",
                      borderRadius: 2,
                    }}>
                      {group.lifetimePnl >= 0 ? "+" : ""}{group.lifetimePnlPct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}

              <div style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                color: C.dim,
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 4,
                fontFamily: "'Roboto', sans-serif",
              }}>
                Operaciones agrupadas
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...subThStyle("left"), width: 90 }}>Op.</th>
                    <th style={{ ...subThStyle("right"), width: 140 }}>Cantidad</th>
                    <th style={{ ...subThStyle("right"), width: 130 }}>Precio compra</th>
                    <th style={{ ...subThStyle("right"), width: 130 }}>Precio venta</th>
                    <th style={{ ...subThStyle("right"), width: 130 }}>Fecha</th>
                    <th style={{ ...subThStyle("left"), width: 160 }}>Notas</th>
                    <th style={{ ...subThStyle("right"), width: 80 }}>{""}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.operations.map((p) => {
                    const isSell = p.operation_type === "sell";
                    const isClosedPair = p.operation_type === "closed_pair";
                    // Cantidad firmada:
                    //  - VENTA cruda (en fila ABIERTA): negativa (restó posición).
                    //  - COMPRA cruda: positiva.
                    //  - CERRADA (par sintético): positiva, sin signo
                    //    (representa el lote cerrado, no un movimiento direccional).
                    const rawQty = Math.abs(Number(p.quantity) || 0);
                    const signedQty = isSell ? -rawQty : rawQty;

                    // Badge: COMPRA verde / VENTA rojo / CERRADA accent
                    const badgeLabel = isClosedPair ? "CERRADA" : isSell ? "VENTA" : "COMPRA";
                    const badgeColor = isClosedPair ? C.accent : isSell ? C.red : C.green;
                    const badgeBg = isClosedPair
                      ? "rgba(94, 129, 244, 0.10)"
                      : isSell ? "rgba(248,113,113,0.10)" : "rgba(74,222,128,0.10)";
                    const badgeBorder = isClosedPair
                      ? "rgba(94, 129, 244, 0.30)"
                      : isSell ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.25)";

                    // Para CERRADA, el color de la qty es text (neutro);
                    // para VENTA cruda es rojo; COMPRA es text.
                    const qtyColor = isClosedPair ? C.text : (isSell ? C.red : C.text);

                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={subTdStyle("left")}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.14em",
                              padding: "1px 6px",
                              borderRadius: 2,
                              color: badgeColor,
                              backgroundColor: badgeBg,
                              border: `1px solid ${badgeBorder}`,
                            }}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                        <td style={subTdStyle("right")}>
                          <span
                            className="eco-mono"
                            style={{
                              fontSize: 11.5,
                              color: qtyColor,
                            }}
                          >
                            {fmtNumber(
                              signedQty,
                              p.instrument_type === "crypto"
                                ? { maxDecimals: 8 }
                                : { maxDecimals: 0 }
                            )}
                          </span>
                        </td>
                        <td style={subTdStyle("right")}>
                          {/* Precio compra:
                                - COMPRA: muestra entry_price.
                                - VENTA cruda: vacío.
                                - CERRADA: muestra entry_price (que es el PPP del momento). */}
                          <span className="eco-mono" style={{ fontSize: 11.5 }}>
                            {(isClosedPair || !isSell) && p.entry_price != null
                              ? fmtNumber(p.entry_price, { maxDecimals: 4, smartDecimals: true })
                              : <span style={{ color: C.dim }}>—</span>}
                          </span>
                        </td>
                        <td style={subTdStyle("right")}>
                          {/* Precio venta:
                                - VENTA cruda: muestra entry_price (precio venta real).
                                - CERRADA: muestra sell_price (precio venta real).
                                - COMPRA: vacío. */}
                          <span className="eco-mono" style={{ fontSize: 11.5 }}>
                            {isClosedPair && p.sell_price != null
                              ? fmtNumber(p.sell_price, { maxDecimals: 4, smartDecimals: true })
                              : (isSell && p.entry_price != null
                                ? fmtNumber(p.entry_price, { maxDecimals: 4, smartDecimals: true })
                                : <span style={{ color: C.dim }}>—</span>)}
                          </span>
                        </td>
                        <td style={subTdStyle("right")}>
                          <span style={{ fontSize: 11, color: C.muted }}>
                            {fmtDateShort(p.entry_date)}
                          </span>
                        </td>
                        <td style={subTdStyle("left")}>
                          <span style={{ fontSize: 11, color: C.dim, maxWidth: 140, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.notes || ""}>
                            {p.notes || "—"}
                          </span>
                        </td>
                        <td style={subTdStyle("right")}>
                          {p.isSynthetic ? (
                            // Operaciones sintéticas: son la representación
                            // neteada (compra-espejo a PPP + venta real) que
                            // arma buildClosedOperationsSynthetic. No existen
                            // como filas en la BD, por lo que no se pueden
                            // editar ni borrar desde acá. Para tocar la venta
                            // original, ir a Libro de operaciones.
                            <span style={{ color: C.dim, fontSize: 9 }}>—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(p);
                                }}
                                aria-label="Editar"
                                style={{
                                  backgroundColor: "transparent",
                                  border: `1px solid transparent`,
                                  color: C.dim,
                                  padding: 4,
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
                                <Pencil size={11} strokeWidth={1.8} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(p);
                                }}
                                aria-label="Borrar"
                                style={{
                                  backgroundColor: "transparent",
                                  border: `1px solid transparent`,
                                  color: C.dim,
                                  padding: 4,
                                  cursor: "pointer",
                                  transition: "all 100ms ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = C.red;
                                  e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = C.dim;
                                  e.currentTarget.style.borderColor = "transparent";
                                }}
                              >
                                <Trash2 size={11} strokeWidth={1.8} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function subThStyle(align) {
  return {
    textAlign: align,
    padding: "5px 16px 6px",
    fontSize: 9,
    fontWeight: 600,
    color: C.dim,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'Roboto', sans-serif",
    whiteSpace: "nowrap",
  };
}

function subTdStyle(align) {
  return {
    textAlign: align,
    padding: "6px 16px",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };
}


/* ─────────────── Tabla de posiciones ─────────────── */
/**
 * Tabla mixta que renderiza positions y cash_movements en el mismo
 * formato visual. Cada item del array `rows` tiene un campo `_kind`
 * que identifica si es 'position' o 'cash_movement', y el componente
 * elige el sub-renderer correspondiente.
 *
 * Para mantener compatibilidad con código existente que pasa `positions`
 * (modelo viejo, antes de cash), si solo se pasa `positions` esto se
 * normaliza internamente como `rows` con _kind='position'.
 */
function PositionsTable({
  positions,
  rows,
  bondPrices,
  onEdit,
  onDelete,
  onUpdatePrice,
  onEditCashMovement,
  onDeleteCashMovement,
}) {
  // Normalizar entrada: si no nos pasaron `rows`, construirlas a partir
  // de `positions` (compatibilidad con código viejo que solo trabaja con
  // positions, ej: tablas en otras secciones).
  const allRows = rows ?? (positions || []).map((p) => ({ _kind: "position", item: p }));

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
              <PTh dense>Tipo</PTh>
              <PTh dense>Op.</PTh>
              <PTh dense>Ticker</PTh>
              <PTh dense align="right">Cantidad</PTh>
              <PTh dense align="right">Precio compra</PTh>
              <PTh dense align="right">Precio venta</PTh>
              <PTh dense align="right">Total</PTh>
              <PTh dense>Moneda</PTh>
              <PTh dense>Fecha</PTh>
              <PTh dense>Notas</PTh>
              <PTh dense align="right" style={{ width: 70 }}>{""}</PTh>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row) => {
              if (row._kind === "cash_movement") {
                const m = row.item;
                return (
                  <CashMovementRow
                    key={`cm_${m.id}`}
                    movement={m}
                    onEdit={onEditCashMovement || (() => {})}
                    onDelete={onDeleteCashMovement || (() => {})}
                  />
                );
              }
              const p = row.item;
              return (
                <PositionRow
                  key={p.id}
                  position={p}
                  bondPrices={bondPrices}
                  onEdit={() => onEdit(p)}
                  onDelete={() => onDelete(p)}
                  onUpdatePrice={(newPrice) => onUpdatePrice(p.id, newPrice)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PTh({ children, align = "left", style = {}, dense = false }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: dense ? "5px 14px" : "11px 14px",
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

function PTd({ children, align = "left", style = {}, dense = false }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: dense ? "4px 14px" : "12px 14px",
        fontSize: dense ? 12 : 12.5,
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
function PositionRow({ position, bondPrices, onEdit, onDelete, onUpdatePrice }) {
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

  // Total operado en esta operación (NO es el total a mercado actual).
  // Es la plata que movió la operación cuando ocurrió:
  //   - Bonos: cantidad × precio / 100
  //   - Opciones: cantidad × 100 × prima
  //   - Resto: cantidad × precio
  //
  // FUTUROS: NO mostramos un total porque la compra/venta de un contrato
  // de futuro no implica cash flow real (solo se ponen garantías y se
  // liquidan MTM diarios). El notional (qty × 1000 × precio) es la
  // exposición nominal, no plata movida. Lo mostramos como nota en la
  // columna de notas para que la info siga visible sin confundir.
  const isFuture = position.instrument_type === "future";
  const operationTotal = (!isFuture && position.entry_price != null)
    ? applyConventionToValue(
        position.instrument_type,
        Math.abs(Number(position.quantity) || 0),
        Number(position.entry_price)
      )
    : null;

  // Notional para futuros (qty × 1000 × precio): exposición nominal del
  // contrato. Va a la columna de notas como "Vale por $X operado".
  const futureNotional = (isFuture && position.entry_price != null)
    ? Math.abs(Number(position.quantity) || 0) * 1000 * Number(position.entry_price)
    : null;

  // Texto de la columna Notas. Para futuros prependemos el "Vale por…";
  // si el usuario también cargó notes manualmente, lo concatenamos.
  const userNotes = (position.notes || "").trim();
  let displayedNotes = userNotes;
  if (isFuture && futureNotional != null && futureNotional > 0) {
    const valePor = `Vale por ${fmtNumber(futureNotional, { maxDecimals: 0 })} ${position.entry_currency || "ARS"} operado`;
    displayedNotes = userNotes ? `${valePor} · ${userNotes}` : valePor;
  }

  return (
    <tr
      style={{
        borderBottom: `1px solid ${C.border}`,
        transition: "background-color 100ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.015)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <PTd dense>
        <div className="flex items-center gap-2">
          <TypeIcon size={12} color={typeColor} strokeWidth={1.7} />
          <span style={{ fontSize: 11, color: C.muted }}>{displayLabel}</span>
        </div>
      </PTd>
      <PTd dense>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            padding: "1px 6px",
            borderRadius: 3,
            color: isSell ? C.red : C.green,
            backgroundColor: isSell ? "rgba(248,113,113,0.10)" : "rgba(74,222,128,0.10)",
            border: `1px solid ${isSell ? "rgba(248,113,113,0.30)" : "rgba(74,222,128,0.30)"}`,
          }}
        >
          {isSell ? "VENTA" : "COMPRA"}
        </span>
      </PTd>
      <PTd dense>
        <span className="eco-mono" style={{ fontWeight: 600, fontSize: 12 }}>
          {position.ticker}
        </span>
      </PTd>
      <PTd dense align="right">
        <span
          className="eco-mono"
          style={{ color: isSell ? C.red : C.text }}
        >
          {fmtNumber(
            isSell
              ? -Math.abs(Number(position.quantity) || 0)
              : Math.abs(Number(position.quantity) || 0),
            position.instrument_type === "crypto"
              ? { maxDecimals: 8 }
              : { maxDecimals: 0 }
          )}
        </span>
      </PTd>
      {/* Precio compra: solo poblada si la operación es de compra. */}
      <PTd dense align="right">
        <span className="eco-mono">
          {!isSell && position.entry_price != null
            ? fmtNumber(position.entry_price, { maxDecimals: 4, smartDecimals: true })
            : <span style={{ color: C.dim }}>—</span>}
        </span>
      </PTd>
      {/* Precio venta: solo poblada si la operación es de venta. */}
      <PTd dense align="right">
        <span className="eco-mono">
          {isSell && position.entry_price != null
            ? fmtNumber(position.entry_price, { maxDecimals: 4, smartDecimals: true })
            : <span style={{ color: C.dim }}>—</span>}
        </span>
      </PTd>
      {/* Total operado: cantidad × precio (con convención del instrumento).
          Para ventas, en negativo y rojo. Es la plata movida en ESTA op. */}
      <PTd dense align="right">
        {operationTotal != null ? (
          <span
            className="eco-mono"
            style={{ color: isSell ? C.red : C.text, fontWeight: 500 }}
          >
            {fmtNumber(
              isSell ? -operationTotal : operationTotal,
              { maxDecimals: 2 }
            )}
          </span>
        ) : (
          <span style={{ color: C.dim }}>—</span>
        )}
      </PTd>
      <PTd dense>
        <span style={{ fontSize: 11, color: C.muted }}>{position.entry_currency}</span>
      </PTd>
      <PTd dense>
        <span style={{ fontSize: 11, color: C.muted }}>{fmtDateShort(position.entry_date)}</span>
      </PTd>
      <PTd dense>
        <span style={{ fontSize: 10.5, color: C.dim, maxWidth: 220, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayedNotes || ""}>
          {displayedNotes || "—"}
        </span>
      </PTd>
      <PTd dense align="right">
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


/* ─────────────── Fila de movimiento de efectivo ───────────────
 *
 * Variante de PositionRow para los cash_movements manuales (deposit /
 * withdrawal). Mantiene EL MISMO esquema de columnas que PositionRow
 * para que ambos tipos de fila convivan visualmente sin que la tabla
 * se desalinee.
 *
 * Mapeo de columnas:
 *   - Tipo:       "Efectivo" + ícono Wallet
 *   - Op.:        badge INGRESO (verde) o RETIRO (rojo)
 *   - Ticker:     moneda del movement (ARS / USD-MEP / USD-CCL)
 *   - Cantidad:   "—" (no aplica para cash)
 *   - Precio:     "—" para deposits y withdrawals
 *   - Total:      monto del movement, signo según tipo
 *   - Moneda:     misma que ticker (redundante pero mantiene formato)
 *   - Fecha:      movement_date
 *   - Notas:      notes
 *
 * Solo se muestran movements MANUALES (related_position_id IS NULL).
 * Los automáticos (sale_proceeds, purchase_cost) viven asociados a
 * una position y se borran en cascade — no se muestran acá para no
 * duplicar info.
 */
function CashMovementRow({ movement, onEdit, onDelete }) {
  const isDeposit = movement.movement_type === "deposit";
  const opLabel = isDeposit ? "INGRESO" : "RETIRO";
  const opColor = isDeposit ? C.green : C.red;
  const opBg = isDeposit ? "rgba(74,222,128,0.10)" : "rgba(248,113,113,0.10)";
  const opBorder = isDeposit ? "rgba(74,222,128,0.30)" : "rgba(248,113,113,0.30)";

  const amount = Number(movement.amount) || 0;
  const signedAmount = isDeposit ? amount : -amount;

  return (
    <tr
      style={{
        borderBottom: `1px solid ${C.border}`,
        transition: "background-color 100ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.015)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      {/* Tipo: ícono Wallet + label "Efectivo" */}
      <PTd dense>
        <div className="flex items-center gap-2">
          <Wallet size={12} color={C.muted} strokeWidth={1.7} />
          <span style={{ fontSize: 11, color: C.muted }}>Efectivo</span>
        </div>
      </PTd>

      {/* Op.: badge INGRESO / RETIRO */}
      <PTd dense>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            padding: "1px 6px",
            borderRadius: 3,
            color: opColor,
            backgroundColor: opBg,
            border: `1px solid ${opBorder}`,
          }}
        >
          {opLabel}
        </span>
      </PTd>

      {/* Ticker: moneda del movement */}
      <PTd dense>
        <span className="eco-mono" style={{ fontWeight: 600, fontSize: 12 }}>
          {movement.currency}
        </span>
      </PTd>

      {/* Cantidad: no aplica */}
      <PTd dense align="right">
        <span style={{ color: C.dim }}>—</span>
      </PTd>

      {/* Precio compra: no aplica */}
      <PTd dense align="right">
        <span style={{ color: C.dim }}>—</span>
      </PTd>

      {/* Precio venta: no aplica */}
      <PTd dense align="right">
        <span style={{ color: C.dim }}>—</span>
      </PTd>

      {/* Total: el monto firmado del movement */}
      <PTd dense align="right">
        <span
          className="eco-mono"
          style={{ color: isDeposit ? C.text : C.red, fontWeight: 500 }}
        >
          {fmtNumber(signedAmount, { maxDecimals: 2 })}
        </span>
      </PTd>

      {/* Moneda */}
      <PTd dense>
        <span style={{ fontSize: 11, color: C.muted }}>{movement.currency}</span>
      </PTd>

      {/* Fecha */}
      <PTd dense>
        <span style={{ fontSize: 11, color: C.muted }}>{fmtDateShort(movement.movement_date)}</span>
      </PTd>

      {/* Notas */}
      <PTd dense>
        <span
          style={{
            fontSize: 10.5,
            color: C.dim,
            maxWidth: 180,
            display: "inline-block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={movement.notes || ""}
        >
          {movement.notes || "—"}
        </span>
      </PTd>

      {/* Acciones: editar / borrar */}
      <PTd dense align="right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(movement)}
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
            onClick={() => onDelete(movement)}
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


/* ─────────────── EditablePriceCell ───────────────
 *
 * Celda de precio con edición inline. Muestra el precio efectivo de la
 * posición con un badge de su fuente:
 *
 *   - 'manual':  precio cargado por el user (override del current_price).
 *                Badge gris "manual" + lapicito visible.
 *   - 'market':  precio actual de data912 (solo bonos / ONs).
 *                Badge azul "data912" + lapicito visible (override permitido).
 *   - 'cost':    no hay precio actualizado. Aparece como "—" + lapicito
 *                con tooltip "Cargar precio actual".
 *
 * Click en el lápiz → input numérico inline + botones save / cancel.
 * Enter guarda, Esc cancela. Si se guarda vacío, limpia el override
 * (current_price = null) y vuelve a la fuente automática.
 */

function EditablePriceCell({ position, resolved, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const startEdit = () => {
    // Pre-poblamos el input con el precio actual (el que ve el user)
    setDraft(resolved?.price != null ? String(resolved.price) : "");
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = draft.trim();
      // Vacío = limpiar override (current_price = null)
      if (trimmed === "") {
        await onSave(null);
      } else {
        const num = Number(trimmed.replace(",", "."));
        if (!isFinite(num) || num <= 0) {
          // Inválido: cancelamos sin guardar
          cancel();
          return;
        }
        await onSave(num);
      }
      setEditing(false);
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          placeholder="0,00"
          style={{
            width: 90,
            backgroundColor: C.deep,
            border: `1px solid ${C.accent}`,
            color: C.text,
            padding: "4px 8px",
            fontSize: 12,
            textAlign: "right",
            fontFamily: "'JetBrains Mono', monospace",
            outline: "none",
          }}
        />
        <button
          onClick={save}
          disabled={saving}
          aria-label="Guardar"
          style={{
            backgroundColor: "transparent",
            border: "1px solid transparent",
            color: C.green,
            padding: 4,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          <Check size={11} strokeWidth={2} />
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          aria-label="Cancelar"
          style={{
            backgroundColor: "transparent",
            border: "1px solid transparent",
            color: C.dim,
            padding: 4,
            cursor: "pointer",
          }}
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>
    );
  }

  // Modo display
  const source = resolved?.source;
  const sourceBadge =
    source === "manual"  ? { label: "manual",  color: C.muted,  bg: "rgba(246,247,246,0.06)" } :
    source === "primary" ? { label: "primary", color: C.accent, bg: C.accentSoft } :
    source === "byma"    ? { label: "byma",    color: C.accent, bg: C.accentSoft } :
    source === "data912" ? { label: "data912", color: C.accent, bg: C.accentSoft } :
    source === "mae"     ? { label: "mae",     color: C.green,  bg: "rgba(74,222,128,0.10)" } :
    source === "market"  ? { label: "data912", color: C.accent, bg: C.accentSoft } : // legacy fallback
    source === "close"   ? { label: "cierre",  color: C.green,  bg: "rgba(74,222,128,0.10)" } :
    null; // cost: no badge, solo "—"

  return (
    <div className="flex items-center justify-end gap-2">
      {source === "cost" || resolved == null ? (
        <span style={{ color: C.dim, fontSize: 12 }}>—</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="eco-mono">
            {fmtNumber(resolved.price, {
              maxDecimals: 4,
              // Bonos cotizan a 3 decimales en BYMA/Cocos. minDecimals=3
              // fuerza ese nivel de detalle para coincidir visualmente.
              minDecimals:
                position?.instrument_type === "bond_ars" ||
                position?.instrument_type === "bond_usd" ||
                position?.instrument_type === "on"
                  ? 3
                  : 0,
              smartDecimals: true,
            })}
          </span>
          {sourceBadge && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.05em",
                padding: "1px 5px",
                borderRadius: 2,
                color: sourceBadge.color,
                backgroundColor: sourceBadge.bg,
                textTransform: "uppercase",
              }}
            >
              {sourceBadge.label}
            </span>
          )}
        </div>
      )}
      <button
        onClick={startEdit}
        aria-label="Editar precio actual"
        title={
          source === "manual"  ? "Editar precio manual" :
          source === "byma"    ? "Override del precio (BYMA)" :
          source === "data912" ? "Override del precio (data912)" :
          source === "mae"     ? "Override del precio (MAE)" :
          source === "market"  ? "Override manual del precio" :
          "Cargar precio actual"
        }
        style={{
          backgroundColor: "transparent",
          border: "1px solid transparent",
          color: C.dim,
          padding: 4,
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
        <Pencil size={10} strokeWidth={1.8} />
      </button>
    </div>
  );
}


/* ─────────────── Modal: ingresar / retirar efectivo ───────────────
 *
 * Modal genérico para cargar movimientos manuales de cash:
 *   - "deposit"    (Ingresar): plata que entra al broker desde tu banco.
 *                              También sirve para cargar el saldo inicial
 *                              cuando arrancás con la app.
 *   - "withdrawal" (Retirar):  plata que sale del broker hacia tu banco.
 *
 * Las compras y ventas NO usan este modal — generan movements automáticos
 * desde el drawer de cargar posición.
 *
 * El modal recibe:
 *   - type: "deposit" | "withdrawal" — predetermina título/colores/etiquetas
 *   - onCancel: cierra sin guardar
 *   - onSubmit({movement_type, currency, amount, movement_date, notes}):
 *       el padre se encarga de llamar al hook useCashMovements.addManualMovement
 */
function CashMovementModal({ type, editingMovement, onCancel, onSubmit }) {
  const isEditing = Boolean(editingMovement);

  // Si estamos editando, el tipo lo determina el movement existente.
  // Si no, viene del prop `type`.
  const [movementType, setMovementType] = useState(
    isEditing ? editingMovement.movement_type : type
  );
  const isDeposit = movementType === "deposit";
  const titleColor = isDeposit ? C.green : C.red;

  const [form, setForm] = useState(() => {
    if (isEditing) {
      return {
        currency: editingMovement.currency || "ARS",
        amount: String(editingMovement.amount ?? ""),
        movement_date: editingMovement.movement_date || new Date().toISOString().slice(0, 10),
        notes: editingMovement.notes || "",
      };
    }
    return {
      currency: "ARS",
      amount: "",
      movement_date: new Date().toISOString().slice(0, 10),
      notes: "",
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError(null);
  };

  // Validación: monto > 0 (los demás tienen defaults)
  const formIsValid = (() => {
    const n = Number(form.amount);
    return Number.isFinite(n) && n > 0;
  })();

  const handleSubmit = async () => {
    if (!formIsValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        movement_type: movementType,
        currency: form.currency,
        amount: Number(form.amount),
        movement_date: form.movement_date,
        notes: form.notes.trim() || null,
      });
    } catch (err) {
      setError(err.message || "Error al guardar el movimiento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={!submitting ? onCancel : undefined}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          zIndex: 90,
          animation: "ecoFadeIn 120ms ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: C.panel,
          border: `1px solid ${C.borderStrong}`,
          width: "min(440px, calc(100vw - 32px))",
          padding: 22,
          zIndex: 91,
          animation: "ecoFadeIn 160ms ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 10, height: 10, borderRadius: "50%",
                backgroundColor: titleColor,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: C.text,
                letterSpacing: "-0.01em",
              }}
            >
              {isEditing
                ? (isDeposit ? "Editar ingreso" : "Editar retiro")
                : (isDeposit ? "Ingresar efectivo" : "Retirar efectivo")}
            </span>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cerrar"
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: C.dim,
              cursor: submitting ? "default" : "pointer",
              padding: 4,
            }}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
          {isEditing
            ? "Modificá los datos del movimiento. Si cambiás de Ingreso a Retiro (o viceversa), el saldo se ajusta automáticamente."
            : (isDeposit
              ? "Cargá un depósito desde tu banco al broker, o el saldo inicial con el que arrancás. El monto se sumará al saldo de la moneda seleccionada."
              : "Cargá un retiro desde el broker hacia tu banco. El monto se descontará del saldo de la moneda seleccionada.")}
        </p>

        {/* Tipo (solo visible en edición — al crear viene fijado por el botón
            que se clickeó). Permite cambiar deposit ↔ withdrawal sin tener
            que borrar y volver a crear el movement. */}
        {isEditing && (
          <FormSection label="Tipo">
            <div className="flex gap-2">
              <ToggleButton
                active={movementType === "deposit"}
                onClick={() => setMovementType("deposit")}
                color="green"
              >
                Ingreso
              </ToggleButton>
              <ToggleButton
                active={movementType === "withdrawal"}
                onClick={() => setMovementType("withdrawal")}
                color="red"
              >
                Retiro
              </ToggleButton>
            </div>
          </FormSection>
        )}

        {/* Moneda */}
        <FormSection label="Moneda">
          <div className="flex gap-2">
            <ToggleButton
              active={form.currency === "ARS"}
              onClick={() => setField("currency", "ARS")}
            >
              Pesos
            </ToggleButton>
            <ToggleButton
              active={form.currency === "USD-MEP"}
              onClick={() => setField("currency", "USD-MEP")}
            >
              Dólar MEP
            </ToggleButton>
            <ToggleButton
              active={form.currency === "USD-CCL"}
              onClick={() => setField("currency", "USD-CCL")}
            >
              Dólar CCL
            </ToggleButton>
          </div>
        </FormSection>

        {/* Monto */}
        <FormSection label="Monto">
          <MoneyInput
            value={form.amount}
            onChange={(v) => setField("amount", v)}
            placeholder="0,00"
          />
        </FormSection>

        {/* Fecha */}
        <FormSection label="Fecha">
          <Input
            type="date"
            value={form.movement_date}
            onChange={(v) => setField("movement_date", v)}
          />
          <FieldHint>
            La fecha en la que efectivamente se acreditó/debitó el cash.
          </FieldHint>
        </FormSection>

        {/* Notas (opcional)
         *
         * Los chips de arriba pre-llenan el campo con prefijos comunes
         * (Comisión, Ajuste futuro, Suscripción FCI, etc.). Cubren el
         * 80% de los casos de uso típicos. El usuario puede agregar
         * detalles después de seleccionar el chip, o tipear todo libre.
         */}
        <FormSection label="Notas (opcional)">
          {/* Chips de categorías */}
          <div className="flex flex-wrap gap-1" style={{ marginBottom: 6 }}>
            {[
              "Comisión ROFEX",
              "Ajuste futuro",
              "Suscripción FCI",
              "Rescate FCI",
              "Caución",
              "Arancel",
              "Transferencia bancaria",
            ].map((chipText) => (
              <button
                key={chipText}
                type="button"
                onClick={() => setField("notes", chipText)}
                style={{
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  padding: "2px 8px",
                  fontSize: 10.5,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.accent;
                  e.currentTarget.style.borderColor = C.accentBorder;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.muted;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                {chipText}
              </button>
            ))}
          </div>
          <Input
            value={form.notes}
            onChange={(v) => setField("notes", v)}
            placeholder="Ej: transferencia desde banco BBVA · click chip para auto-llenar"
          />
        </FormSection>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2"
            style={{
              backgroundColor: "rgba(248,113,113,0.08)",
              border: `1px solid rgba(248,113,113,0.30)`,
              color: C.red,
              padding: "8px 12px",
              fontSize: 11.5,
              marginBottom: 14,
              fontFamily: "'Roboto', sans-serif",
            }}
          >
            <AlertTriangle size={12} strokeWidth={1.8} />
            <span>{error}</span>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2" style={{ marginTop: 20 }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              padding: "9px 14px",
              fontSize: 12.5,
              fontFamily: "'Roboto', sans-serif",
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formIsValid || submitting}
            style={{
              flex: 1,
              backgroundColor: formIsValid ? C.accent : C.border,
              color: formIsValid ? C.bg : C.dim,
              border: "none",
              padding: "9px 14px",
              fontSize: 12.5,
              fontFamily: "'Roboto', sans-serif",
              fontWeight: 600,
              cursor: (!formIsValid || submitting) ? "default" : "pointer",
              opacity: (!formIsValid || submitting) ? 0.7 : 1,
              transition: "opacity 120ms ease",
            }}
          >
            {submitting
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : (isDeposit ? "Confirmar ingreso" : "Confirmar retiro")}
          </button>
        </div>
      </div>
    </>
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


/* ─────────────── Modal: confirmar borrado de cash movement ───────────────
 *
 * Variante de DeleteConfirmModal específica para movimientos de efectivo
 * manuales (deposit / withdrawal). Solo se muestra para movements MANUALES
 * — los automáticos (sale_proceeds, purchase_cost) NO tienen UI de delete
 * porque viven asociados a una position y se borran en cascade al borrar
 * la position original.
 */
function DeleteCashMovementModal({ movement, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  const isDeposit = movement.movement_type === "deposit";
  const tipoLabel = isDeposit ? "ingreso" : "retiro";

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
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
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
            Borrar movimiento
          </h3>
        </div>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          ¿Seguro querés borrar el {tipoLabel} de{" "}
          <strong style={{ color: C.text }}>
            {fmtCurrencyValue(Number(movement.amount), movement.currency === "ARS" ? "ARS" : "USD")} {movement.currency}
          </strong>
          {" "}del {fmtDateShort(movement.movement_date)}? El saldo se va a recalcular automáticamente. Esta acción no se puede deshacer.
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

  // Precios actualizados de bonos (BYMA + data912) — los usamos para
  // mejorar la sugerencia de moneda al cambiar de ticker. Si BYMA tiene
  // el ticker, su campo `currency` es la fuente de verdad. El hook
  // cachea en sessionStorage 5 min, así que abrir el drawer no dispara
  // un fetch adicional en el caso común.
  const { prices: bondPrices } = useBondPrices();

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
        settlement: editingPosition.settlement || "CI",
        notes: editingPosition.notes || "",
        // extra fields desde el JSONB
        rate_tna: editingPosition.extra?.rate_tna ?? "",
        term_days: editingPosition.extra?.term_days ?? "",
        strike: editingPosition.extra?.strike ?? "",
        expiry: editingPosition.extra?.expiry ?? "",
        option_type: editingPosition.extra?.option_type ?? "call",
        commission: editingPosition.extra?.commission ?? "",
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
      settlement: "CI",
      notes: "",
      rate_tna: "",
      term_days: "",
      strike: "",
      expiry: "",
      option_type: "call",
      commission: "",
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
        newTicker,
        bondPrices
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
    // Ticker: requerido excepto para cauciones (se auto-genera CAUC-DDMMM-NND).
    if (form.instrument_type !== "caucion" && !form.ticker.trim()) {
      errs.ticker = "Ticker requerido";
    }
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

    // Comisión (futuros): opcional, pero si está debe ser número >= 0.
    if (form.instrument_type === "future" && form.commission !== "" && form.commission != null) {
      const c = Number(form.commission);
      if (isNaN(c) || c < 0) {
        errs.commission = "Comisión inválida";
      }
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
    // Comisión: la guardamos en extra para que el handler externo
    // (PortfolioDashboard / LibroOperaciones) la procese y genere el
    // cash_movement separado. Sólo aplica a futuros nuevos.
    if (
      form.instrument_type === "future" &&
      !editingPosition &&
      form.commission !== "" &&
      form.commission != null
    ) {
      const c = Number(form.commission);
      if (Number.isFinite(c) && c > 0) {
        extra.commission = c;
      }
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

    // Ticker final: para cauciones, si el usuario lo dejó vacío,
    // auto-generamos CAUC-DDMMM-NND para que la posición tenga un label
    // legible en consolidación y reportes. Si tipeó algo, respetamos su
    // elección (típicamente para distinguir contrapartes: CAUC-COCOS-7D).
    let finalTicker = form.ticker.trim().toUpperCase();
    if (form.instrument_type === "caucion" && !finalTicker) {
      finalTicker = generateCaucionTicker(form.entry_date, Number(form.term_days));
    }

    const payload = {
      instrument_type: persistedType,
      operation_type: form.operation_type,
      ticker: finalTicker,
      quantity: Number(form.quantity),
      entry_price: meta.priceLabel != null && form.entry_price !== "" ? Number(form.entry_price) : null,
      entry_currency: form.entry_currency,
      entry_date: form.entry_date,
      settlement: form.settlement || "CI",
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

  // Validación derivada en cada render para deshabilitar el botón "Agregar
  // posición" mientras falten campos requeridos. NO setea errors[] (eso
  // sucede solo al hacer submit) — solo controla el disabled del botón.
  // De esta forma evitamos que el user llegue a apretar el botón con un
  // form incompleto: el ojo ve directamente que está deshabilitado.
  const formIsValid = Object.keys(validate()).length === 0;

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

          {/* Plazo de liquidación.
           *
           * CI = Contado Inmediato (mismo día, lo más común retail).
           * T1 = 24hs hábiles (dinero queda disponible al siguiente día hábil).
           *
           * Solo se muestra para tipos donde el plazo de liquidación
           * efectivamente impacta el cash (bonos, on, stocks, cedears).
           * Para futuros, opciones, cauciones, FCI no aplica el concepto
           * en esta primera versión y el campo se persiste como CI por
           * default sin afectar nada.
           */}
          {(form.instrument_type === "bond" ||
            form.instrument_type === "on" ||
            form.instrument_type === "stock" ||
            form.instrument_type === "cedear") && (
            <FormSection label="Plazo de liquidación">
              <div className="flex gap-2">
                <ToggleButton
                  active={form.settlement === "CI"}
                  onClick={() => setField("settlement", "CI")}
                >
                  CI
                </ToggleButton>
                <ToggleButton
                  active={form.settlement === "T1"}
                  onClick={() => setField("settlement", "T1")}
                >
                  24hs
                </ToggleButton>
              </div>
              <FieldHint>
                {form.settlement === "CI"
                  ? "El cash impacta el saldo el mismo día."
                  : "El cash impacta el saldo el día hábil siguiente."}
              </FieldHint>
            </FormSection>
          )}

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
            const result = getTickerOptions(
              form.instrument_type,
              form.ticker,
              instrumentCatalog,
            );
            if (result.mode === "select") {
              return (
                <FormSection label="Ticker" error={errors.ticker}>
                  <Select
                    value={form.ticker}
                    onChange={handleTickerChange}
                    placeholder="Elegí un ticker..."
                    groups={result.groups}
                    options={result.options}
                    hasError={Boolean(errors.ticker)}
                  />
                </FormSection>
              );
            }
            return (
              <FormSection
                label="Ticker"
                error={errors.ticker}
                hint={
                  form.instrument_type === "caucion"
                    ? "Opcional. Si lo dejás vacío, se genera automáticamente."
                    : undefined
                }
              >
                <Input
                  value={form.ticker}
                  onChange={(v) => handleTickerChange(v.toUpperCase())}
                  placeholder={
                    form.instrument_type === "stock" ? "GGAL, YPF, ALUA..." :
                    form.instrument_type === "cedear" ? "AAPL, MSFT, NVDA..." :
                    form.instrument_type === "caucion" ? (
                      form.entry_date && form.term_days
                        ? generateCaucionTicker(form.entry_date, Number(form.term_days))
                        : "Auto (opcional)"
                    ) :
                    "Código del instrumento"
                  }
                  hasError={Boolean(errors.ticker)}
                />
              </FormSection>
            );
          })()}

          {/* Cantidad */}
          <FormSection label={meta.quantityLabel} error={errors.quantity} hint={meta.quantityHint}>
            <MoneyInput
              value={form.quantity}
              onChange={(v) => setField("quantity", v)}
              placeholder={meta.integerQuantity ? "Entero" : "0,00"}
              hasError={Boolean(errors.quantity)}
            />
          </FormSection>

          {/* Precio (solo si aplica) */}
          {meta.priceLabel && (
            <FormSection label={meta.priceLabel} error={errors.entry_price} hint={meta.priceHint}>
              <MoneyInput
                value={form.entry_price}
                onChange={(v) => setField("entry_price", v)}
                placeholder="0,00"
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
              form.ticker,
              bondPrices
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
            <>
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

              {/* Preview en vivo del monto al vencimiento.
               *
               * Se calcula como capital × (1 + TNA × días / 365). Solo
               * aparece cuando todos los inputs son válidos — sino sería
               * ruido. Da al usuario una sanity check rápida antes de
               * guardar: si esperaba ~5,03M y el preview dice ~50M, sabe
               * que tipeó mal alguna unidad.
               *
               * El verbo cambia según operation_type:
               *   - buy / Colocar → "Cobrarás" (prestás y al vencer cobrás capital + intereses)
               *   - sell / Tomar  → "Pagarás" (te prestan y al vencer devolvés capital + intereses)
               */}
              {(() => {
                const capital = Number(form.quantity);
                const tna = Number(form.rate_tna);
                const termDays = Number(form.term_days);
                if (
                  !Number.isFinite(capital) || capital <= 0 ||
                  !Number.isFinite(tna) || tna < 0 ||
                  !Number.isFinite(termDays) || termDays <= 0 ||
                  !form.entry_date
                ) {
                  return null;
                }
                const totalAtMaturity = capital * (1 + (tna / 100) * (termDays / 365));
                const intereses = totalAtMaturity - capital;
                const start = new Date(form.entry_date + "T00:00:00");
                const maturity = new Date(start.getTime() + termDays * 86400000);
                const maturityStr = maturity.toLocaleDateString("es-AR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                });
                const ccy = form.entry_currency || "ARS";
                const isTomar = form.operation_type === "sell";
                const verbLabel = isTomar ? "Pagarás al vencimiento" : "Cobrarás al vencimiento";
                const interesLabel = isTomar ? "Costo intereses" : "Intereses";
                const borderRgba = isTomar
                  ? "rgba(248,113,113,0.20)"
                  : "rgba(56,189,248,0.20)";
                const bgRgba = isTomar
                  ? "rgba(248,113,113,0.06)"
                  : "rgba(56,189,248,0.06)";
                return (
                  <div
                    style={{
                      backgroundColor: bgRgba,
                      border: `1px solid ${borderRgba}`,
                      padding: "10px 12px",
                      marginBottom: 16,
                      fontSize: 12,
                      color: C.text,
                      letterSpacing: "0.01em",
                    }}
                  >
                    <div style={{ color: C.muted, fontSize: 10.5, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
                      {verbLabel}
                    </div>
                    <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 14, fontWeight: 500 }}>
                      {fmtCurrencyValue(totalAtMaturity, ccy === "ARS" ? "ARS" : "USD")}
                    </div>
                    <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>
                      {interesLabel}: {fmtCurrencyValue(intereses, ccy === "ARS" ? "ARS" : "USD")} · Vence el {maturityStr}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Campos extra: futuro
           *
           * El campo "Comisión" es opcional. Si el usuario lo completa,
           * generamos un cash_movement adicional de tipo purchase_cost
           * por ese monto (con related_position_id apuntando a esta
           * position). La fecha del movement es T+1 hábil porque los
           * brokers (Cocos, Balanz, IOL) liquidan comisiones de
           * derivados al día hábil siguiente a la operación.
           *
           * Solo aparece al CREAR position de futuro. Al editar, lo
           * ocultamos para evitar duplicar movements: si el user quiere
           * editar la comisión de una position existente, lo hace
           * directamente en el cash_movement desde el libro de
           * operaciones.
           *
           * Cartel siempre visible (cuando hay cantidad+precio válidos):
           *   - Sin valor tipeado → "Posible comisión" + monto sugerido
           *     según tarifa A3 + botón "Usar este valor" para auto-
           *     llenar el input.
           *   - Con valor tipeado → "Comisión a descontar" + monto del
           *     usuario + fecha T+1 efectiva del débito.
           * Todo se recalcula en vivo al cambiar ticker / cantidad /
           * precio / fecha.
           */}
          {form.instrument_type === "future" && !editingPosition && (
            <FormSection
              label="Comisión (opcional)"
              error={errors.commission}
              hint="Derechos de mercado + IVA · se descuenta T+1"
            >
              <Input
                type="number"
                value={form.commission}
                onChange={(v) => setField("commission", v)}
                placeholder="0,00"
                step="any"
                hasError={Boolean(errors.commission)}
              />
              {(() => {
                const userCommission = Number(form.commission);
                const hasUserCommission =
                  Number.isFinite(userCommission) && userCommission > 0;

                const suggested = calcSuggestedFutureCommission(
                  form.ticker, form.quantity, form.entry_price
                );

                // No mostramos cartel si no hay sugerido posible Y el
                // user tampoco tipeó nada — sería ruido vacío.
                if (!hasUserCommission && suggested == null) return null;

                const displayAmount = hasUserCommission ? userCommission : suggested;
                const ccy = form.entry_currency || "ARS";
                const title = hasUserCommission
                  ? "Comisión a descontar"
                  : "Posible comisión";

                // Calcular T+1 hábil para mostrar al usuario la fecha
                // efectiva del débito (solo si tipeó algo: si no, es
                // estimación de referencia y no nos comprometemos con
                // una fecha).
                let dtStr = null;
                if (hasUserCommission && form.entry_date) {
                  const start = new Date(form.entry_date + "T00:00:00");
                  const dt = new Date(start);
                  dt.setDate(dt.getDate() + 1);
                  while (dt.getDay() === 0 || dt.getDay() === 6) {
                    dt.setDate(dt.getDate() + 1);
                  }
                  dtStr = dt.toLocaleDateString("es-AR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  });
                }

                return (
                  <div
                    style={{
                      backgroundColor: "rgba(248,113,113,0.06)",
                      border: `1px solid rgba(248,113,113,0.20)`,
                      padding: "8px 12px",
                      marginTop: 8,
                      fontSize: 11.5,
                      color: C.text,
                      letterSpacing: "0.01em",
                    }}
                  >
                    <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 3, fontWeight: 600 }}>
                      {title}
                    </div>
                    <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 13, fontWeight: 500 }}>
                      {fmtCurrencyValue(displayAmount, ccy === "ARS" ? "ARS" : "USD")}
                    </div>
                    {hasUserCommission ? (
                      <div style={{ color: C.dim, fontSize: 10.5, marginTop: 3 }}>
                        Se debita el {dtStr} (T+1 hábil)
                      </div>
                    ) : (
                      <>
                        <div style={{ color: C.dim, fontSize: 10.5, marginTop: 3 }}>
                          Estimación según tarifa A3 Mercados
                        </div>
                        <button
                          type="button"
                          onClick={() => setField("commission", suggested.toFixed(2))}
                          style={{
                            backgroundColor: "transparent",
                            border: `1px solid ${C.border}`,
                            color: C.accent,
                            padding: "3px 10px",
                            fontSize: 10.5,
                            cursor: "pointer",
                            letterSpacing: "0.04em",
                            marginTop: 6,
                            transition: "all 100ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = C.accentBorder;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = C.border;
                          }}
                        >
                          Usar este valor
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
            </FormSection>
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
              disabled={submitting || !formIsValid}
              title={!formIsValid ? "Completá los campos requeridos" : undefined}
              style={{
                backgroundColor: C.accent,
                color: C.bg,
                border: "none",
                padding: "9px 18px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: (submitting || !formIsValid) ? "not-allowed" : "pointer",
                fontFamily: "'Roboto', sans-serif",
                opacity: (submitting || !formIsValid) ? 0.5 : 1,
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

/**
 * Input numérico con máscara de separadores de miles formato es-AR.
 *
 * UX:
 *   - Mientras está focuseado: muestra el número "raw" (sin puntos de miles)
 *     para que sea fácil editar tipeando dígitos. La coma decimal se
 *     mantiene visible.
 *   - Al perder foco: formatea con puntos de miles. Ej: tipear "1500000"
 *     y al blur ver "1.500.000". Tipear "1500000,75" → "1.500.000,75".
 *   - Acepta tanto coma como punto como separador decimal (lo que escriba
 *     el user) y los normaliza internamente.
 *
 * Hacia afuera (onChange) emite un STRING numérico estándar JS con punto
 * decimal: "1500000.75". El form lo guarda así y se persiste como Number
 * al hacer submit. No hay regreso a "string formateado" en el state — la
 * máscara es 100% visual.
 *
 * Limitaciones:
 *   - No soporta exponentes (1e6).
 *   - Negativos sí, pero raramente aplica para precios.
 */
function MoneyInput({ value, onChange, placeholder, hasError }) {
  const [focused, setFocused] = useState(false);

  // Convierte un raw del usuario (con coma o punto, con o sin miles) al
  // formato "JS number string": dígitos + opcionalmente "." y decimales.
  // Ej: "1.500.000,75" → "1500000.75"
  //     "1500000,75"   → "1500000.75"
  //     "1500000"      → "1500000"
  //     "1.500"        → "1500"  (interpretamos como miles, NO como decimal)
  // La regla "punto = miles" es típica es-AR; si el user querría decimal
  // con punto debería usar coma. (Compromise: si solo hay un punto y NO
  // hay coma y los dígitos después tienen 1-2, lo tratamos como decimal
  // tipo "65.74". Esto se discute al final del comentario.)
  const sanitizeRaw = (input) => {
    if (input == null) return "";
    let s = String(input).trim();
    if (!s) return "";

    // Permitir signo negativo al inicio
    let sign = "";
    if (s.startsWith("-")) {
      sign = "-";
      s = s.slice(1);
    }

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma) {
      // Convención es-AR: coma = decimal, puntos = miles. Quitar puntos.
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasDot) {
      // Sin coma. Si hay UN solo punto y los dígitos después son 1-2,
      // probablemente sea decimal estilo en-US ("65.74"). Si hay varios
      // puntos o muchos dígitos después, son miles ("1.500.000").
      const parts = s.split(".");
      const lastPart = parts[parts.length - 1];
      if (parts.length === 2 && lastPart.length >= 1 && lastPart.length <= 4) {
        // Tratamos como decimal (no tocar)
      } else {
        // Tratamos como miles → quitar todos los puntos
        s = s.replace(/\./g, "");
      }
    }

    // Solo dígitos y punto decimal
    s = s.replace(/[^\d.]/g, "");
    return sign + s;
  };

  // Formatea un valor numérico (string o number) a "1.500.000,75"
  const formatWithMask = (numStr) => {
    if (numStr === "" || numStr == null) return "";
    const n = Number(numStr);
    if (isNaN(n)) return String(numStr);

    // Detectar decimales reales para preservarlos
    const str = String(numStr);
    const dotIdx = str.indexOf(".");
    const realDecimals = dotIdx === -1 ? 0 : str.length - dotIdx - 1;

    return n.toLocaleString("es-AR", {
      minimumFractionDigits: realDecimals,
      maximumFractionDigits: Math.max(realDecimals, 0),
      useGrouping: true,
    });
  };

  // Display:
  //   - Focused: mostrar el raw "1500000.75" pero con coma local "1500000,75"
  //   - Blurred: mostrar formato completo "1.500.000,75"
  const displayValue = (() => {
    if (value === "" || value == null) return "";
    if (focused) {
      // Reemplazo del separador decimal a coma para que el usuario pueda
      // seguir escribiendo en formato es-AR.
      return String(value).replace(".", ",");
    }
    return formatWithMask(value);
  })();

  const handleChange = (e) => {
    const raw = sanitizeRaw(e.target.value);
    onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        backgroundColor: C.deep,
        border: `1px solid ${hasError ? C.red : C.border}`,
        color: C.text,
        padding: "9px 12px",
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', monospace",
        outline: "none",
        transition: "border-color 120ms ease",
      }}
      onFocus={(e) => {
        setFocused(true);
        if (!hasError) e.currentTarget.style.borderColor = C.accent;
      }}
      onBlur={(e) => {
        setFocused(false);
        if (!hasError) e.currentTarget.style.borderColor = C.border;
      }}
    />
  );
}

/**
 * Select nativo con soporte opcional para `<optgroup>`.
 *
 * Modo plano (legacy):
 *   <Select options={[{value, label}, ...]} />
 *
 * Modo agrupado:
 *   <Select groups={[{ label: "Grupo A", options: [{value, label}, ...] }, ...]} />
 *
 * Cuando se pasa `groups` se ignora `options` (excepto para una opción
 * placeholder al inicio que el caller puede pasar como `placeholder`).
 */
function Select({ value, onChange, options, groups, placeholder, hasError, disabled }) {
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
      {/* Placeholder opcional al inicio (ej: "Elegí un ticker...") */}
      {placeholder && (
        <option value="">{placeholder}</option>
      )}

      {/* Modo agrupado: cada group renderiza un <optgroup> */}
      {groups && groups.length > 0 && groups.map((g, idx) => (
        <optgroup key={`grp_${idx}_${g.label}`} label={g.label}>
          {g.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </optgroup>
      ))}

      {/* Modo plano: lista directa de options. Si vino tanto groups como
          options, options solo se renderiza si NO hay groups. */}
      {(!groups || groups.length === 0) && options && options.map((opt) => (
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
        const r = await fetch("/api/cripto?type=usdt");
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
        const r = await fetch("/api/cripto?type=usdc");
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

      {/* Footer estandarizado (componente compartido). */}
      <DataSourcesFooter
        lastUpdated={lastFetch}
        intervalMode={intervalMode}
        activeIntervalLabel="15 min"
        marginTop={20}
      />
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
        fetch("/api/data912?type=bonos"),
        fetch("/api/data912?type=letras"),
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
        const remRes = await fetch("/api/bcra-rem?type=tipo_cambio");
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
        const ipcRes = await fetch("/api/bcra-rem?type=ipc");
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

      {/* Footer estandarizado (componente compartido con Portfolio
          y Cotizaciones Dólar). Mostramos las fuentes globales de la
          plataforma, no solo las de este módulo, por transparencia.
          Carry Trade refresca cada 15 min en horario activo (no 5 min
          como Portfolio — sus datos no son tan time-sensitive). */}
      <DataSourcesFooter
        lastUpdated={lastFetch}
        intervalMode={intervalMode}
        activeIntervalLabel="15 min"
        marginTop={28}
      />

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
        const remRes = await fetch("/api/bcra-rem?type=tipo_cambio");
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

      {/* Footer estandarizado (componente compartido). */}
      <DataSourcesFooter
        lastUpdated={lastFetch}
        intervalMode={intervalMode}
        activeIntervalLabel="15 min"
        marginTop={28}
      />
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
