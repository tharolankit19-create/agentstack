import { FloatingHeader } from "@/components/landing/floating-header";

export function Header({ signedIn }: { signedIn: boolean }) {
  return <FloatingHeader signedIn={signedIn} />;
}
