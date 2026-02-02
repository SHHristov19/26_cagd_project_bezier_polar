/*  IMPORTANT: All curve evaluation is done via the de Casteljau algorithm.
    No Bernstein evaluation is used. */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });

function resize(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = true; // anti-aliasing hint
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
window.addEventListener('resize', resize);
resize();

// ---- State ----
let points = [];
let dragIndex = -1;

let mode = 'normal'; // 'normal' | 'blossom'
let currentPreset = 'preset4';
let tParam = 0.3;
let play = false;

let t1 = 0.5, t2 = 0.6, t3 = 0.8;

// view transform (world -> screen)
let view = { scale: 1, tx: 0, ty: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
let spaceDown = false;

const grid = document.getElementById('grid');

// UI refs
const tRange = document.getElementById('tRange');
const tVal = document.getElementById('tVal');
const playBtn = document.getElementById('playT');

const stChip = document.getElementById('stChip');
const blossomChip = document.getElementById('blossomChip');
const editChip = document.getElementById('editChip');

const t1Range = document.getElementById('t1Range');
const t2Range = document.getElementById('t2Range');
const t3Range = document.getElementById('t3Range');
const t1Val = document.getElementById('t1Val');
const t2Val = document.getElementById('t2Val');
const t3Val = document.getElementById('t3Val');
const showCurve = document.getElementById('showCurve');
const showPoint = document.getElementById('showPoint');
const showPolygon = document.getElementById('showPolygon');
const showPolar = document.getElementById('showPolar');
const showBezier = document.getElementById('showBezier');

function clamp01(v){ return Math.min(1, Math.max(0, v)); }

function setMode(m){
  mode = m;
  if (mode === 'blossom'){
    stChip.style.display = 'none';
    blossomChip.style.display = 'flex';
    if (editChip) editChip.style.display = 'none';
    play = false;
    playBtn.textContent = 'Play t';
  } else {
    stChip.style.display = 'flex';
    blossomChip.style.display = 'none';
    if (editChip) editChip.style.display = 'flex';
  }
}

function setT(v){
  tParam = clamp01(v);
  tRange.value = String(tParam);
  tVal.textContent = tParam.toFixed(3);
}
function setT1(v){ t1 = clamp01(v); t1Range.value = String(t1); t1Val.textContent = t1.toFixed(3); }
function setT2(v){ t2 = clamp01(v); t2Range.value = String(t2); t2Val.textContent = t2.toFixed(3); }
function setT3(v){ t3 = clamp01(v); t3Range.value = String(t3); t3Val.textContent = t3.toFixed(3); }

// ---- Presets ----
function preset3(){
  points = [{x:-260,y:120},{x:0,y:-180},{x:260,y:120}];
  setMode('normal');
  play = false; playBtn.textContent = 'Play t';
  requestAutoFit(true);
}
function preset4(){
  points = [{x:-320,y:170},{x:-120,y:-190},{x:120,y:-190},{x:320,y:170}];
  setMode('normal');
  play = false; playBtn.textContent = 'Play t';
  requestAutoFit(true);
}
function presetBlossom(){
  // approximate layout from the slide but in "world space" centered
    // Use the same control point coordinates as Preset (4 points)
  points = [
    {x:-320,y:170},
    {x:-120,y:-190},
    {x:120,y:-190},
    {x:320,y:170}
  ];
  setMode('blossom');
  setT1(0.5); setT2(0.6); setT3(0.8);
  requestAutoFit(true);
}

document.getElementById('preset3').onclick = preset3;
document.getElementById('preset4').onclick = preset4;
document.getElementById('presetBlossom').onclick = presetBlossom;

document.getElementById('add').onclick = () => {
  points.push({x: 0 + (points.length-2)*60, y: 0});
  requestAutoFit(true);
};
document.getElementById('remove').onclick = () => {
  if (points.length > 2) points.pop();
  requestAutoFit(true);
};tRange.oninput = e => setT(parseFloat(e.target.value));

t1Range.oninput = e => setT1(parseFloat(e.target.value));
t2Range.oninput = e => setT2(parseFloat(e.target.value));
t3Range.oninput = e => setT3(parseFloat(e.target.value));

playBtn.onclick = () => { play = !play; playBtn.textContent = play ? 'Pause t' : 'Play t'; };

document.getElementById('resetView').onclick = () => {
  // Full reset: restore the active preset's original control points and reset the camera to fit.
  if (currentPreset === 'preset3') preset3();
  else if (currentPreset === 'preset4') preset4();
  else if (currentPreset === 'presetBlossom') presetBlossom();
  else preset4();
  requestAutoFit(true);
};

// ---- Input handling: drag points / pan / zoom ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'Control') { spaceDown = true; canvas.style.cursor = 'grab'; }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Control') { spaceDown = false; isPanning = false; canvas.style.cursor = 'default'; }
});

