export function strengthLanguage(strength: number): string {
  if (strength <= 20) return "subtle";
  if (strength <= 40) return "light";
  if (strength <= 60) return "clear";
  if (strength <= 80) return "strong";
  return "dominant";
}
