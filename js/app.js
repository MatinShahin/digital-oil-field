/* Digital Oil Field 3D Twin
 * Developed by Matin Shahin, AI Entrepreneur and Principal Applied AI Research Engineer
 * matin.shahin97@gmail.com
 */
(function () {
"use strict";
const stage = document.getElementById("stage");
if (!window.THREE) { stage.insertAdjacentHTML("beforeend", '<div class="err">The 3D engine could not load. Check your connection and reload.</div>'); return; }
const T = THREE;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const darkQ = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : darkQ.matches; };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- renderer, scene, camera ---------- */
let renderer;
try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); } catch (e) { stage.insertAdjacentHTML("beforeend", '<div class="err">This device has no WebGL, which the 3D twin needs.</div>'); return; }
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputEncoding = T.sRGBEncoding;
stage.prepend(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(28, 1.6, 5, 5000);
camera.position.set(520, 420, 560);
const controls = new T.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(-10, -30, 0);
controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 120; controls.maxDistance = 1500;
controls.autoRotateSpeed = 0.6;

const hemi = new T.HemisphereLight(0xffffff, 0xbfb9ad, 0.75); scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 0.85);
sun.position.set(-260, 420, 220); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 260, bottom: -260, near: 50, far: 1200 });
sun.shadow.bias = -0.0006; scene.add(sun);
const fill = new T.DirectionalLight(0xffffff, 0.25); fill.position.set(300, 120, -200); scene.add(fill);

function applyTheme() {
  const d = isDark();
  scene.background = new T.Color(d ? 0x121316 : 0xf1f1ec);
  hemi.intensity = d ? 0.55 : 0.75; sun.intensity = d ? 0.7 : 0.85;
  edgeMat.color.set(d ? 0x50535c : 0x6c6d72);
}

/* ---------- materials ---------- */
const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.78, metalness: 0.05 }, o));
const mat = {
  steel: M(0xeceae4, { roughness: 0.55, metalness: 0.15 }),
  steel2: M(0xd7d5ce, { roughness: 0.6, metalness: 0.2 }),
  dark: M(0x55575d, { roughness: 0.5, metalness: 0.4 }),
  yellow: M(0xe8b423, { roughness: 0.6 }),
  red: M(0xc8442a, { roughness: 0.6 }),
  concrete: M(0xdedcd4, { roughness: 0.95 }),
  pipe: M(0xe6e3dc, { roughness: 0.5, metalness: 0.2 }),
  tank: M(0xf4f2ec, { roughness: 0.7 }),
  glass: M(0x8fb4c8, { roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.75 }),
  solar: M(0x253a5e, { roughness: 0.3, metalness: 0.4 }),
  hi: M(0x6e56cf, { roughness: 0.5, emissive: 0x6e56cf, emissiveIntensity: 0.35 }),
};
const edgeMat = new T.LineBasicMaterial({ color: 0x6c6d72, transparent: true, opacity: 0.55 });
function edges(mesh, angle = 30) { const l = new T.LineSegments(new T.EdgesGeometry(mesh.geometry, angle), edgeMat); mesh.add(l); return mesh; }
function mesh(geo, m, { cast = true, recv = true, edge = true } = {}) { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; if (edge) edges(o); return o; }
const box = (w, h, d, m, o) => mesh(new T.BoxGeometry(w, h, d), m, o);
const cyl = (r1, r2, h, m, seg = 24, o) => mesh(new T.CylinderGeometry(r1, r2, h, seg), m, o);

/* ---------- earth block with geology and cutaway ---------- */
const EX = 210, EZ = 160, NX = 70, NZ = 50;
const LAYERS = [
  { y0: 0, y1: -6, c: 0xd9d2bf, name: "soil" },
  { y0: -6, y1: -48, c: 0xe8dcc0, name: "sand" },
  { y0: -48, y1: -86, c: 0xcfd1d6, name: "shale" },
  { y0: -86, y1: -98, c: 0xb8bac2, name: "cap" },
  { y0: -98, y1: -126, c: 0xe2b56e, name: "res" },
  { y0: -126, y1: -150, c: 0xc9c4bc, name: "base" },
];
const earth = new T.Group(); scene.add(earth);
const xrayMats = [];
const resUniforms = { uTime: { value: 0 }, uYear: { value: 0 }, uFront: { value: 0 }, uP: { value: [] }, uDrain: { value: 0 }, uInj: { value: new T.Vector2() }, uDark: { value: 0 } };
const resMat = new T.ShaderMaterial({
  uniforms: resUniforms,
  vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `
  varying vec3 vW;uniform float uTime;uniform float uFront;uniform float uDrain;uniform vec2 uInj;uniform vec2 uP[5];uniform float uDark;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fb(vec2 p){return .5*n(p)+.25*n(p*2.1)+.125*n(p*4.3);}
  void main(){
    vec2 p=vW.xz;
    float d=length(p-uInj);
    float wob=(fb(p*.03+vec2(3.,1.))-.5)*55.;
    float front=1.-smoothstep(uFront-10.,uFront+6.,d+wob);
    float drain=0.;
    for(int i=0;i<5;i++){float r=length(p-uP[i]);drain=max(drain,1.-smoothstep(0.,uDrain,r));}
    vec3 oil=vec3(.55,.32,.08),rich=vec3(.42,.22,.05),water=vec3(.25,.55,.86),swept=vec3(.6,.75,.88);
    float g=fb(p*.08+vW.y*.05);
    vec3 c=mix(rich,oil,g*.6+drain*.55);
    c=mix(c,vec3(.86,.64,.33),drain*.35);
    c=mix(c,mix(water,swept,g),front);
    float edge=exp(-pow((d+wob-uFront)/5.,2.))*step(1.,uFront);
    c=mix(c,vec3(.75,.9,1.),edge*.7);
    float pores=step(.86,h(floor(vW.xz*.9)+floor(vW.y*.9)));
    c*=1.-pores*.12;
    float light=.82+.18*clamp(normalize(cross(dFdx(vW),dFdy(vW))).y*.5+.5,0.,1.);
    gl_FragColor=vec4(c*light,1.);
  }`,
  extensions: { derivatives: true },
});
function slabL(y0, y1, material, isRes) {
  const h = y0 - y1, yc = (y0 + y1) / 2;
  const parts = [
    [-EX, EX, -EZ, NZ],
    [-EX, NX, NZ, EZ],
  ];
  const g = new T.Group();
  for (const [x0, x1, z0, z1] of parts) {
    const m = mesh(new T.BoxGeometry(x1 - x0, h, z1 - z0), material, { cast: false, recv: true, edge: true });
    m.position.set((x0 + x1) / 2, yc, (z0 + z1) / 2);
    g.add(m);
  }
  return g;
}
LAYERS.forEach((L, i) => {
  if (L.name === "res") { earth.add(slabL(L.y0, L.y1, resMat, true)); return; }
  if (L.name === "base") {
    const m = mesh(new T.BoxGeometry(EX * 2, L.y0 - L.y1, EZ * 2), M(L.c), { cast: false });
    m.position.set(0, (L.y0 + L.y1) / 2, 0); earth.add(m); return;
  }
  const mm = M(L.c, { transparent: true, opacity: 1, depthWrite: true });
  if (L.name !== "soil") xrayMats.push(mm);
  earth.add(slabL(L.y0, L.y1, mm));
});
const soilTop = M(0xe9e4d6, { roughness: 1 });
const plinth = box(EX * 2 + 40, 14, EZ * 2 + 40, M(0xf6f5f0, { roughness: 0.9 }));
plinth.position.y = -150 - 7; scene.add(plinth);
for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = cyl(10, 12, 10, mat.steel2, 20); f.position.set(x * (EX + 6), -169, z * (EZ + 6)); scene.add(f); }
const plate = box(90, 1.2, 16, M(0xdedbd2));
plate.position.set(EX - 40, -149.4, EZ + 12); scene.add(plate);
const sign = makeTextSprite("DEVELOPED BY MATIN SHAHIN", 26, "#3a3b40");
sign.position.set(EX - 40, -147.6, EZ + 12); sign.scale.set(80, 10, 1); scene.add(sign);

function makeTextSprite(text, size, color) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 128;
  const g = c.getContext("2d"); g.font = `600 ${size * 2}px ui-monospace, Menlo, monospace`; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 512, 64);
  const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
  return new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
}

/* ---------- wells ---------- */
const RES_Y = -112;
const WELLS = [
  { id: "P-01", type: "Beam pump", x: 40, z: -70, q0: 820, spm: 8, art: "jack" },
  { id: "P-02", type: "Beam pump", x: 110, z: -20, q0: 760, spm: 7, art: "jack" },
  { id: "P-03", type: "Beam pump", x: -10, z: 20, q0: 690, spm: 9, art: "jack" },
  { id: "P-04", type: "ESP well", x: 150, z: -105, q0: 1450, art: "esp", anomaly: true },
  { id: "P-05", type: "Horizontal ESP", x: 30, z: 100, q0: 1680, art: "esp", lateral: [[30, 100], [140, 120]] },
  { id: "I-01", type: "Water injector", x: 170, z: 60, inj: true, art: "inj" },
];
const INJ = WELLS.find((w) => w.inj);
const PRODS = WELLS.filter((w) => !w.inj);
resUniforms.uInj.value.set(INJ.x, INJ.z);
resUniforms.uP.value = PRODS.map((w) => new T.Vector2(w.lateral ? (w.lateral[0][0] + w.lateral[1][0]) / 2 : w.x, w.lateral ? (w.lateral[0][1] + w.lateral[1][1]) / 2 : w.z));
const wellbores = new T.Group(); scene.add(wellbores);
const pickables = [];
const animators = [];

