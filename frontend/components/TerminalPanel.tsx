"use client";
import { useState, useEffect, useRef, useCallback } from "react";

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

  // Marca con letras alrededor del índice: \x00FNF\x00
  // Así la regex de números (\b\d+\b) no captura el índice N
  // porque está rodeado de la letra F (carácter de palabra), eliminando \b.
  const marcar    = (html: string) => { fragmentos.push(html); return `\x00F${fragmentos.length - 1}F\x00`; };
  const restaurar = (t: string)    => t.replace(/\x00F(\d+)F\x00/g, (_, i) => fragmentos[+i]);

  // 1. Escapar caracteres HTML del código fuente original
  let texto = codigoOriginal
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Extraer docstrings (triple comillas) → color de comentario
  // Cada línea recibe su propio span para que al dividir por \n no queden spans rotos.
  texto = texto.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, (m) => {
    const spanPorLinea = m
      .split("\n")
      .map((parte) => `<span class="sh-cm">${parte}</span>`)
      .join("\n");
    return marcar(spanPorLinea);
  });

  // 3. Extraer strings de una sola línea
  texto = texto.replace(/"[^"\n]*"|'[^'\n]*'/g,
    (m) => marcar(`<span class="sh-st">${m}</span>`)
  );

  // 4. Extraer comentarios de línea (#...)
  texto = texto.replace(/#[^\n]*/g,
    (m) => marcar(`<span class="sh-cm">${m}</span>`)
  );

  // 5. Resaltar todas las palabras clave
  const PALABRAS_CLAVE = [
    "class", "def", "return", "if", "else", "elif", "for", "while",
    "in", "not", "and", "or", "import", "from", "as", "True", "False",
    "None", "self", "pass", "break", "continue", "raise", "try",
    "except", "with", "lambda", "yield", "is", "del", "global",
    "nonlocal", "assert", "async", "await",
  ];
  const regexClave = new RegExp(`\\b(${PALABRAS_CLAVE.join("|")})\\b`, "g");
  texto = texto.replace(regexClave, `<span class="sh-kw">$1</span>`);

  // 6. Resaltar el nombre que sigue a def / class
  texto = texto.replace(
    /(<span class="sh-kw">(?:def|class)<\/span>)\s+(\w+)/g,
    `$1 <span class="sh-fn">$2</span>`
  );

  // 7. Resaltar números (enteros, decimales, notación científica)
  texto = texto.replace(
    /\b(\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
    `<span class="sh-nm">$1</span>`
  );

  // 8. Restaurar fragmentos extraídos (strings, docstrings, comentarios)
  return restaurar(texto);
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
  // Código real cargado desde el backend
  const [codigos,    setCodigos]    = useState<Record<string, string>>({});
  const [codigosRaw, setCodigosRaw] = useState<Record<string, string>>({});
  const [cargando,   setCargando]   = useState(true);
  const [errorRed,   setErrorRed]   = useState(false);
  const [copiado,    setCopiado]    = useState(false);

  const [active,  setActive]  = useState(ARCHIVOS[0]);
  const [metrics, setMetrics] = useState({ gen: 0, fitness: 0, history: [] as number[] });

  const codeRef     = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const metricsRef  = useRef({ gen: 0, fitness: 0.02, history: [] as number[] });

  // ── Cargar código real desde el backend ────────────────────────────────────
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
      .catch(() => {
        setErrorRed(true);
        setCargando(false);
      });
  }, []); // Se ejecuta una sola vez al montar el componente

  // ── Auto-scroll durante ejecución ─────────────────────────────────────────
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
  }, []);

  // Líneas del archivo activo ya con HTML resaltado
  const lineasCodigo = (codigos[active] ?? "").split("\n");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
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
          {["#ff5f57", "#febc2e", "#28c840"].map((color, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          ))}
        </div>
        <div
          className="flex-1 text-center select-none"
          style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}
        >
          {loading ? `● ejecutando ${active}` : active}
        </div>
        {/* Botón copiar código */}
        {!cargando && !errorRed && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(codigosRaw[active] ?? "");
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
            title="Copiar código"
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 5,
              cursor: "pointer",
              padding: "2px 7px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 9,
              color: copiado ? "rgba(100,220,100,0.9)" : "rgba(255,255,255,0.3)",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => { if (!copiado) e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={(e) => { if (!copiado) e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            {copiado ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copiado
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copiar
              </>
            )}
          </button>
        )}

        {/* Barras ecualizadoras durante ejecución */}
        {loading && (
          <div className="flex items-end gap-[2px]" style={{ height: 12 }}>
            {[0.4, 0.7, 1, 0.7, 0.5, 0.8, 0.4].map((h, i) => (
              <div
                key={i}
                className="w-[2px] rounded-sm"
                style={{
                  height: `${h * 12}px`,
                  background: "rgba(255,255,255,0.5)",
                  transformOrigin: "bottom",
                  animation: `eq 0.7s ${i * 0.08}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pestañas de archivos */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {ARCHIVOS.map((archivo) => (
          <button
            key={archivo}
            onClick={() => handleTabClick(archivo)}
            className="px-4 py-2 whitespace-nowrap transition-colors shrink-0"
            style={{
              fontSize: 10,
              color:      active === archivo ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)",
              background: active === archivo ? "rgba(255,255,255,0.04)" : "transparent",
              borderBottom: active === archivo ? "1px solid rgba(255,255,255,0.3)" : "none",
              marginBottom: active === archivo ? -1 : 0,
            }}
          >
            {archivo}
          </button>
        ))}
      </div>

      {/* Área de código */}
      <div
        ref={codeRef}
        className="overflow-auto"
        style={{ minHeight: 220, maxHeight: 300 }}
      >
        {cargando ? (
          <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "rgba(255,255,255,0.2)" }}>
            <div
              className="w-4 h-4 rounded-full animate-spin"
              style={{ border: "1px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)" }}
            />
            <span style={{ fontSize: 10 }}>cargando código…</span>
          </div>
        ) : errorRed ? (
          <div style={{ color: "rgba(255,100,100,0.6)", fontSize: 10, padding: "8px 16px" }}>
            no se pudo conectar al backend para cargar el código
          </div>
        ) : (
          <div style={{ paddingTop: 16, paddingBottom: 16, fontSize: 11, lineHeight: 1.625 }}>
            {lineasCodigo.map((linea, i) => (
              <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
                {/* Número de línea — mismo elemento que su código */}
                <span style={{
                  minWidth: 48,
                  paddingLeft: 16,
                  paddingRight: 10,
                  textAlign: "right",
                  userSelect: "none",
                  color: "rgba(255,255,255,0.2)",
                  flexShrink: 0,
                  borderRight: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {i + 1}
                </span>
                {/* Código de esa línea */}
                <span
                  style={{ paddingLeft: 12, paddingRight: 16, color: "#d4d4d4", flex: 1 }}
                  dangerouslySetInnerHTML={{ __html: linea || "&nbsp;" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de métricas */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grid grid-cols-2 gap-3">
          {filasMetricas.map(({ label, val }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {label}
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                }}
              >
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de evolución del fitness */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
            fitness trend
          </span>
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
  );
}
