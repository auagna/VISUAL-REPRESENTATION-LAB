import type { RepresentationState } from "@/representation/schema";

export abstract class BaseImageCompiler {
  abstract readonly providerId: string;
  compile(baseInstruction: string, _state: RepresentationState) { return baseInstruction; }
}
