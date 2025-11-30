(() => {
// --- State ---
const canvas = document.getElementById('sprite-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const previewCanvas = document.getElementById('preview-canvas');
const pctx = previewCanvas.getContext('2d'); pctx.imageSmoothingEnabled = false;

const widthSelect = document.getElementById('width-select');
const heightSelect = document.getElementById('height-select');
const paletteSelect = document.getElementById('palette-select');
const paletteColorsContainer = document.getElementById('palette-colors');
const paletteSizeInput = document.getElementById('palette-size');

const addFrameBtn = document.getElementById('add-frame');
const duplicateFrameBtn = document.getElementById('duplicate-frame');
const deleteFrameBtn = document.getElementById('delete-frame');
const onionSkinCheckbox = document.getElementById('onion-skin');
const fpsInput = document.getElementById('fps-input');
const playBtn = document.getElementById('play-animation');

const framesList = document.getElementById('frames-list');

const exportNameInput = document.getElementById('export-name');
const exportPngBtn = document.getElementById('export-png');
const exportCHBtn = document.getElementById('export-ch');
const exportSpriteSheetBtn = document.getElementById('export-spritesheet');
const exportAllFramesBtn = document.getElementById('export-all-frames');
const exportAllCHBtn = document.getElementById('export-all-ch');
const exportCHSheetBtn = document.getElementById('export-ch-spritesheet');

const previewBg = document.getElementById('preview-bg');
document.getElementById('preview-preset-1').addEventListener('click', ()=>{ previewCanvas.dataset.bg = '#9BBC0F'; drawGBPreview(); });
document.getElementById('preview-preset-2').addEventListener('click', ()=>{ previewCanvas.dataset.bg = '#202124'; drawGBPreview(); });
document.getElementById('preview-preset-3').addEventListener('click', ()=>{ previewCanvas.dataset.bg = 'checker'; drawGBPreview(); });
previewBg.addEventListener('input', ()=>{ previewCanvas.dataset.bg = previewBg.value; drawGBPreview(); });

// --- NEU: Zoom-Buttons referenzen + Setter ---
const zoom1Btn = document.getElementById('zoom-1x');
const zoom15Btn = document.getElementById('zoom-1-5x');
const zoom2Btn = document.getElementById('zoom-2x');

// === Layers (pro Frame) ===
const layersPerFrame = [];              // framesIndex -> [{grid, visible, name}]
const activeLayerIndexPerFrame = [];    // framesIndex -> number

// Layer UI
const layersList   = document.getElementById('layers-list');
const addLayerBtn  = document.getElementById('add-layer');
const dupLayerBtn  = document.getElementById('dup-layer');
const delLayerBtn  = document.getElementById('del-layer');
const MAX_LAYERS = 8;

// === Undo/Redo ===
const undoStack = [];
const redoStack = [];
let gestureHistoryPushed = false; // pro Maus-Geste nur 1 Snapshot

// Import UI
const importPngInput = document.getElementById('import-png');
const importPngBtn   = document.getElementById('import-png-run');
const importCInput   = document.getElementById('import-c');
const importCBtn     = document.getElementById('import-c-run');


function setPreviewScale(s){
  // 160x144 ist die interne Auflösung
  previewCanvas.style.width = (160 * s) + 'px';
  previewCanvas.style.height = (144 * s) + 'px';
}

if (zoom1Btn && zoom15Btn && zoom2Btn){
  zoom1Btn.addEventListener('click', ()=> setPreviewScale(1));
  zoom15Btn.addEventListener('click', ()=> setPreviewScale(1.5));
  zoom2Btn.addEventListener('click', ()=> setPreviewScale(2));
}

const paletteUpload = document.getElementById('palette-upload');
const applyUploadBtn = document.getElementById('apply-upload');
const MAX_IMAGE_DIM = 128;

let gridWidth = 16, gridHeight = 16;
let cellSize = parseInt(localStorage.getItem('editZoom') || '24', 10);
let frames = [];
let currentFrameIndex = 0;
let mouseDown = false;
let currentTool = 'pencil';
let currentColorIndex = 1; // start with non-zero colour

let currentPalette = ['#808080', '#0F380F', '#306230', '#8BAC0F']; // index0 is "transparent conceptually"
let animationTimer = null;
let isPlaying = false;

// selection/move state
let selectionMask = null; // boolean grid
let selectionBounds = null;
let selecting = false;
let selectStart = null;
let lassoPoints = [];
let movingSelection = false;
let moveStart = null;
let moveDelta = {dx:0, dy:0};

// palettes set
const paletteCategories = [
  { label: 'Game Boy', palettes: [
    { name:'DMG Green', colors:['#0F380F','#306230','#8BAC0F','#9BBC0F'] },
    { name:'DMG Gray',  colors:['#0E0E0E','#555555','#A0A0A0','#E0E0E0'] },
    { name:'Pastel',    colors:['#FDEBB3','#FFCAB1','#FDA5A6','#C381A3'] },
    { name:'Ocean',     colors:['#0B132B','#1C2541','#3A506B','#5BC0BE'] }
  ] },
  { label:'Creative 4-colour', palettes: [
    { name:'Retro Sunset', colors:['#2E294E','#541388','#F1E9DA','#E71D36'] },
    { name:'Forest Walk',  colors:['#1B3A4B','#285238','#7EA16B','#CDE7BE'] },
    { name:'Candy Land',   colors:['#37123C','#A290F4','#F0E6EF','#FF7C7C'] },
    { name:'Cyber Neon',   colors:['#0F0E17','#A7A9BE','#FF8906','#F25F4C'] }
  ] },

  // === NEW: 8-colour (x4) ===
  { label:'8-colour', palettes: [
    { name:'Grayscale 8', colors:[
      '#000000','#202020','#404040','#606060','#808080','#A0A0A0','#C0C0C0','#E0E0E0'
    ]},
    { name:'Ocean 8', colors:[
      '#0B132B','#1C2541','#3A506B','#5BC0BE','#A3E7E4','#1B998B','#2D6A4F','#CAF0F8'
    ]},
    { name:'Sunset 8', colors:[
      '#2D132C','#801336','#C72C41','#EE4540','#FFA07A','#FFD166','#FCA311','#14213D'
    ]},
    { name:'Forest 8', colors:[
      '#0B1D13','#1B4332','#2D6A4F','#40916C','#74C69D','#A3D9B1','#CEE6C1','#F1FAEE'
    ]}
  ]},

  // === NEW: 16-colour (x4) ===
  { label:'16-colour', palettes: [
    { name:'PICO-8 16', colors:[
      '#000000','#1D2B53','#7E2553','#008751','#AB5236','#5F574F','#C2C3C7','#FFF1E8',
      '#FF004D','#FFA300','#FFEC27','#00E436','#29ADFF','#83769C','#FF77A8','#FFCCAA'
    ]},
    { name:'Pastel 16', colors:[
      '#2E3440','#3B4252','#ECEFF4','#E5E9F0','#8FBCBB','#88C0D0','#81A1C1','#B48EAD',
      '#A3BE8C','#EBCB8B','#D08770','#BF616A','#F4D6CC','#FCE5D8','#E7F0FF','#EAF7F0'
    ]},
    { name:'Neon 16', colors:[
      '#000000','#1A1A1A','#39FF14','#00E5FF','#FF2079','#FFEA00','#FF6E00','#7C4DFF',
      '#00FF9D','#FF3D00','#B2FF59','#18FFFF','#F50057','#FFFF00','#76FF03','#FFFFFF'
    ]},
    { name:'Muted 16', colors:[
      '#1B1B1B','#2F3336','#4B4F52','#6C757D','#879099','#A0A7AE','#C0C6CC','#E1E4E8',
      '#5D737E','#6B705C','#A5A58D','#B7B7A4','#CB997E','#DDBEA9','#FFE8D6','#EDF6F9'
    ]}
  ]},

  // === NEW: 32-colour (x2) ===
  { label:'32-colour', palettes: [
    { name:'Full 32A', colors:[
      '#000000','#202020','#404040','#606060','#808080','#A0A0A0','#C0C0C0','#E0E0E0',
      '#13293D','#184E77','#1D7A8C','#52B69A','#76C893','#99D98C','#B5E48C','#D9ED92',
      '#2B2D42','#8D99AE','#EF233C','#D80032','#FFA69E','#FAF3DD','#B8F2E6','#AED9E0',
      '#4E148C','#6F2DBD','#A663CC','#B298DC','#FF499E','#FF85A1','#FFC0BE','#FFEEDD'
    ]},
    { name:'Full 32B', colors:[
      '#0B090A','#161A1D','#660708','#A4161A','#BA181B','#E5383B','#B1A7A6','#F5F3F4',
      '#0A0908','#22333B','#5E503F','#A9927D','#C6AD8F','#EAE0D5','#C9ADA7','#FFE5D9',
      '#001219','#005F73','#0A9396','#94D2BD','#E9D8A6','#EE9B00','#CA6702','#BB3E03',
      '#3A0CA3','#7209B7','#F72585','#B5179E','#560BAD','#480CA8','#4CC9F0','#4361EE'
    ]}
  ]}
];

let paletteMap = new Map();
paletteCategories.forEach(cat => cat.palettes.forEach(p => paletteMap.set(p.name, p)));

// --- helpers ---
function createFrame(w,h){
  const f=[]; for(let y=0;y<h;y++){const r=new Array(w).fill(-1);f.push(r);} return f;
}
function copyFrame(f){ return f.map(row=>row.slice()); }

function initSizeSelectors(){
  const sizes=[8,16,24,32,40,48,56,64,72,80,88,96,104,112,120,128];
  widthSelect.innerHTML=''; heightSelect.innerHTML='';
  sizes.forEach(s=>{
    const o=document.createElement('option'); o.value=s; o.textContent=s; widthSelect.appendChild(o);
  });
  sizes.forEach(s=>{
    const o=document.createElement('option'); o.value=s; o.textContent=s; heightSelect.appendChild(o);
  });
  widthSelect.value=gridWidth; heightSelect.value=gridHeight;
}
function changeGridSize(w,h){
  pushHistory();
  gridWidth = parseInt(w); gridHeight = parseInt(h);

  // alle Layer-Grids je Frame auf neue Größe mappen
  for(let fi=0; fi<layersPerFrame.length; fi++){
    const Ls = layersPerFrame[fi]; if(!Ls) continue;
    for(const L of Ls){
      const old=L.grid;
      const nf=createFrame(gridWidth,gridHeight);
      for(let y=0;y<Math.min(old.length,gridHeight);y++){
        for(let x=0;x<Math.min(old[0].length,gridWidth);x++){
          nf[y][x]=old[y][x];
        }
      }
      L.grid = nf;
    }
    if(frames[fi]) frames[fi] = createFrame(gridWidth,gridHeight); // Platz neu
    composeFrame(fi);
  }

  currentFrameIndex = Math.min(currentFrameIndex, frames.length-1);
  render(); refreshFramesThumbnails(); drawGBPreview(); refreshLayersUI();
}

widthSelect.addEventListener('change',()=>changeGridSize(widthSelect.value,heightSelect.value));
heightSelect.addEventListener('change',()=>changeGridSize(heightSelect.value,widthSelect.value));

function initPaletteSelector(){
  paletteSelect.innerHTML='';
  paletteCategories.forEach(cat=>{
    const og=document.createElement('optgroup'); og.label=cat.label;
    cat.palettes.forEach(p=>{
      const opt=document.createElement('option'); opt.value=p.name; opt.textContent=p.name; og.appendChild(opt);
    });
    paletteSelect.appendChild(og);
  });
  const customOpt=document.createElement('option'); customOpt.value='custom'; customOpt.textContent='Custom Palette';
  paletteSelect.appendChild(customOpt);
  paletteSelect.value='DMG Green';
  setCurrentPalette(paletteMap.get('DMG Green'));
}
paletteSelect.addEventListener('change',()=>{
  if(paletteSelect.value==='custom'){ refreshPaletteColors(); render(); refreshFramesThumbnails(); return; }
  const pal = paletteMap.get(paletteSelect.value); if(!pal) return;
  setCurrentPalette(pal); refreshFramesThumbnails(); render(); drawGBPreview();
});

function setCurrentPalette(p){
  currentPalette = p.colors.slice();
  currentColorIndex = Math.min(currentColorIndex, currentPalette.length-1);
  refreshPaletteColors();
}
paletteSizeInput.addEventListener('change',()=>{
  let want = Math.max(4, Math.min(64, parseInt(paletteSizeInput.value)||4));
  paletteSizeInput.value = want;
  while(currentPalette.length < want) currentPalette.push('#FFFFFF');
  while(currentPalette.length > want) currentPalette.pop();
  refreshPaletteColors(); render(); refreshFramesThumbnails(); drawGBPreview();
});

function refreshPaletteColors(){
  paletteColorsContainer.innerHTML='';
  currentPalette.forEach((color, index)=>{
    const btn=document.createElement('button');
    btn.className='palette-color'+(index===currentColorIndex?' active':'');
    btn.style.backgroundColor=color;
    if(index===0) btn.classList.add('transparent'); // visual red slash
    btn.addEventListener('click',()=>{
      currentColorIndex=index;
      document.querySelectorAll('.palette-color').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
    // allow editing colours
    btn.addEventListener('dblclick',()=>{
      const inp=document.createElement('input'); inp.type='color'; inp.value=color;
      inp.style.position='fixed'; inp.style.left='-9999px'; document.body.appendChild(inp);
      inp.addEventListener('input',()=>{ currentPalette[index]=inp.value; btn.style.backgroundColor=inp.value; render(); refreshFramesThumbnails(); drawGBPreview(); });
      inp.click(); setTimeout(()=>document.body.removeChild(inp),100);
    });
    paletteColorsContainer.appendChild(btn);
  });
}

// --- drawing & canvas ---
function getCanvasOrigin(){
  const startX = Math.floor((canvas.width - gridWidth * cellSize) / 2);
  const startY = Math.floor((canvas.height - gridHeight * cellSize) / 2);
  return {startX, startY};
}
function getGridCoordinates(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const {startX, startY} = getCanvasOrigin();
  const gx = Math.floor((x - startX) / cellSize);
  const gy = Math.floor((y - startY) / cellSize);
  return {x:gx, y:gy};
}

function applyTool(gx, gy){
  if (gx<0||gy<0||gx>=gridWidth||gy>=gridHeight) return;

  // aktive Ebene statt composite Frame
  const layerGrid = getActiveLayerGrid();

  if(currentTool==='pencil'){
    layerGrid[gy][gx] = currentColorIndex;
  } else if(currentTool==='eraser'){
    layerGrid[gy][gx] = -1;
  } else if(currentTool==='fill'){
    floodFill(layerGrid, gx, gy, layerGrid[gy][gx], currentColorIndex);
  } else if(currentTool==='picker'){
    // Picker aus allen sichtbaren Layern = aus dem composited Bild
    const v = frames[currentFrameIndex][gy][gx];
    if(v>=0){ currentColorIndex=v; refreshPaletteColors(); }
  }

  composeFrame(currentFrameIndex);
  render(); refreshFramesThumbnails(); drawGBPreview();
}


function floodFill(frame, x, y, target, replacement){
  if(target===replacement) return;
  const w=gridWidth, h=gridHeight;
  if(target !== frame[y][x]) return;
  const stack=[[x,y]];
  while(stack.length){
    const [cx,cy]=stack.pop();
    if(cx<0||cy<0||cx>=w||cy>=h) continue;
    if(frame[cy][cx]!==target) continue;
    frame[cy][cx]=replacement;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}

// selection
function beginRectSelection(gx,gy){ selecting=true; selectStart={x:gx,y:gy}; selectionBounds={x:gx,y:gy,w:1,h:1}; selectionMask=null; render(); }
function updateRectSelection(gx,gy){
  if(!selecting||!selectStart) return;
  const x0=Math.min(selectStart.x,gx), y0=Math.min(selectStart.y,gy);
  const x1=Math.max(selectStart.x,gx), y1=Math.max(selectStart.y,gy);
  selectionBounds={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}; selectionMask=null; render();
}
function commitRectSelection(){
  selecting=false;
  const mask=[]; for(let y=0;y<gridHeight;y++){const r=new Array(gridWidth).fill(false);mask.push(r);}
  const {x,y,w,h}=selectionBounds; for(let yy=y;yy<y+h;yy++){ for(let xx=x;xx<x+w;xx++) mask[yy][xx]=true; }
  selectionMask=mask; render();
}
function beginLasso(gx,gy){ selecting=true; lassoPoints=[{x:gx,y:gy}]; selectionMask=null; selectionBounds=null; render(); }
function updateLasso(gx,gy){
  if(!selecting) return; const last=lassoPoints[lassoPoints.length-1];
  if(!last || last.x!==gx || last.y!==gy){ lassoPoints.push({x:gx,y:gy}); render(); }
}
function commitLasso(){
  selecting=false;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  lassoPoints.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
  selectionBounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  const mask=[]; for(let y=0;y<gridHeight;y++){const r=new Array(gridWidth).fill(false); mask.push(r);}
  function inside(px,py){
    let c=false; const poly=lassoPoints;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
      const intersect=((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi);
      if(intersect) c=!c;
    }
    return c;
  }
  for(let yy=0;yy<gridHeight;yy++){ for(let xx=0;xx<gridWidth;xx++){ if(inside(xx,yy)) mask[yy][xx]=true; } }
  selectionMask=mask; render();
}
function startMove(gx,gy){ if(!selectionMask) return; movingSelection=true; moveStart={x:gx,y:gy}; moveDelta={dx:0,dy:0}; }
function updateMove(gx,gy){ if(!movingSelection||!moveStart) return; moveDelta={dx:gx-moveStart.x,dy:gy-moveStart.y}; render(); }
function commitMove(){
  if(!movingSelection||!selectionMask) return;
  const src = getActiveLayerGrid();         // <— aktive Ebene
  const copy = copyFrame(src);
  for(let y=0;y<gridHeight;y++){ for(let x=0;x<gridWidth;x++){ if(selectionMask[y][x]) src[y][x]=-1; } }
  for(let y=0;y<gridHeight;y++){ for(let x=0;x<gridWidth;x++){ if(selectionMask[y][x]){
    const nx=x+moveDelta.dx, ny=y+moveDelta.dy;
    if(nx>=0&&ny>=0&&nx<gridWidth&&ny<gridHeight) src[ny][nx]=copy[y][x];
  } } }
  movingSelection=false; moveStart=null; moveDelta={dx:0,dy:0};

  composeFrame(currentFrameIndex);
  render(); refreshFramesThumbnails(); drawGBPreview();
}


// events
canvas.addEventListener('mousedown',(e)=>{
  if (!gestureHistoryPushed){ pushHistory(); gestureHistoryPushed = true; }
  mouseDown=true; const {x,y}=getGridCoordinates(e.clientX,e.clientY);
  if(currentTool==='rect-select') return beginRectSelection(x,y);
  if(currentTool==='lasso-select') return beginLasso(x,y);
  if(currentTool==='move') return startMove(x,y);
  applyTool(x,y);
});
canvas.addEventListener('mousemove',(e)=>{
  const {x,y}=getGridCoordinates(e.clientX,e.clientY); if(!mouseDown) return;
  if(currentTool==='rect-select') return updateRectSelection(x,y);
  if(currentTool==='lasso-select') return updateLasso(x,y);
  if(currentTool==='move') return updateMove(x,y);
  applyTool(x,y);
});
window.addEventListener('mouseup',()=>{
  if(!mouseDown) return; mouseDown=false;
  if(currentTool==='rect-select') return commitRectSelection();
  if(currentTool==='lasso-select') return commitLasso();
  if(currentTool==='move') return commitMove();
  gestureHistoryPushed = false;
});

document.querySelectorAll('#tool-buttons .tool').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#tool-buttons .tool').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); currentTool=btn.dataset.tool;
  });
});

if(addLayerBtn){
  pushHistory();
  addLayerBtn.addEventListener('click', ()=>{
    ensureFrameLayers(currentFrameIndex);
    const layers = layersPerFrame[currentFrameIndex];
    if(layers.length >= MAX_LAYERS) return;
    const nl = { grid:createFrame(gridWidth,gridHeight), visible:true, name:`Layer ${layers.length+1}` };
    layers.push(nl);
    setActiveLayerIndex(layers.length-1);
    composeFrame(currentFrameIndex); refreshLayersUI(); render(); refreshFramesThumbnails(); drawGBPreview();
  });
}
if(dupLayerBtn){
  dupLayerBtn.addEventListener('click', ()=>{
    pushHistory();
    ensureFrameLayers(currentFrameIndex);
    const layers = layersPerFrame[currentFrameIndex];
    if(layers.length >= MAX_LAYERS) return;
    const ai = getActiveLayerIndex();
    const base = layers[ai];
    const dup = { grid: copyFrame(base.grid), visible: base.visible, name: base.name+' copy' };
    layers.splice(ai+1,0,dup);
    setActiveLayerIndex(ai+1);
    composeFrame(currentFrameIndex); refreshLayersUI(); render(); refreshFramesThumbnails(); drawGBPreview();
  });
}
if(delLayerBtn){
  delLayerBtn.addEventListener('click', ()=>{
    pushHistory();
    ensureFrameLayers(currentFrameIndex);
    const layers = layersPerFrame[currentFrameIndex];
    if(layers.length<=1) return;
    const ai = getActiveLayerIndex();
    layers.splice(ai,1);
    setActiveLayerIndex(Math.max(0, ai-1));
    composeFrame(currentFrameIndex); refreshLayersUI(); render(); refreshFramesThumbnails(); drawGBPreview();
  });
}

document.addEventListener('keydown', (e)=>{
  if(!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey){ e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); redo(); }
});


// frames
function refreshFramesThumbnails(){
  framesList.innerHTML='';
  frames.forEach((f, index)=>{
    const li=document.createElement('li'); li.dataset.index=index; li.draggable=true;
    const c=document.createElement('canvas'); c.width=gridWidth; c.height=gridHeight;
    const cctx=c.getContext('2d'); const off=frameToCanvas(f, currentPalette, 1, true); // 1x
    cctx.drawImage(off,0,0);
    li.appendChild(c);
    const cap=document.createElement('div'); cap.textContent = `#${index+1}`; li.appendChild(cap);
    if(index===currentFrameIndex) li.classList.add('active');
    li.addEventListener('click',()=>{ currentFrameIndex=index; refreshFramesThumbnails(); render(); drawGBPreview(); refreshLayersUI();});
    li.addEventListener('dragstart',(ev)=>{ ev.dataTransfer.setData('text/plain', String(index)); });
    li.addEventListener('dragover',(ev)=>{ ev.preventDefault(); li.style.borderColor='#007acc'; });
    li.addEventListener('dragleave',()=>{ li.style.borderColor=''; });
    li.addEventListener('drop',(ev)=>{
      ev.preventDefault();
      const from = parseInt(ev.dataTransfer.getData('text/plain'),10);
      const to = index;
      if(from===to) return;
      const item = frames.splice(from,1)[0];
      frames.splice(to,0,item);
      currentFrameIndex=to; refreshFramesThumbnails(); render(); drawGBPreview();
    });
    framesList.appendChild(li);
  });
}
function addFrame(){
  pushHistory();
  const idx = frames.length;
  frames.push(createFrame(gridWidth,gridHeight));     // Platz im composite-Array
  layersPerFrame[idx] = [{ grid:createFrame(gridWidth,gridHeight), visible:true, name:'Layer 1' }];
  activeLayerIndexPerFrame[idx] = 0;
  currentFrameIndex = idx;
  composeFrame(idx);
  refreshFramesThumbnails(); render(); drawGBPreview(); refreshLayersUI();
}

function duplicateFrame(){
  pushHistory();
  ensureFrameLayers(currentFrameIndex);
  const srcLayers = layersPerFrame[currentFrameIndex].map(L=>({
    grid: copyFrame(L.grid), visible: L.visible, name: L.name
  }));
  layersPerFrame.splice(currentFrameIndex+1, 0, srcLayers);
  activeLayerIndexPerFrame.splice(currentFrameIndex+1, 0, getActiveLayerIndex());
  frames.splice(currentFrameIndex+1, 0, createFrame(gridWidth,gridHeight));
  composeFrame(currentFrameIndex+1);
  currentFrameIndex++;
  refreshFramesThumbnails(); render(); drawGBPreview(); refreshLayersUI();
}

function deleteFrame(){
  pushHistory();
  if(frames.length<=1) return;
  layersPerFrame.splice(currentFrameIndex,1);
  activeLayerIndexPerFrame.splice(currentFrameIndex,1);
  frames.splice(currentFrameIndex,1);
  currentFrameIndex = Math.max(0, currentFrameIndex-1);
  refreshFramesThumbnails(); render(); drawGBPreview(); refreshLayersUI();
}

addFrameBtn.addEventListener('click',addFrame);
duplicateFrameBtn.addEventListener('click',duplicateFrame);
deleteFrameBtn.addEventListener('click',deleteFrame);

// animation
function togglePlay(){
  if(isPlaying){ clearInterval(animationTimer); animationTimer=null; isPlaying=false; playBtn.textContent='Play'; return; }
  const fps=Math.max(1,Math.min(60,parseInt(fpsInput.value)||6));
  animationTimer=setInterval(()=>{
    currentFrameIndex = (currentFrameIndex+1)%frames.length;
    render(); refreshFramesThumbnails(); drawGBPreview();
  }, 1000/fps);
  isPlaying=true; playBtn.textContent='Pause';
}
playBtn.addEventListener('click',togglePlay);
onionSkinCheckbox.addEventListener('change',()=>{ render(); }); // auto refresh

function setCellSize(sz){
  const clamped = Math.max(8, Math.min(64, sz)); // Zoom-Bereich 8..64 px pro Zelle
  if (clamped === cellSize) return;
  cellSize = clamped;
  localStorage.setItem('editZoom', String(cellSize));
  render();
  refreshFramesThumbnails();
  drawGBPreview();
}

document.getElementById('edit-zoom-in')?.addEventListener('click', ()=>{
  setCellSize(cellSize + 4);
});
document.getElementById('edit-zoom-out')?.addEventListener('click', ()=>{
  setCellSize(cellSize - 4);
});

// Ctrl/Cmd + / - zum Zoomen
document.addEventListener('keydown', (e)=>{
  if(!(e.ctrlKey||e.metaKey)) return;
  if(e.key === '+' || e.key === '='){ e.preventDefault(); setCellSize(cellSize+4); }
  if(e.key === '-' ){ e.preventDefault(); setCellSize(cellSize-4); }
});


// render
function frameToCanvas(frame, palette, scale=cellSize, thumb=false){
  const w=frame[0].length, h=frame.length;
  const off=document.createElement('canvas');
  off.width = w*scale; off.height=h*scale;
  const o=off.getContext('2d'); o.imageSmoothingEnabled=false;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const idx=frame[y][x];
      if(idx>=0 && idx<palette.length){
        o.fillStyle = palette[idx];
        o.fillRect(x*scale,y*scale,scale,scale);
      }
    }
  }
  return off;
}

