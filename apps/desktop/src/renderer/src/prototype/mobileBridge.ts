import type { Campaign, UnitSettings } from './office';
import { apiRequest, getAgendaSession } from './sharedApi';

export async function publishMobileAlert(campaign: Campaign, settings: UnitSettings) {
  if (!getAgendaSession())
    throw new Error('Sua sessão expirou. Entre novamente no hemocentro antes de publicar.');
  // Não transmite CPF, e-mail, telefone nem a lista de destinatários.
  await apiRequest('/demo/alerts', 'POST', {
    id: campaign.id,
    title: campaign.title,
    message: campaign.message,
    bloodType: campaign.bloodType,
    region: campaign.region,
    unitName: settings.name,
  });
}
