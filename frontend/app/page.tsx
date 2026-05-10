"use client";

import { useState, useCallback } from "react";
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
    <main className="relative min-h-screen">
      <ParticleBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8 sm:gap-12">

        {/* Header */}
        <header className="flex items-center gap-4">
          <div className="w-10 h-10 relative flex-shrink-0">
            <svg viewBox="0 0 40 40" className="w-full h-full">
              <circle cx="20" cy="20" r="16" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
              <circle cx="20" cy="20" r="8" stroke="#60a5fa" strokeWidth="1" fill="none" strokeDasharray="3 3" />
              <circle cx="20" cy="20" r="2" fill="#93c5fd" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-mono text-[#e2e8f0] tracking-tight">CircleGA</h1>
            <p className="text-[11px] text-[#475569]">
              Deteccion genetica de circulos | Ayala-Ramirez et al. (2006)
            </p>
          </div>
        </header>

        {/* Code section */}
        <section>
          <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-3">
            Implementacion
          </div>
          <CodeViewer />
        </section>

        {/* Main panel: upload + params + result */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_300px_1fr] gap-4 sm:gap-6">

          {/* Carga de imagen */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#475569] uppercase tracking-widest">Imagen</div>
            <DropZone onFile={handleFile} preview={preview} />
            <button
              onClick={run}
              disabled={!file || state === "loading"}
              className={`w-full py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${file && state !== "loading"
                  ? "bg-[#1e3a5f] border border-[#3b82f6] text-[#60a5fa] hover:bg-[#2563eb] hover:text-white"
                  : "border border-[#1e293b] text-[#475569] cursor-not-allowed"
                }`}
            >
              {state === "loading" ? "Ejecutando..." : "Ejecutar GA"}
            </button>
          </div>

          {/* Parametros */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#475569] uppercase tracking-widest">Parametros</div>
            <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] p-4">
              <ParamsPanel params={params} onChange={setParams} />
            </div>
          </div>

          {/* Resultado */}
          <div className="flex flex-col gap-4">
            <div className="text-[10px] text-[#475569] uppercase tracking-widest">Resultado</div>
            <ResultPanel
              result={result}
              error={state === "error" ? errorMsg : null}
              loading={state === "loading"}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-[10px] text-[#334155] pb-4">
          CircleGA | Implementacion academica basada en Ayala-Ramirez, Garcia-Capulin, Perez-Garcia &amp; Sanchez-Yanez (2006)
        </footer>
      </div>
    </main>
  );
}
