"""
Algoritmo Genético para detección de círculos en imágenes.

Implementación basada en:
  Ayala-Ramírez V., García-Capulín C.H., Pérez-García A., Sanchez-Yanez R.E.
  "Circle detection on images using genetic algorithms"
  Pattern Recognition Letters 27 (2006), pp. 652-657.
"""

import numpy as np
from fitness import (
    evaluar_aptitud,
    circulo_desde_tres_puntos,
    construir_rejilla_bordes,
    verificar_continuidad_circulo,
    FRACCION_SECTORES_MINIMA,
    MIN_SECTORES_CONSECUTIVOS,
    MAX_ARCOS_SEPARADOS,
)

# ── Parámetros del GA (Tabla 1 del paper) ────────────────────────────────────
TAMANIO_POBLACION  = 70     # Número de individuos
PROB_CRUCE         = 0.55   # Probabilidad de cruce de un punto
PROB_MUTACION      = 0.10   # Probabilidad de mutar un bit
NUM_ELITE          = 2      # Individuos élite que pasan sin cambios
MAX_GENERACIONES   = 500    # Generaciones totales (repartidas entre reinicios)
DELTA_TOLERANCIA   = 2.0    # Tolerancia en píxeles para la rejilla de bordes

# ── Parámetros de búsqueda ────────────────────────────────────────────────────
GENES_POR_INDIVIDUO     = 3   # Cromosoma = 3 índices de puntos de borde
NUMERO_REINICIOS        = 5   # Multi-arranque: cuántas veces se reinicia el GA
INTENTOS_INICIALIZACION = 8   # Intentos para sembrar individuos bien repartidos
DISTANCIA_MINIMA_PUNTOS = 20  # Separación mínima (px) entre los 3 puntos semilla

# ── Umbrales de aceptación ────────────────────────────────────────────────────
APTITUD_MINIMA_PRIMER    = 0.38  # Aptitud mínima — aplica a TODOS los círculos
APTITUD_MINIMA_RESTO     = 0.42  # Umbral absoluto para los círculos 2, 3, 4…
                                 # Fijo e independiente del primer círculo, evita que
                                 # variaciones de calidad entre círculos (p.ej. uno con
                                 # borde blanco visible y otro sin él) afecten la detección.
FRACCION_APTITUD_MINIMA  = 0.50  # Respaldo relativo: si el primero fue excepcionalmente bueno

# ── Supresión y límites ───────────────────────────────────────────────────────
MARGEN_SUPRESION         = 8    # Multiplicador de delta para el radio de enmascarado
MAX_CIRCULOS_POSIBLES    = 20   # Tope de seguridad del bucle
MINIMOS_PUNTOS_RESTANTES = 50   # Mínimo de puntos para seguir buscando
UMBRAL_DUPLICADO_CENTRO  = 10   # Distancia máxima entre centros para ser duplicado (px)
UMBRAL_DUPLICADO_RADIO   = 15   # Diferencia máxima de radio para ser duplicado (px)


