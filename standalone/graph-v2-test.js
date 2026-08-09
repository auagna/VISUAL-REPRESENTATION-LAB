const assert = require("node:assert/strict");

const element = () => ({
  textContent: "", innerHTML: "", value: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {},
});

global.document = { getElementById: () => element() };
global.localStorage = { getItem: () => null, setItem() {} };
global.alert = () => {};
global.confirm = () => true;
global.prompt = () => "Test Module";

require("./provider-runtime.js");
require("./graph-runtime.js");
require("./app.js");

const vrl = global.__VRL_TEST__;
const graphApi = global.VRL_GRAPH;
const bySemantic = (graph, path) => graph.nodes.find((node) => node.settings?.semanticPath === path);
const byType = (graph, type) => graph.nodes.find((node) => node.type === type);

const project = vrl.createProject("interior-refine");
assert.equal(project.graph.version, 2, "Interior Refine uses graph schema v2");
assert.equal(project.workspaceMode, "system", "Graph is the primary workspace");

const lens = bySemantic(project.graph, "global.camera.focalLengthMm");
const height = bySemantic(project.graph, "global.camera.cameraHeightMm");
const temperature = bySemantic(project.graph, "global.lighting.colorTemperatureK");
const softness = bySemantic(project.graph, "global.lighting.softness");
const representationMode = bySemantic(project.graph, "global.output.representationPreset");
const designStyle = bySemantic(project.graph, "global.output.designStylePreset");
const camera = byType(project.graph, "camera");
const lighting = byType(project.graph, "lighting");
const representation = byType(project.graph, "representation");
const generator = byType(project.graph, "generate");

assert.ok(lens && height && temperature && softness && representationMode && designStyle);
assert.ok(camera && lighting && representation && generator);

const evaluation35 = vrl.evaluateProjectGraph(project);
assert.equal(evaluation35.representationState.global.camera.focalLengthMm.value, 35);
assert.equal(evaluation35.representationState.global.camera.cameraHeightMm.value, 1500);
assert.equal(evaluation35.representationState.global.lighting.colorTemperatureK.value, 3000);
assert.equal(evaluation35.representationState.global.lighting.softness.value, 70);
assert.equal(evaluation35.representationState.global.output.representationPreset.value, "photoreal_actual");
assert.equal(evaluation35.representationState.global.output.designStylePreset.value, "brutalism");
assert.equal(evaluation35.provenance["global.camera.focalLengthMm"].sourceNodeId, lens.id);

const executionBefore = vrl.clone(project.execution);
const prompt35 = vrl.compileGlobal(evaluation35.representationState);
vrl.setParameterValue(project.graph, lens.id, 50);
const evaluation50 = vrl.evaluateProjectGraph(project);
assert.deepEqual(vrl.diffRepresentations(evaluation35.representationState, evaluation50.representationState).map((item) => item.path), ["global.camera.focalLengthMm"], "35→50 changes only focal length");
assert.deepEqual(vrl.diffPrompts(prompt35, vrl.compileGlobal(evaluation50.representationState)).map((item) => item.id), ["camera"], "35→50 changes only compiler camera section");
assert.deepEqual(project.execution, executionBefore, "Graph semantic edit does not mutate Execution State");

const deterministicGraph = vrl.clone(project.graph);
deterministicGraph.nodes.reverse();
assert.deepEqual(vrl.evaluateGraph(project.graph).representationState, vrl.evaluateGraph(deterministicGraph).representationState, "Evaluation is independent of node array ordering");

const invalidGraph = vrl.clone(project.graph);
const image = byType(invalidGraph, "image");
assert.throws(() => vrl.connectGraph(invalidGraph, { fromNodeId: image.id, fromPortId: "image", toNodeId: byType(invalidGraph, "camera").id, toPortId: "lens" }, { mode: "replace" }), (error) => error.code === "INCOMPATIBLE_CONNECTION", "Image→Number is rejected");

const conflictGraph = vrl.clone(project.graph);
const modern = vrl.addParameterNode(conflictGraph, { valueType: "Enum", value: "modernism", label: "Modernism", domain: "DesignStyle", semanticPath: "global.output.designStylePreset" });
const conflictRepresentation = byType(conflictGraph, "representation");
assert.throws(() => vrl.connectGraph(conflictGraph, { fromNodeId: modern.id, fromPortId: "value", toNodeId: conflictRepresentation.id, toPortId: "style" }), (error) => error.code === "INPUT_OCCUPIED", "A second Style source is explicit conflict");

const mixedGraph = vrl.clone(project.graph);
const mixedRepresentation = byType(mixedGraph, "representation");
const originalStyle = bySemantic(mixedGraph, "global.output.designStylePreset");
const modernStyle = vrl.addParameterNode(mixedGraph, { valueType: "Enum", value: "modernism", label: "Modernism", domain: "DesignStyle", semanticPath: "global.output.designStylePreset" });
const styleMix = vrl.addGraphNode(mixedGraph, "styleMix", { label: "Style Mix" });
vrl.disconnectGraph(mixedGraph, { toNodeId: mixedRepresentation.id, toPortId: "style" });
vrl.connectGraph(mixedGraph, { fromNodeId: originalStyle.id, fromPortId: "value", toNodeId: styleMix.id, toPortId: "a" });
vrl.connectGraph(mixedGraph, { fromNodeId: modernStyle.id, fromPortId: "value", toNodeId: styleMix.id, toPortId: "b" });
vrl.connectGraph(mixedGraph, { fromNodeId: styleMix.id, fromPortId: "style", toNodeId: mixedRepresentation.id, toPortId: "style" });
const mixedEvaluation = vrl.evaluateGraph(mixedGraph);
assert.equal(mixedEvaluation.representationState.global.output.designStylePreset.value.kind, "style-mix", "Multiple styles require explicit Style Mix");
assert.ok(mixedEvaluation.compiledInstruction.sections.some((section) => section.id === "design-style-mix"), "Explicit Style Mix remains explicit in the compiler");

