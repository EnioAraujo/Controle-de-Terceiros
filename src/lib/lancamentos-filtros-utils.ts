import { periodosPadrao } from "@/lib/fechamento-utils";

export interface LancamentosPeriodoFiltroState {
  mes: string;
  periodoIdx: number | null;
  customInicio: string;
  customFim: string;
}

export interface IntervaloData {
  inicio: string;
  fim: string;
}

export const resolverIntervaloLancamentos = (
  filtro: LancamentosPeriodoFiltroState,
): IntervaloData => {
  if (filtro.periodoIdx === null) {
    if (!filtro.mes) return { inicio: "", fim: "" };
    const match = filtro.mes.match(/^(\d{4})-(\d{2})$/);
    if (!match) return { inicio: "", fim: "" };
    const y = Number(match[1]);
    const m = Number(match[2]);
    const ultimoDia = new Date(y, m, 0).getDate();
    return {
      inicio: `${filtro.mes}-01`,
      fim: `${filtro.mes}-${String(ultimoDia).padStart(2, "0")}`,
    };
  }

  if (filtro.periodoIdx === 3) {
    return {
      inicio: filtro.customInicio,
      fim: filtro.customFim,
    };
  }

  if (!filtro.mes) return { inicio: "", fim: "" };
  const periodos = periodosPadrao(filtro.mes);
  const p = periodos[filtro.periodoIdx];
  if (!p) return { inicio: "", fim: "" };

  return { inicio: p.inicio, fim: p.fim };
};

export const passaFiltroDataPeriodo = (
  dataRegistro: string,
  dataExata: string,
  intervalo: IntervaloData,
): boolean => {
  if (dataExata && dataRegistro !== dataExata) return false;
  if (intervalo.inicio && dataRegistro < intervalo.inicio) return false;
  if (intervalo.fim && dataRegistro > intervalo.fim) return false;
  return true;
};