function boreFor(w) {
  const pts = [new T.Vector3(w.x, 0, w.z), new T.Vector3(w.x, -60, w.z)];
  if (w.lateral) {
    const [a, b] = w.lateral;
    pts.push(new T.Vector3(a[0], -95, a[1]), new T.Vector3(a[0] + 12, RES_Y, a[1] + 3), new T.Vector3(b[0], RES_Y + 2, b[1]));
  } else pts.push(new T.Vector3(w.x, RES_Y - 6, w.z));
  const curve = new T.CatmullRomCurve3(pts, false, "centripetal");
  const col = w.inj ? 0x2f7fd0 : 0x3a3b40;
  const tube = new T.Mesh(new T.TubeGeometry(curve, 80, w.lateral ? 2.2 : 2, 10, false), M(col, { roughness: 0.4, metalness: 0.4 }));
  tube.castShadow = false; wellbores.add(tube);
  const casing = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(w.x, 0, w.z), new T.Vector3(w.x, -45, w.z)), 4, 3.4, 12, false), M(0x9a9ca3, { roughness: 0.4, metalness: 0.5 }));
  wellbores.add(casing);
  if (!w.inj) {
    const end = curve.getPoint(1);
    const perf = new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, depthWrite: false }));
    perf.position.copy(end); wellbores.add(perf); w.perf = perf;
  } else {
    const end = curve.getPoint(1);
    const ring = new T.Mesh(new T.SphereGeometry(6, 16, 12), new T.MeshBasicMaterial({ color: 0x5aa8f0, transparent: true, opacity: 0.4, depthWrite: false }));
    ring.position.copy(end); wellbores.add(ring); w.perf = ring;
  }
  w.curve = curve;
}

/* ---------- assets made of named parts ---------- */
const ASSETS = [];
function newAsset(name, kind, root, extra = {}) { const a = Object.assign({ name, kind, root, parts: [], ex: { x: 0, v: 0 }, open: false }, extra); ASSETS.push(a); return a; }
function part(a, name, desc, dir, build, parent) {
  const g = new T.Group(); (parent || a.root).add(g); build(g);
  const p = { name, desc, g, dir: new T.Vector3(dir[0], dir[1], dir[2]), down: false };
  a.parts.push(p); return g;
}
function finishAsset(a) {
  a.parts.forEach((p, i) => p.g.traverse((o) => { if (o.isMesh) { o.userData.asset = a; o.userData.part = i; pickables.push(o); } }));
  a.root.updateMatrixWorld(true);
  const b = new T.Box3();
  a.parts.forEach((p) => { if (!p.down) b.expandByObject(p.g); });
  a.center = b.getCenter(new T.Vector3()); a.size = b.getSize(new T.Vector3()).length();
  const bd = new T.Box3(); a.parts.forEach((p) => { if (p.down) bd.expandByObject(p.g); });
  if (!bd.isEmpty()) a.downCenter = bd.getCenter(new T.Vector3());
}
function viewDirFor(a, dist) {
  const c = a.center, cur = camera.position.clone().sub(controls.target).normalize();
  let best = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2, d = new T.Vector3(Math.cos(az), 0.8, Math.sin(az)).normalize();
    let clear = 200;
    for (const o of ASSETS) { if (o === a) continue; const v = o.center.clone().sub(c); const t = v.dot(d); if (t <= 0 || t > dist + 20) continue; clear = Math.min(clear, v.sub(d.clone().multiplyScalar(t)).length() - o.size * 0.45); }
    const score = Math.min(clear, 40) * 3 + d.dot(cur) * 25 + (d.x + d.z) * 10;
    if (score > bs) { bs = score; best = d; }
  }
  return best;
}
const add = (g, o, x, y, z) => { o.position.set(x, y, z); g.add(o); return o; };

function pad(w, s = 30) { const p = box(s, 1.4, s, mat.concrete, { edge: true }); p.position.set(0, 0.7, 0); return p; }

function pumpjack(w, a) {
  const holder = a.root;
  const g = new T.Group(); g.position.set(0, 1.4, 0); g.rotation.y = 0.78; holder.add(g);
  part(a, "Skid and foundation", "Steel base that ties the unit together on its concrete pad.", [0, 0, 0], (p) => { add(p, box(46, 2.4, 8, mat.steel2), -4, 1.2, 0); }, g);
  part(a, "Samson post", "A-frame that carries the walking beam on its centre bearing.", [0, 0, -14], (p) => {
    for (const s of [-1, 1]) { const leg = box(2, 26, 2, mat.yellow); leg.position.set(0, 13, s * 3.2); leg.rotation.x = -s * 0.12; p.add(leg); }
    add(p, box(3, 3, 9, mat.yellow), 0, 26, 0);
  }, g);
  let beam, headPivot, crank, rod, pitman = [];
  part(a, "Walking beam", "Rocks on the samson post, turning the crank's rotation into an up-and-down stroke.", [0, 13, 0], (p) => {
    beam = add(p, new T.Group(), 0, 28, 0);
    add(beam, box(44, 2.6, 2.4, mat.yellow), 2, 0, 0);
    add(beam, cyl(1.6, 1.6, 6, mat.dark, 12), 0, 0, 0).rotation.x = Math.PI / 2;
  }, g);
  part(a, "Horsehead", "Curved head that keeps the bridle hanging straight over the well.", [12, 15, 0], (p) => {
    headPivot = add(p, new T.Group(), 0, 28, 0);
    const sh = new T.Shape(); sh.moveTo(0, -6); sh.absarc(0, 0, 7, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(0, -6);
    add(headPivot, mesh(new T.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false }), mat.red), 24, 0, -2);
  }, g);
  part(a, "Crank and counterweights", "Heavy counterweights balance the weight of the rod string and fluid.", [-4, 0, 18], (p) => {
    crank = add(p, new T.Group(), -18, 9, 0);
    for (const s of [-1, 1]) { add(crank, box(14, 2.4, 1.2, mat.dark), -3, 0, s * 5); add(crank, box(8, 6, 1.6, mat.dark), -9, 0, s * 5); }
    add(crank, cyl(2.2, 2.2, 12, mat.steel2, 16), 0, 0, 0).rotation.x = Math.PI / 2;
  }, g);
  part(a, "Pitman arms", "Connecting rods from the crank pins up to the tail of the beam.", [0, 8, 14], (p) => {
    for (const s of [-1, 1]) { const m = box(1.2, 20, 1.2, mat.dark); p.add(m); pitman.push([m, s]); }
  }, g);
  part(a, "Gear reducer", "Cuts motor speed about 30:1 to drive the crank at 6-10 strokes a minute.", [-4, 14, -14], (p) => {
    add(p, box(8, 8, 7, mat.steel2), -18, 6, 0); add(p, cyl(1.2, 1.2, 9, mat.dark, 12), -18, 6, 0).rotation.x = Math.PI / 2;
  }, g);
  part(a, "Prime mover", "Electric motor, belted to the gear reducer.", [-18, 4, 0], (p) => {
    add(p, cyl(2.6, 2.6, 7, mat.dark, 16), -28, 5, 0).rotation.z = Math.PI / 2;
    add(p, box(5, 1.4, 5, mat.steel2), -28, 1.8, 0);
    add(p, box(8, 6, 1, mat.steel2, { edge: true }), -23, 6, 3.6);
  }, g);
  part(a, "Polished rod and stuffing box", "The polished rod slides through a packed seal at the wellhead.", [18, 0, 0], (p) => {
    rod = add(p, cyl(0.5, 0.5, 30, mat.dark, 8), 26, 18, 0);
    add(p, cyl(2.2, 2.2, 6, mat.steel, 16), 26, 3, 0);
    add(p, cyl(1.4, 1.4, 6, mat.steel, 12), 28, 4.5, 0).rotation.z = Math.PI / 2;
  }, g);
  const dh = new T.Group(); dh.position.set(0, 0, 0); holder.add(dh); a.downhole = dh;
  part(a, "Downhole rod pump", "Barrel and plunger at the bottom of the tubing; each upstroke lifts a column of oil.", [-30, 118, 22], (p) => {
    const y0 = -102;
    add(p, cyl(2.6, 2.6, 12, M(0x9a9ca3, { metalness: 0.5, roughness: 0.4 }), 16), 0, y0, 0);
    for (const yy of [y0 - 6.5, y0 + 6.5]) add(p, cyl(3, 3, 1, mat.dark, 16), 0, yy, 0);
  }, dh);
  a.parts[a.parts.length - 1].down = true;
  part(a, "Sucker-rod string", "Steel rods, 2,300 m long, connecting the beam to the downhole pump.", [-36, 96, 22], (p) => {
    add(p, cyl(0.6, 0.6, 90, mat.dark, 8), 0, -50, 0);
  }, dh);
  a.parts[a.parts.length - 1].down = true;
  let ang = Math.random() * 6;
  animators.push((dt, rate) => {
    ang += dt * rate * (w.spm / 60) * Math.PI * 2;
    crank.rotation.z = ang;
    const tilt = Math.sin(ang) * 0.16;
    beam.rotation.z = tilt; headPivot.rotation.z = tilt;
    const crankPin = new T.Vector3(-18 + Math.cos(ang + Math.PI) * 9, 9 + Math.sin(ang + Math.PI) * 9, 0);
    const tail = new T.Vector3(-20 * Math.cos(tilt), 28 - 20 * Math.sin(tilt), 0);
    for (const [m, s] of pitman) { const mid = crankPin.clone().add(tail).multiplyScalar(0.5); m.position.set(mid.x, mid.y, s * 4.2); const d = tail.clone().sub(crankPin); m.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2; m.scale.y = d.length() / 20; }
    const hy = 28 + 22 * Math.sin(tilt) - 7 * Math.cos(tilt) + 7;
    const top = hy - 7.5;
    rod.position.set(26, (top + 6) / 2 + 2, 0); rod.scale.y = Math.max(0.2, (top - 6) / 30);
  });
  holder.add(pad(w, 44));
}

