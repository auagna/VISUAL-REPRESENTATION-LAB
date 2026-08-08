import { describe, expect, it } from "vitest";
import { compileRepresentation } from "@/compiler/genericCompiler";
import { diffStates } from "@/experiments/diff";
import { createOfatStates } from "@/experiments/ofat";
import { defaultRepresentation } from "@/representation/defaults";
import { mergeReferenceAttributes } from "@/representation/merge";
import { cloneState, getAttribute, setAttribute } from "@/representation/schema";

describe("research invariants", () => {
  it("same Representation State produces an identical compiled prompt", () => {
    const a = compileRepresentation(cloneState(defaultRepresentation));
    const b = compileRepresentation(cloneState(defaultRepresentation));
    expect(a).toEqual(b);
  });

  it("changing detailDensity does not alter unrelated state values", () => {
    const changed = setAttribute(defaultRepresentation, "detailDensity", { strength: 20 });
    expect(getAttribute(changed, "detailDensity").strength).toBe(20);
    for (const key of ["subject", "composition", "medium", "lighting", "palette"] as const) {
      expect(getAttribute(changed, key)).toEqual(getAttribute(defaultRepresentation, key));
    }
  });

  it("locked subject survives reference merge", () => {
    const locked = setAttribute(defaultRepresentation, "subject", { locked: true });
    const merged = mergeReferenceAttributes(locked, { subject: { value: "A parrot", strength: 100 } }, ["subject"]);
    expect(getAttribute(merged, "subject").value).toBe(getAttribute(defaultRepresentation, "subject").value);
  });

  it("disabled attributes are excluded from the compiled prompt", () => {
    const disabled = setAttribute(defaultRepresentation, "atmosphere", { enabled: false, value: "UNIQUE-FOG-TOKEN" });
    expect(compileRepresentation(disabled).prompt).not.toContain("UNIQUE-FOG-TOKEN");
    expect(compileRepresentation(disabled).sections.find((section) => section.id === "atmosphere")).toBeUndefined();
  });

  it("OFAT states differ only in the selected variable", () => {
    const variants = createOfatStates(defaultRepresentation, "detailDensity", [20, 40, 60, 80]);
    expect(variants.map((state) => getAttribute(state, "detailDensity").strength)).toEqual([20, 40, 60, 80]);
    for (const variant of variants) expect(diffStates(defaultRepresentation, variant).map((item) => item.key)).toEqual(["detailDensity"]);
  });

  it("experiment diff reports only changed variables", () => {
    const changed = setAttribute(defaultRepresentation, "lighting", { value: "golden hour", strength: 70 });
    expect(diffStates(defaultRepresentation, changed).map((item) => item.key)).toEqual(["lighting"]);
  });
});
