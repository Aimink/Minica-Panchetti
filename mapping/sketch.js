let cam;
let paintLayer;

// =========================
// DETECTION LASER MAGENTA / ROUGE
// =========================
let minRed = 70;
let maxGreen = 255;
let maxBlue = 255;
let minRedDominance = 0;
let minBrightness = 25;

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
let fadeAmount = 5;
let glowBlur = 22;
let glowAlpha = 170;
let sprayChance = 0.08;
let dripChance = 0.02;

// =========================
// TIMER EFFACEMENT
// =========================
let lastPaintTime = 0;
let eraseDuration = 2000;

// =========================
// LASER POSITION
// =========================
let laserFound = false;
let detectedPixels = 0;

let rawLaserX = 0;
let rawLaserY = 0;
let prevRawLaserX = 0;
let prevRawLaserY = 0;

let smoothLaserX = 0;
let smoothLaserY = 0;
let smoothing = 0.35;

let laserSpeed = 0;
let currentCameraLaserX = 0;
let currentCameraLaserY = 0;
let debugBestR = 0;
let debugBestG = 0;
let debugBestB = 0;
let debugBestBrightness = 0;
let debugBestScore = -999999;

// =========================
// AFFICHAGE
// =========================
let showCamera = true;
let showHUD = true;
let showZone = true;
let useCalibrationPolygon = true;

// =========================
// ZONE DE DETECTION CAMERA
// =========================
let roiX = 0;
let roiY = 0;
let roiW = 640;
let roiH = 480;

// =========================
// CALIBRATION CAMERA -> CANVAS
// Ordre : haut gauche, haut droite, bas droite, bas gauche.
// =========================
let calibrationMode = true;
let calibrationPoints = [
  { x: null, y: null, locked: false },
  { x: null, y: null, locked: false },
  { x: null, y: null, locked: false },
  { x: null, y: null, locked: false }
];

let selectedCalibrationCorner = 0;
let homography = null;
let calibrationMessage = "Calibrage : coin 1, placez le point avec la souris puis double-cliquez.";

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

  if (showCamera && cam && cam.width > 0 && cam.height > 0) {
    push();
    tint(255, 180);
    image(cam, 0, 0, width, height);
    pop();
  }

  if (cam && cam.width > 0 && cam.height > 0) {
    detectRedLaser();
    updateBrushPaintingLaser();
  }

  if (millis() - lastPaintTime > eraseDuration && lastPaintTime > 0) {
    paintLayer.clear();
    lastPaintTime = 0;
  }

  drawPaintLayer();

  drawLaserCursor();

  if (homography) {
    drawCalibratedZone();
  }

  if (calibrationMode) {
    drawCanvasOverlay();
    drawCalibrationGuide();
  }

  if (showZone) {
    drawDetectionZone();
  }

  if (showHUD) {
    drawHUD();
  }
}

