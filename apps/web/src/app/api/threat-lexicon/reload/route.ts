import { NextResponse } from "next/server";
import { publishLexiconReload } from "@/lib/threat-detection/lexicon.reload";

export async function POST() {
  await publishLexiconReload();
  return NextResponse.json({ ok: true, reloaded: true });
}


