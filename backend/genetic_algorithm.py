"""
Implementación del GA según Ayala-Ramírez et al. (2006):
- Representación: 3 índices de puntos de borde (Sección 4.1)
- Selección: ruleta proporcional a la aptitud (Sección 4.3)
- Cruce: 1-punto (Sección 4.4)
- Mutación: reemplazo aleatorio de un gen (Sección 4.5)
- Elitismo: los 2 mejores pasan intactos (Sección 4.6)
"""
import numpy as np
from fitness import evaluate_fitness, circle_from_three_points


class GeneticCircleDetector:
    def __init__(
        self,
        population_size: int = 70,
        crossover_prob: float = 0.55,
        mutation_prob: float = 0.10,
        elite_count: int = 2,
        max_generations: int = 500,
    ):
        self.pop_size = population_size
        self.pc = crossover_prob
        self.pm = mutation_prob
        self.elite = elite_count
        self.max_gen = max_generations

    # ------------------------------------------------------------------
    def _init_population(self, n_points: int) -> np.ndarray:
        return np.random.randint(0, n_points, size=(self.pop_size, 3))

    def _evaluate(self, pop, edge_points, img_shape, delta):
        return np.array([evaluate_fitness(ind, edge_points, img_shape, delta) for ind in pop])

    def _roulette_select(self, pop, fitnesses):
        total = fitnesses.sum()
        if total == 0:
            probs = np.ones(len(pop)) / len(pop)
        else:
            probs = fitnesses / total
        idx = np.random.choice(len(pop), size=len(pop), replace=True, p=probs)
        return pop[idx]

    def _crossover(self, pop):
        new_pop = pop.copy()
        for i in range(0, self.pop_size - 1, 2):
            if np.random.rand() < self.pc:
                point = np.random.randint(1, 3)
                new_pop[i, point:], new_pop[i + 1, point:] = (
                    pop[i + 1, point:].copy(),
                    pop[i, point:].copy(),
                )
        return new_pop

    def _mutate(self, pop, n_points):
        for i in range(self.pop_size):
            if np.random.rand() < self.pm:
                gene = np.random.randint(3)
                pop[i, gene] = np.random.randint(n_points)
        return pop

    # ------------------------------------------------------------------
    def detect(self, edge_points: np.ndarray, img_shape: tuple,
                delta: float = 2.0) -> dict:
        n = len(edge_points)
        if n < 3:
            return {"circles": [], "best_fitness": 0.0}

        pop = self._init_population(n)
        best_ind, best_fit = None, -1.0

        for _ in range(self.max_gen):
            fits = self._evaluate(pop, edge_points, img_shape, delta)

            # Elitismo
            elite_idx = np.argsort(fits)[-self.elite:]
            elites = pop[elite_idx].copy()
            elite_fits = fits[elite_idx]

            gen_best = elite_idx[-1]
            if fits[gen_best] > best_fit:
                best_fit = fits[gen_best]
                best_ind = pop[gen_best].copy()

            # Reproducción
            selected = self._roulette_select(pop, fits)
            offspring = self._crossover(selected)
            offspring = self._mutate(offspring, n)

            # Reemplazar los peores con los élites
            worst_idx = np.argsort(
                self._evaluate(offspring, edge_points, img_shape, delta)
            )[: self.elite]
            for k, wi in enumerate(worst_idx):
                offspring[wi] = elites[k]

            pop = offspring

        circles = []
        if best_ind is not None and best_fit > 0:
            p1, p2, p3 = edge_points[best_ind[0]], edge_points[best_ind[1]], edge_points[best_ind[2]]
            result = circle_from_three_points(p1, p2, p3)
            if result:
                cx, cy, r = result
                circles.append({"x": round(cx, 2), "y": round(cy, 2), "r": round(r, 2)})

        return {"circles": circles, "best_fitness": round(best_fit, 4)}