function drawDetectionZone() {
  if (!cam || cam.width <= 0 || cam.height <= 0) return;

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

function drawPaintLayer() {
  let allLocked = calibrationPoints.every((p) => p.locked && p.x !== null && p.y !== null);

  if (!homography || !allLocked) {
    image(paintLayer, 0, 0);
    return;
  }

  push();
  drawingContext.save();
  drawingContext.beginPath();

  for (let i = 0; i < calibrationPoints.length; i++) {
    let screen = cameraPointToScreen(calibrationPoints[i]);

    if (i === 0) {
      drawingContext.moveTo(screen.x, screen.y);
    } else {
      drawingContext.lineTo(screen.x, screen.y);
    }
  }

  drawingContext.closePath();
  drawingContext.clip();
  image(paintLayer, 0, 0);
  drawingContext.restore();
  pop();
}

function drawCanvasOverlay() {
  push();

  let defaultCorners = getDefaultScreenCorners();

  for (let i = 0; i < calibrationPoints.length; i++) {
    let corner = calibrationPoints[i];
    let screenPos = cameraPointToScreen(corner, defaultCorners[i]);

    if (corner.locked) {
      fill(0, 255, 0, 180);
      noStroke();
      ellipse(screenPos.x, screenPos.y, 18, 18);
    } else {
      noFill();
      stroke(0, 255, 0, 180);
      strokeWeight(2);
      ellipse(screenPos.x, screenPos.y, 14, 14);
    }
  }

  let selected = calibrationPoints[selectedCalibrationCorner];
  let fallback = calibrationMode
    ? getMouseScreenPosition()
    : defaultCorners[selectedCalibrationCorner];

  let preview = cameraPointToScreen(selected, fallback);

  stroke(0, 255, 0);
  strokeWeight(4);
  noFill();
  ellipse(preview.x, preview.y, 40, 40);

  fill(0, 255, 0, 80);
  noStroke();
  ellipse(preview.x, preview.y, 20, 20);

  pop();
}

function drawCalibratedZone() {
  let allLocked = calibrationPoints.every((p) => p.locked && p.x !== null && p.y !== null);
  if (!allLocked) return;

  push();

  stroke(0, 255, 0, 220);
  strokeWeight(4);
  noFill();

  beginShape();
  for (let p of calibrationPoints) {
    let screen = cameraPointToScreen(p);
    vertex(screen.x, screen.y);
  }
  endShape(CLOSE);

  fill(0, 255, 0, 16);
  noStroke();

  beginShape();
  for (let p of calibrationPoints) {
    let screen = cameraPointToScreen(p);
    vertex(screen.x, screen.y);
  }
  endShape(CLOSE);

  pop();
}

function drawCalibrationGuide() {
  push();

  fill(255, 255, 0);
  noStroke();
  textSize(18);
  text("CALIBRATION", 24, 44);
  text(calibrationMessage, 24, 70);

  let defaultCorners = getDefaultScreenCorners();
  let currentPoint = calibrationPoints[selectedCalibrationCorner];

  let fallback = calibrationMode
    ? getMouseScreenPosition()
    : defaultCorners[selectedCalibrationCorner];

  let preview = cameraPointToScreen(currentPoint, fallback);

  stroke(0, 255, 0);
  strokeWeight(3);
  noFill();
  ellipse(preview.x, preview.y, 40, 40);

  fill(0, 255, 0, 120);
  noStroke();
  ellipse(preview.x, preview.y, 18, 18);

  for (let i = 0; i < calibrationPoints.length; i++) {
    let p = calibrationPoints[i];

    if (p.x !== null && p.y !== null) {
      let screen = cameraPointToScreen(p);

      if (p.locked) {
        stroke(255);
        strokeWeight(2);
        fill(0, 255, 0, 220);
        ellipse(screen.x, screen.y, 22, 22);
      } else {
        noStroke();
        fill(255, 255, 0, 220);
        ellipse(screen.x, screen.y, 14, 14);
      }

      fill(0);
      noStroke();
      textSize(14);
      textAlign(CENTER, CENTER);
      text("P" + (i + 1), screen.x, screen.y);
    }
  }

  pop();
}

function getDefaultScreenCorners() {
  return [
    { x: 40, y: 40 },
    { x: width - 40, y: 40 },
    { x: width - 40, y: height - 40 },
    { x: 40, y: height - 40 }
  ];
}

function getMouseScreenPosition() {
  return {
    x: constrain(mouseX, 0, width),
    y: constrain(mouseY, 0, height)
  };
}

function cameraPointToScreen(point, fallback = null) {
  if (point && point.x !== null && point.y !== null && cam && cam.width > 0 && cam.height > 0) {
    return {
      x: map(point.x, 0, cam.width, 0, width),
      y: map(point.y, 0, cam.height, 0, height)
    };
  }

  return fallback || { x: 0, y: 0 };
}

function detectRedLaser() {
  cam.loadPixels();

  if (!cam.pixels || cam.pixels.length === 0) {
    laserFound = false;
    detectedPixels = 0;
    return;
  }

  debugBestR = 0;
  debugBestG = 0;
  debugBestB = 0;
  debugBestBrightness = 0;
  debugBestScore = -999999;

  let bestScore = -1;
  let bestX = -1;
  let bestY = -1;
  let detectedCount = 0;

  let yEnd = min(roiY + roiH, cam.height);
  let xEnd = min(roiX + roiW, cam.width);

  for (let y = roiY; y < yEnd; y += 2) {
    for (let x = roiX; x < xEnd; x += 2) {
      if (useCalibrationPolygon && !calibrationMode && homography && !pointInCalibrationPolygon(x, y)) {
        continue;
      }

      let i = (x + y * cam.width) * 4;

      let r = cam.pixels[i];
      let g = cam.pixels[i + 1];
      let b = cam.pixels[i + 2];
      let brightness = (r + g + b) / 3;

      let redDominance = r - max(g, b);
      let pinkDominance = r + b - g * 1.35;
      let hotPink = r > 110 && b > 70 && g < 235 && pinkDominance > 70;
      let redHotspot = r > 110 && r >= g - 10 && r >= b - 35;
      let whiteCore = brightness > 115 && r > 100 && r >= g - 15 && b >= g - 40;
      let candidateScore = r * 1.4 + b * 0.8 - g * 0.7 + brightness;

      if (candidateScore > debugBestScore) {
        debugBestScore = candidateScore;
        debugBestR = r;
        debugBestG = g;
        debugBestB = b;
        debugBestBrightness = brightness;
      }

      let isLaser =
        brightness > minBrightness &&
        r > minRed &&
        (hotPink || redHotspot || whiteCore || redDominance > minRedDominance);

      if (isLaser) {
        detectedCount++;

        let score =
          r * 2.0 +
          (r - g) * 1.2 +
          (r - b) * 0.4 +
          brightness * 0.8;

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
  }

  detectedPixels = detectedCount;

  if (bestX >= 0 && detectedCount > 0) {
    currentCameraLaserX = bestX;
    currentCameraLaserY = bestY;

    prevRawLaserX = rawLaserX;
    prevRawLaserY = rawLaserY;

    let mappedPoint = mapCameraToCanvas(bestX, bestY, !calibrationMode);

    rawLaserX = mappedPoint.x;
    rawLaserY = mappedPoint.y;

    let jump = dist(rawLaserX, rawLaserY, prevRawLaserX, prevRawLaserY);

    if (laserFound && jump > 250) {
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

function mapCameraToCanvas(cameraX, cameraY, useHomography = true) {
  if (useHomography && homography) {
    let mapped = applyHomography(cameraX, cameraY, homography);

    if (isValidPoint(mapped)) {
      return {
        x: constrain(mapped.x, 0, width),
        y: constrain(mapped.y, 0, height)
      };
    }
  }

  return {
    x: map(cameraX, 0, cam.width, 0, width),
    y: map(cameraY, 0, cam.height, 0, height)
  };
}

function isValidPoint(p) {
  return p && isFinite(p.x) && isFinite(p.y);
}

function applyHomography(x, y, h) {
  let denom = h[6] * x + h[7] * y + 1;

  if (abs(denom) < 0.0000001) {
    return null;
  }

  return {
    x: (h[0] * x + h[1] * y + h[2]) / denom,
    y: (h[3] * x + h[4] * y + h[5]) / denom
  };
}

function computeHomography(srcPoints, dstPoints) {
  let A = [];
  let b = [];

  for (let i = 0; i < 4; i++) {
    let sx = srcPoints[i].x;
    let sy = srcPoints[i].y;
    let dx = dstPoints[i].x;
    let dy = dstPoints[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  return solveLinearSystem(A, b);
}

function solveLinearSystem(A, b) {
  let n = A.length;
  let M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;

    while (pivot < n && abs(M[pivot][col]) < 0.0000000001) {
      pivot++;
    }

    if (pivot === n) {
      continue;
    }

    if (pivot !== col) {
      let tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }

    let pivotValue = M[col][col];

    for (let c = col; c <= n; c++) {
      M[col][c] /= pivotValue;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;

      let factor = M[r][col];
      if (abs(factor) < 0.0000000001) continue;

      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  let solution = [];

  for (let i = 0; i < n; i++) {
    solution.push(M[i][n]);
  }

  return solution;
}

function orderCalibrationPoints(points) {
  let validPoints = points.filter((p) => p.x !== null && p.y !== null);
  if (validPoints.length !== 4) return points;

  let sortedByY = [...validPoints].sort((a, b) => a.y - b.y);
  let top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  let bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);

  return [
    { ...top[0], locked: true },
    { ...top[1], locked: true },
    { ...bottom[1], locked: true },
    { ...bottom[0], locked: true }
  ];
}

function updateDetectionROIFromCalibration() {
  let xs = calibrationPoints.map((p) => p.x);
  let ys = calibrationPoints.map((p) => p.y);
  let margin = 12;

  let left = floor(min(xs) - margin);
  let right = ceil(max(xs) + margin);
  let top = floor(min(ys) - margin);
  let bottom = ceil(max(ys) + margin);

  roiX = constrain(left, 0, cam.width - 1);
  roiY = constrain(top, 0, cam.height - 1);
  roiW = constrain(right - roiX, 1, cam.width - roiX);
  roiH = constrain(bottom - roiY, 1, cam.height - roiY);
}

function pointInCalibrationPolygon(x, y) {
  let inside = false;
  let pts = calibrationPoints;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    let xi = pts[i].x;
    let yi = pts[i].y;
    let xj = pts[j].x;
    let yj = pts[j].y;

    let intersect =
      ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function registerCalibrationPoint(cameraX, cameraY) {
  if (!calibrationMode) return;

  let point = calibrationPoints[selectedCalibrationCorner];

  if (cameraX !== undefined && cameraY !== undefined) {
    point.x = constrain(cameraX, 0, cam.width);
    point.y = constrain(cameraY, 0, cam.height);
  } else if (point.x === null || point.y === null) {
    calibrationMessage = "Aucune position disponible pour valider ce coin.";
    return;
  }

  point.locked = true;

  if (selectedCalibrationCorner < 3) {
    selectedCalibrationCorner++;
    calibrationMessage = "Coin " + (selectedCalibrationCorner + 1) + " : placez avec la souris puis double-cliquez.";
  } else {
    calibrationPoints = orderCalibrationPoints(calibrationPoints);
    let srcPoints = calibrationPoints.map((p) => ({ x: p.x, y: p.y }));

    let dstPoints = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];

    homography = computeHomography(srcPoints, dstPoints);
    updateDetectionROIFromCalibration();

    calibrationMode = false;
    useCalibrationPolygon = true;
    calibrationMessage = "Calibrage termine. Detection et dessin limites a la zone.";
    laserFound = false;
    paintLayer.clear();
    resetBrushStroke();
  }
}

function mouseToCameraPoint() {
  if (!cam || cam.width <= 0 || cam.height <= 0) return null;

  return {
    x: constrain(map(mouseX, 0, width, 0, cam.width), 0, cam.width),
    y: constrain(map(mouseY, 0, height, 0, cam.height), 0, cam.height)
  };
}

function setCurrentCalibrationPointFromMouse() {
  if (!calibrationMode) return false;

  let mousePoint = mouseToCameraPoint();
  if (!mousePoint) return false;

  let point = calibrationPoints[selectedCalibrationCorner];
  point.x = mousePoint.x;
  point.y = mousePoint.y;
  point.locked = false;

  calibrationMessage = "Coin " + (selectedCalibrationCorner + 1) + " place. Double-cliquez pour confirmer.";
  return true;
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

  lastPaintTime = millis();

  paintLayer.drawingContext.shadowBlur = glowBlur;
  paintLayer.drawingContext.shadowColor = "rgba(255,255,255,1)";
  paintLayer.stroke(255, 255, 255, glowAlpha);
  paintLayer.noFill();

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
  paintLayer.line(x, y, endX, endY);

  paintLayer.drawingContext.shadowBlur = 0;
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

  drawingContext.shadowBlur = 3;
  drawingContext.shadowColor = "rgba(0,0,0,0.7)";

  noStroke();
  fill(255);
  textSize(16);

  text("Laser : " + (laserFound ? "OK" : "non detecte"), 20, 30);
  text("Pixels detectes : " + detectedPixels, 20, 50);
  text("RGB test : " + debugBestR + "," + debugBestG + "," + debugBestB + " / L " + floor(debugBestBrightness), 20, 70);
  text("Mode : " + (calibrationMode ? "CALIBRATION" : "PEINTURE"), 20, 100);
  text("P = filtre trapeze " + (useCalibrationPolygon ? "ON" : "OFF"), 20, 130);

  if (calibrationMode) {
    text("Souris = placer le coin", 20, 160);
    text("Double-clic = confirmer", 20, 190);
    text("Espace = confirmer aussi", 20, 220);
  }

  let controlsY = calibrationMode ? 260 : 200;
  text("C = effacer", 20, controlsY);
  text("R = recalibrer", 20, controlsY + 30);
  text("H = HUD on/off", 20, controlsY + 60);
  text("Z = zone detection on/off", 20, controlsY + 90);
  text("V = camera on/off", 20, controlsY + 120);

  drawingContext.shadowBlur = 0;
  pop();
}

function mousePressed() {
  if (calibrationMode) {
    setCurrentCalibrationPointFromMouse();
    return false;
  }
}

function mouseMoved() {
  if (calibrationMode) {
    setCurrentCalibrationPointFromMouse();
  }
}

function mouseDragged() {
  if (calibrationMode) {
    setCurrentCalibrationPointFromMouse();
    return false;
  }
}

function doubleClicked() {
  if (calibrationMode && setCurrentCalibrationPointFromMouse()) {
    let currentPoint = calibrationPoints[selectedCalibrationCorner];
    registerCalibrationPoint(currentPoint.x, currentPoint.y);
    return false;
  }
}

function keyPressed() {
  if (key === " " || keyCode === 32) {
    if (calibrationMode) {
      let currentPoint = calibrationPoints[selectedCalibrationCorner];

      if (currentPoint.x !== null && currentPoint.y !== null) {
        registerCalibrationPoint(currentPoint.x, currentPoint.y);
      } else if (setCurrentCalibrationPointFromMouse()) {
        currentPoint = calibrationPoints[selectedCalibrationCorner];
        registerCalibrationPoint(currentPoint.x, currentPoint.y);
      } else {
        calibrationMessage = "Placez le coin avec la souris, puis double-cliquez.";
      }
    }

    return;
  }

  if (
    calibrationMode &&
    (keyCode === LEFT_ARROW ||
      keyCode === RIGHT_ARROW ||
      keyCode === UP_ARROW ||
      keyCode === DOWN_ARROW)
  ) {
    let delta = keyIsDown(SHIFT) ? 10 : 1;
    let currentPoint = calibrationPoints[selectedCalibrationCorner];

    if (currentPoint.x === null || currentPoint.y === null) {
      if (laserFound) {
        currentPoint.x = currentCameraLaserX;
        currentPoint.y = currentCameraLaserY;
      } else {
        currentPoint.x = selectedCalibrationCorner % 2 === 0 ? 0 : cam.width;
        currentPoint.y = selectedCalibrationCorner < 2 ? 0 : cam.height;
      }
    }

    if (keyCode === LEFT_ARROW) currentPoint.x = constrain(currentPoint.x - delta, 0, cam.width);
    if (keyCode === RIGHT_ARROW) currentPoint.x = constrain(currentPoint.x + delta, 0, cam.width);
    if (keyCode === UP_ARROW) currentPoint.y = constrain(currentPoint.y - delta, 0, cam.height);
    if (keyCode === DOWN_ARROW) currentPoint.y = constrain(currentPoint.y + delta, 0, cam.height);

    currentPoint.locked = false;
    calibrationMessage = "Ajustez le coin " + (selectedCalibrationCorner + 1) + ", puis double-cliquez pour valider.";
    return;
  }

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

  if (key === "p" || key === "P") {
    useCalibrationPolygon = !useCalibrationPolygon;
  }

  if (key === "r" || key === "R") {
    resetCalibration();
  }
}

function resetCalibration() {
  calibrationMode = true;

  calibrationPoints = [
    { x: null, y: null, locked: false },
    { x: null, y: null, locked: false },
    { x: null, y: null, locked: false },
    { x: null, y: null, locked: false }
  ];

  selectedCalibrationCorner = 0;
  homography = null;

  roiX = 0;
  roiY = 0;
  roiW = cam ? cam.width : 640;
  roiH = cam ? cam.height : 480;

  calibrationMessage = "Recalibrage : coin 1, placez le point avec la souris puis double-cliquez.";

  laserFound = false;
  paintLayer.clear();
  resetBrushStroke();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let newLayer = createGraphics(windowWidth, windowHeight);
  newLayer.clear();
  newLayer.image(paintLayer, 0, 0, windowWidth, windowHeight);
  paintLayer = newLayer;

  if (homography && calibrationPoints.every((p) => p.locked && p.x !== null && p.y !== null)) {
    calibrationPoints = orderCalibrationPoints(calibrationPoints);
    let srcPoints = calibrationPoints.map((p) => ({ x: p.x, y: p.y }));

    let dstPoints = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];

    homography = computeHomography(srcPoints, dstPoints);
  }
}



