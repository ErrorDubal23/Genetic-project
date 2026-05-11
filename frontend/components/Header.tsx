"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

const NAV = [
  { label: "GitHub",        href: "https://github.com/ErrorDubal23/Genetic-project", ext: true },
  { label: "Documentación", href: "#", ext: false },
  { label: "Informe",       href: "#", ext: false },
  { label: "Demo",          href: "#demo", ext: false },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        background: scrolled ? "rgba(5,5,5,0.72)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            {/* Logo real si existe, SVG fallback si no */}
            <Image
              src="/logo.png"
              alt="CircleGA"
              fill
              className="object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fb = e.currentTarget.parentElement?.querySelector(".logo-fallback") as HTMLElement | null;
                if (fb) fb.style.display = "block";
              }}
            />
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="logo-fallback w-full h-full"
              aria-hidden
            >
              <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.85)" strokeWidth="1" />
              <circle cx="16" cy="16" r="5.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeDasharray="2.5 2.5" />
              <circle cx="16" cy="16" r="1.8" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-wide" style={{ fontFamily: "var(--font-sans)" }}>
              CircleGA
            </div>
            <div className="text-[10px] hidden sm:block" style={{ color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-mono)" }}>
              genetic · vision
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {NAV.map(({ label, href, ext }) => (
            <a
              key={label}
              href={href}
              {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="px-3 py-1.5 text-xs rounded transition-all duration-200 hover:bg-white/[0.05]"
              style={{ color: "rgba(255,255,255,0.32)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.32)")}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
