"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return <button className="button button-light" type="button" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/"); }}><LogOut size={16} />Cerrar sesión</button>;
}
