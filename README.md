# Entrena tu propia IA — plantilla del juego

Demostración vocacional: los estudiantes entrenan un modelo en Teachable Machine con fotos de sus gestos y lo usan para controlar un juego en su celular.

## Estructura

```
index.html      Lanzador: valida la URL del modelo y genera el QR del juego
juego.html      Juego "Lluvia de estrellas" (se abre en el celular)
js/ia.js        "El cerebro": cámara + modelo (archivo para proyectar)
js/juego.js     Lógica del juego; objeto CONFIG al inicio
css/estilos.css Estilos compartidos
```

Sin build ni dependencias locales. Las librerías se cargan por CDN (jsDelivr):
TensorFlow.js 1.3.1, @teachablemachine/image 0.8.5 (versiones compatibles) y qrcode-generator 1.4.4.

## Publicar en GitHub Pages

1. Crear un repositorio público y subir todos los archivos respetando las carpetas.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `root` → Save.
3. Abrir `https://<usuario>.github.io/<repo>/` (tarda 1–2 min la primera vez).

HTTPS es obligatorio: el celular solo da acceso a la cámara en páginas seguras. GitHub Pages ya lo cumple.

## Configuración del docente

- **Modelo de respaldo:** en `index.html`, pegar la URL en `const MODELO_RESPALDO = "";`.
- **Parámetros del juego:** objeto `CONFIG` al inicio de `js/juego.js` (duración, velocidad, umbral de confianza, colores, puntos). Buenos candidatos para cambiar en vivo en "Detrás de cámaras".

## Reglas para el modelo

- Proyecto **Image → Standard** en Teachable Machine.
- Clases: `Izquierda`, `Derecha`, `Nada` (mayúsculas y tildes no importan; también acepta `Left` / `Right`). Cualquier otra clase se interpreta como "quieto".
- Fotos con la **cámara frontal**, a la distancia del brazo, 30–50 por clase.
- Publicar con **Export Model → Upload my model** y usar esa URL en el lanzador.

## Uso en la sesión

1. Cada equipo abre el lanzador en la PC, pega la URL y escanea el QR.
2. En el celular: **Encender mi IA** → aceptar cámara → revisar las barras → **Jugar 60 segundos**.
3. Si la nave va al revés (algunos celulares guardan las selfies en espejo), tocar **Invertir**.
4. Tras reentrenar y volver a subir el modelo, la URL no cambia: basta recargar el juego.

En la PC se puede probar con las flechas ← → del teclado.

## Prueba local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000 (localhost cuenta como contexto seguro para la cámara de la PC)
```

Desde el celular en la misma red, `http://<ip-de-la-pc>:8000` **no** tendrá cámara por no ser HTTPS; para eso, usar GitHub Pages.

## Problemas frecuentes

| Síntoma | Solución |
| --- | --- |
| "No se encontró el modelo" | Falta pulsar *Upload my model* o no hay internet |
| "Sin acceso a la cámara" | Permitir la cámara; en iPhone: Ajustes → Safari → Cámara → Permitir |
| La nave no se mueve | Las clases no se llaman Izquierda/Derecha, o la confianza no supera `CONFIG.umbral` |
| La nave va al revés | Botón **Invertir** |
| Va lento en celulares de gama baja | Subir `CONFIG.msEntrePredicciones` a 300–400 |
