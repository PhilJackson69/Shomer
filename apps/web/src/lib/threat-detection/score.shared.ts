export type ScoreInputs = {
  text: string;
  indicators: Set<string>; // e.g., "weapon","target","time_hint","planning","location_hint"
  explicitThreatHit: boolean;
};

export type ScoreResult = {
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rationale: string;
};

const WEIGHTS = Object.freeze({
  explicitThreat: 2.0,
  weapon: 1.8,
  targetPlace: 1.5,
  timeHint: 1.2,
  planning: 0.8,
  locationHint: 0.6,
});

export function scoreFromFeatures({ indicators, explicitThreatHit }: ScoreInputs): ScoreResult {
  let score = 0;
  if (explicitThreatHit) score += WEIGHTS.explicitThreat;
  if (indicators.has("weapon")) score += WEIGHTS.weapon;
  if (indicators.has("target")) score += WEIGHTS.targetPlace;
  if (indicators.has("time_hint")) score += WEIGHTS.timeHint;
  if (indicators.has("planning")) score += WEIGHTS.planning;
  if (indicators.has("location_hint")) score += WEIGHTS.locationHint;

  let severity: ScoreResult["severity"] = "LOW";
  if (score >= 5) severity = "CRITICAL";
  else if (score >= 3.5) severity = "HIGH";
  else if (score >= 2) severity = "MEDIUM";

  const rationale =
    `explicit:${Number(explicitThreatHit)} ` +
    `weapon:${Number(indicators.has("weapon"))} ` +
    `target:${Number(indicators.has("target"))} ` +
    `time:${Number(indicators.has("time_hint"))} ` +
    `planning:${Number(indicators.has("planning"))} ` +
    `location:${Number(indicators.has("location_hint"))}`;

  return { score, severity, rationale };
}