function espSurface(w, a) {
  const g = new T.Group(); g.position.set(0, 1.4, 0); a.root.add(g);
  part(a, "Casing and tubing head", "Bolted spools that hang the casing and tubing and seal the annulus.", [0, 0, 0], (p) => {
    add(p, cyl(6.7, 6.2, 4, mat.steel, 20), 0, 2, 0); add(p, cyl(5.7, 5.2, 4, mat.steel2, 20), 0, 6, 0);
  }, g);
  part(a, "Master valve", "The main barrier: closes the whole well in.", [0, 7, 0], (p) => {
    add(p, cyl(4.95, 4.95, 6, mat.steel, 20), 0, 11, 0);
    add(p, new T.Mesh(new T.TorusGeometry(3, 0.35, 8, 24), mat.dark), -7, 11, 0).rotation.y = Math.PI / 2;
    add(p, cyl(0.6, 0.6, 3, mat.dark, 8), -5.5, 11, 0).rotation.z = Math.PI / 2;
  }, g);
  part(a, "Production tree and cable penetrator", "Flow tee plus the pressure-sealed feedthrough for the ESP power cable.", [0, 14, 0], (p) => {
    add(p, cyl(4.45, 4.45, 8, mat.steel2, 20), 0, 18, 0); add(p, cyl(4.45, 4.45, 8, mat.steel, 20), 0, 26, 0);
    add(p, box(2.4, 2.4, 6, mat.red), 0, 16, 5);
  }, g);
  part(a, "Wing valve", "Sends production into the flowline; the handwheel sets it open or shut.", [16, 18, 0], (p) => {
    add(p, cyl(1.4, 1.4, 14, mat.steel, 12), 8, 18, 0).rotation.z = Math.PI / 2;
    add(p, box(4, 4, 4, mat.steel2), 10, 18, 0);
    add(p, new T.Mesh(new T.TorusGeometry(2.6, 0.35, 8, 24), mat.dark), 10, 22, 0).rotation.x = Math.PI / 2;
  }, g);
  part(a, "Tree cap and gauge", "Top cap with the wellhead pressure gauge and transmitter.", [0, 22, 0], (p) => {
    add(p, cyl(3.95, 3.95, 4, mat.steel, 20), 0, 32, 0);
    add(p, cyl(2.2, 2.2, 1, M(0xffffff), 20), 0, 34.5, 0);
    const b = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), new T.MeshBasicMaterial({ color: w.anomaly ? 0xe5484d : 0x2f9e64 }));
    add(p, b, 0, 36.5, 0); w.beacon = b;
    if (w.anomaly) { const h = new T.Mesh(new T.SphereGeometry(4, 16, 12), new T.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0.25, depthWrite: false })); add(p, h, 0, 36.5, 0); w.halo = h; }
  }, g);
  part(a, "Variable-speed drive", "Sets the ESP's frequency, and with it the pump's speed and rate.", [-16, 6, 12], (p) => {
    add(p, box(10, 14, 6, mat.steel), -14, 7, 6);
    add(p, box(6, 4, 0.4, new T.MeshBasicMaterial({ color: 0x14212a })), -14, 10, 9.2);
    add(p, box(12, 1.4, 8, mat.steel2), -14, 0.7, 6);
  }, g);
  a.root.add(pad(w, 32));
  const dh = new T.Group(); a.root.add(dh); a.downhole = dh;
  const top = w.lateral ? -22 : -66;
  const segs = [
    ["Multistage pump", "Up to 300 impeller-and-diffuser stages, each adding a little pressure.", 16, 2.7, 0x8d9097, [18, 22, 0]],
    ["Intake and gas separator", "Fluid enters here; a rotary separator spins free gas out first.", 5, 2.7, 0xb4b6bc, [18, 10, 0]],
    ["Seal section", "Protector: keeps well fluid out of the motor and takes the pump's thrust.", 6, 2.6, 0x6e7077, [18, 0, 0]],
    ["Submersible motor", "Oil-filled induction motor, often 100-600 hp, cooled by the passing flow.", 16, 2.7, 0x55575d, [18, -12, 0]],
    ["Downhole sensor", "Reads intake pressure, motor temperature and vibration in real time.", 3, 2.3, 0x6e56cf, [18, -24, 0]],
  ];
  let y = top, upY = 66;
  for (const [name, desc, len, r, c, dir0] of segs) {
    const yc = y - len / 2;
    const dir = [-30, upY - len / 2 - yc, 0];
    upY -= len + 4;
    part(a, name, desc, dir, (p) => {
      add(p, cyl(r, r, len, M(c, { metalness: 0.45, roughness: 0.4 }), 18), 0, yc, 0);
      if (name === "Multistage pump") for (let k = 1; k < 8; k++) add(p, cyl(r + 0.25, r + 0.25, 0.5, mat.dark, 18), 0, y - k * 2, 0);
      if (name === "Submersible motor") for (let k = 1; k < 6; k++) add(p, cyl(r + 0.2, r + 0.2, 0.6, M(0x3a3b40), 18), 0, y - k * 2.7, 0);
      if (name === "Seal section") for (let k = 1; k < 4; k++) add(p, cyl(r + 0.5, r + 0.5, 0.9, mat.steel2, 18), 0, y - k * 1.5, 0);
      if (name === "Intake and gas separator") for (let k = 0; k < 6; k++) { const s = box(0.6, 2.4, 0.6, mat.dark, { edge: false }); add(p, s, Math.cos(k) * r, yc, Math.sin(k) * r); }
    }, dh);
    a.parts[a.parts.length - 1].down = true;
    y -= len + 0.4;
  }
  part(a, "Flat power cable", "Three-phase cable strapped down the tubing to the motor.", [-36, Math.abs(top) + 4, 0], (p) => {
    add(p, box(1, Math.abs(top) - 2, 0.6, M(0x222326), { edge: false }), 3.4, top / 2, 0);
  }, dh);
  a.parts[a.parts.length - 1].down = true;
}

function injector(w, a) {
  const g = new T.Group(); g.position.set(0, 1.4, 0); a.root.add(g);
  part(a, "Injection wellhead", "Casing head, master valve and tree, rated for continuous high-pressure injection.", [0, 14, 0], (p) => {
    [[8, 4], [6.5, 6], [5, 5], [4, 3]].reduce((yy, [r, h], i) => { add(p, cyl(r / 2 + 1, r / 2 + 1, h, i % 2 ? mat.steel2 : mat.steel, 18), 0, yy + h / 2, 0); return yy + h; }, 0);
  }, g);
  part(a, "Pump skid", "Steel skid with its drip tray and anchor bolts.", [-10, 0, 10], (p) => { add(p, box(18, 2, 10, mat.steel2), -18, 1, 0); }, g);
  part(a, "Injection pump", "Multistage pump that pushes produced water back down at about 3,000 psi.", [-14, 14, 0], (p) => {
    add(p, cyl(3, 3, 12, M(0x2f7fd0, { roughness: 0.5 }), 16), -18, 5, 0).rotation.z = Math.PI / 2;
    add(p, cyl(2.4, 2.4, 6, mat.dark, 16), -27, 5, 0).rotation.z = Math.PI / 2;
  }, g);
  part(a, "Flow meter and choke", "Measures and sets the injection rate the optimiser asks for.", [0, 8, 14], (p) => {
    add(p, cyl(1.6, 1.6, 8, mat.steel, 12), -8, 5, 0).rotation.z = Math.PI / 2;
    add(p, box(3, 3, 3, mat.red), -6, 5, 0);
  }, g);
  a.root.add(pad(w, 32));
}

for (const w of WELLS) {
  boreFor(w);
  const holder = new T.Group(); holder.position.set(w.x, 0, w.z); scene.add(holder);
  const a = newAsset("Well " + w.id, w.type, holder, { well: w, spread: 1.5 });
  if (w.art === "jack") pumpjack(w, a); else if (w.art === "esp") espSurface(w, a); else injector(w, a);
  finishAsset(a);
  w.asset = a; w.group = holder;
}

