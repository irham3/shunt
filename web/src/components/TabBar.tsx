import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/home", label: "Home", icon: "⌂" },
  { to: "/shunt", label: "Shunt", icon: "⑃" },
  { to: "/savings", label: "Savings", icon: "◈" },
  { to: "/activity", label: "Activity", icon: "≣" },
];

/** Bottom tab bar (mobile) + left nav rail (desktop >=1024px, DESIGN.md §3). */
export function TabBar() {
  return (
    <>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <nav className="nav-rail">
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, padding: "0 16px 16px" }}>
          ⑃ Shunt
        </div>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <NavLink to="/settings" className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
          <span style={{ fontSize: 18 }}>⚙</span>
          Settings
        </NavLink>
      </nav>
    </>
  );
}