function drawGBPreview(){
  // BG
  let bg = previewCanvas.dataset.bg || (previewBg && previewBg.value) || '#9BBC0F';
  if(bg==='checker'){
    const s=8;
    for(let y=0;y<144;y+=s){
      for(let x=0;x<160;x+=s){
        pctx.fillStyle = ((x+y)/s)%2 ? '#dcdcdc' : '#f2f2f2';
        pctx.fillRect(x,y,s,s);
      }
    }
  } else {
    pctx.fillStyle = bg; pctx.fillRect(0,0,160,144);
  }
  const f = frames[currentFrameIndex]; if(!f) return;
  const off = frameToCanvas(f, currentPalette, 1);
  const w=f[0].length, h=f.length;
  const cx = Math.floor((160-w)/2), cy=Math.floor((144-h)/2);
  pctx.drawImage(off, cx, cy);
}

function render(){
  canvas.width = Math.max(512, gridWidth*cellSize + 80);
  canvas.height= Math.max(512, gridHeight*cellSize + 80);
  const {startX,startY} = getCanvasOrigin();
  // bg
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // onion skin previous frame
  if(onionSkinCheckbox.checked && frames.length>1){
    const prev = frames[(currentFrameIndex-1+frames.length)%frames.length];
    for(let y=0;y<gridHeight;y++){
      for(let x=0;x<gridWidth;x++){
        const idx=prev[y][x]; if(idx>=0 && idx<currentPalette.length){
          ctx.fillStyle=currentPalette[idx]+'80'; // alpha-ish overlay
          ctx.fillRect(startX+x*cellSize,startY+y*cellSize,cellSize,cellSize);
        }
      }
    }
  }
  // current
  const f=frames[currentFrameIndex];
  for(let y=0;y<gridHeight;y++){
    for(let x=0;x<gridWidth;x++){
      const idx=f[y][x];
      if(idx>=0 && idx<currentPalette.length){
        ctx.fillStyle=currentPalette[idx];
        ctx.fillRect(startX+x*cellSize,startY+y*cellSize,cellSize,cellSize);
      }
    }
  }
  // grid
  ctx.strokeStyle='rgba(0,0,0,.08)';
  for(let gx=0;gx<=gridWidth;gx++){
    ctx.beginPath(); ctx.moveTo(startX+gx*cellSize+.5,startY+.5); ctx.lineTo(startX+gx*cellSize+.5,startY+gridHeight*cellSize+.5); ctx.stroke();
  }
  for(let gy=0;gy<=gridHeight;gy++){
    ctx.beginPath(); ctx.moveTo(startX+.5,startY+gy*cellSize+.5); ctx.lineTo(startX+gridWidth*cellSize+.5,startY+gy*cellSize+.5); ctx.stroke();
  }

  // selection bounds
  if(selectionBounds){
    const {x,y,w,h}=selectionBounds;
    ctx.save();
    ctx.strokeStyle='#007acc'; ctx.lineWidth=2;
    ctx.strokeRect(startX+x*cellSize+1,startY+y*cellSize+1,w*cellSize-2,h*cellSize-2);
    ctx.restore();
  }
  // moving preview
  if(movingSelection && selectionMask){
    ctx.save(); ctx.globalAlpha=.6;
    for(let y=0;y<gridHeight;y++){
      for(let x=0;x<gridWidth;x++){
        if(!selectionMask[y][x]) continue;
        const nx=x+moveDelta.dx, ny=y+moveDelta.dy;
        if(nx<0||ny<0||nx>=gridWidth||ny>=gridHeight) continue;
        const idx=f[y][x];
        if(idx>=0 && idx<currentPalette.length){
          ctx.fillStyle=currentPalette[idx];
          ctx.fillRect(startX+nx*cellSize,startY+ny*cellSize,cellSize,cellSize);
        }
      }
    }
    ctx.restore();
  }
}

