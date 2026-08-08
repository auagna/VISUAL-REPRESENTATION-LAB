import { AttributeKey, RepresentationState, getAttribute, setAttribute } from "./schema";

export function mergeReferenceAttributes(state: RepresentationState, attributes: Partial<Record<AttributeKey, { value: string; strength: number }>>, selected: AttributeKey[]): RepresentationState {
  return selected.reduce((next, key) => {
    const incoming = attributes[key];
    if (!incoming || getAttribute(next, key).locked) return next;
    return setAttribute(next, key, { ...incoming, enabled: true, source: "reference" });
  }, state);
}
