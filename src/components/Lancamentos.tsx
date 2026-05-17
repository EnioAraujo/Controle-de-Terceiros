import { useState } from "react";
import { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import type { WhatsAppTemplate } from "@/lib/format-utils";
import type { TurnoConfig, TurnoCapacidade } from "@/lib/fechamento-utils";
import { useI18n } from "@/hooks/use-i18n";
import { useLancamentos } from "@/hooks/useLancamentos";
import { Icon, Btn, Modal, Input, Select, BlockHeader } from "@/components/atoms";
import { FormLancamento } from "@/components/FormLancamento";
import { ImportRegistrosCsvModal } from "@/components/ImportRegistrosCsvModal";
import { LancamentosPeriodoFilters } from "@/components/LancamentosPeriodoFilters";
import { LancamentosTable } from "@/components/lancamentos/LancamentosTable";
import { LancamentosDetailModal } from "@/components/lancamentos/LancamentosDetailModal";
import { LancamentosConflictModal } from "@/components/lancamentos/LancamentosConflictModal";
import { tk } from "@/lib/design-tokens";
import { csvSafe } from "@/lib/csv-export";

interface LancamentosProps {
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  opcoes: Opcoes;
  hierarquia: import("@/types/hierarquia").Hierarquia;
  turnosConfig: TurnoConfig[];
  capacidadeConfig: TurnoCapacidade[];
  isAdmin: boolean;
  waTemplate: WhatsAppTemplate;
  syncError?: string | null;
}

export const Lancamentos = ({ registros, setRegistros, opcoes, hierarquia, turnosConfig, capacidadeConfig, isAdmin, waTemplate, syncError }: LancamentosProps) => {
  const { t } = useI18n();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const {
    filtros, setFiltros, setFiltro,
    filtroPeriodo, setFiltroPeriodo,
    modal, setModal,
    selectedIds, setSelectedIds,
    confirm, setConfirm,
    detalhe, setDetalhe,
    conflito, setConflito,
    importFeedback, setImportFeedback,
    excedenteMap,
    filtered,
    importadosOcultos,
    grupos,
    salvar,
    excluir,
  } = useLancamentos({ registros, setRegistros, capacidadeConfig });

  const exportCSV = () => {
    const h = ["Data", "Turno", "Hora Entrada", "Hora Saída", "Total Horas", "Nome", "Cargo", "Unidade", "CC", "Operação", "Fornecedor", "Obs"];
    const rows = filtered.map(r => [r.data, r.turno, r.horaEntrada, r.horaSaida, r.totalHoras, r.nome, r.cargo, r.unidade, r.cc, r.motivo, r.fornecedor, r.obs].map(csvSafe).join(";"));
    const blob = new Blob(["﻿" + [h.join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `terceiros_${filtros.data || "todos"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const modalTitle = () => {
    if (modal === "new") return t("lanc_modal_new");
    if (Array.isArray(modal)) return `${t("lanc_modal_edit_lote")} — ${modal.length} ${modal.length !== 1 ? t("form_persons") : t("form_person")}`;
    return t("lanc_modal_edit");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {syncError && (
        <div role="alert" style={{ background: tk.redLight, color: tk.redDark, border: `1px solid ${tk.redBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
          {syncError}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <BlockHeader section={t("lanc_section")} title={t("lanc_title")} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" id="tour-btn-export" onClick={exportCSV} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />}>{t("lanc_btn_export")}</Btn>
          {isAdmin && (
            <Btn variant="ghost" onClick={() => setImportModalOpen(true)} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12M7 8l5-5 5 5" />}>
              {t("lanc_btn_import")}
            </Btn>
          )}
          <Btn id="tour-btn-novo" onClick={() => setModal("new")} icon={<Icon d="M12 5v14M5 12h14" />}>{t("lanc_btn_new")}</Btn>
        </div>
      </div>

      {importModalOpen && (
        <ImportRegistrosCsvModal
          onClose={() => setImportModalOpen(false)}
          registros={registros}
          setRegistros={setRegistros}
          onImported={setImportFeedback}
        />
      )}

      {importFeedback && (
        <div style={{ background: tk.blueBg, border: `1px solid ${tk.blueBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: tk.blueDark }}>
            Importação "{importFeedback.fonte || "arquivo"}": {importFeedback.importados} incluídos, {importFeedback.rejeitados} rejeitados.
            {importadosOcultos > 0 ? ` ${importadosOcultos} fora do filtro atual.` : " Todos os importados estão visíveis."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {importadosOcultos > 0 && (
              <Btn
                small
                variant="ghost"
                onClick={() => {
                  setFiltros({ data: "", turno: "", fornecedor: "", unidade: "", busca: "" });
                  setFiltroPeriodo({ mes: "", periodoIdx: null, customInicio: "", customFim: "" });
                }}
              >
                Mostrar importados
              </Btn>
            )}
            <Btn small variant="ghost" onClick={() => setImportFeedback(null)}>Fechar aviso</Btn>
          </div>
        </div>
      )}

      <div id="tour-filtros" style={{ background: tk.white, border: `1px solid ${tk.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <LancamentosPeriodoFilters filtroPeriodo={filtroPeriodo} onChange={setFiltroPeriodo} />
        <Input label={t("form_label_data")} type="date" value={filtros.data} onChange={e => setFiltro("data", e.target.value)} style={{ width: 150 }} />
        <Select label={t("form_label_turno")} value={filtros.turno} onChange={e => setFiltro("turno", e.target.value)} style={{ width: 150 }}>
          <option value="">{t("lanc_filter_all_m")}</option>{opcoes.turnos.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Select label={t("form_label_forn")} value={filtros.fornecedor} onChange={e => setFiltro("fornecedor", e.target.value)} style={{ width: 150 }}>
          <option value="">{t("lanc_filter_all_m")}</option>{opcoes.fornecedores.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Select label={t("form_label_unidade")} value={filtros.unidade} onChange={e => setFiltro("unidade", e.target.value)} style={{ width: 150 }}>
          <option value="">{t("lanc_filter_all_f")}</option>{opcoes.unidades.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Input label={t("lanc_filter_busca")} value={filtros.busca} onChange={e => setFiltro("busca", e.target.value)} placeholder="Nome…" style={{ width: 180 }} />
        <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
          <Btn
            variant="ghost"
            small
            onClick={() => {
              setFiltros({ data: "", turno: "", fornecedor: "", unidade: "", busca: "" });
              setFiltroPeriodo({ mes: "", periodoIdx: null, customInicio: "", customFim: "" });
            }}
          >
            {t("lanc_filter_clear")}
          </Btn>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 2 }}>
        <span style={{ fontSize: 12, color: tk.textMuted }}>
          {t("lanc_showing").replace("{n}", String(filtered.length)).replace("{total}", String(registros.length))}
        </span>
        {selectedIds.length > 0 && (
          <Btn
            variant="danger"
            small
            onClick={() => setConfirm(selectedIds)}
            icon={<Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />}
          >
            {`Excluir selecionados (${selectedIds.length})`}
          </Btn>
        )}
      </div>

      <LancamentosTable
        filtered={filtered}
        grupos={grupos}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        excedenteMap={excedenteMap}
        fornecedores={opcoes.fornecedores}
        onDetalhe={setDetalhe}
        onEditar={setModal}
        onConfirmDelete={setConfirm}
      />

      {modal && (
        <Modal title={modalTitle()} subtitle="Controle de Terceiros" onClose={() => setModal(null)} xl>
          <FormLancamento
            inicial={modal === "new" || Array.isArray(modal) ? null : modal as Registro}
            loteInicial={Array.isArray(modal) ? modal : undefined}
            onSave={salvar}
            onCancel={() => setModal(null)}
            opcoes={opcoes}
            hierarquia={hierarquia}
            registros={registros}
            turnosConfig={turnosConfig}
          />
        </Modal>
      )}

      {detalhe && (
        <LancamentosDetailModal
          detalhe={detalhe}
          waTemplate={waTemplate}
          onClose={() => setDetalhe(null)}
          onEdit={() => { setModal(detalhe); setDetalhe(null); }}
        />
      )}

      {confirm && (
        <Modal title={t("lanc_confirm_title")} onClose={() => setConfirm(null)}>
          <p style={{ color: tk.textBody, fontSize: 13, lineHeight: 1.6 }}>
            {confirm.length > 1
              ? t("lanc_confirm_lote").replace("{n}", String(confirm.length))
              : t("lanc_confirm_single")}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setConfirm(null)}>{t("lanc_confirm_cancel")}</Btn>
            <Btn variant="danger" onClick={() => excluir(confirm)}>{t("lanc_confirm_delete")}</Btn>
          </div>
        </Modal>
      )}

      {conflito && (
        <LancamentosConflictModal
          conflito={conflito}
          setConflito={setConflito}
          onConfirm={salvar}
        />
      )}
    </div>
  );
};