// image palette upload (GBC quantization + frequency capping)
function quantizeToGBC(r,g,b){
  const rr=(r>>3)&31, gg=(g>>3)&31, bb=(b>>3)&31;
  const ro=(rr<<3)|(rr>>2), go=(gg<<3)|(gg>>2), bo=(bb<<3)|(bb>>2);
  return [ro,go,bo];
}
applyUploadBtn.addEventListener('click', ()=>{
  const file = paletteUpload.files && paletteUpload.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (img.width > MAX_IMAGE_DIM || img.height > MAX_IMAGE_DIM)
    {
    URL.revokeObjectURL(url);
    alert(`Image too big: ${img.width}×${img.height}. Max size is ${MAX_IMAGE_DIM}×${MAX_IMAGE_DIM}.`);
    return;
    }
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0);

    const { data, width, height } = cx.getImageData(0, 0, c.width, c.height);
    const freq = new Map();

    // Quantize → count frequency
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a < 16) continue; // ignore near-transparent
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const [qr, qg, qb] = quantizeToGBC(r, g, b);
        const hex = '#' + [qr, qg, qb].map(v => v.toString(16).padStart(2, '0')).join('');
        freq.set(hex, (freq.get(hex) || 0) + 1);
      }
    }

    // Sort by frequency (desc) and build unique list (uppercased)
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0].toUpperCase());
    const dedup = [];
    for (const h of sorted) if (!dedup.includes(h)) dedup.push(h);

    const keep0 = (currentPalette[0] || '#808080').toUpperCase();

    // Max colors we can actually provide from the image (plus slot 0)
    const maxFromImage = Math.min(64, dedup.length + 1);

    // Immer alle erkannten nehmen (bis 64), palette-size wird ignoriert
    const want = maxFromImage;

    // Build final palette ohne Duplikate; slot 0 bleibt
    const rest = [];
    for (const h of dedup) {
      if (h === keep0) continue;
      rest.push(h);
      if (rest.length >= (want - 1)) break;
    }
    currentPalette = [keep0, ...rest];

    // Reflect actual size wir konnten bauen
    paletteSizeInput.value = currentPalette.length;

    // UI state
    currentColorIndex = Math.min(currentColorIndex, currentPalette.length - 1);
    if (paletteSelect) paletteSelect.value = 'custom';

    refreshPaletteColors();
    render();
    refreshFramesThumbnails();
    drawGBPreview();

    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
});

