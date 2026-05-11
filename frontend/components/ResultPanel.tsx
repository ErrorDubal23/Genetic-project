"use client";
import { useRef, useState, useEffect } from "react";

interface Circle { x: number; y: number; r: number; }

interface DetectResult {
  circles:              Circle[];
  count:                number;
  avg_error:            number;
  fitness:              number;
  annotated_image_b64:  string;
}

interface Props {
  result:  DetectResult | null;
  error:   string | null;
  loading: boolean;
}

export default function ResultPanel({ result, error, loading }: Props) {
  const imgRef  = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => { setNaturalSize(null); }, [result]);

  if (loading) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center gap-4 py-20"
        style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", minHeight: 280 }}
      >
        <div
          className="w-7 h-7 rounded-full border-t-white animate-spin"
          style={{ border: "1px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.7)" }}
        />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
          ejecutando algoritmo genético…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ border: "1px solid rgba(255,60,60,0.2)", background: "#0c0c0c" }}
      >
        <p style={{ fontSize: 11, color: "rgba(255,100,100,0.8)", fontFamily: "var(--font-mono)" }}>
          error: {error}
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="rounded-xl flex items-center justify-center py-20"
        style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#0c0c0c", minHeight: 280 }}
      >
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)" }}>
          los resultados aparecerán aquí
        </span>
      </div>
    );
  }

  const download = () => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.annotated_image_b64}`;
    a.download = "circlega_resultado.png";
    a.click();
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col gap-0 anim-up"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", animationDelay: "0.1s" }}
    >
      {/* Annotated image with SVG breathing overlay */}
      <div className="relative">
        <img
          ref={imgRef}
          src={`data:image/png;base64,${result.annotated_image_b64}`}
          alt="resultado"
          className="w-full object-contain"
          style={{ maxHeight: 360, display: "block" }}
          onLoad={() => {
            if (imgRef.current) {
              setNaturalSize({
                w: imgRef.current.naturalWidth,
                h: imgRef.current.naturalHeight,
              });
            }
          }}
        />
        {/* Breathing circle overlay */}
        {naturalSize && result.circles.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none glow-breathe"
            viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {result.circles.map((c, i) => (
              <circle
                key={i}
                cx={c.x} cy={c.y} r={c.r}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="r"
                  values={`${c.r};${c.r + 5};${c.r}`}
                  dur="2.5s"
                  begin={`${i * 0.4}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0.9;0.4"
                  dur="2.5s"
                  begin={`${i * 0.4}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </svg>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-[1px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { label: "círculos",      value: String(result.count) },
          { label: "fitness",       value: result.fitness.toFixed(4) },
          { label: "error medio",   value: `${result.avg_error.toFixed(3)} px` },
          { label: "centro / radio",
            value: result.circles[0]
              ? `(${result.circles[0].x}, ${result.circles[0].y})  r=${result.circles[0].r}`
              : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 p-4"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>
              {label}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Download */}
      <button
        onClick={download}
        className="w-full flex items-center justify-center gap-2 transition-all duration-200 py-3"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "transparent",
          fontSize: 11,
          color: "rgba(255,255,255,0.3)",
          fontFamily: "var(--font-mono)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color   = "rgba(255,255,255,0.85)";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color   = "rgba(255,255,255,0.3)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        descargar imagen anotada
      </button>
    </div>
  );
}
