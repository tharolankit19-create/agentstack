"use client";

import { FloatingHeader } from "./floating-header";

export function Header({ signedIn }: { signedIn: boolean }) {
  return <FloatingHeader signedIn={signedIn} />;
}