// exports
function downloadFile(name, blob){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

// PNG current
exportPngBtn.addEventListener('click',()=>{
  const off = frameToCanvas(frames[currentFrameIndex], currentPalette, 1);
  off.toBlob(b=>downloadFile(`${exportNameInput.value||'sprite'}.png`, b));
});

// sprite sheet png
exportSpriteSheetBtn.addEventListener('click',()=>{
  const count=frames.length; if(count===0) return;
  const w=gridWidth, h=gridHeight;
  const off=document.createElement('canvas'); off.width=w*count; off.height=h;
  const o=off.getContext('2d'); o.imageSmoothingEnabled=false;
  frames.forEach((f, i)=>{
    const img=frameToCanvas(f,currentPalette,1); o.drawImage(img, i*w, 0);
  });
  off.toBlob(b=>downloadFile(`${exportNameInput.value||'sprite'}_sheet.png`, b));
});

// all frames as png zip
exportAllFramesBtn.addEventListener('click', async ()=>{
  const zip = new JSZip();
  frames.forEach((f,i)=>{
    const off=frameToCanvas(f,currentPalette,1);
    const dataURL=off.toDataURL('image/png');
    const b64=dataURL.split(',')[1];
    zip.file(`${exportNameInput.value||'sprite'}_${i}.png`, b64, {base64:true});
  });
  const blob = await zip.generateAsync({type:'blob'});
  downloadFile(`${exportNameInput.value||'sprite'}_frames.zip`, blob);
});

// C/H single frame (current)
exportCHBtn.addEventListener('click',()=>{
  const {c,h} = generateCH([frames[currentFrameIndex]], exportNameInput.value||'sprite');
  downloadFile(`${exportNameInput.value||'sprite'}.h`, new Blob([h],{type:'text/plain'}));
  downloadFile(`${exportNameInput.value||'sprite'}.c`, new Blob([c],{type:'text/plain'}));
});

// All C/H frames zip
exportAllCHBtn.addEventListener('click', async ()=>{
  const zip=new JSZip();
  frames.forEach((f,i)=>{
    const name=`${exportNameInput.value||'sprite'}_${i}`;
    const {c,h} = generateCH([f], name);
    zip.file(`${name}.h`, h); zip.file(`${name}.c`, c);
  });
  const blob=await zip.generateAsync({type:'blob'});
  downloadFile(`${exportNameInput.value||'sprite'}_all_ch.zip`, blob);
});

// C/H Spritesheet (combined)
exportCHSheetBtn.addEventListener('click',()=>{
  const name=exportNameInput.value||'sprite';
  const {c,h} = generateCH(frames, name, true);
  downloadFile(`${name}_sheet.h`, new Blob([h],{type:'text/plain'}));
  downloadFile(`${name}_sheet.c`, new Blob([c],{type:'text/plain'}));
});

// tile encode helpers (2bpp, per 8x8 tile). Map arbitrary indices to 0..3 per tile.
function rgbFromHex(hex){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function nearestIndex(color, candidates){
  // naive euclidean
  let best=0, bestd=Infinity;
  for(let i=0;i<candidates.length;i++){
    const [r1,g1,b1]=color, [r2,g2,b2]=candidates[i];
    const d=(r1-r2)*(r1-r2)+(g1-g2)*(g1-g2)+(b1-b2)*(b1-b2);
    if(d<bestd){bestd=d; best=i;}
  }
  return best;
}

function encodeTiles2bpp(frame){
  const tiles=[];
  const tileMaps=[]; // pro Tile 4 Bytes: local[0..3] -> globalPaletteIndex, 255 = transparent/unused

  const H = frame.length;
  const W = frame[0].length;

  for(let ty=0; ty<H; ty+=8){
    for(let tx=0; tx<W; tx+=8){

      // 8x8 Subtile scannen
      const sub=[];           // Werte (global palette idx oder -1) der 8x8-Zellen
      const colorsSet=new Set();
      let hasTrans = false;
      const freq=new Map();   // globale Palette-Index -> Count

      for(let y=0;y<8;y++){
        for(let x=0;x<8;x++){
          const iy=ty+y, ix=tx+x;
          const v = (iy<H && ix<W) ? frame[iy][ix] : -1;
          sub.push(v);
          if(v<0){ hasTrans = true; }
          else {
            colorsSet.add(v);
            freq.set(v, (freq.get(v)||0)+1);
          }
        }
      }

      // Bis zu 4 lokale Indizes verfügbar. Wenn Transparenz existiert,
      // ist local 0 reserviert → max 3 Farben (1..3). Sonst bis zu 4 Farben (0..3).
      let uniq=[...colorsSet];
      const maxColours = hasTrans ? 3 : 4;
      if (uniq.length > maxColours){
        // Top-N nach Häufigkeit
        uniq = [...freq.entries()]
          .sort((a,b)=>b[1]-a[1])
          .slice(0, maxColours)
          .map(e=>e[0]);
      }

      // Local->Global Mapping vorbereiten (255 = transparent/unused)
      const localToGlobal = new Uint8Array([255,255,255,255]);
      if (hasTrans) localToGlobal[0] = 255; // 0 = transparent

      // Global->Local Remap aufbauen
      const remap = new Map();   // global idx -> local idx (0..3)
      let nextLocal = hasTrans ? 1 : 0; // wenn transparent vorhanden, bei 1 starten
      for (const gidx of uniq){
        if (nextLocal>3) break;
        remap.set(gidx, nextLocal);
        localToGlobal[nextLocal] = gidx;
        nextLocal++;
      }

      // Fallback-Zuordnung: unbekannte Farben im Subtile → nächste der gewählten uniq
      const uniqRGB = uniq.map(i=>rgbFromHex(currentPalette[i]||'#000000'));
      function mapNearest(globalIdx){
        if (remap.has(globalIdx)) return remap.get(globalIdx);
        if (uniq.length === 0){
          // kein Kandidat → wenn trans erlaubt, 0; sonst 0 (irgendein Default)
          return hasTrans ? 0 : 0;
        }
        const rgb = rgbFromHex(currentPalette[globalIdx]||'#000000');
        let best=0, bestd=Infinity;
        for(let i=0;i<uniq.length;i++){
          const [r1,g1,b1]=rgb, [r2,g2,b2]=uniqRGB[i];
          const d=(r1-r2)*(r1-r2)+(g1-g2)*(g1-g2)+(b1-b2)*(b1-b2);
          if(d<bestd){ bestd=d; best=i; }
        }
        // uniq[best] hat bereits einen local-Index
        return remap.get(uniq[best]) ?? (hasTrans ? 0 : 0);
      }

      // 2bpp kodieren
      for(let y=0;y<8;y++){
        let b0=0, b1=0;
        for(let x=0;x<8;x++){
          const v=sub[y*8+x];
          let li; // local index 0..3

          if (v<0){
            li = 0; // transparent (wenn hasTrans) oder einfach 0
          } else {
            li = remap.has(v) ? remap.get(v) : mapNearest(v);
          }

          const bit = 7-x;
          b0 |= (li & 1) << bit;
          b1 |= ((li>>1)&1) << bit;
        }
        tiles.push(b0, b1);
      }

      // Mapping sichern
      tileMaps.push(...localToGlobal);
    }
  }

  return { bytes: new Uint8Array(tiles), maps: new Uint8Array(tileMaps) };
}


function generateCH(framesArr, baseName, combine=false){
  // Tiles + Maps sammeln
  const tilesPerFrame=[]; 
  let allBytes=[]; 
  let allMaps=[]; 
  const frameW=[]; 
  const frameH=[];

  framesArr.forEach(f=>{
    const { bytes, maps } = encodeTiles2bpp(f);
    tilesPerFrame.push(bytes.length/16); // 16 bytes per tile
    allBytes = allBytes.concat([...bytes]);
    allMaps  = allMaps.concat([...maps]);
    frameW.push(f[0].length);
    frameH.push(f.length);
  });

  const tileCount = allBytes.length/16;
  const frameCount = framesArr.length;

  // Palette als 0xRRGGBB
  const paletteRGB = currentPalette.map(h => 
    '0x'+(h.startsWith('#') ? h.slice(1) : h).toUpperCase()
  );
  const paletteCount = paletteRGB.length;

  // Header/C-Namen
  const guard = baseName.toUpperCase().replace(/[^A-Z0-9_]/g,'_') + "_H";
  const sym = baseName.toLowerCase().replace(/[^a-z0-9_]/g,'_');

  // --- Header (.h)
  const h = `#ifndef ${guard}
#define ${guard}
#include <gb/gb.h>

#define ${sym.toUpperCase()}_TILE_COUNT ${tileCount}
#define ${sym.toUpperCase()}_FRAME_COUNT ${frameCount}
#define ${sym.toUpperCase()}_PALETTE_COUNT ${paletteCount}

/* Tiles (2bpp), Offsets/Counts pro Frame */
extern const unsigned char ${sym}_tiles[];
extern const unsigned short ${sym}_frame_tile_offset[];
extern const unsigned short ${sym}_frame_tile_count[];

/* Pro-Tile Mapping: local 0..3 -> global palette index; 255 = transparent/unused */
extern const unsigned char ${sym}_tile_map[];

/* Originalgröße der Frames (in Pixeln) */
extern const unsigned short ${sym}_frame_width[];
extern const unsigned short ${sym}_frame_height[];

/* Exportierte Palette als 0xRRGGBB */
extern const unsigned int ${sym}_palette_rgb[];

#endif
`;

  // --- Implementation (.c)
  // helper zum schön formatieren
  const fmt8  = (arr)=>arr.map((v,i)=> (i%16===0?"  ":" ") + "0x"+(v&0xFF).toString(16).padStart(2,'0') + ((i%16===15)?",\n":",")).join('');
  const fmt16 = (arr)=>arr.map((v,i)=> (i%16===0?"  ":" ") + String(v) + ((i%16===15)?",\n":",")).join('');
  const fmt32 = (arr)=>arr.map((v,i)=> (i%8===0?"  ":" ") + v + ((i%8===7)?",\n":",")).join('');

  // Offsets berechnen
  const offsets=[]; let acc=0;
  tilesPerFrame.forEach(tp=>{ offsets.push(acc); acc+=tp; });

  const c = `#include "${combine ? baseName + "_sheet.h" : baseName + ".h"}"

const unsigned char ${sym}_tiles[] = {
${fmt8(allBytes)}
};

const unsigned char ${sym}_tile_map[] = {
${fmt8(allMaps)}
};

const unsigned short ${sym}_frame_tile_offset[] = { ${offsets.join(', ')} };
const unsigned short ${sym}_frame_tile_count[]  = { ${tilesPerFrame.join(', ')} };

const unsigned short ${sym}_frame_width[]  = { ${frameW.join(', ')} };
const unsigned short ${sym}_frame_height[] = { ${frameH.join(', ')} };

const unsigned int ${sym}_palette_rgb[] = {
${fmt32(paletteRGB)}
};
`;

  if(combine){
    return { c, h: h.replace(`${baseName}.h`, `${baseName}_sheet.h`) };
  } else {
    return { c, h };
  }
}


function ensureFrameLayers(i){
  if(!layersPerFrame[i]){
    layersPerFrame[i] = [{ grid: createFrame(gridWidth,gridHeight), visible:true, name:'Layer 1' }];
    activeLayerIndexPerFrame[i] = 0;
  }
}

function getActiveLayerIndex(){
  ensureFrameLayers(currentFrameIndex);
  const ai = activeLayerIndexPerFrame[currentFrameIndex] ?? 0;
  return Math.min(ai, layersPerFrame[currentFrameIndex].length - 1);
}
function setActiveLayerIndex(idx){
  ensureFrameLayers(currentFrameIndex);
  activeLayerIndexPerFrame[currentFrameIndex] = idx;
  refreshLayersUI();
}

function getActiveLayerGrid(){
  ensureFrameLayers(currentFrameIndex);
  return layersPerFrame[currentFrameIndex][getActiveLayerIndex()].grid;
}

function composeFrame(i){
  ensureFrameLayers(i);
  const layers = layersPerFrame[i];
  const out = createFrame(gridWidth, gridHeight); // -1 überall
  for(let l=0; l<layers.length; l++){
    const L = layers[l]; if(!L.visible) continue;
    const g = L.grid;
    for(let y=0;y<gridHeight;y++){
      for(let x=0;x<gridWidth;x++){
        const v = g[y][x];
        if(v>=0){ out[y][x] = v; } // später liegende Layer überschreiben frühere
      }
    }
  }
  frames[i] = out;
}

function refreshLayersUI(){
  ensureFrameLayers(currentFrameIndex);
  const layers = layersPerFrame[currentFrameIndex];
  const active = getActiveLayerIndex();
  layersList.innerHTML = '';

  // Top-most oben anzeigen (UI-Reihenfolge: oben = letztes Array-Element)
  for(let i=layers.length-1; i>=0; i--){
    const L = layers[i];
    const li = document.createElement('li');
    li.className = 'layer-item' + (i===active?' active':'') + (L.visible?'':' dim');
    li.dataset.index = String(i);
    li.draggable = true;

    const handle = document.createElement('span'); handle.textContent = '≡'; handle.className='handle';
    const eye = document.createElement('button'); eye.className='chip'; eye.type='button';
    eye.textContent = L.visible ? '👁' : '🚫';
    const name = document.createElement('span'); name.className='name'; name.textContent = L.name;

    eye.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      pushHistory();
      L.visible = !L.visible;
      composeFrame(currentFrameIndex);
      refreshLayersUI(); render(); refreshFramesThumbnails(); drawGBPreview();
    });

    name.addEventListener('dblclick',(ev)=>{
      ev.stopPropagation();
      const nn = prompt('Layer name:', L.name);
      if(nn && nn.trim()){ pushHistory(); L.name = nn.trim(); refreshLayersUI(); }
    });

    li.addEventListener('click',()=>{
      setActiveLayerIndex(i);
    });

    // Drag&Drop reorder
    li.addEventListener('dragstart',(ev)=>{ ev.dataTransfer.setData('text/plain', String(i)); });
    li.addEventListener('dragover',(ev)=>{ ev.preventDefault(); li.style.borderColor='#007acc'; });
    li.addEventListener('dragleave',()=>{ li.style.borderColor=''; });
    li.addEventListener('drop',(ev)=>{
      ev.preventDefault(); li.style.borderColor=''; pushHistory();
      const from = parseInt(ev.dataTransfer.getData('text/plain'),10);
      const to = parseInt(li.dataset.index,10);
      if(from===to) return;
      const arr = layers;
      const item = arr.splice(from,1)[0];
      const insertAt = to + (from < to ? 0 : 0); // rein an Position 'to'
      arr.splice(insertAt,0,item);
      // aktiven Index neu berechnen
      let ai = getActiveLayerIndex();
      if(from===ai) activeLayerIndexPerFrame[currentFrameIndex] = insertAt;
      else {
        if(from < ai && insertAt >= ai) activeLayerIndexPerFrame[currentFrameIndex] = ai-1;
        if(from > ai && insertAt <= ai) activeLayerIndexPerFrame[currentFrameIndex] = ai+1;
      }
      composeFrame(currentFrameIndex);
      refreshLayersUI(); render(); refreshFramesThumbnails(); drawGBPreview();
    });

    li.append(handle, eye, name);
    layersList.appendChild(li);
  }
}

