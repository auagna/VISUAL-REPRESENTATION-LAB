import { AttributeKey } from "@/representation/schema";
export type AnalyzedAttribute = { key: AttributeKey; label: string; value: string; strength: number; transferable: boolean };
export type ReferenceAnalysis = { preset: string; attributes: AnalyzedAttribute[] };
export interface ReferenceAnalyzer { analyzeReference(input: { name: string; dataUrl?: string }): Promise<ReferenceAnalysis> }
