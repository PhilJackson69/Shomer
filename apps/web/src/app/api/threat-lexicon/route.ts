import { NextResponse } from "next/server";
import { loadLexiconYAML, saveLexicon } from "@/lib/threat-detection/lexicon.store";

export async function GET() {
  const yaml = await loadLexiconYAML();
  return NextResponse.json({ yaml });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const yamlText = String(body?.yaml ?? "");
  const parsed = await saveLexicon(yamlText);
  return NextResponse.json({ ok: true, lexicon: parsed });
}


