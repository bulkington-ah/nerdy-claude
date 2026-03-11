import { NextResponse } from "next/server";
import { createSessionHandler } from "./handler";

export async function POST(): Promise<NextResponse> {
  const result = await createSessionHandler();
  return NextResponse.json(result.body, { status: result.status });
}
