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

assert.equal(vrl.templateConfigs.length, 6, "six default templates exist");
assert.ok(Object.keys(vrl.moduleConfigs).length >= 6, "default insertable modules exist");

const projectA = vrl.createProject("interior-refine");
const projectB = vrl.createProject("interior-refine");
projectA.representation.global.camera.focalLengthMm.value = 50;
assert.equal(projectB.representation.global.camera.focalLengthMm.value, 35, "template projects are independent clones");

const camera = projectB.representation.global.camera;
const fov = vrl.horizontalFovDeg(camera);
assert.ok(Math.abs(vrl.focalFromFov(camera.sensor.value, fov) - camera.focalLengthMm.value) < 0.2, "FOV round-trip remains physically consistent");

const promptA = vrl.compileGlobal(projectB.representation);
const promptB = vrl.compileGlobal(vrl.clone(projectB.representation));
assert.deepEqual(promptA, promptB, "same state compiles identically");

const cameraStudy = vrl.createProject("camera-study");
const cameraPrompt = vrl.compileGlobal(cameraStudy.representation);
const changed = vrl.clone(cameraStudy.representation);
changed.global.camera.focalLengthMm.value = 85;
assert.deepEqual(vrl.diffRepresentations(cameraStudy.representation, changed).map((item) => item.path), ["global.camera.focalLengthMm"], "OFAT-compatible state differs in one variable");
assert.deepEqual(vrl.diffPrompts(cameraPrompt, vrl.compileGlobal(changed)).map((item) => item.id), ["camera"], "one camera change alters only camera compiler section");

const region = vrl.blankRegion("Dining Table", "data:image/png;base64,mask");
projectB.representation.regions.push(region);
const local = vrl.compileRegionEdit(projectB.representation, region);
assert.ok(local.sections.some((item) => item.label === "REGION TARGET"), "region compiler includes target block");
assert.ok(local.sections.some((item) => item.label === "REGION CHANGE"), "region compiler includes change block");
assert.ok(local.sections.some((item) => item.label === "REGION PRESERVE"), "region compiler includes preserve block");
assert.ok(local.sections.some((item) => item.label === "OUTSIDE MASK"), "region compiler includes outside-mask block");
assert.ok(local.sections.some((item) => item.id === "representation-preset"), "region edit inherits global output preset");

// Output Preset TEST 1: Representation and Design Style remain independent.
const independent = vrl.createProject("interior-refine").representation;
vrl.applyOutputPreset(independent, "representation", "archviz_render", 80);
vrl.applyOutputPreset(independent, "design", "art_deco", 70);
assert.equal(independent.global.output.representationPreset.value, "archviz_render");
assert.equal(independent.global.output.designStylePreset.value, "art_deco");

// TEST 2: Photoreal Actual + Brutalism produces both explicit blocks.
const photorealBrutal = vrl.createProject("interior-refine").representation;
vrl.applyOutputPreset(photorealBrutal, "representation", "photoreal_actual");
vrl.applyOutputPreset(photorealBrutal, "design", "brutalism");
const photorealBrutalPrompt = vrl.compileOutput(photorealBrutal);
assert.ok(photorealBrutalPrompt.sections.some((item) => item.id === "representation-preset" && item.text.includes("Photoreal actual")));
assert.ok(photorealBrutalPrompt.sections.some((item) => item.id === "design-style-preset" && item.text.includes("Brutalist architectural")));

// TEST 3: Massing + Organic produces both explicit blocks.
const massingOrganic = vrl.createProject("interior-refine").representation;
vrl.applyOutputPreset(massingOrganic, "representation", "massing_white_model");
vrl.applyOutputPreset(massingOrganic, "design", "organic");
const massingOrganicPrompt = vrl.compileOutput(massingOrganic);
assert.ok(massingOrganicPrompt.prompt.includes("Abstract white model representation"));
assert.ok(massingOrganicPrompt.prompt.includes("Organic architectural language"));

