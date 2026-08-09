# VRL Graph Architecture v2 — Migration Record

## Canonical rule

For migrated variables, Graph v2 is the only active writer:

`Parameter → typed port → Component → Representation State → Compile → Generate`

`project.representation` remains a compatibility read cache for the current compiler. It is refreshed only from graph evaluation for migrated semantics. Template and preset choices initialize graph nodes; they do not remain as competing active layers.

## Duplicate-control migration table

| Semantic variable | Previous active editors / precedence | Graph v2 source | Inspector after migration | Status |
|---|---|---|---|---|
| Camera focal length | Camera Inspector, camera preset, template lock/default, OFAT path mutation | Number Parameter → `Camera.Lens` | Current source/default/provenance only | Migrated |
| Camera height | Camera Inspector, camera preset, template lock/default | Number Parameter → `Camera.Height` | Current source/default/provenance only | Migrated |
| Camera pitch/yaw/shift/perspective | Camera Inspector and hidden template state | Camera component defaults or explicit compatible Parameter/Lock connection | Defaults/provenance only | Migrated core |
| Lighting temperature | Lighting Inspector, lighting preset, template, OFAT path mutation | Number Parameter → `Lighting.Temperature` | Current source/default/provenance only | Migrated |
| Lighting softness | Lighting Inspector, lighting preset, template | Number Parameter → `Lighting.Softness` | Current source/default/provenance only | Migrated |
| Lighting exposure/contrast/ambient/artificial/direction | Lighting Inspector and preset overwrite | Lighting component defaults or explicit Parameters | Defaults/provenance only | Migrated core |
| Representation mode | Same Output Preset editor on Representation and Compiler plus template value | Enum Parameter (`RepresentationMode`) → `Representation.Mode` | Read-only provenance | Migrated |
| Design style | Same Output Preset editor on Representation and Compiler plus template value | Enum Parameter (`DesignStyle`) → `Representation.Style` | Read-only provenance | Migrated |
| Multiple design styles | Implicit/ambiguous overwrite | Explicit `Style Mix` only; a second direct connection is rejected | Conflict metadata | Migrated |
| Study values | OFAT Inspector CSV plus hard-coded Compare arrays | List Parameter → generic Iterate | List edited on graph | Migrated |
| Provider/model/quality/count | Generator and model routing Inspector | Execution State, deliberately outside Representation State | Advanced Generate settings | Retained intentionally |
| Compiled instruction | Compiler preview | Derived from evaluated graph state | Read-only debug view | Retained intentionally |
| Material / atmosphere / palette / detail | Representation, Material, Atmosphere and Reference editors overlapped | Compatibility base state; no Graph v2 duplicate editor | Read-only until parameter migration | Next migration |
| Region material/color/form/preservation | Large Region Edit Inspector form | Existing Region State compatibility path | Still legacy | Next migration |
| Mask drawing | Image Mode and Inspector canvas overlap | Focused Image Mode should become Mask node asset editor | Still legacy | Next migration |

## Implemented graph variables

- `global.camera.focalLengthMm`
- `global.camera.cameraHeightMm`
- `global.camera.pitchDeg`
- `global.camera.yawDeg`
- `global.camera.verticalShift`
- `global.camera.perspectiveCorrection`
- `global.lighting.colorTemperatureK`
- `global.lighting.exposureEV`
- `global.lighting.softness`
- `global.lighting.contrast`
- `global.lighting.ambientLevel`
- `global.lighting.artificialLevel`
- `global.lighting.direction`
- `global.output.representationPreset`
- `global.output.designStylePreset`

## Core acceptance status

- Interior Refine opens in System / Graph Mode.
- Image, focal length, height, temperature, softness, representation mode and design style are explicit graph sources.
- Typed ports validate base type plus optional enum domain / numeric unit kind.
- Single inputs reject silent fan-in; replace is explicit.
- Cycles and incompatible connections are rejected before graph mutation.
- Deterministic topological evaluation creates one canonical Representation State.
- `35 mm → 50 mm` changes only `global.camera.focalLengthMm`; only the compiler Camera section changes.
- Snapshot stores graph, evaluated state, Execution State, compiled instruction, provenance and before/after delta.
- Generic List / Iterate produces `[24, 35, 50, 85]` variants without the legacy OFAT mutation engine.
- Camera Study is an insertable Cluster with editable internal List / Iterate / Camera Override / Generate / Compare graph.

## Next highest-value migration

Move Region Edit to typed `Image + Mask + Material + Lock(Camera) + Lock(Lighting) → Region Edit`, then move material/atmosphere/reference-derived values out of the compatibility base state into Parameter, Merge and Override sources. This removes the largest remaining semantic side form and the last significant hidden precedence path.

