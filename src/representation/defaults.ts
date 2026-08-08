import { Attribute, RepresentationState } from "./schema";

const attr = (value: string, strength = 60, source: Attribute["source"] = "system"): Attribute<string> => ({ value, enabled: true, locked: false, strength, source });

export const defaultRepresentation: RepresentationState = {
  content: { subject: attr("Minimal exposed-concrete house surrounded by pine trees", 100, "user") },
  structure: {
    composition: attr("centered architectural composition", 55),
    cameraAngle: attr("eye-level three-quarter view", 55),
    lens: attr("35mm", 50),
  },
  appearance: {
    medium: attr("black ink", 90, "reference"),
    palette: attr("monochrome", 100, "reference"),
    lighting: attr("overcast daylight", 45),
    detailDensity: attr("very low", 80, "reference"),
    texture: attr("bare paper", 70),
    atmosphere: attr("minimal", 55),
    markMaking: attr("sparse imperfect contour", 85, "reference"),
  },
};

export const options: Partial<Record<string, string[]>> = {
  composition: ["centered architectural composition", "asymmetrical composition", "wide contextual view", "tight facade crop"],
  cameraAngle: ["eye-level three-quarter view", "low angle", "elevated view", "straight-on elevation"],
  lens: ["24mm", "35mm", "50mm", "85mm", "135mm"],
  medium: ["photographic", "black ink", "crayon", "watercolor", "physical scale model", "clay model"],
  palette: ["neutral", "warm", "cool", "monochrome", "cyan/orange", "pastel", "high saturation"],
  lighting: ["overcast daylight", "golden hour", "blue hour", "hard direct flash", "neon night", "diffused studio light"],
  detailDensity: ["very low", "low", "medium", "high", "very high"],
  texture: ["bare paper", "film grain", "paper grain", "smooth concrete", "rough concrete"],
  atmosphere: ["minimal", "dense fog", "casual vernacular", "quiet", "dramatic"],
  markMaking: ["sparse imperfect contour", "rough naive strokes", "clean graphic edges", "precise technical lines"],
};