/* ---------- facilities ---------- */
const FACG = new T.Group(); scene.add(FACG);
const MAN = new T.Vector3(-60, 3, -30);
{ const a = newAsset("Production manifold", "Facility", new T.Group()); FACG.add(a.root); a.desc = "5 inlets · test and group headers";
  part(a, "Skid", "Structural base for the manifold piping.", [0, 0, 0], (p) => add(p, box(26, 2, 14, mat.steel2), MAN.x, 1, MAN.z));
  part(a, "Header", "Common pipe that collects every well's flow.", [0, 10, 0], (p) => { add(p, cyl(2.4, 2.4, 22, mat.pipe, 16), MAN.x, 5, MAN.z).rotation.z = Math.PI / 2; });
  part(a, "Diverter valves", "Route any single well to the test separator for measurement.", [0, 22, 0], (p) => { for (let i = 0; i < 5; i++) add(p, box(2.8, 4, 2.8, mat.red), MAN.x - 9 + i * 4.5, 8.5, MAN.z); });
  part(a, "Pressure transmitters", "One per inlet, streaming to SCADA.", [0, 30, 6], (p) => { for (let i = 0; i < 5; i++) add(p, cyl(0.8, 0.8, 3, mat.dark, 8), MAN.x - 9 + i * 4.5, 12, MAN.z + 2); });
  finishAsset(a); }
const SEP = new T.Vector3(-110, 0, -40);
{ const a = newAsset("Three-phase separator", "Facility", new T.Group()); FACG.add(a.root); a.desc = "oil · gas · water at 150 psi";
  part(a, "Saddles", "Concrete-anchored supports.", [0, 0, 0], (p) => { for (const s of [-1, 1]) add(p, box(4, 6, 14, mat.steel2), SEP.x + s * 14, 3, SEP.z); });
  part(a, "Pressure shell", "Horizontal vessel rated 285 psi; lifts off to show the internals.", [0, 34, 0], (p) => { add(p, cyl(9, 9, 46, mat.tank, 32), SEP.x, 13, SEP.z).rotation.z = Math.PI / 2; });
  for (const s of [-1, 1]) part(a, s < 0 ? "Outlet head" : "Inlet head", "Dished end cap welded to the shell.", [s * 26, 10, 0], (p) => { const c = mesh(new T.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.tank); c.rotation.z = -s * Math.PI / 2; add(p, c, SEP.x + s * 23, 13, SEP.z); });
  part(a, "Inlet diverter", "Knocks the incoming stream flat so gas breaks out of the liquid.", [0, 0, 0], (p) => add(p, box(1, 12, 12, mat.red), SEP.x + 17, 13, SEP.z));
  part(a, "Weir plate", "Oil spills over it into the oil bay; water stays behind.", [0, 0, 0], (p) => add(p, box(0.8, 9, 15, mat.steel2), SEP.x - 8, 9.5, SEP.z));
  part(a, "Water layer", "Free water settles to the bottom and leaves through its own outlet.", [0, 0, 0], (p) => add(p, box(30, 4, 15, M(0x2f7fd0, { transparent: true, opacity: 0.75 }), { edge: false }), SEP.x + 4, 6.5, SEP.z));
  part(a, "Oil layer", "Oil floats on the water, then spills over the weir.", [0, 0, 0], (p) => add(p, box(42, 4, 15.5, M(0xc06a14, { transparent: true, opacity: 0.75 }), { edge: false }), SEP.x, 10.5, SEP.z));
  part(a, "Mist extractor", "Wire-mesh pad that catches oil droplets before the gas leaves.", [0, 8, 0], (p) => add(p, box(6, 5, 12, M(0xbfc3c9), { edge: true }), SEP.x - 16, 18, SEP.z));
  part(a, "Sight glass", "Shows the liquid levels to an operator on site.", [0, 4, 18], (p) => add(p, box(1.2, 10, 2, mat.glass), SEP.x + 5, 13, SEP.z + 9.2));
  part(a, "Relief valve", "Opens to the flare if pressure ever exceeds the rating.", [0, 44, 0], (p) => add(p, cyl(1.4, 1.4, 6, mat.red, 12), SEP.x - 10, 25, SEP.z));
  finishAsset(a); }
const TANKS = [[-160, -95], [-120, -105], [-80, -110]];
TANKS.forEach(([x, z], i) => { const a = newAsset("Oil tank T-" + (i + 1), "Facility", new T.Group()); FACG.add(a.root); a.desc = "10,000 bbl fixed-roof tank";
  part(a, "Bund wall", "Concrete containment sized for the full tank volume.", [0, 0, 0], (p) => add(p, box(40, 3, 40, mat.concrete), x, 0.5, z));
  part(a, "Stored crude", "Up to 10,000 bbl, heated so the oil stays mobile.", [0, 0, 0], (p) => add(p, cyl(15.6, 15.6, 20, M(0x6b3a10, { roughness: 0.4 }), 40, { edge: false }), x, 11, z));
  part(a, "Heating coil", "Steam coil near the floor.", [0, 0, 0], (p) => { const c = new T.Mesh(new T.TorusGeometry(10, 0.6, 8, 40), mat.red); c.rotation.x = Math.PI / 2; add(p, c, x, 3, z); });
  part(a, "Shell", "Welded steel rings; lifts off to show the oil inside.", [0, 30, 0], (p) => { const s = cyl(16, 16, 30, M(0xf4f2ec, { roughness: 0.7, side: T.DoubleSide }), 40); add(p, s, x, 15, z); add(p, new T.Mesh(new T.TorusGeometry(16.2, 0.4, 6, 48), mat.steel2), x, 30, z).rotation.x = Math.PI / 2; });
  part(a, "Fixed roof", "Cone roof with a pressure-vacuum vent.", [0, 52, 0], (p) => add(p, mesh(new T.ConeGeometry(16.5, 5, 40), mat.tank), x, 32.5, z));
  part(a, "Stair and platform", "Access for gauging and sampling.", [22, 0, 0], (p) => add(p, box(1, 30, 3, mat.steel2), x + 16.6, 15, z));
  part(a, "Radar level gauge", "Reports tank level to the control room every few seconds.", [0, 0, 22], (p) => add(p, box(1.2, 26, 1.2, M(0x2b2c30)), x + 11.5, 15, z + 11.5));
  finishAsset(a); });
const FLARE = new T.Vector3(-170, 0, 80);
let flareTip;
{ const a = newAsset("Flare stack", "Facility", new T.Group()); FACG.add(a.root); a.desc = "relief and low-pressure gas";
  part(a, "Stack", "110 m-scale riser that carries gas up and away from people and plant.", [0, 0, 0], (p) => add(p, cyl(2.6, 3.6, 110, mat.steel, 16), FLARE.x, 55, FLARE.z));
  flareTip = part(a, "Flare tip", "Burner head with a wind shield; burns the gas cleanly.", [0, 26, 0], (p) => add(p, cyl(4, 3, 6, mat.dark, 16), FLARE.x, 113, FLARE.z));
  part(a, "Pilot and igniter", "Always-lit pilot flames that relight the flare instantly.", [10, 20, 0], (p) => { add(p, cyl(0.6, 0.6, 14, mat.red, 8), FLARE.x + 4, 106, FLARE.z); });
  part(a, "Guy wires", "Steel cables that hold the stack against wind.", [0, 0, 0], (p) => { for (let i = 0; i < 3; i++) { const t = i * 2.094; p.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(FLARE.x, 90, FLARE.z), new T.Vector3(FLARE.x + Math.cos(t) * 50, 0.5, FLARE.z + Math.sin(t) * 50)]), edgeMat)); } });
  part(a, "Knockout drum", "Drops out any liquid so only gas reaches the flame.", [20, 0, 0], (p) => add(p, cyl(7, 7, 16, mat.tank, 24), FLARE.x + 24, 9, FLARE.z).rotation.z = Math.PI / 2);
  finishAsset(a); }
