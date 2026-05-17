import type { Registro } from "@/types/attendance";
import { sanitize } from "@/lib/audit";
import { Modal, Btn } from "@/components/atoms";
import { tk } from "@/lib/design-tokens";
import type { ConflitoState } from "@/hooks/useLancamentos";

interface Props {
  conflito: ConflitoState;
  setConflito: (c: ConflitoState | null | ((prev: ConflitoState | null) => ConflitoState | null)) => void;
  onConfirm: (novos: Registro[], justificativa: string) => void;
}

export function LancamentosConflictModal({ conflito, setConflito, onConfirm }: Props) {
  const hasJustification = conflito.justificativa.trim().length > 0;

  return (
    <Modal title="⚠️ Colaborador já lançado em outro turno" onClose={() => setConflito(null)} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: tk.amberSurface, border: `1.5px solid ${tk.amberAccent}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontWeight: 700, color: tk.amber, fontSize: 13, marginBottom: 8 }}>
            {conflito.nomes.length === 1
              ? `${conflito.nomes[0]} já tem registro em outro turno nesta data.`
              : `${conflito.nomes.length} colaboradores já têm registro em outro turno nesta data:`}
          </div>
          {conflito.nomes.length > 1 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: tk.amberDeep }}>
              {conflito.nomes.map(n => <li key={n}>{n}</li>)}
            </ul>
          )}
        </div>
        <div style={{ fontSize: 12, color: tk.textGray }}>
          Para registrar em dois turnos no mesmo dia, informe o motivo abaixo. A justificativa será salva no campo Obs do registro.
        </div>
        <textarea
          value={conflito.justificativa}
          onChange={e => setConflito(c => c ? { ...c, justificativa: sanitize(e.target.value) } : c)}
          placeholder="Ex: horas extras autorizadas, cobertura de falta emergencial, dobra de turno..."
          rows={3}
          style={{
            border: `1.5px solid ${hasJustification ? tk.amberAccent : tk.border}`,
            borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "inherit",
            resize: "vertical", outline: "none", width: "100%", boxSizing: "border-box", background: tk.surfaceNearly,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="ghost" onClick={() => setConflito(null)}>Cancelar</Btn>
          <Btn
            onClick={() => {
              const j = conflito.justificativa.trim();
              if (!j) return;
              const novos = conflito.novos;
              setConflito(null);
              onConfirm(novos, j);
            }}
            disabled={!hasJustification}
            style={{
              background: hasJustification ? tk.amber : undefined,
              opacity: hasJustification ? 1 : 0.45,
            }}>
            Confirmar com justificativa
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
