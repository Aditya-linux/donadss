import type { CompletedTask } from "@/lib/donads-api";
import { formatTaskDuration, taskCompletionTime } from "@/lib/task-receipt";

export type ReportRow = [label: string, value: string];

export type TaskReportModel = {
  title: string;
  filename: string;
  metadata: ReportRow[];
  request: ReportRow[];
  result: ReportRow[];
  activity: Array<[time: string, event: string, message: string]>;
};

const sensitiveKey = /(access.?token|authorization|cookie|private.?key|seed.?phrase|secret|signature)/i;

function words(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  return String(value).slice(0, 1_200);
}

export function flattenReportData(value: unknown): ReportRow[] {
  const rows: ReportRow[] = [];

  function visit(current: unknown, path: string[]): void {
    if (rows.length >= 300) return;
    if (current === null || typeof current !== "object") {
      rows.push([path.map(words).join(" / ") || "Value", display(current)]);
      return;
    }
    if (Array.isArray(current)) {
      if (current.length === 0) {
        rows.push([path.map(words).join(" / ") || "Items", "None"]);
      } else if (current.every((item) => item === null || typeof item !== "object")) {
        rows.push([path.map(words).join(" / ") || "Items", current.map(display).join(", ")]);
      } else {
        current.forEach((item, index) => visit(item, [...path, `Item ${index + 1}`]));
      }
      return;
    }
    const allEntries = Object.entries(current as Record<string, unknown>);
    const entries = allEntries.filter(
      ([key]) => !sensitiveKey.test(key),
    );
    if (allEntries.length === 0 && path.length > 0) {
      rows.push([path.map(words).join(" / "), "None"]);
    }
    entries.forEach(([key, item]) => visit(item, [...path, key]));
  }

  visit(value, []);
  if (rows.length === 300) rows.push(["Report limit", "Additional fields were omitted."]);
  return rows;
}

function formatTime(milliseconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(milliseconds));
}

export function buildTaskReport(task: CompletedTask): TaskReportModel {
  const specialist = words(task.bot);
  return {
    title: `${specialist} task report`,
    filename: `donads-${task.bot}-${task.id.slice(0, 8)}.pdf`,
    metadata: [
      ["Task ID", task.id],
      ["Specialist", specialist],
      ["Task status", task.status.state],
      ["Created (UTC)", formatTime(task.created_at_ms)],
      ["Updated (UTC)", formatTime(task.updated_at_ms)],
      ["Worked for", formatTaskDuration(taskCompletionTime(task) - task.created_at_ms)],
      ["Specialist processing time", `${task.status.latency_ms} ms`],
      ["Summary", task.status.summary],
    ],
    request: [["Prompt", task.prompt], ...flattenReportData(task.input)],
    result: flattenReportData(task.status.data),
    activity: task.events.map((event) => [
      formatTime(event.at_ms),
      words(event.kind),
      event.message,
    ]),
  };
}

async function loadMascot(): Promise<Uint8Array | null> {
  try {
    const response = await fetch("/brand/donads-mascot-tile.png");
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generateTaskReportPdf(
  task: CompletedTask,
): Promise<{ filename: string; bytes: ArrayBuffer }> {
  const [{ jsPDF }, { default: autoTable }, mascot] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadMascot(),
  ]);
  const report = buildTaskReport(task);
  const document = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 16;
  const ink: [number, number, number] = [21, 16, 14];
  const primary: [number, number, number] = [64, 46, 37];
  const muted: [number, number, number] = [247, 244, 240];
  const border: [number, number, number] = [210, 201, 193];

  document.setProperties({
    title: report.title,
    subject: `DONADS verified task record ${task.id}`,
    author: "DONADS",
    creator: "DONADS report exporter",
  });
  document.setFillColor(...primary);
  document.rect(0, 0, pageWidth, 5, "F");
  document.setTextColor(...primary);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("DONADS", margin, 18);
  document.setTextColor(...ink);
  document.setFontSize(22);
  document.text(report.title, margin, 30);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(100, 91, 86);
  document.text("Decentralized On-chain Neural Agent Dispatch System", margin, 36);
  if (mascot) document.addImage(mascot, "PNG", pageWidth - margin - 17, 12, 17, 17);

  let cursor = 43;
  const tableDocument = document as typeof document & { lastAutoTable?: { finalY: number } };
  const addTable = (heading: string, head: string[], body: string[][], widths?: Record<number, { cellWidth: number }>) => {
    document.setTextColor(...ink);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(heading, margin, cursor);
    autoTable(document, {
      startY: cursor + 3,
      margin: { left: margin, right: margin, top: 16, bottom: 16 },
      head: [head],
      body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.5, textColor: ink, lineColor: border, lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: muted },
      columnStyles: widths,
    });
    cursor = (tableDocument.lastAutoTable?.finalY ?? cursor + 12) + 9;
    if (cursor > 270) {
      document.addPage();
      cursor = 20;
    }
  };

  addTable("Task record", ["Field", "Value"], report.metadata, { 0: { cellWidth: 42 } });
  addTable("Request", ["Field", "Value"], report.request, { 0: { cellWidth: 52 } });
  addTable("Structured result", ["Field", "Value"], report.result, { 0: { cellWidth: 62 } });
  addTable("Activity", ["Time (UTC)", "Event", "Message"], report.activity, {
    0: { cellWidth: 34 },
    1: { cellWidth: 30 },
  });

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setDrawColor(...border);
    document.line(margin, 283, pageWidth - margin, 283);
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(100, 91, 86);
    document.text("Generated locally by DONADS. Verify financial and security results before acting.", margin, 289);
    document.text(`${page} / ${pages}`, pageWidth - margin, 289, { align: "right" });
  }
  return { filename: report.filename, bytes: document.output("arraybuffer") };
}

export async function downloadTaskReport(task: CompletedTask): Promise<void> {
  const report = await generateTaskReportPdf(task);
  const url = URL.createObjectURL(new Blob([report.bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = report.filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
