import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const LAPS_TO_WIN = 3;
const RACE_TOP_SPEED = 67; // 241 km/h normal cap for every car and AI racer

function detectDeviceProfile() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const isMobile = coarsePointer || innerWidth <= 900;
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 4);
  const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (isMac && navigator.maxTouchPoints > 1);
  const constrainedMac = isMac && !isIOS && ((memory > 0 && memory <= 8) || cores <= 8);
  const lowEndMobile = isMobile && ((memory > 0 && memory <= 4) || cores <= 4);
  const performanceMode = forced === 'performance' || (forced !== 'high' && (isMobile || constrainedMac));
  const maxRenderScale = isMobile ? (lowEndMobile ? 0.7 : 0.8) : (performanceMode ? 0.9 : 1.45);
  const minRenderScale = isMobile ? (lowEndMobile ? 0.5 : 0.58) : (performanceMode ? 0.68 : 1);
  return {
    isMobile,
    isIOS,
    lowEndMobile,
    performanceMode,
    memory,
    cores,
    targetFps: isMobile ? (lowEndMobile ? 34 : 40) : (performanceMode ? 45 : 60),
    menuFps: isMobile ? 20 : (performanceMode ? 24 : 60),
    maxRenderScale,
    minRenderScale
  };
}

const DEVICE_PROFILE = detectDeviceProfile();

const VEHICLES = [
  {
    id: 'vortex', name: 'Vortex GT', class: 'Supercar', description: 'Planted aero, strong acceleration and a wide controllable drift window.',
    color: 0xff4e1f, accent: 0x111318, topSpeed: RACE_TOP_SPEED, acceleration: 25, grip: 8.4, turn: 1.72, boostPower: 35,
    stats: { speed: 92, grip: 80, drift: 82 }, style: 'sport'
  },
  {
    id: 'apex', name: 'Apex R', class: 'Rally', description: 'Quick rotation, strong off-road recovery and easy powerslides.',
    color: 0x2f87ff, accent: 0xe9eef5, topSpeed: RACE_TOP_SPEED, acceleration: 28, grip: 7.4, turn: 1.92, boostPower: 32,
    stats: { speed: 92, grip: 88, drift: 94 }, style: 'rally'
  },
  {
    id: 'monarch', name: 'Monarch X1', class: 'Formula', description: 'Explosive acceleration and razor grip, but punishes rough terrain.',
    color: 0xf2e72c, accent: 0x181a1e, topSpeed: RACE_TOP_SPEED, acceleration: 31, grip: 9.5, turn: 1.86, boostPower: 34,
    stats: { speed: 92, grip: 97, drift: 70 }, style: 'formula'
  }
];

const TRACKS = [
  {
    id: 'alpine', name: 'Alpine Ascent', subtitle: 'Summit Switchbacks', badge: 'MOUNTAIN GP', difficulty: 'HARD',
    description: 'A climbing mountain road course with a long opening sector, broad switchbacks, summit sweepers and a fast downhill return.',
    theme: 'alpine', roadWidth: 15.8, scaleXZ: 1.48, flowCount: 82, smoothingPasses: 3, smoothingRadius: 4,
    points: [
      [-20, 2, -110], [25, 2.5, -112], [70, 5, -100], [92, 10, -72], [68, 16, -48], [20, 22, -60],
      [48, 28, -28], [82, 35, 5], [60, 43, 38], [15, 50, 52], [-20, 46, 31], [-5, 39, 5],
      [-48, 32, 8], [-80, 25, 38], [-112, 18, 14], [-112, 12, -28], [-88, 7, -62], [-55, 3, -88]
    ]
  },
  {
    id: 'redwood', name: 'Redwood Circuit', subtitle: 'Forest Technical', badge: 'FOREST GP', difficulty: 'MEDIUM',
    description: 'A technical woodland course with linked esses, a broad carousel, changing-radius sweepers and one committed back straight.',
    theme: 'forest', roadWidth: 16.2, scaleXZ: 1.46, flowCount: 88, smoothingPasses: 3, smoothingRadius: 4,
    points: [
      [-20, 2, -105], [30, 2.2, -105], [72, 3.5, -88], [94, 5, -55], [70, 6.5, -30], [30, 5.2, -42],
      [12, 4, -12], [55, 5.2, 4], [92, 6, 30], [82, 5, 65], [45, 4, 88], [5, 3, 78],
      [-15, 4.5, 48], [18, 6.5, 28], [-14, 5, 4], [-55, 3.5, 22], [-96, 4.5, 5], [-107, 6, -35],
      [-80, 4, -70], [-50, 2.5, -93]
    ]
  },
  {
    id: 'coast', name: 'Azure Coast', subtitle: 'Cliff Grand Prix', badge: 'COAST GP', difficulty: 'FAST',
    description: 'A flowing cliffside course with a separate inland loop, long acceleration zones and a technical harbor sequence.',
    theme: 'coast', roadWidth: 17.2, scaleXZ: 1.48, flowCount: 90, smoothingPasses: 3, smoothingRadius: 4,
    points: [
      [-25, 7, -112], [30, 7.5, -108], [78, 9, -90], [108, 13, -55], [100, 17, -10], [72, 14, 12],
      [38, 11, -2], [15, 13, 25], [45, 17, 48], [82, 20, 62], [72, 18, 95], [28, 15, 110],
      [-10, 13, 90], [-35, 11, 55], [-70, 14, 72], [-108, 18, 48], [-118, 15, 5], [-98, 12, -35],
      [-65, 9, -62], [-45, 7.5, -92]
    ]
  },
  {
    id: 'grand-valley', name: 'Grand Valley GP', subtitle: 'European Road Course', badge: '6.1 KM', difficulty: 'TECHNICAL',
    description: 'A true Grand Prix layout: long straights, a fast first sector, an infield switchback complex and a sweeping final run.',
    theme: 'highland', roadWidth: 17.8, scaleXZ: 1.42, flowCount: 112, smoothingPasses: 1, smoothingRadius: 2,
    points: [
      [-45,8,-170],[25,8,-171],[95,9,-163],[150,11,-142],[184,14,-105],[188,16,-60],[165,17,-25],[120,18,-8],
      [72,18,-18],[45,17,-54],[2,16,-48],[-35,16,-20],[-22,18,22],[18,19,48],[70,20,50],[118,22,70],
      [150,24,105],[145,25,142],[108,23,168],[55,20,178],[5,18,166],[-28,16,138],[-62,14,108],[-108,13,122],
      [-155,11,104],[-185,10,72],[-194,9,28],[-176,9,-8],[-132,10,-22],[-88,10,-48],[-112,9,-82],[-165,8,-101],
      [-190,8,-135],[-145,8,-163],[-92,8,-172]
    ]
  },
  {
    id: 'sirocco', name: 'Sirocco International', subtitle: 'Desert Endurance', badge: '6.8 KM', difficulty: 'FAST',
    description: 'A long desert circuit with two major straights, a stadium section, broad hairpins and a high-speed final sector.',
    theme: 'desert', roadWidth: 18.2, scaleXZ: 1.38, flowCount: 116, smoothingPasses: 1, smoothingRadius: 2,
    points: [
      [-82,3,-170],[-15,3,-172],[58,3,-170],[128,4,-158],[184,5,-132],[212,6,-92],[210,7,-48],[184,7,-18],
      [136,7,-2],[88,7,-12],[58,7,-47],[15,7,-44],[-18,7,-12],[-4,8,25],[40,8,50],[98,9,55],
      [154,10,75],[194,11,110],[194,12,148],[160,11,178],[102,10,190],[38,9,184],[-20,8,166],[-72,7,132],
      [-116,7,148],[-170,6,142],[-210,5,112],[-230,4,70],[-226,4,20],[-196,4,-18],[-148,4,-28],[-105,4,-12],
      [-70,4,-42],[-96,4,-78],[-150,4,-83],[-202,4,-105],[-220,3,-140],[-180,3,-166],[-132,3,-174]
    ]
  },
  {
    id: 'harbor', name: 'Midnight Harbor', subtitle: 'City Street Circuit', badge: '5.7 KM', difficulty: 'TECHNICAL',
    description: 'An illuminated street course through docks and warehouse districts, mixing long waterfront blasts with a tight civic infield.',
    theme: 'harbor', roadWidth: 17.4, scaleXZ: 1.44, flowCount: 110, smoothingPasses: 1, smoothingRadius: 2,
    points: [
      [-42,5,-166],[28,5,-168],[98,5,-160],[148,5,-140],[178,6,-102],[180,6,-60],[158,6,-28],[112,6,-12],
      [64,6,-24],[30,6,-2],[45,6,32],[96,6,42],[148,6,60],[174,6,94],[164,6,132],[126,6,158],
      [76,6,164],[32,6,145],[5,6,106],[-30,6,102],[-72,6,130],[-120,6,142],[-164,6,124],[-190,6,88],
      [-188,6,48],[-160,6,18],[-118,6,12],[-90,6,-18],[-118,6,-52],[-166,6,-62],[-198,6,-92],[-196,5,-130],
      [-158,5,-158],[-104,5,-168]
    ]
  },
  {
    id: 'blackridge', name: 'Blackridge Ring', subtitle: 'Canyon Road Course', badge: '7.0 KM', difficulty: 'HARD',
    description: 'A huge canyon circuit with elevation crests, a downhill esses sector, a long ridge straight and a technical basin loop.',
    theme: 'canyon', roadWidth: 17.8, scaleXZ: 1.42, flowCount: 120, smoothingPasses: 1, smoothingRadius: 2,
    points: [
      [-55,12,-180],[20,12,-182],[92,14,-172],[150,18,-148],[190,24,-110],[204,30,-64],[188,35,-24],[148,38,2],
      [92,35,5],[52,31,-20],[12,28,-8],[-8,25,28],[28,23,58],[84,22,68],[138,20,94],[164,18,132],
      [146,16,172],[98,15,198],[42,14,204],[-10,13,186],[-42,12,150],[-80,10,138],[-126,9,158],[-172,10,150],
      [-210,12,118],[-224,16,74],[-210,20,28],[-170,22,2],[-124,21,10],[-88,19,-16],[-104,17,-52],[-152,15,-68],
      [-202,13,-96],[-222,12,-136],[-188,11,-170],[-132,11,-184]
    ]
  },
  {
    id: 'spa', name: 'Spa-Francorchamps', subtitle: 'Ardennes Grand Prix', badge: '7.0 KM · 19 TURNS', difficulty: 'LEGENDARY',
    description: 'A Spa-inspired forest road course with a plunging opening sector, the Eau Rouge–Raidillon climb, a long Kemmel-style straight, fast sweepers and a final chicane.',
    theme: 'spa', roadWidth: 18.8, scaleXZ: 1.25, flowCount: 180, smoothingPasses: 1, smoothingRadius: 2,
    points: [
      [-314.1,28,202.5],[-292.5,24,162],[-270,18,108],[-244.8,13,54],[-223.2,12,25.2],[-200.7,18,4.5],[-175.5,25,-11.7],[-139.5,37,-36],
      [-94.5,49,-64.8],[-36,56,-99],[27,59,-135],[90,61,-171],[144,62,-202.5],[162,62,-211.5],[180,61,-189],[198,60,-181.8],
      [220.5,60,-202.5],[243,60,-208.8],[263.7,58,-190.8],[288,55,-166.5],[310.5,52,-139.5],[315,49,-117],[304.2,47,-104.4],[288,46,-103.5],
      [270,44,-121.5],[252,42,-144],[229.5,40,-160.2],[207,38,-153],[180,36,-139.5],[148.5,34,-121.5],[117,32,-103.5],[94.5,30,-81],
      [82.8,28,-55.8],[85.5,27,-31.5],[99,26,-9],[126,25,2.7],[162,24,8.1],[202.5,23,13.5],[227.7,22,27],[243,21,49.5],
      [244.8,20,72],[238.5,19,91.8],[256.5,19,100.8],[288,18,105.3],[319.5,18,112.5],[331.2,17,130.5],[324,17,157.5],[310.5,18,184.5],
      [288,19,202.5],[256.5,20,211.5],[225,21,207],[189,22,190.8],[153,23,171],[117,24,148.5],[81,25,121.5],[45,26,90],
      [18,27,63],[0,28,45],[-19.8,29,37.8],[-40.5,30,43.2],[-63,31,56.7],[-85.5,31,67.5],[-108,31,72],[-135,31,76.5],
      [-155.7,30,72],[-169.2,30,81],[-162,29,97.2],[-175.5,29,112.5],[-193.5,29,121.5],[-207,28,135],[-229.5,28,148.5],[-256.5,28,163.8],
      [-283.5,28,180],[-306,28,198]
    ]
  }
];

const AI_NAMES = ['NOVA','BLAZE','KIRA','MASON','ORION','VEGA','RICO','SABLE','JUNO','AXEL','LYNX'];

const DIFFICULTIES = {
  easy: { id:'easy', name:'Easy', description:'Same top speed, earlier braking and more forgiving corner exits.', cornering:.88, aggression:.72, curvePenalty:3.05, maxSlowdown:.44, acceleration:21.5, braking:31 },
  medium: { id:'medium', name:'Medium', description:'Same top speed, stronger exits and later braking.', cornering:.95, aggression:.86, curvePenalty:2.68, maxSlowdown:.38, acceleration:24, braking:35 },
  hard: { id:'hard', name:'Hard', description:'Same top speed, committed corner pace and aggressive recovery.', cornering:1, aggression:1, curvePenalty:2.35, maxSlowdown:.32, acceleration:26.5, braking:39 }
};

const RIM_STYLES = [
  {id:'five',name:'Forged Five',spokes:5,kind:'spoke'},
  {id:'mesh',name:'Track Mesh',spokes:10,kind:'mesh'},
  {id:'turbine',name:'Turbine RS',spokes:7,kind:'turbine'},
  {id:'classic',name:'Classic Split',spokes:6,kind:'split'}
];

const COLOR_PRESETS = [
  {name:'Inferno',body:'#ff4e1f',trim:'#111318',wheel:'#c4c9cf'},
  {name:'Midnight',body:'#131a26',trim:'#d7dde4',wheel:'#535b66'},
  {name:'Velocity',body:'#1976ff',trim:'#eef4ff',wheel:'#b9c8da'},
  {name:'Volt',body:'#d9ef27',trim:'#151719',wheel:'#24272c'},
  {name:'Royal',body:'#6837d8',trim:'#efddff',wheel:'#c1b5d8'},
  {name:'Pearl',body:'#e7e3da',trim:'#262a30',wheel:'#9fa8b2'}
];

const AI_LIVERIES = [
  ['#f02d3a','#16191f','#b8bec7'],['#1f7cff','#eef5ff','#242b34'],['#f6c62d','#181b21','#777f89'],
  ['#7a45df','#f1e8ff','#bfc3ca'],['#24b884','#0e1e1a','#d1d8d5'],['#e95d9f','#25131d','#c8b9c1'],
  ['#e8e3d9','#2d3138','#727984'],['#ff7b22','#1a1d22','#d4d7db'],['#4ac7df','#102127','#abbac0'],
  ['#9bcf31','#17200e','#22282e'],['#b8212c','#f2e5d5','#a8afb7']
];

class RNG {
  constructor(seed = 918273) { this.seed = seed >>> 0; }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
}

