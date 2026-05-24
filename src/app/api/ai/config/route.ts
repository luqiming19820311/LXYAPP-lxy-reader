import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/summary";

export async function GET() {
  return NextResponse.json(getAiConfig());
}
