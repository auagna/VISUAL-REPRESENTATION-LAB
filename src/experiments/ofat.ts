import { AttributeKey, RepresentationState, setAttribute } from "@/representation/schema";
export function createOfatStates(state: RepresentationState, variable: AttributeKey, strengths: number[]): RepresentationState[] { return strengths.map((strength) => setAttribute(state, variable, { strength })) }
