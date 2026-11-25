// ============================================================
//  JUEGO: "Lluvia de estrellas"
//  Mueve la nave con gestos: atrapa estrellas (+10)
//  y esquiva asteroides (-5). Ronda de 60 segundos.
// ============================================================

// ---------- CONFIGURACIÓN (ideal para modificar en vivo) ----------
const CONFIG = {
  duracionRonda: 60,          // segundos
  velocidadNave: 260,         // píxeles por segundo
  umbral: 0.6,                // confianza mínima para aceptar un gesto (0 a 1)
  msEntrePredicciones: 200,   // cada cuánto le pregunta a la IA
  colorNave: "#4fd1c5",
  colorEstrella: "#f6c945",
  puntosEstrella: 10,
  puntosAsteroide: -5,
};

// ---------- Elementos de la página ----------
const $ = (id) => document.getElementById(id);
const lienzo = $("lienzo");
const ctx = lienzo.getContext("2d");
const ANCHO = 360, ALTO = 540; // tamaño lógico del juego

// ---------- Estado ----------
let urlModelo = null;
let invertir = false;
let accionIA = 0;          // -1 izquierda, 0 quieto, +1 derecha
let teclas = { izq: false, der: false };
let jugando = false;
let puntaje = 0, tiempoRestante = CONFIG.duracionRonda;
let nave, objetos, fondo, ultimoT, generarEn, destello = 0;
let intervaloIA = null, iaOcupada = false;

