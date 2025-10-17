import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = path.join(process.cwd(), "openapi.yaml");
  const yml = await fs.readFile(p, "utf8");
  const doc = yaml.parse(yml);
  return NextResponse.json(doc);
}


