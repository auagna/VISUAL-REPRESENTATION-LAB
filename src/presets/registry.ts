import type { DesignStylePreset, RepresentationPreset } from "./types";

export const representationPresets: RepresentationPreset[] = [
  {
    id: "photoreal_actual", name: "Photoreal Actual",
    description: "Real-world interior or architectural photography with believable material and lighting behavior.",
    compilerDirectives: ["Photoreal actual interior or architectural photography.", "Real-world material behavior.", "Natural spatial depth.", "Believable surface response.", "Physically plausible lighting and shadow relationships.", "Realistic architectural photography character.", "Preserve realistic scale and spatial proportion."],
    materialHints: ["natural material imperfections", "realistic reflections", "believable roughness", "non-uniform surface behavior"],
    exclusions: ["overly glossy CGI surfaces", "artificial rendering artifacts", "diagrammatic abstraction", "cartoon-like simplification", "excessive synthetic perfection"],
  },
  {
    id: "archviz_render", name: "Archviz Render",
    description: "Polished architectural visualization with controlled realism and refined presentation.",
    compilerDirectives: ["High-quality architectural visualization render.", "Refined archviz presentation.", "Controlled realism.", "Clean surface definition.", "Carefully balanced reflections.", "Crisp architectural edge clarity.", "Professionally composed interior visualization."],
    materialHints: ["refined material response", "clean texture mapping", "controlled reflections", "polished but believable surfaces"],
    exclusions: ["documentary photography imperfections", "rough conceptual sketch language", "low-detail massing abstraction"],
  },
  {
    id: "sketchup_like", name: "SketchUp-like",
    description: "Simple conceptual architectural representation emphasizing geometry and spatial legibility.",
    compilerDirectives: ["SketchUp-like conceptual architectural representation.", "Simple planar surfaces.", "Clear geometric edges.", "Simplified materials.", "Strong spatial legibility.", "Lightweight architectural visualization.", "Reduced photographic complexity."],
    materialHints: ["flat or lightly textured materials", "simplified shading", "clean surfaces"],
    exclusions: ["highly photoreal rendering", "cinematic atmosphere", "complex natural imperfections", "excessive material richness"],
  },
  {
    id: "massing_white_model", name: "Massing / White Model",
    description: "Architectural massing representation focused on proportion, volume and primary geometry.",
    compilerDirectives: ["Architectural massing study.", "Abstract white model representation.", "Focus on primary volume and proportion.", "Strong geometric readability.", "Minimal surface detail.", "Reduced material differentiation.", "Diagrammatic spatial clarity."],
    materialHints: ["matte white model material", "neutral gray shadow behavior", "paper model or foam model character"],
    exclusions: ["decorative detail", "realistic furniture styling", "rich textures", "visual clutter", "strong atmospheric storytelling"],
  },
];

export const designStylePresets: DesignStylePreset[] = [
  {
    id: "modernism", name: "Modernism", description: "Functional, rational and restrained modernist spatial language.",
    compilerDirectives: ["Modernist architectural language.", "Functional clarity.", "Rational composition.", "Clean orthogonal geometry.", "Minimal ornamentation.", "Calm spatial order.", "Strong relationship between function and form.", "Visual restraint."],
    materialHints: ["exposed concrete", "painted plaster", "steel", "glass", "restrained timber accents"], formHints: ["orthogonal geometry", "clean planar composition", "horizontal and vertical order"], exclusions: ["ornamental excess", "playful historical quotation", "decorative complexity", "unnecessary sculptural gestures"],
  },
  {
    id: "postmodernism", name: "Postmodernism", description: "Playful, symbolic and historically referential architectural expression.",
    compilerDirectives: ["Postmodern architectural language.", "Playful formal composition.", "Historical quotation.", "Graphic geometry.", "Expressive forms.", "Layered symbolism.", "Decorative emphasis.", "Intentional visual contrast and irony."],
    materialHints: ["colored laminate", "painted stucco", "patterned surfaces", "decorative stone", "expressive metal details"], formHints: ["exaggerated geometry", "symbolic shapes", "contrasting formal elements"], exclusions: ["strict functionalist austerity", "total minimalism", "purely neutral expression"],
  },
  {
    id: "art_deco", name: "Art Deco", description: "Elegant, geometric and luxurious decorative architectural language.",
    compilerDirectives: ["Art Deco architectural expression.", "Strong symmetry.", "Vertical emphasis.", "Stepped geometry.", "Refined ornamental rhythm.", "Luxurious but controlled detailing.", "Rich material contrast.", "Elegant geometric decoration."],
    materialHints: ["brass", "dark timber", "marble", "polished stone", "lacquer", "patterned metal"], formHints: ["stepped forms", "symmetry", "geometric ornament", "vertical rhythm"], exclusions: ["rustic informality", "raw brutal materiality", "soft amorphous organic expression"],
  },
  {
    id: "art_nouveau", name: "Art Nouveau", description: "Fluid, botanical and handcrafted architectural language.",
    compilerDirectives: ["Art Nouveau design language.", "Flowing organic curves.", "Botanical ornamental logic.", "Graceful line movement.", "Integrated decorative structure.", "Handcrafted detailing.", "Sensuous fluid spatial character."],
    materialHints: ["curved wood", "decorative glass", "patterned ironwork", "ceramic ornament", "natural motifs"], formHints: ["flowing curves", "asymmetrical organic line work", "botanical geometry"], exclusions: ["rigid orthogonal austerity", "heavy industrial bluntness", "total geometric reduction"],
  },
  {
    id: "brutalism", name: "Brutalism", description: "Monolithic, raw and structurally direct architectural expression.",
    compilerDirectives: ["Brutalist architectural expression.", "Powerful mass.", "Direct structural presence.", "Exposed concrete.", "Raw material honesty.", "Monolithic geometry.", "Strong shadow definition.", "Minimal decorative treatment.", "Weighty spatial character."],
    materialHints: ["board-formed concrete", "raw plaster", "dark steel", "rough stone", "heavy timber"], formHints: ["massive geometry", "structural repetition", "deep openings", "heavy planar expression"], exclusions: ["decorative softness", "polished luxury styling", "playful postmodern color logic", "excessive ornament"],
  },
  {
    id: "organic", name: "Organic", description: "Fluid, nature-associated and tactile spatial language.",
    compilerDirectives: ["Organic architectural language.", "Soft flowing geometry.", "Natural spatial continuity.", "Curvilinear transitions.", "Non-rigid form.", "Tactile material presence.", "Nature-associated expression.", "Spatial rhythm inspired by biological growth, erosion or natural formation."],
    materialHints: ["timber", "natural stone", "clay-like finishes", "tactile plaster", "textured organic surfaces"], formHints: ["curved transitions", "irregular geometry", "softened corners", "flowing spatial sequence"], exclusions: ["strict orthogonal repetition", "overly mechanical expression", "rigid diagrammatic symmetry"],
  },
];

export const representationPresetById = Object.fromEntries(representationPresets.map((preset) => [preset.id, preset]));
export const designStylePresetById = Object.fromEntries(designStylePresets.map((preset) => [preset.id, preset]));