// ---------- Utilidades ----------
function normalizar(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Traduce el nombre de una clase a una acción del juego
function accionDe(nombreClase) {
  const n = normalizar(nombreClase);
  if (n.includes("izq") || n.includes("left")) return -1;
  if (n.includes("der") || n.includes("right")) return 1;
  return 0; // "Nada" o cualquier otra clase
}

function mostrarCapa(html) {
  $("capa").innerHTML = html;
  $("capa").classList.remove("oculta");
}
function ocultarCapa() { $("capa").classList.add("oculta"); }

function leerRecord() {
  try { return Number(localStorage.getItem("record-entrena-ia")) || 0; } catch (e) { return 0; }
}
function guardarRecord(p) {
  try { localStorage.setItem("record-entrena-ia", String(p)); } catch (e) { /* sin almacenamiento */ }
}

// ---------- Ajuste del lienzo a la pantalla ----------
function ajustarLienzo() {
  const dpr = window.devicePixelRatio || 1;
  lienzo.width = ANCHO * dpr;
  lienzo.height = ALTO * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------- Barras de confianza ----------
function crearBarras(etiquetas) {
  $("barras").innerHTML = etiquetas.map((e, i) => `
    <div class="barra" id="barra-${i}">
      <div class="nombre"><span>${e.replace(/</g, "&lt;")}</span><span id="pct-${i}">0%</span></div>
      <div class="pista"><div class="relleno" id="rel-${i}"></div></div>
    </div>`).join("");
}

function actualizarBarras(resultados, indiceGanador) {
  resultados.forEach((r, i) => {
    const pct = Math.round(r.probability * 100);
    $("rel-" + i).style.width = pct + "%";
    $("pct-" + i).textContent = pct + "%";
    $("barra-" + i).classList.toggle("activa", i === indiceGanador);
  });
}

// ---------- Ciclo de la IA (cada 200 ms) ----------
async function cicloIA() {
  if (iaOcupada) return;
  iaOcupada = true;
  try {
    const resultados = await IA.predecir();
    let mejor = 0;
    resultados.forEach((r, i) => { if (r.probability > resultados[mejor].probability) mejor = i; });
    const confiable = resultados[mejor].probability >= CONFIG.umbral;
    let accion = confiable ? accionDe(resultados[mejor].className) : 0;
    if (invertir) accion = -accion;
    accionIA = accion;
    actualizarBarras(resultados, confiable ? mejor : -1);
  } catch (e) {
    console.error(e);
  } finally {
    iaOcupada = false;
  }
}

// ---------- Mundo del juego ----------
function reiniciarMundo() {
  nave = { x: ANCHO / 2, y: ALTO - 60, r: 18 };
  objetos = [];
  puntaje = 0;
  tiempoRestante = CONFIG.duracionRonda;
  generarEn = 0;
  destello = 0;
  fondo = fondo || Array.from({ length: 70 }, () => ({
    x: Math.random() * ANCHO, y: Math.random() * ALTO, v: 20 + Math.random() * 60, t: Math.random() * 1.6 + 0.4,
  }));
}

function generarObjeto() {
  const transcurrido = CONFIG.duracionRonda - tiempoRestante;
  const esEstrella = Math.random() < 0.55;
  objetos.push({
    tipo: esEstrella ? "estrella" : "asteroide",
    x: 20 + Math.random() * (ANCHO - 40),
    y: -20,
    r: esEstrella ? 13 : 16 + Math.random() * 8,
    v: 110 + transcurrido * 3 + Math.random() * 60, // cae más rápido con el tiempo
    giro: Math.random() * Math.PI,
  });
}

function actualizar(dt) {
  // Movimiento: la IA manda; el teclado sirve para probar en PC
  let dir = accionIA;
  if (teclas.izq) dir = -1;
  if (teclas.der) dir = 1;
  nave.x += dir * CONFIG.velocidadNave * dt;
  nave.x = Math.max(nave.r, Math.min(ANCHO - nave.r, nave.x));

  // Tiempo
  tiempoRestante -= dt;
  if (tiempoRestante <= 0) { tiempoRestante = 0; terminar(); return; }

  // Generar objetos, cada vez más seguido
  generarEn -= dt;
  if (generarEn <= 0) {
    generarObjeto();
    const transcurrido = CONFIG.duracionRonda - tiempoRestante;
    generarEn = Math.max(0.35, 0.9 - transcurrido * 0.01);
  }

  // Mover objetos y detectar choques
  for (const o of objetos) {
    o.y += o.v * dt;
    o.giro += dt * 2;
    const dx = o.x - nave.x, dy = o.y - nave.y;
    if (!o.fuera && Math.hypot(dx, dy) < o.r + nave.r - 4) {
      o.fuera = true;
      if (o.tipo === "estrella") puntaje += CONFIG.puntosEstrella;
      else { puntaje = Math.max(0, puntaje + CONFIG.puntosAsteroide); destello = 0.25; }
    }
    if (o.y > ALTO + 30) o.fuera = true;
  }
  objetos = objetos.filter((o) => !o.fuera);

  for (const s of fondo) { s.y += s.v * dt; if (s.y > ALTO) { s.y = 0; s.x = Math.random() * ANCHO; } }
  destello = Math.max(0, destello - dt);

  $("puntaje").textContent = "Puntos: " + puntaje;
  $("tiempo").textContent = Math.ceil(tiempoRestante) + " s";
}

// ---------- Dibujo ----------
function dibujarEstrella(x, y, r, giro) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = giro + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = CONFIG.colorEstrella;
  ctx.fill();
}

function dibujarAsteroide(x, y, r, giro) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = giro + (i * Math.PI) / 4;
    const rr = r * (i % 2 ? 0.8 : 1);
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "#7c849b";
  ctx.fill();
  ctx.strokeStyle = "#4a5068";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function dibujarNave() {
  const { x, y, r } = nave;
  // fuego
  ctx.fillStyle = "#ff8c42";
  ctx.beginPath();
  ctx.moveTo(x - 7, y + r - 2);
  ctx.lineTo(x, y + r + 10 + Math.random() * 8);
  ctx.lineTo(x + 7, y + r - 2);
  ctx.fill();
  // cuerpo
  ctx.fillStyle = CONFIG.colorNave;
  ctx.beginPath();
  ctx.moveTo(x, y - r - 6);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x, y + r - 6);
  ctx.lineTo(x - r, y + r);
  ctx.closePath();
  ctx.fill();
}

function dibujar() {
  ctx.fillStyle = destello > 0 ? "#3a0d14" : "#050816";
  ctx.fillRect(0, 0, ANCHO, ALTO);
  for (const s of fondo) { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(s.x, s.y, s.t, s.t); }
  for (const o of objetos) {
    if (o.tipo === "estrella") dibujarEstrella(o.x, o.y, o.r, o.giro);
    else dibujarAsteroide(o.x, o.y, o.r, o.giro);
  }
  dibujarNave();
}

function bucle(t) {
  if (!jugando) return;
  const dt = Math.min(0.05, (t - ultimoT) / 1000 || 0);
  ultimoT = t;
  actualizar(dt);
  dibujar();
  if (jugando) requestAnimationFrame(bucle);
}

