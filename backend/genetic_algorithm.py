"""
Algoritmo Genético para detección de círculos en imágenes.

Implementación basada en:
  Ayala-Ramírez V., García-Capulín C.H., Pérez-García A., Sanchez-Yanez R.E.
  "Circle detection on images using genetic algorithms"
  Pattern Recognition Letters 27 (2006), pp. 652-657.

Mejoras aplicadas sobre el esquema original:
  - Inicialización con separación mínima entre los 3 puntos (evita individuos
    degenerados donde los 3 puntos son casi el mismo).
  - Mutación sin índices duplicados dentro de un individuo.
  - Multi-arranque: el GA corre NUMERO_REINICIOS veces con poblaciones
    frescas y se conserva el mejor resultado global. Esto divide las
    generaciones entre los reinicios pero aumenta mucho la diversidad.
"""

import numpy as np
from fitness import evaluar_aptitud, circulo_desde_tres_puntos

# ── Valores por defecto del paper ────────────────────────────────────────────
TAMANIO_POBLACION  = 70     # Número de individuos
PROB_CRUCE         = 0.55   # Probabilidad de cruce entre pares
PROB_MUTACION      = 0.10   # Probabilidad de mutar un individuo
NUM_ELITE          = 2      # Individuos élite que pasan sin cambios
MAX_GENERACIONES   = 500    # Generaciones totales (repartidas entre reinicios)
DELTA_TOLERANCIA   = 2.0    # Tolerancia en píxeles

GENES_POR_INDIVIDUO        = 3    # Cada individuo = 3 índices de puntos de borde
NUMERO_REINICIOS           = 3    # Cuántas veces se reinicia el GA desde cero
INTENTOS_INICIALIZACION    = 8    # Intentos para encontrar 3 puntos bien separados
DISTANCIA_MINIMA_PUNTOS    = 15   # Separación mínima (px) entre los 3 puntos

MAX_CIRCULOS               = 1    # Número máximo de círculos a detectar por defecto
APTITUD_MINIMA_SIGUIENTE   = 0.12 # Si el siguiente círculo tiene menos aptitud, se para
MARGEN_SUPRESION           = 5    # Multiplicador de delta para eliminar puntos ya usados


# ── Clase principal ──────────────────────────────────────────────────────────

