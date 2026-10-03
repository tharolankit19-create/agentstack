"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export const operatorLinks = [
  ["Home", "/dashboard"],
  ["Tasks", "/dashboard/tasks"],
  ["Routines", "/dashboard/routines"],
  ["Skills", "/dashboard/skills"],
  ["Memory", "/dashboard/memory"],
  ["Artifacts", "/dashboard/artifacts"],
  ["Integrations", "/dashboard/connectors"],
  ["Activity", "/dashboard/activity"],
  ["Computer", "/dashboard/computer"],
  ["Settings", "/dashboard/settings"],
];
export function OperatorNav() {
  const pathname = usePathname();
  return (
    <nav className="op-navigation" aria-label="Kryx workspace">
      {operatorLinks.map(([name, path]) => (
        <Link
          key={path}
          href={path}
          aria-current={
            (
              path === "/dashboard"
                ? pathname === path
                : pathname.startsWith(path)
            )
              ? "page"
              : undefined
          }
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}
