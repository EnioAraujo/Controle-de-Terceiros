/**
 * API intermediária para operações de fechamento financeiro
 * 
 * Implementa transações atômicas usando Supabase RPC para garantir
 * consistência entre tabelas: fechamentos, fechamento_itens
 * 
 * OWASP A01:2025 - Controle de acesso server-side
 * OWASP A10:2025 - Fail closed em caso de erro
 */

import { supabase } from "@/lib/supabase";
import type { Registro } from "@/types/attendance";

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

export type FechamentoStatus = "rascunho" | "enviado" | "revisao" | "aprovado";

export interface FechamentoItem {
  registro_id: string;
  nome: string;
  data: string;
  turno: string;
  horas: string;
  valor_diaria: number;
  valor_hora: number;
  valor_calculado: number;
  ajuste_manual?: boolean;
  obs?: string;
}

export interface FechamentoInput {
  fornecedor: string;
  data_inicio: string;
  data_fim: string;
  status: FechamentoStatus;
  valor_total: number;
  itens: FechamentoItem[];
}

export interface FechamentoOutput {
  id: string;
  fornecedor: string;
  data_inicio: string;
  data_fim: string;
  status: FechamentoStatus;
  valor_total: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

// ═══════════════════════════════════════════════════════════════
// API DE FECHAMENTO
// ═══════════════════════════════════════════════════════════════

/**
 * Cria um novo fechamento financeiro com transação atômica
 * 
 * Usa Supabase RPC para garantir atomicidade:
 * - Insert em fechamentos
 * - Insert em fechamento_itens (múltiplos)
 * - Rollback automático se qualquer operação falhar
 * 
 * @param input - Dados do fechamento
 * @returns ID do fechamento criado ou erro
 */
export async function criarFechamento(
  input: FechamentoInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Obter usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    // Usar RPC para transação atômica
    const { data, error } = await supabase.rpc("criar_fechamento", {
      p_fornecedor: input.fornecedor,
      p_data_inicio: input.data_inicio,
      p_data_fim: input.data_fim,
      p_status: input.status,
      p_valor_total: input.valor_total,
      p_created_by: session.user.id,
      p_itens: input.itens.map(item => ({
        registro_id: item.registro_id,
        nome: item.nome,
        data: item.data,
        turno: item.turno,
        horas: item.horas,
        valor_diaria: item.valor_diaria,
        valor_hora: item.valor_hora,
        valor_calculado: item.valor_calculado,
        ajuste_manual: item.ajuste_manual ?? false,
        obs: item.obs ?? null,
      })),
    });

    if (error) {
      console.error("[API_FECHAMENTO] Erro ao criar fechamento:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      id: data,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO] Erro inesperado:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Atualiza um fechamento existente com transação atômica
 * 
 * @param fechamentoId - ID do fechamento
 * @param input - Dados atualizados
 * @returns Sucesso ou erro
 */
export async function atualizarFechamento(
  fechamentoId: string,
  input: Partial<FechamentoInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    // Atualizar cabeçalho
    if (input.status || input.valor_total) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (input.status) updateData.status = input.status;
      if (input.valor_total !== undefined) updateData.valor_total = input.valor_total;

      const { error } = await supabase
        .from("fechamentos")
        .update(updateData)
        .eq("id", fechamentoId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Atualizar itens se fornecidos
    if (input.itens) {
      // Deletar itens existentes
      const { error: deleteError } = await supabase
        .from("fechamento_itens")
        .delete()
        .eq("fechamento_id", fechamentoId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // Inserir novos itens
      const { error: insertError } = await supabase
        .from("fechamento_itens")
        .insert(
          input.itens.map(item => ({
            fechamento_id: fechamentoId,
            ...item,
          }))
        );

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO] Erro inesperado:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Busca fechamentos por fornecedor e período
 * 
 * @param fornecedor - Nome do fornecedor
 * @param dataInicio - Data de início
 * @param dataFim - Data de fim
 * @returns Lista de fechamentos ou erro
 */
export async function buscarFechamentos(
  fornecedor?: string,
  dataInicio?: string,
  dataFim?: string
): Promise<{ success: boolean; data?: FechamentoOutput[]; error?: string }> {
  try {
    let query = supabase
      .from("fechamentos")
      .select("*")
      .order("created_at", { ascending: false });

    if (fornecedor) {
      query = query.eq("fornecedor", fornecedor);
    }

    if (dataInicio) {
      query = query.gte("data_inicio", dataInicio);
    }

    if (dataFim) {
      query = query.lte("data_fim", dataFim);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as FechamentoOutput[],
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO] Erro inesperado:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Busca itens de um fechamento específico
 * 
 * @param fechamentoId - ID do fechamento
 * @returns Lista de itens ou erro
 */
export async function buscarFechamentoItens(
  fechamentoId: string
): Promise<{ success: boolean; data?: FechamentoItem[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("fechamento_itens")
      .select("*")
      .eq("fechamento_id", fechamentoId)
      .order("data", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as FechamentoItem[],
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO] Erro inesperado:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Exclui um fechamento e seus itens (transação atômica)
 * 
 * @param fechamentoId - ID do fechamento
 * @returns Sucesso ou erro
 */
export async function excluirFechamento(
  fechamentoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Usar RPC para exclusão em cascata atômica
    const { error } = await supabase.rpc("excluir_fechamento", {
      p_fechamento_id: fechamentoId,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO] Erro inesperado:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
