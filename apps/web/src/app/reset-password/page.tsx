import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "@/components/ui/logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="kryx-auth-bg relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10 text-fg">
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-7 block w-fit" aria-label="KryxAI">
          <LogoLockup />
        </Link>
        <div className="kryx-auth-card p-6 sm:p-8">
          <p className="microlabel text-center">Secure account recovery</p>
          <h1 className="mt-3 text-center text-3xl font-extrabold tracking-[-.035em] text-fg-strong">
            Choose a new password
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-muted">
            Use 12+ characters with uppercase, lowercase, a number and a symbol.
          </p>
          <div className="mt-6">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
