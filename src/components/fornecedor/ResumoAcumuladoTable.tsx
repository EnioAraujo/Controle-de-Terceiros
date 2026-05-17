import type { ResumoPessoa } from "@/lib/fechamento-utils";
import { FornecedorErrorBanner } from "@/components/fornecedor/FornecedorErrorBanner";

interface Props {
  resumo: ResumoPessoa[];
  total: number;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#6B7280",
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#212B36",
  whiteSpace: "nowrap",
};

const tdNum: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const tfoot: React.CSSProperties = {
  ...td,
  fontWeight: 700,
  background: "#F9FAFB",
};

const tfootNum: React.CSSProperties = {
  ...tdNum,
  fontWeight: 700,
  background: "#F9FAFB",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface LinhaCalc {
  nome: string;
  dias: number;
  bruto: number;
  desconto: number;
  pagar: number;
}

const calcularLinha = (p: ResumoPessoa): LinhaCalc => {
  const bruto = Math.round(p.itens.reduce((a, i) => a + i.valorDiaria, 0) * 100) / 100;
  const pagar = p.valorTotal;
  const desconto = Math.round((bruto - pagar) * 100) / 100;
  return { nome: p.nome, dias: p.dias, bruto, desconto, pagar };
};

export function ResumoAcumuladoTable({ resumo, total, loading, error, onRetry }: Props) {
  if (error) {
    return (
      <div style={card}>
        <FornecedorErrorBanner mensagem={error} onRetry={onRetry} />
      </div>
    );
  }

  const linhas = resumo.map(calcularLinha);
  const totBruto = Math.round(linhas.reduce((a, l) => a + l.bruto, 0) * 100) / 100;
  const totDesc = Math.round(linhas.reduce((a, l) => a + l.desconto, 0) * 100) / 100;
  const totDias = linhas.reduce((a, l) => a + l.dias, 0);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#212B36" }}>Resumo acumulado</h2>
        {loading && (
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Carregando…</span>
        )}
      </div>

      {linhas.length === 0 && !loading ? (
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>
          Nenhum registro encontrado no período selecionado.
        </p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#F9FAFB" }}>
              <tr>
                <th style={th}>Nome</th>
                <th style={{ ...th, textAlign: "right" }}>Qtd Diárias</th>
                <th style={{ ...th, textAlign: "right" }}>Valor Total Diárias</th>
                <th style={{ ...th, textAlign: "right" }}>Descontos</th>
                <th style={{ ...th, textAlign: "right" }}>Valor a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.nome} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={td}>{l.nome}</td>
                  <td style={tdNum}>{l.dias}</td>
                  <td style={tdNum}>{fmtBRL(l.bruto)}</td>
                  <td style={tdNum}>{fmtBRL(l.desconto)}</td>
                  <td style={tdNum}>{fmtBRL(l.pagar)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #E5E7EB" }}>
                <td style={tfoot}>Total</td>
                <td style={tfootNum}>{totDias}</td>
                <td style={tfootNum}>{fmtBRL(totBruto)}</td>
                <td style={tfootNum}>{fmtBRL(totDesc)}</td>
                <td style={tfootNum}>{fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
