"use client";

import { useFormStatus } from "react-dom";

export function AdminSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-submit" disabled={pending} type="submit">
      {pending ? "Guardando…" : children}
    </button>
  );
}
