import { useEffect, useState } from 'react';
import {
  apiRequest,
  getAgendaSession,
  logoutAgenda,
  watchAppointments,
} from '../prototype/sharedApi';
import type { SharedAppointment } from '../prototype/sharedApi';
import { formatDate } from '../prototype/office';
import { Badge, Empty, FormError, Notice, Panel } from '../components/ui';

export function SharedAgendaView() {
  const [session, setSession] = useState(getAgendaSession);
  const [rows, setRows] = useState<SharedAppointment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState('');
  const [date, setDate] = useState('');
  async function refresh() {
    const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
    if (!Array.isArray(result.appointments)) throw new Error('Resposta inválida da agenda.');
    setRows(result.appointments);
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      if (!getAgendaSession()) {
        setSession(null);
        setRows([]);
      }
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const update = async () => {
      try {
        const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
        if (mounted && Array.isArray(result.appointments)) setRows(result.appointments);
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Falha ao atualizar.');
          if (!getAgendaSession()) {
            setSession(null);
            setRows([]);
          }
        }
      }
    };
    void update();
    const stop = watchAppointments(() => void update());
    const timer = window.setInterval(() => void update(), 5000);
    const expiry = window.setTimeout(
      () => {
        logoutAgenda();
        setSession(null);
        setRows([]);
      },
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    );
    return () => {
      mounted = false;
      stop();
      window.clearInterval(timer);
      window.clearTimeout(expiry);
    };
  }, [session]);
  return (
    <Panel
      title="Agendamentos para pré-triagem"
      aside={session ? 'Solicitações recebidas pelo aplicativo' : 'Acesso necessário'}
    >
      <FormError message={error} />
      {!session ? (
        <Notice>
          Sua sessão expirou. Entre novamente no sistema para consultar os agendamentos.
        </Notice>
      ) : (
        <>
          <Notice>
            {session.user.name} · acesso restrito à própria unidade. Novas solicitações são
            atualizadas automaticamente. Use somente contas fictícias neste protótipo.
          </Notice>
          <div className="filters agenda-shared-filters">
            <label>
              Filtrar dia
              <input
                type="date"
                aria-label="Dia dos agendamentos"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void action(refresh)}
            >
              Atualizar agendamentos
            </button>
          </div>
          {rows.filter((row) => !date || row.date === date).length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Doador</th>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Unidade</th>
                    <th>Situação</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((row) => !date || row.date === date)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.donorName}</td>
                        <td>{formatDate(row.date)}</td>
                        <td>{row.time}</td>
                        <td>{row.unitName}</td>
                        <td>
                          <Badge tone={row.status === 'booked' ? 'good' : 'neutral'}>
                            {row.status === 'booked' ? 'Agendado' : 'Cancelado'}
                          </Badge>
                        </td>
                        <td>
                          {row.status === 'booked' &&
                            (pending === row.id ? (
                              <>
                                <span>Confirmar cancelamento?</span>{' '}
                                <button
                                  className="table-action"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(async () => {
                                      await apiRequest(`/v1/appointments/${row.id}/cancel`, 'POST');
                                      setPending('');
                                      await refresh();
                                    })
                                  }
                                >
                                  Confirmar cancelamento
                                </button>{' '}
                                <button className="table-action" onClick={() => setPending('')}>
                                  Manter
                                </button>
                              </>
                            ) : (
                              <button className="table-action" onClick={() => setPending(row.id)}>
                                Cancelar reserva
                              </button>
                            ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nenhuma reserva compartilhada para esse filtro.</Empty>
          )}
        </>
      )}
    </Panel>
  );
}

export function AppointmentSummary({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<SharedAppointment[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
        if (mounted) {
          setRows(result.appointments.filter((a) => a.status === 'booked'));
          setError('');
        }
      } catch {
        if (mounted) setError('Não foi possível atualizar os agendamentos.');
      }
    };
    void update();
    const stop = watchAppointments(() => void update());
    const timer = window.setInterval(() => void update(), 5000);
    return () => {
      mounted = false;
      stop();
      window.clearInterval(timer);
    };
  }, []);
  return (
    <Panel title="Solicitações de pré-triagem" aside={`${rows.length} agendamento(s)`}>
      <FormError message={error} />
      {rows.length ? (
        <p>
          {rows[0]!.donorName} · {formatDate(rows[0]!.date)} · {rows[0]!.time}
        </p>
      ) : (
        <p>Nenhuma solicitação ativa no momento.</p>
      )}
      <button className="button primary" onClick={onOpen}>
        Ver agendamentos recebidos
      </button>
    </Panel>
  );
}
