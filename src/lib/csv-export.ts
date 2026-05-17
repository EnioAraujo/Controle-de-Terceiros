/**
 * Escapa célula CSV contra injeção de fórmula (CWE-1236 / OWASP A03).
 * - Prefixa com apóstrofo + aspas se começar com =/+/-/@/|/\t/`
 * - Aspas duplicadas para conformidade RFC 4180
 * - Envolve em aspas se contém delimitador, quebra de linha ou aspas
 */
export const csvSafe = (val: string): string => {
  if (!val) return val;
  const escaped = val.replace(/"/g, '""');
  if (/^[=+\-@|\t`]/.test(escaped) || escaped.includes(";") || escaped.includes("\n") || escaped.includes("\r")) {
    return `"'${escaped}"`;
  }
  if (escaped !== val || /[\s,"]/.test(escaped)) return `"${escaped}"`;
  return escaped;
};
