import { useEffect, useRef, useState } from 'react';
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
  const [loaded, setLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState('');
  const [date, setDate] = useState('');
  const updates = useRef(0);
  const actionLock = useRef(false);
  async function refresh() {
    const current = ++updates.current;
    const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
    if (!Array.isArray(result.appointments)) throw new Error('Resposta inválida da agenda.');
    if (current === updates.current) {
      setRows(result.appointments);
      setLoaded(true);
      setError('');
    }
  }
  async function action(work: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError('');
    setConfirmation('');
    try {
      await work();
    } catch (e) {
      if (!getAgendaSession()) {
        setSession(null);
        setRows([]);
      }
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const update = async () => {
      const current = ++updates.current;
      try {
        const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
        if (mounted && current === updates.current && Array.isArray(result.appointments)) {
          setRows(result.appointments);
          setLoaded(true);
          setError('');
        }
      } catch (e) {
        if (mounted && current === updates.current) {
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
      updates.current++;
      stop();
      window.clearInterval(timer);
      window.clearTimeout(expiry);
    };
  }, [session]);
  return (
    <Panel
      title="Agendamentos de doação"
      aside={session ? 'Solicitações recebidas pelo aplicativo' : 'Acesso necessário'}
    >
      <FormError message={error} />
      {confirmation && <Notice>{confirmation}</Notice>}
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
              {busy ? 'Atualizando…' : 'Atualizar agendamentos'}
            </button>
          </div>
          {!loaded && !error && <Notice>Carregando agendamentos…</Notice>}
          {rows.filter((row) => !date || row.date === date).length ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de registros, role para ver todas as colunas">
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
                            {row.status === 'cancelled'
                              ? 'Cancelado'
                              : row.canCancel
                                ? 'Agendado'
                                : 'Data encerrada'}
                          </Badge>
                        </td>
                        <td>
                          {row.canCancel &&
                            (pending === row.id ? (
                              <>
                                <span>Confirmar cancelamento?</span>{' '}
                                <button
                                  className="table-action"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(async () => {
                                      await apiRequest(`/v1/appointments/${row.id}/cancel`, 'POST');
                                      updates.current++;
                                      setRows((current) =>
                                        current.map((a) =>
                                          a.id === row.id
                                            ? { ...a, status: 'cancelled', canCancel: false }
                                            : a,
                                        ),
                                      );
                                      setPending('');
                                      setConfirmation(
                                        'Cancelamento confirmado. A vaga foi liberada.',
                                      );
                                      await refresh().catch(() =>
                                        setError(
                                          'O cancelamento foi confirmado, mas a lista não pôde ser atualizada. Tente atualizar a agenda.',
                                        ),
                                      );
                                    })
                                  }
                                >
                                  Confirmar cancelamento
                                </button>{' '}
                                <button disabled={busy} className="table-action" onClick={() => setPending('')}>
                                  Manter
                                </button>
                              </>
                            ) : (
                              <button disabled={busy} className="table-action" onClick={() => setPending(row.id)}>
                                Cancelar reserva
                              </button>
                            ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : loaded && !error ? (
            <Empty>Nenhuma reserva compartilhada para esse filtro.</Empty>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export function AppointmentSummary({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<SharedAppointment[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const result = await apiRequest<{ appointments: SharedAppointment[] }>('/v1/appointments');
        if (mounted) {
          setRows(
            result.appointments
              .filter((a) => a.canCancel)
              .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
          );
          setError('');
          setLoaded(true);
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
    <Panel className="appointment-summary" title="Solicitações de doação" aside={loaded ? `${rows.length} agendamento(s)` : 'Consulta à API'}>
      <FormError message={error} />
      {!loaded && !error && <Notice>Carregando solicitações…</Notice>}
      {rows.length ? (
        <p>
          {rows[0]!.donorName} · {formatDate(rows[0]!.date)} · {rows[0]!.time}
        </p>
      ) : loaded && !error ? (
        <p>Nenhuma solicitação ativa no momento.</p>
      ) : null}
      <button className="button primary" onClick={onOpen}>
        Ver agendamentos recebidos
      </button>
    </Panel>
  );
}
