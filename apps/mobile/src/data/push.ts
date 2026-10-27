// Navegador: avisos continuam disponíveis na área Alertas, sem push nativo.
export async function getPushToken(): Promise<string> {
  throw new Error(
    'Notificações com o app fechado precisam de um build Android/iOS do Vitalis. No navegador, acompanhe os avisos em Alertas.',
  );
}
export function watchPushOpen(_onOpen: () => void) {
  return () => {};
}
