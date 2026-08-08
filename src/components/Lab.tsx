"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { MockReferenceAnalyzer, referencePresets } from "@/analyzer/mockAnalyzer";
import { ReferenceAnalysis } from "@/analyzer/referenceAnalyzer";
import { compileRepresentation } from "@/compiler/genericCompiler";
import { diffPrompts, diffStates } from "@/experiments/diff";
import { createOfatStates } from "@/experiments/ofat";
import { loadExperiments, saveExperiments } from "@/experiments/storage";
import { Evaluation, ExperimentSnapshot } from "@/experiments/types";
import { MockImageProvider } from "@/providers/mockProvider";
import { defaultRepresentation, options } from "@/representation/defaults";
import { mergeReferenceAttributes } from "@/representation/merge";
import { Attribute, AttributeKey, GROUPS, RepresentationState, cloneState, getAttribute, setAttribute } from "@/representation/schema";

const labels: Record<AttributeKey, string> = {
  subject: "Subject", composition: "Composition", cameraAngle: "Camera angle", lens: "Lens", medium: "Medium", palette: "Palette", lighting: "Lighting", detailDensity: "Detail density", texture: "Texture", atmosphere: "Atmosphere", markMaking: "Mark making",
};
const allKeys = Object.values(GROUPS).flat() as AttributeKey[];
const emptyEvaluation: Evaluation = { targetFollowed: 3, preserved: 3, controllability: 3, notes: "", failureCause: "" };
const failureCauses = ["", "Variable definition failure", "Reference analysis failure", "Representation merge failure", "Prompt compiler failure", "Generator unpredictability", "Preservation failure", "Unknown"];

