import { Status, type Surgery } from '../types.ts';

/**
 * Alterna o cancelamento de uma cirurgia preservando o status anterior.
 * - Se não cancelada: salva o status atual em status_before_cancel e seta CANCELADO.
 * - Se cancelada: restaura status_before_cancel (ou REALIZADO para registros legados).
 * Nunca altera owner_email nem outros campos de controle.
 */
export const toggleSurgeryCancellation = (s: Surgery): Surgery => {
  if (s.status === Status.CANCELADO) {
    const { status_before_cancel, ...rest } = s as Surgery & { status_before_cancel?: Status };
    return { ...rest, status: status_before_cancel ?? Status.REALIZADO };
  }
  return { ...s, status: Status.CANCELADO, status_before_cancel: s.status } as Surgery & { status_before_cancel: Status };
};

/**
 * Filtra apenas as cirurgias ativas (não canceladas).
 * Usada para métricas, receita e portfólio.
 */
export const activeSurgeries = (list: Surgery[]): Surgery[] =>
  list.filter(s => s.status !== Status.CANCELADO);
