export type AttributeSource = "user" | "reference" | "system";

export type Attribute<T = string> = {
  value: T;
  enabled: boolean;
  locked: boolean;
  strength: number;
  source: AttributeSource;
};

export type RepresentationState = {
  content: { subject: Attribute<string> };
  structure: {
    composition: Attribute<string>;
    cameraAngle: Attribute<string>;
    lens: Attribute<string>;
  };
  appearance: {
    medium: Attribute<string>;
    palette: Attribute<string>;
    lighting: Attribute<string>;
    detailDensity: Attribute<string>;
    texture: Attribute<string>;
    atmosphere: Attribute<string>;
    markMaking: Attribute<string>;
  };
};

export type AttributeKey = keyof RepresentationState["content"] | keyof RepresentationState["structure"] | keyof RepresentationState["appearance"];

export const GROUPS: Record<"content" | "structure" | "appearance", readonly AttributeKey[]> = {
  content: ["subject"],
  structure: ["composition", "cameraAngle", "lens"],
  appearance: ["medium", "palette", "lighting", "detailDensity", "texture", "atmosphere", "markMaking"],
} as const;

export function cloneState(state: RepresentationState): RepresentationState {
  return JSON.parse(JSON.stringify(state));
}

export function getAttribute(state: RepresentationState, key: AttributeKey): Attribute<string> {
  for (const group of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
    if ((GROUPS[group] as readonly string[]).includes(key)) return (state[group] as Record<string, Attribute<string>>)[key];
  }
  throw new Error(`Unknown attribute: ${key}`);
}

export function setAttribute(state: RepresentationState, key: AttributeKey, patch: Partial<Attribute<string>>): RepresentationState {
  const next = cloneState(state);
  const current = getAttribute(next, key);
  Object.assign(current, patch);
  current.strength = Math.max(0, Math.min(100, current.strength));
  return next;
}
