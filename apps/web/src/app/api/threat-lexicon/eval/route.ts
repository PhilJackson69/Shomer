import { NextResponse } from "next/server";
import { evaluateText } from "@/lib/threat-detection/eval";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") {
    return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ ok: false, error: "text too long" }, { status: 413 });
  }
  const result = await evaluateText(text);
  return NextResponse.json({ ok: true, result });
}


