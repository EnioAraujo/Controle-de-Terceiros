import { Registro } from "@/types/attendance";
import { fmt, buildWhatsAppMessage } from "@/lib/format-utils";
import type { WhatsAppTemplate } from "@/lib/format-utils";
import { Modal, Btn } from "@/components/atoms";
import { tk } from "@/lib/design-tokens";

interface Props {
  detalhe: Registro | Registro[];
  waTemplate: WhatsAppTemplate;
  lang: string;
  onClose: () => void;
  onEdit: () => void;
  t: (key: string) => string;
}

const fieldCard = (k: string, v: string) => (
  <div key={k} style={{ background: tk.surfaceLight, borderRadius: 8, padding: "10px 14px" }}>
    <div style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .7, marginBottom: 4 }}>{k}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: tk.textPrimary }}>{v || "—"}</div>
  </div>
);

export function LancamentosDetailModal({ detalhe, waTemplate, lang, onClose, onEdit, t }: Props) {
  const isLote = Array.isArray(detalhe);
  const title = isLote
    ? `${t("lanc_detail_lote")} — ${detalhe.length} ${detalhe.length !== 1 ? t("form_persons") : t("form_person")}`
    : t("lanc_detail_title");
  const subtitle = isLote ? `${fmt(detalhe[0].data, lang)} · ${detalhe[0].turno}` : detalhe.nome;

  const openWhatsApp = () => {
    const regs = isLote ? detalhe : [detalhe];
    const msg = buildWhatsAppMessage(regs, waTemplate);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide={!isLote} xl={isLote}>
      {isLote ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="rsp-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              [t("detail_data"), fmt(detalhe[0].data, lang)], [t("detail_turno"), detalhe[0].turno],
              [t("detail_cargo"), detalhe[0].cargo], [t("detail_forn"), detalhe[0].fornecedor],
              [t("detail_unidade"), detalhe[0].unidade],
              [t("detail_cc"), detalhe[0].cc], [t("detail_motivo"), detalhe[0].motivo],
            ] as [string, string][]).map(([k, v]) => fieldCard(k, v))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: tk.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{t("lanc_detail_cols")} ({detalhe.length})</div>
            <div style={{ border: `1px solid ${tk.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 380 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 96px 96px 72px", background: tk.surfaceLight, padding: "8px 14px", gap: 8, borderBottom: `1px solid ${tk.border}` }}>
                    {[t("detail_col_nome"), t("detail_col_entrada"), t("detail_col_saida"), t("detail_col_total")].map(h =>
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: tk.textSecondary, textTransform: "uppercase" }}>{h}</div>
                    )}
                  </div>
                  {detalhe.map((rec, idx) => (
                    <div key={rec.id} style={{ display: "grid", gridTemplateColumns: "1fr 96px 96px 72px", gap: 8, padding: "8px 14px", background: idx % 2 === 0 ? tk.white : tk.surfaceNearly, borderTop: idx > 0 ? `1px solid ${tk.surfaceAlt}` : "none" }}>
                      <span style={{ fontWeight: 600, color: tk.textPrimary, fontSize: 12 }}>{rec.nome}</span>
                      <span style={{ fontFamily: "monospace", color: tk.textBody, fontSize: 12 }}>{rec.horaEntrada}</span>
                      <span style={{ fontFamily: "monospace", color: tk.textBody, fontSize: 12 }}>{rec.horaSaida}</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: tk.green, fontSize: 12 }}>{rec.totalHoras}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {detalhe[0].obs && (
            <div style={{ background: tk.amberBg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .7, marginBottom: 4 }}>{t("lanc_detail_obs")}</div>
              <div style={{ fontSize: 13, color: tk.textPrimary }}>{detalhe[0].obs}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="rsp-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {([
            [t("detail_nome"), detalhe.nome], [t("detail_cargo"), detalhe.cargo], [t("detail_forn"), detalhe.fornecedor],
            [t("detail_data"), fmt(detalhe.data, lang)], [t("detail_turno"), detalhe.turno],
            [t("detail_unidade"), detalhe.unidade], [t("detail_cc"), detalhe.cc],
            [t("detail_entrada"), detalhe.horaEntrada], [t("detail_saida"), detalhe.horaSaida],
            [t("detail_total_horas"), detalhe.totalHoras], [t("detail_motivo"), detalhe.motivo],
          ] as [string, string][]).map(([k, v]) => fieldCard(k, v))}
          {detalhe.obs && (
            <div style={{ gridColumn: "span 2", background: tk.amberBg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .7, marginBottom: 4 }}>{t("lanc_detail_obs")}</div>
              <div style={{ fontSize: 13, color: tk.textPrimary }}>{detalhe.obs}</div>
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${tk.surfaceAlt}` }}>
        <Btn variant="ghost" onClick={onClose}>{t("lanc_detail_close")}</Btn>
        <button
          onClick={openWhatsApp}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tk.whatsapp, border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", color: tk.white, fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill={tk.white}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </button>
        <Btn onClick={onEdit}>{t("lanc_detail_edit")}</Btn>
      </div>
    </Modal>
  );
}
