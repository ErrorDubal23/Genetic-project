"""
Aquí está el algoritmo genético que busca círculos en la imagen.

La idea general es la misma que la evolución biológica: tenemos una población
de círculos candidatos, los evaluamos, cruzamos los mejores entre sí y mutamos
algunos para explorar nuevas posibilidades. Después de varias generaciones,
el mejor círculo que sobrevivió es nuestra respuesta.

Basado en: Ayala-Ramírez et al. (2006), Pattern Recognition Letters 27, pp. 652-657.
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

# ── Parámetros del algoritmo genético (tomados de la Tabla 1 del paper) ───────
TAMANIO_POBLACION  = 70    # Cuántos círculos candidatos manejamos a la vez
PROB_CRUCE         = 0.55  # Probabilidad de que dos candidatos intercambien información
PROB_MUTACION      = 0.10  # Probabilidad de que un candidato cambie aleatoriamente
NUM_ELITE          = 2     # Cuántos de los mejores pasan directo a la siguiente generación
MAX_GENERACIONES   = 500   # Cuántas vueltas da el algoritmo en total
DELTA_TOLERANCIA   = 2.0   # Margen en píxeles para decidir si un punto está "sobre" el borde

# ── Cómo se arma cada candidato ───────────────────────────────────────────────
GENES_POR_INDIVIDUO     = 3  # Cada candidato se define por 3 puntos de borde
NUMERO_REINICIOS        = 5  # Cuántas veces arrancamos de cero para no quedarnos
                              # atrapados en una mala solución
INTENTOS_INICIALIZACION = 8  # Intentos para encontrar 3 puntos bien separados al inicio
DISTANCIA_MINIMA_PUNTOS = 20 # Los 3 puntos semilla deben estar al menos a esta
                              # distancia entre sí (en píxeles)

# ── Qué tan bueno debe ser un círculo para aceptarlo ─────────────────────────
APTITUD_MINIMA_PRIMER   = 0.45  # El primer círculo debe tener al menos el 45% de su
                                 # circunferencia respaldada por bordes reales.
                                 # Con 0.38 se aceptaban círculos muy débiles que en
                                 # imágenes complejas eran casi siempre falsos positivos.

APTITUD_MINIMA_RESTO    = 0.50  # Para el segundo círculo en adelante el umbral es más
                                 # alto, porque después de borrar el primero los bordes
                                 # que quedan son más ruidosos y engañan más fácil.

FRACCION_APTITUD_MINIMA = 0.70  # Cada círculo adicional debe ser al menos el 70% tan
                                 # bueno como el primero. Así evitamos que un primer
                                 # círculo muy claro "habilite" círculos fantasma débiles.

# ── Control del proceso de búsqueda ──────────────────────────────────────────
MARGEN_SUPRESION         = 8   # Al borrar un círculo ya detectado, eliminamos los bordes
                                # dentro de este margen (en múltiplos de delta)
MAX_CIRCULOS_POSIBLES    = 20  # Límite de seguridad: nunca reportamos más de 20 círculos
MINIMOS_PUNTOS_RESTANTES = 50  # Si quedan menos puntos de borde que esto, paramos
UMBRAL_DUPLICADO_CENTRO  = 10  # Dos círculos son "el mismo" si sus centros están a
                                # menos de 10 px de distancia...
UMBRAL_DUPLICADO_RADIO   = 15  # ...y sus radios difieren en menos de 15 px


class DetectorCirculosGA:
    """
    Esta clase hace todo el trabajo de detección.

    El proceso es:
      1. Toma los puntos de borde de la imagen.
      2. Crea una población de círculos candidatos (cada uno definido por 3 puntos).
      3. Los evoluciona durante varias generaciones para encontrar el mejor.
      4. Valida que lo encontrado sea realmente un círculo y no un polígono.
      5. Borra ese círculo de la imagen y repite para encontrar el siguiente.
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

    # ── Crear la población inicial ────────────────────────────────────────────

    def _separacion_minima(self, indices: np.ndarray,
                           puntos_borde: np.ndarray) -> float:
        # Calcula qué tan separados están los 3 puntos entre sí
        p1, p2, p3 = puntos_borde[indices]
        d12 = float(np.sqrt(np.sum((p1 - p2) ** 2)))
        d13 = float(np.sqrt(np.sum((p1 - p3) ** 2)))
        d23 = float(np.sqrt(np.sum((p2 - p3) ** 2)))
        return min(d12, d13, d23)

    def _inicializar_poblacion(self, num_puntos: int,
                               puntos_borde: np.ndarray) -> np.ndarray:
        """
        Crea los círculos candidatos iniciales.
        Para cada uno intentamos elegir 3 puntos que estén bien separados,
        porque 3 puntos muy juntos definen un círculo muy pequeño y poco útil.
        """
        poblacion = np.zeros((self.tamanio_poblacion, GENES_POR_INDIVIDUO), dtype=int)

        for i in range(self.tamanio_poblacion):
            mejor     = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
            mejor_sep = self._separacion_minima(mejor, puntos_borde)

            for _ in range(INTENTOS_INICIALIZACION):
                candidato = np.random.choice(num_puntos, GENES_POR_INDIVIDUO, replace=False)
                sep = self._separacion_minima(candidato, puntos_borde)
                if sep > mejor_sep:
                    mejor     = candidato
                    mejor_sep = sep

            poblacion[i] = mejor

        return poblacion

    # ── Evaluar toda la población ─────────────────────────────────────────────

    def _evaluar_poblacion(self, poblacion: np.ndarray, puntos_borde: np.ndarray,
                           rejilla_bordes: np.ndarray,
                           forma_imagen: tuple, delta: float) -> np.ndarray:
        # Le pone nota a cada candidato usando la función de aptitud
        aptitudes = [
            evaluar_aptitud(ind, puntos_borde, rejilla_bordes, forma_imagen, delta)
            for ind in poblacion
        ]
        return np.array(aptitudes)

    # ── Selección por ruleta ──────────────────────────────────────────────────

    def _seleccion_ruleta(self, poblacion: np.ndarray,
                          aptitudes: np.ndarray) -> np.ndarray:
        """
        Elige qué candidatos pasan a la siguiente generación.
        Los mejores tienen más probabilidad de ser elegidos, pero los peores
        también tienen alguna oportunidad (como una ruleta donde los mejores
        tienen una porción más grande).
        """
        suma = aptitudes.sum()
        if suma == 0:
            probs = np.ones(self.tamanio_poblacion) / self.tamanio_poblacion
        else:
            probs = aptitudes / suma

        indices = np.random.choice(self.tamanio_poblacion,
                                   size=self.tamanio_poblacion,
                                   replace=True, p=probs)
        return poblacion[indices]

    # ── Cruce entre candidatos ────────────────────────────────────────────────

    def _cruce_un_punto(self, poblacion: np.ndarray) -> np.ndarray:
        """
        Combina pares de candidatos para crear nuevos.
        Tomamos dos candidatos, elegimos un punto de corte al azar y
        intercambiamos la parte final de sus genes, como mezclar dos recetas.
        """
        descendencia = poblacion.copy()
        for i in range(0, self.tamanio_poblacion - 1, 2):
            if np.random.rand() < self.prob_cruce:
                corte = np.random.randint(1, GENES_POR_INDIVIDUO)
                tmp                         = poblacion[i,     corte:].copy()
                descendencia[i,     corte:] = poblacion[i + 1, corte:]
                descendencia[i + 1, corte:] = tmp
        return descendencia

    # ── Mutación ──────────────────────────────────────────────────────────────

    def _mutar(self, poblacion: np.ndarray, num_puntos: int) -> np.ndarray:
        """
        Cambia aleatoriamente uno de los 3 puntos de algunos candidatos.
        Esto evita que todos converjan a la misma solución y permite explorar
        partes de la imagen que de otra forma no se revisarían.
        """
        for i in range(self.tamanio_poblacion):
            if np.random.rand() < self.prob_mutacion:
                gen   = np.random.randint(GENES_POR_INDIVIDUO)
                otros = set(poblacion[i]) - {int(poblacion[i, gen])}
                nuevo = np.random.randint(num_puntos)
                intentos = 0
                while nuevo in otros and intentos < 15:
                    nuevo    = np.random.randint(num_puntos)
                    intentos += 1
                poblacion[i, gen] = nuevo
        return poblacion

    # ── Una corrida completa del GA ───────────────────────────────────────────

    def _ejecutar_una_vez(self, puntos_borde: np.ndarray,
                          rejilla_bordes: np.ndarray,
                          forma_imagen: tuple, delta: float,
                          num_generaciones: int):
        # Arranca con una población inicial y la hace evolucionar
        num_puntos = len(puntos_borde)
        poblacion  = self._inicializar_poblacion(num_puntos, puntos_borde)
        mejor_ind  = None
        mejor_apt  = -1.0

        for _ in range(num_generaciones):
            aptitudes = self._evaluar_poblacion(
                poblacion, puntos_borde, rejilla_bordes, forma_imagen, delta
            )
            orden     = np.argsort(aptitudes)
            elite     = poblacion[orden[-self.num_elite:]].copy()
            apt_elite = aptitudes[orden[-self.num_elite:]]

            # Guardamos el mejor que hayamos visto en toda la corrida
            if float(apt_elite[-1]) > mejor_apt:
                mejor_apt = float(apt_elite[-1])
                mejor_ind = elite[-1].copy()

            seleccionados = self._seleccion_ruleta(poblacion, aptitudes)
            descendencia  = self._cruce_un_punto(seleccionados)
            descendencia  = self._mutar(descendencia, num_puntos)
            descendencia[:self.num_elite] = elite  # Los élite siempre sobreviven
            poblacion = descendencia

        return mejor_ind, mejor_apt

    # ── Buscar el mejor círculo posible ───────────────────────────────────────

    def _buscar_mejor_circulo(self, puntos_borde: np.ndarray,
                               forma_imagen: tuple, delta: float):
        """
        Corre el GA varias veces desde cero y se queda con el mejor resultado.
        Hacemos esto porque el GA es aleatorio y a veces puede quedarse
        atascado en una solución mediocre.
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

    # ── Confirmar que el círculo es real ──────────────────────────────────────

    def _validar_circulo(self, circulo: dict, rejilla_bordes: np.ndarray,
                          forma_imagen: tuple) -> bool:
        """
        Antes de aceptar un círculo, verificamos que sus bordes formen
        un arco continuo y no sean puntos dispersos de un polígono.

        Tres condiciones que debe cumplir:
          1. Al menos el 30% de la circunferencia tiene borde (cobertura mínima).
          2. Hay un tramo continuo de al menos 120° con borde seguido.
          3. Los bordes están agrupados en máximo 2 pedazos separados.

        Un círculo real, aunque esté parcialmente tapado, cumple las tres.
        Un polígono falla al menos una: sus lados solo cruzan el círculo
        en puntos aislados, sin formar arcos continuos.
        """
        fraccion, max_cons, num_arcos = verificar_continuidad_circulo(
            circulo["x"], circulo["y"], circulo["r"],
            rejilla_bordes, forma_imagen
        )
        return (fraccion    >= FRACCION_SECTORES_MINIMA
                and max_cons >= MIN_SECTORES_CONSECUTIVOS
                and num_arcos <= MAX_ARCOS_SEPARADOS)

    # ── Revisar si ya detectamos ese círculo antes ────────────────────────────

    def _es_duplicado(self, circulo_nuevo: dict,
                       circulos_encontrados: list) -> bool:
        cx = circulo_nuevo["x"]
        cy = circulo_nuevo["y"]
        r  = circulo_nuevo["r"]
        for c in circulos_encontrados:
            dist   = ((cx - c["x"]) ** 2 + (cy - c["y"]) ** 2) ** 0.5
            dradio = abs(r - c["r"])
            if dist < UMBRAL_DUPLICADO_CENTRO and dradio < UMBRAL_DUPLICADO_RADIO:
                return True
        return False

    # ── Detección completa: buscar todos los círculos de la imagen ────────────

    def detectar(self, puntos_borde: np.ndarray, forma_imagen: tuple,
                 delta: float = DELTA_TOLERANCIA) -> dict:
        """
        Detecta todos los círculos de la imagen uno por uno.

        El proceso es:
          1. Buscamos el mejor círculo en los bordes disponibles.
          2. Si no es suficientemente bueno, paramos.
          3. Si no pasa la validación, paramos (lo mejor disponible ya no es
             un círculo real, así que no tiene sentido seguir buscando).
          4. Si pasa todo, lo registramos y borramos sus bordes de la imagen.
          5. Repetimos con los bordes restantes.

        Borramos los bordes del círculo encontrado (no todo el disco, sino solo
        el anillo del borde) para no afectar los bordes de otros círculos
        cercanos que todavía no hemos detectado.
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

            # Si el mejor candidato posible es muy débil, ya no hay círculos
            if aptitud < APTITUD_MINIMA_PRIMER:
                break

            # Para los círculos 2, 3, 4… exigimos que sean casi tan buenos
            # como el primero o que superen el umbral absoluto mínimo
            if aptitud_referencia is not None:
                umbral = max(APTITUD_MINIMA_RESTO,
                             aptitud_referencia * FRACCION_APTITUD_MINIMA)
                if aptitud < umbral:
                    break

            # Si los bordes no forman un arco continuo, no es un círculo real
            if not self._validar_circulo(circulo, rejilla_actual, forma_imagen):
                break

            # Si ya encontramos uno casi igual, lo ignoramos
            if self._es_duplicado(circulo, circulos_encontrados):
                break

            if aptitud_referencia is None:
                aptitud_referencia = aptitud

            circulos_encontrados.append(circulo)
            aptitudes_encontradas.append(aptitud)

            # Borramos los bordes del círculo recién encontrado
            # Solo borramos el anillo del borde, no el disco completo,
            # para no afectar círculos cercanos que todavía no detectamos
            cx, cy, r = circulo["x"], circulo["y"], circulo["r"]
            dist = np.sqrt(
                (puntos_disponibles[:, 0] - cx) ** 2 +
                (puntos_disponibles[:, 1] - cy) ** 2
            )
            fuera_anillo       = np.abs(dist - r) > delta * MARGEN_SUPRESION
            puntos_disponibles = puntos_disponibles[fuera_anillo]

        mejor_aptitud_global = aptitudes_encontradas[0] if aptitudes_encontradas else 0.0

        return {
            "circulos":      circulos_encontrados,
            "mejor_aptitud": mejor_aptitud_global,
        }
