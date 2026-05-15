"""
Utilidades para carga y procesamiento de imágenes.
Incluye detección de bordes con Canny y supresión de segmentos rectos.
"""

import math
import cv2
import numpy as np
import base64

#  Constantes de preprocesamiento
KERNEL_DESENFOQUE    = (5, 5)   # Desenfoque gaussiano para reducir ruido
MAX_PUNTOS_BORDE     = 3000     # Límite de puntos de borde para no sobrecargar el GA

# Parámetros estáticos de la supresión PHT (los dinámicos se calculan por imagen)
BRECHA_MAXIMA_LINEA  = 8   # Separación máxima (px) para unir segmentos colineales
GROSOR_MASCARA_LINEA = 5   # Ancho (px) del borrador; cubre esquinas de polígonos


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


#  Supresión de segmentos de línea recta (PHT adaptativo al tamaño de imagen)

def suprimir_lineas_rectas(mapa_bordes: np.ndarray, forma_imagen: tuple) -> np.ndarray:
    """
    Detecta segmentos de línea recta con la Transformada de Hough Probabilística
    y borra sus píxeles del mapa de bordes.

    La longitud mínima de línea se escala con la diagonal de la imagen (12%):

      • Imagen pequeña  (240×240, diag≈340 px)  → longitud_min ≈ 40 px
        Los lados del pentágono de muestra (~53 px) quedan por encima y se suprimen.
        Los arcos de círculos de r≥35 tienen saeta ≥4.7 px y no se confunden con líneas.

      • Imagen grande (1440×780, diag≈1638 px)  → longitud_min ≈ 196 px
        Los círculos con r≥150 que en imágenes grandes tienen arcos casi rectos
        no se suprimen (saeta ≥16 px para el arco de esa longitud).

    De esta forma el PHT elimina las aristas de polígonos sin dañar bordes circulares,
    independientemente de la resolución de la imagen de entrada.
    """
    alto, ancho = forma_imagen[:2]
    diagonal    = math.sqrt(alto ** 2 + ancho ** 2)

    longitud_min = max(40, int(diagonal * 0.12))
    umbral_votos = max(20, int(longitud_min * 0.55))

    lineas = cv2.HoughLinesP(
        mapa_bordes,
        rho=1,
        theta=np.pi / 180,
        threshold=umbral_votos,
        minLineLength=longitud_min,
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
      3. Detecta bordes con Canny usando umbrales basados en la magnitud
         del gradiente (no en la intensidad de píxeles).
      4. Suprime segmentos de línea recta con PHT adaptativo al tamaño.

    Por qué se usa la magnitud del gradiente para los umbrales de Canny:
      El enfoque previo (0.67 × mediana_píxel, 1.33 × mediana_píxel) falla en
      imágenes con fondo claro (p. ej. círculos de colores sobre fondo blanco).
      La mediana del píxel es ~230, lo que eleva el umbral bajo a ~154 y descarta
      bordes de baja diferencia de color (círculo verde lima vs blanco: gradiente ≈85).
      Usar percentiles de la magnitud del gradiente adapta los umbrales a las
      intensidades de borde reales presentes en la imagen, sin importar el fondo.
    """
    gris      = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(gris, KERNEL_DESENFOQUE, 2)

    # Calcular la magnitud del gradiente con Sobel
    gx = cv2.Sobel(suavizada, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(suavizada, cv2.CV_64F, 0, 1, ksize=3)
    magnitud = np.hypot(gx, gy)

    # Umbralización adaptativa basada en percentiles del gradiente
    valores_grad = magnitud[magnitud > 0].ravel()
    if len(valores_grad) > 100:
        mediana_grad = float(np.median(valores_grad))
        p85_grad     = float(np.percentile(valores_grad, 85))
        umbral_bajo  = max(10, int(mediana_grad * 0.4))
        umbral_alto  = max(umbral_bajo + 30, int(p85_grad))
    else:
        umbral_bajo, umbral_alto = 30, 100

    mapa_bordes = cv2.Canny(suavizada, umbral_bajo, umbral_alto)
    mapa_bordes = suprimir_lineas_rectas(mapa_bordes, imagen.shape)

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
