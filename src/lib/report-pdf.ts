// Saves the sealed report as an A4 PDF from the sheet on screen. The browser draws the sheet itself
// (html-to-image), so the score ring's conic gradient and the web fonts come out as they look;
// pages break between sections or table rows rather than through a line of text.

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 36;

/** Where a page may end: the bottom of each section and of each table row, in CSS px from the sheet's top. */
function breakPoints(sheet: HTMLElement): number[] {
  const top = sheet.getBoundingClientRect().top;
  const blocks = [...Array.from(sheet.children), ...Array.from(sheet.querySelectorAll(".report-table tr"))];
  const bottoms = blocks.map((el) => Math.round(el.getBoundingClientRect().bottom - top));
  return [...new Set(bottoms)].sort((a, b) => a - b);
}

/** [top, bottom] of each page in CSS px: as much as fits, ending at a break point unless one block is taller than a page. */
function pageRanges(height: number, pageHeight: number, breaks: number[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (let top = 0; top < height; ) {
    const limit = top + pageHeight;
    const bottom = limit >= height ? height : (breaks.filter((b) => b > top && b <= limit).pop() ?? limit);
    ranges.push([top, bottom]);
    top = bottom;
  }
  return ranges;
}

export async function downloadReportPdf(sheet: HTMLElement, fileName: string) {
  // Loaded on click: neither library is needed until someone downloads.
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const { width, height } = sheet.getBoundingClientRect();
  const breaks = breakPoints(sheet);
  const canvas = await toCanvas(sheet, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    // Applied to the copy only. `.rise` starts at opacity 0, which the copy would be drawn at;
    // the rest matches the print stylesheet: white, without the card's edges. The copy carries
    // logical border colours too, and those win over `borderColor` alone.
    style: {
      animation: "none",
      opacity: "1",
      transform: "none",
      boxShadow: "none",
      borderRadius: "0",
      borderColor: "transparent",
      borderInlineColor: "transparent",
      borderBlockColor: "transparent",
      background: "#ffffff",
    },
  });

  const contentWidth = PAGE.width - MARGIN * 2;
  const scale = contentWidth / width; // points per CSS px
  const ratio = canvas.width / width; // canvas px per CSS px
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  pageRanges(height, (PAGE.height - MARGIN * 2) / scale, breaks).forEach(([top, bottom], i) => {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.round((bottom - top) * ratio));
    slice
      .getContext("2d")!
      .drawImage(canvas, 0, Math.round(top * ratio), slice.width, slice.height, 0, 0, slice.width, slice.height);
    if (i > 0) pdf.addPage();
    // Without compression jsPDF stores raw pixels: several MB for a two-page report.
    pdf.addImage(slice, "PNG", MARGIN, MARGIN, contentWidth, (bottom - top) * scale, undefined, "FAST");
  });

  pdf.save(fileName);
}
