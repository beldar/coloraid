"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/",
    label: "Studio",
    icon: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      </>
    ),
  },
  {
    href: "/palette",
    label: "Palette",
    icon: (
      <>
        <path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.3 1.2-2.2-.8-.9-.3-2.3 1-2.3H17a4 4 0 0 0 4-4c0-4.4-4-9.5-9-9.5Z" />
        <circle cx="7.5" cy="11" r="1" />
        <circle cx="12" cy="7.5" r="1" />
        <circle cx="16.5" cy="11" r="1" />
      </>
    ),
  },
  {
    href: "/mix",
    label: "Mix",
    icon: (
      <>
        <path d="M9 3h6M10 3v6L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" />
        <path d="M7.5 14h9" />
      </>
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Sections">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {l.icon}
            </svg>
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
