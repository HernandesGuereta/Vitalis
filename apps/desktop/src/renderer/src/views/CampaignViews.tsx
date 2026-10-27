import { Badge, Empty, Notice, Panel, Stat } from '../components/ui';
import type { AutomaticAlert } from '../prototype/useAutomaticAlerts';
export function AutomaticAlertsView({
  alerts,
  synced,
}: {
  alerts: AutomaticAlert[];
  synced: boolean;
}) {
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Avisos ativos"
          value={synced ? alerts.length : '—'}
          detail="Gerados automaticamente pelo estoque"
        />
        <Stat
          label="Estoque baixo"
          value={synced ? alerts.filter((a) => a.level === 'baixo').length : '—'}
          detail="Até 50% da meta fictícia"
        />
        <Stat
          label="Estoque crítico"
          value={synced ? alerts.filter((a) => a.level === 'critico').length : '—'}
          detail="Até 25% da meta fictícia"
        />
      </div>
      <Panel title="Avisos automáticos de escassez">
        <Notice>
          O sistema usa mensagens prontas. A equipe registra as movimentações; não precisa criar nem
          enviar alertas. Na reposição, o aviso é encerrado automaticamente.
        </Notice>
        {!synced ? (
          <p className="section-gap" role="status">
            Aguardando sincronização do estoque com a API.
          </p>
        ) : alerts.length ? (
          <div className="section-gap automatic-alerts">
            {alerts.map((alert) => (
              <article className="panel" key={alert.id}>
                <Badge tone={alert.level === 'critico' ? 'critical' : 'low'}>
                  {alert.level === 'critico' ? 'Estoque crítico' : 'Estoque baixo'} ·{' '}
                  {alert.bloodType}
                </Badge>
                <h3>{alert.title}</h3>
                <p>{alert.message}</p>
                <p className="muted">
                  {alert.unitName} · {alert.region} · Aviso ativo no aplicativo
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            O estoque sincronizado não tem tipos em escassez. Novos avisos serão gerados se os
            limites forem atingidos.
          </Empty>
        )}
      </Panel>
      <div className="section-gap">
        <Notice warning>
          Critérios de demonstração, sem valor clínico. Push depende de consentimento, build nativo,
          credenciais e servidor ativo. Aviso no app não comprova entrega de push ao aparelho.
        </Notice>
      </div>
    </>
  );
}