const CTRL = new T.Vector3(-120, 0, 30);
{ const a = newAsset("Control room and edge data centre", "Facility", new T.Group()); FACG.add(a.root); a.desc = "SCADA · edge AI · 4G and satellite link";
  part(a, "Building", "Blast-rated operator building; the roof lifts to show inside.", [0, 0, 0], (p) => { add(p, box(44, 18, 28, M(0xeceae4, { side: T.DoubleSide })), CTRL.x, 9, CTRL.z); add(p, box(30, 6, 0.4, mat.glass), CTRL.x, 11, CTRL.z + 14.2); });
  part(a, "Server racks · edge AI", "On-site computers run the AI models next to the data, so alarms don't wait for the cloud.", [0, 28, 0], (p) => { for (let i = 0; i < 4; i++) { add(p, box(5, 12, 6, M(0x2b2c30)), CTRL.x - 14 + i * 7, 6, CTRL.z - 8); for (let k = 0; k < 4; k++) add(p, box(0.6, 0.6, 0.2, new T.MeshBasicMaterial({ color: 0x4cc38a }), { edge: false }), CTRL.x - 15.5 + i * 7, 3 + k * 2.6, CTRL.z - 4.9); } });
  part(a, "Operator consoles", "SCADA screens where the field is watched and steered.", [0, 18, 12], (p) => { for (let i = 0; i < 3; i++) { add(p, box(8, 3, 4, mat.steel2), CTRL.x - 10 + i * 10, 1.5, CTRL.z + 6); add(p, box(7, 4, 0.4, new T.MeshBasicMaterial({ color: 0x1f6fbf })), CTRL.x - 10 + i * 10, 5.5, CTRL.z + 5); } });
  part(a, "Roof", "Steel roof deck.", [0, 46, 0], (p) => add(p, box(48, 2, 32, mat.steel2), CTRL.x, 19, CTRL.z));
  part(a, "Solar array", "Keeps SCADA and comms running through a grid outage.", [0, 64, 0], (p) => { for (let i = 0; i < 6; i++) { const s = box(10, 0.6, 7, mat.solar, { edge: false }); s.rotation.x = -0.35; add(p, s, CTRL.x - 18 + (i % 3) * 13, 22, CTRL.z - 8 + Math.floor(i / 3) * 10); } });
  part(a, "Comms tower", "4G and microwave link from every well to this building.", [26, 0, 0], (p) => { for (let i = 0; i < 4; i++) add(p, box(0.8, 90, 0.8, mat.red), CTRL.x + 30 + (i % 2) * 6 - 3, 45, CTRL.z - 6 + Math.floor(i / 2) * 6 - 3); for (let yy = 10; yy < 90; yy += 10) add(p, box(7, 0.6, 7, mat.steel2, { edge: false }), CTRL.x + 30, yy, CTRL.z - 6); });
  part(a, "Satellite dish", "Backhaul to the company's cloud and remote operations centre.", [30, 14, 0], (p) => { const d = mesh(new T.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), mat.steel); d.rotation.x = -Math.PI / 2.4; add(p, d, CTRL.x + 30, 78, CTRL.z - 1); });
  finishAsset(a); }
const COMP = new T.Vector3(-150, 0, -30);
{ const a = newAsset("Gas compressor", "Facility", new T.Group()); FACG.add(a.root); a.desc = "sends gas to the sales line";
  part(a, "Skid", "Base frame with anti-vibration mounts.", [0, 0, 0], (p) => add(p, box(30, 2, 16, mat.steel2), COMP.x, 1, COMP.z));
  part(a, "Gas engine", "Natural-gas engine that drives the compressor.", [-6, 0, 12], (p) => { add(p, box(10, 8, 8, M(0x55575d)), COMP.x - 7, 6, COMP.z); add(p, cyl(1.2, 1.2, 6, mat.dark, 10), COMP.x - 7, 12, COMP.z); });
  part(a, "Compressor cylinders", "Reciprocating cylinders that raise gas from 150 to 1,000 psi.", [8, 4, 12], (p) => { for (const s of [-1, 1]) add(p, cyl(2.6, 2.6, 8, mat.steel, 16), COMP.x + 6, 6, COMP.z + s * 3).rotation.z = Math.PI / 2; });
  part(a, "Enclosure", "Acoustic housing; lifts off for maintenance.", [0, 30, 0], (p) => add(p, box(26, 14, 12, M(0x6d8f6a, { roughness: 0.7 })), COMP.x, 9, COMP.z));
  part(a, "Exhaust stack", "Engine exhaust with silencer.", [0, 44, 0], (p) => add(p, cyl(1.6, 1.6, 14, mat.dark, 12), COMP.x + 8, 22, COMP.z));
  finishAsset(a); }
const WTANK = new T.Vector3(-60, 0, 70);
{ const a = newAsset("Produced water tank", "Facility", new T.Group()); FACG.add(a.root); a.desc = "water re-injected to hold pressure";
  part(a, "Water", "Separated water waiting for re-injection.", [0, 0, 0], (p) => add(p, cyl(11.6, 11.6, 16, M(0x2f7fd0, { transparent: true, opacity: 0.8 }), 32, { edge: false }), WTANK.x, 8, WTANK.z));
  part(a, "Shell", "Coated steel shell.", [0, 26, 0], (p) => add(p, cyl(12, 12, 22, M(0xd8e6f0, { roughness: 0.7, side: T.DoubleSide }), 32), WTANK.x, 11, WTANK.z));
  part(a, "Roof", "Cone roof.", [0, 42, 0], (p) => add(p, mesh(new T.ConeGeometry(12.5, 4, 32), M(0xd8e6f0)), WTANK.x, 24, WTANK.z));
  finishAsset(a); }
const facAsset = (name) => ASSETS.find((x) => x.name === name);

/* ---------- pipes with flow ---------- */
const PIPES = [];
function pipe(points, radius, kind, label) {
  const v = points.map(([x, y, z]) => new T.Vector3(x, y, z));
  const path = new T.CurvePath();
  for (let i = 1; i < v.length; i++) path.add(new T.LineCurve3(v[i - 1], v[i]));
  const geo = new T.TubeGeometry(path, Math.max(8, v.length * 6), radius, 10, false);
  const m = new T.Mesh(geo, mat.pipe); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  for (let i = 1; i < v.length - 1; i++) { const j = new T.Mesh(new T.SphereGeometry(radius * 1.25, 12, 8), mat.steel2); j.position.copy(v[i]); scene.add(j); }
  const len = path.getLength();
  for (let s = 18; s < len - 6; s += 34) { const p = path.getPointAt(s / len); if (p.y < 6) { const sl = box(4, p.y - radius, 6, mat.concrete, { edge: false }); sl.position.set(p.x, (p.y - radius) / 2, p.z); scene.add(sl); } }
  const color = kind === "oil" ? 0xc06a14 : kind === "gas" ? 0xe0a21a : 0x2f7fd0;
  const n = Math.max(4, Math.round(len / 10));
  const dots = new T.InstancedMesh(new T.SphereGeometry(radius * 0.75, 8, 6), new T.MeshBasicMaterial({ color }), n);
  dots.frustumCulled = false; scene.add(dots);
  PIPES.push({ path, len, dots, n, kind, phase: Math.random(), speed: 0 });
  return path;
}
const Y = 4;
for (const w of PRODS) {
  pipe([[w.x, 4, w.z], [w.x, Y, MAN.z + (w.z > MAN.z ? 8 : -8)], [MAN.x + 11, Y, MAN.z + (w.z > MAN.z ? 8 : -8)], [MAN.x + 11, 5, MAN.z]], 1.3, "oil");
}
pipe([[MAN.x - 11, 5, MAN.z], [SEP.x + 32, 5, MAN.z], [SEP.x + 32, 13, SEP.z]], 2, "oil");
pipe([[SEP.x - 23, 8, SEP.z], [SEP.x - 30, 8, SEP.z], [SEP.x - 30, Y, -95], [-80, Y, -95]], 1.6, "oil");
pipe([[-80, Y, -95], [-120, Y, -95], [-160, Y, -80]], 1.6, "oil");
pipe([[-160, Y, -80], [-200, Y, -80], [-215, Y, -80]], 2.2, "oil");
pipe([[SEP.x, 22, SEP.z], [SEP.x, 30, SEP.z], [COMP.x + 15, 30, SEP.z], [COMP.x + 15, 10, COMP.z]], 1.4, "gas");
pipe([[COMP.x - 15, 6, COMP.z], [-215, 6, COMP.z]], 1.6, "gas");
pipe([[SEP.x - 15, 26, SEP.z], [SEP.x - 15, 40, SEP.z], [SEP.x - 15, 40, FLARE.z], [FLARE.x + 32, 9, FLARE.z]], 1.1, "gas");
pipe([[SEP.x + 10, 4, SEP.z], [SEP.x + 10, Y, 70], [WTANK.x - 12, Y, 70]], 1.4, "water");
pipe([[WTANK.x + 12, Y, 70], [120, Y, 70], [INJ.x - 18, Y, INJ.z], [INJ.x - 14, 5, INJ.z]], 1.6, "water");

/* ---------- flare flame ---------- */
const flameUni = { uTime: { value: 0 }, uSize: { value: 1 }, uDark: { value: 0 } };
const flame = new T.Mesh(new T.PlaneGeometry(26, 56, 1, 1), new T.ShaderMaterial({
  uniforms: flameUni, transparent: true, depthWrite: false,
  vertexShader: `varying vec2 vUv;uniform float uSize;void main(){vUv=uv;vec3 p=position;p.y=(p.y+28.)*uSize;p.x*=.6+.4*uSize;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=p.xy;gl_Position=projectionMatrix*mv;}`,
  fragmentShader: `varying vec2 vUv;uniform float uTime;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 u=vUv;float y=u.y;float x=(u.x-.5)*2.;
    float w=(1.-y)*(.55+.45*sin(y*3.1416))*.9;
    float nn=n(vec2(x*3.,y*5.-uTime*3.))*.6+n(vec2(x*7.,y*11.-uTime*5.))*.4;
    float d=abs(x+sin(y*4.+uTime*2.)*.12*y)/max(w,.01)+ (nn-.5)*.9;
    float body=(1.-smoothstep(.55,1.,d))*smoothstep(0.,.05,y)*(1.-smoothstep(.65,1.,y+(nn-.5)*.3));
    float core=(1.-smoothstep(0.,.45,d))*(1.-smoothstep(.05,.45,y));
    vec3 c=mix(vec3(.95,.35,.05),vec3(1.,.75,.2),body*.6);c=mix(c,vec3(1.,.95,.75),core);
    gl_FragColor=vec4(c,clamp(body*1.1+core,0.,1.));}`,
}));
flame.position.set(FLARE.x, 116, FLARE.z); flame.renderOrder = 10; scene.add(flame);