function deepCloneGrid(g){ return g.map(row => row.slice()); }
function deepCloneLayers(lpf){
  return lpf.map(Ls => Ls ? Ls.map(L => ({
    grid: deepCloneGrid(L.grid),
    visible: L.visible,
    name: L.name
  })) : undefined);
}

function snapshotState(){
  return {
    layersPerFrame: deepCloneLayers(layersPerFrame),
    activeLayerIndexPerFrame: activeLayerIndexPerFrame.slice(),
    currentFrameIndex,
    gridWidth, gridHeight,
    currentPalette: currentPalette.slice()
  };
}

function restoreState(s){
  gridWidth = s.gridWidth; 
  gridHeight = s.gridHeight;
  currentFrameIndex = s.currentFrameIndex;

  // restore layers
  layersPerFrame.length = 0;
  for(let i=0;i<s.layersPerFrame.length;i++){
    const Ls = s.layersPerFrame[i];
    layersPerFrame[i] = Ls ? Ls.map(L => ({
      grid: deepCloneGrid(L.grid),
      visible: L.visible,
      name: L.name
    })) : undefined;
  }
  activeLayerIndexPerFrame.length = 0;
  Array.prototype.push.apply(activeLayerIndexPerFrame, s.activeLayerIndexPerFrame);

  currentPalette = s.currentPalette.slice();

  // rebuild frames from layers
  frames.length = s.layersPerFrame.length;
  for(let i=0;i<frames.length;i++) frames[i] = createFrame(gridWidth, gridHeight);
  for(let i=0;i<frames.length;i++) composeFrame(i);

  // reflect UI
  widthSelect.value = gridWidth;
  heightSelect.value = gridHeight;
  if (paletteSelect) paletteSelect.value = 'custom';
  refreshPaletteColors();
  refreshFramesThumbnails();
  refreshLayersUI();
  render(); 
  drawGBPreview();
}

