import { useState } from 'react';
import { publishMobileAlert } from '../prototype/mobileBridge';
import type { Campaign, UnitSettings } from '../prototype/office';

export function MobilePublication({
  campaign,
  settings,
}: {
  campaign: Campaign;
  settings: UnitSettings;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div className="section-gap">
      <p>Compartilhe este aviso público com o aplicativo pela API de demonstração.</p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            await publishMobileAlert(campaign, settings);
            setMessage('Publicado no aplicativo. Abra Alertas no celular e atualize a lista.');
          } catch (error) {
            setMessage(
              `${error instanceof Error ? error.message : 'Não foi possível publicar.'} O alerta continua salvo no desktop.`,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Publicando…' : 'Publicar no aplicativo'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