// ---------- Flujo de la partida ----------
function cuentaRegresiva(n) {
  if (n === 0) {
    ocultarCapa();
    jugando = true;
    ultimoT = performance.now();
    requestAnimationFrame(bucle);
    return;
  }
  mostrarCapa(`<div class="grande">${n}</div><p>Prepara tus gestos</p>`);
  setTimeout(() => cuentaRegresiva(n - 1), 1000);
}

function empezarRonda() {
  reiniciarMundo();
  dibujar();
  cuentaRegresiva(3);
}

function terminar() {
  jugando = false;
  const record = leerRecord();
  const nuevo = puntaje > record;
  if (nuevo) guardarRecord(puntaje);
  mostrarCapa(`
    <h2>¡Tiempo!</h2>
    <div class="grande">${puntaje}</div>
    <p>${nuevo ? "¡Nuevo récord en este celular!" : "Récord en este celular: " + record}</p>
    <button id="btn-otra">Jugar otra vez</button>`);
  $("btn-otra").onclick = empezarRonda;
}

async function iniciar() {
  mostrarCapa(`<h2>Cargando tu IA…</h2><p>Descargando el modelo entrenado</p>`);
  try {
    await IA.cargar(urlModelo);
  } catch (e) {
    console.error(e);
    mostrarCapa(`<h2>No se pudo cargar el modelo</h2>
      <p>Revisa que la URL sea la de "Upload my model" y que haya internet.</p>
      <a class="boton" href="index.html">Volver al lanzador</a>`);
    return;
  }
  crearBarras(IA.etiquetas);
  const reconocidas = IA.etiquetas.filter((e) => accionDe(e) !== 0).length;

  mostrarCapa(`<h2>Encendiendo la cámara…</h2><p>Acepta el permiso de cámara</p>`);
  try {
    await IA.encenderCamara($("video"));
  } catch (e) {
    console.error(e);
    mostrarCapa(`<h2>Sin acceso a la cámara</h2>
      <p>Permite la cámara para este sitio. En iPhone: Ajustes → Safari → Cámara → Permitir.
      La página debe abrirse con https.</p>
      <button onclick="location.reload()">Reintentar</button>`);
    return;
  }

  intervaloIA = setInterval(cicloIA, CONFIG.msEntrePredicciones);

  const aviso = reconocidas < 2
    ? `<p style="color:#f6c945">Tus clases son: ${IA.etiquetas.join(", ")}.
       Para mover la nave deben llamarse <b>Izquierda</b>, <b>Derecha</b> y <b>Nada</b>.</p>`
    : "";
  mostrarCapa(`
    <h2>¡Tu IA está lista!</h2>
    <p>Mira las barras de abajo: haz tus gestos y comprueba que la IA los reconoce.
    Si la nave va al revés, toca <b>Invertir</b>.</p>${aviso}
    <button id="btn-jugar">¡Jugar 60 segundos!</button>`);
  $("btn-jugar").onclick = empezarRonda;
}

// ---------- Arranque ----------
function arrancar() {
  ajustarLienzo();
  reiniciarMundo();
  dibujar();

  urlModelo = new URLSearchParams(location.search).get("model");
  if (!urlModelo) {
    mostrarCapa(`<h2>Falta el modelo</h2>
      <p>Abre este juego desde el lanzador, con la URL de tu modelo.</p>
      <a class="boton" href="index.html">Ir al lanzador</a>`);
    return;
  }

  mostrarCapa(`
    <h2>Lluvia de estrellas</h2>
    <p>Mueve la nave con tus gestos.<br>Estrella +${CONFIG.puntosEstrella} · Asteroide ${CONFIG.puntosAsteroide}</p>
    <button id="btn-iniciar">Encender mi IA</button>`);
  $("btn-iniciar").onclick = iniciar;

  $("btn-invertir").onclick = () => {
    invertir = !invertir;
    $("btn-invertir").textContent = invertir ? "Invertir: sí" : "Invertir: no";
  };

  // Teclado (para probar en la PC)
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") teclas.izq = true;
    if (e.key === "ArrowRight") teclas.der = true;
  });
  addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") teclas.izq = false;
    if (e.key === "ArrowRight") teclas.der = false;
  });
}

arrancar();
