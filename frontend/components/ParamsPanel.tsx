"use client";

export interface GAParams {
  population_size: number;
  crossover_prob: number;
  mutation_prob: number;
  elite_count: number;
  max_generations: number;
  delta: number;
}

export const DEFAULT_PARAMS: GAParams = {
  population_size: 70,
  crossover_prob: 0.55,
  mutation_prob: 0.10,
  elite_count: 2,
  max_generations: 500,
  delta: 2.0,
};

interface Props {
  params: GAParams;
  onChange: (p: GAParams) => void;
}

interface FieldDef {
  key: keyof GAParams;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

const FIELDS: FieldDef[] = [
  { key: "population_size",  label: "Población",       min: 10,  max: 300, step: 1,    hint: "Paper: 70" },
  { key: "crossover_prob",   label: "Prob. crossover", min: 0,   max: 1,   step: 0.01, hint: "Paper: 0.55" },
  { key: "mutation_prob",    label: "Prob. mutación",  min: 0,   max: 1,   step: 0.01, hint: "Paper: 0.10" },
  { key: "elite_count",      label: "Élite",           min: 0,   max: 10,  step: 1,    hint: "Paper: 2" },
  { key: "max_generations",  label: "Generaciones",    min: 10,  max: 2000,step: 10,   hint: "Paper: 500" },
  { key: "delta",            label: "Tolerancia δ (px)",min: 0.5,max: 10,  step: 0.5,  hint: "Paper: ~2 px" },
];

export default function ParamsPanel({ params, onChange }: Props) {
  const set = (key: keyof GAParams, val: number) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-[#555] uppercase tracking-widest pb-1 border-b border-[#1e1e1e]">
        Parámetros del GA
      </div>
      {FIELDS.map(({ key, label, min, max, step, hint }) => (
        <div key={key} className="flex flex-col gap-1">
          <div className="flex justify-between items-baseline">
            <label className="text-xs text-[#aaa]">{label}</label>
            <span className="text-xs text-[#666]">{hint}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) => set(key, parseFloat(e.target.value))}
              className="flex-1 accent-white h-[2px]"
            />
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) => set(key, parseFloat(e.target.value))}
              className="w-16 bg-[#0d0d0d] border border-[#2a2a2a] rounded px-2 py-0.5
                         text-xs text-white text-right focus:outline-none focus:border-[#444]"
            />
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange(DEFAULT_PARAMS)}
        className="mt-2 text-xs text-[#444] hover:text-[#888] transition-colors text-left"
      >
        ↺ restaurar valores del paper
      </button>
    </div>
  );
}
