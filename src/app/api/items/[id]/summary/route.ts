import { NextResponse } from "next/server";
import { generateSummaryForItem } from "@/lib/summary";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const summary = await generateSummaryForItem(id);
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "摘要生成失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
