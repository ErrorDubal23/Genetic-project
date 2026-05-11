"""
Utilidades para carga y procesamiento de imágenes.
Incluye detección de bordes con Canny y submuestreo de puntos.
"""

import cv2
import numpy as np
import base64

#  Constantes de preprocesamiento 
KERNEL_DESENFOQUE = (7, 7)   # Kernel más amplio para suavizar textura interna

MAX_PUNTOS_BORDE = 3000


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


#  Preprocesamiento 

def preprocesar(imagen: np.ndarray) -> np.ndarray:
    """
    Detecta los bordes de la imagen usando el algoritmo Canny.
    """
    gris      = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(gris, KERNEL_DESENFOQUE, 2)

    # Umbral automático basado en la mediana del histograma
    mediana     = float(np.median(suavizada))
    umbral_bajo = max(0,   int(0.67 * mediana))
    umbral_alto = min(255, int(1.33 * mediana))

    # Garantizar un mínimo de contraste en los umbrales
    if umbral_alto - umbral_bajo < 20:
        umbral_bajo = 30
        umbral_alto = 100

    mapa_bordes = cv2.Canny(suavizada, umbral_bajo, umbral_alto)
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
    Marca el contorno del círculo y un punto en su centro.
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
