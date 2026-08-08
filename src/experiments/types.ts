import { CompiledPrompt } from "@/compiler/baseCompiler";
import { GeneratedImage } from "@/providers/imageProvider";
import { AttributeKey, RepresentationState } from "@/representation/schema";
export type Evaluation = { targetFollowed: number; preserved: number; controllability: number; notes: string; failureCause: string };
export type ExperimentSnapshot = { id: string; name: string; timestamp: string; parentExperimentId: string | null; representationState: RepresentationState; compiledPrompt: CompiledPrompt; provider: string; changedVariables: AttributeKey[]; generatedImages: GeneratedImage[]; evaluation: Evaluation };
