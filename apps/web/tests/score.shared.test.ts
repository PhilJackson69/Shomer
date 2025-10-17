import { describe, it, expect } from "vitest";
import { scoreFromFeatures } from "@/lib/threat-detection/score.shared";

describe("scoreFromFeatures", () => {
  it("flags explicit + target + time as HIGH/CRITICAL", () => {
    const r = scoreFromFeatures({
      text: "x",
      explicitThreatHit: true,
      indicators: new Set(["target","time_hint"]),
    });
    expect(r.score).toBeGreaterThanOrEqual(3.5);
    expect(["HIGH","CRITICAL"]).toContain(r.severity);
  });

  it("weapons mention alone is above LOW", () => {
    const r = scoreFromFeatures({
      text: "x",
      explicitThreatHit: false,
      indicators: new Set(["weapon"]),
    });
    expect(r.severity === "LOW").toBe(false);
  });

  it("no signals stays LOW", () => {
    const r = scoreFromFeatures({
      text: "x",
      explicitThreatHit: false,
      indicators: new Set(),
    });
    expect(r.severity).toBe("LOW");
  });
});


