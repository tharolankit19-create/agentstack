import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser, isOnboarded } from "@/lib/auth";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, params] = await Promise.all([
    requireUser("/onboarding"),
    searchParams,
  ]);

  // Finished already — nobody should be able to land back here by accident.
  if (isOnboarded(session.profile)) redirect("/dashboard");

  const next =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";

  return (
    <main className="surface-dark grid min-h-dvh place-items-center px-5 py-12">
      <OnboardingFlow
        email={session.email}
        defaultName={session.profile.full_name ?? ""}
        next={next}
      />
    </main>
  );
}
