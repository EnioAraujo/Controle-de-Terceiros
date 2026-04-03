import type { Registro } from "@/types/attendance";

export const TURNOS_PROJECAO = ["1ª TURNO", "2ª TURNO", "3ª TURNO"] as const;

/** Gera array de datas YYYY-MM-DD entre inicio e fim (inclusive). Faz auto-swap se invertidas. */
export function gerarDias(inicio: string, fim: string): string[] {
  if (!inicio || !fim) return [];
  const a = inicio <= fim ? inicio : fim;
  const b = inicio <= fim ? fim : inicio;
  const dias: string[] = [];
  const d = new Date(a + "T00:00:00");
  const end = new Date(b + "T00:00:00");
  while (d <= end) {
    dias.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

/** Calcula média de pessoas por turno usando todo o histórico filtrado por fornecedor. */
export function calcMediaPorTurno(
  registros: Registro[],
  turnos: readonly string[],
  fornFiltro: string,
): Record<string, number> {
  const regs = registros.filter(r => {
    if (fornFiltro && r.fornecedor !== fornFiltro) return false;
    return turnos.includes(r.turno);
  });
  const porTurno: Record<string, number> = {};
  for (const t of turnos) porTurno[t] = 0;
  for (const r of regs) porTurno[r.turno]++;
  const diasComDados = new Set(regs.map(r => r.data)).size;
  const medias: Record<string, number> = {};
  for (const t of turnos) {
    medias[t] = diasComDados > 0 ? porTurno[t] / diasComDados : 0;
  }
  return medias;
}

/** Combina registros reais com projeção automática para cada dia. */
export function calcDadosPorDia(
  todosDias: string[],
  regsFiltrados: Registro[],
  diasProjecao: string[],
  medias: Record<string, number>,
  qtdCustom: number,
  turnos: readonly string[] = TURNOS_PROJECAO,
): Record<string, Record<string, number>> {
  const mapa: Record<string, Record<string, number>> = {};
  for (const dia of todosDias) {
    mapa[dia] = Object.fromEntries(turnos.map(t => [t, 0]));
  }
  for (const r of regsFiltrados) {
    if (mapa[r.data] && turnos.includes(r.turno)) {
      mapa[r.data][r.turno]++;
    }
  }
  const totalMedia = turnos.reduce((s, t) => s + medias[t], 0);
  const usarCustom = qtdCustom > 0 && totalMedia > 0;

  for (const dia of diasProjecao) {
    if (!mapa[dia]) continue;
    const jaTemReal = turnos.some(t => mapa[dia][t] > 0);
    if (jaTemReal) continue;
    if (usarCustom) {
      let distribuido = 0;
      for (let i = 0; i < turnos.length; i++) {
        if (i === turnos.length - 1) {
          mapa[dia][turnos[i]] = qtdCustom - distribuido;
        } else {
          const v = Math.round(qtdCustom * (medias[turnos[i]] / totalMedia));
          mapa[dia][turnos[i]] = v;
          distribuido += v;
        }
      }
    } else {
      for (const t of turnos) mapa[dia][t] = Math.round(medias[t]);
    }
  }
  return mapa;
}
