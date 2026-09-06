"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function RefreshWork() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