function pushHistory(){
  undoStack.push( snapshotState() );
  redoStack.length = 0; // neuer Branch killt Redo
}

function undo(){
  if(undoStack.length === 0) return;
  const cur = snapshotState();
  const prev = undoStack.pop();
  redoStack.push(cur);
  restoreState(prev);
}
function redo(){
  if(redoStack.length === 0) return;
  const cur = snapshotState();
  const next = redoStack.pop();
  undoStack.push(cur);
  restoreState(next);
}

// Map Farbe → Palette-Index (slot 0 bleibt "transparent-konzept")
function hexUpper(h){ return h.toUpperCase(); }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }

function colorDistance2([r1,g1,b1],[r2,g2,b2]){
  const dr=r1-r2, dg=g1-g2, db=b1-b2; return dr*dr+dg*dg+db*db;
}
function hexToRGB(hex){
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// Falls neue Farben kommen: bis 64 auffüllen, sonst nearest nehmen
function mapColorToPalette(hex){
  const H = hexUpper(hex);
  // existierend?
  for(let i=0;i<currentPalette.length;i++){
    if(hexUpper(currentPalette[i]) === H) return i;
  }
  // Platz?
  if(currentPalette.length < 64){
    currentPalette.push(H);
    paletteSizeInput.value = currentPalette.length;
    refreshPaletteColors();
    return currentPalette.length - 1;
  }
  // sonst nearest
  let best=1, bestd=Infinity; // ab 1, um slot 0 zu meiden
  const [r,g,b]=hexToRGB(H);
  for(let i=1;i<currentPalette.length;i++){
    const d = colorDistance2([r,g,b], hexToRGB(currentPalette[i]));
    if(d<bestd){ bestd=d; best=i; }
  }
  return best;
}

if (importPngBtn) {
  importPngBtn.addEventListener('click', ()=>{
    const file = importPngInput && importPngInput.files && importPngInput.files[0];
    if(!file) return;
    pushHistory();

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      if (img.width > MAX_IMAGE_DIM || img.height > MAX_IMAGE_DIM)
      {
      URL.revokeObjectURL(url);
      alert(`Image too big: ${img.width}×${img.height}. Max size is ${MAX_IMAGE_DIM}×${MAX_IMAGE_DIM}.`);
      return;
      }
      const c=document.createElement('canvas');
      c.width=img.width; c.height=img.height;
      const cx=c.getContext('2d'); cx.imageSmoothingEnabled=false;
      cx.drawImage(img,0,0);
      const {data, width:W, height:H} = cx.getImageData(0,0,c.width,c.height);

      let framesW = gridWidth, framesH = gridHeight;
      let count = 1, layout = 'single';

      if (H === gridHeight && W % gridWidth === 0) {
        count = W / gridWidth; layout = 'h';
      } else if (W === gridWidth && H % gridHeight === 0) {
        count = H / gridHeight; layout = 'v';
      } else {
        // Bild passt nicht auf aktuelles Grid → Grid auf Bildgröße setzen
        changeGridSize(W, H);
        framesW = gridWidth; framesH = gridHeight;
      }

      // Palette künftig „custom“
      if (paletteSelect) paletteSelect.value = 'custom';

      function readFrameToGrid(offsetX, offsetY){
        const g = createFrame(framesW, framesH);
        for(let y=0;y<framesH;y++){
          for(let x=0;x<framesW;x++){
            const ix = ((offsetY + y) * W + (offsetX + x)) * 4;
            const a = data[ix+3];
            if(a < 16){ g[y][x] = -1; continue; } // transparent
            const hex = rgbToHex(data[ix], data[ix+1], data[ix+2]);
            const idx = mapColorToPalette(hex);
            g[y][x] = idx;
          }
        }
        return g;
      }

      if (layout === 'h'){
        for(let i=0;i<count;i++){
          const g = readFrameToGrid(i*framesW, 0);
          // neuen Frame + Layer anlegen und Grid einsetzen
          addFrame(); // erzeugt 1 Layer & composited
          ensureFrameLayers(currentFrameIndex);
          layersPerFrame[currentFrameIndex][getActiveLayerIndex()].grid = g;
          composeFrame(currentFrameIndex);
        }
      } else if (layout === 'v'){
        for(let i=0;i<count;i++){
          const g = readFrameToGrid(0, i*framesH);
          addFrame();
          ensureFrameLayers(currentFrameIndex);
          layersPerFrame[currentFrameIndex][getActiveLayerIndex()].grid = g;
          composeFrame(currentFrameIndex);
        }
      } else {
        const g = readFrameToGrid(0,0);
        // aktuellen Frame überschreiben? → wir hängen als neuen an, ist am sichersten
        addFrame();
        ensureFrameLayers(currentFrameIndex);
        layersPerFrame[currentFrameIndex][getActiveLayerIndex()].grid = g;
        composeFrame(currentFrameIndex);
      }

      refreshFramesThumbnails(); refreshLayersUI(); render(); drawGBPreview();
      URL.revokeObjectURL(url);
    };
    img.onerror = ()=> URL.revokeObjectURL(url);
    img.src = url;
  });
}