const cyclic = { version: 2, settings: { baseRepresentation: vrl.clone(project.representation) }, nodes: [], edges: [] };
const overrideA = vrl.addGraphNode(cyclic, "override", { label: "Override A", semanticPath: "global.camera.focalLengthMm" });
const overrideB = vrl.addGraphNode(cyclic, "override", { label: "Override B", semanticPath: "global.camera.focalLengthMm" });
vrl.connectGraph(cyclic, { fromNodeId: overrideA.id, fromPortId: "state", toNodeId: overrideB.id, toPortId: "base" });
assert.throws(() => vrl.connectGraph(cyclic, { fromNodeId: overrideB.id, fromPortId: "state", toNodeId: overrideA.id, toPortId: "base" }), (error) => error.code === "CYCLE_DETECTED", "Cycles are rejected before mutation");

const fallbackGraph = vrl.clone(project.graph);
const fallbackTemperature = bySemantic(fallbackGraph, "global.lighting.colorTemperatureK");
vrl.setParameterValue(fallbackGraph, fallbackTemperature.id, 4200);
assert.equal(vrl.evaluateGraph(fallbackGraph).representationState.global.lighting.colorTemperatureK.value, 4200);
vrl.disconnectGraph(fallbackGraph, { toNodeId: byType(fallbackGraph, "lighting").id, toPortId: "temperature" });
const fallback = vrl.evaluateGraph(fallbackGraph);
assert.equal(fallback.representationState.global.lighting.colorTemperatureK.value, vrl.COMPONENT_DEFAULTS.lighting.temperature, "Disconnected input uses component default");
assert.equal(fallback.provenance["global.lighting.colorTemperatureK"].sourceType, "component-default");
assert.equal(fallback.provenance["global.lighting.colorTemperatureK"].sourceNodeId, byType(fallbackGraph, "lighting").id);

const study = vrl.createProject("camera-study");
const iterate = byType(study.graph, "iterate");
const list = byType(study.graph, "list");
const studyEvaluation = vrl.evaluateProjectGraph(study);
assert.deepEqual(studyEvaluation.variants.map((variant) => variant.representationState.global.camera.focalLengthMm.value), [24, 35, 50, 85], "List→Iterate produces four states");
const baseline35 = studyEvaluation.variants[1].representationState;
studyEvaluation.variants.forEach((variant) => {
  const value = variant.representationState.global.camera.focalLengthMm.value;
  assert.deepEqual(vrl.diffRepresentations(baseline35, variant.representationState).map((item) => item.path), value === 35 ? [] : ["global.camera.focalLengthMm"], `Variant ${value} changes only focal length`);
});
vrl.setParameterValue(study.graph, list.id, [28, 35, 50]);
assert.deepEqual(vrl.runIterate(study, iterate.id).map((variant) => variant.representationState.global.camera.focalLengthMm.value), [28, 35, 50], "Editing List changes generic Iterate cardinality");

const clusterGraph = vrl.clone(project.graph);
const beforeClusterCount = clusterGraph.nodes.length;
const cluster = vrl.createClusterInstance("camera-study", project.representation);
clusterGraph.nodes.push(cluster);
assert.equal(clusterGraph.nodes.length, beforeClusterCount + 1, "Cluster insertion preserves the existing graph");
assert.deepEqual(["list", "iterate", "camera", "generate", "compare"].map((type) => cluster.settings.subgraph.nodes.some((node) => node.type === type)), [true, true, true, true, true], "Camera Study is an editable List/Iterate subgraph");

(async () => {
  const snapshotProject = vrl.createProject("interior-refine");
  const evaluation = vrl.evaluateProjectGraph(snapshotProject);
  const graphEvaluation = { representationState: evaluation.representationState, compiledInstruction: evaluation.compiledInstruction, provenance: evaluation.provenance, generatorNodeId: evaluation.generatorNodeId };
  const snapshot = await vrl.createExperiment(snapshotProject, evaluation.representationState, "Baseline", null, null, false, graphEvaluation);
  assert.equal(snapshot.graphSnapshot.version, 2);
  assert.equal(snapshot.graphProvenance["global.camera.focalLengthMm"].sourceNodeId, bySemantic(snapshotProject.graph, "global.camera.focalLengthMm").id);
  assert.deepEqual(snapshot.executionState, snapshotProject.execution);
  const snapValue = bySemantic(snapshot.graphSnapshot, "global.camera.focalLengthMm").settings.value;
  vrl.setParameterValue(snapshotProject.graph, bySemantic(snapshotProject.graph, "global.camera.focalLengthMm").id, 50);
  assert.equal(bySemantic(snapshot.graphSnapshot, "global.camera.focalLengthMm").settings.value, snapValue, "Historical graph snapshot is immutable");
  console.log("VRL graph architecture v2 core acceptance tests: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
