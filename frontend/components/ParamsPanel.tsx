"use client";

export interface GAParams {
  population_size: number;
  crossover_prob:  number;
  mutation_prob:   number;
  elite_count:     number;
  max_generations: number;
  delta:           number;
  max_circulos:    number;
}

export const DEFAULT_PARAMS: GAParams = {
  population_size: 70,
  crossover_prob:  0.55,
  mutation_prob:   0.10,
  elite_count:     2,
  max_generations: 500,
  delta:           2.0,
  max_circulos:    1,
};

interface FieldDef {
  key:   keyof GAParams;
  label: string;
  min: number; max: number; step: number;
  hint: string;
  fmt?: (v: number) => string;
}

const FIELDS: FieldDef[] = [
  { key: "population_size",  label: "Población",     min: 10,  max: 300,  step: 1,    hint: "paper: 70" },
  { key: "crossover_prob",   label: "P. Crossover",  min: 0,   max: 1,    step: 0.01, hint: "paper: 0.55" },
  { key: "mutation_prob",    label: "P. Mutación",   min: 0,   max: 1,    step: 0.01, hint: "paper: 0.10" },
  { key: "elite_count",      label: "Élite",         min: 0,   max: 10,   step: 1,    hint: "paper: 2" },
  { key: "max_generations",  label: "Generaciones",  min: 10,  max: 2000, step: 10,   hint: "paper: 500" },
  { key: "delta",            label: "Tolerancia δ",  min: 0.5, max: 10,   step: 0.5,  hint: "~2 px" },
  { key: "max_circulos",    label: "Círculos máx.", min: 1,   max: 10,   step: 1,    hint: "1" },
];

interface Props {
  params:    GAParams;
  onChange:  (p: GAParams) => void;
  disabled?: boolean;
}

export default function ParamsPanel({ params, onChange, disabled = false }: Props) {
  const set = (key: keyof GAParams, val: number) => onChange({ ...params, [key]: val });

  return (
    <div
      className="rounded-xl"
      style={{
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#0c0c0c",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--font-mono)" }}>
          Parámetros del Algoritmo Genético
        </span>
        <button
          onClick={() => onChange(DEFAULT_PARAMS)}
          disabled={disabled}
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
            fontFamily: "var(--font-mono)",
            background: "none",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "2px 6px",
            borderRadius: 4,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}
        >
          ↺ restaurar
        </button>
      </div>

      {/* Grid of params */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {FIELDS.map(({ key, label, min, max, step, hint }, idx) => (
          <div
            key={key}
            className="flex flex-col gap-3 px-5 py-4"
            style={{
              borderRight: idx < FIELDS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              borderBottom: "none",
            }}
          >
            {/* Label */}
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {label}
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>
                {hint}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={min} max={max} step={step}
              value={params[key]}
              disabled={disabled}
              onChange={(e) => set(key, parseFloat(e.target.value))}
              className="w-full"
            />

            {/* Value — editable */}
            <input
              type="number"
              min={min} max={max} step={step}
              value={params[key]}
              disabled={disabled}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) set(key, Math.min(max, Math.max(min, v)));
              }}
              className="focus:outline-none text-center"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "4px 6px",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.8)",
                fontFamily: "var(--font-mono)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />

            {/* Min / Max range hint */}
            <div className="flex justify-between">
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)" }}>{min}</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)" }}>{max}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
