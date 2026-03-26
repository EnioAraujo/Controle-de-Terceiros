import DOMPurify from "dompurify";
import { supabase, authReady } from "@/lib/supabase";

export const uuid = () => crypto.randomUUID();

export const sanitize = (v: string) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] });

export const logAudit = (
  operacao: "INSERT" | "UPDATE" | "DELETE" | "PURGE" | "EXCLUSAO_TITULAR",
  tabela: string,
  registroId?: string,
  dados?: unknown
) => {
  authReady.then(() =>
    supabase.from("audit_log").insert({
      operacao,
      tabela,
      registro_id: registroId ?? null,
      dados: dados ? dados : null,
    }).then(({ error }) => {
      if (error) console.warn("audit_log:", error.message);
    })
  ).catch((err: unknown) => console.warn("audit_log (authReady):", err));
};
