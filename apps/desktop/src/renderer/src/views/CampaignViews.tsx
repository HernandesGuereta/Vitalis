import { useState } from 'react';
import type { FormEvent } from 'react';
import { bloodTypes } from '../prototype/model';
import type { BloodType } from '../prototype/model';
import { campaignRecipients, channels, formatDate } from '../prototype/office';
import type { Campaign, Channel, OfficeData } from '../prototype/office';
import { Badge, Empty, FormError, Notice, Panel, Stat } from '../components/ui';
import { MobilePublication } from '../components/MobilePublication';

export function CampaignsView({
  data,
  onOpen,
}: {
  data: OfficeData;
  onOpen: (campaign: Campaign) => void;
}) {
  const draft = data.campaigns.find((c) => c.status === 'draft');
  const count = draft ? campaignRecipients(data, draft).length : 0;
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Alertas neste mês"
          value={
            data.campaigns.filter((c) =>
              c.createdAt.startsWith(new Date().toISOString().slice(0, 7)),
            ).length
          }
          detail="Mobilizações demonstrativas"
        />
        <Stat label="Doadores selecionados" value={count} detail="Prévia do primeiro rascunho" />
        <Stat label="Canais configurados" value={2} detail="E-mail e WhatsApp" />
      </div>
      <Panel title="Campanhas e avisos" aside={data.settings.name}>
        {data.campaigns.length ? (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de registros, role para ver todas as colunas">
            <table>
              <thead>
                <tr>
                  <th>Alerta</th>
                  <th>Público</th>
                  <th>Canal</th>
                  <th>Data</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.title}</td>
                    <td>
                      {campaign.bloodType} · {campaign.region}
                    </td>
                    <td>{campaign.channels.join(' / ')}</td>
                    <td>{formatDate(campaign.createdAt.slice(0, 10))}</td>
                    <td>
                      <Badge tone={campaign.status === 'sent' ? 'good' : 'neutral'}>
                        {campaign.status === 'sent' ? 'Enviado · simulado' : 'Rascunho'}
                      </Badge>
                    </td>
                    <td>
                      <button className="table-action" onClick={() => onOpen(campaign)}>
                        {campaign.status === 'sent' ? 'Ver prévia' : 'Revisar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      <div className="section-gap">
        <Notice>
          A seleção dos destinatários considera tipo sanguíneo, cidade e canais autorizados dos
          perfis fictícios.
        </Notice>
      </div>
    </>
  );
}

export function CampaignForm({
  data,
  initial,
  onReview,
  onCancel,
}: {
  data: OfficeData;
  initial: Campaign;
  onReview: (value: Campaign) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const count = campaignRecipients(data, draft).length;
  function change<K extends keyof Campaign>(key: K, value: Campaign[K]) {
    setDraft({ ...draft, [key]: value });
    setError('');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onReview(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise os dados do alerta.');
    }
  }
  return (
    <div className="split-layout">
      <Panel title="Conteúdo e segmentação">
        <form className="data-form" onSubmit={submit}>
          <label>
            Título do alerta
            <input
              name="title"
              value={draft.title}
              onChange={(e) => change('title', e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <div className="form-row">
            <label>
              Tipo sanguíneo
              <select
                value={draft.bloodType}
                onChange={(e) => change('bloodType', e.target.value as BloodType)}
              >
                {bloodTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Região
              <input
                value={draft.region}
                onChange={(e) => change('region', e.target.value)}
                maxLength={100}
                required
              />
            </label>
          </div>
          <fieldset className="channel-field">
            <legend>Canais da comunicação</legend>
            {channels.map((channel) => (
              <label key={channel}>
                <input
                  type="checkbox"
                  checked={draft.channels.includes(channel)}
                  onChange={(e) =>
                    change(
                      'channels',
                      e.target.checked
                        ? [...draft.channels, channel]
                        : draft.channels.filter((c) => c !== channel),
                    )
                  }
                />
                {channel}
              </label>
            ))}
          </fieldset>
          <label>
            Mensagem
            <textarea
              name="message"
              rows={4}
              value={draft.message}
              onChange={(e) => change('message', e.target.value)}
              maxLength={1000}
              required
            />
          </label>
          <Notice>
            A mensagem será apresentada para revisão. O envio é simulado neste protótipo.
          </Notice>
          <FormError message={error} />
          <div className="form-actions">
            <button className="button primary" type="submit">
              Revisar alerta
            </button>
            <button className="button secondary" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Prévia do público" className="summary-panel">
        <strong className="audience-number">{count}</strong>
        <p>doadores selecionados</p>
        <dl>
          <dt>Tipo sanguíneo</dt>
          <dd>{draft.bloodType}</dd>
          <dt>Região</dt>
          <dd>{draft.region}</dd>
          <dt>Canais</dt>
          <dd>{draft.channels.join(' e ') || 'Selecione um canal'}</dd>
        </dl>
        <p className="muted small">
          Seleção local dos perfis fictícios. A busca usa a cidade informada; não calcula
          distâncias.
        </p>
      </Panel>
    </div>
  );
}

export function CampaignReview({
  data,
  campaign,
  onConfirm,
  onEdit,
  onBack,
}: {
  data: OfficeData;
  campaign: Campaign;
  onConfirm: () => void;
  onEdit: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState('');
  const recipients =
    campaign.status === 'sent'
      ? campaign.recipientIds.length
      : campaignRecipients(data, campaign).length;
  function confirm() {
    try {
      onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a simulação.');
    }
  }
  return (
    <div className="split-layout">
      <Panel title="Prévia da mensagem">
        <div className="message-preview">
          <span className="overline">ALERTA DE ESTOQUE</span>
          <h2>{campaign.title}</h2>
          <p>{campaign.message}</p>
          <div className="message-signature">
            <strong>{data.settings.name.toUpperCase()}</strong>
            <p>{data.settings.city} / Exemplo de comunicação</p>
          </div>
        </div>
      </Panel>
      <Panel title="Resumo do envio" className="summary-panel">
        <h3>{recipients} destinatários</h3>
        <p>
          {campaign.bloodType} · {campaign.region}
        </p>
        <p>{campaign.channels.join(' e ')}</p>
        <p>Respeitar preferências dos doadores</p>
        <FormError message={error} />
        {campaign.status === 'draft' ? (
          <>
            <button className="button primary full" onClick={confirm}>
              Confirmar envio simulado
            </button>
            <button className="button secondary full" onClick={onEdit}>
              Voltar para editar
            </button>
          </>
        ) : (
          <button className="button secondary full" onClick={onBack}>
            Voltar aos alertas
          </button>
        )}
        <p className="small muted">
          {campaign.status === 'sent'
            ? 'Envio simulado concluído. Nenhuma mensagem real foi enviada.'
            : 'O envio é simulado neste protótipo.'}
        </p>
        {campaign.status === 'sent' && (
          <MobilePublication campaign={campaign} settings={data.settings} />
        )}
      </Panel>
    </div>
  );
}

export function emptyCampaign(type: BloodType, region: string): Campaign {
  return {
    id: crypto.randomUUID(),
    title: `A região precisa de doadores ${type}`,
    bloodType: type,
    region,
    channels: ['E-mail', 'WhatsApp'] as Channel[],
    message: 'Seu gesto faz a diferença. Confira os horários da Unidade Centro.',
    status: 'draft',
    createdAt: new Date().toISOString(),
    recipientIds: [],
  };
}
