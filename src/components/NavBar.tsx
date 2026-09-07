import { Link, useLocation } from "react-router-dom";

export function NavBar() {
  const loc = useLocation();
  const path = loc.pathname;
  const items = [
    { to: "/dashboard", label: "Home", ico: "🏠" },
    { to: "/history", label: "Activity", ico: "📊" },
    { to: "/earn", label: "Earn", ico: "💪" },
    { to: "/use", label: "Use", ico: "📱" },
    { to: "/settings", label: "Settings", ico: "⚙️" },
  ];
  return (
    <nav className="nav">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={path.startsWith(it.to) ? "active" : ""}
        >
          <span className="ico">{it.ico}</span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}