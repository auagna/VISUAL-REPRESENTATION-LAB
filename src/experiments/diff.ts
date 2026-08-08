import { CompiledPrompt } from "@/compiler/baseCompiler";
import { AttributeKey, GROUPS, RepresentationState, getAttribute } from "@/representation/schema";
export type StateDifference = { key: AttributeKey; before: unknown; after: unknown };
export function diffStates(before: RepresentationState, after: RepresentationState): StateDifference[] {
  return Object.values(GROUPS).flatMap((keys) => keys).flatMap((key) => { const a = getAttribute(before, key); const b = getAttribute(after, key); return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ key, before: a, after: b }] });
}
export function diffPrompts(before: CompiledPrompt, after: CompiledPrompt) {
  const ids = new Set([...before.sections.map((s) => s.id), ...after.sections.map((s) => s.id)]);
  return [...ids].flatMap((id) => { const a = before.sections.find((s) => s.id === id)?.text ?? ""; const b = after.sections.find((s) => s.id === id)?.text ?? ""; return a === b ? [] : [{ section: id, before: a, after: b }] });
}
