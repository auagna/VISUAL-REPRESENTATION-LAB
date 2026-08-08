import { AttributeKey, RepresentationState } from "@/representation/schema";

export type CompilerSection = { id: string; label: string; text: string; attributes: AttributeKey[] };
export type CompiledPrompt = { prompt: string; sections: CompilerSection[] };

export abstract class BasePromptCompiler {
  abstract readonly provider: string;
  abstract compile(state: RepresentationState): CompiledPrompt;
}
