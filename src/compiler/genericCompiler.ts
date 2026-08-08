import { BasePromptCompiler, CompiledPrompt, CompilerSection } from "./baseCompiler";
import { strengthLanguage } from "./strength";
import { Attribute, AttributeKey, RepresentationState, getAttribute } from "@/representation/schema";

const phrase = (label: string, a: Attribute<string>) => `${label}: ${a.value} (${strengthLanguage(a.strength)} emphasis).`;

export class GenericPromptCompiler extends BasePromptCompiler {
  readonly provider = "generic";
  compile(state: RepresentationState): CompiledPrompt {
    const sections: CompilerSection[] = [];
    const add = (id: string, label: string, keys: AttributeKey[], format?: () => string) => {
      const enabled = keys.filter((key) => getAttribute(state, key).enabled && getAttribute(state, key).value.trim());
      if (!enabled.length) return;
      sections.push({ id, label, text: format ? format() : enabled.map((key) => phrase(key, getAttribute(state, key))).join(" "), attributes: enabled });
    };
    add("subject", "Subject", ["subject"], () => getAttribute(state, "subject").value.trim() + ".");
    add("structure", "Structure / camera", ["composition", "cameraAngle", "lens"]);
    add("representation", "Representation", ["medium", "palette", "detailDensity", "markMaking"]);
    add("lighting", "Lighting", ["lighting"]);
    add("surface", "Surface / material behavior", ["texture"]);
    add("atmosphere", "Atmosphere", ["atmosphere"]);
    const allKeys = Object.values({ content: ["subject"], structure: ["composition", "cameraAngle", "lens"], appearance: ["medium", "palette", "lighting", "detailDensity", "texture", "atmosphere", "markMaking"] }).flat() as AttributeKey[];
    const locked = allKeys.filter((key) => getAttribute(state, key).enabled && getAttribute(state, key).locked);
    if (locked.length) sections.push({ id: "preservation", label: "Preservation constraints", text: `Preserve exactly: ${locked.map((key) => `${key} (${getAttribute(state, key).value})`).join(", ")}.`, attributes: locked });
    sections.push({ id: "exclusions", label: "Exclusions", text: "Do not add visual concepts, subjects, materials, or aesthetic enhancements that are not specified above.", attributes: [] });
    return { prompt: sections.map((section) => `${section.label.toUpperCase()}\n${section.text}`).join("\n\n"), sections };
  }
}

export function compileRepresentation(state: RepresentationState, provider = "generic"): CompiledPrompt {
  if (provider !== "generic" && provider !== "mock") throw new Error(`Unsupported compiler provider: ${provider}`);
  return new GenericPromptCompiler().compile(state);
}
