"use client";
import { useState, useCallback } from "react";
import Image from "next/image";
import ParticleBackground from "@/components/ParticleBackground";
import CodeViewer from "@/components/CodeViewer";
import DropZone from "@/components/DropZone";
import ParamsPanel, { GAParams, DEFAULT_PARAMS } from "@/components/ParamsPanel";
import ResultPanel from "@/components/ResultPanel";

interface DetectResult {
  circles: { x: number; y: number; r: number }[];
  count: number;
  avg_error: number;
  fitness: number;
  annotated_image_b64: string;
}

type AppState = "idle" | "loading" | "result" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [params, setParams] = useState<GAParams>(DEFAULT_PARAMS);
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<DetectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setState("idle");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const run = async () => {
    if (!file) return;
    setState("loading");
    setResult(null);
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("image", file);
    fd.append("params", JSON.stringify(params));

    try {
      const res = await fetch("http://localhost:8000/detect", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Error desconocido");
      }
      const data: DetectResult = await res.json();
      setResult(data);
      setState("result");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error de red");
      setState("error");
    }
  };

  return (
    <main className="relative min-h-screen" style={{ zIndex: 1 }}>
      <ParticleBackground />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 flex flex-col gap-12">

        {/* ── Header ── */}
        <header className="flex items-center gap-4">
          <div className="w-10 h-10 relative flex-shrink-0">
            <Image
              src="/logo.png"
              alt="CircleGA logo"
              fill
              className="object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Fallback SVG cuando no hay logo */}
            <svg
              viewBox="0 0 40 40"
              className="absolute inset-0 w-full h-full"
              style={{ display: "block" }}
              aria-hidden
            >
              <circle cx="20" cy="20" r="16" stroke="#444" strokeWidth="1.5" fill="none" />
              <circle cx="20" cy="20" r="8"  stroke="#666" strokeWidth="1"   fill="none" strokeDasharray="3 3" />
              <circle cx="20" cy="20" r="2"  fill="#888" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-mono text-white tracking-tight">CircleGA</h1>
            <p className="text-[11px] text-[#444]">
              Detección genética de círculos · Ayala-Ramírez et al., Pattern Recognition Letters 27 (2006)
            </p>
          </div>
        </header>

        {/* ── Code section ── */}
        <section>
          <div className="text-[10px] text-[#333] uppercase tracking-widest mb-3">
            Implementación
          </div>
          <CodeViewer />
        </section>

        {/* ── Main panel: upload + params + result ── */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_280px_1fr] gap-6">

          {/* Carga de imagen */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#333] uppercase tracking-widest">Imagen</div>
            <DropZone onFile={handleFile} preview={preview} />
            <button
              onClick={run}
              disabled={!file || state === "loading"}
              className={`w-full py-2.5 rounded border text-sm transition-colors
                ${file && state !== "loading"
                  ? "border-white text-white hover:bg-white hover:text-black"
                  : "border-[#2a2a2a] text-[#333] cursor-not-allowed"
                }`}
            >
              {state === "loading" ? "ejecutando…" : "ejecutar GA"}
            </button>
          </div>

          {/* Parámetros */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#333] uppercase tracking-widest">Parámetros</div>
            <div className="rounded border border-[#2a2a2a] bg-[#141414] p-4">
              <ParamsPanel params={params} onChange={setParams} />
            </div>
          </div>

          {/* Resultado */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#333] uppercase tracking-widest">Resultado</div>
            <ResultPanel
              result={result}
              error={state === "error" ? errorMsg : null}
              loading={state === "loading"}
            />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-[10px] text-[#2a2a2a] pb-4">
          CircleGA · implementación académica basada en Ayala-Ramírez, García-Capulín, Pérez-García &amp; Sanchez-Yanez (2006)
        </footer>
      </div>
    </main>
  );
}
