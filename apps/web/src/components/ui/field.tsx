import * as React from "react";
import { cn } from "@/lib/utils";

/** Form primitives, dark-surface first — they only appear in the dashboard. */

const control =
  "w-full rounded-lg border border-[var(--color-surface-line)] bg-[#0f0f0f] px-3.5 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(control, "min-h-24 resize-y leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(control, "cursor-pointer appearance-none pr-9", className)}
      {...props}
    />
  );
});

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("block text-sm font-semibold text-zinc-200", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-[var(--color-accent)]">*</span> : null}
    </label>
  );
}

export function Help({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs leading-relaxed text-zinc-500">{children}</p>;
}

export function Field({
  label,
  help,
  required,
  htmlFor,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      <Help>{help}</Help>
    </div>
  );
}
