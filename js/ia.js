// ============================================================
//  EL CEREBRO: conecta la cámara del celular con el modelo
//  que entrenaron en Teachable Machine.
//  (Este es el archivo para proyectar en "Detrás de cámaras")
// ============================================================

const IA = {
  modelo: null,     // la red neuronal entrenada
  etiquetas: [],    // nombres de las clases: Izquierda, Derecha, Nada
  video: null,      // lo que ve la cámara
  lienzo: null,     // un cuadro de 224x224 px, el tamaño que usa el modelo

  // 1) Descargar el modelo desde la nube de Teachable Machine
  async cargar(urlModelo) {
    const base = urlModelo.endsWith("/") ? urlModelo : urlModelo + "/";
    this.modelo = await tmImage.load(base + "model.json", base + "metadata.json");
    this.etiquetas = this.modelo.getClassLabels();
  },

  // 2) Encender la cámara frontal (la de las selfies)
  async encenderCamara(video) {
    const flujo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = flujo;
    await video.play();
    this.video = video;
    this.lienzo = document.createElement("canvas");
    this.lienzo.width = this.lienzo.height = 224;
  },

  // 3) Tomar una foto y preguntarle al modelo qué gesto ve
  async predecir() {
    const v = this.video;
    const lado = Math.min(v.videoWidth, v.videoHeight); // recorte cuadrado al centro
    const ctx = this.lienzo.getContext("2d");
    ctx.drawImage(v, (v.videoWidth - lado) / 2, (v.videoHeight - lado) / 2, lado, lado, 0, 0, 224, 224);
    // Devuelve algo como: [{className:"Izquierda", probability:0.93}, ...]
    return await this.modelo.predict(this.lienzo);
  },
};