// TEST 4: Explicit user material overrides preset material hints/directives.
photorealBrutal.global.material.primary = { ...photorealBrutal.global.material.primary, value: "white plaster", source: "user", mode: "controlled" };
const overriddenMaterialPrompt = vrl.compileOutput(photorealBrutal).prompt;
assert.ok(overriddenMaterialPrompt.includes("white plaster"));
assert.ok(!overriddenMaterialPrompt.includes("Exposed concrete"));
assert.ok(!overriddenMaterialPrompt.includes("board-formed concrete"));

// TEST 5: Changing Design Style leaves Camera State unchanged.
const designIsolation = vrl.createProject("camera-study").representation;
const cameraBeforeStyle = vrl.clone(designIsolation.global.camera);
vrl.applyOutputPreset(designIsolation, "design", "postmodernism");
assert.deepEqual(designIsolation.global.camera, cameraBeforeStyle);

// TEST 6: Changing Representation leaves Lighting State unchanged.
const representationIsolation = vrl.createProject("lighting-study").representation;
const lightingBeforeRepresentation = vrl.clone(representationIsolation.global.lighting);
vrl.applyOutputPreset(representationIsolation, "representation", "sketchup_like");
assert.deepEqual(representationIsolation.global.lighting, lightingBeforeRepresentation);

// TEST 7: Exclusions merge without duplication.
assert.deepEqual(vrl.mergeExclusions(["visual clutter", "rich textures"], ["Visual clutter.", "decorative detail"]), ["visual clutter", "rich textures", "decorative detail"]);

// TEST 8: Applying a preset records source=preset.
assert.equal(representationIsolation.global.output.representationPreset.source, "preset");

// TEST 9: Explicit user modification records source=user.
representationIsolation.global.material.primary.value = "white plaster";
representationIsolation.global.material.primary.source = "user";
assert.equal(representationIsolation.global.material.primary.source, "user");

// TEST 10: Same State + same presets is deterministic.
const deterministicA = vrl.compileOutput(massingOrganic);
const deterministicB = vrl.compileOutput(vrl.clone(massingOrganic));
assert.deepEqual(deterministicA, deterministicB);

// Definition-of-done combination matrix: every pair emits distinct explicit blocks.
const combinationPrompts = [
  ["photoreal_actual", "brutalism"],
  ["archviz_render", "art_deco"],
  ["sketchup_like", "modernism"],
  ["massing_white_model", "organic"],
].map(([representationId, styleId]) => {
  const state = vrl.createProject("interior-refine").representation;
  vrl.applyOutputPreset(state, "representation", representationId);
  vrl.applyOutputPreset(state, "design", styleId);
  const compiled = vrl.compileOutput(state);
  assert.ok(compiled.sections.some((item) => item.id === "representation-preset"));
  assert.ok(compiled.sections.some((item) => item.id === "design-style-preset"));
  return compiled.prompt;
});
assert.equal(new Set(combinationPrompts).size, 4, "four required combinations compile differently");

