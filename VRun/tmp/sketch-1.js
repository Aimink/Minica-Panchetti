let particles = [];
let hoverButton = false;
let hoverClear = false;
let paintMode = false;
let phase = 0;

let poster;
let brush;

let buttonX = 0;
let buttonY = 0;
let buttonW = 0;
let buttonH = 0;

let clearX = 0;
let clearY = 0;
let clearW = 0;
let clearH = 0;

let paintLayer;

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

function preload() {
  poster = loadImage("vrun.png");
  brush = loadImage("pinceau.png", (img) => {
    img.filter(INVERT);
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  noCursor();

  initParticles();

  paintLayer = createGraphics(windowWidth, windowHeight);
  paintLayer.clear();

  diff = brushSize / 8;
}

function initParticles() {
  particles = [];
  let count = min(120, max(50, floor((width * height) / 18000)));

  for (let i = 0; i < count; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      s: random(6, 18),
      dx: random(-0.18, 0.18),
      dy: random(-0.18, 0.18),
      a: random(18, 70),
      rot: random(TWO_PI),
      drot: random(-0.008, 0.008)
    });
  }
}

function draw() {
  background(8, 10, 20);

  drawGradient();
  drawAura();
  drawPoster();
  drawTriangles();
  drawButton();

  updateBrushPainting();
  image(paintLayer, 0, 0);

  drawButtonLabel();
  drawHelpBox();

  if (isMobileLayout()) {
    drawClearButton();
  }

  drawCursor();

  phase += 0.01;
}

function isMobileLayout() {
  return width < 900;
}

function drawGradient() {
  noStroke();
  for (let y = 0; y < height; y += 3) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(color(10, 8, 18), color(28, 24, 52), inter);
    fill(c);
    rect(width / 2, y, width, 4);
  }
}

function drawAura() {
  let ax, ay;

  if (isMobileLayout()) {
    ax = width * 0.5;
    ay = height * 0.44;
  } else {
    ax = width * 0.30;
    ay = height * 0.5;
  }

  noStroke();
  for (let i = 7; i > 0; i--) {
    let rr = i * (isMobileLayout() ? 90 : 120) + sin(phase + i) * 8;
    fill(180, 120, 255, 10);
    ellipse(ax, ay, rr, rr * 0.9);
  }
}

function drawPoster() {
  if (!poster) return;

  push();
  imageMode(CENTER);

  let isMobile = isMobileLayout();

  let zoneX, zoneY, zoneW, zoneH;

  if (isMobile) {
    zoneX = 0;
    zoneY = 0;
    zoneW = width;
    zoneH = height * 0.70;
  } else {
    zoneX = 0;
    zoneY = 0;
    zoneW = width * 0.58;
    zoneH = height;
  }

  let px = zoneX + zoneW * 0.5 + sin(frameCount * 0.01) * (isMobile ? 2 : 4);
  let py = zoneY + zoneH * (isMobile ? 0.42 : 0.5) + cos(frameCount * 0.01) * (isMobile ? 1.5 : 3);

  let fitScale = min(zoneW / poster.width, zoneH / poster.height);
  let scaleFactor = isMobile ? fitScale * 0.72 : fitScale * 0.82;

  let pw = poster.width * scaleFactor;
  let ph = poster.height * scaleFactor;

  noStroke();
  for (let i = 5; i > 0; i--) {
    fill(255, 120, 220, 8);
    ellipse(px, py, pw * 0.42 + i * 36, ph * 0.42 + i * 36);
  }

  drawingContext.shadowBlur = 40;
  drawingContext.shadowColor = "rgba(180,120,255,0.22)";
  image(poster, px, py, pw, ph);
  drawingContext.shadowBlur = 0;

  pop();
}

