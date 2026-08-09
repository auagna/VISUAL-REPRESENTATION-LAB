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
    return envelope(input.type, clone(input.default), {}, { domain: input.domain, unitKind: input.unitKind, defaulted: true, defaultProvenance: provenanceLeaf(node, null, input.id, "component-default") });
  }

  function attrPathSet(state, path, raw, source = "graph") {
    const parts = path.split(".");
    const key = parts.pop();
    let target = state;
    parts.forEach((part) => { target[part] ||= {}; target = target[part]; });
    if (target[key] && typeof target[key] === "object" && "value" in target[key]) {
      target[key].value = clone(raw); target[key].source = source;
      if (source === "graph") target[key].mode = "controlled";
    } else target[key] = { value: clone(raw), enabled: true, mode: "controlled", source, strength: 60 };
  }

  function walkAttributes(value, callback, prefix = "") {
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === "object" && "value" in child && "mode" in child) callback(path, child);
      else if (child && typeof child === "object" && !Array.isArray(child)) walkAttributes(child, callback, path);
    });
  }

  function inputValue(node, inputs, portId) {
    const input = getPort(node, "inputs", portId);
    return inputs[portId] || (input?.default !== undefined ? defaultEnvelope(node, input) : null);
  }

  function semanticValue(node, inputs, portId, semanticPath) {
    const source = inputValue(node, inputs, portId);
    if (!source) return { value: undefined, provenance: provenanceLeaf(node, semanticPath, portId, "component-default") };
    const firstProvenance = source.provenance?.[semanticPath] || Object.values(source.provenance || {})[0] || source.defaultProvenance;
    return { value: clone(source.value), provenance: { ...(firstProvenance || provenanceLeaf(node, semanticPath, portId, source.defaulted ? "component-default" : "derived")), semanticPath } };
  }

  function evaluateSingle(node, inputs, context) {
    const settings = node.settings || {};
    if (node.kind === "cluster") return {};
    if (node.kind === "parameter") {
      const output = getPorts(node, "outputs")[0];
      const path = settings.semanticPath || settings.semanticKey || null;
      const provenance = path ? { [path]: provenanceLeaf(node, path, output.id, settings.sourceType || "user") } : {};
      return { [output.id]: envelope(output.type, clone(settings.value), provenance, { domain: output.domain, unitKind: output.unitKind, itemType: output.itemType }) };
    }
    if (node.type === "iterate") {
      const list = inputValue(node, inputs, "list");
      const values = Array.isArray(list?.value) ? list.value : [];
      const path = settings.semanticPath || Object.keys(list?.provenance || {})[0] || null;
      return { item: envelope(settings.itemType || list?.itemType || "Any", clone(values), clone(list?.provenance || {}), { series: true, domain: settings.domain || list?.domain, unitKind: settings.unitKind || list?.unitKind, axisId: node.id, semanticPath: path }) };
    }
    if (node.type === "camera") {
      const fields = [
        ["lens", "global.camera.focalLengthMm"], ["height", "global.camera.cameraHeightMm"], ["pitch", "global.camera.pitchDeg"],
        ["yaw", "global.camera.yawDeg"], ["shift", "global.camera.verticalShift"], ["perspective", "global.camera.perspectiveCorrection"],
      ];
      const values = {}, provenance = {};
      fields.forEach(([portId, path]) => { const resolved = semanticValue(node, inputs, portId, path); values[path.split(".").pop()] = resolved.value; provenance[path] = resolved.provenance; });
      return { state: envelope("CameraState", { values, provenance }, provenance) };
    }
    if (node.type === "lighting") {
      const fields = [
        ["temperature", "global.lighting.colorTemperatureK"], ["exposure", "global.lighting.exposureEV"], ["softness", "global.lighting.softness"],
        ["contrast", "global.lighting.contrast"], ["ambient", "global.lighting.ambientLevel"], ["artificial", "global.lighting.artificialLevel"],
        ["direction", "global.lighting.direction"],
      ];
      const values = {}, provenance = {};
      fields.forEach(([portId, path]) => { const resolved = semanticValue(node, inputs, portId, path); values[path.split(".").pop()] = resolved.value; provenance[path] = resolved.provenance; });
      return { state: envelope("LightingState", { values, provenance }, provenance) };
    }
    if (node.type === "material") {
      const fields = [["primary", "global.material.primary"], ["secondary", "global.material.secondary"], ["finish", "global.material.finish"]];
      const values = {}, provenance = {};
      fields.forEach(([portId, path]) => { const resolved = semanticValue(node, inputs, portId, path); if (resolved.value !== undefined) { values[path.split(".").pop()] = resolved.value; provenance[path] = resolved.provenance; } });
      return { state: envelope("MaterialState", { values, provenance }, provenance) };
    }
    if (node.type === "representation") {
      const state = clone(context.baseRepresentation || context.graph.settings?.baseRepresentation || { global: {}, regions: [] });
      state.global ||= {}; state.regions ||= [];
      const provenance = {};
      walkAttributes(state.global, (path, attribute) => { provenance[`global.${path}`] = { semanticPath: `global.${path}`, sourceNodeId: null, sourcePortId: null, sourceType: attribute.source || "legacy-base", locked: attribute.mode === "locked" }; });
      [inputValue(node, inputs, "camera"), inputValue(node, inputs, "lighting"), inputValue(node, inputs, "material")].filter(Boolean).forEach((partial) => {
        Object.entries(partial.value?.values || {}).forEach(([key, value]) => {
          const group = partial.type === "CameraState" ? "camera" : partial.type === "LightingState" ? "lighting" : "material";
          attrPathSet(state, `global.${group}.${key}`, value);
        });
        Object.assign(provenance, clone(partial.provenance || {}));
      });
      const mode = semanticValue(node, inputs, "mode", "global.output.representationPreset");
      const style = semanticValue(node, inputs, "style", "global.output.designStylePreset");
      attrPathSet(state, "global.output.representationPreset", mode.value);
      attrPathSet(state, "global.output.designStylePreset", style.value);
      provenance["global.output.representationPreset"] = mode.provenance;
      provenance["global.output.designStylePreset"] = style.provenance;
      return { state: envelope("RepresentationState", state, provenance) };
    }
    if (node.type === "styleMix") {
      const a = inputValue(node, inputs, "a"), b = inputValue(node, inputs, "b");
      const value = { kind: "style-mix", styles: [a?.value, b?.value], weights: clone(settings.weights || [0.5, 0.5]) };
      return { style: envelope("Enum", value, { ...(a?.provenance || {}), ...(b?.provenance || {}) }, { domain: "DesignStyle" }) };
    }
    if (node.type === "lock") {
      const value = inputValue(node, inputs, "value");
      const provenance = clone(value?.provenance || {}); Object.values(provenance).forEach((leaf) => { leaf.locked = true; });
      return { value: envelope(value?.type || settings.valueType || "Any", clone(value?.value), provenance, { domain: value?.domain, unitKind: value?.unitKind }) };
    }
    if (node.type === "switch") {
      const options = inputValue(node, inputs, "options"), index = Number(inputValue(node, inputs, "index")?.value || 0);
      const values = Array.isArray(options?.value) ? options.value : [];
      return { value: envelope(settings.valueType || options?.itemType || "Any", clone(values[Math.max(0, Math.min(values.length - 1, index))]), clone(options?.provenance || {}), { domain: settings.domain, unitKind: settings.unitKind }) };
    }
    if (node.type === "merge") {
      const states = Array.isArray(inputs.states) ? inputs.states : inputs.states ? [inputs.states] : [];
      const merged = {}, provenance = {};
      states.forEach((state) => { Object.assign(merged, clone(state.value || {})); Object.assign(provenance, clone(state.provenance || {})); });
      return { state: envelope(settings.outputType || "State", merged, provenance) };
    }
    if (node.type === "override") {
      const base = inputValue(node, inputs, "base"), replacement = inputValue(node, inputs, "value");
      const state = clone(base?.value), path = settings.semanticPath;
      if (path) attrPathSet(state, path, replacement?.value);
      return { state: envelope("RepresentationState", state, { ...(base?.provenance || {}), ...(replacement?.provenance || {}) }) };
    }
    if (node.type === "compile") {
      const state = inputValue(node, inputs, "state");
      const compiled = context.compile ? context.compile(clone(state.value)) : { sections: [], prompt: "" };
      return { instruction: envelope("CompiledInstruction", compiled, clone(state.provenance || {})) };
    }
    if (node.type === "generate") {
      const source = inputValue(node, inputs, "source"), state = inputValue(node, inputs, "state"), instruction = inputValue(node, inputs, "instruction");
      const request = { generatorNodeId: node.id, sourceImage: clone(source?.value || null), representationState: clone(state?.value), compiledInstruction: clone(instruction?.value), provenance: clone(state?.provenance || {}) };
      return { request: envelope("GenerationRequest", request, clone(state?.provenance || {})) };
    }
    if (node.type === "compare") {
      const requests = Array.isArray(inputs.input) ? inputs.input : inputs.input ? [inputs.input] : [];
      return { set: envelope("ExperimentSet", requests.map((request) => clone(request.value)), Object.assign({}, ...requests.map((request) => request.provenance || {}))) };
    }
    throw new GraphError("UNSUPPORTED_NODE", `UNSUPPORTED NODE: ${node.type}`, { nodeId: node.id });
  }

  function liftNode(node, inputs, context) {
    const seriesInputs = [];
    Object.entries(inputs).forEach(([portId, value]) => {
      (Array.isArray(value) ? value : [value]).filter((item) => item?.series).forEach((item) => seriesInputs.push({ portId, envelope: item }));
    });
    if (!seriesInputs.length || node.type === "iterate") return evaluateSingle(node, inputs, context);
    const lengths = [...new Set(seriesInputs.map((item) => item.envelope.value.length))];
    const axes = [...new Set(seriesInputs.map((item) => item.envelope.axisId).filter(Boolean))];
    if (lengths.length !== 1 || axes.length > 1) throw new GraphError("SERIES_MISMATCH", "MULTIPLE UNRELATED SERIES ARE NOT SUPPORTED", { nodeId: node.id, lengths, axes });
    const length = lengths[0], perIndex = [];
    for (let index = 0; index < length; index += 1) {
      const scalarInputs = {};
      Object.entries(inputs).forEach(([portId, value]) => {
        if (Array.isArray(value)) scalarInputs[portId] = value.map((item) => item.series ? { ...item, series: false, value: clone(item.value[index]), provenance: clone(Array.isArray(item.provenance) ? item.provenance[index] : item.provenance) } : item);
        else scalarInputs[portId] = value?.series ? { ...value, series: false, value: clone(value.value[index]), provenance: clone(Array.isArray(value.provenance) ? value.provenance[index] : value.provenance) } : value;
      });
      perIndex.push(evaluateSingle(node, scalarInputs, context));
    }
    const combined = {};
    Object.keys(perIndex[0] || {}).forEach((portId) => {
      const outputs = perIndex.map((result) => result[portId]);
      combined[portId] = envelope(outputs[0]?.type || "Any", outputs.map((output) => output.value), outputs.map((output) => output.provenance), { series: true, itemType: outputs[0]?.type || "Any", axisId: axes[0] || seriesInputs[0].envelope.axisId });
    });
    return combined;
  }

  function evaluateGraph(graph, options = {}) {
    const validation = validateGraph(graph);
    const fatal = validation.diagnostics.filter((diagnostic) => !["MISSING_REQUIRED_INPUT"].includes(diagnostic.code));
    if (fatal.length) throw new GraphError("INVALID_GRAPH", "GRAPH VALIDATION FAILED", { diagnostics: validation.diagnostics });
    const order = topologicalSort(graph), outputs = {};
    const context = { ...options, graph, baseRepresentation: options.baseRepresentation || graph.settings?.baseRepresentation };
    order.forEach((nodeId) => {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId), inputs = {};
      getPorts(node, "inputs").forEach((input) => {
        const incoming = graph.edges.map(normalizedEdge).filter((edge) => edge.target.nodeId === node.id && edge.target.portId === input.id);
        if (incoming.length) {
          const values = incoming.map((edge) => outputs[edge.source.nodeId]?.[edge.source.portId]).filter(Boolean);
          inputs[input.id] = input.cardinality === "many" ? values : values[0];
        }
      });
      outputs[node.id] = liftNode(node, inputs, context);
    });

    const generators = graph.nodes.filter((node) => node.type === "generate");
    let generator = options.generatorNodeId ? generators.find((node) => node.id === options.generatorNodeId) : generators.length === 1 ? generators[0] : null;
    if (!generator && generators.length > 1) throw new GraphError("AMBIGUOUS_GENERATOR", "SELECT A GENERATOR", { generatorNodeIds: generators.map((node) => node.id) });
    const requestOutput = generator ? outputs[generator.id]?.request : null;
    let plans = [];
    if (requestOutput?.series) plans = requestOutput.value;
    else if (requestOutput?.value) plans = [requestOutput.value];
    if (!plans.length) {
      const representationNode = [...graph.nodes].reverse().find((node) => node.type === "representation");
      const stateOutput = representationNode ? outputs[representationNode.id]?.state : null;
      if (stateOutput?.series) plans = stateOutput.value.map((state, index) => ({ representationState: state, provenance: stateOutput.provenance[index] || {} }));
      else if (stateOutput?.value) plans = [{ representationState: stateOutput.value, provenance: stateOutput.provenance || {} }];
    }
    return {
      graphVersion: 2, order, diagnostics: validation.diagnostics, nodeOutputs: outputs, generatorNodeId: generator?.id || null,
      plans, variants: plans.map((plan) => ({ representationState: clone(plan.representationState), compiledInstruction: clone(plan.compiledInstruction), provenance: clone(plan.provenance || {}) })),
      representationState: clone(plans[0]?.representationState || null), representationStates: plans.map((plan) => clone(plan.representationState)),
      compiledInstruction: clone(plans[0]?.compiledInstruction || null), compiledInstructions: plans.map((plan) => clone(plan.compiledInstruction)),
      provenance: clone(plans[0]?.provenance || {}), provenances: plans.map((plan) => clone(plan.provenance || {})),
    };
  }

  function evaluateProjectGraph(project, options = {}) {
    return evaluateGraph(project.graph, { ...options, baseRepresentation: project.graph.settings?.baseRepresentation || project.representation, generatorNodeId: options.generatorNodeId || project.selectedGeneratorNodeId });
  }

  function makeGraph(baseRepresentation, templateId = "interior-refine") {
    return { version: 2, templateId, settings: { baseRepresentation: clone(baseRepresentation) }, nodes: [], edges: [] };
  }

  function coreTemplate(baseRepresentation, templateId = "interior-refine") {
    const graph = makeGraph(baseRepresentation, templateId);
    const image = addParameterNode(graph, { valueType: "Image", label: "이미지 소스", value: null, sourceType: "user" }, { x: 70, y: 80 });
    const focal = addParameterNode(graph, { valueType: "Number", label: "초점 거리", semanticPath: "global.camera.focalLengthMm", value: 35, min: 14, max: 135, step: 1, unit: "mm", unitKind: "focal-length", sourceType: "template" }, { x: 70, y: 245 });
    const height = addParameterNode(graph, { valueType: "Number", label: "카메라 높이", semanticPath: "global.camera.cameraHeightMm", value: 1500, min: 500, max: 2500, step: 10, unit: "mm", unitKind: "length", sourceType: "template" }, { x: 70, y: 405 });
    const temperature = addParameterNode(graph, { valueType: "Number", label: "색온도", semanticPath: "global.lighting.colorTemperatureK", value: 3000, min: 2700, max: 6500, step: 100, unit: "K", unitKind: "temperature", sourceType: "template" }, { x: 70, y: 580 });
    const softness = addParameterNode(graph, { valueType: "Number", label: "조명 부드러움", semanticPath: "global.lighting.softness", value: 70, min: 0, max: 100, step: 1, unit: "%", unitKind: "ratio", sourceType: "template" }, { x: 70, y: 740 });
    const mode = addParameterNode(graph, { valueType: "Enum", label: "표현 방식", semanticPath: "global.output.representationPreset", value: "photoreal_actual", domain: "RepresentationMode", options: ["photoreal_actual", "archviz_render", "sketchup_like", "massing_white_model"], sourceType: "template" }, { x: 390, y: 740 });
    const style = addParameterNode(graph, { valueType: "Enum", label: "디자인 스타일", semanticPath: "global.output.designStylePreset", value: "brutalism", domain: "DesignStyle", options: ["none", "modernism", "postmodernism", "art_deco", "art_nouveau", "brutalism", "organic"], sourceType: "template" }, { x: 390, y: 900 });
    const camera = addNode(graph, "camera", { label: "카메라" }, { x: 390, y: 220 });
    const lighting = addNode(graph, "lighting", { label: "조명" }, { x: 390, y: 470 });
    const representation = addNode(graph, "representation", { label: "표현" }, { x: 690, y: 380 });
    const compiler = addNode(graph, "compile", { label: "컴파일" }, { x: 970, y: 380 });
    const generator = addNode(graph, "generate", { label: "생성" }, { x: 1210, y: 340 });
    const compare = addNode(graph, "compare", { label: "비교" }, { x: 1450, y: 380 });
    [
      [focal, "value", camera, "lens"], [height, "value", camera, "height"],
      [temperature, "value", lighting, "temperature"], [softness, "value", lighting, "softness"],
      [mode, "value", representation, "mode"], [style, "value", representation, "style"],
      [camera, "state", representation, "camera"], [lighting, "state", representation, "lighting"],
      [representation, "state", compiler, "state"], [image, "image", generator, "source"],
      [representation, "state", generator, "state"], [compiler, "instruction", generator, "instruction"],
      [generator, "request", compare, "input"],
    ].forEach(([fromNode, fromPortId, toNode, toPortId]) => connect(graph, { fromNodeId: fromNode.id, fromPortId, toNodeId: toNode.id, toPortId }));
    graph.settings.coreNodeIds = { image: image.id, focal: focal.id, height: height.id, temperature: temperature.id, softness: softness.id, mode: mode.id, style: style.id, camera: camera.id, lighting: lighting.id, representation: representation.id, compiler: compiler.id, generator: generator.id, compare: compare.id };
    return graph;
  }

  function installSeries(graph, semantic, values) {
    const ids = graph.settings.coreNodeIds;
    const targetNodeId = semantic === "lighting.colorTemperatureK" ? ids.lighting : ids.camera;
    const targetPortId = semantic === "lighting.colorTemperatureK" ? "temperature" : "lens";
    const sourceNodeId = semantic === "lighting.colorTemperatureK" ? ids.temperature : ids.focal;
    const source = graph.nodes.find((node) => node.id === sourceNodeId);
    disconnect(graph, { toNodeId: targetNodeId, toPortId: targetPortId });
    removeNode(graph, sourceNodeId);
    const list = addParameterNode(graph, { valueType: "List", label: semantic.startsWith("lighting") ? "색온도 연구" : "초점 거리 연구", semanticPath: `global.${semantic}`, value: values, itemType: "Number", unit: semantic.startsWith("lighting") ? "K" : "mm", unitKind: semantic.startsWith("lighting") ? "temperature" : "focal-length", sourceType: "template" }, { x: 60, y: semantic.startsWith("lighting") ? 580 : 245 });
    const iterate = addNode(graph, "iterate", { label: "반복", semanticPath: `global.${semantic}`, itemType: "Number", unitKind: list.settings.unitKind }, { x: 310, y: list.y + 20 });
    const target = graph.nodes.find((node) => node.id === targetNodeId); if (target) target.x = 560;
    const representation = graph.nodes.find((node) => node.id === ids.representation); if (representation) representation.x = 840;
    const compiler = graph.nodes.find((node) => node.id === ids.compiler); if (compiler) compiler.x = 1090;
    const generator = graph.nodes.find((node) => node.id === ids.generator); if (generator) generator.x = 1320;
    const compare = graph.nodes.find((node) => node.id === ids.compare); if (compare) compare.x = 1540;
    connect(graph, { fromNodeId: list.id, fromPortId: "list", toNodeId: iterate.id, toPortId: "list" });
    connect(graph, { fromNodeId: iterate.id, fromPortId: "item", toNodeId: targetNodeId, toPortId: targetPortId });
    graph.settings.coreNodeIds.list = list.id; graph.settings.coreNodeIds.iterate = iterate.id;
    return graph;
  }

  function createTemplateGraph(templateId = "interior-refine", baseRepresentation = null) {
    const graph = coreTemplate(baseRepresentation, templateId);
    if (templateId === "camera-study") installSeries(graph, "camera.focalLengthMm", [24, 35, 50, 85]);
    if (templateId === "lighting-study") installSeries(graph, "lighting.colorTemperatureK", [2700, 3000, 4000, 5500]);
    return graph;
  }

  function migrateGraphV1(project) {
    if (project.graph?.version === 2) return project.graph;
    project.graph = createTemplateGraph(project.templateId || "interior-refine", project.representation);
    project.workspaceMode = "system";
    return project.graph;
  }

  function diffEvaluations(before, after) {
    const flatten = (state) => {
      const result = {};
      walkAttributes(state?.global || {}, (path, value) => { result[`global.${path}`] = clone(value); });
      return result;
    };
    const a = flatten(before?.representationState || before), b = flatten(after?.representationState || after);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((path) => JSON.stringify(a[path]) !== JSON.stringify(b[path])).map((path) => ({ path, before: a[path], after: b[path], source: clone(after?.provenance?.[path] || null) }));
  }

  function createClusterInstance(type, baseRepresentation = null, position = {}) {
    if (type !== "camera-study" && type !== "lighting-study") throw new GraphError("UNKNOWN_CLUSTER", `UNKNOWN CLUSTER: ${type}`);
    const subgraph = createTemplateGraph(type, baseRepresentation);
    const overrideNode = subgraph.nodes.find((node) => node.type === (type === "camera-study" ? "camera" : "lighting"));
    if (overrideNode) overrideNode.label = type === "camera-study" ? "카메라 오버라이드" : "조명 오버라이드";
    return {
      id: makeId("cluster"), type: "cluster", kind: "cluster", label: type === "camera-study" ? "카메라 연구" : "조명 연구",
      x: Number(position.x ?? 180), y: Number(position.y ?? 180), order: 0,
      settings: { clusterType: type, subgraph, collapsed: true },
    };
  }

  function runIterate(project, iterateNodeId, options = {}) {
    const evaluation = evaluateProjectGraph(project, options);
    if (iterateNodeId && !project.graph.nodes.some((node) => node.id === iterateNodeId && node.type === "iterate")) throw new GraphError("ITERATE_NOT_FOUND", "ITERATE NODE NOT FOUND", { iterateNodeId });
    return evaluation.variants;
  }

  globalThis.VRL_GRAPH = {
    version: 2, VALUE_TYPES, COMPONENT_DEFAULTS, PORT_SYMBOLS, REGISTRY, GraphError,
    getNodeDef, getPorts, getPort, createNode, addNode, addParameterNode, removeNode,
    connect, disconnect, setParameterValue, validateGraph, topologicalSort, evaluateGraph, evaluateProjectGraph,
    createTemplateGraph, migrateGraphV1, diffEvaluations, createClusterInstance, runIterate,
    compatiblePorts, normalizedEdge, clone,
  };
})();
