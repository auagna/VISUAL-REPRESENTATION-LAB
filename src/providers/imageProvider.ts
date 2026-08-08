import { RepresentationState } from "@/representation/schema";
export type GeneratedImage = { id: string; url: string; alt: string };
export type GenerationRequest = { state: RepresentationState; prompt: string; seed: string };
export interface ImageProvider { readonly name: string; generate(request: GenerationRequest): Promise<GeneratedImage[]> }
