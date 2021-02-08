const visualizer = document.getElementById("visualizer");
const h1 = document.getElementsByTagName("h1");
h1[0].innerHTML = "ok";
const context = new AudioContext();
const analyserNode = new AnalyserNode(context, { fftSize: 2048 });

window.addEventListener("resize", resize);
setupContext();
resize();
drawVisualizer();

async function setupContext() {
  const guitar = await getGuitar();
  if (context.state === "suspended") {
    await context.resume();
  }
  const source = context.createMediaStreamSource(guitar);
  source.connect(analyserNode).connect(context.destination);
}

function getGuitar() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0,
    },
  });
}

///////////////////////////////////////////////

var noteStrings = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(
    (1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2)
  );
}

function autoCorrelate(buf, sampleRate) {
  // Implements the ACF2+ algorithm
  var SIZE = buf.length;
  var rms = 0;

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01)
    // not enough signal
    return -1;

  var r1 = 0,
    r2 = SIZE - 1,
    thres = 0.2;
  for (var i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  for (var i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i = 0; i < SIZE; i++)
    for (var j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];

  var d = 0;
  while (c[d] > c[d + 1]) d++;
  var maxval = -1,
    maxpos = -1;
  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1 = c[T0 - 1],
    x2 = c[T0],
    x3 = c[T0 + 1];
  a = (x1 + x3 - 2 * x2) / 2;
  b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  // analyserNode.getByteFrequencyData(dataArray);
  analyserNode.getFloatFrequencyData(dataArray);

  // console.log(dataArray);
  // dataArray.forEach((d, i) => {
  //   if (d > 50) {
  //     h1[0].innerHTML = (i * hz).toFixed(3) + " Hz";
  //   }
  // });

  var cycles = new Array();
  analyserNode.getFloatTimeDomainData(dataArray);
  var ac = autoCorrelate(dataArray, context.sampleRate);

  if (ac == -1) {
    // detectorElem.className = "vague";
    // pitchElem.innerText = "--";
    // noteElem.innerText = "-";
    // detuneElem.className = "";
    // detuneAmount.innerText = "--";
  } else {
    // detectorElem.className = "confident";
    pitch = ac;
    // pitchElem.innerText = Math.round(pitch);
    var note = noteFromPitch(pitch);
    // noteElem.innerHTML = noteStrings[note % 12];
    h1[0].innerHTML = noteStrings[note % 12];
    h1[1].innerHTML = pitch.toFixed(3) + " Hz";
    var detune = centsOffFromPitch(pitch, note);
    if (detune == 0) {
      // detuneElem.className = "";
      // detuneAmount.innerHTML = "--";
    } else {
      //  if (detune < 0) detuneElem.className = "flat";
      //  else detuneElem.className = "sharp";
      h1[2].innerHTML = Math.abs(detune);
    }
  }

  analyserNode.getFloatFrequencyData(dataArray);
  const width = visualizer.width;
  const height = visualizer.height;

  const canvasContext = visualizer.getContext("2d");

  canvasContext.fillStyle = "rgb(0, 0, 0)";
  canvasContext.fillRect(0, 0, visualizer.width, visualizer.height);

  //Draw spectrum
  const barWidth = (visualizer.width / bufferLength) * 2.5;
  let posX = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] + 140) * 8;
    canvasContext.fillStyle = "rgb(0,0," + Math.floor(barHeight + 100) + ")";
    canvasContext.fillRect(
      posX,
      visualizer.height - barHeight / 2,
      barWidth,
      barHeight / 2
    );
    posX += barWidth + 1;
  }
}

function resize() {
  visualizer.width = visualizer.clientWidth * window.devicePixelRatio;
  visualizer.height = visualizer.clientHeight * window.devicePixelRatio;
}
