import { describe, expect, it } from "vitest";
import {
  selecionarFechamentosAprovadosCanonicos,
  type FechamentoAprovadoCabecalho,
} from "./fechamento-dashboard";

describe("selecionarFechamentosAprovadosCanonicos", () => {
  it("mantem somente aprovados e escolhe a versao mais recente por fornecedor+periodo", () => {
    const base: FechamentoAprovadoCabecalho[] = [
      {
        id: "f-antigo",
        fornecedor: "LIDER MASTER",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        status: "aprovado",
        updated_at: "2026-04-20T10:00:00Z",
        created_at: "2026-04-20T09:00:00Z",
      },
      {
        id: "f-recente",
        fornecedor: "LIDER MASTER",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        status: "aprovado",
        updated_at: "2026-04-20T12:00:00Z",
        created_at: "2026-04-20T11:00:00Z",
      },
      {
        id: "f-nao-aprovado",
        fornecedor: "JSS",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        status: "rascunho",
        updated_at: "2026-04-20T12:00:00Z",
        created_at: "2026-04-20T11:00:00Z",
      },
      {
        id: "f-fora-intervalo",
        fornecedor: "JSS",
        data_inicio: "2026-03-01",
        data_fim: "2026-03-10",
        status: "aprovado",
        updated_at: "2026-03-10T10:00:00Z",
        created_at: "2026-03-10T09:00:00Z",
      },
      {
        id: "f-jss",
        fornecedor: "JSS",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        status: "aprovado",
        updated_at: "2026-04-20T08:00:00Z",
        created_at: "2026-04-20T07:00:00Z",
      },
    ];

    const result = selecionarFechamentosAprovadosCanonicos(base, "2026-04-01", "2026-04-30");

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id).sort()).toEqual(["f-jss", "f-recente"]);
  });
});
