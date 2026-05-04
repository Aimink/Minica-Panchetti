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
let brushSize = 10;
let diff;

let brushX = 0;
let brushY = 0;
let brushAX = 0;
let brushAY = 0;
let brushA = 0;
let brushR = 0;
let brushActive = false;

// =========================
// EFFETS PEINTURE
// =========================
let fadeAmount = 5;       // 0 = le dessin ne disparaît pas
let glowBlur = 22;        // intensité du halo
let glowAlpha = 170;      // opacité du trait principal
let sprayChance = 0.08;   // faible : évite les petits points trop artificiels
let dripChance = 0.02;//0.055;   // coulures

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
let showCamera = true;
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
  // Pour projection transparente dans TouchDesigner :
  // remplace background(20) par clear().
  background(20);
  // clear();

  if (showCamera) {
    push();
    tint(255, 180);
    image(cam, 0, 0, width, height);
    pop();
  }

//  if (fadeAmount > 0) {
//  applyFade();
//  }

  detectRedLaser();
  updateBrushPaintingLaser();

  image(paintLayer, 0, 0);
  //if (frameCount % 120 == 0) {
//    paintLayer.clear();
//  }
  drawLaserCursor();

  if (showZone) {
    drawDetectionZone();
  }

  if (showHUD) {
    drawHUD();
  }
}

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

function applyFade() {
  paintLayer.push();
  paintLayer.noStroke();
  paintLayer.drawingContext.globalCompositeOperation = "destination-out";
  paintLayer.fill(0, 0, 0, fadeAmount);
  paintLayer.rect(0, 0, paintLayer.width, paintLayer.height);
  paintLayer.drawingContext.globalCompositeOperation = "source-over";
  paintLayer.pop();
}

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

function resetBrushStroke() {
  brushAX = 0;
  brushAY = 0;
  brushA = 0;
  brushR = brushSize;
  brushActive = false;
}

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

  paintLayer.drawingContext.shadowBlur = glowBlur;
  paintLayer.drawingContext.shadowColor = "rgba(255,255,255,1)";
  paintLayer.stroke(255, 255, 255, glowAlpha);
  paintLayer.noFill();

  // Plus élevé = trait plus continu, moins pointillé.
  let distanceSteps = 18;

  for (let i = 0; i < distanceSteps; i++) {
    let oldX = brushX;
    let oldY = brushY;

    brushX += brushAX / distanceSteps;
    brushY += brushAY / distanceSteps;

    oldR += (brushR - oldR) / distanceSteps;
    if (oldR < 1) oldR = 1;

    paintLayer.strokeWeight(oldR + diff);
    paintLayer.line(brushX, brushY, oldX, oldY);

    paintLayer.strokeWeight(oldR + 1.2);
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

    if (random(1) < dripChance && laserSpeed < 55) {
     graffitiDrip(brushX, brushY, oldR);
    }

    if (random(1) < sprayChance) {
      graffitiSpray(brushX, brushY, oldR);
    }
  }

  paintLayer.drawingContext.shadowBlur = 0;
}

function graffitiDrip(x, y, sprayWidth) {
  let dripLength = ceil(random(sprayWidth * 1.5, 10 * sprayWidth));
  let dripWidth = floor(random(max(1, sprayWidth / 10), max(2, sprayWidth / 2)));

  paintLayer.push();
  paintLayer.drawingContext.shadowBlur = 12;
  paintLayer.drawingContext.shadowColor = "rgba(255,255,255,0.9)";

  paintLayer.strokeWeight(dripWidth);
  paintLayer.stroke(255, 255, 255, random(95, 195));

  let endX = x + random(-3, 3);
  let endY = y + dripLength;

  // Coulure verticale légèrement irrégulière.
  paintLayer.line(x, y, endX, endY);

  // Goutte organique au bout.
//  drawOrganicDrip(endX, endY, dripWidth);

  paintLayer.drawingContext.shadowBlur = 0;
  paintLayer.pop();
}

function drawOrganicDrip(x, y, w) {
  paintLayer.push();
  paintLayer.noStroke();

  // Amas de petites formes imparfaites.
  for (let i = 0; i < 6; i++) {
    paintLayer.fill(255, 255, 255, random(75, 165));
    paintLayer.ellipse(
      x + random(-w * 0.45, w * 0.45),
      y + random(-w * 0.25, w * 0.25),
      w * random(1.1, 2.1),
      w * random(1.4, 3.0)
    );
  }

  // Cœur plus dense, mais pas parfaitement centré.
  paintLayer.fill(255, 255, 255, random(170, 225));
  paintLayer.ellipse(
    x + random(-w * 0.12, w * 0.12),
    y + random(-w * 0.10, w * 0.10),
    w * random(0.7, 1.05),
    w * random(1.0, 1.45)
  );

  // Petite traînée sous la goutte.
  paintLayer.stroke(255, 255, 255, random(80, 140));
  paintLayer.strokeWeight(max(1, w * 0.35));
  paintLayer.line(x, y, x + random(-1, 1), y + random(4, 10));

  paintLayer.pop();
}

function graffitiSpray(x, y, sprayWidth) {

  sprayWidth = sprayWidth * 2;
  let spotX = x + 4.5 * random(-sprayWidth, sprayWidth);
  let spotY = y + 4.5 * random(-sprayWidth, sprayWidth);
  let spotWidth = floor(random(max(1, sprayWidth / 6), max(2, sprayWidth * 0.65)));

  paintLayer.push();
  paintLayer.noStroke();
  paintLayer.fill(255, 255, 255, random(25, 85));
  paintLayer.ellipse(
    spotX,
    spotY,
    spotWidth * random(0.7, 1.3),
    spotWidth * random(0.7, 1.3)
  );
  paintLayer.pop();
}

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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let newLayer = createGraphics(windowWidth, windowHeight);
  newLayer.clear();
  newLayer.image(paintLayer, 0, 0, windowWidth, windowHeight);
  paintLayer = newLayer;
}
