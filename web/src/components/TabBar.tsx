import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useShunt } from "../store";

const TABS = [
  { to: "/home", label: "Home", icon: "ph-house" },
  { to: "/shunt", label: "Shunt", icon: "ph-arrows-split" },
  { to: "/savings", label: "Savings", icon: "ph-vault" },
  { to: "/activity", label: "Activity", icon: "ph-receipt" },
];

/** Savings keeps its richer vault screen; every other lane → its detail. */
const laneHref = (id: string) => (id === "savings" ? "/savings" : `/lane/${id}`);

/** Bottom tab bar (mobile) + left nav rail (desktop >=1024px, DESIGN.md §3). */
export function TabBar() {
  const buckets = useShunt((s) => s.buckets);
  const [lanesOpen, setLanesOpen] = useState(true);

  return (
    <>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}>
            {({ isActive }: { isActive: boolean }) => (
              <>
                <i className={`${isActive ? "ph-fill" : "ph"} ${t.icon}`} style={{ fontSize: 21 }} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <nav className="nav-rail" style={{ padding: "16px 14px", gap: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 22,
              fontWeight: 700,
              padding: "8px 16px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i className="ph-fill ph-arrows-split" style={{ color: "var(--color-accent-primary)" }} />
            Shunt
          </div>
          {TABS.filter((t) => t.to !== "/savings").map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <i className={`${isActive ? "ph-fill" : "ph"} ${t.icon}`} style={{ fontSize: 18 }} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
          
          {/* Lanes submenu — each allocation category (incl. custom) is its own
              menu item, so navigating to a lane's detail never routes through the
              allocation editor. */}
          <button 
            className="rail-group-label" 
            onClick={() => setLanesOpen(!lanesOpen)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Lanes
            <i className={`ph ph-caret-${lanesOpen ? 'up' : 'down'}`} style={{ fontSize: 14 }} />
          </button>
          
          {lanesOpen && buckets.map((b) => (
            <NavLink key={b.id} to={laneHref(b.id)} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
              <span aria-hidden className="rail-lane-dot" style={{ background: b.color }} />
              {b.name}
            </NavLink>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #1f2732", paddingTop: 16, marginTop: 8 }}>
          <NavLink to="/settings" className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
            {({ isActive }: { isActive: boolean }) => (
              <>
                <i className={isActive ? "ph-fill ph-gear" : "ph ph-gear"} style={{ fontSize: 18 }} />
                Settings
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </>
  );
}
