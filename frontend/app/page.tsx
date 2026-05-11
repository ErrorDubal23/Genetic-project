"use client";
import { useState, useCallback } from "react";
import ParticleBackground from "@/components/ParticleBackground";
import Header              from "@/components/Header";
import TerminalPanel       from "@/components/TerminalPanel";
import DropZone            from "@/components/DropZone";
import ParamsPanel, { GAParams, DEFAULT_PARAMS } from "@/components/ParamsPanel";
import ResultPanel         from "@/components/ResultPanel";

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

  return (
    <>
      <ParticleBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6" style={{ paddingTop: 96, paddingBottom: 80 }}>

        {/* ── Hero ── */}
        <div className="mb-14 anim-up" style={{ animationDelay: "0.1s" }}>
          <h1
            className="font-semibold leading-tight"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", marginBottom: 12 }}
          >
            Detección de Círculos
            <br />
            <span style={{ color: "rgba(255,255,255,0.28)" }}>mediante Algoritmos Genéticos</span>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>
            Evolución computacional aplicada a visión artificial &nbsp;·&nbsp; Ayala-Ramírez et al.,{" "}
            <em>Pattern Recognition Letters</em> 27 (2006) 652–657
            &nbsp;·&nbsp;{" "}
            <a
              href="https://www.researchgate.net/publication/269338225_Circle_detection_on_images_based_on_the_Clonal_Selection_Algorithm_CSA"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              ver investigación →
            </a>
          </p>
        </div>

        {/* ── Two-column layout — centrado verticalmente ── */}
        <div id="demo" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">

          {/* Left — Terminal */}
          <div className="anim-up" style={{ animationDelay: "0.2s" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
              implementación
            </div>
            <TerminalPanel
              loading={loading}
              maxGenerations={params.max_generations}
              populationSize={params.population_size}
              mutationProb={params.mutation_prob}
              result={result}
            />
          </div>

          {/* Right — Upload + Run button */}
          <div className="flex flex-col gap-5 anim-up" style={{ animationDelay: "0.3s" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
                imagen de entrada
              </div>
              <DropZone onFile={handleFile} preview={preview} loading={loading} />
            </div>

            <button
              onClick={run}
              disabled={!file || loading}
              className="w-full rounded-xl py-3 text-sm font-medium transition-all duration-300"
              style={{
                border: `1px solid ${file && !loading ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                color:  file && !loading ? "rgba(255,255,255,0.9)"  : "rgba(255,255,255,0.2)",
                background: file && !loading ? "rgba(255,255,255,0.04)" : "transparent",
                cursor: !file || loading ? "not-allowed" : "pointer",
                letterSpacing: "0.05em",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => {
                if (!file || loading) return;
                e.currentTarget.style.background  = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)";
              }}
              onMouseLeave={(e) => {
                if (!file || loading) return;
                e.currentTarget.style.background  = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
              }}
            >
              {loading ? "Ejecutando…" : "Ejecutar GA"}
            </button>
          </div>
        </div>

        {/* ── Params panel — full width ── */}
        <div className="mt-6 anim-up" style={{ animationDelay: "0.4s" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
            configuración
          </div>
          <ParamsPanel params={params} onChange={setParams} disabled={loading} />
        </div>

        {/* ── Result section ── */}
        {(phase === "result" || phase === "error" || loading) && (
          <div className="mt-10">
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
              resultado
            </div>
            <ResultPanel
              result={result}
              error={phase === "error" ? errorMsg : null}
              loading={loading}
            />
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-20 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex flex-wrap items-start justify-between gap-6">

            {/* GitHub */}
            <a
              href="https://github.com/ErrorDubal23/Genetic-project"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>Genetic-project</span>
            </a>

            {/* Info académica */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Algoritmos y Complejidad · 5° Semestre
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}>
                Universidad del Norte · Prof. Esmeide Leal Narvaez
              </div>
            </div>

            {/* Integrantes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {["Dubal Aguilar Torres", "Carlos Calabria Patiño", "Alejandro Chaves Ramos", "Santiago Solorzano Diaz"].map((n) => (
                <div key={n} style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>{n}</div>
              ))}
            </div>

            {/* Stack */}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", fontFamily: "var(--font-mono)" }}>
              Python · FastAPI · OpenCV · Next.js 14 · Tailwind CSS
            </div>

          </div>
        </footer>
      </main>
    </>
  );
}
