import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceHybridMissions } from "@/lib/hybrid-missions";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await advanceHybridMissions(admin, 12);
  return NextResponse.json(result);
}
