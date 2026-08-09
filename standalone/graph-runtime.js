/* VISUAL REPRESENTATION LAB — typed dataflow runtime v2 */
(() => {
  "use strict";

  const VALUE_TYPES = Object.freeze([
    "Number", "String", "Boolean", "Enum", "Image", "Reference", "Mask", "List",
    "CameraState", "LightingState", "MaterialState", "RepresentationState", "RegionState",
    "CompiledInstruction", "GenerationRequest", "GeneratedImage", "ExperimentSet", "Any", "State",
  ]);

  const COMPONENT_DEFAULTS = Object.freeze({
    camera: Object.freeze({
      lens: 35, height: 1500, pitch: 0, yaw: 0, shift: 0, perspective: true,
    }),
    lighting: Object.freeze({
      temperature: 5000, exposure: 0, softness: 65, contrast: 40,
      ambient: 80, artificial: 20, direction: "Side",
    }),
    representation: Object.freeze({ mode: "photoreal_actual", style: "none" }),
  });

  const PORT_SYMBOLS = Object.freeze({
    Number: "●", String: "○", Boolean: "○", Enum: "○", Image: "◉", Reference: "□",
    Mask: "◐", List: "∷", CameraState: "◆", LightingState: "◆", MaterialState: "◆",
    RepresentationState: "◆", RegionState: "◆", CompiledInstruction: "□",
    GenerationRequest: "◆", GeneratedImage: "◉", ExperimentSet: "∷", Any: "○", State: "◆",
  });

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const makeId = (prefix = "graph") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  class GraphError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "GraphError";
      this.code = code;
      this.details = details;
    }
  }

  const port = (id, label, type, extra = {}) => ({
    id, label, type, required: false, cardinality: "single", ...extra,
  });

  const REGISTRY = Object.freeze({
    number: { label: "숫자", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("value", "값", "Number")] },
    text: { label: "텍스트", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("value", "값", "String")] },
    boolean: { label: "불리언", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("value", "값", "Boolean")] },
    enum: { label: "열거값", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("value", "값", "Enum")] },
    image: { label: "이미지", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("image", "이미지", "Image")] },
    reference: { label: "레퍼런스", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("reference", "레퍼런스", "Reference")] },
    list: { label: "리스트", category: "INPUT", kind: "parameter", inputs: [], outputs: [port("list", "리스트", "List")] },
    camera: {
      label: "카메라", category: "REPRESENTATION", kind: "component",
      inputs: [
        port("lens", "렌즈", "Number", { unitKind: "focal-length", default: 35 }),
        port("height", "높이", "Number", { unitKind: "length", default: 1500 }),
        port("pitch", "피치", "Number", { unitKind: "angle", default: 0 }),
        port("yaw", "요", "Number", { unitKind: "angle", default: 0 }),
        port("shift", "시프트", "Number", { unitKind: "shift", default: 0 }),
        port("perspective", "원근 보정", "Boolean", { default: true }),
      ],
      outputs: [port("state", "카메라 상태", "CameraState")],
    },
    lighting: {
      label: "조명", category: "REPRESENTATION", kind: "component",
      inputs: [
        port("temperature", "색온도", "Number", { unitKind: "temperature", default: 5000 }),
        port("exposure", "노출", "Number", { unitKind: "exposure", default: 0 }),
        port("softness", "부드러움", "Number", { unitKind: "ratio", default: 65 }),
        port("contrast", "대비", "Number", { unitKind: "ratio", default: 40 }),
        port("ambient", "주변광", "Number", { unitKind: "ratio", default: 80 }),
        port("artificial", "인공광", "Number", { unitKind: "ratio", default: 20 }),
        port("direction", "방향", "Enum", { domain: "LightDirection", default: "Side" }),
      ],
      outputs: [port("state", "조명 상태", "LightingState")],
    },
    material: {
      label: "재료", category: "REPRESENTATION", kind: "component",
      inputs: [port("primary", "주요 재료", "String"), port("secondary", "보조 재료", "String"), port("finish", "마감", "String")],
      outputs: [port("state", "재료 상태", "MaterialState")],
    },
    representation: {
      label: "표현", category: "REPRESENTATION", kind: "component",
      inputs: [
        port("mode", "표현 방식", "Enum", { domain: "RepresentationMode", default: "photoreal_actual" }),
        port("style", "디자인 스타일", "Enum", { domain: "DesignStyle", default: "none" }),
        port("camera", "카메라", "CameraState"), port("lighting", "조명", "LightingState"),
        port("material", "재료", "MaterialState"),
      ],
      outputs: [port("state", "표현 상태", "RepresentationState")],
    },
    merge: {
      label: "병합", category: "LOGIC", kind: "component",
      inputs: [port("states", "부분 상태", "State", { cardinality: "many" })],
      outputs: [port("state", "병합 상태", "State")],
    },
    override: {
      label: "오버라이드", category: "LOGIC", kind: "component",
      inputs: [port("base", "기본 상태", "RepresentationState", { required: true }), port("value", "새 값", "Any", { required: true })],
      outputs: [port("state", "새 상태", "RepresentationState")],
    },
    switch: {
      label: "스위치", category: "LOGIC", kind: "component",
      inputs: [port("options", "옵션", "List", { required: true }), port("index", "인덱스", "Number")],
      outputs: [port("value", "선택값", "Any")],
    },
    iterate: {
      label: "반복", category: "LOGIC", kind: "component",
      inputs: [port("list", "리스트", "List", { required: true })],
      outputs: [port("item", "항목", "Any")],
    },
    lock: {
      label: "잠금", category: "LOGIC", kind: "component",
      inputs: [port("value", "값", "Any", { required: true })], outputs: [port("value", "잠긴 값", "Any")],
    },
    styleMix: {
      label: "스타일 믹스", category: "LOGIC", kind: "component",
      inputs: [port("a", "스타일 A", "Enum", { domain: "DesignStyle", required: true }), port("b", "스타일 B", "Enum", { domain: "DesignStyle", required: true })],
      outputs: [port("style", "혼합 스타일", "Enum", { domain: "DesignStyle" })],
    },
    compile: {
      label: "컴파일", category: "OUTPUT", kind: "component",
      inputs: [port("state", "표현 상태", "RepresentationState", { required: true })],
      outputs: [port("instruction", "컴파일 지시", "CompiledInstruction")],
    },
    generate: {
      label: "생성", category: "OUTPUT", kind: "component",
      inputs: [port("source", "소스 이미지", "Image"), port("state", "표현 상태", "RepresentationState", { required: true }), port("instruction", "컴파일 지시", "CompiledInstruction", { required: true })],
      outputs: [port("request", "생성 요청", "GenerationRequest")],
    },
    compare: {
      label: "비교", category: "OUTPUT", kind: "component",
      inputs: [port("input", "생성 결과", "GenerationRequest", { required: true, cardinality: "many" })],
      outputs: [port("set", "비교 세트", "ExperimentSet")],
    },
    cluster: { label: "클러스터", category: "MODULES", kind: "cluster", inputs: [], outputs: [] },
  });

  function dynamicPort(node, definition) {
    const result = clone(definition);
    const settings = node.settings || {};
    if (["number", "enum", "text", "boolean"].includes(node.type) && result.id === "value") {
      result.type = settings.valueType || result.type;
      if (settings.domain) result.domain = settings.domain;
      if (settings.unitKind) result.unitKind = settings.unitKind;
    }
    if (node.type === "list" && result.id === "list") {
      result.itemType = settings.itemType || "Any";
      if (settings.domain) result.domain = settings.domain;
      if (settings.unitKind) result.unitKind = settings.unitKind;
    }
    if (node.type === "iterate" && result.id === "item") {
      result.type = settings.itemType || "Any";
      if (settings.domain) result.domain = settings.domain;
      if (settings.unitKind) result.unitKind = settings.unitKind;
    }
    if (["lock", "switch"].includes(node.type)) {
      if (settings.valueType) result.type = settings.valueType;
      if (settings.domain) result.domain = settings.domain;
      if (settings.unitKind) result.unitKind = settings.unitKind;
    }
    return result;
  }

  function getNodeDef(type) {
    const definition = REGISTRY[type];
    if (!definition) throw new GraphError("UNKNOWN_NODE", `UNKNOWN NODE: ${type}`, { type });
    return definition;
  }

  function getPorts(node, direction) {
    return getNodeDef(node.type)[direction].map((definition) => dynamicPort(node, definition));
  }

  function getPort(node, direction, portId) {
    return getPorts(node, direction).find((candidate) => candidate.id === portId) || null;
  }

  function createNode(type, settings = {}, position = {}) {
    const definition = getNodeDef(type);
    return {
      id: settings.id || makeId("node"), type, kind: settings.kind || definition.kind,
      label: settings.label || definition.label, x: Number(position.x ?? settings.x ?? 120),
      y: Number(position.y ?? settings.y ?? 120), order: Number(settings.order ?? 0),
      settings: clone(settings),
    };
  }

  function addNode(graph, type, settings = {}, position = {}) {
    const node = createNode(type, { ...settings, order: graph.nodes.length }, position);
    graph.nodes.push(node);
    return node;
  }

  function addParameterNode(graph, settings = {}, position = {}) {
    const valueType = settings.valueType || (Array.isArray(settings.value) ? "List" : typeof settings.value === "number" ? "Number" : typeof settings.value === "boolean" ? "Boolean" : "String");
    const type = valueType === "List" ? "list" : valueType === "Number" ? "number" : valueType === "Boolean" ? "boolean" : valueType === "Enum" ? "enum" : valueType === "Image" ? "image" : valueType === "Reference" ? "reference" : "text";
    return addNode(graph, type, { ...settings, valueType }, position);
  }

  function normalizeEndpoint(edge, side) {
    if (edge[side]) return edge[side];
    const prefix = side === "source" ? "from" : "to";
    return { nodeId: edge[`${prefix}NodeId`] || edge[prefix], portId: edge[`${prefix}PortId`] || (side === "source" ? "value" : "state") };
  }

  function normalizedEdge(edge) {
    return { id: edge.id || makeId("edge"), source: normalizeEndpoint(edge, "source"), target: normalizeEndpoint(edge, "target"), moduleId: edge.moduleId || null };
  }

  function isStateType(type) { return type === "State" || /State$/.test(type); }

  function compatiblePorts(output, input) {
    if (input.type !== "Any" && output.type !== "Any" && output.type !== input.type && !(input.type === "State" && isStateType(output.type))) return false;
    if (output.domain && input.domain && output.domain !== input.domain) return false;
    if (output.unitKind && input.unitKind && output.unitKind !== input.unitKind) return false;
    if (output.type === "List" && input.itemType && output.itemType !== "Any" && input.itemType !== "Any" && output.itemType !== input.itemType) return false;
    return true;
  }

  function resolveConnection(graph, draft) {
    const edge = normalizedEdge(draft);
    const sourceNode = graph.nodes.find((node) => node.id === edge.source.nodeId);
    const targetNode = graph.nodes.find((node) => node.id === edge.target.nodeId);
    if (!sourceNode || !targetNode) throw new GraphError("MISSING_ENDPOINT", "CONNECTION ENDPOINT NOT FOUND", { edge });
    const output = getPort(sourceNode, "outputs", edge.source.portId);
    const input = getPort(targetNode, "inputs", edge.target.portId);
    if (!output || !input) throw new GraphError("MISSING_PORT", "CONNECTION PORT NOT FOUND", { edge });
    if (!compatiblePorts(output, input)) {
      throw new GraphError("INCOMPATIBLE_CONNECTION", `INCOMPATIBLE CONNECTION\n${output.type} → ${input.type}`, { edge, output, input });
    }
    return { edge, sourceNode, targetNode, output, input };
  }

  function topologicalSort(graph, extraEdges = null) {
    const edges = (extraEdges || graph.edges).map(normalizedEdge);
    const index = new Map(graph.nodes.map((node, position) => [node.id, position]));
    const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
    edges.forEach((edge) => {
      if (!indegree.has(edge.source.nodeId) || !indegree.has(edge.target.nodeId)) return;
      indegree.set(edge.target.nodeId, indegree.get(edge.target.nodeId) + 1);
      outgoing.get(edge.source.nodeId).push(edge.target.nodeId);
    });
    const rank = (id) => {
      const node = graph.nodes[index.get(id)];
      return [Number(node?.order ?? index.get(id)), index.get(id)];
    };
    const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id).sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);
    const order = [];
    while (queue.length) {
      const id = queue.shift(); order.push(id);
      outgoing.get(id).forEach((targetId) => {
        indegree.set(targetId, indegree.get(targetId) - 1);
        if (indegree.get(targetId) === 0) { queue.push(targetId); queue.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]); }
      });
    }
    if (order.length !== graph.nodes.length) throw new GraphError("CYCLE_DETECTED", "CYCLE DETECTED", { unresolvedNodeIds: [...indegree.entries()].filter(([, degree]) => degree > 0).map(([id]) => id) });
    return order;
  }

  function connect(graph, draft, options = {}) {
    const resolved = resolveConnection(graph, draft);
    const occupied = graph.edges.map(normalizedEdge).filter((edge) => edge.target.nodeId === resolved.edge.target.nodeId && edge.target.portId === resolved.edge.target.portId);
    if (occupied.length && resolved.input.cardinality !== "many" && options.mode !== "replace") {
      const targetLabel = `${resolved.targetNode.label}.${resolved.input.label}`.toUpperCase();
      throw new GraphError("INPUT_OCCUPIED", `${targetLabel} INPUT ALREADY CONNECTED`, { existingEdges: occupied, actions: ["replace", resolved.input.domain === "DesignStyle" ? "insertStyleMix" : "insertOverride"] });
    }
    const retained = options.mode === "replace" ? graph.edges.filter((candidate) => !occupied.some((edge) => edge.id === normalizedEdge(candidate).id)) : graph.edges.slice();
    topologicalSort(graph, [...retained, resolved.edge]);
    graph.edges = [...retained, resolved.edge];
    return resolved.edge;
  }

  function disconnect(graph, criteria = {}) {
    const before = graph.edges.length;
    graph.edges = graph.edges.filter((candidate) => {
      const edge = normalizedEdge(candidate);
      if (criteria.id && edge.id === criteria.id) return false;
      if (criteria.toNodeId && edge.target.nodeId === criteria.toNodeId && (!criteria.toPortId || edge.target.portId === criteria.toPortId)) return false;
      if (criteria.fromNodeId && edge.source.nodeId === criteria.fromNodeId && (!criteria.fromPortId || edge.source.portId === criteria.fromPortId)) return false;
      return true;
    });
    return before - graph.edges.length;
  }

  function removeNode(graph, nodeId) {
    graph.nodes = graph.nodes.filter((node) => node.id !== nodeId);
    graph.edges = graph.edges.filter((candidate) => {
      const edge = normalizedEdge(candidate);
      return edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId;
    });
  }

  function setParameterValue(graph, nodeId, value) {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.kind !== "parameter") throw new GraphError("NOT_PARAMETER", "NODE IS NOT A PARAMETER", { nodeId });
    if (node.type === "number") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new GraphError("INVALID_VALUE", "NUMBER REQUIRED", { nodeId, value });
      const min = Number(node.settings.min ?? -Infinity), max = Number(node.settings.max ?? Infinity);
      node.settings.value = Math.max(min, Math.min(max, parsed));
    } else if (node.type === "list") {
      const list = Array.isArray(value) ? value : String(value).split(",").map((item) => item.trim()).filter(Boolean);
      node.settings.value = node.settings.itemType === "Number" ? list.map(Number).filter(Number.isFinite) : list;
    } else if (node.type === "boolean") node.settings.value = value === true || value === "true";
    else node.settings.value = value;
    node.settings.sourceType = "user";
    return node.settings.value;
  }

  function validateGraph(graph) {
    const diagnostics = [];
    const occupancy = new Map();
    graph.edges.forEach((candidate) => {
      try {
        const { edge, input } = resolveConnection(graph, candidate);
        const key = `${edge.target.nodeId}:${edge.target.portId}`;
        occupancy.set(key, (occupancy.get(key) || 0) + 1);
        if (input.cardinality !== "many" && occupancy.get(key) > 1) diagnostics.push({ code: "INPUT_OCCUPIED", nodeId: edge.target.nodeId, portId: edge.target.portId });
      } catch (error) { diagnostics.push({ code: error.code || "INVALID_CONNECTION", message: error.message, details: error.details }); }
    });
    try { topologicalSort(graph); } catch (error) { diagnostics.push({ code: error.code, message: error.message, details: error.details }); }
    graph.nodes.forEach((node) => getPorts(node, "inputs").filter((input) => input.required).forEach((input) => {
      const connected = graph.edges.map(normalizedEdge).some((edge) => edge.target.nodeId === node.id && edge.target.portId === input.id);
      if (!connected && input.default === undefined) diagnostics.push({ code: "MISSING_REQUIRED_INPUT", nodeId: node.id, portId: input.id, message: `${node.label}.${input.label} REQUIRED` });
    }));
    return { valid: diagnostics.length === 0, diagnostics };
  }

  const provenanceLeaf = (node, semanticPath, sourcePortId = "value", sourceType = null) => ({
    semanticPath, sourceNodeId: node?.id || null, sourcePortId: node ? sourcePortId : null,
    sourceType: sourceType || node?.settings?.sourceType || (node?.kind === "parameter" ? "user" : "component-default"),
    locked: false,
  });

  const envelope = (type, value, provenance = {}, extra = {}) => ({ type, value, provenance, series: false, ...extra });

  function defaultEnvelope(node, input) {
    return envelope(input.type, clone(input.default), {}, { domain: input.domain, unitKi…66013 tokens truncated….stage = null; save("Generation snapshot을 저장했습니다."); renderWorkspace();
    } catch (error) { generationRuntime.stage = null; generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); }
  }
  async function generateRegion(project) {
    const region = project.representation.regions.find((item) => item.id === project.activeRegionId); if (!region) return;
    try {
      resolveExecution(project, region, false); updateGenerationStage("COMPILING REGION", `${region.name} 로컬 상태`);
      const experiment = await createExperiment(project, project.representation, `Region Edit · ${region.name}`, project.experiments[0]?.id || null, region, true);
      project.experiments.unshift(experiment); project.selectedExperimentIds = [experiment.id, ...project.selectedExperimentIds].slice(0, 2); generationRuntime.stage = null; save("Region edit snapshot을 저장했습니다."); renderWorkspace();
    } catch (error) { generationRuntime.stage = null; generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); }
  }
  async function runOfat(project, node) {
    if (project.graph?.version === 2) return generateNormal(project);
    const path = node.settings.variable, rawValues = node.settings.values.split(",").map((value) => value.trim()).filter(Boolean), base = clone(project.representation), baseAttr = pathGet(base, path);
    const values = rawValues.map((value) => typeof baseAttr.value === "number" ? Number(value) : value).filter((value) => typeof value !== "number" || Number.isFinite(value)); if (!values.length) return;
    const created = [];
    try { resolveExecution(project, null, false); } catch (error) { generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); return; }
    for (const value of values) { const variant = clone(base), attribute = pathGet(variant, path); attribute.value = value; const experiment = await createExperiment(project, variant, `OFAT · ${path.split(".").pop()} ${value}`, project.experiments[0]?.id || null, null, true); experiment.changedVariables = [path]; created.push(experiment); }
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
    try { resolveExecution(project, null, false); } catch (error) { generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); return; }
    for (let i = 0; i < count; i++) { const variant = clone(project.representation), spec = variants[i % variants.length]; Object.assign(variant.global.appearance.palette, { value: spec.palette, source: "system", mode: "controlled" }); Object.assign(variant.global.material.primary, { value: spec.primary, source: "system", mode: "controlled" }); Object.assign(variant.global.lighting.colorTemperatureK, { value: spec.temperature, source: "system", mode: "controlled" }); Object.assign(variant.global.appearance.atmosphere, { value: spec.atmosphere, source: "system", mode: "controlled" }); created.push(await createExperiment(project, variant, `Alternative ${i + 1}`, project.experiments[0]?.id || null, null, true)); }
    project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = created.slice(0, 2).map((item) => item.id); save("의도적 multi-variable alternatives를 생성했습니다."); renderWorkspace();
  }

  function bindResults(project) {
    appEl.querySelectorAll("[data-select-experiment]").forEach((image) => image.addEventListener("click", () => {
      const id = image.dataset.selectExperiment;
      project.selectedExperimentIds = project.selectedExperimentIds.includes(id) ? project.selectedExperimentIds.filter((item) => item !== id) : [...project.selectedExperimentIds.slice(-1), id];
      save(); renderWorkspace();
    }));
    appEl.querySelectorAll("[data-load-experiment]").forEach((button) => button.addEventListener("click", () => { const experiment = project.experiments.find((item) => item.id === button.dataset.loadExperiment); if (!experiment) return; if (experiment.graphSnapshot?.version === 2) { project.graph = clone(experiment.graphSnapshot); project.graphStack = []; project.representation = ensureOutputState(clone(experiment.representationState)); syncGraphState(project); project.workspaceMode = "system"; } else project.representation = ensureOutputState(clone(experiment.representationState)); save("그래프 스냅샷을 작업 상태로 불러왔습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-delete-experiment]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.deleteExperiment; project.experiments = project.experiments.filter((item) => item.id !== id); project.selectedExperimentIds = project.selectedExperimentIds.filter((item) => item !== id); save("Snapshot을 삭제했습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-eval-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.evalId); experiment.evaluation[select.dataset.evalKey] = Number(select.value); save(); }));
    appEl.querySelectorAll("[data-failure-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.failureId); experiment.evaluation.failureCause = select.value === "Failure cause…" ? "" : select.value; save(); }));
    appEl.querySelectorAll("[data-notes-id]").forEach((textarea) => textarea.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === textarea.dataset.notesId); experiment.evaluation.notes = textarea.value; save(); }));
  }

  globalThis.__VRL_TEST__ = {
    templateConfigs, moduleConfigs, createProject, compileGlobal, compileRegionEdit,
    diffRepresentations, diffPrompts, horizontalFovDeg, focalFromFov,
    blankRegion, createExperiment, clone, ensureOutputState, applyOutputPreset,
    compileOutput, mergeExclusions, REPRESENTATION_PRESETS, DESIGN_STYLE_PRESETS,
    ensureExecutionState, routingCapability, resolveExecution,
    evaluateProjectGraph, syncGraphState,
    evaluateGraph: (graph) => globalThis.VRL_GRAPH.evaluateGraph(graph, { compile: compileGlobal }),
    connectGraph: (graph, draft, options) => globalThis.VRL_GRAPH.connect(graph, draft, options),
    disconnectGraph: (graph, criteria) => globalThis.VRL_GRAPH.disconnect(graph, criteria),
    setParameterValue: (graph, nodeId, value) => globalThis.VRL_GRAPH.setParameterValue(graph, nodeId, value),
    addParameterNode: (graph, settings, position) => globalThis.VRL_GRAPH.addParameterNode(graph, settings, position),
    addGraphNode: (graph, type, settings, position) => globalThis.VRL_GRAPH.addNode(graph, type, settings, position),
    removeGraphNode: (graph, nodeId) => globalThis.VRL_GRAPH.removeNode(graph, nodeId),
    runIterate: (project, iterateNodeId) => globalThis.VRL_GRAPH.runIterate(project, iterateNodeId, { compile: compileGlobal }),
    createClusterInstance: globalThis.VRL_GRAPH.createClusterInstance,
    validateGraph: globalThis.VRL_GRAPH.validateGraph,
    COMPONENT_DEFAULTS: globalThis.VRL_GRAPH.COMPONENT_DEFAULTS,
  };
  load();
  render();
  refreshProviderStatuses(true);
})();
