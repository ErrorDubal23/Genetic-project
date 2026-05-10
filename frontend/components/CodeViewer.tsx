"use client";
import { useState, useEffect, useRef } from "react";

const FILES: Record<string, string> = {
  "genetic_algorithm.py": `class GeneticCircleDetector:
    """
    Ayala-Ramírez et al. (2006) — Sección 4
    Representación: 3 índices de puntos de borde.
    """
    def __init__(self, population_size=70, crossover_prob=0.55,
                 mutation_prob=0.10, elite_count=2, max_generations=500):
        self.pop_size = population_size
        self.pc = crossover_prob
        self.pm = mutation_prob
        self.elite = elite_count
        self.max_gen = max_generations

    def detect(self, edge_points, img_shape, delta=2.0):
        pop = self._init_population(len(edge_points))
        best_ind, best_fit = None, -1.0

        for _ in range(self.max_gen):
            fits = self._evaluate(pop, edge_points, img_shape, delta)
            elite_idx = np.argsort(fits)[-self.elite:]
            elites = pop[elite_idx].copy()

            if fits[elite_idx[-1]] > best_fit:
                best_fit = fits[elite_idx[-1]]
                best_ind = pop[elite_idx[-1]].copy()

            selected = self._roulette_select(pop, fits)
            offspring = self._crossover(selected)
            offspring = self._mutate(offspring, len(edge_points))
            pop = offspring
        ...`,

  "fitness.py": `def evaluate_fitness(individual, edge_points, img_shape, delta=2.0):
    """
    Aptitud = fracción de puntos de borde a distancia <= delta
    del círculo candidato.  Eq. (1) — Ayala-Ramírez et al. (2006)
    """
    p1, p2, p3 = edge_points[individual]
    result = circle_from_three_points(p1, p2, p3)
    if result is None:
        return 0.0

    cx, cy, r = result
    dists = np.abs(
        np.sqrt((edge_points[:,0]-cx)**2 + (edge_points[:,1]-cy)**2) - r
    )
    return np.sum(dists <= delta) / len(edge_points)`,

  "image_utils.py": `def preprocess(img):
    """Sobel edge detection pipeline."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5,5), 0)
    sx   = cv2.Sobel(blur, cv2.CV_64F, 1, 0, ksize=3)
    sy   = cv2.Sobel(blur, cv2.CV_64F, 0, 1, ksize=3)
    mag  = np.sqrt(sx**2 + sy**2)
    mag  = np.uint8(255 * mag / mag.max())
    _, edge = cv2.threshold(mag, 30, 255, cv2.THRESH_BINARY)
    return edge`,
};

const SPEED = 18; // chars per frame tick (ms)

export default function CodeViewer() {
  const tabs = Object.keys(FILES);
  const [active, setActive] = useState(tabs[0]);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idxRef = useRef(0);

  const startTypewriter = (content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayed("");
    idxRef.current = 0;
    setTyping(true);

    const tick = () => {
      idxRef.current += SPEED;
      setDisplayed(content.slice(0, idxRef.current));
      if (idxRef.current < content.length) {
        timerRef.current = setTimeout(tick, 16);
      } else {
        setDisplayed(content);
        setTyping(false);
      }
    };
    timerRef.current = setTimeout(tick, 60);
  };

  useEffect(() => {
    startTypewriter(FILES[active]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="rounded border border-[#2a2a2a] bg-[#0a0a0a] overflow-hidden text-xs font-mono">
      {/* Tabs */}
      <div className="flex border-b border-[#1e1e1e] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`px-4 py-2 text-[11px] whitespace-nowrap transition-colors
              ${active === t
                ? "text-white border-b border-white -mb-px bg-[#141414]"
                : "text-[#555] hover:text-[#888]"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Code body */}
      <div className="p-4 overflow-auto max-h-[340px]">
        <pre className="leading-relaxed text-[#ccc]">
          {displayed}
          {typing && <span className="animate-pulse text-white">▌</span>}
        </pre>
      </div>
    </div>
  );
}
