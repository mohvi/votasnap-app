export async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (response.status === 404) {
      throw new Error('Serviço de submissão não encontrado (HTTP 404). Fecha e reabre a aplicação atualizada.');
    }
    throw new Error(`O serviço devolveu uma resposta inválida (HTTP ${response.status}). Não foi possível confirmar a operação. Verifica o estado antes de tentar novamente.`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resposta inválida do serviço. Não foi possível confirmar a operação.');
  }
  const result = data as { error?: unknown; success?: boolean };
  if (!response.ok || result.success === false) {
    throw new Error(typeof result.error === 'string' ? result.error : `Erro no serviço (HTTP ${response.status}).`);
  }
  return data as T;
}
