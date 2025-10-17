import franc from "franc";
import nlp from "compromise";
import { loadLexicon } from "./lexicon.store";
import { scoreFromFeatures } from "./score.shared";

export type EvalResult = {
  lang: string | null;
  entities: { persons: string[]; orgs: string[]; locations: string[]; dates: string[] };
  indicators: string[];
  excluded: string | null;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rationale: string;
};

const WEIGHTS = {
  explicitThreat: 2.0,
  weapon: 1.8,
  targetPlace: 1.5,
  timeHint: 1.2,
  planning: 0.8,
  locationHint: 0.6,
};

export async function evaluateText(textRaw: string): Promise<EvalResult> {
  const text = (textRaw || "").slice(0, 8000);
  const lex = await loadLexicon();

  for (const ex of lex.exclusions) {
    if (ex && text.toLowerCase().includes(ex.toLowerCase())) {
      return {
        lang: null,
        entities: { persons: [], orgs: [], locations: [], dates: [] },
        indicators: [],
        excluded: ex,
        score: 0,
        severity: "LOW",
        rationale: `excluded:${ex}`,
      };
    }
  }

  const lang = franc(text) || null;
  const doc = nlp(text);
  const entities = {
    persons: doc.people().out("array"),
    orgs: doc.organizations().out("array"),
    locations: doc.places().out("array"),
    dates: doc.dates().out("array"),
  };

  const ind: Set<string> = new Set();
  const lc = text.toLowerCase();
  const touch = (list: string[], label: string) => {
    for (const t of list) if (t && lc.includes(t.toLowerCase())) { ind.add(label); break; }
  };

  const explicit = /(kill|attack|burn|bomb|shoot|stab|vandalize|assault)/i.test(text) ? 1 : 0;
  touch(lex.weapons, "weapon");
  touch(lex.targets, "target");
  touch(lex.time_hints, "time_hint");
  touch(lex.planning, "planning");
  touch(lex.location_hints, "location_hint");

  const { score, severity, rationale } = scoreFromFeatures({
    text,
    indicators: ind,
    explicitThreatHit: Boolean(explicit),
  });

  return {
    lang,
    entities,
    indicators: Array.from(ind),
    excluded: null,
    score,
    severity,
    rationale,
  };
}


