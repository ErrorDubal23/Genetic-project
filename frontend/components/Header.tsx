"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const IconGitHub = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const IconPlay = () => (
  <svg width="9" height="10" viewBox="0 0 10 12" fill="currentColor">
    <polygon points="0 0 10 6 0 12" />
  </svg>
);

const IconPersona = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const NAV = [
  { label: "GitHub", href: "https://github.com/ErrorDubal23/Genetic-project", ext: true,  Icon: IconGitHub  },
  { label: "Demo",   href: "#demo",                                            ext: false, Icon: IconPlay    },
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
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        backdropFilter:       scrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        background:    scrolled ? "rgba(5,5,5,0.82)" : "transparent",
        borderBottom:  scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">

        {/* Branding */}
        <motion.div
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <div className="text-[21px] font-bold tracking-wide" style={{ fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.9)" }}>
            CircleGA
          </div>
          <div className="hidden sm:block text-[10px]" style={{ color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-mono)" }}>
            genetic · vision
          </div>
        </motion.div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {NAV.map(({ label, href, ext, Icon }) => (
            <motion.a
              key={label}
              href={href}
              {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="px-4 py-2 text-sm rounded flex items-center gap-2"
              style={{ color: "rgba(255,255,255,0.32)", fontFamily: "var(--font-sans)" }}
              whileHover={{ color: "rgba(255,255,255,0.9)", backgroundColor: "rgba(255,255,255,0.05)" }}
              transition={{ duration: 0.15 }}
            >
              <motion.span
                style={{ display: "flex", opacity: 0.6 }}
                whileHover={{ opacity: 1, scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Icon />
              </motion.span>
              {label}
            </motion.a>
          ))}

          {/* Botón Creadores */}
          <div ref={equipoRef} className="relative">
            <motion.button
              onClick={() => setMostrarEquipo((v) => !v)}
              className="px-4 py-2 text-sm rounded flex items-center gap-2"
              style={{
                color: mostrarEquipo ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.32)",
                background: mostrarEquipo ? "rgba(255,255,255,0.05)" : "none",
                border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
              }}
              whileHover={{ color: "rgba(255,255,255,0.9)", backgroundColor: "rgba(255,255,255,0.05)" }}
              transition={{ duration: 0.15 }}
            >
              <motion.span
                style={{ display: "flex", opacity: 0.6 }}
                whileHover={{ opacity: 1, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <IconPersona />
              </motion.span>
              Creadores
            </motion.button>

            <AnimatePresence>
              {mostrarEquipo && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0,  scale: 1    }}
                  exit  ={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-2 rounded-xl"
                  style={{
                    background: "rgba(8,8,8,0.96)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    padding: "16px 20px",
                    minWidth: 260,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    backdropFilter: "blur(24px)",
                  }}
                >
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    Algoritmos y Complejidad · 5° Semestre
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>Universidad del Norte</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", marginBottom: 14 }}>Prof. Esmeide Leal Narvaez</div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {EQUIPO.map((nombre, i) => (
                      <motion.div
                        key={nombre}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.25, ease: "easeOut" }}
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)" }}
                      >
                        {nombre}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
