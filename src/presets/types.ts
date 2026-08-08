export type RepresentationPreset = {
  id: string;
  name: string;
  description: string;
  compilerDirectives: string[];
  cameraHints?: string[];
  lightingHints?: string[];
  materialHints?: string[];
  exclusions?: string[];
};

export type DesignStylePreset = {
  id: string;
  name: string;
  description: string;
  compilerDirectives: string[];
  materialHints?: string[];
  formHints?: string[];
  exclusions?: string[];
};

export type OutputPresetSelection = {
  representationPresetId: string;
  designStylePresetId: string;
  representationStrength: number;
  designStyleStrength: number;
  userExclusions: string[];
};
