# Visual Representation Lab — MVP v0.2

VRL is a local, structured visual representation-control workspace for interior visualization experiments. Its primary object is explicit `Representation State`; prompts are deterministic compiled artifacts and generated images are reproducible experiment snapshots.

## Zero-install run

The current runnable build has no package dependencies:

```powershell
cd "C:\Users\yujin\Documents\VISUAL REPRESENTATION LAB"
python -m http.server 3000 --bind 127.0.0.1 --directory standalone
```

Open `http://localhost:3000`. The bundled Codex Python runtime can be used if `python` is not on PATH. Opening `standalone/index.html` directly also works, but the local server is recommended.

## v0.2 capabilities

- Functional project launcher with six cloned workflow templates
- Node graph with draggable node instances and typed port metadata
- Basic node, workflow module, and editable node-preset separation
- Module insertion without replacing an existing graph
- Local custom modules from connected node selections
- Global and regional Representation State using `LOCKED`, `CONTROLLED`, and `FREE`
- Physically consistent camera state: FOV derives from sensor and focal length
- Explicit lighting state with deterministic semantic translation
- Independent Canvas selection masks and regional preservation controls
- Deterministic global and region-edit compilers
- Mock generation and mock region-edit providers
- Camera/lighting OFAT, coordinated Alt Exploration, comparison, evaluation, and failure tags
- Project, graph, experiment, mask, and custom-module persistence in `localStorage`

## Validation

Run the dependency-free smoke tests:

```powershell
node standalone\smoke-test.js
```

These verify template cloning, camera/FOV consistency, deterministic compilation, one-factor diffs, regional compiler sections, graph snapshots, and mock output.

## Source layout

- `standalone/index.html` — dependency-free entry point
- `standalone/app.css` — workspace, graph, inspector, mask, and results layout
- `standalone/app.js` — project model, templates, graph, compilers, providers, persistence, and UI
- `standalone/smoke-test.js` — high-value no-dependency invariant checks
- `src/` — earlier Next.js/TypeScript MVP v0.1 architecture retained for reference

Real generation can be connected by implementing the same contracts represented by `MockImageProvider` and `MockImageEditProvider`. API credentials must remain outside client code.