function makeCanvasTexture(size, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = DEVICE_PROFILE.performanceMode ? 2 : 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTextures() {
  const rng = new RNG(3184);
  const asphalt = makeCanvasTexture(512, (ctx, s) => {
    // High-contrast procedural aggregate, repairs and cracks remain readable at racing speed.
    ctx.fillStyle = '#4b4e51'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 21000; i++) {
      const v = Math.floor(rng.range(22, 132));
      ctx.fillStyle = `rgba(${v},${v},${v},${rng.range(.12,.42)})`;
      const r = rng.range(.45, 2.35);
      ctx.fillRect(rng.range(0,s), rng.range(0,s), r, r);
    }
    for (let i = 0; i < 28; i++) {
      const x=rng.range(-60,s), y=rng.range(-40,s), w=rng.range(35,145), h=rng.range(18,72);
      ctx.fillStyle=`rgba(22,24,26,${rng.range(.07,.18)})`;
      ctx.fillRect(x,y,w,h);
      ctx.strokeStyle=`rgba(125,128,130,${rng.range(.08,.2)})`;
      ctx.lineWidth=rng.range(1,3);ctx.strokeRect(x,y,w,h);
    }
    ctx.lineCap = 'round';
    for (let i=0;i<34;i++) {
      let x=rng.range(0,s),y=rng.range(0,s);
      ctx.beginPath();ctx.moveTo(x,y);
      for(let j=0;j<rng.range(2,6);j++){x+=rng.range(-28,28);y+=rng.range(14,48);ctx.lineTo(x,y);}
      ctx.strokeStyle=`rgba(9,10,11,${rng.range(.2,.48)})`;ctx.lineWidth=rng.range(.8,2.2);ctx.stroke();
    }
    // Subtle longitudinal rubbering gives the surface an obvious direction of travel.
    const wear=ctx.createLinearGradient(0,0,s,0);
    wear.addColorStop(0,'rgba(15,16,17,.02)');wear.addColorStop(.24,'rgba(10,11,12,.18)');
    wear.addColorStop(.43,'rgba(10,11,12,.04)');wear.addColorStop(.57,'rgba(10,11,12,.04)');
    wear.addColorStop(.76,'rgba(10,11,12,.18)');wear.addColorStop(1,'rgba(15,16,17,.02)');
    ctx.fillStyle=wear;ctx.fillRect(0,0,s,s);
  }, 1.5, 1);

  const gravel = makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#625b50'; ctx.fillRect(0,0,s,s);
    for (let i=0;i<3200;i++) { const c=Math.floor(rng.range(65,150)); ctx.fillStyle=`rgb(${c},${Math.floor(c*.92)},${Math.floor(c*.8)})`; const r=rng.range(.5,2.6); ctx.beginPath(); ctx.arc(rng.range(0,s),rng.range(0,s),r,0,TAU);ctx.fill(); }
  }, 3, 1);

  const grass = makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#334527'; ctx.fillRect(0,0,s,s);
    for (let i=0;i<5500;i++) { const g=Math.floor(rng.range(45,105)); ctx.strokeStyle=`rgba(${Math.floor(g*.55)},${g},${Math.floor(g*.35)},.45)`; const x=rng.range(0,s),y=rng.range(0,s);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rng.range(-1,1),y-rng.range(1,4));ctx.stroke(); }
  }, 18, 18);

  const sand = makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle='#9c8661';ctx.fillRect(0,0,s,s);
    for(let i=0;i<5000;i++){const c=Math.floor(rng.range(125,195));ctx.fillStyle=`rgba(${c},${Math.floor(c*.9)},${Math.floor(c*.68)},.38)`;ctx.fillRect(rng.range(0,s),rng.range(0,s),rng.range(.3,1.6),rng.range(.3,1.6));}
  }, 20, 20);

  const rock = makeCanvasTexture(256, (ctx,s)=>{
    ctx.fillStyle='#5f625f';ctx.fillRect(0,0,s,s);
    for(let i=0;i<1600;i++){const c=Math.floor(rng.range(65,150));ctx.fillStyle=`rgba(${c},${c},${Math.floor(c*.96)},.3)`;ctx.fillRect(rng.range(0,s),rng.range(0,s),rng.range(1,5),rng.range(1,5));}
  }, 4, 4);

  const bark = makeCanvasTexture(256, (ctx,s)=>{
    ctx.fillStyle='#4c3425';ctx.fillRect(0,0,s,s);ctx.strokeStyle='rgba(22,13,8,.5)';
    for(let x=0;x<s;x+=rng.range(5,13)){ctx.lineWidth=rng.range(1,4);ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+rng.range(-9,9),s*.3,x+rng.range(-6,6),s*.7,x+rng.range(-5,5),s);ctx.stroke();}
  }, 2, 5);

  const concrete = makeCanvasTexture(512, (ctx,s)=>{
    ctx.fillStyle='#4a4d50';ctx.fillRect(0,0,s,s);
    for(let i=0;i<9000;i++){const v=Math.floor(rng.range(55,135));ctx.fillStyle=`rgba(${v},${v},${v},${rng.range(.05,.22)})`;ctx.fillRect(rng.range(0,s),rng.range(0,s),rng.range(.4,2.5),rng.range(.4,2.5));}
    for(let x=0;x<s;x+=128){ctx.strokeStyle='rgba(10,12,14,.38)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}
    for(let y=0;y<s;y+=128){ctx.strokeStyle='rgba(220,225,230,.08)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}
  },8,8);

  const garageFloor = makeCanvasTexture(512, (ctx,s)=>{
    ctx.fillStyle='#171a1e';ctx.fillRect(0,0,s,s);const tile=64;
    for(let y=0;y<s;y+=tile)for(let x=0;x<s;x+=tile){const alt=((x+y)/tile)%2;ctx.fillStyle=alt?'#22262b':'#15181c';ctx.fillRect(x,y,tile,tile);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.strokeRect(x+.5,y+.5,tile-1,tile-1);}
    for(let i=0;i<1200;i++){ctx.fillStyle=`rgba(255,255,255,${rng.range(.01,.05)})`;ctx.fillRect(rng.range(0,s),rng.range(0,s),rng.range(.5,2),rng.range(.5,2));}
    const g=ctx.createRadialGradient(s*.5,s*.5,5,s*.5,s*.5,s*.45);g.addColorStop(0,'rgba(255,95,30,.18)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);
  },6,6);

  const metalPanel = makeCanvasTexture(256, (ctx,s)=>{
    ctx.fillStyle='#252a30';ctx.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=32){ctx.fillStyle=y%64?'rgba(255,255,255,.035)':'rgba(0,0,0,.14)';ctx.fillRect(0,y,s,32);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}
    for(let i=0;i<90;i++){ctx.fillStyle='rgba(210,220,230,.12)';ctx.beginPath();ctx.arc(rng.range(0,s),rng.range(0,s),rng.range(.5,1.4),0,TAU);ctx.fill();}
  },4,4);

  const checkers = makeCanvasTexture(256, (ctx,s)=>{
    const n=8, d=s/n; for(let y=0;y<n;y++)for(let x=0;x<n;x++){ctx.fillStyle=(x+y)%2?'#111318':'#efefec';ctx.fillRect(x*d,y*d,d,d);}
  }, 2, 1);

  return { asphalt, gravel, grass, sand, rock, bark, concrete, garageFloor, metalPanel, checkers };
}

class AudioSystem {
  constructor() {
    this.ctx=null;this.engine=null;this.engine2=null;this.engineGain=null;this.filter=null;this.lastGear=1;this.currentGear=1;this.shiftUntil=0;
  }
  init() {
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.engine=this.ctx.createOscillator();this.engine2=this.ctx.createOscillator();
    this.engine.type='sawtooth';this.engine2.type='triangle';
    this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=620;
    this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;
    const subGain=this.ctx.createGain();subGain.gain.value=.32;
    this.engine.connect(this.filter);this.engine2.connect(subGain).connect(this.filter);this.filter.connect(this.engineGain).connect(this.ctx.destination);
    this.engine.frequency.value=65;this.engine2.frequency.value=32.5;this.engine.start();this.engine2.start();
  }
  update(speedRatio, throttle, boosting, active) {
    if(!this.ctx||!this.engine)return 1;
    const now=this.ctx.currentTime;
    const thresholds=[0,.13,.27,.43,.60,.78,1.08,1.5];
    let gear=1;while(gear<7&&speedRatio>thresholds[gear])gear++;
    const low=thresholds[gear-1],high=thresholds[gear]||1.5;
    const within=clamp((speedRatio-low)/Math.max(high-low,.001),0,1);
    if(gear!==this.lastGear&&active){
      this.lastGear=gear;this.shiftUntil=now+.12;
      this.engineGain.gain.cancelScheduledValues(now);this.engineGain.gain.setValueAtTime(Math.max(.008,this.engineGain.gain.value),now);
      this.engineGain.gain.linearRampToValueAtTime(.008,now+.035);
      this.engineGain.gain.linearRampToValueAtTime(.035+throttle*.018,now+.12);
      this.beep(105+gear*15,.055,'square',.018);
    }
    this.currentGear=gear;
    const rpm=70+within*128+gear*3+(throttle?10:0)+(boosting?18:0);
    this.engine.frequency.setTargetAtTime(rpm,now,.035);
    this.engine2.frequency.setTargetAtTime(rpm*.5,now,.045);
    this.filter.frequency.setTargetAtTime(500+within*1650+gear*125+(boosting?500:0),now,.06);
    const targetGain=active?(.017+throttle*.026+within*.016+(boosting?.009:0)):0;
    if(now>=this.shiftUntil)this.engineGain.gain.setTargetAtTime(targetGain,now,.07);
    return gear;
  }
  beep(freq=440,duration=.12,type='square',gain=.05){
    if(!this.ctx)return;const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type=type;osc.frequency.value=freq;g.gain.value=gain;osc.connect(g).connect(this.ctx.destination);osc.start();g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+duration);osc.stop(this.ctx.currentTime+duration);
  }
  boost(){
    if(!this.ctx)return;const length=this.ctx.sampleRate*.6,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*(1-i/length);const src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();src.buffer=buffer;filter.type='bandpass';filter.frequency.value=1100;gain.gain.value=.08;src.connect(filter).connect(gain).connect(this.ctx.destination);src.start();
  }
}

function roundedBox(w, h, d, radius, material) {
  // Beveled boxes read much better than raw primitives while remaining lightweight.
  const shape = new THREE.Shape();
  const x=-w/2, y=-d/2, r=Math.min(radius,w/2,d/2);
  shape.moveTo(x+r,y); shape.lineTo(x+w-r,y); shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+d-r); shape.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
  shape.lineTo(x+r,y+d); shape.quadraticCurveTo(x,y+d,x,y+d-r);
  shape.lineTo(x,y+r); shape.quadraticCurveTo(x,y,x+r,y);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:radius*.35,bevelThickness:radius*.25});
  geo.rotateX(-Math.PI/2); geo.translate(0,-h/2,0);
  return new THREE.Mesh(geo, material);
}

function createWheel(radius=.38,width=.27,rimColor=0xbfc4ca,lowDetail=false,rimStyle='five') {
  const group=new THREE.Group();
  const tireMat=lowDetail?new THREE.MeshLambertMaterial({color:0x090a0c}):new THREE.MeshStandardMaterial({color:0x090a0c,roughness:.88,metalness:.04});
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,width,lowDetail?12:24,1),tireMat);tire.rotation.z=Math.PI/2;tire.castShadow=!lowDetail;group.add(tire);
  const rimMat=lowDetail?new THREE.MeshLambertMaterial({color:rimColor}):new THREE.MeshStandardMaterial({color:rimColor,metalness:.92,roughness:.17});
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(radius*.62,radius*.62,width*1.04,lowDetail?10:20,1,true),rimMat);barrel.rotation.z=Math.PI/2;group.add(barrel);
  const style=RIM_STYLES.find(r=>r.id===rimStyle)||RIM_STYLES[0];
  if(!lowDetail){
    const discMat=new THREE.MeshStandardMaterial({color:0x676d74,metalness:.88,roughness:.32});const disc=new THREE.Mesh(new THREE.CylinderGeometry(radius*.4,radius*.4,width*.05,24),discMat);disc.rotation.z=Math.PI/2;disc.position.x=width*.48;group.add(disc);const caliper=new THREE.Mesh(new THREE.BoxGeometry(width*.08,radius*.24,radius*.14),new THREE.MeshStandardMaterial({color:0xd4472e,metalness:.35,roughness:.4}));caliper.position.set(width*.52,radius*.23,0);group.add(caliper);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.58,radius*.055,8,28),rimMat);ring.rotation.y=Math.PI/2;ring.position.x=width*.53;group.add(ring);
    const spokeMat=rimMat,spokes=style.spokes;
    for(let i=0;i<spokes;i++){
      const a=i/spokes*TAU;
      if(style.kind==='split'){
        for(const split of [-.09,.09]){
          const spoke=new THREE.Mesh(new THREE.BoxGeometry(width*.08,radius*.075,radius*.72),spokeMat);spoke.position.set(width*.55,Math.sin(a+split)*radius*.29,Math.cos(a+split)*radius*.29);spoke.rotation.x=-(a+split);group.add(spoke);
        }
      }else{
        const thickness=style.kind==='mesh'?radius*.045:radius*.09;
        const spoke=new THREE.Mesh(new THREE.BoxGeometry(width*.08,thickness,radius*(style.kind==='turbine'?.78:.72)),spokeMat);
        spoke.position.set(width*.55,Math.sin(a)*radius*.29,Math.cos(a)*radius*.29);spoke.rotation.x=-a+(style.kind==='turbine'?.16:0);group.add(spoke);
      }
    }
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(radius*.17,radius*.17,width*1.16,16),new THREE.MeshStandardMaterial({color:0x202328,metalness:.82,roughness:.22}));hub.rotation.z=Math.PI/2;group.add(hub);
  }
  group.userData.rimStyle=rimStyle;return group;
}

function createVehicle(spec,isPlayer=false,lowDetail=false,customization=null) {
  const root=new THREE.Group();root.name=spec.name;
  const bodyColor=customization?.bodyColor??spec.color,trimColor=customization?.trimColor??spec.accent,wheelColor=customization?.wheelColor??0xbfc4ca,rimStyle=customization?.rimStyle||'five';
  const block=(w,h,d,r,material)=>lowDetail?new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material):roundedBox(w,h,d,r,material);
  const bodyMat=lowDetail?new THREE.MeshLambertMaterial({color:bodyColor}):new THREE.MeshPhysicalMaterial({color:bodyColor,metalness:.58,roughness:.2,clearcoat:1,clearcoatRoughness:.1});
  const accentMat=lowDetail?new THREE.MeshLambertMaterial({color:trimColor}):new THREE.MeshStandardMaterial({color:trimColor,metalness:.72,roughness:.25});
  const darkMat=lowDetail?new THREE.MeshLambertMaterial({color:0x090b0f}):new THREE.MeshStandardMaterial({color:0x090b0f,metalness:.65,roughness:.26});
  const glassMat=lowDetail?new THREE.MeshLambertMaterial({color:0x517f96}):new THREE.MeshPhysicalMaterial({color:0x8bbbd5,metalness:.1,roughness:.06,transmission:.2,transparent:true,opacity:.78});
  const lightMat=lowDetail?new THREE.MeshBasicMaterial({color:0xc9edff}):new THREE.MeshStandardMaterial({color:0xd9f3ff,emissive:0x8edcff,emissiveIntensity:2});
  const tailMat=lowDetail?new THREE.MeshBasicMaterial({color:0xff3333}):new THREE.MeshStandardMaterial({color:0xff2424,emissive:0xff1010,emissiveIntensity:1.6});
  const wheels=[];

  if(spec.style==='formula'){
    const floor=block(1.65,.23,3.75,.18,darkMat);floor.position.y=.38;root.add(floor);
    const nose=block(.62,.42,2.35,.22,bodyMat);nose.position.set(0,.55,.72);root.add(nose);
    const podL=block(.52,.54,1.8,.2,bodyMat);podL.position.set(-.7,.58,-.15);root.add(podL);const podR=podL.clone();podR.position.x=.7;root.add(podR);
    const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.58,lowDetail?10:20,lowDetail?7:12,0,TAU,0,Math.PI/2),glassMat);cockpit.scale.set(.85,.55,1.15);cockpit.position.set(0,.87,-.5);cockpit.rotation.x=Math.PI;root.add(cockpit);
    if(!lowDetail){const halo=new THREE.Mesh(new THREE.TorusGeometry(.42,.045,8,24,Math.PI),darkMat);halo.rotation.x=Math.PI/2;halo.position.set(0,1.12,-.55);root.add(halo);}
    const frontWing=block(2.28,.09,.42,.06,accentMat);frontWing.position.set(0,.33,1.75);root.add(frontWing);const rearWing=block(2.05,.13,.42,.06,accentMat);rearWing.position.set(0,1.05,-1.65);root.add(rearWing);
    if(!lowDetail){const wingPosts=block(.12,.66,.18,.03,darkMat);wingPosts.position.set(0,.69,-1.62);root.add(wingPosts);}
    [[-.98,.54,1.12],[.98,.54,1.12],[-1.02,.58,-1.18],[1.02,.58,-1.18]].forEach((p,i)=>{const w=createWheel(i<2?.36:.43,i<2?.25:.33,wheelColor,lowDetail,rimStyle);w.position.set(...p);wheels.push(w);root.add(w);});
    if(!lowDetail){const rearLight=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.08),tailMat);rearLight.position.set(0,.65,-1.92);root.add(rearLight);}
  }else{
    const rally=spec.style==='rally';
    const lower=block(rally?1.9:2,.42,rally?3.65:4.15,.28,bodyMat);lower.position.y=.54;root.add(lower);
    const hood=block(rally?1.72:1.78,.28,rally?1.25:1.55,.22,bodyMat);hood.position.set(0,.84,1.03);hood.rotation.x=rally?-.03:-.08;root.add(hood);
    const cabin=block(rally?1.52:1.48,.72,rally?1.68:1.62,.25,glassMat);cabin.position.set(0,1.11,-.31);cabin.scale.set(1,.92,1);root.add(cabin);
    const roof=block(rally?1.58:1.42,.12,rally?1.25:1.05,.16,bodyMat);roof.position.set(0,1.51,-.42);root.add(roof);
    const splitter=block(1.95,.1,.38,.05,darkMat);splitter.position.set(0,.34,2);root.add(splitter);const diffuser=block(1.88,.14,.42,.06,darkMat);diffuser.position.set(0,.39,-1.92);root.add(diffuser);
    if(!lowDetail){const grille=new THREE.Mesh(new THREE.BoxGeometry(rally?1.05:1.25,.25,.06),darkMat);grille.position.set(0,.58,2.1);root.add(grille);[-.61,.61].forEach(x=>{const h=new THREE.Mesh(new THREE.BoxGeometry(.46,.18,.07),lightMat);h.position.set(x,.76,2.09);root.add(h);const t=new THREE.Mesh(new THREE.BoxGeometry(.42,.17,.07),tailMat);t.position.set(x,.75,-2.06);root.add(t);});}
    if(rally){
      const bumper=block(1.92,.16,.2,.04,accentMat);bumper.position.set(0,.42,1.96);root.add(bumper);
      if(!lowDetail){const rack=block(1.28,.08,.85,.04,darkMat);rack.position.set(0,1.67,-.35);root.add(rack);[-.45,-.15,.15,.45].forEach(x=>{const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.08,14),lightMat);lamp.rotation.x=Math.PI/2;lamp.position.set(x,1.72,.12);root.add(lamp);});}
      const spoiler=block(1.65,.1,.34,.05,accentMat);spoiler.position.set(0,1.47,-1.65);root.add(spoiler);
    }else{
      const spoiler=block(1.7,.11,.42,.06,accentMat);spoiler.position.set(0,1.28,-1.83);root.add(spoiler);
      if(!lowDetail){const postL=block(.09,.42,.1,.02,darkMat);postL.position.set(-.55,1.03,-1.73);root.add(postL);const postR=postL.clone();postR.position.x=.55;root.add(postR);const exhaustL=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.25,12),darkMat);exhaustL.rotation.x=Math.PI/2;exhaustL.position.set(-.43,.42,-2.13);root.add(exhaustL);const exhaustR=exhaustL.clone();exhaustR.position.x=.43;root.add(exhaustR);}
    }
    const wz=rally?1.22:1.38,wx=rally?1.02:1.04,wy=.57;
    [[-wx,wy,wz],[wx,wy,wz],[-wx,wy,-wz],[wx,wy,-wz]].forEach(p=>{const w=createWheel(rally?.43:.39,rally?.31:.29,wheelColor,lowDetail,rimStyle);w.position.set(...p);wheels.push(w);root.add(w);});
  }
  const flames=[];if(!lowDetail)[-.43,.43].forEach(x=>{const cone=new THREE.Mesh(new THREE.ConeGeometry(.12,.8,12,1,true),new THREE.MeshBasicMaterial({color:0x5fd8ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));cone.rotation.x=-Math.PI/2;cone.position.set(x,.45,-2.35);root.add(cone);flames.push(cone);});
  root.userData={wheels,flames,spec,isPlayer,steerVisual:0,customization:{bodyColor,trimColor,wheelColor,rimStyle}};
  root.traverse(o=>{if(o.isMesh){o.castShadow=!DEVICE_PROFILE.performanceMode&&!lowDetail;o.receiveShadow=!DEVICE_PROFILE.performanceMode&&!lowDetail;}});return root;
}

function terrainHeight(x,z,theme){
  const broad=Math.sin(x*.021)*3.4+Math.cos(z*.026)*2.9+Math.sin((x+z)*.011)*2.5;
  if(theme==='alpine'||theme==='canyon')return broad+Math.max(0,(z+95)*.03)+Math.abs(Math.sin(x*.008))*4.5;
  if(theme==='coast')return broad*.75+4+Math.max(0,x*.015);
  if(theme==='desert')return broad*.38+Math.sin(x*.008)*2.4+1.5;
  if(theme==='harbor')return broad*.12+2.2;
  if(theme==='highland')return broad*.72+Math.sin(z*.01)*2+4;
  if(theme==='spa')return broad*.78+Math.sin(z*.008)*2.4+Math.cos(x*.006)*1.8+3.5;
  return broad*.6+1;
}

function expandTrackPoints(points, scaleXZ=1){
  const source=points.map(p=>new THREE.Vector3(...p));
  if(scaleXZ===1)return source;
  const center=source.reduce((sum,p)=>sum.add(new THREE.Vector3(p.x,0,p.z)),new THREE.Vector3()).multiplyScalar(1/source.length);
  return source.map(p=>new THREE.Vector3(center.x+(p.x-center.x)*scaleXZ,p.y,center.z+(p.z-center.z)*scaleXZ));
}

function buildFlowingTrackPoints(points,count=72,passes=4,radius=5){
  const source=points.map(p=>p.isVector3?p.clone():new THREE.Vector3(...p)),segmentLengths=[];
  let total=0;
  for(let i=0;i<source.length;i++){
    const a=source[i],b=source[(i+1)%source.length],length=Math.hypot(b.x-a.x,b.z-a.z);
    segmentLengths.push(length);total+=length;
  }
  const resampled=[];
  let segment=0,segmentStart=0;
  for(let i=0;i<count;i++){
    const target=total*i/count;
    while(segment<segmentLengths.length-1&&segmentStart+segmentLengths[segment]<target){segmentStart+=segmentLengths[segment++];}
    const a=source[segment],b=source[(segment+1)%source.length],f=(target-segmentStart)/Math.max(segmentLengths[segment],.0001);
    resampled.push(a.clone().lerp(b,f));
  }
  const offsets=[],weights=[];let weightTotal=0,sigma=radius/1.7;
  for(let offset=-radius;offset<=radius;offset++){
    const weight=Math.exp(-(offset*offset)/(2*sigma*sigma));offsets.push(offset);weights.push(weight);weightTotal+=weight;
  }
  for(let i=0;i<weights.length;i++)weights[i]/=weightTotal;
  let current=resampled;
  for(let pass=0;pass<passes;pass++){
    current=current.map((_,i)=>{
      const point=new THREE.Vector3();
      for(let k=0;k<offsets.length;k++)point.addScaledVector(current[(i+offsets[k]+count)%count],weights[k]);
      return point;
    });
  }
  return current;
}

