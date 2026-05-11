"use client";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { label: "GitHub", href: "https://github.com/ErrorDubal23/Genetic-project", ext: true },
  { label: "Demo",   href: "#demo", ext: false },
];

const EQUIPO = [
  "Dubal Aguilar Torres",
  "Carlos Calabria Patiño",
  "Alejandro Chaves Ramos",
  "Santiago Solorzano Diaz",
];

export default function Header() {
  const [scrolled,      setScrolled]      = useState(false);
  const [mostrarEquipo, setMostrarEquipo] = useState(false);
  const equipoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cerrar el panel de equipo al hacer clic fuera
  useEffect(() => {
    if (!mostrarEquipo) return;
    const handler = (e: MouseEvent) => {
      if (equipoRef.current && !equipoRef.current.contains(e.target as Node)) {
        setMostrarEquipo(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mostrarEquipo]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        backdropFilter:       scrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        background:    scrolled ? "rgba(5,5,5,0.72)" : "transparent",
        borderBottom:  scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">

        {/* Branding */}
        <div className="flex items-center gap-2">
          <div
            className="text-[17px] font-bold tracking-wide"
            style={{ fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.9)" }}
          >
            CircleGA
          </div>
          <div
            className="hidden sm:block text-[10px]"
            style={{ color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-mono)" }}
          >
             · 
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
              style={{ color: "rgba(255,255,255,0.32)", fontFamily: "var(--font-sans)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.32)")}
            >
              {label}
            </a>
          ))}

          {/* Botón Creadores con panel desplegable */}
          <div ref={equipoRef} className="relative">
            <button
              onClick={() => setMostrarEquipo((v) => !v)}
              className="px-3 py-1.5 text-xs rounded transition-all duration-200 hover:bg-white/[0.05]"
              style={{
                color: mostrarEquipo ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.32)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              Creadores
            </button>

            {mostrarEquipo && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl"
                style={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,0.09)",
                  padding: "16px 20px",
                  minWidth: 260,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                }}
              >
                {/* Materia */}
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Algoritmos y Complejidad · 5° Semestre
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
                  Universidad del Norte
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", marginBottom: 14 }}>
                  Prof. Esmeide Leal Narvaez
                </div>

                {/* Integrantes */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {EQUIPO.map((nombre) => (
                    <div key={nombre} style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)" }}>
                      {nombre}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