class DetectorCirculosGA:
    """
    Detecta el mejor círculo en una imagen usando un algoritmo genético.

    Cada individuo de la población representa un círculo candidato,
    codificado como 3 índices de puntos del mapa de bordes de la imagen.
    """

    def __init__(
        self,
        tamanio_poblacion: int   = TAMANIO_POBLACION,
        prob_cruce:        float = PROB_CRUCE,
        prob_mutacion:     float = PROB_MUTACION,
        num_elite:         int   = NUM_ELITE,
        max_generaciones:  int   = MAX_GENERACIONES,
    ):
        self.tamanio_poblacion = tamanio_poblacion
        self.prob_cruce        = prob_cruce
        self.prob_mutacion     = prob_mutacion
        self.num_elite         = num_elite
        self.max_generaciones  = max_generaciones

    # ── Inicialización ────────────────────────────────────────────────────────

    def _separacion_minima(self, indices: np.ndarray,
                           puntos_borde: np.ndarray) -> float:
        """
        Calcula la distancia mínima entre los 3 puntos de un individuo.
        Valores más altos indican que los puntos están bien repartidos.
        """
        p1, p2, p3 = puntos_borde[indices]
        d12 = float(np.sqrt(np.sum((p1 - p2) ** 2)))
        d13 = float(np.sqrt(np.sum((p1 - p3) ** 2)))
        d23 = float(np.sqrt(np.sum((p2 - p3) ** 2)))
        return min(d12, d13, d23)

    def _inicializar_poblacion(self, num_puntos: int,
                               puntos_borde: np.ndarray) -> np.ndarray:
        """
        Crea la población inicial.

        Para cada individuo se generan INTENTOS_INICIALIZACION candidatos
        aleatorios (sin índices repetidos) y se conserva el que tiene
        mayor separación entre sus 3 puntos.

        Puntos bien separados forman círculos más estables y reducen los
        casos degenerados donde los 3 puntos son casi colineales.
        """
        poblacion = np.zeros((self.tamanio_poblacion, GENES_POR_INDIVIDUO), dtype=int)

        for i in range(self.tamanio_poblacion):
            mejor_individuo = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
            mejor_separacion = self._separacion_minima(mejor_individuo, puntos_borde)

            for _ in range(INTENTOS_INICIALIZACION):
                candidato   = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
                separacion  = self._separacion_minima(candidato, puntos_borde)
                if separacion > mejor_separacion:
                    mejor_individuo  = candidato
                    mejor_separacion = separacion

            poblacion[i] = mejor_individuo

        return poblacion

    # ── Evaluación ────────────────────────────────────────────────────────────

    def _evaluar_poblacion(self, poblacion: np.ndarray, puntos_borde: np.ndarray,
                           forma_imagen: tuple, delta: float) -> np.ndarray:
        """Calcula la aptitud de cada individuo de la población."""
        aptitudes = [
            evaluar_aptitud(individuo, puntos_borde, forma_imagen, delta)
            for individuo in poblacion
        ]
        return np.array(aptitudes)

    # ── Selección ─────────────────────────────────────────────────────────────

    def _seleccion_ruleta(self, poblacion: np.ndarray,
                          aptitudes: np.ndarray) -> np.ndarray:
        """
        Selección proporcional a la aptitud (ruleta).
        Los individuos con mayor aptitud tienen mayor probabilidad de ser elegidos.
        Referencia: Sección 4.3 del paper.
        """
        suma_total = aptitudes.sum()

        if suma_total == 0:
            probabilidades = np.ones(self.tamanio_poblacion) / self.tamanio_poblacion
        else:
            probabilidades = aptitudes / suma_total

        indices_seleccionados = np.random.choice(
            self.tamanio_poblacion,
            size=self.tamanio_poblacion,
            replace=True,
            p=probabilidades
        )
        return poblacion[indices_seleccionados]

    # ── Cruce ─────────────────────────────────────────────────────────────────

    def _cruce_un_punto(self, poblacion: np.ndarray) -> np.ndarray:
        """
        Cruce de un punto entre pares consecutivos.
        Con probabilidad prob_cruce se intercambian los genes a la derecha
        del punto de corte.
        Referencia: Sección 4.4 del paper.
        """
        descendencia = poblacion.copy()

        for i in range(0, self.tamanio_poblacion - 1, 2):
            if np.random.rand() < self.prob_cruce:
                punto_de_corte = np.random.randint(1, GENES_POR_INDIVIDUO)
                genes_temp                           = poblacion[i, punto_de_corte:].copy()
                descendencia[i,     punto_de_corte:] = poblacion[i + 1, punto_de_corte:]
                descendencia[i + 1, punto_de_corte:] = genes_temp

        return descendencia

    # ── Mutación ──────────────────────────────────────────────────────────────

    def _mutar(self, poblacion: np.ndarray, num_puntos_borde: int) -> np.ndarray:
        """
        Mutación: reemplaza un gen por un nuevo índice aleatorio.

        Garantiza que el individuo mutado no tenga índices duplicados,
        lo que evitaría calcular un círculo con dos puntos idénticos.
        Referencia: Sección 4.5 del paper.
        """
        for i in range(self.tamanio_poblacion):
            if np.random.rand() < self.prob_mutacion:
                gen_a_mutar  = np.random.randint(GENES_POR_INDIVIDUO)
                otros_indices = set(poblacion[i]) - {int(poblacion[i, gen_a_mutar])}

                nuevo_indice = np.random.randint(num_puntos_borde)
                intentos     = 0
                while nuevo_indice in otros_indices and intentos < 15:
                    nuevo_indice = np.random.randint(num_puntos_borde)
                    intentos    += 1

                poblacion[i, gen_a_mutar] = nuevo_indice

        return poblacion

    # ── Ciclo de una ejecución ────────────────────────────────────────────────

    def _ejecutar_una_vez(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                          delta: float, num_generaciones: int):
        """
        Ejecuta UNA pasada completa del GA y retorna el mejor individuo
        encontrado junto con su aptitud.
        """
        num_puntos    = len(puntos_borde)
        poblacion     = self._inicializar_poblacion(num_puntos, puntos_borde)
        mejor_ind     = None
        mejor_apt     = -1.0

        for _ in range(num_generaciones):
            aptitudes       = self._evaluar_poblacion(poblacion, puntos_borde, forma_imagen, delta)
            elite           = poblacion[np.argsort(aptitudes)[-self.num_elite:]].copy()
            aptitudes_elite = np.sort(aptitudes)[-self.num_elite:]

            aptitud_mejor_generacion = float(aptitudes_elite[-1])
            if aptitud_mejor_generacion > mejor_apt:
                mejor_apt = aptitud_mejor_generacion
                mejor_ind = elite[-1].copy()

            seleccionados = self._seleccion_ruleta(poblacion, aptitudes)
            descendencia  = self._cruce_un_punto(seleccionados)
            descendencia  = self._mutar(descendencia, num_puntos)

            # Elitismo: los mejores de la generación anterior sobreviven
            descendencia[:self.num_elite] = elite

            poblacion = descendencia

        return mejor_ind, mejor_apt

    # ── Buscar el mejor círculo en un conjunto de puntos ─────────────────────

    def _buscar_mejor_circulo(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                              delta: float):
        """
        Ejecuta el GA con multi-arranque sobre los puntos dados y retorna
        el mejor individuo encontrado y su aptitud.
        """
        generaciones_por_reinicio = max(1, self.max_generaciones // NUMERO_REINICIOS)

        mejor_individuo_global = None
        mejor_aptitud_global   = -1.0

        for _ in range(NUMERO_REINICIOS):
            mejor_ind, mejor_apt = self._ejecutar_una_vez(
                puntos_borde, forma_imagen, delta, generaciones_por_reinicio
            )
            if mejor_apt > mejor_aptitud_global:
                mejor_aptitud_global   = mejor_apt
                mejor_individuo_global = mejor_ind

        # Convertir el mejor individuo a coordenadas de círculo
        if mejor_individuo_global is None or mejor_aptitud_global <= 0:
            return None, mejor_aptitud_global

        p1 = puntos_borde[mejor_individuo_global[0]]
        p2 = puntos_borde[mejor_individuo_global[1]]
        p3 = puntos_borde[mejor_individuo_global[2]]

        resultado_circulo = circulo_desde_tres_puntos(p1, p2, p3)
        if resultado_circulo is None:
            return None, mejor_aptitud_global

        centro_x, centro_y, radio = resultado_circulo
        circulo = {
            "x": round(float(centro_x), 2),
            "y": round(float(centro_y), 2),
            "r": round(float(radio),    2),
        }
        return circulo, round(float(mejor_aptitud_global), 4)

    # ── Ciclo principal con detección secuencial ──────────────────────────────

    def detectar(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                 delta: float = DELTA_TOLERANCIA,
                 max_circulos: int = MAX_CIRCULOS) -> dict:
        """
        Detecta hasta max_circulos círculos usando supresión secuencial.

        Algoritmo:
          1. Buscar el mejor círculo en los puntos disponibles.
          2. Eliminar los puntos de borde cercanos a ese círculo.
          3. Repetir con los puntos restantes hasta llegar a max_circulos
             o hasta que la aptitud del siguiente caiga por debajo del umbral.

        Parámetros:
            puntos_borde : array (N, 2) con coordenadas de píxeles de borde
            forma_imagen : tupla (alto, ancho, canales) de la imagen
            delta        : tolerancia en píxeles (~2 px según el paper)
            max_circulos : número máximo de círculos a detectar
        """
        if len(puntos_borde) < GENES_POR_INDIVIDUO:
            return {"circulos": [], "mejor_aptitud": 0.0}

        circulos_encontrados  = []
        aptitudes_encontradas = []
        puntos_disponibles    = puntos_borde.copy()

        for _ in range(max_circulos):
            if len(puntos_disponibles) < GENES_POR_INDIVIDUO:
                break

            circulo, aptitud = self._buscar_mejor_circulo(
                puntos_disponibles, forma_imagen, delta
            )

            # Si la aptitud es demasiado baja, no vale la pena seguir
            if circulo is None or aptitud < APTITUD_MINIMA_SIGUIENTE:
                break

            circulos_encontrados.append(circulo)
            aptitudes_encontradas.append(aptitud)

            # Suprimir puntos cercanos al círculo recién detectado
            # para que la siguiente pasada no vuelva a encontrar el mismo
            cx, cy, r = circulo["x"], circulo["y"], circulo["r"]
            dist_al_centro    = np.sqrt(
                (puntos_disponibles[:, 0] - cx) ** 2 +
                (puntos_disponibles[:, 1] - cy) ** 2
            )
            dist_al_perimetro = np.abs(dist_al_centro - r)
            mascara_lejanos   = dist_al_perimetro > delta * MARGEN_SUPRESION
            puntos_disponibles = puntos_disponibles[mascara_lejanos]

        mejor_aptitud_global = aptitudes_encontradas[0] if aptitudes_encontradas else 0.0

        return {
            "circulos":      circulos_encontrados,
            "mejor_aptitud": mejor_aptitud_global,
        }
