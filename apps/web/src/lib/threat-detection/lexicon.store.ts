import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { LexiconSchema, type Lexicon } from "./lexicon.schema";

const LEXICON_PATH = path.join(process.cwd(), "apps/web/config/lexicon.yml");

export async function loadLexicon(): Promise<Lexicon> {
  const raw = await fs.readFile(LEXICON_PATH, "utf8").catch(() => "");
  const data = raw ? YAML.parse(raw) : {};
  return LexiconSchema.parse(data);
}

export async function saveLexicon(yamlText: string): Promise<Lexicon> {
  let data: unknown;
  try {
    data = YAML.parse(yamlText || "");
  } catch (e: any) {
    throw new Error(`YAML parse error: ${e?.message || e}`);
  }
  const parsed = LexiconSchema.parse(data);
  const normalized = YAML.stringify(parsed);
  await fs.writeFile(LEXICON_PATH, normalized, "utf8");
  return parsed;
}

export async function loadLexiconYAML(): Promise<string> {
  const lex = await loadLexicon();
  return YAML.stringify(lex);
}


