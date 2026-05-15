"""
Utilidades para carga y procesamiento de imágenes.
Incluye detección de bordes con Canny y supresión de segmentos rectos.
"""

import cv2
import numpy as np
import base64

#  Constantes de preprocesamiento
KERNEL_DESENFOQUE    = (5, 5)   # Desenfoque gaussiano para reducir ruido
MAX_PUNTOS_BORDE     = 3000     # Límite de puntos de borde para no sobrecargar el GA

# Parámetros para la supresión de líneas rectas (Transformada de Hough Probabilística)
LONGITUD_MINIMA_LINEA = 60    # Longitud mínima (px) de un segmento para considerarlo línea recta
                              # Con 60px, los arcos de círculos grandes ya no se detectan como líneas
UMBRAL_HOUGH          = 40    # Votos mínimos en espacio de Hough para detectar una línea
BRECHA_MAXIMA_LINEA   = 8     # Separación máxima (px) para unir dos segmentos colineales
GROSOR_MASCARA_LINEA  = 3     # Ancho (px) del trazo borrador sobre las líneas detectadas


#  Carga de imagen

def cargar_imagen_desde_bytes(datos_imagen: bytes) -> np.ndarray:
    """
    Convierte bytes de un archivo de imagen en un array NumPy (BGR).
    Lanza ValueError si los datos no corresponden a una imagen válida.
    """
    arreglo_bytes = np.frombuffer(datos_imagen, np.uint8)
    imagen = cv2.imdecode(arreglo_bytes, cv2.IMREAD_COLOR)

    if imagen is None:
        raise ValueError("No se pudo decodificar la imagen. Verifica que el formato sea válido.")

    return imagen


#  Supresión de segmentos de línea recta

def suprimir_lineas_rectas(mapa_bordes: np.ndarray) -> np.ndarray:
    """
    Detecta segmentos de línea recta con la Transformada de Hough Probabilística
    y borra sus píxeles del mapa de bordes.

    Los arcos de círculos son curvos: sus píxeles votan en muchos ángulos distintos
    del espacio de Hough y nunca acumulan suficientes votos en un solo bin para ser
    detectados como líneas rectas. Las aristas de polígonos sí lo hacen.

    Esto permite que el GA reciba un mapa de bordes con features predominantemente
    circulares, eliminando la principal fuente de falsos positivos.
    """
    lineas = cv2.HoughLinesP(
        mapa_bordes,
        rho=1,
        theta=np.pi / 180,
        threshold=UMBRAL_HOUGH,
        minLineLength=LONGITUD_MINIMA_LINEA,
        maxLineGap=BRECHA_MAXIMA_LINEA,
    )

    if lineas is None:
        return mapa_bordes

    mascara = np.zeros_like(mapa_bordes)
    for linea in lineas:
        x1, y1, x2, y2 = linea[0]
        cv2.line(mascara, (x1, y1), (x2, y2), 255, GROSOR_MASCARA_LINEA)

    return cv2.bitwise_and(mapa_bordes, cv2.bitwise_not(mascara))


#  Preprocesamiento

def preprocesar(imagen: np.ndarray) -> np.ndarray:
    """
    Prepara la imagen para el GA:
      1. Convierte a escala de grises.
      2. Aplica desenfoque gaussiano para reducir ruido de textura.
      3. Detecta bordes con Canny (umbrales adaptativos basados en la mediana).
      4. Suprime segmentos de línea recta para que el GA vea principalmente
         arcos circulares y no aristas de polígonos.
    """
    gris      = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(gris, KERNEL_DESENFOQUE, 2)

    # Umbrales adaptativos basados en la mediana del histograma
    mediana     = float(np.median(suavizada))
    umbral_bajo = max(0,   int(0.67 * mediana))
    umbral_alto = min(255, int(1.33 * mediana))

    if umbral_alto - umbral_bajo < 20:
        umbral_bajo = 30
        umbral_alto = 100

    mapa_bordes = cv2.Canny(suavizada, umbral_bajo, umbral_alto)

    # Eliminar aristas rectas de polígonos para reducir falsos positivos en el GA
    mapa_bordes = suprimir_lineas_rectas(mapa_bordes)

    return mapa_bordes


def obtener_puntos_borde(mapa_bordes: np.ndarray) -> np.ndarray:
    """
    Extrae las coordenadas (x, y) de todos los píxeles de borde.
    Retorna un array de forma (N, 2) con columnas [x, y].
    """
    filas, columnas = np.where(mapa_bordes > 0)
    puntos_borde    = np.column_stack((columnas, filas)).astype(np.float64)

    if len(puntos_borde) > MAX_PUNTOS_BORDE:
        indices_muestra = np.random.choice(len(puntos_borde), MAX_PUNTOS_BORDE, replace=False)
        puntos_borde    = puntos_borde[indices_muestra]

    return puntos_borde


#  Anotación y exportación

def anotar_imagen(imagen: np.ndarray, circulos: list) -> np.ndarray:
    """
    Dibuja cada círculo detectado sobre una copia de la imagen original.
    """
    imagen_anotada = imagen.copy()

    for circulo in circulos:
        centro_x = int(circulo["x"])
        centro_y = int(circulo["y"])
        radio    = int(circulo["r"])

        cv2.circle(imagen_anotada, (centro_x, centro_y), radio, (255, 255, 255), 2)
        cv2.circle(imagen_anotada, (centro_x, centro_y), 3,     (200, 200, 200), -1)

    return imagen_anotada


def imagen_a_base64(imagen: np.ndarray) -> str:
    """
    Codifica un array NumPy (imagen) como cadena base64 en formato PNG.
    """
    _, buffer  = cv2.imencode(".png", imagen)
    cadena_b64 = base64.b64encode(buffer.tobytes()).decode()
    return cadena_b64