function drawTriangles() {
  noFill();
  strokeWeight(1.2);

  for (let p of particles) {
    p.x += p.dx;
    p.y += p.dy;
    p.rot += p.drot;

    if (p.x < -30) p.x = width + 30;
    if (p.x > width + 30) p.x = -30;
    if (p.y < -30) p.y = height + 30;
    if (p.y > height + 30) p.y = -30;

    push();
    translate(p.x, p.y);
    rotate(p.rot + sin(phase + p.x * 0.01) * 0.2);
    stroke(235, 240, 255, p.a);

    triangle(
      -p.s * 0.8, p.s * 0.6,
      0, -p.s * 0.8,
      p.s * 0.8, p.s * 0.6
    );

    pop();
  }
}

function drawButton() {
  let isMobile = isMobileLayout();

  let bxBtn, byBtn, bw, bh = 58;

  if (isMobile) {
    bxBtn = width * 0.5;
    byBtn = height * 0.84;
    bw = min(width * 0.78, 320);
  } else {
    bxBtn = width * 0.76;
    byBtn = height * 0.50;
    bw = 280;
  }

  buttonX = bxBtn;
  buttonY = byBtn;
  buttonW = bw;
  buttonH = bh;

  hoverButton =
    mouseX > bxBtn - bw / 2 &&
    mouseX < bxBtn + bw / 2 &&
    mouseY > byBtn - bh / 2 &&
    mouseY < byBtn + bh / 2;

  if (!isMobile && hoverButton) {
    paintMode = true;
  }

  if (paintMode) {
    fill(255, 90, 180, hoverButton ? 90 : 45);
    stroke(255, 120, 200, hoverButton ? 220 : 140);
  } else if (hoverButton) {
    fill(255, 255, 255, 28);
    stroke(255, 255, 255, 170);
  } else {
    fill(255, 255, 255, 14);
    stroke(255, 255, 255, 90);
  }

  strokeWeight(1.2);
  rect(bxBtn, byBtn, bw, bh, 12);
}

function drawButtonLabel() {
  let isMobile = isMobileLayout();

  push();
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 15 : 18);

  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = "rgba(0,0,0,0.45)";

  text(
    paintMode ? "ENTER VRun" : "PLAY",
    buttonX,
    buttonY - 1
  );

  drawingContext.shadowBlur = 0;
  pop();
}

function drawHelpBox() {
  if (!paintMode) return;

  let isMobile = isMobileLayout();

  let hx, hy, hw, hh;

  if (isMobile) {
    hw = min(width * 0.82, 290);
    hh = 42;
    hx = width * 0.5;
    hy = height * 0.7;
  } else {
    hw = 250;
    hh = 44;
    hx = width * 0.76;
    hy = height * 0.61;
  }

  push();

  
  noStroke();
  fill(255, 90, 180);
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 13 : 15);

  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = "rgba(0,0,0,0.45)";
  text(
    isMobile ? "PAINT WITH YOUR FINGER (use CLEAR to erase)" : "CLICK TO PAINT \n (Press C to clear)",
    hx,
    hy - 1
  );
  drawingContext.shadowBlur = 0;

  pop();
}

function drawClearButton() {
  if (!paintMode) return;

  clearW = 110;
  clearH = 42;
  clearX = width * 0.5;
  clearY = height *0.75;//* 0.92;

  hoverClear =
    mouseX > clearX - clearW / 2 &&
    mouseX < clearX + clearW / 2 &&
    mouseY > clearY - clearH / 2 &&
    mouseY < clearY + clearH / 2;

  push();

  if (hoverClear) {
    fill(255, 255, 255, 26);
    stroke(255, 255, 255, 150);
  } else {
    fill(255, 255, 255, 12);
    stroke(255, 255, 255, 90);
  }

  strokeWeight(1.1);
  rect(clearX, clearY, clearW, clearH, 12);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("CLEAR", clearX, clearY - 1);

  pop();
}

function resetBrushStroke() {
  brushAX = 0;
  brushAY = 0;
  brushA = 0;
  brushR = brushSize;
  brushActive = false;
}