function screenToWorld(x, y){
  // invert view transform: screen = world*scale + center + (tx,ty)
  const cx = window.innerWidth / 2 + view.tx;
  const cy = window.innerHeight / 2 + view.ty;
  return { x: (x - cx) / view.scale, y: (y - cy) / view.scale };
}

function worldToScreen(p){
  const cx = window.innerWidth / 2 + view.tx;
  const cy = window.innerHeight / 2 + view.ty;
  return { x: p.x * view.scale + cx, y: p.y * view.scale + cy };
}

canvas.addEventListener('mousedown', (e) => {
  const mx = e.clientX, my = e.clientY;

  if (spaceDown){
    isPanning = true;
    panStart = { x: mx, y: my, tx: view.tx, ty: view.ty };
    canvas.style.cursor = 'grabbing';
    return;
  }

  const w = screenToWorld(mx, my);
  dragIndex = -1;
  for (let i=0;i<points.length;i++){
    const p = points[i];
    if (Math.hypot(p.x - w.x, p.y - w.y) < 10 / view.scale){
      dragIndex = i; break;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  const mx = e.clientX, my = e.clientY;

  if (isPanning){
    view.tx = panStart.tx + (mx - panStart.x);
    view.ty = panStart.ty + (my - panStart.y);
    return;
  }

  if (dragIndex === -1) return;
  const w = screenToWorld(mx, my);
  points[dragIndex].x = w.x;
  points[dragIndex].y = w.y;
  // keep centered while editing if enabled
  // auto-centering disabled during drag to preserve zoom
});

window.addEventListener('mouseup', () => {
  dragIndex = -1;
  if (isPanning){ isPanning = false; canvas.style.cursor = spaceDown ? 'grab' : 'default'; }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = Math.exp(-e.deltaY * 0.0012);
  const mx = e.clientX, my = e.clientY;
  const before = screenToWorld(mx, my);
  view.scale = Math.min(6, Math.max(0.2, view.scale * zoomFactor));
  const after = screenToWorld(mx, my);
  // adjust pan so point under mouse stays fixed
  const dx = (after.x - before.x) * view.scale;
  const dy = (after.y - before.y) * view.scale;
  view.tx += dx;
  view.ty += dy;
}, { passive:false });

// ---- de Casteljau ONLY ----
function lerp(a,b,u){ return { x: a.x*(1-u)+b.x*u, y: a.y*(1-u)+b.y*u }; }

function deCasteljauTriangle(ctrl, u){
  const levels = [];
  levels.push(ctrl.map(p => ({...p})));
  for (let k=1;k<ctrl.length;k++){
    const prev = levels[k-1];
    const cur = [];
    for (let i=0;i<prev.length-1;i++) cur.push(lerp(prev[i], prev[i+1], u));
    levels.push(cur);
  }
  return levels;
}
function bezierPoint(ctrl, u){
  const levels = deCasteljauTriangle(ctrl, u);
  return levels[levels.length-1][0];
}

// Blossom evaluation for cubic with different parameters at each stage
function blossomCubic(ctrl, t1, t2, t3){
  const c0=ctrl[0], c1=ctrl[1], c2=ctrl[2], c3=ctrl[3];
  const c01=lerp(c0,c1,t1), c11=lerp(c1,c2,t1), c21=lerp(c2,c3,t1);
  const c02=lerp(c01,c11,t2), c12=lerp(c11,c21,t2);
  const c03=lerp(c02,c12,t3);
  return { level1:[c01,c11,c21], level2:[c02,c12], level3:c03 };
}

// Use de Casteljau on the derivative control points too (still de Casteljau evaluation)
function derivativeControlPoints(ctrl){
  const n = ctrl.length - 1;
  const d = [];
  for (let i=0;i<n;i++){
    d.push({ x: n*(ctrl[i+1].x-ctrl[i].x), y: n*(ctrl[i+1].y-ctrl[i].y) });
  }
  return d;
}

// ---- Drawing helpers ----
function strokePath(points2d, color, width, alpha=1){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points2d.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
  ctx.stroke();
  ctx.restore();
}

function drawPointWorld(p, radius, fill, stroke=null){
  const s = worldToScreen(p);
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI*2);
  ctx.fill();
  if (stroke){
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabelWorld(text, p, color){
  const s = worldToScreen(p);
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText(text, s.x + 10, s.y - 10);
  ctx.restore();
}

function drawCurveWorld(ctrl, color, width, alpha=1){
  // adaptive-ish: step based on zoom so it stays smooth
  const step = Math.max(0.0025, 0.012 / view.scale);
  const pts = [];
  for (let u=0; u<=1.000001; u+=step){
    pts.push(worldToScreen(bezierPoint(ctrl,u)));
  }
  strokePath(pts, color, width, alpha);
}

function drawGrid(){
  if (!grid.checked) return;
  const w = window.innerWidth, h = window.innerHeight;
  const center = { x: w/2 + view.tx, y: h/2 + view.ty };
  const spacing = 60 * view.scale; // screen pixels
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  // vertical
  const startX = center.x % spacing;
  for (let x=startX; x<w; x+=spacing){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }
  // horizontal
  const startY = center.y % spacing;
  for (let y=startY; y<h; y+=spacing){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }
  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, center.y); ctx.lineTo(w, center.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(center.x, 0); ctx.lineTo(center.x, h); ctx.stroke();
  ctx.restore();
}

// ---- Auto-centering / fitting ----
let fitRequested = true;
let fitHardReset = false;

function requestAutoFit(hard=false){
  fitRequested = true;
  fitHardReset = fitHardReset || hard;
}

function computeBoundsWorld(extraPoints){
  const all = [...points, ...(extraPoints || [])];
  if (all.length === 0) return { minX:-1,maxX:1,minY:-1,maxY:1 };
  let minX=all[0].x, maxX=all[0].x, minY=all[0].y, maxY=all[0].y;
  for (const p of all){
    minX = Math.min(minX,p.x); maxX = Math.max(maxX,p.x);
    minY = Math.min(minY,p.y); maxY = Math.max(maxY,p.y);
  }
  return { minX,maxX,minY,maxY };
}

function sampleCurvePointsWorld(ctrl){
  const pts = [];
  for (let u=0; u<=1.000001; u+=0.05) pts.push(bezierPoint(ctrl,u));
  return pts;
}

function autoFitIfNeeded(extraPoints){
  if (!fitHardReset) { fitRequested = false; return; }
  if (!fitRequested && !fitHardReset) return;

  const w = window.innerWidth, h = window.innerHeight;
  const margin = 180; // px (bigger margin => zoom out a bit)
  const bounds = computeBoundsWorld(extraPoints);
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);

  const scaleX = (w - margin*2) / bw;
  const scaleY = (h - margin*2) / bh;
  const targetScale = Math.min(scaleX, scaleY) * 0.92;

  // Smooth approach unless hard reset
  const newScale = fitHardReset ? targetScale : (0.88*view.scale + 0.12*targetScale);
  view.scale = Math.min(6, Math.max(0.2, newScale));

  const cxWorld = (bounds.minX + bounds.maxX)/2;
  const cyWorld = (bounds.minY + bounds.maxY)/2;
  const targetTx = -cxWorld * view.scale;
  const targetTy = -cyWorld * view.scale;

  view.tx = fitHardReset ? targetTx : (0.88*view.tx + 0.12*targetTx);
  view.ty = fitHardReset ? targetTy : (0.88*view.ty + 0.12*targetTy);

  fitRequested = false;
  fitHardReset = false;
}

// ---- Main draw ----
function drawNormal(){
  if (play){
    const next = tParam + 0.0025;
    setT(next > 1 ? 0 : next);
  }

  // Build polar data in world
  const polar = [];
  for (let i=0;i<points.length-1;i++) polar.push(lerp(points[i], points[i+1], tParam));

  // extra points for fit: sample of both curves + polar polygon
  const extra = [
    ...polar,
    ...sampleCurvePointsWorld(points),
    ...(polar.length>1 ? sampleCurvePointsWorld(polar) : [])
  ];
  // auto-centering disabled unless Reset view is pressed
  if (fitHardReset) // auto-centering disabled unless Reset view is pressed
  if (fitHardReset) autoFitIfNeeded(extra);

  // Control polygon
  strokePath(points.map(worldToScreen), 'rgba(199,203,214,0.38)', 2);
  points.forEach(p => drawPointWorld(p, 6, 'rgba(199,203,214,0.92)', 'rgba(255,255,255,0.20)'));

  // Original Bezier
  if (showBezier && showBezier.checked) {
    drawCurveWorld(points, getCss('--blue'), 3, 0.95);
  }

  // Polar polygon
  if (showPolygon && showPolygon.checked && polar.length){
    strokePath(polar.map(worldToScreen), 'rgba(72,226,168,0.40)', 2.5);
    polar.forEach(p => drawPointWorld(p, 5, 'rgba(72,226,168,0.95)', 'rgba(255,255,255,0.16)'));
  }
  // Polar curve
  if (showPolar && showPolar.checked && polar.length>1) drawCurveWorld(polar, getCss('--red'), 3, 0.92);

  // Point B(t)
  const Bt = bezierPoint(points, tParam);
  if (showPoint && showPoint.checked) {
    drawPointWorld(Bt, 7, getCss('--blue'), 'rgba(255,255,255,0.22)');
  }
  // Point on polar curve at the same t
  if (showPoint && showPoint.checked && showPolar && showPolar.checked && polar.length>1){
    const Pt = bezierPoint(polar, tParam);
    drawPointWorld(Pt, 6, getCss('--red'), 'rgba(255,255,255,0.20)');
  }
  
}

function drawBlossom(){
  // enforce cubic
  if (points.length !== 4){
    if (points.length > 4) points = points.slice(0,4);
    while (points.length < 4) points.push({x: -60 + points.length*120, y: 0});
  }

  const b = blossomCubic(points, t1, t2, t3);

  const extra = [
    ...b.level1, ...b.level2, b.level3,
    ...sampleCurvePointsWorld(points),
  ];
  // auto-centering disabled unless Reset view is pressed
  if (fitHardReset) // auto-centering disabled unless Reset view is pressed
  if (fitHardReset) autoFitIfNeeded(extra);

  // Control polygon
  strokePath(points.map(worldToScreen), 'rgba(199,203,214,0.34)', 2.5);

  // Control points and labels
  points.forEach((p,i)=>{
    drawPointWorld(p, 7, getCss('--blue'), 'rgba(255,255,255,0.22)');
    drawLabelWorld('C'+ toSubscript(i) , p, 'rgba(78,161,255,0.95)');
  });

  if (showCurve.checked) drawCurveWorld(points, getCss('--blue'), 3, 0.35);

  // Level 1 (red)
  strokePath(b.level1.map(worldToScreen), 'rgba(255,91,111,0.55)', 2.5);
  b.level1.forEach((p,i)=>{
    drawPointWorld(p, 6, getCss('--red'), 'rgba(255,255,255,0.18)');
    drawLabelWorld('C' + toSubscript(i) + "'", p, 'rgba(255,91,111,0.95)');
  });

  // Level 2 (orange)
  strokePath(b.level2.map(worldToScreen), 'rgba(255,176,32,0.65)', 2.5);
  b.level2.forEach((p,i)=>{
    drawPointWorld(p, 6, getCss('--orange'), 'rgba(255,255,255,0.18)');
    drawLabelWorld('C' + toSubscript(i) + "''", p, 'rgba(255,176,32,0.95)');
  });

  // Level 3 (green) - point C
  drawPointWorld(b.level3, 8, getCss('--green'), 'rgba(255,255,255,0.22)');
  drawLabelWorld('C', b.level3, 'rgba(72,226,168,0.95)');

  // Emphasize stage lines lightly like the slide
  strokePath([worldToScreen(b.level1[0]), worldToScreen(b.level1[1])], 'rgba(255,91,111,0.25)', 2);
  strokePath([worldToScreen(b.level1[1]), worldToScreen(b.level1[2])], 'rgba(255,91,111,0.25)', 2);
  strokePath([worldToScreen(b.level2[0]), worldToScreen(b.level2[1])], 'rgba(255,176,32,0.25)', 2);

  // If t1=t2=t3 => blossom point is on curve at that t (highlight ring)
  if (Math.abs(t1-t2) < 1e-6 && Math.abs(t2-t3) < 1e-6){
    const Bt = bezierPoint(points, t1);
    const s = worldToScreen(Bt);
    ctx.save();
    ctx.strokeStyle = 'rgba(72,226,168,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 14, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function toSubscript(n) {
  const subs = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
  return String(n).split('').map(d => subs[parseInt(d)]).join('');
}

function getCss(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function clear(){
  // subtle vignette overlay effect
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

function frame(){
  clear();
  drawGrid();
  if (mode === 'blossom') drawBlossom();
  else drawNormal();
  requestAnimationFrame(frame);
}

// Start
preset4();
setT(0.3);
requestAutoFit(true);
frame();