function parseNumList(src){
  return src
    .split(/[,{}\s]+/).filter(Boolean)
    .map(t => t.startsWith('0x') || t.startsWith('0X') ? parseInt(t,16) : parseInt(t,10))
    .filter(n => Number.isFinite(n));
}

function guessWHFromTiles(tileCount, preferW=gridWidth, preferH=gridHeight){
  // 1) check current grid fits
  const tilesAcross = Math.ceil(preferW/8), tilesDown = Math.ceil(preferH/8);
  if (tilesAcross*tilesDown === tileCount) return [preferW, preferH];

  // 2) try square
  const s = Math.round(Math.sqrt(tileCount));
  if (s*s === tileCount) return [s*8, s*8];

  // 3) fallback prompt
  const ans = prompt(`.c import: Konnte Größe nicht eindeutig bestimmen (Tiles/Frame=${tileCount}). Bitte Breite,Höhe (Vielfache von 8) eingeben:`, `${preferW},${preferH}`);
  if(ans){
    const [w,h] = ans.split(/[,xX ]+/).map(Number);
    if (w%8===0 && h%8===0 && w>0 && h>0) return [w,h];
  }
  // worst-case: nimm current grid
  return [preferW, preferH];
}

function decode2bppFrame(bytes, tileOffset, tilesCount, W, H, tileMap){ // tileMap optional
  const tilesAcross = Math.ceil(W/8), tilesDown = Math.ceil(H/8);
  const g = createFrame(W,H);
  const maxTiles = tilesAcross * tilesDown;
  const useTiles = Math.min(tilesCount, maxTiles);

  for (let t = 0; t < useTiles; t++){
    const globalTileIndex = tileOffset + t;
    const base = globalTileIndex * 16;              // 16 Bytes pro Tile
    const map = tileMap ? tileMap.slice(globalTileIndex*4, globalTileIndex*4 + 4) : null;

    const tx = t % tilesAcross;
    const ty = Math.floor(t / tilesAcross);

    for (let row = 0; row < 8; row++){
      const b0 = bytes[base + row*2]   ?? 0;
      const b1 = bytes[base + row*2+1] ?? 0;
      for (let bit = 7; bit >= 0; bit--){
        const li = ((b1>>bit)&1)<<1 | ((b0>>bit)&1);   // local index 0..3
        const x = 7 - bit;
        const gx = tx*8 + x, gy = ty*8 + row;
        if (gx>=W || gy>=H) continue;

        if (map){
          const gi = map[li];               // 0..63 oder 255
          g[gy][gx] = (gi === 255 ? -1 : gi);
        } else {
          // Legacy-Import (ohne tile_map): 0 → transparent, 1..3 → direkte Indizes
          g[gy][gx] = (li === 0 ? -1 : li);
        }
      }
    }
  }
  return g;
}

