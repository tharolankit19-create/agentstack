import { POST as desktopPost } from "@/app/api/desktop/session/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return desktopPost(request);
}
