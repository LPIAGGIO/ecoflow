import { useState, useEffect, useMemo } from "react";
import { resolveBond, daysToMaturity, shouldIgnoreTicker } from "./bondMaturities.js";
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
  Area,
  ComposedChart,
  Label,
} from "recharts";

const C = {
  // Base oscura (matching v2 screenshots)
  bg: "#0B1220",            // Workspace + navbar — dark navy base
  panel: "#131B2C",         // Sidebar + cards
  deep: "#080F1B",          // Inputs, elementos hundidos
  text: "#F1F5F9",          // Texto principal

  // Texto y bordes
  muted: "rgba(241, 245, 249, 0.58)",
  dim: "rgba(241, 245, 249, 0.34)",
  faint: "rgba(241, 245, 249, 0.10)",
  border: "rgba(241, 245, 249, 0.06)",
  borderStrong: "rgba(241, 245, 249, 0.13)",

  // Acento principal (cian — marca, estados activos, refresh)
  accent: "#38BDF8",
  accentSoft: "rgba(56, 189, 248, 0.10)",
  accentBorder: "rgba(56, 189, 248, 0.32)",
  accentGlow: "rgba(56, 189, 248, 0.18)",

  // Status (vibrantes, v2-style)
  red: "#F87171",
  green: "#4ADE80",
  yellow: "#FACC15",

  // Paleta categórica para bonos / tickers (lista para Módulos 2+)
  cat: {
    cyan: "#38BDF8",       // TX26
    emerald: "#34D399",    // TX28
    yellow: "#FACC15",     // T3X5
    pink: "#F472B6",       // DICP
    violet: "#A78BFA",     // S30J6
    orange: "#FB923C",     // S30S6
    teal: "#22D3EE",       // S31D6
    lime: "#A3E635",       // T15E7
    rose: "#FB7185",       // T30J7
    amber: "#FBBF24",      // reserva
    indigo: "#818CF8",     // reserva
  },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home, type: "single" },
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
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Raleway:wght@500;600;700;800&family=Roboto:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

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
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
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

        .eco-refresh-btn { transition: background-color 0.15s ease, border-color 0.15s ease; }
        .eco-refresh-btn:hover:not(:disabled) {
          background-color: rgba(56, 189, 248, 0.18);
          border-color: rgba(56, 189, 248, 0.45);
        }

        .eco-table-row:hover { background-color: rgba(241, 245, 249, 0.025); }

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
                fontFamily: "'Poppins', sans-serif",
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
                fontFamily: "'Poppins', sans-serif",
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
              <div
                className="eco-display"
                style={{
                  width: 30,
                  height: 30,
                  border: `1px solid ${C.borderStrong}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  letterSpacing: "0.10em",
                  fontWeight: 700,
                  color: C.text,
                  backgroundColor: C.panel,
                }}
              >
                EF
              </div>
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
                  fontFamily: "'Poppins', sans-serif",
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
    color: "#38BDF8",       // accent (cyan)
    soft: "rgba(56, 189, 248, 0.12)",
    border: "rgba(56, 189, 248, 0.45)",
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

      {/* Callout — explicación de la tabla EQ. */}
      <div
        className="flex items-start gap-2 mt-7 mb-3 px-4 py-3"
        style={{
          backgroundColor: "rgba(56, 189, 248, 0.04)",
          borderLeft: `2px solid ${C.accent}`,
        }}
      >
        <Info size={13} color={C.accent} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55, letterSpacing: "0.005em" }}>
          Las columnas <span style={{ color: C.text, fontWeight: 500 }}>EQ.</span> muestran el{" "}
          <span style={{ color: C.text, fontWeight: 500 }}>dólar de equilibrio</span>: el valor que tendría que
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
              <Th align="right">Eq. Oficial</Th>
              <Th align="right">Eq. MEP</Th>
              <Th align="right">Eq. Blue</Th>
              <Th align="right">Eq. CCL</Th>
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
 * Custom tooltip para el scatter
 */
function ScatterTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  if (!data.ticker) return null;
  return (
    <div
      style={{
        backgroundColor: C.deep,
        border: `1px solid ${C.border}`,
        padding: "8px 12px",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ color: typeColor(data.type), fontWeight: 700, marginBottom: 4 }}>
        {data.ticker}
        <span style={{ color: C.muted, marginLeft: 8, fontWeight: 400, fontSize: 10 }}>
          {typeLabel(data.type)}
        </span>
      </div>
      <div style={{ color: C.text }}>Dólar BE: ${fmtARS(data.y)}</div>
      <div style={{ color: C.muted, fontSize: 10 }}>
        Vto: {data.maturityDate} · {data.days}d
      </div>
    </div>
  );
}

/**
 * Componente principal del gráfico Dólar Breakeven
 */
function BreakevenChart({ bonds, fxRates, remIpc, loading }) {
  const mepNow = fxRates.mep;
  const [customMep, setCustomMep] = useState("");
  const [hoveredTicker, setHoveredTicker] = useState(null);

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
  const customMepNum = parseFloat(customMep.replace(",", "."));
  const effectiveMep = customMepNum > 0 ? customMepNum : mepNow;
  const usingCustom = customMepNum > 0;

  // Puntos del scatter: cada bono → { x: timestamp_vto, y: dolar_breakeven, ticker, ... }
  const scatterData = bonds.map((b) => ({
    x: isoToTimestamp(b.maturityDate),
    y: effectiveMep * (b.valorFinal / b.priceArs),
    ticker: b.ticker,
    type: b.type,
    days: b.days,
    maturityDate: b.maturityDate,
  }));

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
    const isHovered = hoveredTicker === payload.ticker;
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
          onMouseEnter={() => setHoveredTicker(payload.ticker)}
          onMouseLeave={() => setHoveredTicker(null)}
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
      <div style={{ width: "100%", height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 30, bottom: 30, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} opacity={0.4} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[today, maxX]}
              tickFormatter={(t) => {
                const d = new Date(t);
                return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
              }}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
            />
            <YAxis
              type="number"
              domain={yDomain}
              tickFormatter={(v) => `$${fmtARS(v)}`}
              stroke={C.muted}
              style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={{ stroke: C.border }}
              width={60}
            />
            <RechartsTooltip content={<ScatterTooltip />} cursor={{ stroke: C.muted, strokeDasharray: "3 3" }} />

            {/* Banda BCRA: techo */}
            <Area
              data={bandSeries}
              type="monotone"
              dataKey="ceiling"
              stroke={C.red}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="transparent"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Techo BCRA"
            />
            {/* Banda BCRA: piso */}
            <Area
              data={bandSeries}
              type="monotone"
              dataKey="floor"
              stroke={C.green}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="transparent"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Piso BCRA"
            />

            {/* Línea horizontal del MEP actual */}
            <ReferenceLine
              y={effectiveMep}
              stroke={C.cat.emerald}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              label={{
                value: usingCustom ? `MEP custom $${fmtARS(effectiveMep)}` : `MEP actual $${fmtARS(effectiveMep)}`,
                position: "right",
                fill: C.cat.emerald,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            />

            {/* Scatter de los bonos */}
            <Scatter data={scatterData} shape={renderDot} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
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
