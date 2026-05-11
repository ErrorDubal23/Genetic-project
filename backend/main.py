"""
API REST del proyecto CircleGA.

Expone el endpoint POST /detectar que recibe una imagen y los parámetros
del algoritmo genético, y devuelve los círculos detectados.
"""

import json
import os
import numpy as np

# En producción, Railway inyecta ALLOWED_ORIGINS con el dominio de Vercel.
# En local, permite http://localhost:3000 por defecto.
ORIGENES_PERMITIDOS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Archivos del proyecto que se pueden servir al frontend para visualización
ARCHIVOS_DEL_PROYECTO = {
    "genetic_algorithm.py",
    "fitness.py",
    "image_utils.py",
    "main.py",
}

DIRECTORIO_BACKEND = os.path.dirname(os.path.abspath(__file__))

from image_utils import (
    cargar_imagen_desde_bytes,
    preprocesar,
    obtener_puntos_borde,
    anotar_imagen,
    imagen_a_base64,
)
from genetic_algorithm import (
    DetectorCirculosGA,
    TAMANIO_POBLACION,
    PROB_CRUCE,
    PROB_MUTACION,
    NUM_ELITE,
    MAX_GENERACIONES,
    DELTA_TOLERANCIA,
)

#  Configuración de la aplicación 

aplicacion = FastAPI(
    title="CircleGA API",
    description="Detección de círculos en imágenes usando algoritmos genéticos.",
    version="1.0.0",
)

aplicacion.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_methods=["*"],
    allow_headers=["*"],
)


#  Endpoints 

@aplicacion.get("/health")
def verificar_estado():
    """Verifica que la API esté en funcionamiento."""
    return {"estado": "ok"}


@aplicacion.get("/codigo/{nombre_archivo}")
def obtener_codigo_fuente(nombre_archivo: str):
    """
    Sirve el código fuente real de los archivos del proyecto.
    Solo permite acceder a los archivos definidos en ARCHIVOS_DEL_PROYECTO.
    """
    if nombre_archivo not in ARCHIVOS_DEL_PROYECTO:
        raise HTTPException(status_code=404, detail="Archivo no permitido.")

    ruta = os.path.join(DIRECTORIO_BACKEND, nombre_archivo)

    with open(ruta, "r", encoding="utf-8") as archivo:
        contenido = archivo.read()

    return {"archivo": nombre_archivo, "contenido": contenido}


@aplicacion.post("/detect")
async def detectar_circulos(
    image:  UploadFile = File(...),
    params: str        = Form(default="{}"),
):
    """
    Detecta círculos en la imagen recibida usando el algoritmo genético.

    Parámetros del formulario:
        image  : archivo de imagen (PNG, JPG, BMP, TIFF, etc.)
        params : JSON con los parámetros del GA (todos opcionales)

    Respuesta JSON:
        circles             : lista de círculos detectados [{x, y, r}]
        count               : número de círculos encontrados
        avg_error           : error promedio en píxeles
        fitness             : mejor aptitud alcanzada (0–1)
        annotated_image_b64 : imagen anotada en base64 (PNG)
    """

    # 1. Parsear los parámetros enviados por el frontend
    try:
        parametros = json.loads(params)
    except Exception:
        raise HTTPException(status_code=400, detail="El campo 'params' debe ser un JSON válido.")

    # 2. Cargar la imagen desde los bytes recibidos
    datos_imagen = await image.read()
    try:
        imagen_original = cargar_imagen_desde_bytes(datos_imagen)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    # 3. Detectar bordes y extraer los puntos de borde
    mapa_bordes  = preprocesar(imagen_original)
    puntos_borde = obtener_puntos_borde(mapa_bordes)

    if len(puntos_borde) < 3:
        raise HTTPException(
            status_code=422,
            detail="La imagen no tiene suficientes bordes detectados. Prueba con otra imagen."
        )

    # 4. Configurar el detector con los parámetros recibidos (o los del paper si no se enviaron)
    detector = DetectorCirculosGA(
        tamanio_poblacion = int(parametros.get("population_size", TAMANIO_POBLACION)),
        prob_cruce        = float(parametros.get("crossover_prob", PROB_CRUCE)),
        prob_mutacion     = float(parametros.get("mutation_prob",  PROB_MUTACION)),
        num_elite         = int(parametros.get("elite_count",      NUM_ELITE)),
        max_generaciones  = int(parametros.get("max_generations",  MAX_GENERACIONES)),
    )

    delta = float(parametros.get("delta", DELTA_TOLERANCIA))

    # 5. Ejecutar el algoritmo genético
    resultado_ga = detector.detectar(
        puntos_borde, imagen_original.shape,
        delta=delta,
    )

    circulos_detectados = resultado_ga["circulos"]
    mejor_aptitud       = resultado_ga["mejor_aptitud"]

    # 6. Calcular el error promedio del mejor círculo
    error_promedio = 0.0
    if circulos_detectados:
        circulo_principal   = circulos_detectados[0]
        distancias_al_centro = np.sqrt(
            (puntos_borde[:, 0] - circulo_principal["x"]) ** 2 +
            (puntos_borde[:, 1] - circulo_principal["y"]) ** 2
        )
        desviaciones = np.abs(distancias_al_centro - circulo_principal["r"])
        error_promedio = float(np.mean(desviaciones))

    # 7. Dibujar los círculos sobre la imagen y codificarla en base64
    imagen_anotada   = anotar_imagen(imagen_original, circulos_detectados)
    imagen_en_base64 = imagen_a_base64(imagen_anotada)

    # 8. Devolver la respuesta al frontend
    return JSONResponse({
        "circles":             circulos_detectados,
        "count":               len(circulos_detectados),
        "avg_error":           round(error_promedio, 4),
        "fitness":             mejor_aptitud,
        "annotated_image_b64": imagen_en_base64,
    })
