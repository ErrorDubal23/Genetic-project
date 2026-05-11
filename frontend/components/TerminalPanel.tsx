"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_PARAMS } from "@/components/ParamsPanel";

// ── Archivos que se muestran (en este orden) ─────────────────────────────────
const ARCHIVOS = [
  "genetic_algorithm.py",
  "fitness.py",
  "image_utils.py",
  "main.py",
];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Resaltado de sintaxis Python (tokenizador propio) ────────────────────────
function resaltarPython(codigoOriginal: string): string {
  const fragmentos: string[] = [];

  const marcar    = (html: string) => { fragmentos.push(html); return `\x00F${fragmentos.length - 1}F\x00`; };
  const restaurar = (t: string)    => t.replace(/\x00F(\d+)F\x00/g, (_, i) => fragmentos[+i]);

  let texto = codigoOriginal
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  texto = texto.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, (m) => {
    const spanPorLinea = m
      .split("\n")
      .map((parte) => `<span class="sh-cm">${parte}</span>`)
      .join("\n");
    return marcar(spanPorLinea);
  });

  texto = texto.replace(/"[^"\n]*"|'[^'\n]*'/g,
    (m) => marcar(`<span class="sh-st">${m}</span>`)
  );

  texto = texto.replace(/#[^\n]*/g,
    (m) => marcar(`<span class="sh-cm">${m}</span>`)
  );

  const PALABRAS_CLAVE = [
    "class", "def", "return", "if", "else", "elif", "for", "while",
    "in", "not", "and", "or", "import", "from", "as", "True", "False",
    "None", "self", "pass", "break", "continue", "raise", "try",
    "except", "with", "lambda", "yield", "is", "del", "global",
    "nonlocal", "assert", "async", "await",
  ];
  const regexClave = new RegExp(`\\b(${PALABRAS_CLAVE.join("|")})\\b`, "g");
  texto = texto.replace(regexClave, `<span class="sh-kw">$1</span>`);

  texto = texto.replace(
    /(<span class="sh-kw">(?:def|class)<\/span>)\s+(\w+)/g,
    `$1 <span class="sh-fn">$2</span>`
  );

  texto = texto.replace(
    /\b(\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
    `<span class="sh-nm">$1</span>`
  );

  return restaurar(texto);
}

