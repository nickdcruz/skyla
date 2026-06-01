// v1.0
import { NextRequest, NextResponse } from "next/server";
import { searchAirports } from "@/lib/airports";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = searchAirports(q, 10);
  return NextResponse.json({ airports: results });
}
