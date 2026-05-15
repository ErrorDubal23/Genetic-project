"""
Función de aptitud para el algoritmo genético de detección de círculos.

Implementación fiel a: Ayala-Ramírez et al. (2006), Secciones 2.2 y 2.3.
Pattern Recognition Letters 27, pp. 652-657.
"""

import math
import numpy as np

#  Constantes
RADIO_MINIMO             = 10     # r* en ecuación 9: umbral de penalización (px)
UMBRAL_COLINEALIDAD      = 1e-10  # Determinante mínimo para que los 3 puntos no sean colineales
NUM_SECTORES_VALIDACION  = 12     # Sectores en que se divide la circunferencia para validar (sec. 3.4)
FRACCION_SECTORES_MINIMA = 0.30   # Fracción mínima de sectores con borde
MIN_SECTORES_CONSECUTIVOS = 5     # Arco continuo mínimo requerido (5 sectores = 150°)
MAX_ARCOS_SEPARADOS      = 2      # Máximo de segmentos de arco discontinuos permitidos.
                                  # Un círculo real (incluso ocluido) tiene 1-2 arcos continuos.
                                  # Un fantasma de polígonos tiene 3+ arcos dispersos, uno por
                                  # cada arista que casualmente cruza la circunferencia.
PUNTOS_POR_SECTOR        = 5      # Puntos de muestreo por sector en la verificación de continuidad


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

    # Ns = número de puntos de muestra = longitud del perímetro en píxeles (ec. 6, 7)
    Ns = max(8, int(2 * math.pi * radio))

    # Generar Ns ángulos uniformes y calcular coordenadas de muestreo
    angulos    = 2 * math.pi * np.arange(Ns) / Ns
    xi_muestra = np.round(centro_x + radio * np.cos(angulos)).astype(int)
    yi_muestra = np.round(centro_y + radio * np.sin(angulos)).astype(int)

    # Filtrar puntos que caen dentro de la imagen — sin np.clip para evitar que
    # múltiples puntos exteriores se mapeen al mismo píxel del borde y
    # inflen artificialmente el conteo de borde.
    dentro     = (xi_muestra >= 0) & (xi_muestra < ancho) & (yi_muestra >= 0) & (yi_muestra < alto)
    xi_validos = xi_muestra[dentro]
    yi_validos = yi_muestra[dentro]

    # Σ E(xi, yi) — sólo puntos dentro de la imagen contribuyen al conteo
    puntos_con_borde = int(np.sum(rejilla_bordes[yi_validos, xi_validos]))

    # F(C) = Σ E(xi, yi) / Ns (ecuación 8)
    # Se normaliza sobre Ns total: los puntos fuera de la imagen contribuyen 0,
    # penalizando naturalmente los círculos cuya circunferencia sale de la imagen.
    aptitud = puntos_con_borde / Ns

    # Penalización para radios pequeños (ecuación 9): f(r) = r/r* si r < r*
    if radio < RADIO_MINIMO:
        aptitud = aptitud * (radio / RADIO_MINIMO)

    return float(aptitud)


#  Validación de continuidad del arco (sección 3.4 del paper)

def verificar_continuidad_circulo(centro_x, centro_y, radio, rejilla_bordes, forma_imagen,
                                   num_sectores=NUM_SECTORES_VALIDACION):
    """
    Verifica que el borde que soporta al círculo esté distribuido a lo largo de su
    circunferencia y no concentrado en grupos aislados.

    Divide la circunferencia en num_sectores arcos iguales. Para cada sector determina
    si tiene al menos un píxel de borde. Luego calcula:
      - fraccion_sectores   : qué fracción del total de sectores tiene borde.
      - max_consecutivos     : longitud del arco continuo más largo (en sectores).

    El criterio del arco continuo es el discriminador clave contra falsos positivos
    de polígonos: una línea recta interseca un círculo en máximo 2 puntos, por lo que
    sólo puede producir 1-2 sectores consecutivos de soporte. Un arco real (aunque
    esté parcialmente ocluido) siempre produce varios sectores continuos.

    Referencia: Kelly y Levine (1997), citado en sección 3.4 del paper.
    Retorna (fraccion_sectores, max_consecutivos, numero_arcos).
    """
    alto, ancho = forma_imagen[:2]
    sectores    = []   # lista booleana: True si el sector tiene al menos un borde

    for s in range(num_sectores):
        angulo_inicio = 2.0 * math.pi * s       / num_sectores
        angulo_fin    = 2.0 * math.pi * (s + 1) / num_sectores
        hay_borde     = False

        for paso in range(PUNTOS_POR_SECTOR):
            t      = paso / PUNTOS_POR_SECTOR
            angulo = angulo_inicio + (angulo_fin - angulo_inicio) * t
            xi     = int(round(centro_x + radio * math.cos(angulo)))
            yi     = int(round(centro_y + radio * math.sin(angulo)))

            if 0 <= xi < ancho and 0 <= yi < alto:
                if rejilla_bordes[yi, xi]:
                    hay_borde = True
                    break

        sectores.append(hay_borde)

    # Fracción total de sectores con borde
    total_con_borde = 0
    for tiene in sectores:
        if tiene:
            total_con_borde += 1
    fraccion = total_con_borde / num_sectores

    # Arco continuo más largo, con wrap-around (el círculo no tiene inicio/fin)
    secuencia        = sectores + sectores
    max_consecutivos = 0
    consecutivos     = 0
    for tiene in secuencia:
        if tiene:
            consecutivos += 1
            if consecutivos > max_consecutivos:
                max_consecutivos = consecutivos
        else:
            consecutivos = 0
    if max_consecutivos > num_sectores:
        max_consecutivos = num_sectores

    # Número de arcos separados (segmentos True discontinuos en el array circular).
    # Un círculo real produce 1-2 arcos (el arco visible continuo + a lo sumo una
    # pequeña zona extra si hay dos oclusiones). Un fantasma de polígonos genera
    # 3+ arcos, uno por cada arista que cruza la circunferencia.
    numero_arcos = 0
    if total_con_borde > 0:
        for i in range(num_sectores):
            sector_prev = sectores[(i - 1) % num_sectores]
            sector_curr = sectores[i]
            if sector_curr and not sector_prev:
                numero_arcos += 1

    return fraccion, max_consecutivos, numero_arcos
