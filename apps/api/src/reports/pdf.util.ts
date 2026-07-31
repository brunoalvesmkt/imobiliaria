import PDFDocument from "pdfkit";

/**
 * Terceiro formato de exportação, ao lado de CSV (Fase 9/15) e XLSX (Fase
 * 33) — mesma assinatura `(headers, rows)`, então qualquer export existente
 * ganha PDF sem duplicar a lógica de consulta ao banco. Tabela simples
 * (sem paginação sofisticada): título + cabeçalho em negrito + linhas,
 * quebrando de página automaticamente quando o conteúdo não cabe.
 */
export function toPdf(title: string, headers: string[], rows: string[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = pageWidth / headers.length;
    const rowHeight = 20;

    doc.fontSize(14).text(title, { align: "left" });
    doc.moveDown(0.5);

    function drawHeader(): number {
      const y = doc.y;
      doc.fontSize(9).font("Helvetica-Bold");
      headers.forEach((header, i) => {
        doc.text(header, doc.page.margins.left + i * columnWidth, y, { width: columnWidth, ellipsis: true });
      });
      doc.font("Helvetica");
      return y + rowHeight;
    }

    let y = drawHeader();

    for (const row of rows) {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = drawHeader();
      }
      doc.fontSize(8);
      row.forEach((cell, i) => {
        doc.text(cell, doc.page.margins.left + i * columnWidth, y, { width: columnWidth, ellipsis: true });
      });
      y += rowHeight;
    }

    doc.end();
  });
}
