import { ExperimentSnapshot } from "./types";
const STORAGE_KEY = "vrl-experiments-v0.1";
export function loadExperiments(): ExperimentSnapshot[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] } }
export function saveExperiments(items: ExperimentSnapshot[]) { if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }
