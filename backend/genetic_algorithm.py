"""
Algoritmo Genético para detección de círculos en imágenes.

Implementación basada en:
  Ayala-Ramírez V., García-Capulín C.H., Pérez-García A., Sanchez-Yanez R.E.
  "Circle detection on images using genetic algorithms"
  Pattern Recognition Letters 27 (2006), pp. 652-657.
"""

import numpy as np
from fitness import evaluar_aptitud, circulo_desde_tres_puntos, construir_rejilla_bordes

# Valores por defecto del paper 
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

APTITUD_MINIMA_PRIMER       = 0.20 # Aptitud mínima absoluta para el primer círculo
FRACCION_APTITUD_MINIMA     = 0.30 # Los siguientes deben tener al menos el 30% del primero
MARGEN_SUPRESION            = 8    # Multiplicador de delta para eliminar puntos ya usados
MAX_CIRCULOS_POSIBLES       = 20   # Límite de seguridad para evitar bucles infinitos
MINIMOS_PUNTOS_RESTANTES    = 50   # Mínimo de puntos para intentar otra detección
UMBRAL_DUPLICADO_CENTRO     = 10   # Diferencia máxima de centro (px) para considerar duplicado
UMBRAL_DUPLICADO_RADIO      = 15   # Diferencia máxima de radio (px) para considerar duplicado


#  Clase principal 

class DetectorCirculosGA:
    """
    Detecta el mejor círculo en una imagen usando un algoritmo genético.
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

    #  Inicialización 

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

    #  Evaluación 

    def _evaluar_poblacion(self, poblacion: np.ndarray, puntos_borde: np.ndarray,
                           rejilla_bordes: np.ndarray,
                           forma_imagen: tuple, delta: float) -> np.ndarray:
        """Calcula la aptitud de cada individuo de la población."""
        aptitudes = [
            evaluar_aptitud(individuo, puntos_borde, rejilla_bordes, forma_imagen, delta)
            for individuo in poblacion
        ]
        return np.array(aptitudes)

    #  Selección 

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

    #  Cruce 

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

    #  Mutación 

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

    #  Ciclo de una ejecución 

    def _ejecutar_una_vez(self, puntos_borde: np.ndarray, rejilla_bordes: np.ndarray,
                          forma_imagen: tuple, delta: float, num_generaciones: int):
        """
        Ejecuta UNA pasada completa del GA y retorna el mejor individuo
        encontrado junto con su aptitud.
        """
        num_puntos    = len(puntos_borde)
        poblacion     = self._inicializar_poblacion(num_puntos, puntos_borde)
        mejor_ind     = None
        mejor_apt     = -1.0

        for _ in range(num_generaciones):
            aptitudes       = self._evaluar_poblacion(poblacion, puntos_borde, rejilla_bordes, forma_imagen, delta)
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

        # La rejilla se construye UNA vez para este conjunto de puntos y se
        # reutiliza en todos los reinicios: O(N·delta²) en lugar de O(Ns·N) por evaluación.
        rejilla_bordes = construir_rejilla_bordes(puntos_borde, forma_imagen, delta)

        mejor_individuo_global = None
        mejor_aptitud_global   = -1.0

        for _ in range(NUMERO_REINICIOS):
            mejor_ind, mejor_apt = self._ejecutar_una_vez(
                puntos_borde, rejilla_bordes, forma_imagen, delta, generaciones_por_reinicio
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

    #  Verificación de duplicados 

    def _es_duplicado(self, circulo_nuevo: dict, circulos_encontrados: list) -> bool:
        """
        Comprueba si el círculo nuevo es demasiado similar a alguno ya encontrado.
        Evita que una supresión imperfecta vuelva a detectar el mismo círculo.
        """
        cx = circulo_nuevo["x"]
        cy = circulo_nuevo["y"]
        r  = circulo_nuevo["r"]

        for c in circulos_encontrados:
            dist_centros = ((cx - c["x"]) ** 2 + (cy - c["y"]) ** 2) ** 0.5
            diff_radio   = abs(r - c["r"])
            if dist_centros < UMBRAL_DUPLICADO_CENTRO and diff_radio < UMBRAL_DUPLICADO_RADIO:
                return True
        return False

    #  Ciclo principal con detección secuencial 

    def detectar(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                 delta: float = DELTA_TOLERANCIA) -> dict:
        """
        Detecta todos los círculos presentes en la imagen usando supresión secuencial.

        Algoritmo:
          1. Buscar el mejor círculo en los puntos disponibles.
          2. Si su aptitud está por debajo del umbral mínimo, parar.
          3. Si es casi igual a uno ya encontrado, parar.
          4. Eliminar los puntos de borde cercanos a ese círculo.
          5. Repetir con los puntos restantes.
        """
        if len(puntos_borde) < GENES_POR_INDIVIDUO:
            return {"circulos": [], "mejor_aptitud": 0.0}

        circulos_encontrados  = []
        aptitudes_encontradas = []
        puntos_disponibles    = puntos_borde.copy()
        aptitud_referencia    = None   # aptitud del primer círculo encontrado

        while len(circulos_encontrados) < MAX_CIRCULOS_POSIBLES:
            if len(puntos_disponibles) < MINIMOS_PUNTOS_RESTANTES:
                break

            circulo, aptitud = self._buscar_mejor_circulo(
                puntos_disponibles, forma_imagen, delta
            )

            if circulo is None:
                break

            # Primer círculo: umbral absoluto para asegurar calidad mínima
            if aptitud_referencia is None:
                if aptitud < APTITUD_MINIMA_PRIMER:
                    break
                aptitud_referencia = aptitud
            else:
                # Círculos siguientes: umbral relativo al primero (adapta a la imagen)
                if aptitud < aptitud_referencia * FRACCION_APTITUD_MINIMA:
                    break

            # Parar si es casi igual a un círculo que ya encontramos
            if self._es_duplicado(circulo, circulos_encontrados):
                break

            circulos_encontrados.append(circulo)
            aptitudes_encontradas.append(aptitud)

            # Enmascarar el disco completo del círculo detectado.
            # El paper (sección 3.4) dice: "This shape is then masked on the
            # edge image". La fórmula anterior solo quitaba la banda del
            # perímetro, dejando el interior intacto y permitiendo que la
            # textura interna generara círculos fantasma.
            cx, cy, r = circulo["x"], circulo["y"], circulo["r"]
            dist_al_centro = np.sqrt(
                (puntos_disponibles[:, 0] - cx) ** 2 +
                (puntos_disponibles[:, 1] - cy) ** 2
            )
            mascara_lejanos    = dist_al_centro > r + delta * MARGEN_SUPRESION
            puntos_disponibles = puntos_disponibles[mascara_lejanos]

        mejor_aptitud_global = aptitudes_encontradas[0] if aptitudes_encontradas else 0.0

        return {
            "circulos":      circulos_encontrados,
            "mejor_aptitud": mejor_aptitud_global,
        }
