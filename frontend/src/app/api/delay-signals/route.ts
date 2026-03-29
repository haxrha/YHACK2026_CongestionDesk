import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import type { DelaySignalDay } from "@/lib/delaySignalsTypes";
import { baselineCo2KgFor2024 } from "@/lib/carbonModel";

export const dynamic = "force-dynamic";

async function readDelaySignalsFile(): Promise<string | null> {
  const backend = join(process.cwd(), "..", "Backend", "delay_signals.json");
  try {
    return await readFile(backend, "utf-8");
  } catch {
    try {
      return await readFile(
        join(process.cwd(), "public", "data", "delay_signals.json"),
        "utf-8"
      );
    } catch {
      return null;
    }
  }
}

export async function GET() {
  const raw = await readDelaySignalsFile();
  if (!raw?.trim()) {
    return NextResponse.json(
      { error: "delay_signals.json not found", days: [] as DelaySignalDay[] },
      { status: 404 }
    );
  }
  let days: DelaySignalDay[];
  try {
    days = JSON.parse(raw) as DelaySignalDay[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 500 });
  }
  const baselineCo2Kg = baselineCo2KgFor2024(days);
  return NextResponse.json({ days, baselineCo2Kg, source: "delay_signals.json" });
}
