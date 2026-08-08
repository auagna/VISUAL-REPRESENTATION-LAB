import { ReferenceAnalysis, ReferenceAnalyzer } from "./referenceAnalyzer";

export const referencePresets: ReferenceAnalysis[] = [
  { preset: "Bare Paper Ink Line", attributes: [
    { key: "medium", label: "Medium", value: "black ink", strength: 90, transferable: true }, { key: "markMaking", label: "Mark Making", value: "sparse imperfect contour", strength: 85, transferable: true }, { key: "palette", label: "Palette", value: "monochrome", strength: 100, transferable: true }, { key: "detailDensity", label: "Detail Density", value: "very low", strength: 80, transferable: true }, { key: "texture", label: "Texture", value: "bare paper", strength: 75, transferable: true }, { key: "composition", label: "Composition", value: "centered architectural composition", strength: 40, transferable: false },
  ]},
  { preset: "Neon Fog Cinematic", attributes: [
    { key: "medium", label: "Medium", value: "photographic", strength: 80, transferable: true }, { key: "lighting", label: "Lighting", value: "neon low-key", strength: 90, transferable: true }, { key: "palette", label: "Palette", value: "cyan/orange", strength: 85, transferable: true }, { key: "atmosphere", label: "Atmosphere", value: "dense fog", strength: 90, transferable: true }, { key: "texture", label: "Texture", value: "film grain", strength: 55, transferable: true }, { key: "detailDensity", label: "Detail Density", value: "medium", strength: 55, transferable: true },
  ]},
  { preset: "Sun-Faded 90s Snapshot", attributes: [
    { key: "medium", label: "Medium", value: "consumer photography", strength: 75, transferable: true }, { key: "lighting", label: "Lighting", value: "hard direct flash", strength: 75, transferable: true }, { key: "palette", label: "Palette", value: "slightly faded warm color", strength: 65, transferable: true }, { key: "texture", label: "Texture", value: "analog grain", strength: 60, transferable: true }, { key: "atmosphere", label: "Atmosphere", value: "casual vernacular", strength: 60, transferable: true },
  ]},
  { preset: "Rough Crayon", attributes: [
    { key: "medium", label: "Medium", value: "crayon", strength: 90, transferable: true }, { key: "markMaking", label: "Mark Making", value: "rough naive strokes", strength: 90, transferable: true }, { key: "palette", label: "Palette", value: "limited", strength: 65, transferable: true }, { key: "detailDensity", label: "Detail Density", value: "low", strength: 70, transferable: true }, { key: "texture", label: "Texture", value: "paper grain", strength: 75, transferable: true },
  ]},
  { preset: "City Pop Neon Cel", attributes: [
    { key: "medium", label: "Medium", value: "cel illustration", strength: 90, transferable: true }, { key: "lighting", label: "Lighting", value: "neon", strength: 80, transferable: true }, { key: "palette", label: "Palette", value: "magenta / blue / red", strength: 90, transferable: true }, { key: "markMaking", label: "Mark Making", value: "clean graphic edges", strength: 85, transferable: true }, { key: "detailDensity", label: "Detail Density", value: "medium", strength: 55, transferable: true },
  ]},
];

export class MockReferenceAnalyzer implements ReferenceAnalyzer {
  async analyzeReference(input: { name: string }): Promise<ReferenceAnalysis> { return referencePresets.find((preset) => preset.preset === input.name) ?? referencePresets[0] }
}
