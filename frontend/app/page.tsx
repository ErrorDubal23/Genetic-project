"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "@/components/ParticleBackground";
import Header              from "@/components/Header";
import TerminalPanel       from "@/components/TerminalPanel";
import DropZone            from "@/components/DropZone";
import ParamsPanel, { GAParams, DEFAULT_PARAMS } from "@/components/ParamsPanel";
import ResultPanel         from "@/components/ResultPanel";

// Variantes reutilizables
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fadeUp = (delay = 0) => ({
  initial:     { opacity: 0, y: 28, filter: "blur(4px)" },
  whileInView: { opacity: 1,  y: 0,  filter: "blur(0px)" },
  viewport:    { once: true },
  transition:  { duration: 0.75, ease: EASE, delay },
});

interface DetectResult {
  circles:             { x: number; y: number; r: number }[];
  count:               number;
  avg_error:           number;
  fitness:             number;
  annotated_image_b64: string;
}

type Phase = "idle" | "loading" | "result" | "error";

export default function Home() {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [params,   setParams]   = useState<GAParams>(DEFAULT_PARAMS);
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [result,   setResult]   = useState<DetectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setPhase("idle");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const run = async () => {
    if (!file) return;
    setPhase("loading");
    setResult(null);
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("image", file);
    fd.append("params", JSON.stringify(params));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/detect`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Error desconocido");
      }
      setResult(await res.json());
      setPhase("result");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error de red");
      setPhase("error");
    }
  };

  const loading = phase === "loading";

  const labelStyle = { fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" };

  return (
    <>
      <ParticleBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6" style={{ paddingTop: 96, paddingBottom: 80 }}>

        {/* ── Hero ── */}
        <div className="mb-14">
          <motion.h1
            className="font-semibold leading-tight"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", marginBottom: 12 }}
            initial={{ opacity: 0, y: 36, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            Detección de Círculos
            <br />
            <motion.span
              style={{ color: "rgba(255,255,255,0.28)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
            >
              mediante Algoritmos Genéticos
            </motion.span>
          </motion.h1>

          <motion.p
            style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.55 }}
          >
            Evolución computacional aplicada a visión artificial &nbsp;·&nbsp; Ayala-Ramírez et al.,{" "}
            <em>Pattern Recognition Letters</em> 27 (2006) 652–657
            &nbsp;·&nbsp;{" "}
            <motion.a
              href="https://www.researchgate.net/publication/269338225_Circle_detection_on_images_based_on_the_Clonal_Selection_Algorithm_CSA"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
              whileHover={{ color: "rgba(255,255,255,0.9)" }}
              transition={{ duration: 0.15 }}
            >
              ver investigación →
            </motion.a>
          </motion.p>
        </div>

        {/* ── Two-column layout ── */}
        <div id="demo" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">

          {/* Left — Terminal: entra desde la izquierda */}
          <motion.div
            initial={{ opacity: 0, x: -30, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <div style={labelStyle}>implementación</div>
            <TerminalPanel
              loading={loading}
              maxGenerations={params.max_generations}
              populationSize={params.population_size}
              mutationProb={params.mutation_prob}
              result={result}
            />
          </motion.div>

          {/* Right — Upload: entra desde la derecha */}
          <motion.div
            className="flex flex-col gap-5"
            initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.12 }}
          >
            <div>
              <div style={labelStyle}>imagen de entrada</div>
              <DropZone onFile={handleFile} preview={preview} loading={loading} />
            </div>

            {/* Botón Ejecutar GA con animación shimmer */}
            <motion.button
              onClick={run}
              disabled={!file || loading}
              className="w-full rounded-xl py-3 text-sm font-medium relative overflow-hidden"
              style={{
                border: `1px solid ${file && !loading ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                color:  file && !loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                background: file && !loading ? "rgba(255,255,255,0.04)" : "transparent",
                cursor: !file || loading ? "not-allowed" : "pointer",
                letterSpacing: "0.05em",
                fontFamily: "var(--font-sans)",
              }}
              whileHover={file && !loading ? { scale: 1.01, borderColor: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)" } : {}}
              whileTap={file && !loading ? { scale: 0.99 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              {/* Shimmer cuando está listo */}
              {file && !loading && (
                <motion.span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                />
              )}
              {loading ? "Ejecutando…" : "Ejecutar GA"}
            </motion.button>
          </motion.div>
        </div>

        {/* ── Params panel ── */}
        <motion.div
          className="mt-6"
          {...fadeUp(0.05)}
        >
          <div style={labelStyle}>configuración</div>
          <ParamsPanel params={params} onChange={setParams} disabled={loading} />
        </motion.div>

        {/* ── Result section con AnimatePresence ── */}
        <AnimatePresence>
          {(phase === "result" || phase === "error" || loading) && (
            <motion.div
              key="result-section"
              className="mt-10"
              initial={{ opacity: 0, y: -16, scaleY: 0.97 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -12, scaleY: 0.98 }}
              style={{ transformOrigin: "top" }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={labelStyle}>resultado</div>
              <ResultPanel
                result={result}
                error={phase === "error" ? errorMsg : null}
                loading={loading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer ── */}
        <motion.footer
          className="mt-20 pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6">

            <motion.a
              href="https://github.com/ErrorDubal23/Genetic-project"
              target="_blank" rel="noopener noreferrer"
              style={{ color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              whileHover={{ color: "rgba(255,255,255,0.8)" }}
              transition={{ duration: 0.2 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>Genetic-project</span>
            </motion.a>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Algoritmos y Complejidad · 5° Semestre
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}>
                Universidad del Norte · Prof. Esmeide Leal Narvaez
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {["Dubal Aguilar Torres", "Carlos Calabria Patiño", "Alejandro Chaves Ramos", "Santiago Solorzano Diaz"].map((n) => (
                <div key={n} style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>{n}</div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", fontFamily: "var(--font-mono)" }}>
              Python · FastAPI · OpenCV · Next.js 14 · Tailwind CSS
            </div>
          </div>
        </motion.footer>
      </main>
    </>
  );
}
