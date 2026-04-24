/**
 * csvUtils.ts — Shared CSV import/export utilities
 * Used by ProductsPage, PurchaseOrdersPage, CustomersPage, InventoryPage, etc.
 */

// ── Export ─────────────────────────────────────────────────────────────────────

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 * @param filename   e.g. "products.csv"
 * @param data       Array of flat objects (keys become the header row)
 */
export function exportToCsv(
  filename: string,
  data: Record<string, unknown>[],
): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const escapeCell = (val: unknown): string => {
    const str = val === null || val === undefined ? "" : String(val);
    // Wrap in quotes if it contains a comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = data.map((row) =>
    headers.map((h) => escapeCell(row[h])).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(filename, csv, "text/csv;charset=utf-8;");
}

// ── Download template ──────────────────────────────────────────────────────────

/**
 * Download a blank CSV template with only the header row.
 */
export function downloadCsvTemplate(filename: string, headers: string[]): void {
  const csv = `${headers.join(",")}\n`;
  triggerDownload(filename, csv, "text/csv;charset=utf-8;");
}

// ── Parse ──────────────────────────────────────────────────────────────────────

/**
 * Parse a CSV File into an array of row objects.
 * Handles quoted fields containing commas and embedded newlines.
 * The first row is treated as the header row.
 */
export function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) ?? "";
        resolve(parseCsvText(text));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Parse a raw CSV string (with headers) into row objects.
 */
export function parseCsvText(csv: string): Record<string, string>[] {
  const lines = tokeniseRows(csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    // Skip fully-empty rows
    if (cells.every((c) => c.trim() === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function triggerDownload(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * RFC-4180-compliant row tokeniser.
 * Returns an array of rows, each row being an array of field strings.
 */
function tokeniseRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < csv.length) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  // Flush final field / row
  row.push(field);
  if (row.some((c) => c !== "")) {
    rows.push(row);
  }
  return rows;
}
