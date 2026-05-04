let cam;
let paintLayer;

// =========================
// DETECTION LASER MAGENTA / ROUGE
// =========================
let minRed = 140;
let maxGreen = 190;
let maxBlue = 220;
let minRedDominance = 5;
let minBrightness = 60;

// =========================
// BRUSH VRUN / GRAFFITI
// =========================
let spring = 0.5;
let friction = 0.5;
let brushSize = 18;
let diff;

let brushX = 0;
let brushY = 0;
let brushAX = 0;
let brushAY = 0;
let brushA = 0;
let brushR = 0;
let brushActive = false;

// Effets peinture
let fadeAmount = 0.001;       // plus grand = disparition plus rapide
let glowBlur = 15;        // intensité du halo
let glowAlpha = 125;      // opacité du trait principal
let sprayChance = 0.35;   // plus grand = plus de micro-gouttes
let dripChance = 0.04;    // plus grand = plus de coulures

// =========================
// LASER POSITION
// =========================
let laserFound = false;

let rawLaserX = 0;
let rawLaserY = 0;
let prevRawLaserX = 0;
let prevRawLaserY = 0;

let smoothLaserX = 0;
let smoothLaserY = 0;
let smoothing = 0.35;

let laserSpeed = 0;

// =========================
// AFFICHAGE
// =========================
let showCamera = false;
let showHUD = true;
let showZone = true;

// =========================
// ZONE DE DETECTION CAMERA
// valeurs en pixels de la webcam 640x480
// =========================
let roiX = 0;
let roiY = 0;
let roiW = 640;
let roiH = 480;

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(30);

  cam = createCapture(VIDEO);
  cam.size(640, 480);
  cam.hide();

  paintLayer = createGraphics(windowWidth, windowHeight);
  paintLayer.clear();

  diff = brushSize / 8;

  pixelDensity(1);
  noCursor();
}

function draw() {
  background(20);

  if (showCamera) {
    push();
    tint(255, 180);
    image(cam, 0, 0, width, height);
    pop();
  }

  // Fade progressif du calque peinture.
//  applyFade();

  detectRedLaser();
  updateBrushPaintingLaser();

  image(paintLayer, 0, 0);

  drawLaserCursor();

  if (showZone) {
    drawDetectionZone();
  }

  if (showHUD) {
    drawHUD();
  }
}

// =========================
// ZONE DE DETECTION VISUELLE
// =========================
function drawDetectionZone() {
  push();
  noFill();
  stroke(0, 255, 0);
  strokeWeight(3);

  let x = map(roiX, 0, cam.width, 0, width);
  let y = map(roiY, 0, cam.height, 0, height);
  let w = map(roiW, 0, cam.width, 0, width);
  let h = map(roiH, 0, cam.height, 0, height);

  rect(x, y, w, h);
  pop();
}

// =========================
// FADE PEINTURE
// =========================
function applyFade() {
  paintLayer.push();
  paintLayer.noStroke();

  // Effacement doux en transparence.
  paintLayer.drawingContext.globalCompositeOperation = "destination-out";
  paintLayer.fill(0, 0, 0, fadeAmount);
  paintLayer.rect(0, 0, paintLayer.width, paintLayer.height);
  paintLayer.drawingContext.globalCompositeOperation = "source-over";

  paintLayer.pop();
}