class RaceTrack {
  constructor(game, def) {
    this.game=game; this.def=def; this.group=new THREE.Group(); this.rng=new RNG(1200+TRACKS.indexOf(def)*907);
    const expandedPoints=expandTrackPoints(def.points,def.scaleXZ||1);
    const flowingPoints=buildFlowingTrackPoints(expandedPoints,def.flowCount||(this.game.performanceMode?64:80),def.smoothingPasses??3,def.smoothingRadius??4);
    this.curve=new THREE.CatmullRomCurve3(flowingPoints,true,'centripetal');
    this.length=this.curve.getLength(); this.sampleCount=game.performanceMode?clamp(Math.round(this.length/2.25),460,760):(game.isMobile?clamp(Math.round(this.length/1.85),520,860):clamp(Math.round(this.length/1.45),680,1050));
    this.samples=[]; this.tangents=[]; this.normals=[];
    for(let i=0;i<this.sampleCount;i++){
      const t=i/this.sampleCount, p=this.curve.getPointAt(t), tan=this.curve.getTangentAt(t).normalize();
      this.samples.push(p); this.tangents.push(tan); this.normals.push(new THREE.Vector3(-tan.z,0,tan.x).normalize());
    }
    const xs=this.samples.map(p=>p.x),zs=this.samples.map(p=>p.z);
    this.bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
    this.center=new THREE.Vector3((this.bounds.minX+this.bounds.maxX)*.5,0,(this.bounds.minZ+this.bounds.maxZ)*.5);
    this.terrainSize=Math.ceil((Math.max(this.bounds.maxX-this.bounds.minX,this.bounds.maxZ-this.bounds.minZ)+180)/20)*20;
    const minimapStep=game.performanceMode?4:2;
    this.minimapPoints=this.samples.filter((_,i)=>i%minimapStep===0).map(p=>({x:p.x,z:p.z}));
    this.build();
  }
  build(){
    const {scene,textures}=this.game; scene.add(this.group);
    const theme=this.def.theme;
    const bg={coast:0x86b8d0,forest:0x7ea0a0,alpine:0x9bb0c1,highland:0x879d9c,spa:0x81969b,desert:0xc5a978,harbor:0x111a28,canyon:0x9c806f}[theme]||0x899aa5;
    const fog={coast:0x8cb8c7,forest:0x718681,alpine:0x99a9b6,highland:0x788d89,spa:0x728482,desert:0xb89b6e,harbor:0x111827,canyon:0x92776a}[theme]||0x899aa5;
    scene.background=new THREE.Color(bg);scene.fog=new THREE.FogExp2(fog,theme==='forest'?.0068:theme==='spa'?.0058:theme==='harbor'?.0054:.0042);

    this.buildTerrain(); this.buildRoad(); this.buildStartArea(); this.buildScenery();
    if(this.game.performanceMode){
      this.group.updateMatrixWorld(true);
      this.group.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
    }
  }
  buildTerrain(){
    const size=this.terrainSize, seg=this.game.performanceMode?56:(this.game.isMobile?68:112);
    const geo=new THREE.PlaneGeometry(size,size,seg,seg); geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const worldX=pos.getX(i)+this.center.x,worldZ=pos.getZ(i)+this.center.z;
      pos.setY(i,this.groundHeight(worldX,worldZ));
    }
    geo.computeVertexNormals();
    const tex=(this.def.theme==='coast'||this.def.theme==='desert'||this.def.theme==='canyon')?this.game.textures.sand:(this.def.theme==='harbor'?this.game.textures.concrete:this.game.textures.grass);
    const terrainColor={coast:0xbba982,desert:0xb99661,canyon:0x8d705e,harbor:0x51565d,forest:0x44613b,highland:0x4a6248,spa:0x405d3d,alpine:0x536748}[this.def.theme]||0x536748;
    const terrainParams={map:tex,color:terrainColor};
    const mat=this.game.performanceMode?new THREE.MeshLambertMaterial(terrainParams):new THREE.MeshStandardMaterial({...terrainParams,roughness:1});
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(this.center.x,0,this.center.z);mesh.receiveShadow=!this.game.isMobile;this.group.add(mesh);
    if(this.def.theme==='coast'||this.def.theme==='harbor'){
      const waterMaterial=this.game.performanceMode
        ?new THREE.MeshLambertMaterial({color:0x1f6f8d,transparent:true,opacity:.82})
        :new THREE.MeshStandardMaterial({color:0x1f6f8d,roughness:.28,metalness:.03,transparent:true,opacity:.82});
      const water=new THREE.Mesh(new THREE.PlaneGeometry(size+260,size+260),waterMaterial);
      water.rotation.x=-Math.PI/2;water.position.set(this.center.x,this.def.theme==='harbor'?-.8:-2.7,this.center.z+50);this.group.add(water);
    }
  }
  ribbonGeometry(width,yOffset=0,textureMeters=7.5,thickness=.16){
    const positions=[],uvs=[],indices=[];
    const metersPerSample=this.length/this.sampleCount;
    for(let i=0;i<=this.sampleCount;i++){
      const j=i%this.sampleCount,p=this.samples[j],n=this.normals[j];
      const leftX=p.x+n.x*width,leftZ=p.z+n.z*width,rightX=p.x-n.x*width,rightZ=p.z-n.z*width;
      const topY=p.y+yOffset,bottomY=topY-thickness,v=(i*metersPerSample)/textureMeters;
      // Four vertices per sample make a shallow solid ribbon: top, textured bottom,
      // and textured edge skirts. This remains visible even if terrain LOD exposes it.
      positions.push(leftX,topY,leftZ,rightX,topY,rightZ,leftX,bottomY,leftZ,rightX,bottomY,rightZ);
      uvs.push(0,v,1,v,0,v,1,v);
      if(i<this.sampleCount){
        const a=i*4,b=a+1,bl=a+2,br=a+3,c=a+4,d=a+5,nbl=a+6,nbr=a+7;
        indices.push(a,c,b,b,c,d);                 // top
        indices.push(bl,br,nbl,br,nbr,nbl);       // bottom
        indices.push(a,bl,c,bl,nbl,c);            // left skirt
        indices.push(b,d,br,br,d,nbr);            // right skirt
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  buildRoad(){
    const shoulderMaterial=this.game.performanceMode
      ?new THREE.MeshLambertMaterial({map:this.game.textures.gravel,color:0xffffff,side:THREE.DoubleSide})
      :new THREE.MeshStandardMaterial({map:this.game.textures.gravel,color:0xffffff,roughness:1,side:THREE.DoubleSide});
    const shoulder=new THREE.Mesh(this.ribbonGeometry(this.def.roadWidth*.68,-.035,3.4,.2),shoulderMaterial);
    shoulder.receiveShadow=!this.game.isMobile;this.group.add(shoulder);
    const roadMaterial=this.game.performanceMode
      ?new THREE.MeshLambertMaterial({map:this.game.textures.asphalt,color:0xffffff,side:THREE.DoubleSide})
      :new THREE.MeshStandardMaterial({map:this.game.textures.asphalt,color:0xffffff,roughness:.88,metalness:.01,side:THREE.DoubleSide});
    const road=new THREE.Mesh(this.ribbonGeometry(this.def.roadWidth*.5,.012,7.5,.2),roadMaterial);
    road.receiveShadow=!this.game.isMobile;this.group.add(road);

    // One wider road now reads as three usable racing lanes. Instancing keeps the
    // lane markings to a single draw call instead of hundreds of individual meshes.
    const lineMat=this.game.performanceMode
      ?new THREE.MeshBasicMaterial({color:0xe9e1b8})
      :new THREE.MeshStandardMaterial({color:0xe9e1b8,roughness:.7,emissive:0x241f10,emissiveIntensity:.12});
    const metersPerSample=this.length/this.sampleCount;
    const dashStep=Math.max(7,Math.round((this.game.performanceMode?13:10)/metersPerSample));
    const laneOffsets=[-this.def.roadWidth/6,this.def.roadWidth/6];
    const dashCount=Math.ceil(this.sampleCount/dashStep)*laneOffsets.length;
    const dashes=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.025,3.1),lineMat,dashCount);
    const dummy=new THREE.Object3D();let dashIndex=0;
    for(let i=0;i<this.sampleCount;i+=dashStep){
      const p=this.samples[i],t=this.tangents[i],n=this.normals[i];
      for(const laneOffset of laneOffsets){
        dummy.position.copy(p).addScaledVector(n,laneOffset).add(new THREE.Vector3(0,.06,0));
        dummy.rotation.set(0,Math.atan2(t.x,t.z),0);dummy.scale.set(1,1,1);dummy.updateMatrix();dashes.setMatrixAt(dashIndex++,dummy.matrix);
      }
    }
    dashes.count=dashIndex;dashes.receiveShadow=false;dashes.frustumCulled=true;this.group.add(dashes);

    // Guardrails and posts are instanced as well; this removes the largest source
    // of draw-call overhead on the longer circuits.
    const railMat=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0xaeb5bb}):new THREE.MeshStandardMaterial({color:0xaeb5bb,metalness:.72,roughness:.34});
    const postMat=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0x4d535a}):new THREE.MeshStandardMaterial({color:0x4d535a,metalness:.55,roughness:.46});
    const railStep=this.game.performanceMode?14:10;
    const maxRailCount=Math.ceil(this.sampleCount/railStep)*2;
    const rails=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.17,4.6),railMat,maxRailCount);
    const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.72,.12),postMat,maxRailCount);
    let railIndex=0;
    for(let i=0;i<this.sampleCount;i+=railStep){
      const prev=this.tangents[(i-5+this.sampleCount)%this.sampleCount],next=this.tangents[(i+5)%this.sampleCount];
      const curve=Math.abs(prev.x*next.z-prev.z*next.x);
      if(curve<.045&&this.rng.next()>.24)continue;
      for(const side of [-1,1]){
        if(this.rng.next()<.32)continue;
        const p=this.samples[i],n=this.normals[i],t=this.tangents[i];
        const x=p.x+n.x*this.def.roadWidth*.62*side,z=p.z+n.z*this.def.roadWidth*.62*side;
        dummy.position.set(x,p.y+.56,z);dummy.rotation.set(0,Math.atan2(t.x,t.z),0);dummy.scale.set(1,1,1);dummy.updateMatrix();rails.setMatrixAt(railIndex,dummy.matrix);
        dummy.position.set(x,p.y+.3,z);dummy.updateMatrix();posts.setMatrixAt(railIndex,dummy.matrix);railIndex++;
      }
    }
    rails.count=posts.count=railIndex;rails.castShadow=posts.castShadow=false;this.group.add(rails,posts);
  }
  buildStartArea(){
    const p=this.samples[0],t=this.tangents[0];
    const line=new THREE.Mesh(new THREE.PlaneGeometry(this.def.roadWidth,.95),new THREE.MeshStandardMaterial({map:this.game.textures.checkers,side:THREE.DoubleSide}));
    line.rotation.x=-Math.PI/2;line.rotation.z=-Math.atan2(t.x,t.z);line.position.copy(p).add(new THREE.Vector3(0,.075,0));this.group.add(line);

    const arch=new THREE.Group();
    const metal=new THREE.MeshStandardMaterial({color:0x15191e,metalness:.7,roughness:.3});
    const orange=new THREE.MeshStandardMaterial({color:0xff5a1f,emissive:0x6c1600,emissiveIntensity:.4});
    const beam=new THREE.Mesh(new THREE.BoxGeometry(this.def.roadWidth+2,.55,.55),metal);beam.position.y=5.7;arch.add(beam);
    [-1,1].forEach(s=>{const post=new THREE.Mesh(new THREE.BoxGeometry(.5,5.9,.55),metal);post.position.set(s*(this.def.roadWidth*.5+.6),2.85,0);arch.add(post);});
    const sign=new THREE.Mesh(new THREE.BoxGeometry(5.2,.9,.14),orange);sign.position.set(0,5.7,-.35);arch.add(sign);
    arch.position.copy(p);arch.rotation.y=Math.atan2(t.x,t.z);arch.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.group.add(arch);

    // Pit structure and trackside props.
    const n=this.normals[0];
    const pit=new THREE.Group();
    const wallMat=new THREE.MeshStandardMaterial({color:0xd8d4c8,roughness:.9});
    const roofMat=new THREE.MeshStandardMaterial({color:0x252a30,metalness:.45,roughness:.4});
    const base=new THREE.Mesh(new THREE.BoxGeometry(17,3.2,5),wallMat);base.position.y=1.6;pit.add(base);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(18,.35,5.8),roofMat);roof.position.y=3.45;pit.add(roof);
    for(let x=-6;x<=6;x+=4){const door=new THREE.Mesh(new THREE.BoxGeometry(2.7,2.2,.08),new THREE.MeshStandardMaterial({color:0x30343a,metalness:.5}));door.position.set(x,1.15,2.54);pit.add(door);}
    pit.position.copy(p).add(n.clone().multiplyScalar(this.def.roadWidth+6));pit.rotation.y=Math.atan2(t.x,t.z);pit.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.group.add(pit);
  }
  buildScenery(){
    const theme=this.def.theme, rng=this.rng;
    const radial=this.game.performanceMode?6:8;
    const trunkGeo=new THREE.CylinderGeometry(.28,.4,3.5,radial);
    const trunkParams={map:this.game.textures.bark,color:0x684b35};
    const trunkMat=this.game.performanceMode?new THREE.MeshLambertMaterial(trunkParams):new THREE.MeshStandardMaterial({...trunkParams,roughness:1});
    const leafGeo=theme==='forest'?new THREE.ConeGeometry(2.1,6.7,this.game.performanceMode?7:10):new THREE.ConeGeometry(1.65,5.1,this.game.performanceMode?7:9);
    const leafParams={color:theme==='coast'?0x526d3e:theme==='forest'?0x244b2a:theme==='spa'?0x294b2f:theme==='highland'?0x395b3a:0x38593a};
    const leafMat=this.game.performanceMode?new THREE.MeshLambertMaterial(leafParams):new THREE.MeshStandardMaterial({...leafParams,roughness:1});
    const rockGeo=new THREE.DodecahedronGeometry(1.2,0),rockParams={map:this.game.textures.rock,color:0x777a78};
    const rockMat=this.game.performanceMode?new THREE.MeshLambertMaterial(rockParams):new THREE.MeshStandardMaterial({...rockParams,roughness:1});
    const detail=this.game.performanceMode?.38:(this.game.isMobile?.42:.76);
    const baseTrees=theme==='desert'||theme==='canyon'||theme==='harbor'?0:theme==='coast'?105:theme==='spa'?260:225;const treeCount=Math.round(baseTrees*detail),rockCount=Math.round((theme==='harbor'?30:92)*detail);
    const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,treeCount), leaves=new THREE.InstancedMesh(leafGeo,leafMat,treeCount), rocks=new THREE.InstancedMesh(rockGeo,rockMat,rockCount);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),pos=new THREE.Vector3();
    let made=0,tries=0;
    while(made<treeCount&&tries++<4000){
      const idx=Math.floor(rng.next()*this.sampleCount),p=this.samples[idx],n=this.normals[idx],side=rng.next()<.5?-1:1,dist=rng.range(this.def.roadWidth*.9,(theme==='forest'||theme==='spa')?42:theme==='harbor'?32:60);
      pos.set(p.x+n.x*dist*side,0,p.z+n.z*dist*side);
      pos.x+=rng.range(-9,9);pos.z+=rng.range(-9,9);
      const scale=rng.range(.65,1.5),ground=this.groundHeight(pos.x,pos.z);
      pos.y=ground+1.75*scale;
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),rng.range(0,TAU));s.set(scale,scale,scale);m.compose(pos,q,s);trunks.setMatrixAt(made,m);
      const lp=pos.clone();lp.y=ground+5.0*scale;m.compose(lp,q,s);leaves.setMatrixAt(made,m);made++;
    }
    trunks.count=leaves.count=made;trunks.castShadow=leaves.castShadow=false;trunks.receiveShadow=leaves.receiveShadow=false;this.group.add(trunks,leaves);
    for(let i=0;i<rockCount;i++){
      const idx=Math.floor(rng.next()*this.sampleCount),p=this.samples[idx],n=this.normals[idx],side=rng.next()<.5?-1:1,dist=rng.range(this.def.roadWidth*.85,55);
      pos.set(p.x+n.x*dist*side,0,p.z+n.z*dist*side);
      const sc=rng.range(.4,2.4);pos.y=this.groundHeight(pos.x,pos.z)+sc*.35;
      q.setFromEuler(new THREE.Euler(rng.range(-.2,.2),rng.range(0,TAU),rng.range(-.2,.2)));s.set(sc,rng.range(.5,1.5)*sc,sc);m.compose(pos,q,s);rocks.setMatrixAt(i,m);
    }
    rocks.castShadow=false;rocks.receiveShadow=false;this.group.add(rocks);

    if(theme==='alpine'||theme==='canyon'||theme==='highland'||theme==='spa')this.buildMountains();
    if(theme==='coast')this.buildCoastProps();
    if(theme==='forest'||theme==='highland'||theme==='spa')this.buildForestProps();
    if(theme==='spa')this.buildSpaProps();
    if(theme==='desert'||theme==='canyon')this.buildDesertProps();
    if(theme==='harbor')this.buildHarborProps();
  }
  buildMountains(){
    const params={map:this.game.textures.rock,color:0x7a7f80};
    const mat=this.game.performanceMode?new THREE.MeshLambertMaterial(params):new THREE.MeshStandardMaterial({...params,roughness:1});
    const count=this.game.performanceMode?6:(this.game.isMobile?8:12),ring=Math.max(this.bounds.maxX-this.bounds.minX,this.bounds.maxZ-this.bounds.minZ)*.58+52;
    for(let i=0;i<count;i++){
      const angle=i/count*TAU,r=ring+this.rng.range(-18,28),h=this.rng.range(30,65);
      const mountain=new THREE.Mesh(new THREE.ConeGeometry(this.rng.range(18,35),h,6),mat);mountain.position.set(this.center.x+Math.cos(angle)*r,h/2-6,this.center.z+Math.sin(angle)*r);mountain.rotation.y=this.rng.range(0,TAU);mountain.receiveShadow=false;this.group.add(mountain);
    }
  }
  buildCoastProps(){
    const white=new THREE.MeshStandardMaterial({color:0xf1eee5,roughness:.8}),red=new THREE.MeshStandardMaterial({color:0xc7372f,roughness:.7});
    const tower=new THREE.Group();const base=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.8,8,18),white);base.position.y=4;tower.add(base);const band=new THREE.Mesh(new THREE.CylinderGeometry(2.23,2.23,1.1,18),red);band.position.y=5.1;tower.add(band);const cap=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,.5,18),red);cap.position.y=8.2;tower.add(cap);const light=new THREE.Mesh(new THREE.SphereGeometry(.85,14,10),new THREE.MeshStandardMaterial({color:0xfff5c2,emissive:0xffd65a,emissiveIntensity:2}));light.position.y=9;tower.add(light);tower.position.set(110,4,68);tower.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.group.add(tower);
  }
  buildForestProps(){
    const wood=new THREE.MeshStandardMaterial({color:0x5b3b26,roughness:1});
    const count=this.game.performanceMode?3:5;
    for(let i=0;i<count;i++){const bridge=new THREE.Mesh(new THREE.BoxGeometry(12,.5,2.5),wood);const idx=Math.floor((90+i*(this.sampleCount/count))%this.sampleCount);const p=this.samples[idx],t=this.tangents[idx];bridge.position.copy(p).add(new THREE.Vector3(0,6+i*.3,0));bridge.rotation.y=Math.atan2(t.x,t.z)+Math.PI/2;bridge.castShadow=!this.game.performanceMode;this.group.add(bridge);}
  }
  buildSpaProps(){
    // Ardennes details: red/yellow kerbs, a compact pit building and hillside grandstands.
    const red=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0xc9272e}):new THREE.MeshStandardMaterial({color:0xc9272e,roughness:.72});
    const yellow=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0xf2cf24}):new THREE.MeshStandardMaterial({color:0xf2cf24,roughness:.72});
    const kerbGeo=new THREE.BoxGeometry(.72,.055,2.8),step=this.game.performanceMode?12:9,count=Math.ceil(this.sampleCount/step)*2;
    const redKerbs=new THREE.InstancedMesh(kerbGeo,red,count),yellowKerbs=new THREE.InstancedMesh(kerbGeo,yellow,count),dummy=new THREE.Object3D();
    let redCount=0,yellowCount=0;
    for(let i=0;i<this.sampleCount;i+=step){
      const p=this.samples[i],t=this.tangents[i],n=this.normals[i],side=((i/step)|0)%2?-1:1;
      dummy.position.copy(p).addScaledVector(n,side*(this.def.roadWidth*.5-.32));dummy.position.y+=.075;dummy.rotation.set(0,Math.atan2(t.x,t.z),0);dummy.updateMatrix();
      (((i/step)|0)%2?yellowKerbs:redKerbs).setMatrixAt(((i/step)|0)%2?yellowCount++:redCount++,dummy.matrix);
    }
    redKerbs.count=redCount;yellowKerbs.count=yellowCount;redKerbs.receiveShadow=yellowKerbs.receiveShadow=false;this.group.add(redKerbs,yellowKerbs);

    const concrete=this.game.performanceMode?new THREE.MeshLambertMaterial({map:this.game.textures.concrete,color:0xb9bdba}):new THREE.MeshStandardMaterial({map:this.game.textures.concrete,color:0xb9bdba,roughness:.88});
    const glass=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0x29414f}):new THREE.MeshStandardMaterial({color:0x29414f,metalness:.2,roughness:.28,emissive:0x102530,emissiveIntensity:.32});
    const start=this.samples[0],tan=this.tangents[0],normal=this.normals[0],pit=new THREE.Group();
    const shell=new THREE.Mesh(new THREE.BoxGeometry(34,4.8,7),concrete);shell.position.y=2.4;pit.add(shell);
    for(let x=-14;x<=14;x+=4){const window=new THREE.Mesh(new THREE.BoxGeometry(2.7,1.25,.08),glass);window.position.set(x,3.1,3.55);pit.add(window);}
    const canopy=new THREE.Mesh(new THREE.BoxGeometry(38,.3,8.2),red);canopy.position.y=5;pit.add(canopy);
    pit.position.copy(start).addScaledVector(normal,-(this.def.roadWidth*.5+8));pit.position.y=this.groundHeight(pit.position.x,pit.position.z);pit.rotation.y=Math.atan2(tan.x,tan.z);this.group.add(pit);

    const standMat=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0x7c8586}):new THREE.MeshStandardMaterial({color:0x7c8586,metalness:.18,roughness:.72});
    for(const idx of [7,10,33]){
      const p=this.samples[Math.floor(idx/40*this.sampleCount)%this.sampleCount],t=this.tangents[Math.floor(idx/40*this.sampleCount)%this.sampleCount],n=this.normals[Math.floor(idx/40*this.sampleCount)%this.sampleCount],stand=new THREE.Group();
      for(let r=0;r<4;r++){const bench=new THREE.Mesh(new THREE.BoxGeometry(13,.25,1.1),r%2?yellow:red);bench.position.set(0,1+r*.55,-1.8+r*.58);stand.add(bench);}
      const base=new THREE.Mesh(new THREE.BoxGeometry(14,2.8,4.8),standMat);base.position.y=1.4;stand.add(base);stand.position.copy(p).addScaledVector(n,this.def.roadWidth+14);stand.position.y=this.groundHeight(stand.position.x,stand.position.z);stand.rotation.y=Math.atan2(t.x,t.z)+Math.PI;this.group.add(stand);
    }
  }
  buildDesertProps(){
    const concrete=this.game.performanceMode?new THREE.MeshLambertMaterial({map:this.game.textures.concrete,color:0xc1aa83}):new THREE.MeshStandardMaterial({map:this.game.textures.concrete,color:0xc1aa83,roughness:1});
    const red=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0xb64a32}):new THREE.MeshStandardMaterial({color:0xb64a32,roughness:.75});
    const count=this.game.performanceMode?5:9;
    for(let i=0;i<count;i++){
      const idx=Math.floor((45+i*this.sampleCount/count)%this.sampleCount),p=this.samples[idx],n=this.normals[idx],t=this.tangents[idx],side=i%2?-1:1;
      const stand=new THREE.Group(),base=new THREE.Mesh(new THREE.BoxGeometry(14,2.4,4.4),concrete);base.position.y=1.2;stand.add(base);
      for(let r=0;r<3;r++){const bench=new THREE.Mesh(new THREE.BoxGeometry(13,.22,.55),red);bench.position.set(0,2.2+r*.55,-1.1+r*.55);stand.add(bench);}
      stand.position.copy(p).addScaledVector(n,side*(this.def.roadWidth+13));stand.position.y=this.groundHeight(stand.position.x,stand.position.z);stand.rotation.y=Math.atan2(t.x,t.z)+(side<0?Math.PI:0);this.group.add(stand);
    }
    const cactusMat=this.game.performanceMode?new THREE.MeshLambertMaterial({color:0x47734b}):new THREE.MeshStandardMaterial({color:0x47734b,roughness:.92});
    const cactusCount=this.game.performanceMode?16:30,trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.28,.38,3.9,8),cactusMat,cactusCount),arms=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.2,1.55,8),cactusMat,cactusCount*2);
    const dummy=new THREE.Object3D();let armIndex=0;
    for(let i=0;i<cactusCount;i++){
      const idx=Math.floor(this.rng.next()*this.sampleCount),p=this.samples[idx],n=this.normals[idx],side=this.rng.next()<.5?-1:1,dist=this.rng.range(this.def.roadWidth+17,58),x=p.x+n.x*dist*side+this.rng.range(-10,10),z=p.z+n.z*dist*side+this.rng.range(-10,10),ground=this.groundHeight(x,z),scale=this.rng.range(.7,1.45);
      dummy.position.set(x,ground+1.95*scale,z);dummy.scale.set(scale,scale,scale);dummy.rotation.set(0,this.rng.range(0,TAU),0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      for(const dir of [-1,1]){dummy.position.set(x+dir*.48*scale,ground+(1.7+this.rng.range(-.2,.45))*scale,z);dummy.scale.set(scale,scale,scale);dummy.rotation.set(0,0,dir*Math.PI*.48);dummy.updateMatrix();arms.setMatrixAt(armIndex++,dummy.matrix);}
    }
    arms.count=armIndex;trunks.castShadow=arms.castShadow=false;this.group.add(trunks,arms);
  }
  buildHarborProps(){
    const wallMat=this.game.performanceMode?new THREE.MeshLambertMaterial({map:this.game.textures.metalPanel,color:0x59616c}):new THREE.MeshStandardMaterial({map:this.game.textures.metalPanel,color:0x59616c,metalness:.35,roughness:.55});
    const glass=new THREE.MeshStandardMaterial({color:0x183c58,emissive:0x0b3d63,emissiveIntensity:.65,roughness:.25});
    const count=this.game.performanceMode?9:16;
    for(let i=0;i<count;i++){
      const idx=Math.floor(i*this.sampleCount/count),p=this.samples[idx],n=this.normals[idx],side=i%2?-1:1,h=8+(i%4)*3;
      const building=new THREE.Group(),shell=new THREE.Mesh(new THREE.BoxGeometry(9+(i%3)*3,h,8),wallMat);shell.position.y=h/2;building.add(shell);
      for(let y=2;y<h-1;y+=2.4)for(let x=-3;x<=3;x+=2){const win=new THREE.Mesh(new THREE.BoxGeometry(1.1,.8,.05),glass);win.position.set(x,y,4.03);building.add(win);}
      building.position.copy(p).addScaledVector(n,side*(this.def.roadWidth+16+(i%3)*7));building.position.y=this.groundHeight(building.position.x,building.position.z);building.rotation.y=Math.atan2(this.tangents[idx].x,this.tangents[idx].z)+(side<0?Math.PI:0);this.group.add(building);
    }
    const lampMat=new THREE.MeshStandardMaterial({color:0xffd58a,emissive:0xffa52b,emissiveIntensity:2});
    const poleMat=new THREE.MeshStandardMaterial({color:0x262b32,metalness:.65,roughness:.35});
    const lampCount=this.game.performanceMode?18:32;
    for(let i=0;i<lampCount;i++){
      const idx=Math.floor(i*this.sampleCount/lampCount),p=this.samples[idx],n=this.normals[idx],side=i%2?-1:1,pole=new THREE.Group();
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,5,8),poleMat);stem.position.y=2.5;pole.add(stem);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),lampMat);lamp.position.y=5;pole.add(lamp);
      pole.position.copy(p).addScaledVector(n,side*(this.def.roadWidth*.72));this.group.add(pole);
    }
  }
  groundHeight(x,z){
    const base=terrainHeight(x,z,this.def.theme)-2.2;
    let bestD=Infinity,bestY=base;
    // Find the closest centerline elevation, then flatten the full paved corridor.
    // The old radial blend only matched the exact centerline, leaving both road
    // edges floating over the terrain on steep sections.
    for(let i=0;i<this.sampleCount;i+=(this.game.performanceMode?3:2)){
      const p=this.samples[i],dx=p.x-x,dz=p.z-z,d=dx*dx+dz*dz;
      if(d<bestD){bestD=d;bestY=p.y-.045;}
    }
    const distance=Math.sqrt(bestD);
    const flatRadius=this.def.roadWidth*.82;
    const transition=26;
    if(distance<=flatRadius)return bestY;
    const t=clamp((distance-flatRadius)/transition,0,1);
    const smooth=t*t*(3-2*t);
    return lerp(bestY,base,smooth);
  }
  samplePoint(t,out=new THREE.Vector3()){
    const wrapped=(t%1+1)%1,f=wrapped*this.sampleCount,i=Math.floor(f)%this.sampleCount,j=(i+1)%this.sampleCount;
    return out.copy(this.samples[i]).lerp(this.samples[j],f-Math.floor(f));
  }
  sampleTangent(t,out=new THREE.Vector3()){
    const wrapped=(t%1+1)%1,f=wrapped*this.sampleCount,i=Math.floor(f)%this.sampleCount,j=(i+1)%this.sampleCount;
    return out.copy(this.tangents[i]).lerp(this.tangents[j],f-Math.floor(f)).normalize();
  }
  getPoint(t){return this.samplePoint(t);}
  getTangent(t){return this.sampleTangent(t);}
  nearestIndex(position,hint=null){
    let best=0,bestD=Infinity;
    if(hint==null){for(let i=0;i<this.sampleCount;i++){const p=this.samples[i],dx=p.x-position.x,dz=p.z-position.z,d=dx*dx+dz*dz;if(d<bestD){bestD=d;best=i;}}}
    else {for(let k=-52;k<=52;k++){const i=(hint+k+this.sampleCount)%this.sampleCount,p=this.samples[i],dx=p.x-position.x,dz=p.z-position.z,d=dx*dx+dz*dz;if(d<bestD){bestD=d;best=i;}}}
    return {index:best,distance:Math.sqrt(bestD)};
  }
}