function updateBrushPainting() {
  if (!paintMode) {
    resetBrushStroke();
    return;
  }

  let isDrawingNow = isMobileLayout() ? touches.length > 0 : mouseIsPressed;

  if (!isDrawingNow) {
    resetBrushStroke();
    return;
  }

  let targetX = constrain(mouseX, 0, width);
  let targetY = constrain(mouseY, 0, height);

  let moved = dist(mouseX, mouseY, pmouseX, pmouseY) > 0.5;

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

  brushA += sqrt(brushAX * brushAX + brushAY * brushAY) - brushA;
  brushA *= 0.6;

  brushR = brushSize - brushA;
  if (brushR < 1) brushR = 1;

  paintLayer.stroke(255, 255, 255, 70);
  paintLayer.noFill();

  let distanceSteps = 8;

  for (let i = 0; i < distanceSteps; i++) {
    let oldX = brushX;
    let oldY = brushY;

    brushX += brushAX / distanceSteps;
    brushY += brushAY / distanceSteps;

    oldR += (brushR - oldR) / distanceSteps;
    if (oldR < 1) oldR = 1;

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
  }
}
function drawCursor() {
  if (isMobileLayout()) return;

  push();
  imageMode(CENTER);

  if (paintMode && brush) {
    drawingContext.shadowBlur = 12;
    drawingContext.shadowColor = "rgba(255,120,200,0.55)";

    translate(mouseX, mouseY);
    rotate(-0.6 + sin(frameCount * 0.05) * 0.08);

    let s = 38;
    image(brush, 0, 0, s, s);

    drawingContext.shadowBlur = 0;
  } else {
    translate(mouseX, mouseY);

    stroke(255, 255, 255, 190);
    strokeWeight(1.2);
    noFill();

    let r1 = 18 + sin(frameCount * 0.08) * 1.5;
    let r2 = 30 + sin(frameCount * 0.06) * 2;

    ellipse(0, 0, r1, r1);
    ellipse(0, 0, r2, r2);

    line(-10, 0, 10, 0);
    line(0, -10, 0, 10);

    fill(255, 255, 255, 180);
    noStroke();
    ellipse(0, 0, 3, 3);
  }

  pop();
}

function mousePressed() {
  if (isMobileLayout()) return;

  if (hoverButton && !paintMode) {
    paintMode = true;
  } else if (hoverButton && paintMode) {
    window.open("https://raphaelmarczak.itch.io/vrun?password=FILWS", "_blank");
  }
}

function touchStarted() {
  let tx = touches[0].x;
  let ty = touches[0].y;

  let overMainButton =
    tx > buttonX - buttonW / 2 &&
    tx < buttonX + buttonW / 2 &&
    ty > buttonY - buttonH / 2 &&
    ty < buttonY + buttonH / 2;

  let overClearButton =
    paintMode &&
    tx > clearX - clearW / 2 &&
    tx < clearX + clearW / 2 &&
    ty > clearY - clearH / 2 &&
    ty < clearY + clearH / 2;

  if (overClearButton) {
    paintLayer.clear();
    return false;
  }

  if (overMainButton) {
    if (!paintMode) {
      paintMode = true;
    } else {
      window.open("https://raphaelmarczak.itch.io/vrun?password=FILWS", "_blank");
    }
  }

  return false;
}

function touchMoved() {
  return false;
}

function keyPressed() {
  if (key === "c" || key === "C") {
    paintLayer.clear();
  }

  if (keyCode === ESCAPE) {
    paintMode = false;
    brushAX = 0;
    brushAY = 0;
    brushActive = false;
  }
}
function mouseReleased() {
  resetBrushStroke();
}

function touchEnded() {
  resetBrushStroke();
  return false;
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initParticles();

  let newLayer = createGraphics(windowWidth, windowHeight);
  newLayer.clear();
  newLayer.image(paintLayer, 0, 0);
  paintLayer = newLayer;
}