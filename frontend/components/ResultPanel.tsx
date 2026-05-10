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
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#444]">
        <div className="w-6 h-6 border border-[#333] border-t-white rounded-full animate-spin" />
        <span className="text-xs">Ejecutando GA…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-[#2a2a2a] bg-[#141414] p-4">
        <p className="text-xs text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center py-16 text-[#333] text-xs">
        los resultados aparecerán aquí
      </div>
    );
  }

  const download = () => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.annotated_image_b64}`;
    a.download = "circlega_result.png";
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Imagen anotada */}
      <div className="rounded border border-[#2a2a2a] overflow-hidden bg-[#141414]">
        <img
          src={`data:image/png;base64,${result.annotated_image_b64}`}
          alt="resultado"
          className="w-full object-contain max-h-[360px]"
        />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Círculos detectados", value: result.count },
          { label: "Fitness", value: result.fitness.toFixed(4) },
          { label: "Error promedio (px)", value: result.avg_error.toFixed(4) },
          {
            label: "Centro / Radio",
            value: result.circles[0]
              ? `(${result.circles[0].x}, ${result.circles[0].y}) r=${result.circles[0].r}`
              : "—",
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded border border-[#1e1e1e] bg-[#141414] p-3">
            <div className="text-[10px] text-[#555] mb-1">{label}</div>
            <div className="text-sm text-white font-mono">{value}</div>
          </div>
        ))}
      </div>

      {/* Descarga */}
      <button
        onClick={download}
        className="w-full border border-[#2a2a2a] rounded py-2 text-xs text-[#888]
                   hover:border-white hover:text-white transition-colors"
      >
        descargar imagen anotada
      </button>
    </div>
  );
}
