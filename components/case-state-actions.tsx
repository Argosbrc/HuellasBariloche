"use client";

import { Archive, CheckCircle2, HeartHandshake, Home, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { changePetCaseState } from "@/app/panel/casos/actions";

function confirmation(state: string) {
  if (state === "adopted") return "¿Confirmás que la adopción ya se concretó? La mascota dejará de aparecer como disponible.";
  if (state === "reunited") return "¿Confirmás que el animal ya está nuevamente con su familia? El caso dejará de aparecer en el mapa.";
  if (state === "closed") return "¿Querés cerrar este caso sin marcar una resolución? Dejará de aparecer en los listados activos.";
  return "¿Querés archivar este caso? Conservará el historial, pero quedará fuera de los listados activos.";
}

function StateForm({
  className,
  icon,
  label,
  postId,
  reason,
  state,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  postId: string;
  reason: string;
  state: string;
}) {
  return <form action={changePetCaseState} onSubmit={(event) => { if (!window.confirm(confirmation(state))) event.preventDefault(); }}><input name="pet_post_id" type="hidden" value={postId} /><input name="state" type="hidden" value={state} /><input name="reason" type="hidden" value={reason} /><button className={className} type="submit">{icon}{label}</button></form>;
}

export function CaseStateActions({ postId, postType, postState }: { postId: string; postType: string; postState: string }) {
  const [reason, setReason] = useState("");
  const active = ["lost", "sighted", "found", "available"].includes(postState);
  const archived = postState === "archived";
  const primaryState = postType === "adoption" ? "adopted" : "reunited";
  const primaryLabel = postType === "adoption"
    ? "Confirmar adopción concretada"
    : postType === "found"
      ? "Confirmar entrega a su familia"
      : "Confirmar que volvió a casa";

  if (archived) return <div className="case-state-finished"><Archive /><div><strong>Caso archivado</strong><span>Su historial permanece disponible y no se muestra públicamente.</span></div></div>;

  return <div className="case-state-actions">
    <label>Nota interna sobre el cierre <small>opcional</small><textarea maxLength={500} minLength={3} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: volvió a casa el 10 de agosto, se coordinó con la familia…" rows={3} value={reason} /></label>
    <div>
      {active && <StateForm className="button button-primary" icon={postType === "adoption" ? <HeartHandshake /> : <Home />} label={primaryLabel} postId={postId} reason={reason} state={primaryState} />}
      {active && <StateForm className="button button-light" icon={<LockKeyhole />} label="Cerrar sin resolución" postId={postId} reason={reason} state="closed" />}
      <StateForm className="button button-ghost" icon={active ? <Archive /> : <CheckCircle2 />} label={active ? "Archivar directamente" : "Archivar caso"} postId={postId} reason={reason} state="archived" />
    </div>
  </div>;
}
