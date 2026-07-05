import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/home", label: "Home", icon: "ph-house" },
  { to: "/shunt", label: "Shunt", icon: "ph-arrows-split" },
  { to: "/savings", label: "Savings", icon: "ph-vault" },
  { to: "/activity", label: "Activity", icon: "ph-receipt" },
];

/** Bottom tab bar (mobile) + left nav rail (desktop >=1024px, DESIGN.md §3). */
export function TabBar() {
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
      <nav className="nav-rail">
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 22,
            fontWeight: 700,
            padding: "0 16px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ph-fill ph-arrows-split" style={{ color: "var(--color-accent-primary)" }} />
          Shunt
        </div>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
            {({ isActive }: { isActive: boolean }) => (
              <>
                <i className={`${isActive ? "ph-fill" : "ph"} ${t.icon}`} style={{ fontSize: 18 }} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
        <NavLink to="/settings" className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
          {({ isActive }: { isActive: boolean }) => (
            <>
              <i className={isActive ? "ph-fill ph-gear" : "ph ph-gear"} style={{ fontSize: 18 }} />
              Settings
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
