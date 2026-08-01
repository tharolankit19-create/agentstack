import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent)]">
          404
        </p>
        <h1 className="mt-3 text-4xl font-extrabold">Nothing here.</h1>
        <p className="mt-3 text-[17px] text-[var(--color-ink-soft)]">
          That page does not exist, or it is not yours.
        </p>
        <Link href="/" className="mt-8 inline-block">
          <Button size="md">Back to the homepage</Button>
        </Link>
      </div>
    </main>
  );
}
