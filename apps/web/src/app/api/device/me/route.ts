import { GET as desktopGet } from "@/app/api/desktop/me/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return desktopGet(request);
}
