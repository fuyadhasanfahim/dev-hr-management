/** Captures every `.qd-page` under `root` and assembles an A4 PDF (one image per page). */
export async function pagesToPdf(root: HTMLElement, title = "Quotation"): Promise<Blob> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

    await document.fonts?.ready;
    await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));

    const pages = Array.from(root.querySelectorAll<HTMLElement>(".qd-page"));
    if (!pages.length) throw new Error("Nothing to export");

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.setProperties({ title });
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i]!, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    return pdf.output("blob");
}
