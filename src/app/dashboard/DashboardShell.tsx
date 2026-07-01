"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "⚡" },
  { href: "/dashboard/profile", label: "Profile & Resume", icon: "👤" },
  { href: "/dashboard/hunts", label: "My Hunts", icon: "🎯" },
  { href: "/dashboard/applications", label: "Applications", icon: "📬" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({
  email,
  signOutSlot,
  children,
}: {
  email: string;
  signOutSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = (
    <nav className="flex-1 py-4 px-2 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive(pathname, item.href)
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <span>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="px-4 py-4 border-t border-gray-800 space-y-3">
      <div className="text-xs text-gray-500 truncate">{email}</div>
      {signOutSlot}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between h-14 px-4 bg-gray-900 border-b border-gray-800">
        <span className="text-lg font-bold text-white">Hunt</span>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 text-gray-300 hover:text-white"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer + backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 max-w-[80%] bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <span className="text-lg font-bold text-white">Hunt</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-1 -mr-1 text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {navLinks}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold text-white">Hunt</span>
        </div>
        {navLinks}
        {footer}
      </aside>

      {/* Main content — top padding clears the fixed header until md, where
          the header is hidden and the static sidebar takes over. */}
      <main className="flex-1 overflow-auto bg-gray-950 p-4 pt-20 sm:p-6 sm:pt-20 md:p-8">
        {children}
      </main>
    </div>
  );
}
