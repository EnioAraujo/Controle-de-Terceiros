import type { Registro } from "@/types/attendance";

/**
 * Remove duplicatas intra-lote: dentro do mesmo loteId, mantém apenas o primeiro
 * registro com cada nome (case-insensitive). Registros sem loteId passam sempre.
 */
export function deduplicarLote(registros: Registro[]): Registro[] {
  const loteVisto = new Map<string, Set<string>>();
  return registros.filter(r => {
    if (!r.loteId) return true;
    if (!loteVisto.has(r.loteId)) loteVisto.set(r.loteId, new Set());
    const k = r.nome.trim().toLowerCase();
    if (loteVisto.get(r.loteId)!.has(k)) return false;
    loteVisto.get(r.loteId)!.add(k);
    return true;
  });
}

/**
 * Calcula a diferença entre o estado anterior e o novo estado dos registros.
 * - deletedIds: IDs que existiam em prev mas não existem em next
 * - toUpsert: registros de next que são novos ou tiveram conteúdo alterado
 */
export function diffRegistros(
  prev: Registro[],
  next: Registro[],
): { deletedIds: string[]; toUpsert: Registro[] } {
  const newIds = new Set(next.map(r => r.id));
  const deletedIds = prev.filter(r => !newIds.has(r.id)).map(r => r.id);

  const prevMap = new Map(prev.map(r => [r.id, r]));
  const toUpsert = next.filter(r => {
    const p = prevMap.get(r.id);
    return !p || JSON.stringify(p) !== JSON.stringify(r);
  });

  return { deletedIds, toUpsert };
}