// =========================
// DETECTION LASER
// =========================
function detectRedLaser() {
  cam.loadPixels();

  let bestScore = -1;
  let bestX = -1;
  let bestY = -1;
  let detectedCount = 0;

  for (let y = roiY; y < roiY + roiH; y += 2) {
    for (let x = roiX; x < roiX + roiW; x += 2) {
      let i = (x + y * cam.width) * 4;

      let r = cam.pixels[i];
      let g = cam.pixels[i + 1];
      let b = cam.pixels[i + 2];

      let brightness = (r + g + b) / 3;

      // Laser réel vu comme rose/magenta.
      let isLaser =
        r > minRed &&
        g < maxGreen &&
        b < maxBlue &&
        r > g + minRedDominance &&
        r > b + minRedDominance &&
        brightness > minBrightness;

      if (isLaser) {
        detectedCount++;

        let score =
          r * 2.0 +
          (r - g) * 1.2 +
          (r - b) * 1.2 -
          (g + b) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
  }

  if (bestX >= 0 && detectedCount > 0 && detectedCount < 500) {
    prevRawLaserX = rawLaserX;
    prevRawLaserY = rawLaserY;

    rawLaserX = map(bestX, 0, cam.width, 0, width);
    rawLaserY = map(bestY, 0, cam.height, 0, height);

    // Anti-saut : évite que la détection saute vers un faux point.
    let jump = dist(rawLaserX, rawLaserY, prevRawLaserX, prevRawLaserY);

    if (laserFound && jump > 180) {
      rawLaserX = prevRawLaserX;
      rawLaserY = prevRawLaserY;
    }

    laserSpeed = dist(rawLaserX, rawLaserY, prevRawLaserX, prevRawLaserY);

    if (!laserFound) {
      smoothLaserX = rawLaserX;
      smoothLaserY = rawLaserY;
    } else {
      smoothLaserX = lerp(smoothLaserX, rawLaserX, smoothing);
      smoothLaserY = lerp(smoothLaserY, rawLaserY, smoothing);
    }

    laserFound = true;
  } else {
    laserFound = false;
    laserSpeed *= 0.8;
  }
}

// =========================
// BRUSH RESET
// =========================
function resetBrushStroke() {
  brushAX = 0;
  brushAY = 0;
  brushA = 0;
  brushR = brushSize;
  brushActive = false;
}

// =========================
// DESSIN TYPE VRUN + GRAFFITI
// =========================
function updateBrushPaintingLaser() {
  if (!laserFound) {
    resetBrushStroke();
    return;
  }

  let targetX = constrain(smoothLaserX, 0, width);
  let targetY = constrain(smoothLaserY, 0, height);

  let moved = dist(targetX, targetY, brushX, brushY) > 0.8;

  if (!brushActive) {
    brushActive = true;
    brushX = targetX;
    brushY = targetY;
    brushAX = 0;
    brushAY = 0;
    brushA = 0;
    brushR = brushSize;
    return;
  }

  if (!moved) return;

  let oldR = brushR;

  brushAX += (targetX - brushX) * spring;
  brushAY += (targetY - brushY) * spring;

  brushAX *= friction;
  brushAY *= friction;

  let motion = laserSpeed;
  brushA += (motion - brushA) * 0.35;

  brushR = brushSize - brushA * 0.6;

  if (brushR < 1.2) brushR = 1.2;
  if (brushR > brushSize) brushR = brushSize;

  // Glow du trait.
  paintLayer.drawingContext.shadowBlur = glowBlur;
  paintLayer.drawingContext.shadowColor = "rgba(255,255,255,1)";
  paintLayer.stroke(255, 255, 255, glowAlpha);
  paintLayer.noFill();

  let distanceSteps = 8;

  for (let i = 0; i < distanceSteps; i++) {
    let oldX = brushX;
    let oldY = brushY;

    brushX += brushAX / distanceSteps;
    brushY += brushAY / distanceSteps;

    oldR += (brushR - oldR) / distanceSteps;
    if (oldR < 1) oldR = 1;

    // Trait principal + dédoublement VRUN.
    paintLayer.strokeWeight(oldR + diff);
    paintLayer.line(brushX, brushY, oldX, oldY);

    paintLayer.strokeWeight(oldR);
    paintLayer.line(
      brushX + diff * 2,
      brushY + diff * 2,
      oldX + diff * 2,
      oldY + diff * 2
    );
    paintLayer.line(
      brushX - diff,
      brushY - diff,
      oldX - diff,
      oldY - diff
    );

    // Gouttes façon graffiti : imprimées dans la peinture, pas particules numériques.
    if (random(1) < dripChance && laserSpeed < 55) {
      graffitiDrip(brushX, brushY, oldR);
    }

    if (random(1) < sprayChance) {
      graffitiSpray(brushX, brushY, oldR);
    }
  }

  paintLayer.drawingContext.shadowBlur = 0;
}

// =========================
// EFFETS GRAFFITI DIRECTS
// inspirés du principe "Graffiti Writer"
// =========================
function graffitiDrip(x, y, sprayWidth) {
  let dripLength = ceil(random(sprayWidth * 1.5, 10 * sprayWidth));
  let dripWidth = floor(random(max(1, sprayWidth / 10), max(2, sprayWidth / 2)));

  paintLayer.push();
  paintLayer.drawingContext.shadowBlur = 12;
  paintLayer.drawingContext.shadowColor = "rgba(255,255,255,0.9)";

  paintLayer.strokeWeight(dripWidth);
  paintLayer.stroke(255, 255, 255, random(90, 190));

  let endX = x + random(-3, 3);
  let endY = y + dripLength;

  // Ligne verticale légèrement irrégulière.
  paintLayer.line(x, y, endX, endY);

  // Goutte au bout.
  paintLayer.noStroke();
  paintLayer.fill(255, 255, 255, random(100, 210));
  paintLayer.ellipse(endX, endY, dripWidth * 2.4, dripWidth * 3.2);

  paintLayer.drawingContext.shadowBlur = 0;
  paintLayer.pop();
}

function graffitiSpray(x, y, sprayWidth) {
  let spotX = x + 4.5 * random(-sprayWidth, sprayWidth);
  let spotY = y + 4.5 * random(-sprayWidth, sprayWidth);
  let spotWidth = floor(random(max(1, sprayWidth / 5), max(2, sprayWidth * 0.85)));

  paintLayer.push();
  paintLayer.noStroke();
  paintLayer.fill(255, 255, 255, random(35, 120));
  paintLayer.ellipse(spotX, spotY, spotWidth, spotWidth);
  paintLayer.pop();
}

// =========================
// CURSEUR LASER
// =========================
function drawLaserCursor() {
  if (!laserFound) return;

  push();
  translate(smoothLaserX, smoothLaserY);

  stroke(255, 255, 255, 190);
  strokeWeight(1.2);
  noFill();

  let r1 = 18 + sin(frameCount * 0.08) * 1.5;
  let r2 = 30 + sin(frameCount * 0.06) * 2;

  ellipse(0, 0, r1, r1);
  ellipse(0, 0, r2, r2);

  line(-10, 0, 10, 0);
  line(0, -10, 0, 10);

  fill(255, 80, 80, 220);
  noStroke();
  ellipse(0, 0, 6, 6);

  pop();
}

// =========================
// HUD
// =========================
function drawHUD() {
  push();
  noStroke();
  fill(255);
  textSize(16);
  text("Laser : " + (laserFound ? "OK" : "non detecte"), 20, 30);
  text("C = effacer", 20, 55);
  text("V = webcam on/off", 20, 80);
  text("H = HUD on/off", 20, 105);
  text("Z = zone detection on/off", 20, 130);
  pop();
}

// =========================
// INPUTS
// =========================
function keyPressed() {
  if (key === "c" || key === "C") {
    paintLayer.clear();
  }

  if (key === "v" || key === "V") {
    showCamera = !showCamera;
  }

  if (key === "h" || key === "H") {
    showHUD = !showHUD;
  }

  if (key === "z" || key === "Z") {
    showZone = !showZone;
  }
}

// =========================
// RESIZE
// =========================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let newLayer = createGraphics(windowWidth, windowHeight);
  newLayer.clear();
  newLayer.image(paintLayer, 0, 0, windowWidth, windowHeight);
  paintLayer = newLayer;
}
