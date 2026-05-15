"""
Este es el punto de entrada de la API. Recibe la imagen desde el frontend,
la procesa con el algoritmo genético y devuelve los círculos detectados.
"""

import json
import os
import numpy as np

# El dominio autorizado para hacer peticiones a esta API.
# En producción Railway pone aquí el dominio de Vercel automáticamente.
# En local, por defecto solo aceptamos peticiones desde localhost:3000.
ORIGENES_PERMITIDOS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Solo estos archivos se pueden pedir desde el frontend para mostrar el código fuente
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

# ── Configuración de la aplicación ────────────────────────────────────────────

aplicacion = FastAPI(
    title="CircleGA API",
    description="Detección de círculos en imágenes usando algoritmos genéticos.",
    version="1.0.0",
)

# Habilitamos CORS para que el frontend pueda comunicarse con la API
aplicacion.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@aplicacion.get("/health")
def verificar_estado():
    """Ruta de verificación para saber si el servidor está corriendo."""
    return {"estado": "ok"}


@aplicacion.get("/codigo/{nombre_archivo}")
def obtener_codigo_fuente(nombre_archivo: str):
    """
    Devuelve el contenido de uno de los archivos del proyecto.
    Solo funciona con los archivos de la lista ARCHIVOS_DEL_PROYECTO,
    para que nadie pueda leer archivos que no deberían verse.
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
    Ruta principal. Recibe una imagen y los parámetros del GA, detecta
    los círculos y devuelve el resultado.

    Lo que recibe:
        image  : el archivo de imagen (PNG, JPG, BMP, TIFF, etc.)
        params : un JSON con los parámetros del GA (todos son opcionales,
                 si no se mandan se usan los valores del paper)

    Lo que devuelve:
        circles             : lista de círculos encontrados, cada uno con x, y y radio
        count               : cuántos círculos se detectaron
        avg_error           : qué tan lejos están los bordes del círculo principal (en píxeles)
        fitness             : la mejor aptitud alcanzada (entre 0 y 1)
        annotated_image_b64 : la imagen original con los círculos dibujados encima,
                              codificada en base64 para mostrarla directo en el navegador
    """

    # 1. Leer los parámetros que mandó el frontend
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

    # 3. Detectar bordes y quedarnos con sus coordenadas
    mapa_bordes  = preprocesar(imagen_original)
    puntos_borde = obtener_puntos_borde(mapa_bordes)

    if len(puntos_borde) < 3:
        raise HTTPException(
            status_code=422,
            detail="La imagen no tiene suficientes bordes detectados. Prueba con otra imagen."
        )

    # 4. Armar el detector con los parámetros recibidos
    detector = DetectorCirculosGA(
        tamanio_poblacion = int(parametros.get("population_size", TAMANIO_POBLACION)),
        prob_cruce        = float(parametros.get("crossover_prob", PROB_CRUCE)),
        prob_mutacion     = float(parametros.get("mutation_prob",  PROB_MUTACION)),
        num_elite         = int(parametros.get("elite_count",      NUM_ELITE)),
        max_generaciones  = int(parametros.get("max_generations",  MAX_GENERACIONES)),
    )

    delta = float(parametros.get("delta", DELTA_TOLERANCIA))

    # 5. Correr el algoritmo genético
    resultado_ga = detector.detectar(
        puntos_borde, imagen_original.shape,
        delta=delta,
    )

    circulos_detectados = resultado_ga["circulos"]
    mejor_aptitud       = resultado_ga["mejor_aptitud"]

    # 6. Calcular el error promedio del primer círculo detectado
    error_promedio = 0.0
    if circulos_detectados:
        circulo_principal    = circulos_detectados[0]
        distancias_al_centro = np.sqrt(
            (puntos_borde[:, 0] - circulo_principal["x"]) ** 2 +
            (puntos_borde[:, 1] - circulo_principal["y"]) ** 2
        )
        desviaciones   = np.abs(distancias_al_centro - circulo_principal["r"])
        error_promedio = float(np.mean(desviaciones))

    # 7. Dibujar los círculos sobre la imagen original
    imagen_anotada   = anotar_imagen(imagen_original, circulos_detectados)
    imagen_en_base64 = imagen_a_base64(imagen_anotada)

    # 8. Enviar todo de vuelta al frontend
    return JSONResponse({
        "circles":             circulos_detectados,
        "count":               len(circulos_detectados),
        "avg_error":           round(error_promedio, 4),
        "fitness":             mejor_aptitud,
        "annotated_image_b64": imagen_en_base64,
    })