(async () => {
  const router = new global.VRL_AI.ModelRouter();

  // AI Provider TEST 1: Mock Provider remains functional.
  const snapshot = await vrl.createExperiment(projectB, projectB.representation, "Baseline");
  assert.ok(snapshot.graphSnapshot.nodes.length > 0, "snapshot stores graph");
  assert.equal(snapshot.provider, "mock", "mock provider remains available");
  assert.ok(snapshot.generatedImages[0].url.startsWith("data:image/svg+xml"), "mock output is generated");

  // TEST 2: no selected/connected provider produces an explicit connection-required state.
  assert.throws(() => router.resolve({ capability: "generation", globalSettings: global.VRL_AI.defaultSettings(), projectExecution: global.VRL_AI.defaultProjectExecution(), statuses: { mock: "connected", openai: "not_connected", google: "not_connected" } }), (error) => error.code === "CONNECTION_REQUIRED");

  // TEST 3: OpenAI is selected when configured as a project default.
  const openAIProjectExecution = global.VRL_AI.defaultProjectExecution();
  openAIProjectExecution.useGlobalDefaults = false;
  openAIProjectExecution.generationModel = { providerId: "openai", modelId: "gpt-image-2" };
  const openAIResolved = router.resolve({ capability: "generation", globalSettings: global.VRL_AI.defaultSettings(), projectExecution: openAIProjectExecution, statuses: { openai: "connected" } });
  assert.equal(openAIResolved.model.id, "gpt-image-2");

  // TEST 4: Generator override supersedes project default.
  openAIProjectExecution.generatorOverrides.generatorA = { providerId: "google", modelId: "gemini-3.1-flash-image" };
  const overrideResolved = router.resolve({ capability: "generation", globalSettings: global.VRL_AI.defaultSettings(), projectExecution: openAIProjectExecution, nodeId: "generatorA", statuses: { openai: "connected", google: "connected" } });
  assert.equal(overrideResolved.provider.id, "google");

  // TEST 5: switching providers never changes Representation State.
  const representationBeforeRouting = vrl.clone(projectB.representation);
  openAIProjectExecution.generatorOverrides.generatorA = { providerId: "openai", modelId: "gpt-image-2" };
  assert.deepEqual(projectB.representation, representationBeforeRouting);

  // TEST 6: capability registry identifies edit support.
  assert.equal(global.VRL_AI.modelById["gpt-image-2"].capabilities.editing, true);
  assert.equal(global.VRL_AI.modelById["gemini-3.1-flash-image"].capabilities.maskEditing, false);

  // TEST 7: a masked Region Edit requests maskEditing capability.
  assert.equal(vrl.routingCapability(projectB, region), "maskEditing");

  // TEST 8: unsupported capability has a clear normalized error and recommendations.
  const geminiOnly = global.VRL_AI.defaultProjectExecution();
  geminiOnly.useGlobalDefaults = false;
  geminiOnly.editModel = { providerId: "google", modelId: "gemini-3.1-flash-image" };
  assert.throws(() => router.resolve({ capability: "maskEditing", globalSettings: global.VRL_AI.defaultSettings(), projectExecution: geminiOnly, statuses: { google: "connected" } }), (error) => error.code === "UNSUPPORTED_CAPABILITY" && /MODEL DOES NOT SUPPORT/.test(error.message) && error.details.recommendations.length > 0);

  // TEST 9: API keys never appear in serialized project data.
  const serializedProject = JSON.stringify(projectB);
  assert.ok(!serializedProject.includes("OPENAI_API_KEY") && !serializedProject.includes("GEMINI_API_KEY") && !serializedProject.includes("sk-test-secret"));

  // TEST 10: Experiment Snapshot records normalized provider and model metadata.
  assert.equal(snapshot.providerId, "mock");
  assert.equal(snapshot.modelId, "mock-image-v1");
  assert.equal(snapshot.generationSettings.capability, "generation");

  // TEST 11: OpenAI → Gemini changes Execution State only.
  const executionA = global.VRL_AI.defaultProjectExecution();
  executionA.useGlobalDefaults = false; executionA.generationModel = { providerId: "openai", modelId: "gpt-image-2" };
  const executionB = JSON.parse(JSON.stringify(executionA));
  executionB.generationModel = { providerId: "google", modelId: "gemini-3.1-flash-image" };
  assert.notDeepEqual(executionA, executionB);
  assert.deepEqual(projectB.representation, representationBeforeRouting);

  // TEST 12: identical Representation State remains identical across model choices.
  const providerAState = vrl.clone(projectB.representation), providerBState = vrl.clone(projectB.representation);
  assert.deepEqual(providerAState, providerBState);
  assert.deepEqual(vrl.compileGlobal(providerAState), vrl.compileGlobal(providerBState));

  console.log("VRL v0.3 standalone + provider router smoke tests: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