class Racer {
  constructor(game,spec,name,player=false,lane=0,startOffset=0,aiIndex=0,customizationOverride=null){
    this.game=game;this.spec=spec;this.name=name;this.player=player;this.lane=lane;this.aiIndex=aiIndex;
    const aiLivery=!player?AI_LIVERIES[aiIndex%AI_LIVERIES.length]:null;
    const custom=customizationOverride||(player?game.getCustomization(spec):{bodyColor:aiLivery[0],trimColor:aiLivery[1],wheelColor:aiLivery[2],rimStyle:RIM_STYLES[aiIndex%RIM_STYLES.length].id});
    this.mesh=createVehicle(spec,player,!player,custom);game.scene.add(this.mesh);
    this.position=new THREE.Vector3();this.velocity=new THREE.Vector3();this.collisionOffset=new THREE.Vector3();this.collisionVelocity=new THREE.Vector3();
    this.mass=spec.style==='rally'?1.12:spec.style==='formula'?.96:1.05;this.raceTopSpeed=RACE_TOP_SPEED;this.rideHeight=-.17;this.yaw=0;this.speed=0;this.boost=1;this.boosting=false;this.gear=1;
    this.tmpPoint=new THREE.Vector3();this.tmpTangent=new THREE.Vector3();this.tmpAhead=new THREE.Vector3();this.tmpNormal=new THREE.Vector3();this.tmpForward=new THREE.Vector3();this.tmpRight=new THREE.Vector3();this.poseForward=new THREE.Vector3();this.poseRight=new THREE.Vector3();this.poseUp=new THREE.Vector3();this.poseMatrix=new THREE.Matrix4();this.poseQuaternion=new THREE.Quaternion();this.poseLeanQuaternion=new THREE.Quaternion();this.poseEuler=new THREE.Euler();
    this.trackT=(1-startOffset/game.track.length+1)%1;this.lap=-1;this.lastIndex=Math.floor(this.trackT*game.track.sampleCount);this.finished=false;this.finishTime=null;
    const difficulty=DIFFICULTIES[game.selectedDifficulty]||DIFFICULTIES.easy;
    this.aiSpeed=RACE_TOP_SPEED;this.aiTargetSpeed=RACE_TOP_SPEED;this.skill=difficulty.cornering;this.aggression=difficulty.aggression;
    this.aiCurvePenalty=difficulty.curvePenalty;this.aiMaxSlowdown=difficulty.maxSlowdown;this.aiAcceleration=difficulty.acceleration;this.aiBraking=difficulty.braking;
    this.placeOnTrack(this.trackT);
  }
  roadPitch(index){const t=this.game.track.tangents[index];return Math.atan2(t.y,Math.hypot(t.x,t.z));}
  applyRoadPose(index,steer=0,lean=0,roll=0,dt=.016){
    // Use the road only to determine the surface plane. The car's actual yaw
    // remains the forward direction. The previous implementation replaced the
    // player's heading with the centerline tangent, which made the body point in
    // a different direction while steering on climbs and descents.
    const trackForward=this.game.track.tangents[index];
    this.poseRight.set(trackForward.z,0,-trackForward.x);
    if(this.poseRight.lengthSq()<1e-7)this.poseRight.set(1,0,0);else this.poseRight.normalize();
    this.poseUp.crossVectors(trackForward,this.poseRight).normalize();
    if(this.poseUp.y<0)this.poseUp.multiplyScalar(-1);

    // Project the real driving heading onto the local road plane. This preserves
    // steering direction while still pitching and rolling the chassis with the
    // road surface.
    this.poseForward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
    this.poseForward.addScaledVector(this.poseUp,-this.poseForward.dot(this.poseUp));
    if(this.poseForward.lengthSq()<1e-7)this.poseForward.copy(trackForward);else this.poseForward.normalize();
    this.poseRight.crossVectors(this.poseUp,this.poseForward).normalize();
    this.poseUp.crossVectors(this.poseForward,this.poseRight).normalize();
    this.poseMatrix.makeBasis(this.poseRight,this.poseUp,this.poseForward);
    this.poseQuaternion.setFromRotationMatrix(this.poseMatrix);
    this.poseEuler.set(lean,0,roll,'XYZ');this.poseLeanQuaternion.setFromEuler(this.poseEuler);
    this.poseQuaternion.multiply(this.poseLeanQuaternion);
    this.mesh.quaternion.slerp(this.poseQuaternion,clamp(dt*14,0,1));
  }
  placeOnTrack(t){
    const p=this.game.track.samplePoint(t,this.tmpPoint),tan=this.game.track.sampleTangent(t,this.tmpTangent),n=this.tmpNormal.set(-tan.z,0,tan.x).normalize();
    this.position.copy(p).addScaledVector(n,this.lane);this.position.y=p.y+this.rideHeight;this.mesh.position.copy(this.position);this.yaw=Math.atan2(tan.x,tan.z);this.applyRoadPose(Math.floor(t*this.game.track.sampleCount),0,0,0,1);
  }
  updatePlayer(dt,input,raceActive){
    const forward=this.tmpForward.set(Math.sin(this.yaw),0,Math.cos(this.yaw)),right=this.tmpRight.set(forward.z,0,-forward.x);
    const keyboardSteer=(input.a?1:0)-(input.d?1:0),analogSteer=Math.abs(Number(input.steerAxis)||0)>.025?Number(input.steerAxis):keyboardSteer;
    const forwardSpeed=this.velocity.dot(forward),sideSpeed=this.velocity.dot(right),throttle=raceActive?(input.w?1:0):0,brake=raceActive?(input.s?1:0):0,steer=raceActive?clamp(analogSteer,-1,1):0;
    const speedAbs=Math.abs(forwardSpeed),speedRatio=clamp(speedAbs/this.raceTopSpeed,0,1.4),wantsBoost=raceActive&&input.shift&&this.boost>.015&&speedAbs>7;
    if(wantsBoost&&!this.boosting)this.game.audio.boost();this.boosting=wantsBoost;
    if(this.boosting)this.boost=Math.max(0,this.boost-dt*.22);else this.boost=Math.min(1,this.boost+dt*.095);
    const nearest=this.game.track.nearestIndex(this.position,this.lastIndex),offroad=nearest.distance>this.game.track.def.roadWidth*.53,maxSpeed=this.raceTopSpeed+(this.boosting?this.spec.boostPower:0);
    let accel=0;if(throttle){const headroom=clamp(1-speedAbs/maxSpeed,0,1);accel=this.spec.acceleration*1.18*Math.pow(headroom,.68);if(!offroad)accel+=(.038+.00062*speedAbs)*speedAbs;}if(brake)accel=forwardSpeed>1?-48:-this.spec.acceleration*.78;
    this.velocity.addScaledVector(forward,accel*dt);if(this.boosting)this.velocity.addScaledVector(forward,this.spec.boostPower*.92*dt);
    const reverseFactor=forwardSpeed<-.3?-1:1,steerAuthority=clamp(speedAbs/5,0,1)*lerp(1.05,.62,clamp(speedRatio,0,1)),driftRequested=this.boosting&&Math.abs(steer)>.1&&speedAbs>18;
    this.yaw+=steer*this.spec.turn*steerAuthority*reverseFactor*dt*(driftRequested?1.16:1);
    const grip=offroad?3.35:(driftRequested?1.35:this.spec.grip),targetSide=driftRequested?sideSpeed*.94:0;
    this.velocity.addScaledVector(right,(targetSide-sideSpeed)*clamp(grip*dt,0,1));
    const rolling=offroad?.085:(.038+.00062*speedAbs);this.velocity.multiplyScalar(Math.exp(-rolling*dt));if(offroad)this.velocity.multiplyScalar(Math.exp(-.18*dt));
    if(this.velocity.length()>maxSpeed)this.velocity.setLength(lerp(this.velocity.length(),maxSpeed,clamp(dt*2.4,0,1)));
    this.position.addScaledVector(this.velocity,dt);
    const snap=this.game.track.nearestIndex(this.position,this.lastIndex),center=this.game.track.samples[snap.index],normal=this.game.track.normals[snap.index],dx=this.position.x-center.x,dz=this.position.z-center.z,signed=dx*normal.x+dz*normal.z,hardLimit=this.game.track.def.roadWidth*.9;
    if(Math.abs(signed)>hardLimit){const push=Math.abs(signed)-hardLimit;this.position.addScaledVector(normal,-Math.sign(signed)*push*.82);this.velocity.multiplyScalar(.78);this.game.cameraShake=Math.max(this.game.cameraShake,.28);}
    this.position.y=lerp(this.position.y,center.y+this.rideHeight,clamp(dt*18,0,1));this.mesh.position.copy(this.position);
    this.applyRoadPose(snap.index,steer,(throttle-brake)*-.018,-steer*clamp(speedRatio,0,1)*.07,dt);
    this.animateVehicle(dt,forwardSpeed,steer);this.updateProgress(snap.index);this.speed=Math.max(0,forwardSpeed);this.gear=this.game.audio.update(clamp(speedAbs/this.raceTopSpeed,0,1.35),throttle,this.boosting,raceActive);
  }
  updateAI(dt,raceActive){
    if(!raceActive||this.finished){this.animateVehicle(dt,0,0);return;}
    const t=this.trackT,tan=this.game.track.sampleTangent(t,this.tmpTangent),tanAhead=this.game.track.sampleTangent(t+.011,this.tmpAhead),curve=Math.abs(tan.x*tanAhead.z-tan.z*tanAhead.x);
    // Every difficulty has the exact same straight-line cap as the player.
    // Difficulty now changes how much speed the AI carries through corners and
    // how quickly it recovers afterward, eliminating the old 150 km/h ceiling.
    const cornerLoss=clamp(curve*(this.aiCurvePenalty/Math.max(this.skill,.75)),0,this.aiMaxSlowdown);
    const target=this.aiSpeed*(1-cornerLoss),delta=target-this.speed,rate=delta>=0?this.aiAcceleration:this.aiBraking;
    this.speed+=clamp(delta,-rate*dt,rate*dt);this.speed=clamp(this.speed,0,this.aiSpeed);this.trackT+=this.speed*dt/this.game.track.length;
    if(this.trackT>=1){this.trackT-=1;this.lap++;if(this.lap>=LAPS_TO_WIN){this.finished=true;this.finishTime=this.game.raceTime;this.game.registerFinish(this);}}
    const p=this.game.track.samplePoint(this.trackT,this.tmpPoint),tng=this.game.track.sampleTangent(this.trackT,this.tmpTangent),n=this.tmpNormal.set(-tng.z,0,tng.x).normalize();
    const weave=Math.sin(this.trackT*TAU*3+this.aiIndex)*(.18+.16*this.aggression);
    this.collisionOffset.addScaledVector(this.collisionVelocity,dt);this.collisionVelocity.multiplyScalar(Math.exp(-1.25*dt));this.collisionOffset.multiplyScalar(Math.exp(-.38*dt));
    const lateral=this.collisionOffset.dot(n),maxLateral=this.game.track.def.roadWidth*.43;if(Math.abs(lateral)>maxLateral)this.collisionOffset.addScaledVector(n,-Math.sign(lateral)*(Math.abs(lateral)-maxLateral)*.55);
    this.position.copy(p).addScaledVector(n,this.lane+weave).add(this.collisionOffset);this.position.y=p.y+this.rideHeight;this.yaw=Math.atan2(tng.x,tng.z);this.velocity.copy(tng).multiplyScalar(this.speed).add(this.collisionVelocity);this.mesh.position.copy(this.position);
    const index=Math.floor(this.trackT*this.game.track.sampleCount),turnSign=Math.sign(tng.x*tanAhead.z-tng.z*tanAhead.x);this.applyRoadPose(index,0,0,-clamp(curve*2,0,.075)*turnSign,dt);this.animateVehicle(dt,this.speed,0);this.lastIndex=index;
  }
  animateVehicle(dt,forwardSpeed,steer){const spin=forwardSpeed*dt/Math.max(.25,this.spec.style==='formula'?.39:.4);this.mesh.userData.wheels.forEach((w,i)=>{w.rotation.x-=spin;if(i<2)w.rotation.y=lerp(w.rotation.y,-steer*.28,dt*9);});this.mesh.userData.flames.forEach((f,i)=>{f.material.opacity=lerp(f.material.opacity,this.boosting?.85:0,dt*12);f.scale.y=this.boosting?(1+Math.sin(performance.now()*.03+i)*.2):.3;});}
  updateProgress(index){const n=this.game.track.sampleCount;if(this.lastIndex>n*.82&&index<n*.18&&this.velocity.length()>3){this.lap++;if(this.lap>=LAPS_TO_WIN&&!this.finished){this.finished=true;this.finishTime=this.game.raceTime;this.game.registerFinish(this);this.game.finishRace();}else if(this.lap>=0)this.game.flashMessage(`LAP ${Math.min(this.lap+1,LAPS_TO_WIN)}`);}this.lastIndex=index;}
  progress(){return this.finished?LAPS_TO_WIN+1-(this.finishTime||99999)*.000001:this.lap+this.lastIndex/this.game.track.sampleCount;}
}

