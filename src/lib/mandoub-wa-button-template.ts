export type MandoubWaButtonVariableValues = Record<string, string>;

const TOKEN_RE = /\{\{\{([a-zA-Z0-9_]+)\}\}\}/g;

export function applyMandoubWaTemplate(
  templateText: string,
  vars: MandoubWaButtonVariableValues,
): string {
  return templateText.replace(TOKEN_RE, (_, key: string) => {
    const v = vars[key];
    return v ?? "";
  });
}

/**
 * يدعم إدخال عدة نماذج داخل نفس الحقل بفاصل سطر مستقل يحتوي `---`.
 * إذا لم يُستخدم الفاصل، يرجع نموذجاً واحداً فقط.
 */
export function splitMandoubWaTemplateVariants(templateText: string): string[] {
  return templateText
    .split(/\n\s*---\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseStatusesCsv(statusesCsv: string): string[] {
  return statusesCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatCsvString(statuses: string[]): string {
  return statuses
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

