/* VISUAL REPRESENTATION LAB — dependency-free MVP v0.2 */
(() => {
  "use strict";

  const STORAGE_KEY = "vrl-v02-projects";
  const MODULE_KEY = "vrl-v02-custom-modules";
  const appEl = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pathGet = (object, path) => path.split(".").reduce((value, part) => value?.[part], object);
  const pathSet = (object, path, value) => { const parts = path.split("."); const final = parts.pop(); const target = parts.reduce((item, part) => item[part], object); target[final] = value; };
  const attr = (value, mode = "controlled", source = "system", strength = 60) => ({ value, enabled: true, mode, source, strength });
  const modeLabel = (mode) => mode === "locked" ? "LOCKED" : mode === "controlled" ? "CONTROLLED" : "FREE";
  const intensity = (n) => n <= 20 ? "subtle" : n <= 40 ? "light" : n <= 60 ? "clear" : n <= 80 ? "strong" : "dominant";
  const now = () => new Date().toISOString();
  function toast(message) { toastEl.textContent = message; toastEl.classList.add("show"); clearTimeout(toast._timer); toast._timer = setTimeout(() => toastEl.classList.remove("show"), 2200); }

  const NODE_DEFS = {
    imageInput: { label: "Image Input", category: "Input", inputs: [], outputs: ["source image"] },
    referenceInput: { label: "Reference Input", category: "Input", inputs: [], outputs: ["reference images"] },
    representation: { label: "Representation", category: "Representation", inputs: ["intent", "attributes"], outputs: ["Representation State"] },
    referenceAnalyzer: { label: "Reference Analyzer", category: "Representation", inputs: ["reference image"], outputs: ["transferable attributes"] },
    attributeSelector: { label: "Attribute Selector", category: "Representation", inputs: ["analyzed attributes"], outputs: ["selected attributes"] },
    camera: { label: "Camera", category: "Control", inputs: ["base State"], outputs: ["camera State"] },
    lighting: { label: "Lighting", category: "Control", inputs: ["base State"], outputs: ["lighting State"] },
    material: { label: "Material", category: "Control", inputs: ["base State"], outputs: ["material State"] },
    atmosphere: { label: "Atmosphere", category: "Control", inputs: ["base State"], outputs: ["atmosphere State"] },
    altBuilder: { label: "Alt Builder", category: "Control", inputs: ["base State"], outputs: ["alternative States"] },
    regionMask: { label: "Region Mask", category: "Local Edit", inputs: ["source image"], outputs: ["selected Region"] },
    regionEdit: { label: "Region Edit", category: "Local Edit", inputs: ["source image", "base State", "selected Region"], outputs: ["edited instruction"] },
    ofat: { label: "OFAT", category: "Experiment", inputs: ["base State"], outputs: ["variant States"] },
    compare: { label: "Compare", category: "Experiment", inputs: ["generated variants"], outputs: ["comparison set"] },
    evaluation: { label: "Evaluation", category: "Experiment", inputs: ["results"], outputs: ["scores"] },
    compiler: { label: "Prompt Compiler", category: "Output", inputs: ["Representation State"], outputs: ["generation instruction"] },
    generator: { label: "Generator", category: "Output", inputs: ["generation instruction"], outputs: ["generated images"] },
  };

  const NODE_LIBRARY = {
    Input: ["imageInput", "referenceInput"],
    Representation: ["representation", "referenceAnalyzer", "attributeSelector"],
    Control: ["camera", "lighting", "material", "atmosphere"],
    "Local Edit": ["regionMask", "regionEdit"],
    Experiment: ["ofat", "compare", "evaluation"],
    Output: ["compiler", "generator"],
  };

  const CAMERA_PRESETS = {
    "Interior 24 Wide": { focalLengthMm: 24, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: true },
    "Interior 35 Natural": { focalLengthMm: 35, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: true },
    "Editorial 50": { focalLengthMm: 50, sensor: "Full Frame", cameraHeightMm: 1450, pitchDeg: 0, perspectiveCorrection: true },
    "Compressed 85": { focalLengthMm: 85, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: false },
  };
  const LIGHTING_PRESETS = {
    "Warm Dining 3000K": { colorTemperatureK: 3000, exposureEV: 0.2, softness: 70, contrast: 45, ambientLevel: 35, artificialLevel: 65, direction: "Mixed" },
    "Neutral Daylight": { colorTemperatureK: 5000, exposureEV: 0, softness: 65, contrast: 40, ambientLevel: 80, artificialLevel: 20, direction: "Side" },
    "Overcast Soft": { colorTemperatureK: 5500, exposureEV: 0.1, softness: 90, contrast: 25, ambientLevel: 90, artificialLevel: 10, direction: "Front" },
    "Night Restaurant": { colorTemperatureK: 2700, exposureEV: -0.4, softness: 55, contrast: 70, ambientLevel: 10, artificialLevel: 90, direction: "Mixed" },
  };

  const REFERENCE_PRESETS = {
    "Bare Paper Ink Line": { medium: ["black ink", 90], palette: ["monochrome", 100], detailDensity: ["very low", 80], texture: ["bare paper", 75], atmosphere: ["minimal", 55] },
    "Warm Nordic Interior": { palette: ["warm neutral", 75], lightingCharacter: ["soft warm daylight", 80], material: ["pale oak and lime plaster", 75], atmosphere: ["quiet domestic", 65] },
    "Night Restaurant": { palette: ["amber and deep brown", 80], lightingCharacter: ["low warm pools of light", 90], material: ["dark timber and brushed metal", 70], atmosphere: ["intimate", 80] },
    "Concrete Gallery": { palette: ["cool neutral", 70], lightingCharacter: ["diffuse overhead daylight", 75], material: ["exposed concrete", 90], atmosphere: ["minimal institutional", 65] },
  };

  function defaultRepresentation() {
    return {
      global: {
        content: {
          subject: attr("Refined contemporary dining interior", "controlled", "user", 100),
          geometry: attr("existing room geometry", "locked", "system", 100),
          majorLayout: attr("existing major layout", "locked", "system", 100),
          composition: attr("balanced interior composition", "locked", "system", 80),
          furniture: attr("coordinated dining furniture", "controlled", "system", 60),
        },
        appearance: {
          medium: attr("architectural visualization", "controlled", "system", 70),
          palette: attr("warm neutral", "controlled", "system", 65),
          detailDensity: attr("medium", "controlled", "system", 60),
          texture: attr("natural material texture", "controlled", "system", 60),
          lightingCharacter: attr("soft warm interior illumination", "controlled", "system", 65),
          atmosphere: attr("quiet and refined", "controlled", "system", 60),
          surfaceCharacter: attr("restrained matte surfaces", "controlled", "system", 65),
        },
        camera: {
          sensor: attr("Full Frame", "controlled", "system"),
          focalLengthMm: attr(35, "controlled", "system"),
          cameraHeightMm: attr(1500, "controlled", "system"),
          pitchDeg: attr(0, "controlled", "system"),
          yawDeg: attr(0, "controlled", "system"),
          rollDeg: attr(0, "controlled", "system"),
          verticalShift: attr(0, "controlled", "system"),
          aperture: attr(8, "free", "system"),
          focusDistanceM: attr(5, "free", "system"),
          aspectRatio: attr("4:3", "controlled", "system"),
          perspectiveCorrection: attr(true, "controlled", "system"),
        },
        lighting: {
          colorTemperatureK: attr(3000, "controlled", "system"),
          exposureEV: attr(0.2, "controlled", "system"),
          softness: attr(70, "controlled", "system"),
          contrast: attr(45, "controlled", "system"),
          ambientLevel: attr(35, "controlled", "system"),
          artificialLevel: attr(65, "controlled", "system"),
          direction: attr("Mixed", "controlled", "system"),
        },
        material: {
          primary: attr("pale oak", "controlled", "system", 70),
          secondary: attr("lime plaster", "controlled", "system", 60),
          finish: attr("matte", "controlled", "system", 70),
        },
      },
      regions: [],
    };
  }

  const templateConfigs = [
    {
      id: "interior-refine", title: "Interior Refine", purpose: "기존 인테리어 방향을 보존하며 재료·조명·분위기를 정교화합니다.",
      nodes: ["imageInput", "representation", "camera", "lighting", "material", "generator", "compare"],
      recommended: ["35mm · Full Frame · 높이 1500mm", "Pitch 0° · Perspective correction ON", "3000K · Exposure +0.2 · Softness 70"],
      locked: ["geometry", "major layout", "camera position", "composition"], editable: ["materials", "lighting", "atmosphere", "furniture", "surface character"],
    },
    {
      id: "alt-exploration", title: "Alt Exploration", purpose: "형상과 카메라는 보존하고 여러 표현 변수를 함께 바꾼 대안을 만듭니다.",
      nodes: ["imageInput", "representation", "altBuilder", "generator", "compare"],
      recommended: ["Alternatives 4", "Targets: material, palette, lighting, atmosphere", "Variation scope: coordinated"],
      locked: ["geometry", "camera", "major layout"], editable: ["materials", "palette", "lighting", "atmosphere", "furniture expression", "visual density"],
    },
    {
      id: "furniture-swap", title: "Furniture Swap", purpose: "선택한 가구만 지역 마스크 안에서 교체하거나 재료·색·형태를 수정합니다.",
      nodes: ["imageInput", "regionMask", "regionEdit", "generator", "compare"],
      recommended: ["Operation: Replace", "Region position/scale/orientation locked", "Outside mask unchanged"],
      locked: ["global camera", "global geometry", "global lighting", "composition"], editable: ["region material", "region color", "region form"],
    },
    {
      id: "camera-study", title: "Camera Study", purpose: "카메라 초점거리만 OFAT 방식으로 비교합니다.",
      nodes: ["imageInput", "camera", "ofat", "generator", "compare"],
      recommended: ["Focal length: 24 / 35 / 50 / 85mm", "Full Frame sensor", "Unrelated state unchanged"],
      locked: ["lighting", "materials", "geometry", "atmosphere"], editable: ["focal length"],
    },
    {
      id: "lighting-study", title: "Lighting Study", purpose: "색온도 또는 부드러움을 하나씩 변화시켜 조명 반응을 비교합니다.",
      nodes: ["imageInput", "lighting", "ofat", "generator", "compare"],
      recommended: ["CCT: 2700 / 3000 / 4000 / 5500K", "or Softness: 20 / 45 / 70 / 95", "Unrelated state unchanged"],
      locked: ["camera", "materials", "geometry", "composition"], editable: ["color temperature", "softness"],
    },
    {
      id: "reference-mix", title: "Reference Mix", purpose: "각 레퍼런스에서 선택한 속성만 하나의 Representation State로 병합합니다.",
      nodes: ["referenceInput", "referenceAnalyzer", "attributeSelector", "representation", "generator", "compare"],
      recommended: ["Reference A → lighting", "Reference B → material", "Reference C → palette", "Reference D → atmosphere"],
      locked: ["target content", "room geometry"], editable: ["transfer selections", "attribute strengths"],
    },
  ];

  const moduleConfigs = {
    "alt-exploration": { title: "Alt Exploration", category: "Explore", nodes: ["representation", "altBuilder", "generator", "compare"], inputs: ["base image", "base Representation State"], outputs: ["alternative variants", "comparison set"] },
    "reference-mix": { title: "Reference Mix", category: "Explore", nodes: ["referenceInput", "referenceAnalyzer", "attributeSelector", "representation"], inputs: ["reference images", "target State"], outputs: ["merged Representation State"] },
    "furniture-swap": { title: "Furniture Swap", category: "Edit", nodes: ["regionMask", "regionEdit", "generator", "compare"], inputs: ["source image", "base State", "selected Region"], outputs: ["edited image", "new experiment snapshot"] },
    "region-edit": { title: "Region Edit", category: "Edit", nodes: ["regionMask", "regionEdit", "generator"], inputs: ["source image", "selected Region"], outputs: ["edited image"] },
    "camera-study": { title: "Camera Study", category: "Study", nodes: ["camera", "ofat", "generator", "compare"], inputs: ["base image", "base Representation State"], outputs: ["generated variants", "comparison set"] },
    "lighting-study": { title: "Lighting Study", category: "Study", nodes: ["lighting", "ofat", "generator", "compare"], inputs: ["base image", "base Representation State"], outputs: ["generated variants", "comparison set"] },
  };

  function makeGraph(nodeTypes, moduleId = null, origin = { x: 120, y: 150 }) {
    const nodes = nodeTypes.map((type, index) => ({ id: uid("node"), type, label: NODE_DEFS[type].label, x: origin.x + index * 224, y: origin.y + (index % 2) * 32, moduleId, settings: defaultNodeSettings(type) }));
    const edges = nodes.slice(0, -1).map((node, index) => ({ id: uid("edge"), from: node.id, to: nodes[index + 1].id, moduleId }));
    return { nodes, edges };
  }

  function defaultNodeSettings(type) {
    if (type === "ofat") return { variable: "global.camera.focalLengthMm", values: "24, 35, 50, 85" };
    if (type === "altBuilder") return { alternatives: 4, scope: "materials, palette, lighting, atmosphere" };
    if (type === "referenceAnalyzer") return { preset: "Warm Nordic Interior", analyzed: [] };
    if (type === "attributeSelector") return { selected: [] };
    return {};
  }

  function applyTemplateState(state, templateId) {
    const g = state.global;
    const lock = (attribute) => { attribute.mode = "locked"; attribute.source = "template"; };
    if (["interior-refine", "alt-exploration", "furniture-swap", "camera-study", "lighting-study"].includes(templateId)) { lock(g.content.geometry); lock(g.content.majorLayout); lock(g.content.composition); }
    if (["interior-refine", "alt-exploration", "furniture-swap", "lighting-study"].includes(templateId)) Object.values(g.camera).forEach(lock);
    if (["furniture-swap", "camera-study"].includes(templateId)) Object.values(g.lighting).forEach(lock);
    if (templateId === "camera-study") { g.camera.focalLengthMm.mode = "controlled"; g.camera.focalLengthMm.source = "template"; }
    if (templateId === "lighting-study") { g.lighting.colorTemperatureK.mode = "controlled"; g.lighting.colorTemperatureK.source = "template"; }
    return state;
  }

  function createProject(templateId = null, name = null) {
    const template = templateConfigs.find((item) => item.id === templateId);
    const graph = makeGraph(template ? template.nodes : ["imageInput", "representation", "compiler", "generator", "compare"]);
    return {
      id: uid("project"), name: name || (template ? `${template.title} Project` : "Blank Project"), templateId,
      createdAt: now(), updatedAt: now(), sourceImage: null, referenceImages: [],
      representation: applyTemplateState(defaultRepresentation(), templateId), graph,
      experiments: [], selectedExperimentIds: [], selectedNodeId: graph.nodes[0]?.id || null,
      selectedNodeIds: [], activeRegionId: null, workspaceMode: "graph", debug: false,
    };
  }

  let store = { projects: [], activeProjectId: null };
  let customModules = [];
  let route = "landing";
  let selectedTemplateId = templateConfigs[0].id;
  let maskRuntime = { tool: "brush", size: 28, opacity: 0.55, visible: true, drawing: false, canvas: null, ctx: null };

  function activeProject() { return store.projects.find((project) => project.id === store.activeProjectId) || null; }
  function load() {
    try { store = JSON.parse(localStorage.getItem(STORAGE_KEY)) || store; } catch { store = { projects: [], activeProjectId: null }; }
    try { customModules = JSON.parse(localStorage.getItem(MODULE_KEY)) || []; } catch { customModules = []; }
    if (store.activeProjectId && activeProject()) route = "workspace";
  }
  function save(message = null) {
    const project = activeProject(); if (project) project.updatedAt = now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); localStorage.setItem(MODULE_KEY, JSON.stringify(customModules)); if (message) toast(message); }
    catch (error) { toast("저장 공간이 부족합니다. 큰 이미지를 제거하세요."); console.error(error); }
  }

  function sensorWidth(sensor) { return ({ "Full Frame": 36, "APS-C": 23.6, "Micro Four Thirds": 17.3 })[sensor] || 36; }
  function horizontalFovDeg(camera) {
    const width = sensorWidth(camera.sensor.value);
    return +(2 * Math.atan(width / (2 * camera.focalLengthMm.value)) * 180 / Math.PI).toFixed(1);
  }
  function focalFromFov(sensor, fov) { return +(sensorWidth(sensor) / (2 * Math.tan(fov * Math.PI / 360))).toFixed(1); }

  function translateCamera(camera) {
    const focal = camera.focalLengthMm.value;
    const view = focal <= 24 ? "strongly wide interior architectural view" : focal <= 35 ? "natural moderately wide interior architectural view" : focal <= 55 ? "natural interior perspective" : "compressed interior perspective with narrow field of view";
    const height = camera.cameraHeightMm.value < 1200 ? "low camera height" : camera.cameraHeightMm.value > 1750 ? "elevated camera height" : "eye-level camera";
    const pitch = Math.abs(camera.pitchDeg.value) <= 2 ? "camera kept level" : camera.pitchDeg.value > 0 ? "camera pitched upward" : "camera pitched downward";
    const perspective = camera.perspectiveCorrection.value ? "controlled two-point perspective; vertical lines preserved" : "natural perspective convergence allowed";
    return `${view}; ${height}; ${pitch}; ${perspective}; yaw ${camera.yawDeg.value} degrees; roll ${camera.rollDeg.value} degrees; aspect ratio ${camera.aspectRatio.value}.`;
  }

  function translateLighting(lighting) {
    const k = lighting.colorTemperatureK.value;
    const temperature = k < 3200 ? "warm interior illumination" : k < 4200 ? "warm-neutral interior illumination" : k < 5600 ? "neutral daylight-balanced illumination" : "cool daylight illumination";
    const balance = lighting.artificialLevel.value > lighting.ambientLevel.value + 15 ? "artificial lighting is dominant" : lighting.ambientLevel.value > lighting.artificialLevel.value + 15 ? "ambient daylight is dominant" : "ambient and artificial light are balanced";
    const soft = lighting.softness.value > 75 ? "very soft diffused shadows" : lighting.softness.value > 45 ? "moderately soft shadows" : "defined hard-edged shadows";
    return `${temperature}; ${balance}; ${soft}; ${lighting.direction.value.toLowerCase()} light direction; exposure ${lighting.exposureEV.value >= 0 ? "+" : ""}${lighting.exposureEV.value} EV; contrast ${lighting.contrast.value}/100.`;
  }

  function compileGlobal(representation) {
    const g = representation.global;
    const sections = [];
    const enabledText = (record) => Object.entries(record).filter(([, a]) => a.enabled).map(([key, a]) => `${key}: ${a.value} (${intensity(a.strength)} emphasis)`).join("; ");
    if (g.content.subject.enabled) sections.push({ id: "subject", label: "SUBJECT", text: `${g.content.subject.value}.` });
    sections.push({ id: "structure", label: "STRUCTURE", text: enabledText({ geometry: g.content.geometry, majorLayout: g.content.majorLayout, composition: g.content.composition, furniture: g.content.furniture }) + "." });
    sections.push({ id: "camera", label: "CAMERA", text: translateCamera(g.camera) });
    sections.push({ id: "lighting", label: "LIGHTING", text: translateLighting(g.lighting) });
    sections.push({ id: "material", label: "MATERIAL", text: enabledText(g.material) + "." });
    sections.push({ id: "representation", label: "REPRESENTATION", text: enabledText(g.appearance) + "." });
    const locked = [];
    walkAttributes(representation.global, (path, a) => { if (a.enabled && a.mode === "locked") locked.push(`${path} (${a.value})`); });
    if (locked.length) sections.push({ id: "preserve", label: "PRESERVE", text: `Preserve exactly: ${locked.join(", ")}.` });
    sections.push({ id: "exclusions", label: "EXCLUSIONS", text: "Do not add unrepresented objects, materials, styles, or generic aesthetic enhancement terms." });
    return { sections, prompt: sections.map((section) => `${section.label}:\n${section.text}`).join("\n\n") };
  }

  function compileRegionEdit(representation, region) {
    if (!region) return null;
    const attrs = Object.entries(region.attributes).filter(([, a]) => a?.enabled).map(([key, a]) => `${key}: ${a.value}`).join("; ");
    const preserved = Object.entries(region.preserve).filter(([, value]) => value).map(([key]) => key).join(", ");
    const instruction = [
      { id: "target", label: "TARGET", text: `${region.name} inside the selected mask.` },
      { id: "change", label: "CHANGE", text: `${region.operation.toUpperCase()}: ${region.instruction || attrs || "apply the explicitly controlled regional attributes"}.` },
      { id: "preserve", label: "PRESERVE", text: `Preserve exact ${preserved || "surrounding context"}; preserve global camera and room perspective.` },
      { id: "outside", label: "OUTSIDE MASK", text: "Keep all unselected pixels and scene elements visually unchanged." },
    ];
    return { sections: instruction, prompt: instruction.map((section) => `${section.label}:\n${section.text}`).join("\n\n") };
  }

  function walkAttributes(object, callback, prefix = "") {
    Object.entries(object).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && "value" in value && "mode" in value) callback(path, value);
      else if (value && typeof value === "object" && !Array.isArray(value)) walkAttributes(value, callback, path);
    });
  }

  function flattenState(representation) {
    const flat = {};
    walkAttributes(representation.global, (path, value) => { flat[`global.${path}`] = clone(value); });
    representation.regions.forEach((region) => {
      Object.entries(region).forEach(([key, value]) => {
        if (key === "maskDataUrl" || key === "referenceImages") return;
        if (key === "attributes") Object.entries(value).forEach(([attrKey, attrValue]) => { flat[`regions.${region.id}.attributes.${attrKey}`] = clone(attrValue); });
        else if (key === "preserve") Object.entries(value).forEach(([preserveKey, preserveValue]) => { flat[`regions.${region.id}.preserve.${preserveKey}`] = preserveValue; });
        else if (typeof value !== "object") flat[`regions.${region.id}.${key}`] = value;
      });
    });
    return flat;
  }

  function diffRepresentations(before, after) {
    const a = flattenState(before), b = flattenState(after), keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map((key) => ({ path: key, before: a[key], after: b[key] }));
  }

  function diffPrompts(before, after) {
    const ids = new Set([...before.sections.map((s) => s.id), ...after.sections.map((s) => s.id)]);
    return [...ids].map((id) => ({ id, before: before.sections.find((s) => s.id === id)?.text || "", after: after.sections.find((s) => s.id === id)?.text || "" })).filter((item) => item.before !== item.after);
  }

  function hash(text) { let value = 0; for (let i = 0; i < text.length; i++) value = ((value << 5) - value + text.charCodeAt(i)) | 0; return Math.abs(value); }
  function mockInteriorImage(representation, prompt, region = null) {
    const h = hash(prompt + "vrl-v02-fixed-seed");
    const g = representation.global, focal = g.camera.focalLengthMm.value, detail = g.appearance.detailDensity.strength;
    const wall = g.appearance.palette.value.includes("warm") ? "#d8cdbd" : g.appearance.palette.value.includes("cool") ? "#c7d0d0" : "#d6d5cf";
    const wood = region?.attributes?.material?.value?.includes("metal") ? "#aeb3b4" : g.material.primary.value.includes("dark") ? "#503c2e" : "#a47c50";
    const perspective = clamp((85 - focal) / 80, .1, .8);
    const lines = Array.from({ length: Math.max(3, Math.round(detail / 12)) }, (_, i) => `<line x1="${80 + i * 45}" y1="310" x2="${120 + i * 36}" y2="180" stroke="#564d42" opacity=".18"/>`).join("");
    const regionMark = region ? `<rect x="202" y="235" width="145" height="16" rx="2" fill="${wood}" stroke="#333"/><text x="205" y="226" font-family="monospace" font-size="9" fill="#8a2b22">REGION EDIT · ${esc(region.name)}</text>` : `<rect x="202" y="235" width="145" height="16" rx="2" fill="${wood}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="400"><rect width="560" height="400" fill="#eeeae1"/><path d="M50 55 L${270 - perspective * 70} 105 L510 55 V335 H50Z" fill="${wall}" stroke="#5c5b56"/><path d="M50 335 L${270 - perspective * 70} 285 L510 335 L560 400 H0Z" fill="#b9afa1"/>${lines}<rect x="105" y="115" width="115" height="150" fill="#b8ccce" stroke="#59676a"/><line x1="162" y1="115" x2="162" y2="265" stroke="#59676a"/>${regionMark}<path d="M220 251v72m110-72v72m-85-72v72m60-72v72" stroke="#473c33" stroke-width="4"/><circle cx="225" cy="270" r="18" fill="#64584f"/><circle cx="330" cy="270" r="18" fill="#64584f"/><text x="18" y="26" font-family="monospace" font-size="11" fill="#424741">MOCK INTERIOR · ${focal}MM · ${g.lighting.colorTemperatureK.value}K</text><text x="18" y="382" font-family="monospace" font-size="9" fill="#696d67">deterministic state visualization · ${h.toString(16).slice(0, 6)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  class MockImageProvider {
    constructor() { this.name = "mock"; }
    async generate({ representation, instruction }) { return [{ id: uid("image"), url: mockInteriorImage(representation, instruction.prompt), alt: "Deterministic mock interior result" }]; }
  }
  class MockImageEditProvider {
    constructor() { this.name = "mock-edit"; }
    async edit({ representation, region, instruction }) { return [{ id: uid("image"), url: mockInteriorImage(representation, instruction.prompt, region), alt: "Deterministic mock region edit result" }]; }
  }

  async function createExperiment(project, representation, name, parentExperimentId = null, region = null) {
    const instruction = region ? compileRegionEdit(representation, region) : compileGlobal(representation);
    const provider = region ? new MockImageEditProvider() : new MockImageProvider();
    const images = region ? await provider.edit({ sourceImage: project.sourceImage, mask: region.maskDataUrl, representation, region, instruction, references: region.referenceImages }) : await provider.generate({ representation, instruction });
    const previous = parentExperimentId ? project.experiments.find((item) => item.id === parentExperimentId) : project.experiments[0];
    const changed = previous ? diffRepresentations(previous.representationState, representation).map((item) => item.path) : [];
    return {
      id: uid("experiment"), name, timestamp: now(), parentExperimentId: previous?.id || null,
      sourceImages: { base: project.sourceImage, references: clone(project.referenceImages) },
      representationState: clone(representation), regionStates: clone(representation.regions), graphSnapshot: clone(project.graph),
      changedVariables: changed, compiledInstruction: instruction, provider: provider.name, generatedImages: images,
      evaluation: { targetFollowed: 3, preserved: 3, controllability: 3, notes: "", failureCause: "" },
    };
  }

  function render() {
    if (route === "landing") renderLanding(); else renderWorkspace();
  }

  function renderLanding() {
    const selected = templateConfigs.find((item) => item.id === selectedTemplateId) || templateConfigs[0];
    appEl.innerHTML = `<main class="landing">
      <header class="landing-head"><div><div class="eyebrow">VRL · MVP v0.2 · Local workspace</div><h1 class="title">VISUAL REPRESENTATION LAB</h1><p class="subtitle">명시적 Representation State를 노드, 프리셋, 워크플로 모듈로 제어하는 인테리어 시각화 실험 환경</p></div><div class="row wrap"><button class="btn" data-action="blank-project">＋ BLANK PROJECT</button>${store.projects.length ? `<button class="btn secondary" data-action="resume-project">최근 프로젝트 열기 (${store.projects.length})</button>` : ""}</div></header>
      <div class="spread" style="margin-top:28px"><div><div class="eyebrow">Recommended templates</div><p class="subtitle">템플릿은 프로젝트 생성 시 복제됩니다. 이후 템플릿 변경은 기존 프로젝트에 영향을 주지 않습니다.</p></div></div>
      <section class="launcher">${templateConfigs.map((template) => `<button class="template-card ${template.id === selected.id ? "active" : ""}" data-template="${template.id}"><div class="template-preview"></div><div class="template-body"><h3>${esc(template.title)}</h3><p>${esc(template.purpose)}</p><div class="template-facts"><div class="template-fact"><b>CONTROL</b><span>${esc(template.editable.slice(0, 3).join(" / "))}</span></div><div class="template-fact"><b>PRESERVE</b><span>${esc(template.locked.slice(0, 3).join(" / "))}</span></div><div class="template-fact"><b>DEFAULT</b><span>${esc(template.recommended[0])}</span></div></div></div></button>`).join("")}</section>
      <section class="template-detail"><div class="detail-panel"><div class="eyebrow">Template preview</div><h2 style="font-size:20px;margin:6px 0">${esc(selected.title).toUpperCase()}</h2><p class="subtitle">${esc(selected.purpose)}</p><div class="graph-mini">${selected.nodes.map((type, index) => `${index ? "<i>→</i>" : ""}<span>${esc(NODE_DEFS[type].label)}</span>`).join("")}</div><button class="btn accent" data-action="use-template" data-template="${selected.id}">USE TEMPLATE</button></div><div class="detail-panel"><div class="config-grid"><div class="config-block"><h4>Recommended settings</h4><p>${selected.recommended.map(esc).join("<br>")}</p></div><div class="config-block"><h4>Locked by default</h4><p>${selected.locked.map((item) => `<span class="badge locked">${esc(item)}</span>`).join("")}</p></div><div class="config-block"><h4>Editable</h4><p>${selected.editable.map((item) => `<span class="badge controlled">${esc(item)}</span>`).join("")}</p></div><div class="config-block"><h4>Reuse rule</h4><p>TEMPLATE → CLONE → PROJECT STATE<br><span class="mono">영구 의존성 없음</span></p></div></div></div></section>
    </main>`;
    appEl.querySelectorAll("[data-template]").forEach((el) => el.addEventListener("click", (event) => { if (event.currentTarget.dataset.action === "use-template") return; selectedTemplateId = event.currentTarget.dataset.template; renderLanding(); }));
    appEl.querySelector('[data-action="blank-project"]')?.addEventListener("click", () => startProject(null));
    appEl.querySelector('[data-action="resume-project"]')?.addEventListener("click", () => { store.activeProjectId = store.projects[0]?.id; route = "workspace"; save(); render(); });
    appEl.querySelector('[data-action="use-template"]')?.addEventListener("click", (event) => startProject(event.currentTarget.dataset.template));
  }

  function startProject(templateId) {
    const project = createProject(templateId);
    store.projects.unshift(project); store.activeProjectId = project.id; route = "workspace"; save("프로젝트를 생성했습니다."); render();
  }

  function renderWorkspace() {
    const project = activeProject();
    if (!project) { route = "landing"; render(); return; }
    appEl.innerHTML = `<div class="workspace">
      <header class="topbar"><div class="topbar-left"><button class="btn secondary small" data-action="home">← PROJECTS</button><input class="project-name" id="projectName" value="${esc(project.name)}"><span class="badge">${project.templateId ? esc(templateConfigs.find((t) => t.id === project.templateId)?.title || "TEMPLATE") : "BLANK"}</span></div><div class="topbar-right"><div class="view-switch"><button data-view-mode="graph" class="${(project.workspaceMode || "graph") === "graph" ? "active" : ""}">GRAPH</button><button data-view-mode="image" class="${project.workspaceMode === "image" ? "active" : ""}">IMAGE</button></div><select class="field" id="projectSelect" style="width:170px">${store.projects.map((item) => `<option value="${item.id}" ${item.id === project.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><button class="btn secondary small" data-action="generate">GENERATE</button><button class="btn secondary small ${project.debug ? "accent" : ""}" data-action="debug">DEBUG ${project.debug ? "ON" : "OFF"}</button></div></header>
      <div class="workspace-main"><aside class="library">${renderLibrary(project)}</aside>${renderCenterWorkspace(project)}<aside class="inspector" id="inspector">${renderInspector(project)}</aside></div>
      <section class="results-drawer">${renderResults(project)}</section>
    </div>`;
    bindWorkspace(project);
  }

  function renderCenterWorkspace(project) {
    if (project.workspaceMode === "image") return renderImageWorkspace(project);
    return `<section class="graph-shell"><div class="graph-canvas" id="graphCanvas"><div class="graph-toolbar"><button class="btn secondary small" data-action="add-default-node">＋ NODE</button><button class="btn secondary small" data-action="add-camera-module">＋ CAMERA STUDY</button><span class="mono" style="padding:5px">${project.graph.nodes.length} nodes · ${project.graph.edges.length} edges</span></div>${renderGraph(project)}</div></section>`;
  }

  function renderImageWorkspace(project) {
    const active = project.representation.regions.find((region) => region.id === project.activeRegionId) || null;
    const fallback = mockInteriorImage(project.representation, compileGlobal(project.representation).prompt);
    return `<section class="image-workspace"><div class="image-toolbar"><button class="btn secondary small ${maskRuntime.tool === "brush" ? "accent" : ""}" data-image-tool="brush">BRUSH</button><button class="btn secondary small ${maskRuntime.tool === "eraser" ? "accent" : ""}" data-image-tool="eraser">ERASE</button><label>SIZE <input id="imageBrushSize" type="range" min="5" max="120" value="${maskRuntime.size}"></label><button class="btn secondary small" data-action="image-clear">CLEAR</button><button class="btn accent small" data-action="image-done">DONE</button></div><div class="image-canvas-shell"><img src="${project.sourceImage || fallback}" alt="Interior visual editing canvas"><canvas id="imageModeMaskCanvas" width="1200" height="800" style="opacity:${maskRuntime.opacity}"></canvas></div><div class="image-region-list"><div class="eyebrow">Regions</div>${project.representation.regions.length ? project.representation.regions.map((region, index) => `<button data-image-region="${region.id}" class="${region.id === project.activeRegionId ? "active" : ""}">${String(index + 1).padStart(2, "0")} · ${esc(region.name)}</button>`).join("") : `<p class="mono">Brush로 대상을 선택한 뒤 Done을 누르세요.</p>`}</div></section>`;
  }

  function renderLibrary(project) {
    const modulesByCategory = Object.entries(moduleConfigs).reduce((groups, [id, module]) => { (groups[module.category] ||= []).push({ id, ...module }); return groups; }, {});
    return `<div class="panel-head"><div class="eyebrow">Node / Module Library</div><div class="mono">NODE ≠ PRESET ≠ MODULE</div></div><div class="panel-section"><h3>Nodes</h3>${Object.entries(NODE_LIBRARY).map(([category, types]) => `<div class="library-group"><h4>${esc(category)}</h4>${types.map((type) => `<button class="library-item" data-add-node="${type}"><span>${esc(NODE_DEFS[type].label)}</span><span class="plus">＋</span></button>`).join("")}</div>`).join("")}</div>
      <div class="panel-section"><h3>Modules</h3>${Object.entries(modulesByCategory).map(([category, modules]) => `<div class="library-group"><h4>${esc(category)}</h4>${modules.map((module) => `<button class="module-item" data-add-module="${module.id}"><b>＋ ${esc(module.title)}</b><span>${module.nodes.map((type) => NODE_DEFS[type].label).join(" → ")}</span></button>`).join("")}</div>`).join("")}</div>
      <div class="panel-section"><h3>Custom modules</h3><button class="btn secondary" style="width:100%" data-action="save-module" ${project.selectedNodeIds.length ? "" : "disabled"}>SAVE SELECTION AS MODULE</button><div style="margin-top:8px">${customModules.length ? customModules.map((module) => `<button class="module-item" data-add-custom="${module.id}"><b>＋ ${esc(module.title)}</b><span>${module.nodes.length} cloned nodes</span></button>`).join("") : `<div class="mono">노드를 체크해 선택한 뒤 저장합니다.</div>`}</div></div>`;
  }

  function moduleBounds(project, moduleId) {
    const nodes = project.graph.nodes.filter((node) => node.moduleId === moduleId);
    if (!nodes.length) return null;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    return { x: Math.min(...xs) - 22, y: Math.min(...ys) - 30, width: Math.max(...xs) - Math.min(...xs) + 228, height: Math.max(...ys) - Math.min(...ys) + 148 };
  }

  function renderGraph(project) {
    const modules = [...new Set(project.graph.nodes.map((node) => node.moduleId).filter(Boolean))];
    const groups = modules.map((moduleId) => { const bounds = moduleBounds(project, moduleId); const title = project.graph.nodes.find((n) => n.moduleId === moduleId)?.moduleTitle || "MODULE"; return `<div class="module-group" style="left:${bounds.x}px;top:${bounds.y}px;width:${bounds.width}px;height:${bounds.height}px"><span class="module-label">${esc(title)}</span></div>`; }).join("");
    const edges = `<svg class="edge-layer" viewBox="0 0 1800 1100" preserveAspectRatio="none">${project.graph.edges.map((edge) => { const a = project.graph.nodes.find((n) => n.id === edge.from), b = project.graph.nodes.find((n) => n.id === edge.to); if (!a || !b) return ""; const x1 = a.x + 184, y1 = a.y + 39, x2 = b.x, y2 = b.y + 39, bend = Math.max(40, Math.abs(x2 - x1) * .45); return `<path class="edge ${edge.moduleId ? "module" : ""}" d="M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}"/>`; }).join("")}</svg>`;
    const nodes = project.graph.nodes.map((node) => { const def = NODE_DEFS[node.type] || { category: "Custom", inputs: [], outputs: [] }; const active = node.id === project.selectedNodeId, selected = project.selectedNodeIds.includes(node.id); return `<article class="node ${active ? "active" : ""} ${selected ? "selected" : ""}" data-node-id="${node.id}" data-category="${esc(def.category)}" style="left:${node.x}px;top:${node.y}px"><span class="node-port in" title="${esc(def.inputs.join(", "))}"></span><div class="node-head"><input class="node-check" type="checkbox" ${selected ? "checked" : ""} title="Select for custom module"><span class="node-kind"></span><span class="node-title">${esc(node.label)}</span></div><div class="node-body">${nodeSummary(project, node)}</div><span class="node-port out" title="${esc(def.outputs.join(", "))}"></span></article>`; }).join("");
    return groups + edges + nodes;
  }

  function nodeSummary(project, node) {
    const g = project.representation.global;
    if (node.type === "camera") return `<div class="node-metric"><span>Focal Length</span><strong>${g.camera.focalLengthMm.value} mm</strong></div><div class="node-metric"><span>Height</span><strong>${g.camera.cameraHeightMm.value} mm</strong></div><div class="node-metric"><span>Pitch</span><strong>${g.camera.pitchDeg.value}°</strong></div>`;
    if (node.type === "lighting") return `<div class="node-metric"><span>Temperature</span><strong>${g.lighting.colorTemperatureK.value} K</strong></div><div class="node-metric"><span>Exposure</span><strong>${g.lighting.exposureEV.value >= 0 ? "+" : ""}${g.lighting.exposureEV.value} EV</strong></div><div class="node-metric"><span>Softness</span><strong>${g.lighting.softness.value}</strong></div>`;
    if (node.type === "regionMask") return `${project.representation.regions.length} region(s)<br>independent mask`;
    if (node.type === "regionEdit") return project.activeRegionId ? `active: ${esc(project.representation.regions.find((r) => r.id === project.activeRegionId)?.name || "region")}` : "select or create region";
    if (node.type === "ofat") return `${esc(node.settings.variable?.split(".").pop() || "variable")}<br>${esc(node.settings.values || "")}`;
    if (node.type === "generator") return `mock provider<br>${project.experiments.length} snapshots`;
    if (node.type === "imageInput") return project.sourceImage ? "source attached" : "no image · mock ready";
    return `${NODE_DEFS[node.type]?.inputs.length || 0} in · ${NODE_DEFS[node.type]?.outputs.length || 0} out`;
  }

  function selectedNode(project) { return project.graph.nodes.find((node) => node.id === project.selectedNodeId) || null; }

  function renderInspector(project) {
    const node = selectedNode(project);
    if (!node) return `<div class="panel-head"><div class="eyebrow">Inspector</div></div><div class="panel-section"><div class="empty">그래프에서 노드를 선택하세요.</div></div>`;
    const def = NODE_DEFS[node.type] || { category: "Custom", inputs: [], outputs: [] };
    let body = "";
    if (node.type === "camera") body = renderCameraInspector(project, node);
    else if (node.type === "lighting") body = renderLightingInspector(project, node);
    else if (["representation", "material", "atmosphere"].includes(node.type)) body = renderRepresentationInspector(project, node);
    else if (node.type === "imageInput") body = renderImageInputInspector(project, node);
    else if (["referenceInput", "referenceAnalyzer", "attributeSelector"].includes(node.type)) body = renderReferenceInspector(project, node);
    else if (node.type === "regionMask") body = renderMaskInspector(project, node);
    else if (node.type === "regionEdit") body = renderRegionEditInspector(project, node);
    else if (node.type === "ofat") body = renderOfatInspector(project, node);
    else if (node.type === "altBuilder") body = renderAltInspector(project, node);
    else if (node.type === "compiler") body = renderCompilerInspector(project, node);
    else if (node.type === "generator") body = renderGeneratorInspector(project, node);
    else body = `<div class="panel-section"><div class="empty">이 노드는 현재 그래프 흐름과 메타데이터를 제공합니다.</div></div>`;
    return `<div class="panel-head"><div class="spread"><div><h2 class="inspector-title">${esc(node.label)}</h2><div class="inspector-type">${esc(def.category)} · NODE INSTANCE ${node.id.slice(-6)}</div></div><button class="btn danger small" data-delete-node="${node.id}">DELETE</button></div></div>${body}<div class="panel-section"><h3>Module port contract</h3><div class="port-contract"><b>INPUT</b><span>${def.inputs.length ? def.inputs.map(esc).join(" · ") : "none"}</span><hr class="divider"><b>OUTPUT</b><span>${def.outputs.length ? def.outputs.map(esc).join(" · ") : "none"}</span></div>${node.moduleId ? `<p class="mono">MODULE: ${esc(node.moduleTitle)} · cloned instance ${node.moduleId.slice(-6)}</p>` : ""}</div>${project.debug ? `<div class="panel-section"><h3>Debug node / state</h3><pre class="json">${esc(JSON.stringify({ node, representation: project.representation }, null, 2))}</pre></div>` : ""}`;
  }

  function modeSwitch(path, attribute) {
    return `<div class="mode-switch">${["locked", "controlled", "free"].map((mode) => `<button class="${attribute.mode === mode ? `active ${mode}` : ""}" data-mode-path="${path}" data-mode="${mode}">${mode === "locked" ? "LOCK" : mode === "controlled" ? "CTRL" : "FREE"}</button>`).join("")}</div>`;
  }

  function attributeControl(project, path, label, config = {}) {
    const attribute = pathGet(project.representation, path);
    if (!attribute) return "";
    const disabled = attribute.mode === "locked" ? "disabled" : "";
    let input;
    if (config.type === "select") input = `<select class="field" data-attr-path="${path}" ${disabled}>${config.options.map((option) => `<option value="${esc(option)}" ${String(attribute.value) === String(option) ? "selected" : ""}>${esc(option)}</option>`).join("")}</select>`;
    else if (config.type === "boolean") input = `<button class="btn secondary small" data-boolean-path="${path}">${attribute.value ? "ON" : "OFF"}</button>`;
    else if (config.type === "range") input = `<div class="range-line"><input type="range" data-attr-path="${path}" min="${config.min}" max="${config.max}" step="${config.step ?? 1}" value="${attribute.value}"><output>${attribute.value}${config.unit || ""}</output></div>`;
    else input = `<input class="field" data-attr-path="${path}" value="${esc(attribute.value)}">`;
    return `<div class="attribute"><div class="attribute-top"><div><div class="attribute-name">${esc(label)}</div><div class="mono">${esc(attribute.source)} · ${modeLabel(attribute.mode)}</div></div>${modeSwitch(path, attribute)}</div>${input}${config.strength === false ? "" : `<div class="range-line" style="margin-top:6px"><input type="range" data-strength-path="${path}" min="0" max="100" value="${attribute.strength}" ${disabled}><output>strength ${attribute.strength}</output></div>`}</div>`;
  }

  function renderCameraInspector(project) {
    const c = project.representation.global.camera;
    return `<div class="panel-section"><h3>Camera preset</h3><div class="preset-row"><select class="field" id="cameraPreset">${Object.keys(CAMERA_PRESETS).map((name) => `<option>${esc(name)}</option>`).join("")}</select><button class="btn secondary small" data-action="apply-camera-preset">APPLY</button></div><p class="mono">프리셋 적용 후 모든 값은 편집 가능합니다.</p></div><div class="panel-section"><h3>Physical camera state</h3>
      ${attributeControl(project, "global.camera.sensor", "Sensor", { type: "select", options: ["Full Frame", "APS-C", "Micro Four Thirds"], strength: false })}
      ${attributeControl(project, "global.camera.focalLengthMm", "Focal Length", { type: "range", min: 14, max: 135, step: 1, unit: "mm", strength: false })}
      <div class="attribute"><div class="attribute-top"><div><div class="attribute-name">Derived horizontal FOV</div><div class="mono">sensor + focal length · never independent</div></div></div><div class="range-line"><input type="range" id="fovInput" min="15" max="100" step="0.1" value="${horizontalFovDeg(c)}" ${c.focalLengthMm.mode === "locked" ? "disabled" : ""}><output>${horizontalFovDeg(c)}°</output></div></div>
      ${attributeControl(project, "global.camera.cameraHeightMm", "Camera Height", { type: "range", min: 900, max: 2000, step: 10, unit: "mm", strength: false })}
      ${attributeControl(project, "global.camera.pitchDeg", "Pitch", { type: "range", min: -20, max: 20, step: 1, unit: "°", strength: false })}
      ${attributeControl(project, "global.camera.perspectiveCorrection", "Perspective Correction", { type: "boolean", strength: false })}
      ${attributeControl(project, "global.camera.aspectRatio", "Aspect Ratio", { type: "select", options: ["4:3", "3:2", "16:9", "1:1"], strength: false })}
      <details><summary class="mono" style="cursor:pointer;padding:12px 0">ADVANCED CAMERA</summary>${attributeControl(project, "global.camera.yawDeg", "Yaw", { type: "range", min: -90, max: 90, step: 1, unit: "°", strength: false })}${attributeControl(project, "global.camera.rollDeg", "Roll", { type: "range", min: -10, max: 10, step: 1, unit: "°", strength: false })}${attributeControl(project, "global.camera.verticalShift", "Vertical Shift", { type: "range", min: -100, max: 100, step: 1, strength: false })}${attributeControl(project, "global.camera.aperture", "Aperture", { type: "range", min: 1.4, max: 16, step: 0.1, unit: " f/", strength: false })}${attributeControl(project, "global.camera.focusDistanceM", "Focus Distance", { type: "range", min: 0.5, max: 30, step: 0.5, unit: "m", strength: false })}</details></div><div class="panel-section"><h3>Model translation</h3><p style="font-size:11px;line-height:1.6">${esc(translateCamera(c))}</p></div>`;
  }

  function renderLightingInspector(project) {
    const l = project.representation.global.lighting;
    return `<div class="panel-section"><h3>Lighting preset</h3><div class="preset-row"><select class="field" id="lightingPreset">${Object.keys(LIGHTING_PRESETS).map((name) => `<option>${esc(name)}</option>`).join("")}</select><button class="btn secondary small" data-action="apply-lighting-preset">APPLY</button></div></div><div class="panel-section"><h3>Explicit lighting state</h3>
      ${attributeControl(project, "global.lighting.colorTemperatureK", "Color Temperature", { type: "range", min: 2700, max: 6500, step: 100, unit: "K", strength: false })}
      ${attributeControl(project, "global.lighting.exposureEV", "Exposure", { type: "range", min: -3, max: 3, step: 0.1, unit: " EV", strength: false })}
      ${attributeControl(project, "global.lighting.softness", "Softness", { type: "range", min: 0, max: 100, strength: false })}
      ${attributeControl(project, "global.lighting.contrast", "Contrast", { type: "range", min: 0, max: 100, strength: false })}
      ${attributeControl(project, "global.lighting.ambientLevel", "Ambient", { type: "range", min: 0, max: 100, strength: false })}
      ${attributeControl(project, "global.lighting.artificialLevel", "Artificial", { type: "range", min: 0, max: 100, strength: false })}
      ${attributeControl(project, "global.lighting.direction", "Direction", { type: "select", options: ["Front", "Side", "Back", "Top", "Mixed"], strength: false })}</div><div class="panel-section"><h3>Model translation</h3><p style="font-size:11px;line-height:1.6">${esc(translateLighting(l))}</p></div>`;
  }

  function renderRepresentationInspector(project, node) {
    const showMaterial = node.type === "material", showAtmosphere = node.type === "atmosphere";
    if (showMaterial) return `<div class="panel-section"><h3>Material state</h3>${attributeControl(project, "global.material.primary", "Primary Material")}${attributeControl(project, "global.material.secondary", "Secondary Material")}${attributeControl(project, "global.material.finish", "Finish")}${attributeControl(project, "global.appearance.surfaceCharacter", "Surface Character")}</div>`;
    if (showAtmosphere) return `<div class="panel-section"><h3>Atmosphere state</h3>${attributeControl(project, "global.appearance.atmosphere", "Atmosphere")}${attributeControl(project, "global.appearance.palette", "Palette")}${attributeControl(project, "global.appearance.detailDensity", "Visual Density")}</div>`;
    return `<div class="panel-section"><h3>Global content / preservation</h3>${attributeControl(project, "global.content.subject", "Interior Subject")}${attributeControl(project, "global.content.geometry", "Room Geometry")}${attributeControl(project, "global.content.majorLayout", "Major Layout")}${attributeControl(project, "global.content.composition", "Composition")}${attributeControl(project, "global.content.furniture", "Furniture")}</div><div class="panel-section"><h3>Representation appearance</h3>${attributeControl(project, "global.appearance.medium", "Medium")}${attributeControl(project, "global.appearance.palette", "Palette")}${attributeControl(project, "global.appearance.detailDensity", "Detail Density")}${attributeControl(project, "global.appearance.texture", "Texture")}${attributeControl(project, "global.appearance.lightingCharacter", "Lighting Character")}${attributeControl(project, "global.appearance.atmosphere", "Atmosphere")}${attributeControl(project, "global.appearance.surfaceCharacter", "Surface Character")}</div>`;
  }

  function renderImageInputInspector(project) {
    return `<div class="panel-section"><h3>Source image</h3><input class="field" type="file" accept="image/*" id="sourceImageInput">${project.sourceImage ? `<img src="${project.sourceImage}" alt="Source interior" style="width:100%;max-height:220px;object-fit:contain;margin-top:8px;border:1px solid var(--line)"><button class="btn danger small" data-action="clear-source" style="margin-top:7px">REMOVE IMAGE</button>` : `<div class="empty" style="margin-top:8px">이미지가 없어도 mock mode는 작동합니다.</div>`}<p class="mono">소스 이미지는 Representation State와 별도로 저장됩니다.</p></div>`;
  }

  function renderReferenceInspector(project, node) {
    const analyzerNode = node.type === "referenceAnalyzer" ? node : project.graph.nodes.find((item) => item.type === "referenceAnalyzer");
    const preset = analyzerNode?.settings.preset || "Warm Nordic Interior";
    const analyzed = analyzerNode?.settings.analyzed || [];
    return `<div class="panel-section"><h3>Reference inputs</h3><input class="field" type="file" accept="image/*" multiple id="referenceImageInput"><div class="row wrap" style="margin-top:8px">${project.referenceImages.map((image, index) => `<img src="${image}" alt="Reference ${index + 1}" style="width:64px;height:64px;object-fit:cover;border:1px solid var(--line)">`).join("") || `<span class="mono">이미지 없이 preset analyzer 사용 가능</span>`}</div></div><div class="panel-section"><h3>Mock reference analyzer</h3><select class="field" id="referencePreset">${Object.keys(REFERENCE_PRESETS).map((name) => `<option ${name === preset ? "selected" : ""}>${esc(name)}</option>`).join("")}</select><button class="btn secondary" data-action="analyze-reference" style="width:100%;margin-top:7px">ANALYZE / DECOMPOSE</button><p class="mono">CONTENT와 TRANSFERABLE ATTRIBUTE를 분리합니다.</p></div><div class="panel-section"><h3>Transferable attributes</h3>${analyzed.length ? analyzed.map((item) => `<div class="transfer-row"><div><b>${esc(item.key)}</b><br><span>${esc(item.value)} · ${item.strength}</span></div><button class="btn secondary small" data-transfer-key="${item.key}">TRANSFER</button></div>`).join("") : `<div class="empty">분석을 실행하세요.</div>`}</div>`;
  }

  function renderMaskInspector(project) {
    const regions = project.representation.regions;
    const active = project.activeRegionId ? regions.find((region) => region.id === project.activeRegionId) || null : null;
    return `<div class="panel-section"><h3>Selection mask editor</h3><div class="mask-stage" id="maskStage">${project.sourceImage ? `<img src="${project.sourceImage}" alt="Mask source">` : `<div class="empty" style="position:absolute;inset:20%;padding:15px">소스 이미지 없음<br>빈 캔버스에 마스크를 그릴 수 있습니다.</div>`}<canvas id="maskCanvas" width="640" height="480" style="opacity:${maskRuntime.opacity};${maskRuntime.visible ? "" : "display:none"}"></canvas></div><div class="mask-tools"><button class="btn secondary small ${maskRuntime.tool === "brush" ? "active" : ""}" data-mask-tool="brush">BRUSH</button><button class="btn secondary small ${maskRuntime.tool === "eraser" ? "active" : ""}" data-mask-tool="eraser">ERASER</button><button class="btn secondary small" data-action="clear-mask">CLEAR</button><button class="btn secondary small" data-action="toggle-mask">MASK ${maskRuntime.visible ? "VISIBLE" : "HIDDEN"}</button><button class="btn secondary small" data-action="new-region">＋ NEW REGION</button></div><label class="label">Brush size · ${maskRuntime.size}px</label><input type="range" id="brushSize" min="5" max="100" value="${maskRuntime.size}" style="width:100%"><label class="label">Mask opacity · ${Math.round(maskRuntime.opacity * 100)}%</label><input type="range" id="maskOpacity" min="10" max="100" value="${maskRuntime.opacity * 100}" style="width:100%"><label class="label">Region name</label><input class="field" id="newRegionName" value="${active ? esc(active.name) : "Dining Table"}"><button class="btn accent" data-action="create-region" style="width:100%;margin-top:8px">${active ? "UPDATE REGION MASK" : "CREATE REGION"}</button><p class="mono">마스크는 원본 이미지와 독립적인 PNG 데이터입니다.</p></div><div class="panel-section"><h3>Regions</h3>${regions.length ? regions.map((region) => `<button class="module-item" data-region-id="${region.id}" style="${region.id === project.activeRegionId ? "border-color:var(--accent)" : ""}"><b>${esc(region.name)}</b><span>${esc(region.operation)} · mask ${region.maskDataUrl ? "ready" : "empty"}</span></button>`).join("") : `<div class="empty">생성된 Region이 없습니다.</div>`}</div>`;
  }

  function renderRegionEditInspector(project) {
    const regions = project.representation.regions;
    const region = regions.find((item) => item.id === project.activeRegionId) || regions[0] || null;
    if (!region) return `<div class="panel-section"><div class="empty">Region Mask 노드에서 마스크를 그리고 Region을 먼저 생성하세요.</div></div>`;
    project.activeRegionId = region.id;
    const preserveKeys = ["position", "scale", "orientation", "geometry", "lighting", "surroundings"];
    return `<div class="panel-section"><h3>Active region</h3><select class="field" id="activeRegionSelect">${regions.map((item) => `<option value="${item.id}" ${item.id === region.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>${region.maskDataUrl ? `<img src="${region.maskDataUrl}" alt="Independent mask" style="width:100%;height:100px;object-fit:contain;background:#222;margin-top:8px">` : ""}</div><div class="panel-section"><h3>Region operation</h3><label class="label">Operation</label><select class="field" id="regionOperation">${["replace", "material", "color", "shape", "add", "remove", "custom"].map((op) => `<option ${region.operation === op ? "selected" : ""}>${op}</option>`).join("")}</select><label class="label">Instruction</label><textarea class="field" id="regionInstruction">${esc(region.instruction)}</textarea><label class="label">Material</label><input class="field" data-region-attribute="material" value="${esc(region.attributes.material.value)}"><label class="label">Color</label><input class="field" data-region-attribute="color" value="${esc(region.attributes.color.value)}"><label class="label">Form</label><input class="field" data-region-attribute="form" value="${esc(region.attributes.form.value)}"><label class="label">Texture</label><input class="field" data-region-attribute="texture" value="${esc(region.attributes.texture.value)}"><label class="label">Region reference image</label><input class="field" id="regionReferenceInput" type="file" accept="image/*">${region.referenceImages.map((image) => `<img src="${image}" alt="Region reference" style="width:62px;height:62px;object-fit:cover;margin:6px 5px 0 0">`).join("")}</div><div class="panel-section"><h3>Preservation</h3><div class="preserve-grid">${preserveKeys.map((key) => `<label class="checkline"><input type="checkbox" data-preserve="${key}" ${region.preserve[key] ? "checked" : ""}>${esc(key)}</label>`).join("")}</div></div><div class="panel-section"><h3>Local compiler</h3><div class="prompt-preview">${compileRegionEdit(project.representation, region).sections.map((section) => `<div class="attribute"><b class="mono">${section.label}</b><div style="font-size:11px;line-height:1.5">${esc(section.text)}</div></div>`).join("")}</div><button class="btn accent" data-action="generate-region" style="width:100%;margin-top:8px">GENERATE REGION EDIT</button></div>`;
  }

  function renderOfatInspector(project, node) {
    const paths = { "Camera · Focal Length": "global.camera.focalLengthMm", "Lighting · Color Temperature": "global.lighting.colorTemperatureK", "Lighting · Softness": "global.lighting.softness", "Lighting · Exposure": "global.lighting.exposureEV" };
    return `<div class="panel-section"><h3>One Factor At A Time</h3><label class="label">Variable</label><select class="field" id="ofatVariable">${Object.entries(paths).map(([label, path]) => `<option value="${path}" ${node.settings.variable === path ? "selected" : ""}>${esc(label)}</option>`).join("")}</select><label class="label">Values</label><input class="field" id="ofatValues" value="${esc(node.settings.values)}"><p class="mono">선택한 Attribute.value만 변경합니다. mode, source와 모든 다른 상태는 동일하게 유지됩니다.</p><button class="btn accent" data-action="run-ofat" style="width:100%">RUN OFAT SERIES</button></div>`;
  }

  function renderAltInspector(project, node) {
    return `<div class="panel-section"><h3>Coordinated divergence</h3><label class="label">Number of alternatives</label><input class="field" id="altCount" type="number" min="2" max="8" value="${node.settings.alternatives || 4}"><label class="label">Variation scope</label><textarea class="field" id="altScope">${esc(node.settings.scope || "materials, palette, lighting, atmosphere")}</textarea><p class="mono">ALT EXPLORATION은 여러 변수의 의도적 동시 변경을 허용하는 유일한 기본 모듈입니다.</p><button class="btn accent" data-action="run-alt" style="width:100%">GENERATE ALTERNATIVES</button></div>`;
  }

  function renderCompilerInspector(project) {
    const compiled = compileGlobal(project.representation);
    return `<div class="panel-section"><h3>Deterministic compiler</h3>${compiled.sections.map((section) => `<div class="attribute"><b class="mono">${section.label}</b><div style="font-size:11px;line-height:1.5">${esc(section.text)}</div></div>`).join("")}</div>`;
  }

  function renderGeneratorInspector(project) {
    return `<div class="panel-section"><h3>Image provider</h3><div class="port-contract"><b>ACTIVE PROVIDER</b><span>MockImageProvider</span><hr class="divider"><b>MODE</b><span>deterministic SVG interior visualization</span></div><button class="btn accent" data-action="generate" style="width:100%;margin-top:8px">GENERATE SNAPSHOT</button><p class="mono">실제 provider는 동일한 generation request 계약을 구현하면 연결할 수 있습니다.</p></div>`;
  }

  function displayDiffValue(value) {
    if (value === undefined) return "∅";
    if (value && typeof value === "object" && "value" in value) return `${value.value} [${value.mode}]`;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  function renderResults(project) {
    const compared = project.selectedExperimentIds.map((id) => project.experiments.find((item) => item.id === id)).filter(Boolean);
    let comparison = "";
    if (compared.length === 2) {
      const stateDiff = diffRepresentations(compared[0].representationState, compared[1].representationState);
      const promptDiff = diffPrompts(compared[0].compiledInstruction, compared[1].compiledInstruction);
      comparison = `<div class="compare-panel"><div class="diff-block"><div class="eyebrow">State difference</div>${stateDiff.length ? stateDiff.map((item) => `<div class="diff-item"><b>${esc(item.path)}</b><br><code>${esc(displayDiffValue(item.before))} → ${esc(displayDiffValue(item.after))}</code></div>`).join("") : `<div class="diff-item">UNCHANGED</div>`}<span class="badge ${stateDiff.length === 1 ? "controlled" : "changed"}">${stateDiff.length === 1 ? "ONE FACTOR" : `${stateDiff.length} CHANGES`}</span></div><div class="diff-block"><div class="eyebrow">Compiler section difference</div>${promptDiff.length ? promptDiff.map((item) => `<div class="diff-item"><b>${esc(item.id)}</b><br><s>${esc(item.before)}</s><br><span style="color:var(--green)">${esc(item.after)}</span></div>`).join("") : `<div class="diff-item">IDENTICAL PROMPT</div>`}</div></div>`;
    }
    return `<div class="results-head"><div><span class="eyebrow">Generation / experiment results</span> <span class="badge">${project.experiments.length} SNAPSHOTS</span></div><div class="row"><span class="mono">두 결과를 선택해 diff</span><button class="btn secondary small" data-action="clear-results-selection">CLEAR SELECTION</button></div></div><div class="results-grid">${comparison}${project.experiments.length ? project.experiments.map((item) => `<article class="result-card ${project.selectedExperimentIds.includes(item.id) ? "selected" : ""}" data-experiment-id="${item.id}"><img src="${item.generatedImages[0]?.url}" alt="${esc(item.generatedImages[0]?.alt || "Generated result")}" data-select-experiment="${item.id}"><div class="result-body"><div class="result-name">${esc(item.name)}</div><div class="mono">${new Date(item.timestamp).toLocaleString()} · ${esc(item.provider)}</div><div style="margin-top:5px">${item.changedVariables.length ? item.changedVariables.slice(0, 3).map((key) => `<span class="badge changed">${esc(key.split(".").slice(-2).join("."))}</span>`).join("") : `<span class="badge">BASELINE</span>`}</div><div class="result-actions"><button class="btn secondary small" data-load-experiment="${item.id}">LOAD</button><button class="btn danger small" data-delete-experiment="${item.id}">DELETE</button></div><details style="margin-top:6px"><summary class="mono" style="cursor:pointer">EVALUATION</summary><div class="evaluation">${["targetFollowed", "preserved", "controllability"].map((key) => `<label>${key}<select class="field" data-eval-id="${item.id}" data-eval-key="${key}">${[1,2,3,4,5].map((n) => `<option ${item.evaluation[key] === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>`).join("")}</div><select class="field" data-failure-id="${item.id}" style="margin-top:5px">${["", "Variable definition failure", "Reference analysis failure", "Representation merge failure", "Prompt compiler failure", "Generator unpredictability", "Preservation failure", "Unknown"].map((value) => `<option ${item.evaluation.failureCause === value ? "selected" : ""}>${value || "Failure cause…"}</option>`).join("")}</select><textarea class="field" data-notes-id="${item.id}" placeholder="Notes">${esc(item.evaluation.notes)}</textarea></details>${project.debug ? `<details><summary class="mono">SNAPSHOT JSON</summary><pre class="json">${esc(JSON.stringify(item, null, 2))}</pre></details>` : ""}</div></article>`).join("") : `<div class="empty" style="width:360px">Generator 노드 또는 상단 GENERATE를 눌러 첫 snapshot을 만드세요.</div>`}</div>`;
  }

  function addNode(project, type, position = null) {
    const count = project.graph.nodes.length;
    const node = { id: uid("node"), type, label: NODE_DEFS[type].label, x: position?.x ?? 160 + (count % 5) * 218, y: position?.y ?? 160 + Math.floor(count / 5) * 140, moduleId: null, settings: defaultNodeSettings(type) };
    project.graph.nodes.push(node); project.selectedNodeId = node.id; save("노드를 추가했습니다."); renderWorkspace();
  }

  function addModule(project, moduleId, custom = null) {
    const definition = custom || moduleConfigs[moduleId]; if (!definition) return;
    const instanceId = uid("module");
    if (custom) {
      const idMap = {};
      const minX = Math.min(...definition.nodes.map((n) => n.x)), minY = Math.min(...definition.nodes.map((n) => n.y));
      const baseX = 160 + (project.graph.nodes.length % 3) * 140, baseY = 440 + (project.graph.nodes.length % 4) * 80;
      const nodes = definition.nodes.map((source) => { const id = uid("node"); idMap[source.id] = id; return { ...clone(source), id, x: baseX + source.x - minX, y: baseY + source.y - minY, moduleId: instanceId, moduleTitle: definition.title }; });
      const edges = definition.edges.map((source) => ({ ...clone(source), id: uid("edge"), from: idMap[source.from], to: idMap[source.to], moduleId: instanceId }));
      project.graph.nodes.push(...nodes); project.graph.edges.push(...edges); project.selectedNodeId = nodes[0]?.id;
    } else {
      const origin = { x: 140 + (project.graph.nodes.length % 3) * 80, y: 420 + (project.graph.nodes.length % 4) * 110 };
      const graph = makeGraph(definition.nodes, instanceId, origin);
      graph.nodes.forEach((node) => { node.moduleTitle = definition.title; if (node.type === "ofat") { if (moduleId === "lighting-study") { node.settings.variable = "global.lighting.colorTemperatureK"; node.settings.values = "2700, 3000, 4000, 5500"; } } });
      project.graph.nodes.push(...graph.nodes); project.graph.edges.push(...graph.edges); project.selectedNodeId = graph.nodes[0]?.id;
    }
    save(`${definition.title} 모듈을 기존 그래프에 삽입했습니다.`); renderWorkspace();
  }

  function selectionConnected(project, selectedIds) {
    if (selectedIds.length < 2) return selectedIds.length === 1;
    const adjacency = Object.fromEntries(selectedIds.map((id) => [id, []]));
    project.graph.edges.filter((edge) => selectedIds.includes(edge.from) && selectedIds.includes(edge.to)).forEach((edge) => { adjacency[edge.from].push(edge.to); adjacency[edge.to].push(edge.from); });
    const seen = new Set([selectedIds[0]]), queue = [selectedIds[0]];
    while (queue.length) adjacency[queue.shift()].forEach((id) => { if (!seen.has(id)) { seen.add(id); queue.push(id); } });
    return seen.size === selectedIds.length;
  }

  function saveSelectionAsModule(project) {
    const ids = project.selectedNodeIds;
    if (!ids.length) return;
    if (!selectionConnected(project, ids)) { alert("연결된 노드만 Custom Workflow Module로 저장할 수 있습니다."); return; }
    const title = prompt("Custom Workflow Module 이름", "My Workflow Module"); if (!title) return;
    const nodes = clone(project.graph.nodes.filter((node) => ids.includes(node.id)));
    const edges = clone(project.graph.edges.filter((edge) => ids.includes(edge.from) && ids.includes(edge.to)));
    customModules.unshift({ id: uid("custom-module"), title, nodes, edges, createdAt: now(), inputs: ["base Representation State"], outputs: ["module result"] });
    save("Custom Module을 로컬에 저장했습니다."); renderWorkspace();
  }

  function bindWorkspace(project) {
    appEl.querySelector('[data-action="home"]')?.addEventListener("click", () => { route = "landing"; save(); render(); });
    appEl.querySelector("#projectName")?.addEventListener("change", (event) => { project.name = event.target.value.trim() || project.name; save("프로젝트 이름을 저장했습니다."); });
    appEl.querySelector("#projectSelect")?.addEventListener("change", (event) => { store.activeProjectId = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="debug"]')?.addEventListener("click", () => { project.debug = !project.debug; save(); renderWorkspace(); });
    appEl.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => { project.workspaceMode = button.dataset.viewMode; if (project.workspaceMode === "image") { const maskNode = project.graph.nodes.find((item) => item.type === "regionMask"); if (maskNode) project.selectedNodeId = maskNode.id; } save(); renderWorkspace(); }));
    appEl.querySelectorAll('[data-action="generate"]').forEach((button) => button.addEventListener("click", () => generateNormal(project)));
    appEl.querySelector('[data-action="clear-results-selection"]')?.addEventListener("click", () => { project.selectedExperimentIds = []; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="add-default-node"]')?.addEventListener("click", () => addNode(project, "representation"));
    appEl.querySelector('[data-action="add-camera-module"]')?.addEventListener("click", () => addModule(project, "camera-study"));
    appEl.querySelectorAll("[data-add-node]").forEach((button) => button.addEventListener("click", () => addNode(project, button.dataset.addNode)));
    appEl.querySelectorAll("[data-add-module]").forEach((button) => button.addEventListener("click", () => addModule(project, button.dataset.addModule)));
    appEl.querySelectorAll("[data-add-custom]").forEach((button) => button.addEventListener("click", () => addModule(project, null, customModules.find((module) => module.id === button.dataset.addCustom))));
    appEl.querySelector('[data-action="save-module"]')?.addEventListener("click", () => saveSelectionAsModule(project));
    bindGraph(project);
    if (project.workspaceMode === "image") bindImageWorkspace(project);
    bindInspector(project);
    bindResults(project);
  }

  function bindImageWorkspace(project) {
    const canvas = appEl.querySelector("#imageModeMaskCanvas"), ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const active = project.representation.regions.find((region) => region.id === project.activeRegionId);
    if (active?.maskDataUrl) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.src = active.maskDataUrl; }
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
    const draw = (event) => { if (!maskRuntime.drawing) return; const p = point(event); ctx.globalCompositeOperation = maskRuntime.tool === "eraser" ? "destination-out" : "source-over"; ctx.fillStyle = "rgba(37,89,77,1)"; ctx.beginPath(); ctx.arc(p.x, p.y, maskRuntime.size / 2, 0, Math.PI * 2); ctx.fill(); };
    canvas.addEventListener("pointerdown", (event) => { maskRuntime.drawing = true; canvas.setPointerCapture(event.pointerId); draw(event); }); canvas.addEventListener("pointermove", draw); canvas.addEventListener("pointerup", () => maskRuntime.drawing = false);
    appEl.querySelectorAll("[data-image-tool]").forEach((button) => button.addEventListener("click", () => { maskRuntime.tool = button.dataset.imageTool; appEl.querySelectorAll("[data-image-tool]").forEach((item) => item.classList.toggle("accent", item === button)); }));
    appEl.querySelector("#imageBrushSize")?.addEventListener("input", (event) => maskRuntime.size = Number(event.target.value));
    appEl.querySelector('[data-action="image-clear"]')?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    appEl.querySelector('[data-action="image-done"]')?.addEventListener("click", () => {
      const current = project.representation.regions.find((region) => region.id === project.activeRegionId); const data = canvas.toDataURL("image/png");
      if (current) current.maskDataUrl = data; else { const name = prompt("Region name", `Region ${String(project.representation.regions.length + 1).padStart(2, "0")}`) || "Region"; const region = blankRegion(name, data); project.representation.regions.push(region); project.activeRegionId = region.id; }
      const editNode = project.graph.nodes.find((item) => item.type === "regionEdit"); if (editNode) project.selectedNodeId = editNode.id;
      save("Region mask를 확정했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-image-region]").forEach((button) => button.addEventListener("click", () => { project.activeRegionId = button.dataset.imageRegion; save(); renderWorkspace(); }));
  }

  function bindGraph(project) {
    appEl.querySelectorAll(".node").forEach((element) => {
      const node = project.graph.nodes.find((item) => item.id === element.dataset.nodeId);
      const head = element.querySelector(".node-head"), checkbox = element.querySelector(".node-check");
      checkbox.addEventListener("click", (event) => { event.stopPropagation(); const id = node.id; project.selectedNodeIds = checkbox.checked ? [...new Set([...project.selectedNodeIds, id])] : project.selectedNodeIds.filter((item) => item !== id); save(); renderWorkspace(); });
      element.addEventListener("click", () => { project.selectedNodeId = node.id; save(); renderWorkspace(); });
      head.addEventListener("pointerdown", (event) => {
        if (event.target.closest("input")) return;
        event.preventDefault(); event.stopPropagation();
        project.selectedNodeId = node.id;
        const start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
        head.setPointerCapture(event.pointerId);
        const move = (moveEvent) => { node.x = clamp(start.nodeX + moveEvent.clientX - start.x, 20, 1620); node.y = clamp(start.nodeY + moveEvent.clientY - start.y, 50, 1000); element.style.left = `${node.x}px`; element.style.top = `${node.y}px`; };
        const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); save(); renderWorkspace(); };
        head.addEventListener("pointermove", move); head.addEventListener("pointerup", up);
      });
    });
  }

  function bindInspector(project) {
    const node = selectedNode(project); if (!node) return;
    appEl.querySelector("[data-delete-node]")?.addEventListener("click", () => {
      const id = node.id; project.graph.nodes = project.graph.nodes.filter((item) => item.id !== id); project.graph.edges = project.graph.edges.filter((edge) => edge.from !== id && edge.to !== id); project.selectedNodeIds = project.selectedNodeIds.filter((item) => item !== id); project.selectedNodeId = project.graph.nodes[0]?.id || null; save("노드를 삭제했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-mode-path]").forEach((button) => button.addEventListener("click", () => { const attribute = pathGet(project.representation, button.dataset.modePath); attribute.mode = button.dataset.mode; attribute.source = "user"; save(); renderWorkspace(); }));
    appEl.querySelectorAll("[data-attr-path]").forEach((input) => input.addEventListener(input.type === "range" ? "input" : "change", () => {
      const attribute = pathGet(project.representation, input.dataset.attrPath); const old = attribute.value;
      attribute.value = typeof old === "number" ? Number(input.value) : input.value; attribute.source = "user"; if (attribute.mode === "free") attribute.mode = "controlled";
      if (input.type === "range") input.nextElementSibling && (input.nextElementSibling.textContent = input.value + (input.nextElementSibling.textContent.match(/[a-zA-Z°]+$/)?.[0] || ""));
      save(); if (input.type !== "range") renderWorkspace(); else refreshGraphSummaries(project);
    }));
    appEl.querySelectorAll("[data-strength-path]").forEach((input) => input.addEventListener("input", () => { const attribute = pathGet(project.representation, input.dataset.strengthPath); attribute.strength = Number(input.value); attribute.source = "user"; input.nextElementSibling.textContent = `strength ${input.value}`; save(); }));
    appEl.querySelectorAll("[data-boolean-path]").forEach((button) => button.addEventListener("click", () => { const attribute = pathGet(project.representation, button.dataset.booleanPath); attribute.value = !attribute.value; attribute.source = "user"; save(); renderWorkspace(); }));
    bindNodeSpecificInspector(project, node);
  }

  function refreshGraphSummaries(project) {
    appEl.querySelectorAll(".node").forEach((element) => { const node = project.graph.nodes.find((item) => item.id === element.dataset.nodeId); const body = element.querySelector(".node-body"); if (node && body) body.innerHTML = nodeSummary(project, node); });
  }

  function bindNodeSpecificInspector(project, node) {
    appEl.querySelector('[data-action="apply-camera-preset"]')?.addEventListener("click", () => { const preset = CAMERA_PRESETS[appEl.querySelector("#cameraPreset").value]; Object.entries(preset).forEach(([key, value]) => { Object.assign(project.representation.global.camera[key], { value, source: "preset", mode: "controlled" }); }); save("Camera preset을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector('[data-action="apply-lighting-preset"]')?.addEventListener("click", () => { const preset = LIGHTING_PRESETS[appEl.querySelector("#lightingPreset").value]; Object.entries(preset).forEach(([key, value]) => { Object.assign(project.representation.global.lighting[key], { value, source: "preset", mode: "controlled" }); }); save("Lighting preset을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector("#fovInput")?.addEventListener("input", (event) => { const camera = project.representation.global.camera; camera.focalLengthMm.value = focalFromFov(camera.sensor.value, Number(event.target.value)); camera.focalLengthMm.source = "user"; event.target.nextElementSibling.textContent = `${event.target.value}°`; save(); refreshGraphSummaries(project); });
    appEl.querySelector("#sourceImageInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { project.sourceImage = images[0] || null; save("소스 이미지를 저장했습니다."); renderWorkspace(); }));
    appEl.querySelector('[data-action="clear-source"]')?.addEventListener("click", () => { project.sourceImage = null; save(); renderWorkspace(); });
    appEl.querySelector("#referenceImageInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { project.referenceImages.push(...images); save("레퍼런스를 저장했습니다."); renderWorkspace(); }));
    appEl.querySelector('[data-action="analyze-reference"]')?.addEventListener("click", () => analyzeReference(project, node));
    appEl.querySelectorAll("[data-transfer-key]").forEach((button) => button.addEventListener("click", () => transferReferenceAttribute(project, node, button.dataset.transferKey)));
    if (node.type === "regionMask") bindMaskEditor(project);
    if (node.type === "regionEdit") bindRegionEdit(project);
    if (node.type === "ofat") bindOfat(project, node);
    if (node.type === "altBuilder") bindAlt(project, node);
    appEl.querySelector('[data-action="generate-region"]')?.addEventListener("click", () => generateRegion(project));
  }

  function readFiles(fileList, callback) {
    const files = [...(fileList || [])]; if (!files.length) return;
    Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then(callback);
  }

  function findAnalyzerNode(project, selected) {
    return selected.type === "referenceAnalyzer" ? selected : project.graph.nodes.find((item) => item.type === "referenceAnalyzer") || selected;
  }
  function analyzeReference(project, selected) {
    const analyzer = findAnalyzerNode(project, selected), name = appEl.querySelector("#referencePreset").value;
    analyzer.settings.preset = name;
    analyzer.settings.analyzed = Object.entries(REFERENCE_PRESETS[name]).map(([key, [value, strength]]) => ({ key, value, strength, source: "reference" }));
    save("레퍼런스를 불투명한 style이 아닌 속성으로 분해했습니다."); renderWorkspace();
  }
  function transferReferenceAttribute(project, selected, key) {
    const analyzer = findAnalyzerNode(project, selected), item = analyzer.settings.analyzed.find((candidate) => candidate.key === key); if (!item) return;
    const targetPaths = { medium: "global.appearance.medium", palette: "global.appearance.palette", detailDensity: "global.appearance.detailDensity", texture: "global.appearance.texture", atmosphere: "global.appearance.atmosphere", lightingCharacter: "global.appearance.lightingCharacter", material: "global.material.primary" };
    const attribute = pathGet(project.representation, targetPaths[key]);
    if (!attribute) return;
    if (attribute.mode === "locked") { alert(`${key} 속성이 LOCKED 상태입니다.`); return; }
    Object.assign(attribute, { value: item.value, strength: item.strength, source: "reference", mode: "controlled", enabled: true });
    save(`${key}만 Representation State에 전이했습니다.`); renderWorkspace();
  }

  function blankRegion(name, maskDataUrl) {
    return { id: uid("region"), name, maskDataUrl, operation: "replace", instruction: "Replace only the selected object", referenceImages: [], attributes: { material: attr("brushed stainless steel", "controlled", "user", 80), color: attr("natural metal", "controlled", "user", 70), form: attr("preserve current proportions", "controlled", "system", 90), texture: attr("fine brushed texture", "controlled", "user", 65), detail: attr("medium", "controlled", "system", 60) }, preserve: { position: true, scale: true, orientation: true, geometry: true, lighting: true, surroundings: true } };
  }

  function bindMaskEditor(project) {
    const canvas = appEl.querySelector("#maskCanvas"), ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    maskRuntime.canvas = canvas; maskRuntime.ctx = ctx;
    const active = project.activeRegionId ? project.representation.regions.find((region) => region.id === project.activeRegionId) : null;
    if (active?.maskDataUrl) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.src = active.maskDataUrl; }
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
    const draw = (event) => { if (!maskRuntime.drawing) return; const p = point(event); ctx.globalCompositeOperation = maskRuntime.tool === "eraser" ? "destination-out" : "source-over"; ctx.fillStyle = "rgba(214,91,61,1)"; ctx.beginPath(); ctx.arc(p.x, p.y, maskRuntime.size / 2, 0, Math.PI * 2); ctx.fill(); };
    canvas.addEventListener("pointerdown", (event) => { maskRuntime.drawing = true; canvas.setPointerCapture(event.pointerId); draw(event); });
    canvas.addEventListener("pointermove", draw); canvas.addEventListener("pointerup", () => { maskRuntime.drawing = false; });
    appEl.querySelectorAll("[data-mask-tool]").forEach((button) => button.addEventListener("click", () => { maskRuntime.tool = button.dataset.maskTool; appEl.querySelectorAll("[data-mask-tool]").forEach((item) => item.classList.toggle("active", item === button)); }));
    appEl.querySelector('[data-action="clear-mask"]')?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    appEl.querySelector('[data-action="new-region"]')?.addEventListener("click", () => { project.activeRegionId = null; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="toggle-mask"]')?.addEventListener("click", (event) => { maskRuntime.visible = !maskRuntime.visible; canvas.style.display = maskRuntime.visible ? "block" : "none"; event.currentTarget.textContent = `MASK ${maskRuntime.visible ? "VISIBLE" : "HIDDEN"}`; });
    appEl.querySelector("#brushSize")?.addEventListener("input", (event) => { maskRuntime.size = Number(event.target.value); });
    appEl.querySelector("#maskOpacity")?.addEventListener("input", (event) => { maskRuntime.opacity = Number(event.target.value) / 100; canvas.style.opacity = maskRuntime.opacity; });
    appEl.querySelector('[data-action="create-region"]')?.addEventListener("click", () => {
      const name = appEl.querySelector("#newRegionName").value.trim() || "Region"; const data = canvas.toDataURL("image/png");
      const current = project.representation.regions.find((region) => region.id === project.activeRegionId);
      if (current) { current.name = name; current.maskDataUrl = data; } else { const region = blankRegion(name, data); project.representation.regions.push(region); project.activeRegionId = region.id; }
      Object.values(project.representation.global.camera).forEach((attribute) => attribute.mode = "locked");
      [project.representation.global.content.geometry, project.representation.global.content.composition].forEach((attribute) => attribute.mode = "locked");
      Object.values(project.representation.global.lighting).forEach((attribute) => attribute.mode = "locked");
      save("독립 마스크 Region을 저장했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-region-id]").forEach((button) => button.addEventListener("click", () => { project.activeRegionId = button.dataset.regionId; save(); renderWorkspace(); }));
  }

  function bindRegionEdit(project) {
    const region = project.representation.regions.find((item) => item.id === project.activeRegionId) || project.representation.regions[0]; if (!region) return;
    appEl.querySelector("#activeRegionSelect")?.addEventListener("change", (event) => { project.activeRegionId = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector("#regionOperation")?.addEventListener("change", (event) => { region.operation = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector("#regionInstruction")?.addEventListener("change", (event) => { region.instruction = event.target.value; save(); renderWorkspace(); });
    appEl.querySelectorAll("[data-region-attribute]").forEach((input) => input.addEventListener("change", () => { const attribute = region.attributes[input.dataset.regionAttribute]; attribute.value = input.value; attribute.source = "user"; attribute.mode = "controlled"; save(); renderWorkspace(); }));
    appEl.querySelectorAll("[data-preserve]").forEach((input) => input.addEventListener("change", () => { region.preserve[input.dataset.preserve] = input.checked; save(); }));
    appEl.querySelector("#regionReferenceInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { region.referenceImages.push(...images); save("Region 전용 레퍼런스를 저장했습니다."); renderWorkspace(); }));
  }

  function bindOfat(project, node) {
    appEl.querySelector("#ofatVariable")?.addEventListener("change", (event) => { node.settings.variable = event.target.value; if (event.target.value.includes("colorTemperature")) node.settings.values = "2700, 3000, 4000, 5500"; else if (event.target.value.includes("softness")) node.settings.values = "20, 45, 70, 95"; else if (event.target.value.includes("focalLength")) node.settings.values = "24, 35, 50, 85"; save(); renderWorkspace(); });
    appEl.querySelector("#ofatValues")?.addEventListener("change", (event) => { node.settings.values = event.target.value; save(); });
    appEl.querySelector('[data-action="run-ofat"]')?.addEventListener("click", () => runOfat(project, node));
  }

  function bindAlt(project, node) {
    appEl.querySelector("#altCount")?.addEventListener("change", (event) => { node.settings.alternatives = clamp(Number(event.target.value), 2, 8); save(); });
    appEl.querySelector("#altScope")?.addEventListener("change", (event) => { node.settings.scope = event.target.value; save(); });
    appEl.querySelector('[data-action="run-alt"]')?.addEventListener("click", () => runAlternatives(project, node));
  }

  async function generateNormal(project) {
    const parent = project.experiments[0]?.id || null;
    const experiment = await createExperiment(project, project.representation, project.experiments.length ? `Iteration ${project.experiments.length}` : "Baseline", parent);
    project.experiments.unshift(experiment); project.selectedExperimentIds = [experiment.id, ...project.selectedExperimentIds].slice(0, 2); save("Generation snapshot을 저장했습니다."); renderWorkspace();
  }
  async function generateRegion(project) {
    const region = project.representation.regions.find((item) => item.id === project.activeRegionId); if (!region) return;
    const experiment = await createExperiment(project, project.representation, `Region Edit · ${region.name}`, project.experiments[0]?.id || null, region);
    project.experiments.unshift(experiment); project.selectedExperimentIds = [experiment.id, ...project.selectedExperimentIds].slice(0, 2); save("Region edit snapshot을 저장했습니다."); renderWorkspace();
  }
  async function runOfat(project, node) {
    const path = node.settings.variable, rawValues = node.settings.values.split(",").map((value) => value.trim()).filter(Boolean), base = clone(project.representation), baseAttr = pathGet(base, path);
    const values = rawValues.map((value) => typeof baseAttr.value === "number" ? Number(value) : value).filter((value) => typeof value !== "number" || Number.isFinite(value)); if (!values.length) return;
    const created = [];
    for (const value of values) { const variant = clone(base), attribute = pathGet(variant, path); attribute.value = value; const experiment = await createExperiment(project, variant, `OFAT · ${path.split(".").pop()} ${value}`, project.experiments[0]?.id || null); experiment.changedVariables = [path]; created.push(experiment); }
    project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = created.slice(0, 2).map((item) => item.id); save(`OFAT ${values.length}개 snapshot을 생성했습니다.`); renderWorkspace();
  }
  async function runAlternatives(project, node) {
    const count = clamp(node.settings.alternatives || 4, 2, 8), variants = [
      { palette: "warm terracotta neutral", primary: "walnut", temperature: 3000, atmosphere: "intimate dining" },
      { palette: "cool mineral neutral", primary: "brushed stainless steel", temperature: 5000, atmosphere: "precise gallery-like" },
      { palette: "muted natural green", primary: "pale oak", temperature: 4000, atmosphere: "calm biophilic" },
      { palette: "high contrast monochrome", primary: "blackened timber", temperature: 3500, atmosphere: "graphic editorial" },
    ];
    const created = [];
    for (let i = 0; i < count; i++) { const variant = clone(project.representation), spec = variants[i % variants.length]; Object.assign(variant.global.appearance.palette, { value: spec.palette, source: "system", mode: "controlled" }); Object.assign(variant.global.material.primary, { value: spec.primary, source: "system", mode: "controlled" }); Object.assign(variant.global.lighting.colorTemperatureK, { value: spec.temperature, source: "system", mode: "controlled" }); Object.assign(variant.global.appearance.atmosphere, { value: spec.atmosphere, source: "system", mode: "controlled" }); created.push(await createExperiment(project, variant, `Alternative ${i + 1}`, project.experiments[0]?.id || null)); }
    project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = created.slice(0, 2).map((item) => item.id); save("의도적 multi-variable alternatives를 생성했습니다."); renderWorkspace();
  }

  function bindResults(project) {
    appEl.querySelectorAll("[data-select-experiment]").forEach((image) => image.addEventListener("click", () => {
      const id = image.dataset.selectExperiment;
      project.selectedExperimentIds = project.selectedExperimentIds.includes(id) ? project.selectedExperimentIds.filter((item) => item !== id) : [...project.selectedExperimentIds.slice(-1), id];
      save(); renderWorkspace();
    }));
    appEl.querySelectorAll("[data-load-experiment]").forEach((button) => button.addEventListener("click", () => { const experiment = project.experiments.find((item) => item.id === button.dataset.loadExperiment); if (!experiment) return; project.representation = clone(experiment.representationState); save("Snapshot State를 작업 상태로 불러왔습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-delete-experiment]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.deleteExperiment; project.experiments = project.experiments.filter((item) => item.id !== id); project.selectedExperimentIds = project.selectedExperimentIds.filter((item) => item !== id); save("Snapshot을 삭제했습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-eval-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.evalId); experiment.evaluation[select.dataset.evalKey] = Number(select.value); save(); }));
    appEl.querySelectorAll("[data-failure-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.failureId); experiment.evaluation.failureCause = select.value === "Failure cause…" ? "" : select.value; save(); }));
    appEl.querySelectorAll("[data-notes-id]").forEach((textarea) => textarea.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === textarea.dataset.notesId); experiment.evaluation.notes = textarea.value; save(); }));
  }

  globalThis.__VRL_TEST__ = {
    templateConfigs, moduleConfigs, createProject, compileGlobal, compileRegionEdit,
    diffRepresentations, diffPrompts, horizontalFovDeg, focalFromFov,
    blankRegion, createExperiment, clone,
  };
  load();
  render();
})();