function trackPreviewSvg(track){
  const points=buildFlowingTrackPoints(expandTrackPoints(track.points,track.scaleXZ||1),track.flowCount||84,track.smoothingPasses??3,track.smoothingRadius??4).map(p=>({x:p.x,z:p.z}));
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const width=104,height=66,pad=7,scale=Math.min((width-pad*2)/(maxX-minX||1),(height-pad*2)/(maxZ-minZ||1));
  const mapped=points.map(p=>`${(pad+(p.x-minX)*scale).toFixed(1)},${(height-pad-(p.z-minZ)*scale).toFixed(1)}`);
  mapped.push(mapped[0]);
  const [sx,sy]=mapped[0].split(',');
  return `<svg class="track-preview" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${mapped.join(' ')}"></polyline><circle cx="${sx}" cy="${sy}" r="2.8"></circle></svg>`;
}


class NetworkRacer {
  constructor(game,data,lane=0,startOffset=0){
    this.game=game;this.network=true;this.networkId=data.id;this.name=data.name;this.player=false;this.spec=VEHICLES[data.vehicleIndex||0];
    this.mesh=createVehicle(this.spec,false,game.performanceMode||game.isMobile,data.customization);game.scene.add(this.mesh);
    this.position=new THREE.Vector3();this.targetPosition=new THREE.Vector3();this.velocity=new THREE.Vector3();this.targetVelocity=new THREE.Vector3();
    this.poseForward=new THREE.Vector3();this.poseRight=new THREE.Vector3();this.poseUp=new THREE.Vector3();this.poseMatrix=new THREE.Matrix4();this.poseQuaternion=new THREE.Quaternion();
    this.mass=this.spec.style==='rally'?1.12:this.spec.style==='formula'?.96:1.05;this.yaw=0;this.targetYaw=0;this.targetPitch=0;this.targetRoll=0;this.speed=0;this.lap=-1;this.finished=false;this.finishTime=null;this.boosting=false;
    this.trackT=(1-startOffset/game.track.length+1)%1;this.lastIndex=Math.floor(this.trackT*game.track.sampleCount);this.networkProgress=this.trackT;this.lastSnapshotAt=performance.now();
    const p=game.track.samplePoint(this.trackT),tan=game.track.sampleTangent(this.trackT),n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    this.position.copy(p).addScaledVector(n,lane);this.position.y=p.y-.17;this.targetPosition.copy(this.position);this.yaw=this.targetYaw=Math.atan2(tan.x,tan.z);this.mesh.position.copy(this.position);this.applyRoadPose(1);
  }
  applyRoadPose(dt){
    const index=Math.floor(((this.networkProgress%1+1)%1)*this.game.track.sampleCount),trackForward=this.game.track.tangents[index];
    this.poseRight.set(trackForward.z,0,-trackForward.x);if(this.poseRight.lengthSq()<1e-7)this.poseRight.set(1,0,0);else this.poseRight.normalize();
    this.poseUp.crossVectors(trackForward,this.poseRight).normalize();if(this.poseUp.y<0)this.poseUp.multiplyScalar(-1);
    this.poseForward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));this.poseForward.addScaledVector(this.poseUp,-this.poseForward.dot(this.poseUp));
    if(this.poseForward.lengthSq()<1e-7)this.poseForward.copy(trackForward);else this.poseForward.normalize();
    this.poseRight.crossVectors(this.poseUp,this.poseForward).normalize();this.poseUp.crossVectors(this.poseForward,this.poseRight).normalize();
    this.poseMatrix.makeBasis(this.poseRight,this.poseUp,this.poseForward);this.poseQuaternion.setFromRotationMatrix(this.poseMatrix);this.mesh.quaternion.slerp(this.poseQuaternion,clamp(dt*14,0,1));
  }
  applySnapshot(data){
    this.targetPosition.set(data.x,data.y,data.z);this.targetYaw=data.yaw;this.targetPitch=data.pitch||0;this.targetRoll=data.roll||0;this.speed=data.speed||0;this.lap=data.lap||0;this.networkProgress=Number.isFinite(data.progress)?data.progress:this.networkProgress;this.boosting=!!data.boosting;this.lastSnapshotAt=performance.now();
  }
  updateNetwork(dt){
    const alpha=1-Math.exp(-dt*11);this.position.lerp(this.targetPosition,alpha);this.mesh.position.copy(this.position);
    let dy=this.targetYaw-this.yaw;while(dy>Math.PI)dy-=TAU;while(dy<-Math.PI)dy+=TAU;this.yaw+=dy*alpha;
    this.applyRoadPose(dt);
    this.velocity.set(Math.sin(this.yaw)*this.speed,0,Math.cos(this.yaw)*this.speed);
    const spin=this.speed*dt/.4;this.mesh.userData.wheels.forEach(w=>w.rotation.x-=spin);
  }
  progress(){return this.networkProgress;}
}

