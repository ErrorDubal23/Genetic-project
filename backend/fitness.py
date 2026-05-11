"""
Función de aptitud para el algoritmo genético de detección de círculos.

Basada en: Ayala-Ramírez et al. (2006), Sección 3.
Pattern Recognition Letters 27, pp. 652-657.

NOTA SOBRE EL DISEÑO DE LA FUNCIÓN DE APTITUD
──────────────────────────────────────────────
El paper original divide por el total de puntos de borde:
    aptitud = puntos_cercanos / total_puntos

Esto funciona bien en imágenes simples, pero en fotos reales con muchos
bordes el fitness del círculo correcto puede caer a 0.5% – 2%, haciendo
que el GA no tenga señal suficiente para distinguir buenas soluciones.

Usamos en cambio la "cobertura del perímetro":
    aptitud = puntos_cercanos / circunferencia_esperada

Esto mide qué fracción del círculo candidato está respaldada por bordes
reales, independientemente de cuántos bordes haya en el resto de la imagen.
Un círculo perfecto obtiene aptitud ≈ 1.0; uno parcial, proporcional.
"""

import numpy as np

# ── Constantes de validación ─────────────────────────────────────────────────
RADIO_MINIMO        = 10     # Círculos menores no son relevantes (px)
COBERTURA_MINIMA    = 0.10   # Al menos 10% del perímetro debe tener bordes cerca
UMBRAL_COLINEALIDAD = 1e-10  # Determinante mínimo para que no sean colineales


# ── Geometría: círculo por 3 puntos ─────────────────────────────────────────

def circulo_desde_tres_puntos(punto_a, punto_b, punto_c):
    """
    Calcula el único círculo que pasa exactamente por tres puntos.
    Retorna (centro_x, centro_y, radio) o None si los puntos son colineales.
    """
    x1, y1 = punto_a
    x2, y2 = punto_b
    x3, y3 = punto_c

    denominador = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))

    if abs(denominador) < UMBRAL_COLINEALIDAD:
        return None  # Puntos colineales: no existe un único círculo

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

    radio = np.sqrt((x1 - centro_x) ** 2 + (y1 - centro_y) ** 2)

    return centro_x, centro_y, radio


# ── Función de aptitud ───────────────────────────────────────────────────────

def evaluar_aptitud(individuo: np.ndarray, puntos_borde: np.ndarray,
                    forma_imagen: tuple, delta: float = 2.0) -> float:
    """
    Calcula la aptitud de un individuo midiendo la cobertura del perímetro.

    Fórmula:
        aptitud = puntos_cercanos_al_circulo / circunferencia_del_circulo

    Donde circunferencia = 2π × radio (en píxeles).

    Un círculo perfecto con todos sus bordes detectados obtiene aptitud ≈ 1.0.
    Un círculo parcialmente visible obtiene una fracción proporcional.

    Parámetros:
        individuo    : array con 3 índices enteros (apuntan a puntos_borde)
        puntos_borde : array (N, 2) con coordenadas [x, y] de bordes
        forma_imagen : tupla (alto, ancho, ...) de la imagen original
        delta        : tolerancia en píxeles — cuánto puede alejarse un punto
                       del perímetro para seguir contando como "en el círculo"
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

    # Filtrar círculos con tamaño o posición inválidos
    radio_maximo = min(alto, ancho) / 2
    if radio < RADIO_MINIMO or radio > radio_maximo:
        return 0.0
    if not (0 <= centro_x < ancho and 0 <= centro_y < alto):
        return 0.0

    # Contar puntos de borde cercanos al perímetro del círculo
    distancia_al_centro   = np.sqrt(
        (puntos_borde[:, 0] - centro_x) ** 2 +
        (puntos_borde[:, 1] - centro_y) ** 2
    )
    distancia_al_perimetro    = np.abs(distancia_al_centro - radio)
    puntos_sobre_el_circulo   = np.sum(distancia_al_perimetro <= delta)

    # Cobertura: fracción del perímetro respaldada por puntos de borde
    circunferencia = 2 * np.pi * radio
    cobertura      = puntos_sobre_el_circulo / circunferencia

    # Descartar si no hay evidencia suficiente de un círculo real
    if cobertura < COBERTURA_MINIMA:
        return 0.0

    return float(min(cobertura, 1.0))
