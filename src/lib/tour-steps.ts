import type { TourStep } from "@/components/GuidedTour";

/**
 * Steps do tour guiado da aba Lançamentos.
 * Os ids referenciados existem em `src/components/Lancamentos.tsx`
 * (tour-btn-novo, tour-filtros, tour-tabela, tour-btn-export) e em
 * `LancamentosTable.tsx` (tour-tabela).
 */
export const TOUR_STEPS_LANCAMENTOS: TourStep[] = [
  {
    target: "#tour-btn-novo",
    title: "Novo lançamento",
    desc: "Clique aqui para registrar um colaborador (ou um lote de colaboradores) na data e turno selecionados.",
    icon: "➕",
    tabBefore: "lancamentos",
  },
  {
    target: "#tour-filtros",
    title: "Filtros",
    desc: "Filtre por data, período (mês ou range), turno, fornecedor, unidade ou nome. Os totais abaixo refletem o filtro ativo.",
    icon: "🔎",
    tabBefore: "lancamentos",
  },
  {
    target: "#tour-tabela",
    title: "Tabela de lançamentos",
    desc: "Linha por dia+turno; lotes aparecem agrupados com badge N×. Clique numa linha para ver detalhes ou usar as ações de editar/excluir.",
    icon: "📋",
    tabBefore: "lancamentos",
  },
  {
    target: "#tour-btn-export",
    title: "Exportar CSV",
    desc: "Exporta os registros visíveis (já filtrados) em CSV seguro contra injeção de fórmula. Use para Excel, Sheets ou backup.",
    icon: "⬇️",
    tabBefore: "lancamentos",
  },
];
