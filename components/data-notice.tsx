import { Database, PawPrint } from "lucide-react";

export function DataNotice({ configured, empty }: { configured: boolean; empty: boolean }) {
  if (configured && !empty) return null;

  return (
    <div className={configured ? "data-notice data-notice-empty" : "data-notice"}>
      {configured ? <PawPrint size={20} /> : <Database size={20} />}
      <div>
        <strong>{configured ? "La sección está lista" : "Modo demostración"}</strong>
        <span>
          {configured
            ? "Supabase está conectado, pero todavía no hay publicaciones visibles."
            : "Agregá las variables de Supabase para mostrar los datos reales de las vistas api_* aprobadas."}
        </span>
      </div>
    </div>
  );
}
