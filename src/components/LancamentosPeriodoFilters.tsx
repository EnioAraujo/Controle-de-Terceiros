import { useMemo } from "react";
import { useI18n } from "@/hooks/use-i18n";
import type { LancamentosPeriodoFiltroState } from "@/lib/lancamentos-filtros-utils";

interface LancamentosPeriodoFiltersProps {
  filtroPeriodo: LancamentosPeriodoFiltroState;
  onChange: (next: LancamentosPeriodoFiltroState) => void;
}

export const LancamentosPeriodoFilters = ({ filtroPeriodo, onChange }: LancamentosPeriodoFiltersProps) => {
  const { t } = useI18n();

  const periodoBtns = useMemo(
    () => [
      { label: t("lanc_filter_periodo_1"), idx: 0 },
      { label: t("lanc_filter_periodo_2"), idx: 1 },
      { label: t("lanc_filter_periodo_3"), idx: 2 },
      { label: t("lanc_filter_periodo_custom"), idx: 3 },
    ],
    [t],
  );

  return (
    <>
      <div>
        <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("lanc_filter_mes")}</label>
        <input
          type="month"
          value={filtroPeriodo.mes}
          onChange={e => onChange({ ...filtroPeriodo, mes: e.target.value })}
          style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", width: 150 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("lanc_filter_periodo")}</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {periodoBtns.map(pb => (
            <button
              key={pb.idx}
              onClick={() => onChange({ ...filtroPeriodo, periodoIdx: pb.idx })}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "1.5px solid",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                background: filtroPeriodo.periodoIdx === pb.idx ? "#1A56DB" : "#fff",
                color: filtroPeriodo.periodoIdx === pb.idx ? "#fff" : "#64748B",
                borderColor: filtroPeriodo.periodoIdx === pb.idx ? "#1A56DB" : "#E2E6EC",
              }}
              type="button"
            >
              {pb.label}
            </button>
          ))}
        </div>
      </div>
      {filtroPeriodo.periodoIdx === 3 && (
        <>
          <div>
            <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("lanc_filter_data_inicio")}</label>
            <input
              type="date"
              value={filtroPeriodo.customInicio}
              onChange={e => onChange({ ...filtroPeriodo, customInicio: e.target.value })}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", width: 150 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("lanc_filter_data_fim")}</label>
            <input
              type="date"
              value={filtroPeriodo.customFim}
              onChange={e => onChange({ ...filtroPeriodo, customFim: e.target.value })}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", width: 150 }}
            />
          </div>
        </>
      )}
    </>
  );
};
