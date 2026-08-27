"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { recordCommunityShare } from "@/app/comunidad/actions";

export function CommunityShareButton({ postId, text, canRecord, shareCount }: { postId: string; text: string; canRecord: boolean; shareCount: number }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Comunidad Huellas", text, url });
        if (canRecord) void recordCommunityShare(postId);
      } catch {
        // Cancelar la hoja nativa no debe registrar ni mostrar un error.
      }
      return;
    }
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      if (canRecord) void recordCommunityShare(postId);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <button className="community-detail-action" onClick={share} type="button">{copied ? <Check /> : <Share2 />}{copied ? "Enlace copiado" : `Compartir · ${shareCount}`}</button>;
}