if (importCBtn){
  importCBtn.addEventListener('click', ()=>{
    const file = importCInput && importCInput.files && importCInput.files[0];
    if(!file) return;
    pushHistory();

    const reader = new FileReader();
    reader.onload = ()=>{
      const text = String(reader.result);

      // Pflichtfelder (alt & neu)
      const mTiles = text.match(/const\s+unsigned\s+char\s+\w+_tiles\[\]\s*=\s*\{([\s\S]*?)\};/);
      const mOffs  = text.match(/const\s+unsigned\s+short\s+\w+_frame_tile_offset\[\]\s*=\s*\{([\s\S]*?)\};/);
      const mCnts  = text.match(/const\s+unsigned\s+short\s+\w+_frame_tile_count\[\]\s*=\s*\{([\s\S]*?)\};/);
      if(!mTiles || !mOffs || !mCnts){ alert('Konnte Arrays in .c nicht finden.'); return; }

      const tilesBytes = new Uint8Array( parseNumList(mTiles[1]) );
      const offs = parseNumList(mOffs[1]);
      const cnts = parseNumList(mCnts[1]);

      // NEU: optionale Meta-Arrays
      const mMap  = text.match(/const\s+unsigned\s+char\s+\w+_tile_map\[\]\s*=\s*\{([\s\S]*?)\};/);
      const mW    = text.match(/const\s+unsigned\s+short\s+\w+_frame_width\[\]\s*=\s*\{([\\s\S]*?)\};/);
      const mH    = text.match(/const\s+unsigned\s+short\s+\w+_frame_height\[\]\s*=\s*\{([\\s\S]*?)\};/);
      const mPal  = text.match(/const\s+unsigned\s+int\s+\w+_palette_rgb\[\]\s*=\s*\{([\s\S]*?)\};/);

      const tileMap = mMap ? new Uint8Array(parseNumList(mMap[1]).map(n=>n&0xFF)) : null;
      const widths  = mW ? parseNumList(mW[1]) : null;
      const heights = mH ? parseNumList(mH[1]) : null;
      const palInts = mPal ? parseNumList(mPal[1]) : null;

      // Palette setzen (neu) oder sicherstellen (alt)
      if (palInts && palInts.length){
        currentPalette = palInts.slice(0,64).map(v=>{
          const hex = (v>>>0).toString(16).padStart(6,'0').toUpperCase();
          return '#'+hex;
        });
        if (paletteSelect) paletteSelect.value='custom';
        paletteSizeInput.value = currentPalette.length;
        refreshPaletteColors();
      } else {
        ensurePaletteLen(4); // Legacy braucht mind. 4 Slots
        if (paletteSelect) paletteSelect.value='custom';
        refreshPaletteColors();
      }

      // Falls tile_map vorhanden ist, Palette ggf. verlängern (Indices in Map sind global)
      if (tileMap){
        let maxIdx = -1;
        for (let v of tileMap){ if (v !== 255 && v > maxIdx) maxIdx = v; }
        if (maxIdx >= 0){ ensurePaletteLen(maxIdx+1); paletteSizeInput.value=currentPalette.length; refreshPaletteColors(); }
      }

      for(let fi=0; fi<cnts.length; fi++){
        const tileOffset = offs[fi] ?? 0;
        const tileCount  = cnts[fi] ?? 0;

        // Größe je Frame: bevorzugt Meta, sonst heuristisch
        let W = gridWidth, H = gridHeight;
        if (widths && heights && Number.isFinite(widths[fi]) && Number.isFinite(heights[fi])){
          W = widths[fi]; H = heights[fi];
        } else {
          [W,H] = guessWHFromTiles(tileCount, gridWidth, gridHeight);
        }
        if (W !== gridWidth || H !== gridHeight) changeGridSize(W,H);

        const g = decode2bppFrame(tilesBytes, tileOffset, tileCount, W, H, tileMap);

        addFrame();
        ensureFrameLayers(currentFrameIndex);
        layersPerFrame[currentFrameIndex][getActiveLayerIndex()].grid = g;
        composeFrame(currentFrameIndex);
      }

      refreshFramesThumbnails(); refreshLayersUI(); render(); drawGBPreview();
    };
    reader.readAsText(file);
  });
}

function ensurePaletteLen(n){
  while(currentPalette.length < n) currentPalette.push('#FFFFFF');
}

// init
function init(){
  initSizeSelectors();
  initPaletteSelector();
// frames.push(createFrame(gridWidth,gridHeight));
// refreshFramesThumbnails();
  addFrame(); // legt 1 Layer an, composite wird gebaut
  pushHistory();
  render(); drawGBPreview();
  // NEU: initialer Zoom
  setPreviewScale(1);
}

// === Theme toggle ===
(function(){
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // load saved theme
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    btn.textContent = '☀️ Light';
  }

  btn.addEventListener('click', ()=>{
    const dark = document.body.classList.toggle('dark-mode');
    if (dark) {
      btn.textContent = '☀️ Light';
      localStorage.setItem('theme','dark');
    } else {
      btn.textContent = '🌙 Dark';
      localStorage.setItem('theme','light');
    }
  });
})();

init();
})();
