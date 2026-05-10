"use client";

interface Circle { x: number; y: number; r: number; }

interface DetectResult {
  circles: Circle[];
  count: number;
  avg_error: number;
  fitness: number;
  annotated_image_b64: string;
}

interface Props {
  result: DetectResult | null;
  error: string | null;
  loading: boolean;
}

export default function ResultPanel({ result, error, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] overflow-hidden min-h-[280px]">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] border-b border-[#1e293b]">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[10px] text-[#475569] font-medium tracking-wide uppercase">
            Resultado
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#475569]">
          <div className="w-8 h-8 border-2 border-[#1e293b] border-t-[#3b82f6] rounded-full animate-spin" />
          <span className="text-xs">Ejecutando algoritmo genetico...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] border-b border-[#1e293b]">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[10px] text-[#475569] font-medium tracking-wide uppercase">
            Error
          </span>
        </div>
        <div className="p-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] overflow-hidden min-h-[280px]">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] border-b border-[#1e293b]">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[10px] text-[#475569] font-medium tracking-wide uppercase">
            Resultado
          </span>
        </div>
        <div className="flex items-center justify-center py-20 text-[#475569] text-xs">
          Los resultados apareceran aqui despues de ejecutar
        </div>
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
    <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] overflow-hidden">
      {/* Barra estilo Mac */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] border-b border-[#1e293b]">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-[#475569] font-medium tracking-wide uppercase">
          Circulos detectados: {result.count}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Imagen anotada */}
        <div className="rounded-lg overflow-hidden bg-[#0f172a] border border-[#1e293b]">
          <img
            src={`data:image/png;base64,${result.annotated_image_b64}`}
            alt="Resultado"
            className="w-full object-contain max-h-[320px]"
          />
        </div>

        {/* Circulos encontrados */}
        {result.circles.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-[#475569] uppercase tracking-widest">
              Circulos encontrados
            </span>
            <div className="grid grid-cols-1 gap-2">
              {result.circles.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-[#0f172a] border border-[#1e293b] p-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-[#60a5fa] font-bold">{i + 1}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-[#94a3b8]">
                      Centro: ({c.x}, {c.y}) | Radio: {c.r}px
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metricas */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Fitness", value: result.fitness.toFixed(4), color: "text-[#60a5fa]" },
            { label: "Error promedio", value: `${result.avg_error.toFixed(2)} px`, color: "text-[#fbbf24]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[#1e293b] bg-[#0f172a] p-3">
              <div className="text-[10px] text-[#475569] mb-1 uppercase tracking-wider">{label}</div>
              <div className={`text-sm font-mono font-semibold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Boton descargar */}
        <button
          onClick={download}
          className="w-full rounded-lg border border-[#1e293b] bg-[#0f172a] py-2.5 text-xs text-[#94a3b8]
                     hover:border-[#3b82f6] hover:text-[#60a5fa] transition-all duration-200
                     flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar imagen anotada
        </button>
      </div>
    </div>
  );
}
