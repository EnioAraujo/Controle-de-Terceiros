// Gera o template XLSX para importação de funcionários do fornecedor.
// Colunas: "Nome Completo" e "Cargo". Inclui 1 linha de exemplo.

type WorkbookCtor = new () => {
  addWorksheet: (name: string) => {
    columns: { header: string; key: string; width: number }[];
    getRow: (n: number) => { font: { bold: boolean } };
    addRow: (row: Record<string, string>) => void;
  };
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
};

// exceljs é UMD. Com pré-bundle do Vite (sem optimizeDeps.exclude), o módulo
// chega como: mod.Workbook (ESM-named) OU mod.default.Workbook (CJS-interop).
// Como fallback, também busca em window.ExcelJS (UMD global).
function resolveWorkbookCtor(mod: unknown): WorkbookCtor {
  const m = mod as Record<string, unknown> & { default?: Record<string, unknown> };
  const fromMod = (m.Workbook ?? m.default?.Workbook) as unknown;
  if (typeof fromMod === "function") return fromMod as WorkbookCtor;
  const fromGlobal = (globalThis as { ExcelJS?: { Workbook?: unknown } }).ExcelJS?.Workbook;
  if (typeof fromGlobal === "function") return fromGlobal as WorkbookCtor;
  throw new Error("ExcelJS: Workbook não encontrado no módulo carregado");
}

export async function exportTemplate(): Promise<Blob> {
  const mod = await import("exceljs");
  const Workbook = resolveWorkbookCtor(mod);
  const wb = new Workbook();
  const ws = wb.addWorksheet("Funcionarios");
  ws.columns = [
    { header: "Nome Completo", key: "nome",  width: 36 },
    { header: "Cargo",         key: "cargo", width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ nome: "JOÃO DA SILVA", cargo: "AUXILIAR DE DEPÓSITO" });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadTemplate(filename = "modelo_funcionarios.xlsx"): Promise<void> {
  return exportTemplate().then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}