// ── Subcomponente: visor de código (reutilizado en normal y modal) ────────────
function VisorCodigo({
  lineas, codeRef, altura,
}: {
  lineas: string[];
  codeRef?: React.RefObject<HTMLDivElement>;
  altura: string | number;
}) {
  return (
    <div
      ref={codeRef}
      className="overflow-auto"
      style={{ height: altura }}
    >
      <div style={{ paddingTop: 16, paddingBottom: 16, fontSize: 11, lineHeight: 1.625 }}>
        {lineas.map((linea, i) => (
          <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
            <span style={{
              minWidth: 48, paddingLeft: 16, paddingRight: 10,
              textAlign: "right", userSelect: "none",
              color: "rgba(255,255,255,0.2)", flexShrink: 0,
              borderRight: "1px solid rgba(255,255,255,0.05)",
            }}>
              {i + 1}
            </span>
            <span
              style={{ paddingLeft: 12, paddingRight: 16, color: "#d4d4d4", flex: 1 }}
              dangerouslySetInnerHTML={{ __html: linea || "&nbsp;" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Constantes de métricas ───────────────────────────────────────────────────
const TICK_MS   = 80;
const CHART_PTS = 48;

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  loading:        boolean;
  maxGenerations: number;
  populationSize: number;
  mutationProb:   number;
  result: { fitness: number; count: number } | null;
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function TerminalPanel({
  loading, maxGenerations, populationSize, mutationProb, result,
}: Props) {
  const [codigos,    setCodigos]    = useState<Record<string, string>>({});
  const [codigosRaw, setCodigosRaw] = useState<Record<string, string>>({});
  const [cargando,   setCargando]   = useState(true);
  const [errorRed,   setErrorRed]   = useState(false);
  const [copiado,    setCopiado]    = useState(false);

  const [active,  setActive]  = useState(ARCHIVOS[0]);
  const [metrics, setMetrics] = useState({ gen: 0, fitness: 0, history: [] as number[] });

  // Necesario para Portal en Next.js (document.body no existe en SSR)
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  // Estado del modo expandido
  const [modalAbierto,     setModalAbierto]     = useState(false);
  const [archivoModal,     setArchivoModal]     = useState<File | null>(null);
  const [ejecutandoModal,  setEjecutandoModal]  = useState(false);
  const [resultadoModal,   setResultadoModal]   = useState<{
    count: number; fitness: number; avg_error: number; annotated_image_b64: string;
  } | null>(null);
  const [lineasConsola, setLineasConsola] = useState<string[]>([]);

  const codeRef        = useRef<HTMLDivElement>(null);
  const codeModalRef   = useRef<HTMLDivElement>(null);
  const consolaRef     = useRef<HTMLDivElement>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval>>();
  const metricsRef     = useRef({ gen: 0, fitness: 0.02, history: [] as number[] });

  // ── Cargar código desde el backend ────────────────────────────────────────
  useEffect(() => {
    setCargando(true);
    setErrorRed(false);

    Promise.all(
      ARCHIVOS.map((archivo) =>
        fetch(`${API}/codigo/${archivo}`)
          .then((r) => r.json())
          .then((data: { archivo: string; contenido: string }) => ({
            archivo: data.archivo,
            html:    resaltarPython(data.contenido),
            raw:     data.contenido,
          }))
      )
    )
      .then((resultados) => {
        const mapaHtml: Record<string, string> = {};
        const mapaRaw:  Record<string, string> = {};
        resultados.forEach(({ archivo, html, raw }) => {
          mapaHtml[archivo] = html;
          mapaRaw[archivo]  = raw;
        });
        setCodigos(mapaHtml);
        setCodigosRaw(mapaRaw);
        setCargando(false);
      })
      .catch(() => { setErrorRed(true); setCargando(false); });
  }, []);

  // ── Cerrar modal con Escape ────────────────────────────────────────────────
  useEffect(() => {
    if (!modalAbierto) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModalAbierto(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modalAbierto]);

  // ── Bloquear scroll del body cuando el modal está abierto ─────────────────
  useEffect(() => {
    document.body.style.overflow = modalAbierto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalAbierto]);

  // ── Auto-scroll de la consola cuando llegan nuevas líneas ─────────────────
  useEffect(() => {
    if (consolaRef.current) {
      consolaRef.current.scrollTop = consolaRef.current.scrollHeight;
    }
  }, [lineasConsola]);

  // ── Auto-scroll del código durante ejecución ──────────────────────────────
  useEffect(() => {
    if (!loading || !codeRef.current) return;
    const el = codeRef.current;
    const id = setInterval(() => { el.scrollTop += 1.5; }, 60);
    return () => clearInterval(id);
  }, [loading, active]);

  // ── Métricas animadas ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      metricsRef.current = { gen: 0, fitness: 0.02, history: [] };
      intervalRef.current = setInterval(() => {
        const m   = metricsRef.current;
        const paso = maxGenerations / (5000 / TICK_MS);
        m.gen     = Math.min(m.gen + paso, maxGenerations);
        m.fitness = Math.max(0.01, Math.min(0.98, m.fitness + Math.random() * 0.014 + 0.002));
        m.history = [...m.history.slice(-(CHART_PTS - 1)), m.fitness];
        metricsRef.current = { ...m };
        setMetrics({ ...m });
      }, TICK_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setMetrics(
        result
          ? { gen: maxGenerations, fitness: result.fitness, history: metricsRef.current.history }
          : { gen: 0, fitness: 0, history: [] }
      );
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loading, maxGenerations, result]);

  // ── Ejecutar GA desde el modal ─────────────────────────────────────────────
  const ejecutarEnModal = async () => {
    if (!archivoModal || ejecutandoModal) return;
    setEjecutandoModal(true);
    setResultadoModal(null);
    setLineasConsola([
      "$ uvicorn main:aplicacion",
      "> imagen cargada: " + archivoModal.name,
      "> ejecutando algoritmo genético con parámetros por defecto...",
    ]);

    const fd = new FormData();
    fd.append("image", archivoModal);
    fd.append("params", JSON.stringify(DEFAULT_PARAMS));

    try {
      const res = await fetch(`${API}/detect`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResultadoModal(data);
      setLineasConsola((prev) => [
        ...prev,
        `> círculos detectados : ${data.count}`,
        `> mejor aptitud       : ${data.fitness.toFixed(4)}`,
        `> error promedio      : ${data.avg_error.toFixed(3)} px`,
        "> ✓  completado",
      ]);
    } catch (e: unknown) {
      setLineasConsola((prev) => [
        ...prev,
        `> ✗  error: ${e instanceof Error ? e.message : String(e)}`,
      ]);
    }
    setEjecutandoModal(false);
  };

  // ── Gráfico de fitness ─────────────────────────────────────────────────────
  const CW = 130, CH = 28;
  const puntosGrafico = metrics.history.length > 1
    ? metrics.history
        .map((v, i) => `${(i / (metrics.history.length - 1)) * CW},${CH - v * CH * 0.88 - 1}`)
        .join(" ")
    : "";

  const filasMetricas = [
    { label: "generación",  val: `${Math.round(metrics.gen)}/${maxGenerations}` },
    { label: "fitness",     val: metrics.fitness > 0 ? metrics.fitness.toFixed(4) : "—" },
    { label: "individuos",  val: String(populationSize) },
    { label: "mutación",    val: `${(mutationProb * 100).toFixed(0)} %` },
  ];

  const handleTabClick = useCallback((t: string) => {
    setActive(t);
    if (codeRef.current) codeRef.current.scrollTop = 0;
    if (codeModalRef.current) codeModalRef.current.scrollTop = 0;
  }, []);

  const lineasCodigo = (codigos[active] ?? "").split("\n");

  // ── Barra de pestañas (reutilizada en normal y modal) ─────────────────────
  const PestanasTabs = ({ borde = true }: { borde?: boolean }) => (
    <div
      className="flex overflow-x-auto shrink-0"
      style={{ borderBottom: borde ? "1px solid rgba(255,255,255,0.05)" : "none" }}
    >
      {ARCHIVOS.map((archivo) => (
        <button
          key={archivo}
          onClick={() => handleTabClick(archivo)}
          className="px-4 py-2 whitespace-nowrap transition-colors shrink-0"
          style={{
            fontSize: 10,
            color:        active === archivo ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)",
            background:   active === archivo ? "rgba(255,255,255,0.04)" : "transparent",
            borderBottom: active === archivo ? "1px solid rgba(255,255,255,0.3)" : "none",
            marginBottom: active === archivo ? -1 : 0,
          }}
        >
          {archivo}
        </button>
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Vista normal ── */}
      <div
        className="flex flex-col rounded-xl overflow-hidden text-xs"
        style={{
          background: "#0c0c0c",
          border: "1px solid rgba(255,255,255,0.07)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {/* Barra de título */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0a0a0a" }}
        >
          <div className="flex gap-1.5">
            {/* Rojo y amarillo: decorativos. Verde: expande a pantalla completa */}
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
            <button
              onClick={() => setModalAbierto(true)}
              title="Pantalla completa"
              className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70"
              style={{ background: "#28c840", border: "none", cursor: "pointer", padding: 0 }}
            />
          </div>
          <div className="flex-1 text-center select-none" style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            {loading ? `● ejecutando ${active}` : active}
          </div>

          {/* Botón copiar */}
          {!cargando && !errorRed && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(codigosRaw[active] ?? "");
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                cursor: "pointer", padding: "2px 7px", display: "flex", alignItems: "center",
                gap: 4, fontSize: 9, color: copiado ? "rgba(100,220,100,0.9)" : "rgba(255,255,255,0.3)",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { if (!copiado) e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
              onMouseLeave={(e) => { if (!copiado) e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              {copiado ? (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Copiado</>
              ) : (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copiar</>
              )}
            </button>
          )}

          {/* Barras ecualizadoras durante ejecución */}
          {loading && (
            <div className="flex items-end gap-[2px]" style={{ height: 12 }}>
              {[0.4, 0.7, 1, 0.7, 0.5, 0.8, 0.4].map((h, i) => (
                <div key={i} className="w-[2px] rounded-sm" style={{ height: `${h * 12}px`, background: "rgba(255,255,255,0.5)", transformOrigin: "bottom", animation: `eq 0.7s ${i * 0.08}s ease-in-out infinite alternate` }} />
              ))}
            </div>
          )}
        </div>

        {/* Pestañas */}
        <PestanasTabs />

        {/* Área de código con botón expandir abajo a la derecha */}
        <div style={{ position: "relative" }}>
          {cargando ? (
            <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "rgba(255,255,255,0.2)", minHeight: 220 }}>
              <div className="w-4 h-4 rounded-full animate-spin" style={{ border: "1px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)" }} />
              <span style={{ fontSize: 10 }}>cargando código…</span>
            </div>
          ) : errorRed ? (
            <div style={{ color: "rgba(255,100,100,0.6)", fontSize: 10, padding: "8px 16px", minHeight: 220 }}>
              no se pudo conectar al backend para cargar el código
            </div>
          ) : (
            <VisorCodigo lineas={lineasCodigo} codeRef={codeRef} altura={300} />
          )}

          {/* Botón expandir — esquina inferior derecha */}
          {!cargando && !errorRed && (
            <button
              onClick={() => setModalAbierto(true)}
              title="Ver código completo"
              style={{
                position: "absolute", bottom: 8, right: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, cursor: "pointer",
                padding: "4px 6px", color: "rgba(255,255,255,0.4)",
                transition: "all 0.2s", display: "flex", alignItems: "center", gap: 4,
                fontSize: 9, fontFamily: "var(--font-mono)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              expandir
            </button>
          )}
        </div>

        {/* Panel de métricas */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid grid-cols-2 gap-3">
            {filasMetricas.map(({ label, val }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 500, color: loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>fitness trend</span>
            <svg width={CW} height={CH} className="flex-1" style={{ maxWidth: CW }}>
              {puntosGrafico ? (
                <>
                  <polyline points={puntosGrafico} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  <polyline points={puntosGrafico} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeDasharray="3 5" />
                </>
              ) : (
                <line x1="0" y1={CH / 2} x2={CW} y2={CH / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* ── Modal expandido — Portal sobre document.body para saltar cualquier stacking context ── */}
      {modalAbierto && montado && createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "#0c0c0c",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
            {/* Barra de título del modal */}
            <div
              className="flex items-center gap-2 px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0a" }}
            >
              <div className="flex gap-1.5">
                {/* Rojo y amarillo: colapsan a vista normal. Verde: ya está en pantalla completa */}
                <button onClick={() => setModalAbierto(false)} title="Cerrar (Esc)" className="w-2.5 h-2.5 rounded-full hover:opacity-70 transition-opacity" style={{ background: "#ff5f57", border: "none", cursor: "pointer", padding: 0 }} />
                <button onClick={() => setModalAbierto(false)} title="Minimizar" className="w-2.5 h-2.5 rounded-full hover:opacity-70 transition-opacity" style={{ background: "#febc2e", border: "none", cursor: "pointer", padding: 0 }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              </div>
              <div className="flex-1 text-center select-none" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                {active} — CircleGA
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codigosRaw[active] ?? "");
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                  cursor: "pointer", padding: "2px 7px", display: "flex", alignItems: "center",
                  gap: 4, fontSize: 9, color: copiado ? "rgba(100,220,100,0.9)" : "rgba(255,255,255,0.3)",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                onMouseLeave={(e) => { if (!copiado) e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                {copiado ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            {/* Pestañas del modal */}
            <PestanasTabs />

            {/* Código — ocupa el espacio disponible */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <VisorCodigo lineas={lineasCodigo} codeRef={codeModalRef} altura="100%" />
            </div>

            {/* Panel de ejecución */}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                background: "#080808",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flexShrink: 0,
              }}
            >
              {/* Fila: elegir imagen + ejecutar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                  imagen de entrada
                </span>

                {/* Input oculto */}
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setArchivoModal(f); setResultadoModal(null); setLineasConsola([]); }
                  }}
                />

                {/* Botón elegir archivo */}
                <button
                  onClick={() => inputArchivoRef.current?.click()}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6, cursor: "pointer", padding: "5px 12px",
                    fontSize: 10, color: "rgba(255,255,255,0.55)", transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {archivoModal ? archivoModal.name : "Elegir imagen…"}
                </button>

                {/* Botón ejecutar */}
                <button
                  onClick={ejecutarEnModal}
                  disabled={!archivoModal || ejecutandoModal}
                  style={{
                    background: archivoModal && !ejecutandoModal ? "rgba(255,255,255,0.08)" : "transparent",
                    border: `1px solid ${archivoModal && !ejecutandoModal ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 6, cursor: archivoModal && !ejecutandoModal ? "pointer" : "not-allowed",
                    padding: "5px 14px", fontSize: 10,
                    color: archivoModal && !ejecutandoModal ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                    transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
                  }}
                  onMouseEnter={(e) => { if (archivoModal && !ejecutandoModal) { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; } }}
                  onMouseLeave={(e) => { if (archivoModal && !ejecutandoModal) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; } }}
                >
                  {ejecutandoModal ? (
                    <><div className="w-3 h-3 rounded-full animate-spin" style={{ border: "1px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.8)" }} />Ejecutando…</>
                  ) : (
                    <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>▶ Ejecutar GA</>
                  )}
                </button>

                <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                  parámetros por defecto · Esc para cerrar
                </span>
              </div>

              {/* Consola de salida */}
              {lineasConsola.length > 0 && (
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Texto de consola */}
                  <div
                    ref={consolaRef}
                    style={{
                      flex: 1, maxHeight: 110, overflowY: "auto",
                      background: "#050505", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 6, padding: "8px 12px",
                    }}
                  >
                    {lineasConsola.map((linea, i) => (
                      <div key={i} style={{ fontSize: 10, lineHeight: 1.7, color: linea.startsWith("> ✓") ? "rgba(100,220,100,0.8)" : linea.startsWith("> ✗") ? "rgba(255,100,100,0.8)" : linea.startsWith("$") ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.65)" }}>
                        {linea}
                      </div>
                    ))}
                    {ejecutandoModal && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                        <span style={{ animation: "eq 0.8s ease-in-out infinite alternate" }}>▌</span>
                      </div>
                    )}
                  </div>

                  {/* Imagen resultado */}
                  {resultadoModal && (
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <img
                        src={`data:image/png;base64,${resultadoModal.annotated_image_b64}`}
                        alt="resultado"
                        style={{ height: 100, maxWidth: 180, objectFit: "contain", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                        {resultadoModal.count} círculo{resultadoModal.count !== 1 ? "s" : ""} · fitness {resultadoModal.fitness.toFixed(3)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
