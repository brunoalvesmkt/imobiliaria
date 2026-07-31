import ExcelJS from "exceljs";

/**
 * Segundo formato de exportação ao lado do CSV (Fase 33, ver
 * DEVELOPMENT_PLAN.md) — mesma assinatura de `toCsv()` (headers + linhas de
 * string), então qualquer export existente ganha XLSX sem duplicar a
 * lógica de consulta ao banco.
 */
export async function toXlsx(sheetName: string, headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.columns.forEach((column) => {
    column.width = 20;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
