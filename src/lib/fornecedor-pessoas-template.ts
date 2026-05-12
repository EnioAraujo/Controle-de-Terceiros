// Gera o template XLSX para importação de funcionários do fornecedor.
// Colunas: "Nome Completo" e "Cargo". Inclui 1 linha de exemplo.

export async function exportTemplate(): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
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
