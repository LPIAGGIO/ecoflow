import { useState, useEffect } from "react";
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
  ArrowUp,
  ArrowDown,
} from "lucide-react";

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
                {active.replace(/-/g, " ")}
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
  return isWeekday && isMarketHours ? 60_000 : 30 * 60_000;
}

function isActiveMarketWindow() {
  return getRefreshIntervalMs() === 60_000;
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
  { id: "usdt", label: "USDT", accent: C.cat.emerald },
  { id: "usdc", label: "USDC", accent: C.cat.violet },
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
  const [stableTab, setStableTab] = useState("usdt");
  const [direction, setDirection] = useState("buy");
  const [usdData, setUsdData] = useState([]);
  const [stableData, setStableData] = useState({ usdt: [], usdc: [] });
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
      [...usdData, ...stableData.usdt, ...stableData.usdc].forEach((r) => {
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

      setUsdData(usdRows);
      setStableData({ usdt: usdtRows, usdc: usdcRows });
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

  const sortedStable = [...activeStable].sort((a, b) => {
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

  const isStale = lastFetch && (now - lastFetch) / 1000 > (intervalMode === "active" ? 90 : 1900);

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
      <div
        className="grid gap-3 mb-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        {enrichedUsd.map((row) => (
          <DolarTypeCard key={row.id} row={row} loading={loading} />
        ))}
      </div>

      {/* Brecha card */}
      <BrechaCard rows={brechaRows} loading={loading} />

      {/* Divider */}
      <div className="my-7" style={{ height: 1, backgroundColor: C.border }} />

      {/* Sección 2: STABLECOINS POR EXCHANGE */}
      <SectionLabel>Stablecoins por Exchange</SectionLabel>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <StableTabs value={stableTab} onChange={setStableTab} />
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
          {sortedStable.length} exchanges
        </span>
      </div>

      {/* 3 best cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <BestCard
          icon={ArrowDown}
          iconColor={C.cat.emerald}
          label="Mejor para Vender"
          provider={bestForSelling}
          priceLabel="Vendés a"
          priceField="buy"
          valueColor={C.green}
          accentTop={C.cat.emerald}
        />
        <BestCard
          icon={ArrowUp}
          iconColor={C.accent}
          label="Mejor para Comprar"
          provider={bestForBuying}
          priceLabel="Comprás a"
          priceField="sell"
          valueColor={C.accent}
          accentTop={C.accent}
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
        />
      </div>

      {/* Ranking card */}
      <RankingCard
        title="Ranking de Exchanges"
        subtitle={
          direction === "buy"
            ? "Ordenado por menor venta (te lo venden más barato)"
            : "Ordenado por mayor compra (te pagan más por venderlo)"
        }
        rows={sortedStable}
        loading={loading && sortedStable.length === 0}
        bestForBuying={bestForBuying}
        bestForSelling={bestForSelling}
        direction={direction}
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
          {intervalMode === "active" ? "60s · horario hábil" : "30 min · fuera de horario"}
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

function BestCard({ icon, iconColor, label, provider, priceLabel, priceField, valueColor, accentTop, isPercent }) {
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

          <div
            className="eco-mono mt-auto pt-2"
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

function RankingCard({ title, subtitle, rows, loading, bestForBuying, bestForSelling, direction, accentTop }) {
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
                <Th align="left">Exchange</Th>
                <Th align="right" emphasized={direction === "sell"}>Vendés a</Th>
                <Th align="right" emphasized={direction === "buy"}>Comprás a</Th>
                <Th align="right">Spread</Th>
                <Th align="right">Var</Th>
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
                      {row.spreadPct != null ? (
                        <span style={{ color: C.muted }}>{row.spreadPct.toFixed(2)}%</span>
                      ) : "—"}
                    </Td>
                    <Td align="right" mono>
                      {row.variation != null ? (
                        <span style={{ color: row.variation >= 0 ? C.green : C.red, fontWeight: 600 }}>
                          {fmtPct(row.variation)}
                        </span>
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

function Th({ children, align, emphasized, width }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align,
        fontSize: 9,
        color: emphasized ? C.accent : C.dim,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        fontWeight: 600,
        fontFamily: "'Roboto', sans-serif",
        width: width,
      }}
    >
      {children}
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