/* ---------- drone ---------- */
const drone = new T.Group(); scene.add(drone);
{ const body = box(8, 2.4, 8, mat.dark); drone.add(body); const rotors = [];
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const arm = box(Math.hypot(x, z), 0.6, 0.8, mat.dark, { edge: false }); arm.position.set(x / 2, 0, z / 2); arm.rotation.y = -Math.atan2(z, x); drone.add(arm);
    const r = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 0.2, 16), new T.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.5 })); r.position.set(x, 1.4, z); drone.add(r); rotors.push(r); }
  const scan = new T.Mesh(new T.ConeGeometry(16, 40, 24, 1, true), new T.MeshBasicMaterial({ color: 0x6e56cf, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })); scan.position.y = -20; drone.add(scan);
  drone.userData.rotors = rotors; }

/* ---------- labels ---------- */
const labelsEl = document.getElementById("labels");
const LBL = [];
function addLabel(text, sub, pos, state, onClick) { const el = document.createElement("div"); el.className = "lbl"; el.dataset.s = state; el.innerHTML = text + "<small>" + sub + "</small>"; el.addEventListener("click", onClick); labelsEl.appendChild(el); const L = { el, pos, sub: el.querySelector("small") }; LBL.push(L); return L; }
for (const w of WELLS) w.label = addLabel(w.id, "", new T.Vector3(w.x, w.art === "jack" ? 46 : 44, w.z), w.inj ? "inj" : "ok", () => select(w));
addLabel("Separator", "3-phase", new T.Vector3(SEP.x, 30, SEP.z), "fac", () => selectAsset(facAsset("Three-phase separator")));
addLabel("Control room", "edge AI", new T.Vector3(CTRL.x, 30, CTRL.z), "fac", () => selectAsset(facAsset("Control room and edge data centre")));
addLabel("Tank farm", "30,000 bbl", new T.Vector3(-120, 44, -105), "fac", () => selectAsset(facAsset("Oil tank T-2")));
addLabel("Flare", "relief gas", new T.Vector3(FLARE.x + 8, 70, FLARE.z), "fac", () => selectAsset(facAsset("Flare stack")));
addLabel("Compressor", "sales gas", new T.Vector3(COMP.x, 26, COMP.z), "fac", () => selectAsset(facAsset("Gas compressor")));
addLabel("Reservoir", "2,300 m · sandstone", new T.Vector3(150, -112, 120), "fac", () => { selectAsset(null); document.querySelector("[data-view=sub]").click(); });

/* ---------- production model ---------- */
const D = 0.12, FRONT_SPEED = 13;
let optimised = false, optAt = 0;
function wellState(w, t) {
  if (w.inj) return null;
  const pos = resUniforms.uP.value[PRODS.indexOf(w)];
  const dist = Math.hypot(pos.x - INJ.x, pos.y - INJ.z);
  const arrival = dist / FRONT_SPEED;
  let wc = 0.88 * smooth(arrival - 0.5, arrival + 4.5, t) + 0.04;
  const support = 1 + 0.35 * smooth(arrival - 1, arrival + 2, t);
  let gross = w.q0 * Math.exp(-D * t) * support / (1 - 0.04);
  let espHealth = 1, vib = 0.08;
  if (w.anomaly) { const wear = Math.pow(clamp((t - 3) / 6, 0, 1), 2.4); vib = 0.08 + 0.42 * wear; espHealth = 1 - wear; if (!optimised || optAt > t) { if (t > 9) { gross *= 0; } } else { vib = 0.08 + 0.42 * Math.pow(clamp((optAt - 3) / 6, 0, 1), 2.4) * 0.6; } }
  let uplift = 1;
  if (optimised && t >= optAt) { uplift = wc < 0.5 ? 1.09 : 0.97; if (w.anomaly) uplift *= 0.9; }
  const oil = gross * (1 - wc) * uplift;
  return { oil, wc, gross: gross * uplift, vib, espHealth, down: w.anomaly && gross === 0 };
}
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function fieldAt(t, opt) { const was = optimised, wasAt = optAt; if (opt !== undefined) { optimised = opt; optAt = opt ? Math.min(wasAt || 4, t) : 0; } let oil = 0, liq = 0; for (const w of PRODS) { const s = wellState(w, t); oil += s.oil; liq += s.gross; } optimised = was; optAt = wasAt; return { oil, wc: liq ? 1 - oil / liq : 0, liq }; }

/* ---------- chart ---------- */
const chart = document.getElementById("chart");
function drawChart(t) {
  const W = 600, H = 110, top = 8, bot = 92, x = (yr) => (yr / 15) * W;
  const base = [], opt = [], wc = [];
  let maxOil = 1; for (let yr = 0; yr <= 15.001; yr += 0.25) { const f = fieldAt(yr, false); maxOil = Math.max(maxOil, f.oil * 1.12); }
  for (let yr = 0; yr <= 15.001; yr += 0.25) { const f = fieldAt(yr, false); base.push([x(yr), bot - (f.oil / maxOil) * (bot - top)]); wc.push([x(yr), bot - f.wc * (bot - top)]); if (optimised) { const g = optAt <= yr ? fieldAt(yr, true) : f; opt.push([x(yr), bot - (g.oil / maxOil) * (bot - top)]); } }
  const P = (a) => "M" + a.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
  let s = "";
  for (let i = 0; i <= 15; i += 3) s += `<path class="g" d="M${x(i)} ${top}V${bot}"/><text x="${Math.min(x(i) + 3, W - 30)}" y="106">Y${i}</text>`;
  s += `<path class="g" d="M0 ${bot}H${W}"/>`;
  s += `<path class="oil" d="${P(base)}L${W} ${bot}L0 ${bot}Z"/>`;
  s += `<path class="wat" d="${P(wc)}"/>`;
  if (opt.length) s += `<path class="opt" d="${P(opt)}"/>`;
  s += `<path class="cur" d="M${x(t).toFixed(1)} ${top - 4}V${bot}"/>`;
  chart.innerHTML = s;
}