class DetectorCirculosGA:
    """
    Detecta círculos en una imagen usando un Algoritmo Genético.
    Cada individuo codifica tres índices de puntos de borde; el círculo
    que pasa por esos tres puntos es el candidato evaluado.
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
        p1, p2, p3 = puntos_borde[indices]
        d12 = float(np.sqrt(np.sum((p1 - p2) ** 2)))
        d13 = float(np.sqrt(np.sum((p1 - p3) ** 2)))
        d23 = float(np.sqrt(np.sum((p2 - p3) ** 2)))
        return min(d12, d13, d23)

    def _inicializar_poblacion(self, num_puntos: int,
                               puntos_borde: np.ndarray) -> np.ndarray:
        """
        Crea la población inicial favoreciendo individuos cuyos 3 puntos
        estén bien separados entre sí (círculos más estables).
        """
        poblacion = np.zeros((self.tamanio_poblacion, GENES_POR_INDIVIDUO), dtype=int)

        for i in range(self.tamanio_poblacion):
            mejor = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
            mejor_sep = self._separacion_minima(mejor, puntos_borde)

            for _ in range(INTENTOS_INICIALIZACION):
                candidato = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
                sep = self._separacion_minima(candidato, puntos_borde)
                if sep > mejor_sep:
                    mejor     = candidato
                    mejor_sep = sep

            poblacion[i] = mejor

        return poblacion

    # ── Evaluación ────────────────────────────────────────────────────────────

    def _evaluar_poblacion(self, poblacion: np.ndarray, puntos_borde: np.ndarray,
                           rejilla_bordes: np.ndarray,
                           forma_imagen: tuple, delta: float) -> np.ndarray:
        aptitudes = [
            evaluar_aptitud(ind, puntos_borde, rejilla_bordes, forma_imagen, delta)
            for ind in poblacion
        ]
        return np.array(aptitudes)

    # ── Selección (ruleta) ────────────────────────────────────────────────────

    def _seleccion_ruleta(self, poblacion: np.ndarray,
                          aptitudes: np.ndarray) -> np.ndarray:
        """Selección proporcional a la aptitud (sección 2.4 del paper)."""
        suma = aptitudes.sum()
        if suma == 0:
            probs = np.ones(self.tamanio_poblacion) / self.tamanio_poblacion
        else:
            probs = aptitudes / suma

        indices = np.random.choice(self.tamanio_poblacion,
                                   size=self.tamanio_poblacion,
                                   replace=True, p=probs)
        return poblacion[indices]

    # ── Cruce de un punto ─────────────────────────────────────────────────────

    def _cruce_un_punto(self, poblacion: np.ndarray) -> np.ndarray:
        """Cruce de un punto entre pares consecutivos (sección 2.4 del paper)."""
        descendencia = poblacion.copy()
        for i in range(0, self.tamanio_poblacion - 1, 2):
            if np.random.rand() < self.prob_cruce:
                corte = np.random.randint(1, GENES_POR_INDIVIDUO)
                tmp                            = poblacion[i,     corte:].copy()
                descendencia[i,     corte:]    = poblacion[i + 1, corte:]
                descendencia[i + 1, corte:]    = tmp
        return descendencia

    # ── Mutación ──────────────────────────────────────────────────────────────

    def _mutar(self, poblacion: np.ndarray, num_puntos: int) -> np.ndarray:
        """Mutación por reemplazo de un índice aleatorio (sección 2.4 del paper)."""
        for i in range(self.tamanio_poblacion):
            if np.random.rand() < self.prob_mutacion:
                gen = np.random.randint(GENES_POR_INDIVIDUO)
                otros = set(poblacion[i]) - {int(poblacion[i, gen])}
                nuevo = np.random.randint(num_puntos)
                intentos = 0
                while nuevo in otros and intentos < 15:
                    nuevo    = np.random.randint(num_puntos)
                    intentos += 1
                poblacion[i, gen] = nuevo
        return poblacion

    # ── Ciclo de una ejecución ────────────────────────────────────────────────

    def _ejecutar_una_vez(self, puntos_borde: np.ndarray,
                          rejilla_bordes: np.ndarray,
                          forma_imagen: tuple, delta: float,
                          num_generaciones: int):
        num_puntos = len(puntos_borde)
        poblacion  = self._inicializar_poblacion(num_puntos, puntos_borde)
        mejor_ind  = None
        mejor_apt  = -1.0

        for _ in range(num_generaciones):
            aptitudes = self._evaluar_poblacion(
                poblacion, puntos_borde, rejilla_bordes, forma_imagen, delta
            )
            orden      = np.argsort(aptitudes)
            elite      = poblacion[orden[-self.num_elite:]].copy()
            apt_elite  = aptitudes[orden[-self.num_elite:]]

            if float(apt_elite[-1]) > mejor_apt:
                mejor_apt = float(apt_elite[-1])
                mejor_ind = elite[-1].copy()

            seleccionados = self._seleccion_ruleta(poblacion, aptitudes)
            descendencia  = self._cruce_un_punto(seleccionados)
            descendencia  = self._mutar(descendencia, num_puntos)
            descendencia[:self.num_elite] = elite
            poblacion = descendencia

        return mejor_ind, mejor_apt

    # ── Búsqueda del mejor círculo en un conjunto de puntos ──────────────────

    def _buscar_mejor_circulo(self, puntos_borde: np.ndarray,
                               forma_imagen: tuple, delta: float):
        """
        Ejecuta el GA con multi-arranque y retorna el mejor círculo encontrado
        junto con su aptitud y la rejilla de bordes (reutilizable para validación).
        """
        generaciones_por_reinicio = max(1, self.max_generaciones // NUMERO_REINICIOS)
        rejilla_bordes = construir_rejilla_bordes(puntos_borde, forma_imagen, delta)

        mejor_ind_global = None
        mejor_apt_global = -1.0

        for _ in range(NUMERO_REINICIOS):
            mejor_ind, mejor_apt = self._ejecutar_una_vez(
                puntos_borde, rejilla_bordes, forma_imagen, delta,
                generaciones_por_reinicio
            )
            if mejor_apt > mejor_apt_global:
                mejor_apt_global = mejor_apt
                mejor_ind_global = mejor_ind

        if mejor_ind_global is None or mejor_apt_global <= 0:
            return None, mejor_apt_global, rejilla_bordes

        p1 = puntos_borde[mejor_ind_global[0]]
        p2 = puntos_borde[mejor_ind_global[1]]
        p3 = puntos_borde[mejor_ind_global[2]]

        resultado = circulo_desde_tres_puntos(p1, p2, p3)
        if resultado is None:
            return None, mejor_apt_global, rejilla_bordes

        cx, cy, r = resultado
        circulo = {
            "x": round(float(cx), 2),
            "y": round(float(cy), 2),
            "r": round(float(r),  2),
        }
        return circulo, round(float(mejor_apt_global), 4), rejilla_bordes

    # ── Validación de continuidad (sección 3.4 del paper) ────────────────────

    def _validar_circulo(self, circulo: dict, rejilla_bordes: np.ndarray,
                          forma_imagen: tuple) -> bool:
        """
        Verifica que el borde que soporta al círculo sea un arco real y no
        el resultado accidental de aristas rectas de polígonos.

        Tres criterios complementarios:
          1. fraccion_sectores >= 0.30  — suficiente cobertura global
          2. max_consecutivos  >= 4     — arco continuo de al menos 120°
          3. numero_arcos      <= 2     — no más de 2 segmentos de arco separados

        Un círculo real (incluso con oclusión significativa) cumple los tres.
        Un fantasma de polígono falla al menos uno: las aristas rectas solo
        cruzan la circunferencia en 2 puntos por arista, creando arcos muy
        cortos y dispersos.

        Referencia: Kelly y Levine (1997), citado en sección 3.4 del paper.
        """
        fraccion, max_cons, num_arcos = verificar_continuidad_circulo(
            circulo["x"], circulo["y"], circulo["r"],
            rejilla_bordes, forma_imagen
        )
        return (fraccion    >= FRACCION_SECTORES_MINIMA
                and max_cons >= MIN_SECTORES_CONSECUTIVOS
                and num_arcos <= MAX_ARCOS_SEPARADOS)

    # ── Verificación de duplicados ────────────────────────────────────────────

    def _es_duplicado(self, circulo_nuevo: dict,
                       circulos_encontrados: list) -> bool:
        cx = circulo_nuevo["x"]
        cy = circulo_nuevo["y"]
        r  = circulo_nuevo["r"]
        for c in circulos_encontrados:
            dist  = ((cx - c["x"]) ** 2 + (cy - c["y"]) ** 2) ** 0.5
            dradio = abs(r - c["r"])
            if dist < UMBRAL_DUPLICADO_CENTRO and dradio < UMBRAL_DUPLICADO_RADIO:
                return True
        return False

    # ── Bucle de detección secuencial (sección 3.4 del paper) ────────────────

    def detectar(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                 delta: float = DELTA_TOLERANCIA) -> dict:
        """
        Detecta todos los círculos de la imagen usando supresión secuencial.

        Algoritmo fiel al paper (sección 3.4):
          1. Ejecutar el GA sobre los puntos disponibles → mejor candidato C.
          2. Si la aptitud de C no supera el umbral mínimo → parar.
          3. Validar la continuidad del arco de C:
             si falla → el mejor candidato posible no es un círculo real → parar.
          4. Enmascarar la región del círculo aceptado en el mapa de bordes.
          5. Repetir con los puntos restantes.

        Nota sobre el 'break' en la validación:
          Si el GA —con multi-arranque y 500 generaciones— produce como mejor
          candidato un círculo que no pasa la validación, significa que ya no
          quedan círculos reales en los puntos disponibles. Continuar buscando
          solo generaría falsos positivos progresivamente peores.
        """
        if len(puntos_borde) < GENES_POR_INDIVIDUO:
            return {"circulos": [], "mejor_aptitud": 0.0}

        circulos_encontrados  = []
        aptitudes_encontradas = []
        puntos_disponibles    = puntos_borde.copy()
        aptitud_referencia    = None

        while len(circulos_encontrados) < MAX_CIRCULOS_POSIBLES:
            if len(puntos_disponibles) < MINIMOS_PUNTOS_RESTANTES:
                break

            circulo, aptitud, rejilla_actual = self._buscar_mejor_circulo(
                puntos_disponibles, forma_imagen, delta
            )

            if circulo is None:
                break

            # Umbral absoluto: si incluso el mejor candidato es muy débil, no hay círculos
            if aptitud < APTITUD_MINIMA_PRIMER:
                break

            # Para el 2º círculo en adelante: usar el mayor entre el umbral absoluto
            # (APTITUD_MINIMA_RESTO) y el relativo (FRACCION × primero).
            # El absoluto protege cuando los círculos tienen distinta calidad de borde
            # (p.ej. uno con trazo blanco visible y otro sin él).
            if aptitud_referencia is not None:
                umbral = max(APTITUD_MINIMA_RESTO,
                             aptitud_referencia * FRACCION_APTITUD_MINIMA)
                if aptitud < umbral:
                    break

            # Validación de continuidad (sección 3.4 del paper)
            # Si el mejor candidato falla → no hay más círculos reales → parar
            if not self._validar_circulo(circulo, rejilla_actual, forma_imagen):
                break

            # Ignorar si es casi idéntico a uno ya encontrado
            if self._es_duplicado(circulo, circulos_encontrados):
                break

            # Registrar la aptitud de referencia con el primer círculo aceptado
            if aptitud_referencia is None:
                aptitud_referencia = aptitud

            circulos_encontrados.append(circulo)
            aptitudes_encontradas.append(aptitud)

            # Enmascarar el ANILLO del perímetro del círculo detectado.
            # "This shape is then masked on the edge image" (sección 3.4 del paper).
            #
            # Usamos máscara de anillo (|dist - r| > margen) en lugar de disco completo
            # para preservar los bordes de círculos adyacentes que podrían solaparse con
            # el disco. Con máscara de disco se eliminan puntos del borde del siguiente
            # círculo cuando los círculos están cerca o tocándose, reduciendo su aptitud.
            # La máscara de anillo solo elimina los píxeles del borde ya encontrado.
            cx, cy, r = circulo["x"], circulo["y"], circulo["r"]
            dist = np.sqrt(
                (puntos_disponibles[:, 0] - cx) ** 2 +
                (puntos_disponibles[:, 1] - cy) ** 2
            )
            fuera_anillo   = np.abs(dist - r) > delta * MARGEN_SUPRESION
            puntos_disponibles = puntos_disponibles[fuera_anillo]

        mejor_aptitud_global = aptitudes_encontradas[0] if aptitudes_encontradas else 0.0

        return {
            "circulos":      circulos_encontrados,
            "mejor_aptitud": mejor_aptitud_global,
        }