class MultiplayerClient {
  constructor(game){
    this.game=game;this.socket=null;this.connected=false;this.selfId=null;this.username=localStorage.getItem('summitRushUsername')||'';this.rooms=[];this.room=null;this.ready=false;this.vehicleIndex=game.selectedVehicle;this.customization={...game.getCustomization()};this.currentRaceId=null;this.collisionSent=new Map();this.reconnectTimer=null;
    this.bind();this.connect();
  }
  bind(){
    const u=this.game.ui;
    u.confirmUsername?.addEventListener('click',()=>this.confirmUsername());
    u.multiplayerUsername?.addEventListener('keydown',e=>{if(e.key==='Enter')this.confirmUsername();});
    u.hostRoom?.addEventListener('click',()=>this.send({type:'create_room'}));
    u.roomList?.addEventListener('click',e=>{const button=e.target.closest('[data-room-id]');if(button)this.send({type:'join_room',roomId:button.dataset.roomId});});
    u.leaveRoom?.addEventListener('click',()=>this.leaveRoom());
    u.changeLobbyTrack?.addEventListener('click',()=>{if(this.isHost()&&this.room?.state==='lobby')u.lobbyTrackPicker.classList.toggle('hidden');});
    u.lobbyTrackPicker?.addEventListener('click',e=>{const option=e.target.closest('[data-track-index]');if(option)this.send({type:'set_track',trackIndex:+option.dataset.trackIndex});});
    u.lobbyDifficultyCards?.addEventListener('click',e=>{const option=e.target.closest('[data-lobby-difficulty]');if(option&&this.isHost()&&this.room?.state==='lobby')this.send({type:'set_difficulty',difficulty:option.dataset.lobbyDifficulty});});
    u.lobbyVehicles?.addEventListener('click',e=>{const card=e.target.closest('[data-vehicle-index]');if(card)this.selectVehicle(+card.dataset.vehicleIndex);});
    u.lobbyColorPresets?.addEventListener('click',e=>{const button=e.target.closest('[data-color-preset]');if(button){const preset=COLOR_PRESETS[+button.dataset.colorPreset];this.customization={...this.customization,bodyColor:preset.body,trimColor:preset.trim,wheelColor:preset.wheel};this.pushPlayerUpdate();}});
    u.lobbyBodyColor?.addEventListener('input',e=>{this.customization={...this.customization,bodyColor:e.target.value};this.pushPlayerUpdate();});
    u.ready?.addEventListener('click',()=>{if(this.room?.state!=='lobby')return;this.ready=!this.ready;this.send({type:'ready',ready:this.ready});this.renderLobby();});
    u.multiplayerNext?.addEventListener('click',()=>this.game.returnToMultiplayerLobby());
  }
  connect(){
    clearTimeout(this.reconnectTimer);const protocol=location.protocol==='https:'?'wss':'ws';
    try{this.socket=new WebSocket(`${protocol}://${location.host}/__summit/ws`);}catch{return this.setStatus('SERVER ERROR','error');}
    this.setStatus('CONNECTING');
    this.socket.addEventListener('open',()=>{this.connected=true;this.setStatus('LAN SERVER CONNECTED','connected');if(this.username)this.send({type:'hello',name:this.username});});
    this.socket.addEventListener('message',event=>this.onMessage(event.data));
    this.socket.addEventListener('close',()=>{this.connected=false;this.setStatus('RECONNECTING','error');this.reconnectTimer=setTimeout(()=>this.connect(),1800);});
    this.socket.addEventListener('error',()=>this.setStatus('SERVER ERROR','error'));
  }
  setStatus(text,kind=''){const el=this.game.ui.multiConnectionStatus;if(!el)return;el.textContent=text;el.className=`connection-pill ${kind}`;}
  send(message){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
  enter(){
    this.game.showScreen('multiplayer');
    const u=this.game.ui;u.multiplayerUsername.value=this.username;
    if(this.username){u.multiUsernameStage.classList.add('hidden');u.multiRoomsStage.classList.remove('hidden');if(this.connected)this.send({type:'hello',name:this.username});this.renderRooms();}
    else{u.multiUsernameStage.classList.remove('hidden');u.multiRoomsStage.classList.add('hidden');setTimeout(()=>u.multiplayerUsername.focus(),100);}
  }
  confirmUsername(){const value=(this.game.ui.multiplayerUsername.value||'').replace(/[<>]/g,'').trim().slice(0,16);if(!value){this.game.ui.multiplayerUsername.focus();return;}this.username=value;localStorage.setItem('summitRushUsername',value);this.game.ui.multiUsernameStage.classList.add('hidden');this.game.ui.multiRoomsStage.classList.remove('hidden');this.send({type:'hello',name:value});this.renderRooms();}
  onMessage(raw){let data;try{data=JSON.parse(raw);}catch{return;}
    if(data.type==='hello'){this.selfId=data.id;this.rooms=data.rooms||[];this.renderRooms();}
    else if(data.type==='room_list'){this.rooms=data.rooms||[];this.renderRooms();}
    else if(data.type==='joined_room'){this.selfId=data.selfId;this.room=data.room;this.ready=false;this.game.state='multiplayer_menu';this.game.showScreen('lobby');this.renderLobby();}
    else if(data.type==='room_state'){this.room=data.room;if(!this.game.multiplayerMode){this.game.state='multiplayer_menu';this.game.showScreen('lobby');this.renderLobby();}}
    else if(data.type==='left_room'){this.room=null;this.ready=false;this.game.showScreen('multiplayer');this.renderRooms();}
    else if(data.type==='race_start'){this.room=data.room;this.currentRaceId=data.raceId;const included=data.players?.some(p=>p.id===this.selfId);if(included)this.game.startMultiplayerRace(data);else this.renderLobby();}
    else if(data.type==='snapshot')this.game.applyNetworkSnapshot(data);
    else if(data.type==='collision')this.game.applyNetworkCollision(data);
    else if(data.type==='driver_finished'){if(this.game.multiplayerMode&&data.id!==this.selfId)this.game.flashMessage(`${data.name} FINISHED`,900);}
    else if(data.type==='race_results')this.game.showMultiplayerResults(data.results||[]);
    else if(data.type==='error'){this.game.flashMessage(data.message||'MULTIPLAYER ERROR',1500);}
  }
  renderRooms(){
    const u=this.game.ui;if(!u.roomList)return;u.roomList.innerHTML=this.rooms.map(room=>`<article class="room-card ${room.state==='racing'?'racing':''}"><div><div class="room-meta"><span>${room.id}</span><span class="room-status">${room.state==='racing'?'RACE IN PROGRESS':'OPEN PADDOCK'}</span></div><h4>${room.name}</h4><p>${TRACKS[room.trackIndex]?.name||'Circuit'} · ${(DIFFICULTIES[room.difficulty]||DIFFICULTIES.easy).name} AI · ${room.playerCount}/${room.maxPlayers} drivers</p></div><button type="button" data-room-id="${room.id}">${room.state==='racing'?'WAIT':'JOIN'}</button></article>`).join('');u.roomEmpty.classList.toggle('hidden',this.rooms.length>0);
  }
  isHost(){return !!this.room&&this.room.hostId===this.selfId;}
  selfPlayer(){return this.room?.players?.find(p=>p.id===this.selfId);}
  selectVehicle(index){this.vehicleIndex=clamp(index,0,VEHICLES.length-1);this.customization={...this.game.getCustomization(VEHICLES[this.vehicleIndex]),bodyColor:this.customization.bodyColor};this.pushPlayerUpdate();}
  pushPlayerUpdate(){this.send({type:'update_player',vehicleIndex:this.vehicleIndex,customization:this.customization});this.renderLobby();}
  renderLobby(){
    const room=this.room,u=this.game.ui;if(!room||!u.lobbyRoomName)return;const self=this.selfPlayer();if(self){this.vehicleIndex=self.vehicleIndex;this.customization={...self.customization};this.ready=!!self.ready;}
    const track=TRACKS[room.trackIndex]||TRACKS[0],host=this.isHost(),racing=room.state==='racing';
    u.lobbyRoomName.textContent=room.name;u.lobbyRoomCode.textContent=room.id;u.lobbyRoomState.textContent=racing?'RACE IN PROGRESS — NEXT GRID OPEN':room.players.length<2?'WAITING FOR MORE DRIVERS':'READY CHECK';u.lobbyTrackName.textContent=track.name;u.lobbyTrackPreview.innerHTML=trackPreviewSvg(track);
    u.changeLobbyTrack.disabled=!host||racing;u.changeLobbyTrack.textContent=host?'CHANGE':'HOST SELECTS';if(!host)u.lobbyTrackPicker.classList.add('hidden');
    u.lobbyTrackPicker.innerHTML=TRACKS.map((t,i)=>`<button type="button" class="lobby-track-option ${i===room.trackIndex?'selected':''}" data-track-index="${i}"><span>${t.subtitle}</span><strong>${t.name}</strong>${trackPreviewSvg(t)}</button>`).join('');
    const roomDifficulty=DIFFICULTIES[room.difficulty]||DIFFICULTIES.easy;
    if(u.lobbyDifficultyName)u.lobbyDifficultyName.textContent=roomDifficulty.name;
    if(u.lobbyDifficultyHint)u.lobbyDifficultyHint.textContent=roomDifficulty.id==='easy'?'Same top speed · earlier braking':roomDifficulty.id==='medium'?'Same top speed · stronger corner pace':'Same top speed · latest braking';
    if(u.lobbyDifficultyCards)u.lobbyDifficultyCards.innerHTML=Object.values(DIFFICULTIES).map(d=>`<button type="button" class="lobby-difficulty-card ${d.id===roomDifficulty.id?'selected':''}" data-lobby-difficulty="${d.id}" ${!host||racing?'disabled':''}><strong>${d.name}</strong><span>${d.id==='easy'?'Relaxed AI':d.id==='medium'?'Competitive AI':'Fastest AI'}</span></button>`).join('');
    u.lobbyVehicles.innerHTML=VEHICLES.map((v,i)=>`<button type="button" class="lobby-vehicle-card ${i===this.vehicleIndex?'selected':''}" data-vehicle-index="${i}"><small>${v.class.toUpperCase()}</small><strong>${v.name}</strong></button>`).join('');
    u.lobbyColorPresets.innerHTML=COLOR_PRESETS.map((p,i)=>`<button type="button" class="lobby-color-preset" data-color-preset="${i}" style="--paint:${p.body}" aria-label="${p.name}"></button>`).join('');u.lobbyBodyColor.value=this.customization.bodyColor||'#ff4e1f';
    u.lobbyPlayerCount.textContent=`${room.players.length} / 12`;u.lobbyPlayerList.innerHTML=room.players.map(p=>`<div class="lobby-player-row ${p.ready?'ready':''} ${p.host?'host':''}"><i class="player-color-swatch" style="--player-color:${p.customization?.bodyColor||'#ff4e1f'}"></i><div><strong>${p.name}${p.id===this.selfId?' · YOU':''}</strong><span>${VEHICLES[p.vehicleIndex]?.name||'Vortex GT'}${p.host?' · HOST':''}</span></div><em>${racing&&p.waiting?'NEXT RACE':p.ready?'READY':'SETTING UP'}</em></div>`).join('');
    u.ready.disabled=racing;u.ready.classList.toggle('ready',this.ready&&!racing);u.ready.querySelector('span').textContent=racing?'RACE RUNNING':this.ready?'READY — TAP TO CANCEL':'READY UP';u.raceInProgressNotice.classList.toggle('hidden',!racing);
  }
  leaveRoom(){if(this.game.multiplayerMode)this.game.exitMultiplayerRace();this.send({type:'leave_room'});this.room=null;this.ready=false;this.game.showScreen('multiplayer');this.renderRooms();}
  sendSnapshot(racer){if(!this.currentRaceId)return;this.send({type:'snapshot',raceId:this.currentRaceId,x:racer.position.x,y:racer.position.y,z:racer.position.z,yaw:racer.yaw,pitch:racer.mesh.rotation.x,roll:racer.mesh.rotation.z,speed:racer.speed,lap:racer.lap,progress:racer.progress(),boosting:racer.boosting});}
  sendCollision(targetId,impulse){const now=performance.now(),last=this.collisionSent.get(targetId)||0;if(now-last<90)return;this.collisionSent.set(targetId,now);this.send({type:'collision',raceId:this.currentRaceId,targetId,impulse:{x:impulse.x,z:impulse.z}});}
  sendFinish(time){this.send({type:'finish',raceId:this.currentRaceId,time});}
}

class Game {
  constructor(){
    this.canvas=document.querySelector('#gameCanvas');
    this.profile=DEVICE_PROFILE;this.isMobile=this.profile.isMobile;this.performanceMode=this.profile.performanceMode;document.body.classList.toggle('performance-mode',this.performanceMode);document.body.classList.toggle('touch-mode',this.isMobile);
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:!this.performanceMode&&!this.isMobile,powerPreference:'high-performance',alpha:false,stencil:false,preserveDrawingBuffer:false});
    this.renderScale=this.profile.maxRenderScale;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.renderScale));this.renderer.setSize(innerWidth,innerHeight,false);
    this.renderer.shadowMap.enabled=!this.performanceMode&&!this.isMobile;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=this.performanceMode?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
    this.showroomCanvas=document.querySelector('#showroomCanvas');this.showroomRenderer=new THREE.WebGLRenderer({canvas:this.showroomCanvas,antialias:!this.performanceMode,alpha:false,powerPreference:'high-performance',stencil:false,preserveDrawingBuffer:false});this.showroomRenderer.outputColorSpace=THREE.SRGBColorSpace;this.showroomRenderer.toneMapping=this.performanceMode?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;this.showroomRenderer.toneMappingExposure=1.08;this.showroomRenderer.shadowMap.enabled=!this.performanceMode;this.showroomRenderer.shadowMap.type=THREE.PCFShadowMap;
    this.camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,this.performanceMode?760:1200);this.showroomCamera=new THREE.PerspectiveCamera(44,1,.1,80);this.showroomScene=null;
    this.clock=new THREE.Clock();this.textures=createTextures();this.audio=new AudioSystem();this.input={w:false,a:false,s:false,d:false,shift:false,steerAxis:0};
    this.storage=this.loadStorage();this.selectedVehicle=0;this.selectedTrack=0;this.selectedDifficulty=this.storage.difficulty||'easy';this.steeringMode=localStorage.getItem('summitRushSteeringMode')==='arrows'?'arrows':'joystick';this.releaseSteeringJoystick=null;
    this.state='loading';this.multiplayerMode=false;this.lanMultiplayerAvailable=false;this.currentRaceId=null;this.networkRacers=new Map();this.networkSendTimer=0;this.scene=null;this.previewCar=null;this.track=null;this.player=null;this.racers=[];this.finishers=[];this.raceTime=0;this.countdown=0;this.cameraShake=0;this.menuOrbit=0;this.hudTimer=0;this.boostFxState=false;
    this.frameInterval=1000/this.profile.targetFps;this.lastFrameStamp=0;this.resizeQueued=false;this.perfFrames=0;this.perfElapsed=0;this.minimapStatic=null;this.minimapMetrics=null;
    this.tmpForward=new THREE.Vector3();this.tmpDesired=new THREE.Vector3();this.tmpLook=new THREE.Vector3();this.tmpImpulseTangent=new THREE.Vector3();this.tmpCollisionNormal=new THREE.Vector3();this.tmpRelativeVelocity=new THREE.Vector3();this.tmpCollisionTangent=new THREE.Vector3();
    this.ui=this.bindUI();this.setSteeringMode(this.steeringMode,false);this.buildMenuCards();this.bindEvents();this.buildMenuScene();this.loadNetworkInfo();this.multiplayer=new MultiplayerClient(this);
    setTimeout(()=>{this.ui.loading.classList.add('hidden');this.state='home';},650);this.animate();
  }
  bindUI(){
    const $=s=>document.querySelector(s);
    return {
      home:$('#homeScreen'),mainMenu:$('#mainMenu'),multiplayerScreen:$('#multiplayerScreen'),multiplayerLobby:$('#multiplayerLobby'),hud:$('#hud'),pauseMenu:$('#pauseMenu'),resultsMenu:$('#resultsMenu'),loading:$('#loading'),
      singlePlayer:$('#singlePlayerButton'),multiplayerButton:$('#multiplayerButton'),singleBack:$('#singleBackButton'),multiBack:$('#multiBackButton'),
      vehicleCards:$('#vehicleCards'),trackCards:$('#trackCards'),difficultyCards:$('#difficultyCards'),start:$('#startRaceButton'),resume:$('#resumeButton'),restart:$('#restartButton'),quit:$('#quitButton'),raceAgain:$('#raceAgainButton'),garage:$('#garageButton'),multiplayerNext:$('#multiplayerNextButton'),
      menuWins:$('#menuWins'),menuRaces:$('#menuRaces'),position:$('#positionText'),lap:$('#lapText'),time:$('#raceTimeText'),speed:$('#speedText'),gear:$('#gearText'),boostFill:$('#boostFill'),boostLabel:$('#boostLabel'),trackName:$('#trackNameHud'),
      startLights:$('#startLights'),lightRig:document.querySelector('.light-rig'),countdown:$('#countdownText'),message:$('#raceMessage'),speedFx:$('#speedFx'),mobileControls:$('#mobileControls'),racePause:$('#racePauseButton'),steeringJoystick:$('#steeringJoystick'),steeringArrows:$('#steeringArrows'),joystickThumb:$('#joystickThumb'),steeringModeJoystick:$('#steeringModeJoystick'),steeringModeArrows:$('#steeringModeArrows'),multiplayerRaceLabel:$('#multiplayerRaceLabel'),multiplayerRaceRoom:$('#multiplayerRaceRoom'),
      resultEyebrow:$('#resultEyebrow'),resultTitle:$('#resultTitle'),resultPosition:$('#resultPosition'),resultTime:$('#resultTime'),resultWins:$('#resultWins'),resultThirdLabel:$('#resultThirdLabel'),standings:$('#standings'),minimap:$('#minimap'),
      bodyColor:$('#bodyColor'),trimColor:$('#trimColor'),wheelColor:$('#wheelColor'),presetColors:$('#presetColors'),rimOptions:$('#rimOptions'),showroomName:$('#showroomName'),showroomClass:$('#showroomClass'),showroomCanvas:$('#showroomCanvas'),
      phoneConnectCard:$('#phoneConnectCard'),phoneConnectStatus:$('#phoneConnectStatus'),phoneUrl:$('#phoneUrl'),phoneHint:$('#phoneHint'),copyPhoneUrl:$('#copyPhoneUrl'),homePhoneUrl:$('#homePhoneUrl'),homePhoneHint:$('#homePhoneHint'),
      multiConnectionStatus:$('#multiConnectionStatus'),multiUsernameStage:$('#multiUsernameStage'),multiRoomsStage:$('#multiRoomsStage'),multiplayerUsername:$('#multiplayerUsername'),confirmUsername:$('#confirmUsernameButton'),hostRoom:$('#hostRoomButton'),roomList:$('#roomList'),roomEmpty:$('#roomEmpty'),leaveRoom:$('#leaveRoomButton'),
      lobbyRoomName:$('#lobbyRoomName'),lobbyRoomCode:$('#lobbyRoomCode'),lobbyRoomState:$('#lobbyRoomState'),lobbyTrackName:$('#lobbyTrackName'),lobbyTrackPreview:$('#lobbyTrackPreview'),changeLobbyTrack:$('#changeLobbyTrackButton'),lobbyTrackPicker:$('#lobbyTrackPicker'),lobbyDifficultyName:$('#lobbyDifficultyName'),lobbyDifficultyHint:$('#lobbyDifficultyHint'),lobbyDifficultyCards:$('#lobbyDifficultyCards'),lobbyVehicles:$('#lobbyVehicleCards'),lobbyColorPresets:$('#lobbyColorPresets'),lobbyBodyColor:$('#lobbyBodyColor'),ready:$('#readyButton'),raceInProgressNotice:$('#raceInProgressNotice'),lobbyPlayerCount:$('#lobbyPlayerCount'),lobbyPlayerList:$('#lobbyPlayerList')
    };
  }
  loadStorage(){
    const base={wins:0,races:0,best:{},difficulty:'easy',customizations:{}};
    try{const data=JSON.parse(localStorage.getItem('summitRushCareer'))||{};return {...base,...data,best:data.best||{},customizations:data.customizations||{}};}catch{return base;}
  }
  saveStorage(){this.storage.difficulty=this.selectedDifficulty;localStorage.setItem('summitRushCareer',JSON.stringify(this.storage));this.updateCareerUI();}
  colorHex(value){return typeof value==='string'?value:`#${Number(value).toString(16).padStart(6,'0')}`;}
  getCustomization(spec=VEHICLES[this.selectedVehicle]){
    const saved=this.storage.customizations[spec.id]||{};
    return {bodyColor:saved.bodyColor||this.colorHex(spec.color),trimColor:saved.trimColor||this.colorHex(spec.accent),wheelColor:saved.wheelColor||'#bfc4ca',rimStyle:saved.rimStyle||'five'};
  }
  setCustomization(patch){
    const spec=VEHICLES[this.selectedVehicle],next={...this.getCustomization(spec),...patch};this.storage.customizations[spec.id]=next;this.saveStorage();this.syncCustomizationUI();this.replacePreviewCar();
  }
  updateCareerUI(){this.ui.menuWins.textContent=`${this.storage.wins} WIN${this.storage.wins===1?'':'S'}`;this.ui.menuRaces.textContent=`${this.storage.races} races completed`;}
  buildMenuCards(){
    this.ui.vehicleCards.innerHTML=VEHICLES.map((v,i)=>`<article class="choice-card vehicle-card ${i===this.selectedVehicle?'selected':''}" data-index="${i}"><div class="card-kicker">${v.class}</div><h3>${v.name}</h3><p>${v.description}</p><div class="stat-row">${Object.entries(v.stats).map(([k,val])=>`<div><label>${k.toUpperCase()}</label><div class="stat-bar"><i style="width:${val}%"></i></div></div>`).join('')}</div></article>`).join('');
    this.ui.trackCards.innerHTML=TRACKS.map((t,i)=>`<article class="choice-card track-card ${i===this.selectedTrack?'selected':''}" data-index="${i}"><div class="card-kicker">${t.difficulty} · ${t.subtitle}</div><h3>${t.name}</h3><p>${t.description}</p>${trackPreviewSvg(t)}<b class="track-badge">${t.badge}</b></article>`).join('');
    this.ui.difficultyCards.innerHTML=Object.values(DIFFICULTIES).map(d=>`<button type="button" class="difficulty-card ${d.id===this.selectedDifficulty?'selected':''}" data-difficulty="${d.id}"><strong>${d.name}</strong><span>${d.description}</span></button>`).join('');
    this.ui.presetColors.innerHTML=COLOR_PRESETS.map((p,i)=>`<button type="button" class="paint-preset" data-preset="${i}" title="${p.name}" aria-label="${p.name}" style="--paint:${p.body};--trim:${p.trim};--wheel:${p.wheel}"></button>`).join('');
    this.ui.rimOptions.innerHTML=RIM_STYLES.map(r=>`<button type="button" class="rim-option" data-rim="${r.id}"><i class="rim-icon rim-${r.id}"></i><span>${r.name}</span></button>`).join('');
    this.ui.vehicleCards.querySelectorAll('.choice-card').forEach(el=>el.addEventListener('click',()=>{this.selectedVehicle=+el.dataset.index;this.buildMenuCards();this.replacePreviewCar();}));
    this.ui.trackCards.querySelectorAll('.choice-card').forEach(el=>el.addEventListener('click',()=>{this.selectedTrack=+el.dataset.index;this.buildMenuCards();}));
    this.ui.difficultyCards.querySelectorAll('[data-difficulty]').forEach(el=>el.addEventListener('click',()=>{this.selectedDifficulty=el.dataset.difficulty;this.saveStorage();this.buildMenuCards();}));
    this.ui.presetColors.querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('click',()=>{const p=COLOR_PRESETS[+el.dataset.preset];this.setCustomization({bodyColor:p.body,trimColor:p.trim,wheelColor:p.wheel});}));
    this.ui.rimOptions.querySelectorAll('[data-rim]').forEach(el=>el.addEventListener('click',()=>this.setCustomization({rimStyle:el.dataset.rim})));
    this.syncCustomizationUI();this.updateCareerUI();
  }
  syncCustomizationUI(){
    const spec=VEHICLES[this.selectedVehicle],c=this.getCustomization(spec);if(!this.ui.bodyColor)return;
    this.ui.bodyColor.value=this.colorHex(c.bodyColor);this.ui.trimColor.value=this.colorHex(c.trimColor);this.ui.wheelColor.value=this.colorHex(c.wheelColor);this.ui.showroomName.textContent=spec.name;this.ui.showroomClass.textContent=`${spec.class.toUpperCase()} · CUSTOM BUILD`;
    this.ui.rimOptions?.querySelectorAll('[data-rim]').forEach(el=>el.classList.toggle('selected',el.dataset.rim===c.rimStyle));
  }
  setMultiplayerAvailability(available,message){
    this.lanMultiplayerAvailable=Boolean(available);
    const button=this.ui.multiplayerButton,availability=document.getElementById('multiplayerAvailability');
    if(button){
      button.disabled=!this.lanMultiplayerAvailable;
      button.setAttribute('aria-disabled',String(!this.lanMultiplayerAvailable));
      button.classList.toggle('lan-ready',this.lanMultiplayerAvailable);
      button.classList.toggle('hosted-disabled',!this.lanMultiplayerAvailable);
      button.title=this.lanMultiplayerAvailable?'Open LAN multiplayer':(message||'LAN multiplayer requires the local Summit Rush server.');
    }
    if(availability)availability.textContent=message||(this.lanMultiplayerAvailable?'LAN server online':'Unavailable on hosted build');
  }
  async loadNetworkInfo(){
    if(!this.ui.phoneUrl&&!this.ui.homePhoneUrl)return;
    this.setMultiplayerAvailability(false,'Checking LAN server…');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),2200);
    try{
      const response=await fetch('/__summit/network.json',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const info=await response.json();
      if(info?.websocket!==true)throw new Error('LAN WebSocket server unavailable');
      const isLoopback=['localhost','127.0.0.1','::1'].includes(location.hostname);
      const best=info.lanUrls?.[0]?.url,displayUrl=isLoopback?(best||info.localUrl||location.href):location.href;
      this.setMultiplayerAvailability(true,'LAN server online — host or join');
      this.ui.phoneConnectCard?.classList.add('connected');
      this.ui.phoneConnectStatus.textContent=isLoopback?'READY ON SAME WI-FI':'PHONE CONNECTED';
      this.ui.phoneUrl.textContent=displayUrl;if(this.ui.homePhoneUrl)this.ui.homePhoneUrl.textContent=displayUrl;
      this.ui.phoneHint.textContent=isLoopback?'Type this address into Safari or Chrome on your phone.':'You are playing over the local Wi-Fi server.';
      if(this.ui.homePhoneHint)this.ui.homePhoneHint.textContent=isLoopback?'Friends on the same Wi-Fi open this address, then choose Multiplayer.':'This device is connected to the Summit Rush LAN server.';
      if(this.ui.copyPhoneUrl){this.ui.copyPhoneUrl.disabled=false;this.ui.copyPhoneUrl.textContent=isLoopback?'COPY':'CONNECTED';}
    }catch(error){
      const hosted=location.protocol==='https:'||(!['localhost','127.0.0.1','::1'].includes(location.hostname)&&!/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname));
      this.setMultiplayerAvailability(false,hosted?'Hosted demo — LAN launcher required':'Start the local server to enable');
      this.ui.phoneConnectStatus.textContent=hosted?'HOSTED SINGLE PLAYER':'LOCAL SERVER OFFLINE';
      this.ui.phoneUrl.textContent=location.href;if(this.ui.homePhoneUrl)this.ui.homePhoneUrl.textContent=location.href;
      this.ui.phoneHint.textContent=hosted?'Single-player is available here. LAN multiplayer runs from start.command.':'Launch with start.command to expose the Wi-Fi address.';
      if(this.ui.homePhoneHint)this.ui.homePhoneHint.textContent=hosted?'Multiplayer is disabled on Vercel/GitHub hosting. Run the downloaded LAN server to host rooms.':'Launch with start.command to expose the Wi-Fi address.';
      if(this.ui.copyPhoneUrl)this.ui.copyPhoneUrl.disabled=true;
    }finally{clearTimeout(timeout);}
  }
  async copyPhoneAddress(){
    const value=this.ui.phoneUrl?.textContent?.trim();if(!value||!value.startsWith('http'))return;
    let copied=false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);copied=true;}}catch{}
    if(!copied){
      const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
      try{copied=document.execCommand('copy');}catch{}field.remove();
    }
    const prior=this.ui.copyPhoneUrl.textContent;this.ui.copyPhoneUrl.textContent=copied?'COPIED':'SELECT ADDRESS';
    if(!copied){const range=document.createRange();range.selectNodeContents(this.ui.phoneUrl);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
    setTimeout(()=>{if(this.ui.copyPhoneUrl)this.ui.copyPhoneUrl.textContent=prior;},1400);
  }
  scheduleResize(){if(this.resizeQueued)return;this.resizeQueued=true;requestAnimationFrame(()=>{this.resizeQueued=false;this.resize();});}
  setSteeringMode(mode,persist=true){
    this.steeringMode=mode==='arrows'?'arrows':'joystick';
    document.body.classList.toggle('steering-arrows-mode',this.steeringMode==='arrows');
    document.body.classList.toggle('steering-joystick-mode',this.steeringMode==='joystick');
    this.ui.steeringModeJoystick?.classList.toggle('selected',this.steeringMode==='joystick');
    this.ui.steeringModeArrows?.classList.toggle('selected',this.steeringMode==='arrows');
    this.ui.steeringModeJoystick?.setAttribute('aria-pressed',String(this.steeringMode==='joystick'));
    this.ui.steeringModeArrows?.setAttribute('aria-pressed',String(this.steeringMode==='arrows'));
    if(persist)localStorage.setItem('summitRushSteeringMode',this.steeringMode);
    this.resetInputs();
  }
  bindEvents(){
    addEventListener('resize',()=>this.scheduleResize(),{passive:true});
    addEventListener('orientationchange',()=>setTimeout(()=>this.scheduleResize(),120),{passive:true});
    window.visualViewport?.addEventListener('resize',()=>this.scheduleResize(),{passive:true});
    document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
    document.addEventListener('touchmove',e=>{if(document.body.classList.contains('race-mode'))e.preventDefault();},{passive:false});
    addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d'].includes(k))this.input[k]=true;if(e.key==='Shift')this.input.shift=true;if(e.key==='Escape'){e.preventDefault();this.togglePause();}});
    addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(['w','a','s','d'].includes(k))this.input[k]=false;if(e.key==='Shift')this.input.shift=false;});
    addEventListener('blur',()=>{this.resetInputs();if(this.state==='racing')this.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='racing')this.pause();});
    this.ui.singlePlayer?.addEventListener('click',()=>this.showSinglePlayerMenu());this.ui.multiplayerButton?.addEventListener('click',()=>{if(!this.lanMultiplayerAvailable){this.flashMessage('LAN MULTIPLAYER REQUIRES THE LOCAL SERVER',1500);return;}this.multiplayer.enter();});this.ui.singleBack?.addEventListener('click',()=>this.showHome());this.ui.multiBack?.addEventListener('click',()=>this.showHome());
    this.ui.start.addEventListener('click',()=>{this.audio.init();this.startRace();});this.ui.resume.addEventListener('click',()=>this.resume());this.ui.restart.addEventListener('click',()=>this.multiplayerMode?this.returnToMultiplayerLobby():this.startRace());this.ui.quit.addEventListener('click',()=>this.multiplayerMode?this.multiplayer.leaveRoom():this.returnToMenu());this.ui.raceAgain.addEventListener('click',()=>this.startRace());this.ui.garage.addEventListener('click',()=>this.returnToMenu());this.ui.racePause?.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.togglePause();},{passive:false});
    this.ui.copyPhoneUrl?.addEventListener('click',()=>this.copyPhoneAddress());
    this.ui.bodyColor?.addEventListener('input',e=>this.setCustomization({bodyColor:e.target.value}));this.ui.trimColor?.addEventListener('input',e=>this.setCustomization({trimColor:e.target.value}));this.ui.wheelColor?.addEventListener('input',e=>this.setCustomization({wheelColor:e.target.value}));
    this.ui.steeringModeJoystick?.addEventListener('click',()=>this.setSteeringMode('joystick'));
    this.ui.steeringModeArrows?.addEventListener('click',()=>this.setSteeringMode('arrows'));
    this.bindTouchControls();
  }
  bindTouchControls(){
    if(!this.ui.mobileControls)return;
    const resetButton=(button,key,pointerId)=>{if(pointerId!==undefined&&button.dataset.pointerId&&button.dataset.pointerId!==String(pointerId))return;delete button.dataset.pointerId;this.input[key]=false;button.classList.remove('pressed');};
    this.ui.mobileControls.querySelectorAll('[data-control]').forEach(button=>{
      const key=button.dataset.control;
      const press=e=>{e.preventDefault();e.stopPropagation();this.audio.init();button.dataset.pointerId=String(e.pointerId);this.input[key]=true;button.classList.add('pressed');button.setPointerCapture?.(e.pointerId);};
      const release=e=>{e.preventDefault();e.stopPropagation();resetButton(button,key,e.pointerId);};
      button.addEventListener('pointerdown',press,{passive:false});button.addEventListener('pointerup',release,{passive:false});button.addEventListener('pointercancel',release,{passive:false});button.addEventListener('lostpointercapture',e=>resetButton(button,key,e.pointerId));button.addEventListener('contextmenu',e=>e.preventDefault());
    });
    this.bindSteeringJoystick();
  }
  bindSteeringJoystick(){
    const zone=this.ui.steeringJoystick,ring=zone?.querySelector('.joystick-ring'),thumb=this.ui.joystickThumb;if(!zone||!ring||!thumb)return;
    let activeTouch=null,activePointer=null;
    const pointFromTouch=(list,id)=>{for(const touch of list)if(touch.identifier===id)return touch;return null;};
    const updatePoint=(clientX,clientY)=>{
      const rect=ring.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,max=Math.max(18,rect.width*.34),rawX=clientX-cx,rawY=clientY-cy,len=Math.hypot(rawX,rawY)||1,scale=Math.min(1,max/len),dx=rawX*scale,dy=rawY*scale;
      thumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
      const horizontal=clamp(dx/max,-1,1),dead=.08,magnitude=Math.max(0,(Math.abs(horizontal)-dead)/(1-dead));
      // Match the proven keyboard mapping exactly: left=A=+1, right=D=-1.
      this.input.steerAxis=-Math.sign(horizontal)*magnitude;
    };
    const release=()=>{activeTouch=null;activePointer=null;this.input.steerAxis=0;thumb.style.transform='translate(-50%,-50%)';};
    this.releaseSteeringJoystick=release;

    // Native touch events are used on phones because they remain reliable even
    // when Safari cancels or fails to retain pointer capture during a drag.
    zone.addEventListener('touchstart',e=>{if(activeTouch!==null)return;e.preventDefault();e.stopPropagation();this.audio.init();const touch=e.changedTouches[0];activeTouch=touch.identifier;updatePoint(touch.clientX,touch.clientY);},{passive:false});
    zone.addEventListener('touchmove',e=>{if(activeTouch===null)return;const touch=pointFromTouch(e.touches,activeTouch);if(!touch)return;e.preventDefault();e.stopPropagation();updatePoint(touch.clientX,touch.clientY);},{passive:false});
    zone.addEventListener('touchend',e=>{if(activeTouch===null)return;if(pointFromTouch(e.changedTouches,activeTouch)){e.preventDefault();e.stopPropagation();release();}},{passive:false});
    zone.addEventListener('touchcancel',e=>{if(activeTouch!==null){e.preventDefault();release();}},{passive:false});

    // Mouse and stylus support for testing and tablets. Touch pointers are ignored
    // here to avoid duplicate input alongside the native touch handlers above.
    zone.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;e.preventDefault();this.audio.init();activePointer=e.pointerId;zone.setPointerCapture?.(e.pointerId);updatePoint(e.clientX,e.clientY);},{passive:false});
    zone.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&e.pointerId===activePointer){e.preventDefault();updatePoint(e.clientX,e.clientY);}},{passive:false});
    zone.addEventListener('pointerup',e=>{if(e.pointerId===activePointer)release();},{passive:false});zone.addEventListener('pointercancel',e=>{if(e.pointerId===activePointer)release();},{passive:false});zone.addEventListener('lostpointercapture',e=>{if(e.pointerId===activePointer)release();});
  }
  resetInputs(){this.input.w=this.input.a=this.input.s=this.input.d=this.input.shift=false;this.input.steerAxis=0;this.releaseSteeringJoystick?.();this.ui.joystickThumb&&(this.ui.joystickThumb.style.transform='translate(-50%,-50%)');this.ui.mobileControls?.querySelectorAll('.pressed').forEach(button=>button.classList.remove('pressed'));}
  showScreen(name){
    [this.ui.home,this.ui.mainMenu,this.ui.multiplayerScreen,this.ui.multiplayerLobby].forEach(el=>el?.classList.remove('active'));
    if(name==='home')this.ui.home?.classList.add('active');else if(name==='single')this.ui.mainMenu?.classList.add('active');else if(name==='multiplayer')this.ui.multiplayerScreen?.classList.add('active');else if(name==='lobby')this.ui.multiplayerLobby?.classList.add('active');
  }
  showHome(){this.multiplayerMode=false;this.showScreen('home');this.state='home';document.body.classList.remove('race-mode');this.buildMenuScene();}
  showSinglePlayerMenu(){this.multiplayerMode=false;this.showScreen('single');this.state='menu';this.buildMenuCards();this.buildMenuScene();}
  disposeObject(root){if(!root)return;root.parent?.remove(root);root.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose?.());}});}
  clearScene(){if(!this.scene)return;this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose?.());}});this.scene.clear();this.minimapStatic=null;this.minimapMetrics=null;}
  clearShowroom(){if(!this.showroomScene)return;this.showroomScene.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose?.());}});this.showroomScene.clear();this.showroomScene=null;this.previewCar=null;}
  resizeShowroom(){if(!this.showroomCanvas||!this.showroomRenderer)return;const rect=this.showroomCanvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));this.showroomRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.isMobile?0.62:(this.performanceMode?0.82:1.25)));this.showroomRenderer.setSize(w,h,false);this.showroomCamera.aspect=w/h;this.showroomCamera.updateProjectionMatrix();}
  createBaseScene(){
    this.scene=new THREE.Scene();const hemi=new THREE.HemisphereLight(0xc9e3ff,0x27301d,2.25);this.scene.add(hemi);const sun=new THREE.DirectionalLight(0xfff1d6,this.performanceMode?2.55:3.05);sun.position.set(-75,110,-45);sun.castShadow=!this.performanceMode&&!this.isMobile;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-220;sun.shadow.camera.right=220;sun.shadow.camera.top=220;sun.shadow.camera.bottom=-220;sun.shadow.camera.near=1;sun.shadow.camera.far=380;sun.shadow.bias=-.00015;this.scene.add(sun);
  }
  buildMenuScene(){
    this.clearScene();this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x07090d);this.camera.position.set(0,2,8);this.camera.lookAt(0,1,0);this.buildShowroomScene();
  }
  buildShowroomScene(){
    this.clearShowroom();const scene=this.showroomScene=new THREE.Scene();scene.background=new THREE.Color(0x07090d);scene.fog=new THREE.Fog(0x07090d,18,44);
    const ambient=new THREE.HemisphereLight(0x8aa8c4,0x17110d,this.performanceMode?1.3:1.65);scene.add(ambient);
    const key=new THREE.SpotLight(0xff7a42,this.performanceMode?18:34,34,Math.PI*.22,.55,1.2);key.position.set(2.5,8,5);key.target.position.set(4,0,0);key.castShadow=!this.performanceMode;scene.add(key,key.target);
    const fill=new THREE.SpotLight(0x6db8ff,this.performanceMode?14:28,32,Math.PI*.24,.6,1.2);fill.position.set(9,6,-5);fill.target.position.set(4,1,0);scene.add(fill,fill.target);
    if(!this.performanceMode){const rim=new THREE.PointLight(0xffd29c,16,20,1.5);rim.position.set(4,3,-5);scene.add(rim);}
    const floorMat=this.performanceMode?new THREE.MeshLambertMaterial({map:this.textures.garageFloor,color:0xffffff}):new THREE.MeshStandardMaterial({map:this.textures.garageFloor,color:0xffffff,roughness:.55,metalness:.12});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,20),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=!this.performanceMode;scene.add(floor);
    const concrete=this.performanceMode?new THREE.MeshLambertMaterial({map:this.textures.concrete,color:0x5f6368}):new THREE.MeshStandardMaterial({map:this.textures.concrete,color:0x5f6368,roughness:.92});
    const metal=this.performanceMode?new THREE.MeshLambertMaterial({map:this.textures.metalPanel,color:0x323841}):new THREE.MeshStandardMaterial({map:this.textures.metalPanel,color:0x323841,metalness:.42,roughness:.48});
    const back=new THREE.Mesh(new THREE.BoxGeometry(28,11,.5),concrete);back.position.set(0,5.5,-7);scene.add(back);const side=new THREE.Mesh(new THREE.BoxGeometry(.5,11,22),metal);side.position.set(11,5.5,0);scene.add(side);const ceiling=new THREE.Mesh(new THREE.BoxGeometry(28,.35,22),metal);ceiling.position.y=9;scene.add(ceiling);
    const turnMat=this.performanceMode?new THREE.MeshLambertMaterial({color:0x24292f}):new THREE.MeshStandardMaterial({color:0x24292f,metalness:.6,roughness:.3});const turntable=new THREE.Mesh(new THREE.CylinderGeometry(4.25,4.4,.28,48),turnMat);turntable.position.set(3.5,.14,0);turntable.receiveShadow=!this.performanceMode;scene.add(turntable);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.85,.055,8,64),new THREE.MeshBasicMaterial({color:0xff5a1f}));ring.rotation.x=Math.PI/2;ring.position.set(3.5,.3,0);scene.add(ring);
    const cabinetMat=this.performanceMode?new THREE.MeshLambertMaterial({color:0xb72e22}):new THREE.MeshStandardMaterial({color:0xb72e22,metalness:.35,roughness:.4});
    for(let i=0;i<3;i++){const cabinet=new THREE.Group(),box=new THREE.Mesh(new THREE.BoxGeometry(2,3.2,1.1),cabinetMat);box.position.y=1.6;cabinet.add(box);for(let d=0;d<5;d++){const drawer=new THREE.Mesh(new THREE.BoxGeometry(1.7,.38,.07),metal);drawer.position.set(0,.5+d*.53,.59);cabinet.add(drawer);}cabinet.position.set(-7+i*2.25,0,-6.2);scene.add(cabinet);}
    const shelf=new THREE.Group(),postMat=new THREE.MeshStandardMaterial({color:0x181c21,metalness:.7,roughness:.35});[-2.7,2.7].forEach(x=>{const post=new THREE.Mesh(new THREE.BoxGeometry(.16,4.6,.2),postMat);post.position.set(x,2.3,0);shelf.add(post);});for(let y=.5;y<4.6;y+=1.1){const plank=new THREE.Mesh(new THREE.BoxGeometry(5.7,.12,1.35),metal);plank.position.y=y;shelf.add(plank);}shelf.position.set(-5.7,0,-5.8);scene.add(shelf);
    for(let i=0;i<4;i++){const tire=createWheel(.5,.32,0x3e444d,true,'five');tire.position.set(-7.4+i*1.12,.6,-5);tire.rotation.z=Math.PI/2;scene.add(tire);}
    const lightMat=new THREE.MeshStandardMaterial({color:0xe8f4ff,emissive:0xc8e8ff,emissiveIntensity:2.6});for(let x=-6;x<=8;x+=4.7){const bar=new THREE.Mesh(new THREE.BoxGeometry(3,.1,.28),lightMat);bar.position.set(x,8.75,-1.5);scene.add(bar);}
    this.replacePreviewCar();this.showroomCamera.position.set(9.5,3,8);this.showroomCamera.lookAt(3.2,1,0);requestAnimationFrame(()=>this.resizeShowroom());
  }
  replacePreviewCar(){if(!this.showroomScene)return;if(this.previewCar)this.disposeObject(this.previewCar);this.previewCar=createVehicle(VEHICLES[this.selectedVehicle],true,false,this.getCustomization());this.previewCar.position.set(3.5,.23,0);this.previewCar.rotation.y=-.65;this.showroomScene.add(this.previewCar);}
  startRace(){
    this.multiplayerMode=false;this.currentRaceId=null;this.networkRacers.clear();this.ui.raceAgain.classList.remove('hidden');this.ui.garage.classList.remove('hidden');this.ui.multiplayerNext.classList.add('hidden');this.ui.resultThirdLabel.textContent='CAREER WINS';this.ui.restart.classList.remove('hidden');this.ui.quit.textContent='RETURN TO GARAGE';this.ui.multiplayerRaceLabel.classList.add('hidden');
    this.resetInputs();document.body.classList.add('race-mode');this.ui.mobileControls?.classList.remove('controls-hidden');this.clearShowroom();this.clearScene();this.createBaseScene();this.track=new RaceTrack(this,TRACKS[this.selectedTrack]);this.prepareMinimap();this.racers=[];this.finishers=[];this.raceTime=0;this.cameraShake=0;
    const lanes=[0,-4.35,4.35],grid=[];for(let row=0;row<4;row++)for(let col=0;col<3;col++)grid.push({lane:lanes[col],offset:3+row*5.8+Math.abs(col-1)*1.35});
    this.player=new Racer(this,VEHICLES[this.selectedVehicle],'YOU',true,grid[0].lane,grid[0].offset,0);this.racers.push(this.player);
    for(let i=0;i<11;i++){const spec=VEHICLES[(this.selectedVehicle+i+1)%VEHICLES.length],g=grid[i+1];this.racers.push(new Racer(this,spec,AI_NAMES[i],false,g.lane,g.offset,i));}
    this.state='countdown';this.countdown=4.25;this.ui.mainMenu.classList.remove('active');this.ui.pauseMenu.classList.remove('active');this.ui.resultsMenu.classList.remove('active');this.ui.hud.classList.add('active');this.ui.startLights.classList.remove('hidden');this.ui.trackName.textContent=this.track.def.name.toUpperCase();this.ui.message.classList.remove('show');this.setCameraImmediate();
  }
  startMultiplayerRace(data){
    this.multiplayerMode=true;this.currentRaceId=data.raceId;this.selectedTrack=clamp(data.trackIndex||0,0,TRACKS.length-1);this.selectedDifficulty=DIFFICULTIES[data.difficulty]?.id||DIFFICULTIES[data.room?.difficulty]?.id||'easy';this.networkRacers.clear();this.resetInputs();document.body.classList.add('race-mode');this.ui.mobileControls?.classList.remove('controls-hidden');this.clearShowroom();this.clearScene();this.createBaseScene();this.track=new RaceTrack(this,TRACKS[this.selectedTrack]);this.prepareMinimap();this.racers=[];this.finishers=[];this.raceTime=0;this.cameraShake=0;this.networkSendTimer=0;
    const lanes=[0,-4.35,4.35],grid=[];for(let row=0;row<4;row++)for(let col=0;col<3;col++)grid.push({lane:lanes[col],offset:3+row*5.8+Math.abs(col-1)*1.35});
    const players=data.players||[],selfIndex=Math.max(0,players.findIndex(p=>p.id===this.multiplayer.selfId)),self=players[selfIndex],selfSpec=VEHICLES[self?.vehicleIndex||0],g=grid[selfIndex]||grid[0];
    this.player=new Racer(this,selfSpec,self?.name||this.multiplayer.username,true,g.lane,g.offset,0,self?.customization||this.multiplayer.customization);this.racers.push(this.player);
    players.forEach((p,i)=>{if(p.id===this.multiplayer.selfId)return;const slot=grid[i]||grid[this.racers.length],remote=new NetworkRacer(this,p,slot.lane,slot.offset);this.networkRacers.set(p.id,remote);this.racers.push(remote);});
    let aiIndex=0;for(let slotIndex=players.length;slotIndex<12;slotIndex++){const slot=grid[slotIndex],spec=VEHICLES[(slotIndex+this.selectedVehicle)%VEHICLES.length],ai=new Racer(this,spec,AI_NAMES[aiIndex%AI_NAMES.length],false,slot.lane,slot.offset,aiIndex);this.racers.push(ai);aiIndex++;}
    this.state='countdown';this.countdown=Math.max(.2,(data.startAt-Date.now())/1000);this.ui.home.classList.remove('active');this.ui.mainMenu.classList.remove('active');this.ui.multiplayerScreen.classList.remove('active');this.ui.multiplayerLobby.classList.remove('active');this.ui.pauseMenu.classList.remove('active');this.ui.resultsMenu.classList.remove('active');this.ui.hud.classList.add('active');this.ui.startLights.classList.remove('hidden');this.ui.trackName.textContent=this.track.def.name.toUpperCase();this.ui.message.classList.remove('show');this.ui.raceAgain.classList.add('hidden');this.ui.garage.classList.add('hidden');this.ui.multiplayerNext.classList.add('hidden');this.ui.restart.classList.add('hidden');this.ui.quit.textContent='LEAVE ROOM';this.ui.multiplayerRaceLabel.classList.remove('hidden');this.ui.multiplayerRaceRoom.textContent=this.multiplayer.room?.id||'LAN ROOM';this.setCameraImmediate();
  }
  applyNetworkSnapshot(data){const racer=this.networkRacers.get(data.id);if(racer&&data.raceId===this.currentRaceId)racer.applySnapshot(data);}
  applyNetworkCollision(data){if(!this.multiplayerMode||data.raceId!==this.currentRaceId||!this.player)return;const impulse=data.impulse||{};this.player.velocity.x+=(Number(impulse.x)||0)/this.player.mass;this.player.velocity.z+=(Number(impulse.z)||0)/this.player.mass;this.cameraShake=Math.max(this.cameraShake,.22);}
  exitMultiplayerRace(){this.multiplayerMode=false;this.currentRaceId=null;this.networkRacers.clear();this.state='multiplayer_menu';document.body.classList.remove('race-mode');this.resetInputs();this.ui.hud.classList.remove('active');this.ui.pauseMenu.classList.remove('active');this.ui.resultsMenu.classList.remove('active');this.ui.mobileControls.classList.add('controls-hidden');this.clearScene();this.buildMenuScene();}
  returnToMultiplayerLobby(){this.exitMultiplayerRace();this.showScreen('lobby');this.state='multiplayer_menu';this.multiplayer.renderLobby();}
  showMultiplayerResults(results){
    if(!this.multiplayerMode||!this.currentRaceId)return;this.state='finished';document.body.classList.remove('race-mode');this.resetInputs();this.ui.mobileControls.classList.add('controls-hidden');this.ui.hud.classList.remove('active');this.audio.update(0,0,false,false);const index=Math.max(0,results.findIndex(r=>r.id===this.multiplayer.selfId)),record=results[index]||{time:this.raceTime,dnf:false};this.ui.resultEyebrow.textContent='LAN RACE COMPLETE';this.ui.resultTitle.textContent=record.dnf?'DNF':`${this.ordinal(index+1)} PLACE`;this.ui.resultPosition.textContent=record.dnf?'DNF':this.ordinal(index+1);this.ui.resultTime.textContent=record.dnf?'—':this.formatTime(record.time);this.ui.resultThirdLabel.textContent='ROOM DRIVERS';this.ui.resultWins.textContent=results.length;this.ui.standings.innerHTML=results.map((r,i)=>`<div class="standing-row ${r.id===this.multiplayer.selfId?'player':''}"><b>${i+1}</b><span>${r.name}</span><em>${r.dnf?'DNF':this.formatTime(r.time)}</em></div>`).join('');this.ui.raceAgain.classList.add('hidden');this.ui.garage.classList.add('hidden');this.ui.multiplayerNext.classList.remove('hidden');this.ui.resultsMenu.classList.add('active');
  }
  setCameraImmediate(){const f=new THREE.Vector3(Math.sin(this.player.yaw),0,Math.cos(this.player.yaw)),dist=this.isMobile?5.45:7.2,height=this.isMobile?2.75:3.5,lookAhead=this.isMobile?4.2:5;this.camera.position.copy(this.player.position).addScaledVector(f,-dist).add(new THREE.Vector3(0,height,0));this.camera.lookAt(this.player.position.clone().addScaledVector(f,lookAhead).add(new THREE.Vector3(0,this.isMobile?.82:1,0)));this.camera.fov=this.isMobile?62:68;this.camera.updateProjectionMatrix();}
  updateCountdown(dt){const prev=Math.ceil(this.countdown);this.countdown-=dt;const c=this.countdown;this.ui.lightRig.className='light-rig';if(c>3.1){this.ui.countdown.textContent='3';this.ui.lightRig.classList.add('red');}else if(c>2.1){this.ui.countdown.textContent='2';this.ui.lightRig.classList.add('red');}else if(c>1.1){this.ui.countdown.textContent='1';this.ui.lightRig.classList.add('amber');}else if(c>0){this.ui.countdown.textContent='GO!';this.ui.lightRig.classList.add('green');}if(Math.ceil(c)!==prev){if(c>1)this.audio.beep(420,.12);else if(c>0)this.audio.beep(760,.28,'square',.07);}this.racers.forEach(r=>r.player?r.updatePlayer(dt,this.input,false):r.network?r.updateNetwork(dt):r.updateAI(dt,false));if(c<=0){this.state='racing';this.ui.startLights.classList.add('hidden');this.flashMessage('GO!',700);}}
  updateRace(dt){this.raceTime+=dt;this.player.updatePlayer(dt,this.input,true);for(let i=1;i<this.racers.length;i++){const r=this.racers[i];r.network?r.updateNetwork(dt):r.updateAI(dt,true);}this.resolveCarCollisions(dt);if(this.multiplayerMode){this.networkSendTimer-=dt;if(this.networkSendTimer<=0){this.networkSendTimer=.075;this.multiplayer.sendSnapshot(this.player);}}this.updateCamera(dt);this.hudTimer-=dt;if(this.hudTimer<=0){this.hudTimer=this.performanceMode?.1:.05;this.updateHUD();}}
  moveRacer(racer,delta){if(racer.player)racer.position.add(delta);else if(racer.network){racer.position.add(delta);racer.targetPosition.addScaledVector(delta,.45);}else{racer.collisionOffset.add(delta);racer.position.add(delta);}racer.mesh.position.copy(racer.position);}
  applyRacerImpulse(racer,impulse){
    if(racer.player){racer.velocity.addScaledVector(impulse,1/racer.mass);racer.yaw+=clamp((impulse.x*Math.cos(racer.yaw)-impulse.z*Math.sin(racer.yaw))*.004,-.045,.045);return;}
    if(racer.network){racer.position.addScaledVector(impulse,.012/racer.mass);racer.targetPosition.addScaledVector(impulse,.008/racer.mass);this.multiplayer?.sendCollision(racer.networkId,impulse);return;}
    racer.collisionVelocity.addScaledVector(impulse,1/racer.mass);const tangent=this.track.sampleTangent(racer.trackT,this.tmpImpulseTangent),forwardKick=impulse.dot(tangent)/racer.mass;racer.speed=clamp(racer.speed+forwardKick,0,racer.aiSpeed);
  }
  resolveCarCollisions(dt){
    const minDistance=2.72,restitution=.18,friction=.72;
    for(let i=0;i<this.racers.length;i++)for(let j=i+1;j<this.racers.length;j++){
      const a=this.racers[i],b=this.racers[j];if(a.network&&b.network)continue;if(a.finished||b.finished||Math.abs(a.position.y-b.position.y)>1.6)continue;
      const dx=b.position.x-a.position.x,dz=b.position.z-a.position.z,d2=dx*dx+dz*dz;if(d2>=minDistance*minDistance)continue;
      const distance=Math.max(Math.sqrt(d2),.001),normal=this.tmpCollisionNormal.set(dx/distance,0,dz/distance),penetration=minDistance-distance,invA=1/a.mass,invB=1/b.mass,invTotal=invA+invB;
      const correctionStrength=Math.max(penetration-.02,0)/invTotal*.78;this.moveRacer(a,normal.clone().multiplyScalar(-correctionStrength*invA));this.moveRacer(b,normal.clone().multiplyScalar(correctionStrength*invB));
      const relative=this.tmpRelativeVelocity.copy(b.velocity).sub(a.velocity),velAlongNormal=relative.dot(normal);let normalImpulse=penetration*7.5;
      if(velAlongNormal<0)normalImpulse+=-(1+restitution)*velAlongNormal/invTotal;
      if(normalImpulse>0){const impulse=normal.clone().multiplyScalar(normalImpulse);this.applyRacerImpulse(a,impulse.clone().multiplyScalar(-1));this.applyRacerImpulse(b,impulse);}
      const tangent=this.tmpCollisionTangent.copy(relative).addScaledVector(normal,-relative.dot(normal));if(tangent.lengthSq()>.0001){tangent.normalize();let jt=-relative.dot(tangent)/invTotal;const maxFriction=normalImpulse*friction;jt=clamp(jt,-maxFriction,maxFriction);const frictionImpulse=tangent.multiplyScalar(jt);this.applyRacerImpulse(a,frictionImpulse.clone().multiplyScalar(-1));this.applyRacerImpulse(b,frictionImpulse);}
      if(a.player||b.player)this.cameraShake=Math.max(this.cameraShake,clamp(.1+normalImpulse*.009,.1,.36));
    }
  }
  updateCamera(dt){
    const f=this.tmpForward.set(Math.sin(this.player.yaw),0,Math.cos(this.player.yaw)),speedRatio=clamp(this.player.speed/this.player.raceTopSpeed,0,1.4),mobile=this.isMobile,dist=(mobile?lerp(5.15,6.25,clamp(speedRatio,0,1)):lerp(6.8,8.6,clamp(speedRatio,0,1)))+(this.player.boosting?(mobile?.48:1.3):0),height=mobile?lerp(2.55,2.95,clamp(speedRatio,0,1)):lerp(3.1,3.75,clamp(speedRatio,0,1));
    const desired=this.tmpDesired.copy(this.player.position).addScaledVector(f,-dist);desired.y+=height;const shake=(this.player.boosting?.045:0)+this.cameraShake;desired.x+=(Math.random()-.5)*shake;desired.y+=(Math.random()-.5)*shake*.6;desired.z+=(Math.random()-.5)*shake;this.camera.position.lerp(desired,1-Math.exp(-dt*(mobile?7.2:5.8)));
    const look=this.tmpLook.copy(this.player.position).addScaledVector(f,(mobile?4.6:6)+speedRatio*(mobile?2.4:4));look.y+=mobile?.82:1;this.camera.lookAt(look);const targetFov=mobile?(this.player.boosting?69:62+speedRatio*1.5):(this.player.boosting?82:68+speedRatio*3),nextFov=lerp(this.camera.fov,targetFov,dt*(mobile?7:5));if(Math.abs(nextFov-this.camera.fov)>.025){this.camera.fov=nextFov;this.camera.updateProjectionMatrix();}this.cameraShake=Math.max(0,this.cameraShake-dt*.8);
    if(this.boostFxState!==this.player.boosting){this.boostFxState=this.player.boosting;this.ui.speedFx.classList.toggle('active',this.player.boosting);this.canvas.style.filter=!this.performanceMode&&this.player.boosting?(this.isMobile?'saturate(1.12) contrast(1.04)':'saturate(1.18) contrast(1.06)'):'none';}
  }
  prepareMinimap(){const c=this.ui.minimap,w=c.width,h=c.height,pad=18,minX=this.track.bounds.minX,maxX=this.track.bounds.maxX,minZ=this.track.bounds.minZ,maxZ=this.track.bounds.maxZ,scale=Math.min((w-pad*2)/(maxX-minX),(h-pad*2)/(maxZ-minZ)),off=document.createElement('canvas');off.width=w;off.height=h;const ctx=off.getContext('2d'),mapX=x=>pad+(x-minX)*scale,mapY=z=>h-pad-(z-minZ)*scale;ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();this.track.minimapPoints.forEach((p,i)=>{const x=mapX(p.x),y=mapY(p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.stroke();this.minimapStatic=off;this.minimapMetrics={minX,minZ,scale,pad,w,h};}
  updateHUD(){const order=[...this.racers].sort((a,b)=>b.progress()-a.progress()),pos=order.indexOf(this.player)+1;this.ui.position.textContent=`${pos} / ${this.racers.length}`;this.ui.lap.textContent=`${clamp(this.player.lap+1,1,LAPS_TO_WIN)} / ${LAPS_TO_WIN}`;this.ui.time.textContent=this.formatTime(this.raceTime);this.ui.speed.textContent=Math.round(Math.max(0,this.player.speed)*3.6);this.ui.gear.textContent=this.player.speed<1?'N':this.player.gear;this.ui.boostFill.style.transform=`scaleX(${this.player.boost})`;this.ui.boostLabel.textContent=this.player.boosting?'TURBO ACTIVE':this.player.boost<.16?'BOOST EMPTY':this.player.boost>.96?'BOOST READY':'BOOST CHARGING';this.drawMinimap();}
  drawMinimap(){const c=this.ui.minimap,ctx=c.getContext('2d'),m=this.minimapMetrics;if(!m)return;ctx.clearRect(0,0,m.w,m.h);if(this.minimapStatic)ctx.drawImage(this.minimapStatic,0,0);this.racers.forEach(r=>{const x=m.pad+(r.position.x-m.minX)*m.scale,y=m.h-m.pad-(r.position.z-m.minZ)*m.scale;ctx.beginPath();ctx.fillStyle=r.player?'#ff5a1f':'#e9edf1';ctx.arc(x,y,r.player?4.5:2.45,0,TAU);ctx.fill();});}
  registerFinish(racer){if(this.finishers.includes(racer))return;this.finishers.push(racer);if(!racer.player)setTimeout(()=>{if(racer.mesh)racer.mesh.visible=false;},900);}
  finishRace(){
    if(this.multiplayerMode){if(this.state==='multiplayer_waiting'||this.state==='finished')return;this.state='multiplayer_waiting';this.resetInputs();this.multiplayer.sendFinish(this.raceTime);this.flashMessage('FINISHED — WAITING FOR ROOM',1800);return;}
    if(this.state==='finished')return;this.state='finished';document.body.classList.remove('race-mode');this.resetInputs();this.ui.mobileControls?.classList.add('controls-hidden');this.audio.update(0,0,false,false);this.ui.speedFx.classList.remove('active');this.canvas.style.filter='none';this.boostFxState=false;
    const order=[...this.racers].sort((a,b)=>b.progress()-a.progress()),position=order.indexOf(this.player)+1,won=position===1;this.storage.races++;if(won)this.storage.wins++;const key=`${TRACKS[this.selectedTrack].id}:${VEHICLES[this.selectedVehicle].id}:${this.selectedDifficulty}`;if(!this.storage.best[key]||this.raceTime<this.storage.best[key])this.storage.best[key]=this.raceTime;this.saveStorage();
    this.ui.resultEyebrow.textContent=won?'PODIUM FINISH':'RACE COMPLETE';this.ui.resultTitle.textContent=won?'VICTORY':`${this.ordinal(position)} PLACE`;this.ui.resultPosition.textContent=this.ordinal(position);this.ui.resultTime.textContent=this.formatTime(this.raceTime);this.ui.resultWins.textContent=this.storage.wins;this.ui.standings.innerHTML=order.map((r,i)=>`<div class="standing-row ${r.player?'player':''}"><b>${i+1}</b><span>${r.name}</span><em>${r.finished?this.formatTime(r.finishTime):`LAP ${clamp(r.lap+1,1,3)}`}</em></div>`).join('');setTimeout(()=>this.ui.resultsMenu.classList.add('active'),700);
  }
  flashMessage(text,duration=1000){this.ui.message.textContent=text;this.ui.message.classList.add('show');clearTimeout(this.messageTimer);this.messageTimer=setTimeout(()=>this.ui.message.classList.remove('show'),duration);}
  pause(){if(this.state!=='racing'&&this.state!=='countdown')return;this.previousState=this.state;this.state='paused';this.resetInputs();this.ui.mobileControls?.classList.add('controls-hidden');this.audio.update(0,0,false,false);this.ui.pauseMenu.classList.add('active');}
  resume(){if(this.state!=='paused')return;this.state=this.previousState||'racing';this.clock.getDelta();this.ui.pauseMenu.classList.remove('active');this.ui.mobileControls?.classList.remove('controls-hidden');this.audio.init();}
  togglePause(){if(this.state==='paused')this.resume();else this.pause();}
  returnToMenu(){if(this.multiplayerMode){this.returnToMultiplayerLobby();return;}this.state='menu';document.body.classList.remove('race-mode');this.resetInputs();this.ui.mobileControls?.classList.add('controls-hidden');this.ui.pauseMenu.classList.remove('active');this.ui.resultsMenu.classList.remove('active');this.ui.hud.classList.remove('active');this.showScreen('single');this.ui.speedFx.classList.remove('active');this.canvas.style.filter='none';this.boostFxState=false;this.audio.update(0,0,false,false);this.buildMenuScene();}
  applyRenderScale(){this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.renderScale));this.renderer.setSize(innerWidth,innerHeight,false);}
  updateAdaptiveQuality(dt){if(!this.performanceMode||(this.state!=='racing'&&this.state!=='countdown'))return;this.perfFrames++;this.perfElapsed+=dt;if(this.perfElapsed<2.5)return;const fps=this.perfFrames/Math.max(this.perfElapsed,.001),target=this.profile.targetFps;let next=this.renderScale;if(fps<target-8)next-=.09;else if(fps<target-3)next-=.045;else if(fps>target+1.5)next+=.018;next=clamp(next,this.profile.minRenderScale,this.profile.maxRenderScale);if(Math.abs(next-this.renderScale)>.015){this.renderScale=next;this.applyRenderScale();}this.perfFrames=0;this.perfElapsed=0;}
  resize(){this.isMobile=matchMedia('(pointer: coarse)').matches||innerWidth<=900;this.performanceMode=DEVICE_PROFILE.performanceMode||this.isMobile;document.body.classList.toggle('performance-mode',this.performanceMode);document.body.classList.toggle('touch-mode',this.isMobile);const maxScale=this.isMobile?Math.min(this.profile.maxRenderScale,.8):(this.performanceMode?this.profile.maxRenderScale:1.45);this.renderScale=Math.min(this.renderScale,maxScale);this.renderer.shadowMap.enabled=!this.performanceMode&&!this.isMobile;this.applyRenderScale();this.camera.aspect=Math.max(innerWidth,1)/Math.max(innerHeight,1);this.camera.far=this.performanceMode?760:1200;this.camera.updateProjectionMatrix();this.resizeShowroom();}
  formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;}
  ordinal(n){return `${n}${n===1?'ST':n===2?'ND':n===3?'RD':'TH'}`;}
  animate(timestamp=performance.now()){
    requestAnimationFrame(t=>this.animate(t));if(document.hidden)return;const activeRace=this.state==='racing'||this.state==='countdown',targetFps=activeRace?this.profile.targetFps:this.profile.menuFps,interval=1000/targetFps,elapsed=timestamp-this.lastFrameStamp;if(this.lastFrameStamp&&elapsed<interval)return;this.lastFrameStamp=timestamp-(elapsed%interval);const dt=Math.min(this.clock.getDelta(),.05);
    if((this.state==='menu'||this.state==='home')&&this.previewCar){this.menuOrbit+=dt;this.previewCar.rotation.y+=dt*.28;this.previewCar.position.y=.23+Math.sin(this.menuOrbit*1.35)*.018;this.previewCar.userData.wheels.forEach(w=>w.rotation.x-=dt*.18);if(this.showroomScene)this.showroomRenderer.render(this.showroomScene,this.showroomCamera);}
    else if(this.state==='countdown'){this.updateCountdown(dt);this.updateCamera(dt);this.hudTimer-=dt;if(this.hudTimer<=0){this.hudTimer=this.performanceMode?.1:.05;this.updateHUD();}}
    else if(this.state==='racing')this.updateRace(dt);else if(this.state==='multiplayer_waiting'){for(const r of this.networkRacers.values())r.updateNetwork(dt);this.updateCamera(dt);this.hudTimer-=dt;if(this.hudTimer<=0){this.hudTimer=.1;this.updateHUD();}}this.updateAdaptiveQuality(dt);this.renderer.render(this.scene,this.camera);
  }
}

new Game();
