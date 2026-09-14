import { redirect } from "next/navigation";

/**
 * Connectors are intentionally hidden for now.
 *
 * The platform still keeps its internal provider integrations, but founders
 * should not see a half-finished connector marketplace or be asked to paste
 * third-party keys. Re-enable a real connectors surface once each connection
 * is production-ready.
 */
export default function ConnectorsPage() {
  redirect("/dashboard");
}
