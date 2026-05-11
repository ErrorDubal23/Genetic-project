"""
Función de aptitud para el algoritmo genético de detección de círculos.

Implementación fiel a: Ayala-Ramírez et al. (2006), Secciones 2.2 y 2.3.
Pattern Recognition Letters 27, pp. 652-657.
"""

import math
import numpy as np

#  Constantes 
RADIO_MINIMO        = 10     # r* en ecuación 9: umbral de penalización (px)
UMBRAL_COLINEALIDAD = 1e-10  # Determinante mínimo para que los 3 puntos no sean colineales


#  Geometría: círculo que pasa por 3 puntos 

def circulo_desde_tres_puntos(punto_a, punto_b, punto_c):
    """
    Calcula el único círculo que pasa exactamente por tres puntos.
    Ecuaciones (2), (3) y (4) del paper.
    Retorna (centro_x, centro_y, radio) o None si los puntos son colineales.
    """
    x1, y1 = punto_a
    x2, y2 = punto_b
    x3, y3 = punto_c

    denominador = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))

    if abs(denominador) < UMBRAL_COLINEALIDAD:
        return None  # Los 3 puntos son colineales: no existe un círculo único

    suma_cuad_1 = x1 ** 2 + y1 ** 2
    suma_cuad_2 = x2 ** 2 + y2 ** 2
    suma_cuad_3 = x3 ** 2 + y3 ** 2

    centro_x = (
        suma_cuad_1 * (y2 - y3) +
        suma_cuad_2 * (y3 - y1) +
        suma_cuad_3 * (y1 - y2)
    ) / denominador

    centro_y = (
        suma_cuad_1 * (x3 - x2) +
        suma_cuad_2 * (x1 - x3) +
        suma_cuad_3 * (x2 - x1)
    ) / denominador

    radio = math.sqrt((x1 - centro_x) ** 2 + (y1 - centro_y) ** 2)

    return centro_x, centro_y, radio


#  Rejilla de bordes dilatada 

def construir_rejilla_bordes(puntos_borde, forma_imagen, delta):
    """
    Construye una rejilla booleana donde rejilla[y, x] = True significa
    que hay algún píxel de borde a distancia <= delta de la posición (x, y).

    Esto implementa la función E(xi, yi) del paper en O(1) por consulta.
    Se calcula UNA SOLA VEZ antes de las generaciones del GA, no en cada
    evaluación individual.

    Algoritmo:
        Para cada desplazamiento (dx, dy) dentro del disco de radio delta,
        se desplazan todos los puntos de borde y se marcan en la rejilla.
        Así se "dilata" el borde por delta píxeles en todas direcciones.
    """
    alto, ancho = forma_imagen[:2]
    rejilla     = np.zeros((alto, ancho), dtype=bool)
    margen      = int(delta)

    xs_borde = np.round(puntos_borde[:, 0]).astype(int)
    ys_borde = np.round(puntos_borde[:, 1]).astype(int)

    for dx in range(-margen, margen + 1):
        for dy in range(-margen, margen + 1):
            if dx * dx + dy * dy <= delta * delta:
                xs = np.clip(xs_borde + dx, 0, ancho - 1)
                ys = np.clip(ys_borde + dy, 0, alto  - 1)
                rejilla[ys, xs] = True

    return rejilla


#  Función de aptitud (ecuación 8 del paper) 

def evaluar_aptitud(individuo, puntos_borde, rejilla_bordes, forma_imagen,
                    delta=2.0):
    """
    Calcula F(C) según la ecuación (8) de Ayala-Ramírez et al. (2006).
    """
    indice_1, indice_2, indice_3 = individuo

    punto_1 = puntos_borde[indice_1]
    punto_2 = puntos_borde[indice_2]
    punto_3 = puntos_borde[indice_3]

    resultado = circulo_desde_tres_puntos(punto_1, punto_2, punto_3)

    if resultado is None:
        return 0.0

    centro_x, centro_y, radio = resultado
    alto, ancho = forma_imagen[:2]

    # Verificar que el círculo tenga tamaño y posición razonables
    radio_maximo = min(alto, ancho) / 2
    if radio > radio_maximo:
        return 0.0
    if not (0 <= centro_x < ancho and 0 <= centro_y < alto):
        return 0.0

    # Ns = número de puntos de muestra = longitud del perímetro en píxeles
    Ns = max(8, int(2 * math.pi * radio))

    # Generar Ns ángulos uniformes y calcular sus coordenadas (ec. 6 y 7)
    angulos  = 2 * math.pi * np.arange(Ns) / Ns
    xi_muestra = np.clip(
        np.round(centro_x + radio * np.cos(angulos)).astype(int), 0, ancho - 1
    )
    yi_muestra = np.clip(
        np.round(centro_y + radio * np.sin(angulos)).astype(int), 0, alto  - 1
    )

    # Contar cuántos puntos de muestra tienen borde cercano: Σ E(xi, yi)
    puntos_con_borde = int(np.sum(rejilla_bordes[yi_muestra, xi_muestra]))

    # F(C) = Σ E(xi, yi) / Ns  (ecuación 8)
    aptitud = puntos_con_borde / Ns

    # Penalización para radios pequeños (ecuación 9): f(r) = r/r* si r < r*
    if radio < RADIO_MINIMO:
        aptitud = aptitud * (radio / RADIO_MINIMO)

    return float(aptitud)