/* ---------- side panel ---------- */
const side = { kind: document.getElementById("s-kind"), name: document.getElementById("s-name"), kv: document.getElementById("s-kv"), ln: document.getElementById("s-ln"), wl: document.getElementById("s-wl"), cur: document.getElementById("s-cur"), ai: document.getElementById("s-ai"), aiT: document.getElementById("s-ai-t"), aiP: document.getElementById("s-ai-p") };
let selected = null, selectedFac = null, selAsset = null, hiPart = -1, pinPart = -1;
const hiMat = new T.MeshStandardMaterial({ color: 0x6e56cf, emissive: 0x6e56cf, emissiveIntensity: 0.35, roughness: 0.55 });
function paintPart(a, i, on) { if (!a || i < 0) return; a.parts[i].g.traverse((o) => { if (!o.isMesh) return; if (on) { if (!o.userData.orig) { o.userData.orig = o.material; o.material = hiMat; } } else if (o.userData.orig) { o.material = o.userData.orig; delete o.userData.orig; } }); }
function setPart(i) { if (hiPart === i) return; paintPart(selAsset, hiPart, false); hiPart = i; paintPart(selAsset, hiPart, true); partEls.forEach((el, k) => el.toggleAttribute("data-on", k === i)); pdesc.textContent = i >= 0 && selAsset ? selAsset.parts[i].name + ": " + selAsset.parts[i].desc : "Hover or tap a component to see what it does."; }
const partsList = document.getElementById("s-parts"), pdesc = document.getElementById("s-pdesc"), exBtn = document.getElementById("explode");
let partEls = [];
function buildParts() {
  partsList.innerHTML = ""; partEls = [];
  if (!selAsset) { document.getElementById("s-parts-wrap").hidden = true; return; }
  document.getElementById("s-parts-wrap").hidden = false;
  selAsset.parts.forEach((p, i) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span>${p.name}${p.down ? " <em>downhole</em>" : ""}`; b.addEventListener("pointerenter", () => setPart(i)); b.addEventListener("focus", () => setPart(i)); b.addEventListener("pointerleave", () => setPart(pinPart)); b.addEventListener("click", () => { pinPart = pinPart === i ? -1 : i; if (!selAsset.open) openAsset(true); setPart(pinPart); }); li.appendChild(b); partsList.appendChild(li); partEls.push(b); });
  exBtn.setAttribute("aria-pressed", String(selAsset.open)); exBtn.textContent = selAsset.open ? "Put together" : "Take apart";
  setPart(-1);
}
function openAsset(on) { if (!selAsset) return; selAsset.open = on; exBtn.setAttribute("aria-pressed", String(on)); exBtn.textContent = on ? "Put together" : "Take apart"; if (on) {
    { const dist = Math.max(140, selAsset.size * 2.4); flyTo(selAsset.center.clone().add(new T.Vector3(selAsset.downhole ? -10 : 0, selAsset.size * 0.25, 0)), selAsset.downhole ? Math.max(dist, 240) : dist * 1.15, viewDirFor(selAsset, dist)); }
  } }
exBtn.addEventListener("click", () => openAsset(!(selAsset && selAsset.open)));
function selectAsset(a) {
  if (selAsset && selAsset !== a) { paintPart(selAsset, hiPart, false); hiPart = -1; selAsset.open = false; }
  selAsset = a; pinPart = -1;
  selected = a && a.well ? a.well : null;
  selectedFac = a && !a.well ? { name: a.name, kind: a.desc } : null;
  for (const x of WELLS) x.label.el.toggleAttribute("data-sel", x === selected);
  if (a) { const dist = Math.max(130, a.size * 2.2); flyTo(a.center.clone(), dist, viewDirFor(a, dist)); }
  tag.textContent = a ? a.name : "Field view";
  buildParts(); renderSide();
}
function select(w) { selectAsset(w ? w.asset : null); }
function selectFac(name) { selectAsset(facAsset(name)); }
function kvHtml(pairs) { return pairs.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join(""); }
function renderSide() {
  const t = year;
  if (selected && !selected.inj) {
    const s = wellState(selected, t);
    side.kind.textContent = selected.type; side.name.textContent = "Well " + selected.id;
    side.kv.innerHTML = kvHtml([["Oil", Math.round(s.oil).toLocaleString("en-US") + " bbl/d"], ["Water cut", Math.round(s.wc * 100) + "%"], ["Liquid", Math.round(s.gross).toLocaleString("en-US")], [selected.art === "esp" ? "Vibration" : "Strokes/min", selected.art === "esp" ? s.vib.toFixed(2) + " in/s" : String(selected.spm)]]);
    const ln = [], wl = []; let mx = 1; for (let yr = 0; yr <= 15; yr += 0.25) mx = Math.max(mx, wellState(selected, yr).oil);
    for (let yr = 0; yr <= 15; yr += 0.25) { const q = wellState(selected, yr); ln.push(((yr / 15) * 200).toFixed(1) + " " + (54 - (q.oil / mx) * 50).toFixed(1)); wl.push(((yr / 15) * 200).toFixed(1) + " " + (54 - q.wc * 50).toFixed(1)); }
    side.ln.setAttribute("d", "M" + ln.join("L")); side.wl.setAttribute("d", "M" + wl.join("L")); side.cur.setAttribute("d", `M${((t / 15) * 200).toFixed(1)} 0V56`);
    if (selected.anomaly) {
      if (optimised && optAt <= t) { side.ai.dataset.s = "fixed"; side.aiT.textContent = "AI · action applied"; side.aiP.textContent = "Drive slowed and change-out scheduled. Bearing wear growth cut by 60%; no unplanned shut-in."; }
      else if (s.down) { side.ai.dataset.s = "warn"; side.aiT.textContent = "Pump failed"; side.aiP.textContent = "ESP bearing seized in year 9. Well shut in, waiting on a workover rig."; }
      else if (s.vib > 0.16) { side.ai.dataset.s = "warn"; side.aiT.textContent = "AI · early warning"; side.aiP.textContent = `Vibration ${s.vib.toFixed(2)} in/s and rising with motor heat: bearing failure predicted in ≈ ${Math.max(0, 9 - t).toFixed(1)} years of run time. Apply optimisation to slow the drive.`; }
      else { side.ai.dataset.s = ""; side.aiT.textContent = "AI · normal"; side.aiP.textContent = "ESP running inside its learned envelope."; }
    } else { side.ai.dataset.s = s.wc > 0.6 ? "warn" : ""; side.aiT.textContent = s.wc > 0.6 ? "AI · high water cut" : "AI · normal"; side.aiP.textContent = s.wc > 0.6 ? "Flood front has broken through. Optimiser cuts this choke and shifts rate to drier wells." : "Producing on trend."; }
  } else if (selected && selected.inj) {
    const f = fieldAt(t);
    side.kind.textContent = selected.type; side.name.textContent = "Well " + selected.id;
    side.kv.innerHTML = kvHtml([["Injection", Math.round(f.liq * 1.05).toLocaleString("en-US") + " bbl/d"], ["Front", Math.round(Math.min(t * FRONT_SPEED, 400) * 7.5) + " m"], ["Pressure", (4200 - 600 * smooth(0, 4, t) + 350 * smooth(2, 8, t)).toFixed(0) + " psi"], ["Voidage", "1.05"]]);
    side.ln.setAttribute("d", ""); side.wl.setAttribute("d", ""); side.cur.setAttribute("d", "");
    side.ai.dataset.s = ""; side.aiT.textContent = "AI · pressure support"; side.aiP.textContent = "Injects 5% more than is produced to hold reservoir pressure; the blue front in the rock is the water it pushes.";
  } else {
    const f = fieldAt(t);
    side.kind.textContent = selectedFac ? "Facility" : "Field"; side.name.textContent = selectedFac ? selectedFac.name : "Field overview";
    side.kv.innerHTML = selectedFac ? kvHtml([["Detail", selectedFac.kind], ["Throughput", Math.round(f.liq).toLocaleString("en-US") + " bbl/d"]]) : kvHtml([["Wells", "6"], ["Oil", Math.round(f.oil).toLocaleString("en-US") + " bbl/d"], ["Water cut", Math.round(f.wc * 100) + "%"], ["Uptime", (wellState(WELLS[3], t).down ? 80 : 100) + "%"]]);
    side.ln.setAttribute("d", ""); side.wl.setAttribute("d", ""); side.cur.setAttribute("d", "");
    const warn = PRODS.some((w) => { const s = wellState(w, t); return (w.anomaly && s.vib > 0.16 && !(optimised && optAt <= t)) || s.down; });
    side.ai.dataset.s = optimised ? "fixed" : warn ? "warn" : "";
    side.aiT.textContent = optimised ? "AI · optimisation active" : warn ? "AI · 1 well needs attention" : "AI · field optimiser";
    side.aiP.textContent = optimised ? "Chokes rebalanced toward low-water-cut wells, P-04 drive slowed. Field oil up vs. base case." : warn ? "P-04's ESP vibration is climbing. Click it, or apply the optimisation." : "Watching 6 wells and the flood front.";
  }
}

/* ---------- camera views ---------- */
let fly = null;
function flyTo(target, dist, dir) {
  const d = dir || camera.position.clone().sub(controls.target).normalize();
  fly = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toT: target.clone(), toP: target.clone().add(d.clone().multiplyScalar(dist)) };
}
const VIEWS = {
  field: () => { flyTo(new T.Vector3(-10, -50, 0), 1080, new T.Vector3(0.6, 0.48, 0.64).normalize()); setXray(false); },
  sub: () => { flyTo(new T.Vector3(90, -100, 70), 520, new T.Vector3(0.55, 0.28, 0.79).normalize()); setXray(true); },
  fac: () => { flyTo(new T.Vector3(-120, 10, -30), 420, new T.Vector3(0.35, 0.5, 0.79).normalize()); setXray(false); },
  well: () => { flyTo(new T.Vector3(50, 10, -30), 330, new T.Vector3(0.75, 0.38, 0.54).normalize()); setXray(false); },
};
const tag = document.getElementById("tag");
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { document.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); tag.textContent = b.textContent + " view"; selectAsset(null); VIEWS[b.dataset.view](); }));

/* ---------- toggles ---------- */
let xray = true, showFlow = true;
const xBtn = document.getElementById("t-xray");
function setXray(on) { xray = on; xBtn.setAttribute("aria-pressed", String(on)); }
xBtn.addEventListener("click", () => setXray(!xray));
const fBtn = document.getElementById("t-flow");
fBtn.addEventListener("click", () => { showFlow = !showFlow; fBtn.setAttribute("aria-pressed", String(showFlow)); PIPES.forEach((p) => (p.dots.visible = showFlow)); });
const lBtn = document.getElementById("t-labels");
lBtn.addEventListener("click", () => { labelsEl.hidden = !labelsEl.hidden; lBtn.setAttribute("aria-pressed", String(!labelsEl.hidden)); });
const rBtn = document.getElementById("t-rot");
rBtn.addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; rBtn.setAttribute("aria-pressed", String(controls.autoRotate)); });
const optBtn = document.getElementById("optimise");
optBtn.addEventListener("click", () => { if (optimised) { optimised = false; optAt = 0; optBtn.textContent = "Apply AI optimisation"; } else { optimised = true; optAt = Math.min(year, 8.5); optBtn.textContent = "Undo AI optimisation"; } lastChart = -1; renderSide(); });

/* ---------- time ---------- */
const copyBtn = document.getElementById("dev-copy");
copyBtn.addEventListener("click", () => {
  const mail = document.getElementById("dev-mail").textContent;
  const ok = () => { copyBtn.textContent = "Copied"; setTimeout(() => (copyBtn.textContent = "Copy email"), 1600); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(document.getElementById("dev-mail")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); copyBtn.textContent = "Selected, press Ctrl+C"; };
  try { navigator.clipboard.writeText(mail).then(ok, fallback); } catch (e) { fallback(); }
});
const yearIn = document.getElementById("year"), yearOut = document.getElementById("year-o"), playBtn = document.getElementById("play");
let year = 0, playing = !still, lastChart = -1;
const setPlay = (on) => { playing = on; playBtn.setAttribute("aria-pressed", String(on)); playBtn.textContent = on ? "Pause" : "Play"; };
setPlay(playing);
playBtn.addEventListener("click", () => { if (!playing && year >= 15) year = 0; setPlay(!playing); });
yearIn.addEventListener("input", () => { setPlay(false); year = +yearIn.value; });

/* ---------- picking ---------- */
const ray = new T.Raycaster(), mouse = new T.Vector2();
let downAt = null;
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; controls.autoRotate = false; rBtn.setAttribute("aria-pressed", "false"); });
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!selAsset || !selAsset.open || e.pointerType === "touch" || e.buttons) return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  setPart(hit && hit.object.userData.asset === selAsset ? hit.object.userData.part : pinPart);
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  const hitA = hit && hit.object.userData.asset;
  if (hitA && hitA === selAsset && selAsset.open) { pinPart = hit.object.userData.part; setPart(pinPart); }
  else if (hitA) selectAsset(hitA);
  else selectAsset(null);
});

/* ---------- resize ---------- */
function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage); resize();
applyTheme(); darkQ.addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---------- loop ---------- */
const kOil = document.getElementById("k-oil"), kGas = document.getElementById("k-gas"), kWc = document.getElementById("k-wc"), kInj = document.getElementById("k-inj");
const setK = (el, v, u) => { const html = v + "<i>" + u + "</i>"; if (el.innerHTML !== html) el.innerHTML = html; };
let last = performance.now(), clock = 0, sideTick = 0, visible = true;
new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(stage);
const tmpM = new T.Matrix4(), tmpV = new T.Vector3(), tmpBox = new T.Box3();
const partLbls = Array.from({ length: 14 }, (_, i) => { const el = document.createElement("div"); el.className = "plbl"; el.style.display = "none"; el.addEventListener("pointerenter", () => setPart(i)); el.addEventListener("pointerleave", () => setPart(pinPart)); el.addEventListener("click", () => { pinPart = pinPart === i ? -1 : i; setPart(pinPart); }); labelsEl.appendChild(el); return el; });
let xrayK = 1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!visible) return;
  clock += dt;
  if (playing) { year += dt * 0.55; if (year >= 15) { year = 15; setPlay(false); } }
  if (Math.abs(+yearIn.value - year) > 0.02) yearIn.value = year.toFixed(2);
  yearOut.textContent = "Year " + year.toFixed(1);
  const f = fieldAt(year);
  setK(kOil, Math.round(f.oil).toLocaleString("en-US"), "bbl/d"); setK(kGas, ((f.oil * 800) / 1e6).toFixed(2), "MMscf/d"); setK(kWc, Math.round(f.wc * 100), "%"); setK(kInj, Math.round(f.liq * 1.05).toLocaleString("en-US"), "bbl/d");
  if (Math.abs(lastChart - year) > 0.05) { drawChart(year); lastChart = year; }
  sideTick += dt; if (sideTick > 0.25) { sideTick = 0; renderSide(); }
  resUniforms.uFront.value = year * FRONT_SPEED;
  resUniforms.uDrain.value = 18 + year * 7;
  resUniforms.uTime.value = clock;
  xrayK += ((xray ? 0.13 : 1) - xrayK) * Math.min(1, dt * 5);
  for (const m of xrayMats) { m.opacity = xrayK; m.transparent = xrayK < 0.999; m.depthWrite = xrayK > 0.6; }
  wellbores.visible = xrayK < 0.97;
  for (const w of WELLS) {
    if (w.inj) { w.label.sub.textContent = Math.round(f.liq * 1.05).toLocaleString("en-US") + " bbl/d in"; continue; }
    const s = wellState(w, year);
    w.label.sub.textContent = s.down ? "shut in" : Math.round(s.oil).toLocaleString("en-US") + " bbl/d · " + Math.round(s.wc * 100) + "% wc";
    const warn = (w.anomaly && s.vib > 0.16 && !(optimised && optAt <= year)) || s.down;
    w.label.el.dataset.s = warn ? "warn" : "ok";
    if (w.perf) w.perf.material.opacity = 0.18 + 0.35 * clamp(s.oil / w.q0, 0, 1) + 0.05 * Math.sin(clock * 3);
    if (w.halo) { w.halo.visible = warn; w.halo.scale.setScalar(1 + 0.5 * (0.5 + 0.5 * Math.sin(clock * 5))); }
    if (w.beacon) w.beacon.material.color.set(warn ? 0xe5484d : 0x2f9e64);
    w.rate = s.down ? 0 : clamp(s.gross / w.q0, 0.2, 1.4);
  }
  for (const [i, a] of animators.entries()) a(still ? 0 : dt, PRODS.filter((w) => w.art === "jack")[i].rate || 1);
  const flowScale = clamp(f.liq / 6000, 0.25, 1.4);
  for (const p of PIPES) {
    p.phase = (p.phase + dt * (p.kind === "gas" ? 0.09 : 0.05) * flowScale * (still ? 0 : 1) * (300 / p.len)) % 1;
    for (let i = 0; i < p.n; i++) { const u = (i / p.n + p.phase) % 1; p.path.getPointAt(u, tmpV); tmpM.makeTranslation(tmpV.x, tmpV.y, tmpV.z); p.dots.setMatrixAt(i, tmpM); }
    p.dots.instanceMatrix.needsUpdate = true;
  }
  for (const a of ASSETS) {
    const tgt = a === selAsset && a.open ? 1 : 0;
    if (a.ex.x === tgt && a.ex.v === 0) continue;
    if (still) { a.ex.x = tgt; a.ex.v = 0; } else { for (let k = 0; k < 4; k++) { const h = dt / 4; a.ex.v += ((tgt - a.ex.x) * 60 - a.ex.v * 13.5) * h; a.ex.x += a.ex.v * h; } if (Math.abs(tgt - a.ex.x) < 1e-3 && Math.abs(a.ex.v) < 1e-3) { a.ex.x = tgt; a.ex.v = 0; } }
    for (const p of a.parts) p.g.position.copy(p.dir).multiplyScalar(a.ex.x * (p.down ? 1 : a.spread || 1));
  }
  for (const a of ASSETS) if (a.downhole) a.downhole.visible = xrayK < 0.97 || a.ex.x > 0.04;
  flame.position.set(FLARE.x, 116, FLARE.z).add(flareTip.position);
  flameUni.uTime.value = clock; flameUni.uSize.value = 0.55 + 0.6 * clamp(f.oil / 5000, 0, 1);
  const a = clock * 0.18;
  drone.position.set(Math.cos(a) * 170 + 20, 70 + Math.sin(clock * 0.7) * 6, Math.sin(a) * 120);
  drone.rotation.y = -a + Math.PI / 2;
  drone.userData.rotors.forEach((r) => (r.rotation.y += dt * 40));
  if (fly) { fly.t = Math.min(1, fly.t + dt * 1.3); const e = 1 - Math.pow(1 - fly.t, 3); camera.position.lerpVectors(fly.fromP, fly.toP, e); controls.target.lerpVectors(fly.fromT, fly.toT, e); if (fly.t >= 1) fly = null; }
  controls.update();
  renderer.render(scene, camera);
  const rect = stage.getBoundingClientRect();
  const showParts = selAsset && selAsset.ex.x > 0.55 && !labelsEl.hidden;
  const placed = [];
  partLbls.forEach((el, i) => {
    const p = showParts ? selAsset.parts[i] : null;
    if (!p) { el.style.display = "none"; return; }
    tmpBox.setFromObject(p.g); tmpBox.getCenter(tmpV); tmpV.project(camera);
    if (tmpV.z > 1) { el.style.display = "none"; return; }
    el.style.display = ""; const t = String(i + 1).padStart(2, "0") + " " + p.name; if (el.textContent !== t) el.textContent = t;
    el.toggleAttribute("data-on", i === hiPart);
    const w = el.offsetWidth || 120;
    let x = ((tmpV.x + 1) / 2) * rect.width, y = ((1 - tmpV.y) / 2) * rect.height;
    for (let pass = 0; pass < 6; pass++) { const hit = placed.find((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 4 && Math.abs(q.y - y) < 21); if (!hit) break; y = hit.y + (y >= hit.y ? 21 : -21); }
    placed.push({ x, y, w });
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });
  if (showParts) for (const L of LBL) L.el.style.display = "none";
  else if (!labelsEl.hidden) for (const L of LBL) { tmpV.copy(L.pos).project(camera); const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05; L.el.style.display = vis ? "" : "none"; if (vis) L.el.style.transform = `translate(${((tmpV.x + 1) / 2) * rect.width}px, ${((1 - tmpV.y) / 2) * rect.height}px) translate(-50%, -100%)`; }
}
document.querySelectorAll(".lbl").forEach((el) => (el.style.left = "0px", el.style.top = "0px"));
VIEWS.field(); fly.t = 1; setXray(true);
renderSide(); drawChart(0);
requestAnimationFrame(frame);
})();