function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` }

function AttributeEditor({ attributeKey, state, onChange }: { attributeKey: AttributeKey; state: RepresentationState; onChange: (next: RepresentationState) => void }) {
  const attribute = getAttribute(state, attributeKey);
  const valueOptions = options[attributeKey];
  const update = (patch: Partial<Attribute<string>>) => onChange(setAttribute(state, attributeKey, { ...patch, source: "user" }));
  return <div className="attribute-row">
    <div><div className="attribute-label">{labels[attributeKey]}</div><div className="tiny">source: {attribute.source}</div></div>
    <div>
      <input className="field" list={`options-${attributeKey}`} value={attribute.value} onChange={(e) => update({ value: e.target.value })} />
      {valueOptions && <datalist id={`options-${attributeKey}`}>{valueOptions.map((value) => <option value={value} key={value} />)}</datalist>}
    </div>
    <div className="attribute-controls">
      <input aria-label={`${labels[attributeKey]} strength`} type="range" min="0" max="100" value={attribute.strength} onChange={(e) => update({ strength: Number(e.target.value) })} className="w-full" />
      <div className="tiny">strength {attribute.strength}</div>
    </div>
    <div className="flex flex-col gap-1">
      <button className={`toggle ${attribute.enabled ? "on" : ""}`} onClick={() => update({ enabled: !attribute.enabled })}>{attribute.enabled ? "ON" : "OFF"}</button>
      <button className={`toggle ${attribute.locked ? "locked" : ""}`} onClick={() => update({ locked: !attribute.locked })}>{attribute.locked ? "LOCKED" : "UNLOCK"}</button>
    </div>
  </div>;
}

function FileSlot({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const read = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange(String(reader.result)); reader.readAsDataURL(file) };
  return <div className="mt-3"><label className="tiny block mb-1">{label}</label><input type="file" accept="image/*" className="field text-xs" onChange={read} />{value && <div className="mt-2 relative"><img src={value} alt={label} className="w-full h-32 object-cover border border-[#c9cbc3]" /><button className="toggle absolute right-1 top-1" onClick={() => onChange(null)}>REMOVE</button></div>}</div>;
}

export function Lab() {
  const [state, setState] = useState<RepresentationState>(() => cloneState(defaultRepresentation));
  const [experiments, setExperiments] = useState<ExperimentSnapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [debug, setDebug] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<ReferenceAnalysis[]>([referencePresets[0]]);
  const [preset, setPreset] = useState(referencePresets[0].preset);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [ofatVariable, setOfatVariable] = useState<AttributeKey>("detailDensity");
  const [ofatValues, setOfatValues] = useState("20, 40, 60, 80");
  const [busy, setBusy] = useState(false);
  const compiled = useMemo(() => compileRepresentation(state), [state]);

  useEffect(() => { setExperiments(loadExperiments()); setHydrated(true) }, []);
  useEffect(() => { if (hydrated) saveExperiments(experiments) }, [experiments, hydrated]);

  const runAnalysis = async () => {
    const result = await new MockReferenceAnalyzer().analyzeReference({ name: preset, dataUrl: referenceImage ?? undefined });
    setAnalyses((items) => [...items.filter((item) => item.preset !== result.preset), result]);
  };

  const transfer = (analysis: ReferenceAnalysis, key: AttributeKey) => {
    const item = analysis.attributes.find((attribute) => attribute.key === key);
    if (!item) return;
    setState((current) => mergeReferenceAttributes(current, { [key]: { value: item.value, strength: item.strength } }, [key]));
  };

  const createSnapshot = async (nextState: RepresentationState, name: string, parent: string | null, changed: AttributeKey[]) => {
    const prompt = compileRepresentation(nextState);
    const images = await new MockImageProvider().generate({ state: nextState, prompt: prompt.prompt, seed: "vrl-mock-seed" });
    return { id: makeId(), name, timestamp: new Date().toISOString(), parentExperimentId: parent, representationState: cloneState(nextState), compiledPrompt: prompt, provider: "mock", changedVariables: changed, generatedImages: images, evaluation: { ...emptyEvaluation } } satisfies ExperimentSnapshot;
  };

  const generate = async () => {
    setBusy(true);
    try {
      const previous = experiments[0];
      const changed = previous ? diffStates(previous.representationState, state).map((item) => item.key) : [];
      const snapshot = await createSnapshot(state, previous ? `Test ${experiments.length}` : "Baseline", previous?.id ?? null, changed);
      setExperiments((items) => [snapshot, ...items]); setSelected((ids) => [snapshot.id, ...ids].slice(0, 2));
    } finally { setBusy(false) }
  };

  const runOfat = async () => {
    const values = ofatValues.split(",").map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
    if (!values.length) return;
    setBusy(true);
    try {
      const parent = experiments[0]?.id ?? null;
      const variants = createOfatStates(state, ofatVariable, values);
      const created: ExperimentSnapshot[] = [];
      for (let i = 0; i < variants.length; i++) created.push(await createSnapshot(variants[i], `OFAT ${labels[ofatVariable]} · ${values[i]}`, parent, [ofatVariable]));
      setExperiments((items) => [...created.reverse(), ...items]); setSelected(created.slice(0, 2).map((item) => item.id));
    } finally { setBusy(false) }
  };

  const toggleSelected = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items.slice(-1), id]);
  const compared = selected.map((id) => experiments.find((item) => item.id === id)).filter(Boolean) as ExperimentSnapshot[];
  const stateDiff = compared.length === 2 ? diffStates(compared[0].representationState, compared[1].representationState) : [];
  const promptDiff = compared.length === 2 ? diffPrompts(compared[0].compiledPrompt, compared[1].compiledPrompt) : [];
  const patchExperiment = (id: string, patch: Partial<ExperimentSnapshot>) => setExperiments((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const duplicate = (item: ExperimentSnapshot) => setExperiments((items) => [{ ...JSON.parse(JSON.stringify(item)), id: makeId(), name: `${item.name} copy`, timestamp: new Date().toISOString(), parentExperimentId: item.id }, ...items]);
  const reset = () => { if (!confirm("Delete all local experiment history and restore the demo state?")) return; setExperiments([]); setSelected([]); setState(cloneState(defaultRepresentation)); localStorage.removeItem("vrl-experiments-v0.1") };

  return <main>
    <header className="px-5 py-4 border-b border-[#c9cbc3] flex flex-wrap items-center justify-between gap-3 bg-[#fbfaf6]">
      <div><h1 className="text-lg font-black tracking-tight">VISUAL REPRESENTATION LAB <span className="text-[#d65c3d]">MVP 0.1</span></h1><p className="tiny mt-1">ARCHITECTURE · ONE FACTOR AT A TIME · LOCAL MOCK MODE</p></div>
      <div className="flex gap-2"><button className={`toggle ${debug ? "on" : ""}`} onClick={() => setDebug(!debug)}>DEBUG {debug ? "ON" : "OFF"}</button><button className="btn danger" onClick={reset}>RESET LAB</button></div>
    </header>

    <div className="lab-grid">
      <aside className="column">
        <section className="section"><h2 className="section-title">01 · Input / references</h2><label className="tiny block mb-1">ARCHITECTURAL INTENT</label><textarea className="field min-h-24" value={state.content.subject.value} onChange={(e) => setState(setAttribute(state, "subject", { value: e.target.value, source: "user" }))} />
          <FileSlot label="OPTIONAL REFERENCE IMAGE (analyzed as mock preset)" value={referenceImage} onChange={setReferenceImage} /><FileSlot label="OPTIONAL TARGET / BASE IMAGE (stored separately)" value={targetImage} onChange={setTargetImage} />
          <label className="tiny block mt-4 mb-1">REFERENCE PRESET</label><select className="field" value={preset} onChange={(e) => setPreset(e.target.value)}>{referencePresets.map((item) => <option key={item.preset}>{item.preset}</option>)}</select><button className="btn w-full mt-2" onClick={runAnalysis}>ANALYZE REFERENCE</button>
        </section>
        <section className="section"><h2 className="section-title">02 · Reference analysis</h2><p className="text-xs text-[#6e716b] mb-3">Attributes transfer individually. Reference subject is never inferred or transferred.</p>{analyses.map((analysis) => <div key={analysis.preset} className="mb-5"><div className="text-xs font-black">{analysis.preset}</div>{analysis.attributes.map((item) => <div className="analysis-card" key={item.key}><div className="flex justify-between gap-2"><div><div className="text-xs font-bold">{item.label}</div><div className="text-sm">{item.value}</div><div className="tiny">strength {item.strength}</div></div><button className="toggle on self-center" onClick={() => transfer(analysis, item.key)}>TRANSFER</button></div></div>)}</div>)}</section>
      </aside>

      <section className="column">
        <div className="section"><h2 className="section-title">03 · Representation state</h2><p className="text-xs text-[#6e716b] mb-4">Every control edits the canonical state. Locking creates an explicit preservation constraint.</p>
          <h3 className="tiny font-bold mb-1">CONTENT</h3>{GROUPS.content.map((key) => <AttributeEditor key={key} attributeKey={key} state={state} onChange={setState} />)}
          <h3 className="tiny font-bold mt-5 mb-1">STRUCTURE / CAMERA</h3>{GROUPS.structure.map((key) => <AttributeEditor key={key} attributeKey={key} state={state} onChange={setState} />)}
          <h3 className="tiny font-bold mt-5 mb-1">APPEARANCE / REPRESENTATION</h3>{GROUPS.appearance.map((key) => <AttributeEditor key={key} attributeKey={key} state={state} onChange={setState} />)}
        </div>
      </section>

      <aside className="column output">
        <section className="section"><h2 className="section-title">04 · Compiled output</h2>{compiled.sections.map((section) => <div className="prompt-section" key={section.id}><h4>{section.label}</h4><p>{section.text}</p></div>)}</section>
        <section className="section"><h2 className="section-title">05 · Generate</h2><div className="flex gap-2"><button className="btn flex-1" disabled={busy} onClick={generate}>{busy ? "RUNNING…" : "GENERATE / SAVE BASELINE"}</button></div><p className="tiny mt-2">Provider: deterministic mock SVG · same state produces same prompt and mock image</p></section>
        <section className="section"><h2 className="section-title">06 · OFAT experiment</h2><label className="tiny block mb-1">VARIABLE</label><select className="field" value={ofatVariable} onChange={(e) => setOfatVariable(e.target.value as AttributeKey)}>{allKeys.filter((key) => key !== "subject").map((key) => <option value={key} key={key}>{labels[key]}</option>)}</select><label className="tiny block mt-3 mb-1">STRENGTH VALUES (0–100, comma separated)</label><input className="field" value={ofatValues} onChange={(e) => setOfatValues(e.target.value)} /><button className="btn w-full mt-2" disabled={busy} onClick={runOfat}>RUN OFAT SERIES</button></section>
        {debug && <section className="section"><h2 className="section-title">Debug state JSON</h2><pre className="debug">{JSON.stringify({ representationState: state, compiledPrompt: compiled, provider: "mock", selectedExperimentIds: selected }, null, 2)}</pre></section>}
      </aside>
    </div>

    <section className="section border-t border-[#c9cbc3]"><div className="flex justify-between items-end gap-4 mb-4"><div><h2 className="section-title !mb-1">07 · Experiment results</h2><p className="text-xs text-[#6e716b]">Select any two cards for exact state and compiler-section diffs. Snapshots retain their source state.</p></div><div className="tiny">{experiments.length} IMMUTABLE GENERATION SNAPSHOT{experiments.length === 1 ? "" : "S"}</div></div>
      {!experiments.length && <div className="border border-dashed border-[#aeb0a8] p-10 text-center text-sm text-[#6e716b]">No results yet. The demo is ready—press “Generate / Save Baseline”.</div>}
      <div className="result-grid">{experiments.map((item) => <article className={`result-card ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}>
        <button className="w-full text-left" onClick={() => toggleSelected(item.id)}>{item.generatedImages.map((image) => <img key={image.id} src={image.url} alt={image.alt} />)}</button>
        <div className="result-body"><input className="field font-bold mb-2" value={item.name} onChange={(e) => patchExperiment(item.id, { name: e.target.value })} /><div className="tiny mb-2">{new Date(item.timestamp).toLocaleString()} · {item.provider} · {item.id.slice(0, 8)}</div><div>{item.changedVariables.length ? item.changedVariables.map((key) => <span className="badge changed" key={key}>CHANGED: {labels[key]}</span>) : <span className="badge">BASELINE</span>}</div>
          <div className="mt-2">{["detailDensity", "medium", "lighting"].map((key) => { const a = getAttribute(item.representationState, key as AttributeKey); return <span className="badge" key={key}>{labels[key as AttributeKey]} {key === "detailDensity" ? a.strength : a.value}</span> })}</div>
          <div className="flex gap-2 mt-3"><button className="toggle" onClick={() => duplicate(item)}>DUPLICATE</button><button className="toggle" onClick={() => setState(cloneState(item.representationState))}>LOAD STATE</button><button className="toggle text-red-800" onClick={() => { setExperiments((items) => items.filter((candidate) => candidate.id !== item.id)); setSelected((ids) => ids.filter((id) => id !== item.id)) }}>DELETE</button></div>
          <details className="mt-3"><summary className="tiny cursor-pointer font-bold">MANUAL EVALUATION</summary><div className="mt-2 grid grid-cols-3 gap-2">{(["targetFollowed", "preserved", "controllability"] as const).map((key) => <label className="tiny" key={key}>{key}<select className="field mt-1" value={item.evaluation[key]} onChange={(e) => patchExperiment(item.id, { evaluation: { ...item.evaluation, [key]: Number(e.target.value) } })}>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</select></label>)}</div><select className="field mt-2" value={item.evaluation.failureCause} onChange={(e) => patchExperiment(item.id, { evaluation: { ...item.evaluation, failureCause: e.target.value } })}>{failureCauses.map((cause) => <option value={cause} key={cause}>{cause || "Failure cause…"}</option>)}</select><textarea className="field mt-2" placeholder="Evaluation notes" value={item.evaluation.notes} onChange={(e) => patchExperiment(item.id, { evaluation: { ...item.evaluation, notes: e.target.value } })} /></details>
          {debug && <details className="mt-3"><summary className="tiny cursor-pointer font-bold">SNAPSHOT JSON</summary><pre className="debug mt-2">{JSON.stringify(item, null, 2)}</pre></details>}
        </div></article>)}</div>
    </section>

    {compared.length === 2 && <section className="section border-t border-[#c9cbc3] bg-[#e8e7e0]"><h2 className="section-title">08 · Comparison / diagnosis</h2><div className="compare"><div className="diff-box"><div className="tiny mb-2">STATE DIFFERENCE · {compared[0].name} → {compared[1].name}</div>{stateDiff.length ? stateDiff.map((item) => { const before = item.before as Attribute<string>; const after = item.after as Attribute<string>; return <div key={item.key} className="mb-3"><strong className="text-sm">{labels[item.key]}</strong><div className="text-xs mt-1"><code>{before.value}</code> / {before.strength} → <code>{after.value}</code> / {after.strength}</div></div> }) : <p className="text-sm">No representation variables changed.</p>}<div className="tiny mt-4">{stateDiff.length === 1 ? "Exactly one variable changed." : `${stateDiff.length} variables changed.`}</div></div>
        <div className="diff-box"><div className="tiny mb-2">PROMPT SECTION DIFFERENCE</div>{promptDiff.length ? promptDiff.map((item) => <div key={item.section} className="mb-4"><div className="badge changed">{item.section}</div><div className="text-xs line-through text-[#8a7770] mt-1">{item.before}</div><div className="text-xs text-[#315e52] mt-1">{item.after}</div></div>) : <p className="text-sm">Compiled prompts are identical.</p>}</div></div></section>}
  </main>;
}
