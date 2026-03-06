import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TestTube,
  Database,
  ScrollText,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tester", icon: TestTube, label: "API Tester" },
  { to: "/cache", icon: Database, label: "Cache" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-base-dark overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-base-bg border-r border-white/10 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <Zap className="w-6 h-6 text-primary-500 mr-2" />
          <h1 className="text-lg font-bold text-base-white">
            KomikVerse <span className="text-primary-500">API</span>
          </h1>
          <button
            className="ml-auto lg:hidden text-general-300 hover:text-base-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary-500/10 text-primary-500 border border-primary-500/20"
                    : "text-general-300 hover:text-base-white hover:bg-base-card/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-general-300">
            <div>Provider: shinigami.asia</div>
            <div className="mt-1">API Port: 3001</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center px-6 border-b border-white/10 bg-base-bg/50 backdrop-blur">
          <button
            className="lg:hidden text-general-300 hover:text-base-white mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-sm text-general-300">
            Backend:{" "}
            <span className="text-primary-500 font-medium">
              http://localhost:3001
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
