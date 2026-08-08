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
assert.deepEqual(local.sections.map((item) => item.id), ["target", "change", "preserve", "outside"], "region compiler separates target/change/preserve/outside");

(async () => {
  const snapshot = await vrl.createExperiment(projectB, projectB.representation, "Baseline");
  assert.ok(snapshot.graphSnapshot.nodes.length > 0, "snapshot stores graph");
  assert.equal(snapshot.provider, "mock", "mock provider remains available");
  assert.ok(snapshot.generatedImages[0].url.startsWith("data:image/svg+xml"), "mock output is generated");
  console.log("VRL v0.2 standalone smoke tests: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
