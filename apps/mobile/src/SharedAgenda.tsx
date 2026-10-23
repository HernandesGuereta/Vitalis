import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Choice,
  ErrorText,
  Field,
  Label,
  Notice,
  Title,
  s,
} from './components/ui';
import { ApiError, requestId, sharedRequest } from './data/sharedApi';
import type { SharedAppointment, SharedSession, SharedSlot, SharedUnit } from './data/sharedApi';
import { dateLabel, validateApiUrl } from './data/model';
import { useApp } from './AppContext';

type SharedState = {
  session: SharedSession | null;
  appointments: SharedAppointment[];
  refreshError: string;
  authenticate: (url: string, email: string, password: string, name?: string) => Promise<void>;
  signOut: () => void;
  setSession: (session: SharedSession | null) => void;
  refresh: () => Promise<void>;
  setAppointments: (appointments: SharedAppointment[]) => void;
};
const Context = createContext<SharedState | null>(null);
export function useSharedAgenda() {
  const value = useContext(Context);
  if (!value) throw new Error('Aplicativo indisponível.');
  return value;
}
export function SharedAgendaProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SharedSession | null>(null);
  const [appointments, setAppointments] = useState<SharedAppointment[]>([]);
  const [refreshError, setRefreshError] = useState('');
  const generation = useRef(0);
  function signOut() {
    generation.current++;
    setSession(null);
    setAppointments([]);
    setRefreshError('');
    if (session)
      void sharedRequest(session.url, '/v1/auth/logout', session.token, 'POST').catch(() => {});
  }
  async function authenticate(address: string, email: string, password: string, name?: string) {
    const url = validateApiUrl(address);
    const result = await sharedRequest<Omit<SharedSession, 'url'>>(
      url,
      name === undefined ? '/v1/auth/login' : '/v1/auth/register',
      undefined,
      'POST',
      {
        email,
        password,
        ...(name === undefined ? {} : { name }),
      },
    );
    if (result.user?.role !== 'donor') {
      await sharedRequest(url, '/v1/auth/logout', result.token, 'POST');
      throw new Error('Este aplicativo é para doadores. Acesse o hemocentro pelo sistema desktop.');
    }
    if (typeof result.token !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)))
      throw new Error('Sessão inválida.');
    generation.current++;
    setAppointments([]);
    setSession({ ...result, url });
  }
  async function refresh() {
    if (!session) return;
    const current = generation.current;
    try {
      const result = await sharedRequest<{ appointments: SharedAppointment[] }>(
        session.url,
        '/v1/appointments',
        session.token,
      );
      if (!Array.isArray(result.appointments)) throw new Error('Resposta inválida da agenda.');
      if (current === generation.current) {
        setAppointments(result.appointments);
        setRefreshError('');
      }
    } catch (error) {
      if (current === generation.current && error instanceof ApiError && error.status === 401)
        signOut();
      else if (current === generation.current)
        setRefreshError(
          'Não foi possível atualizar a agenda. Confira a conexão e tente atualizar novamente.',
        );
      throw error;
    }
  }
  useEffect(() => {
    if (!session) return;
    const expiry = setTimeout(signOut, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    void refresh().catch(() => {});
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh().catch(() => {});
    }, 5000);
    return () => {
      clearTimeout(expiry);
      clearInterval(timer);
    };
  }, [session?.token]);
  return (
    <Context.Provider
      value={{
        session,
        appointments,
        refreshError,
        authenticate,
        signOut,
        refresh,
        setAppointments: (value) => {
          generation.current++;
          setAppointments(value);
          setRefreshError('');
        },
        setSession: (value) => {
          if (session?.token !== value?.token) {
            generation.current++;
            setAppointments([]);
          }
          setSession(value);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function AppointmentScreen({ mode = 'booking' }: { mode?: 'booking' | 'visits' }) {
  const shared = useSharedAgenda();
  const { root, unitId, selectUnit, scrollToTop } = useApp();
  const { session, appointments } = shared;
  const [units, setUnits] = useState<SharedUnit[]>([]);
  const [slots, setSlots] = useState<SharedSlot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  useEffect(() => {
    if (error || message) scrollToTop();
  }, [error, message, scrollToTop]);
  const attempt = useRef({ slot: '', id: requestId() });
  const uncertain = useRef(false);
  const actionLock = useRef(false);
  const loading = useRef(false);
  const generation = useRef(0);
  async function action(work: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) shared.signOut();
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function load() {
    if (!session) return;
    const current = ++generation.current;
    loading.current = true;
    try {
      const [agenda, available, centers] = await Promise.all([
        sharedRequest<{ appointments: SharedAppointment[] }>(
          session.url,
          '/v1/appointments',
          session.token,
        ),
        sharedRequest<{ slots: SharedSlot[] }>(
          session.url,
          `/v1/slots?unitId=${encodeURIComponent(unitId)}`,
          session.token,
        ),
        sharedRequest<{ units: SharedUnit[] }>(session.url, '/v1/units', session.token),
      ]);
      if (current !== generation.current) return;
      if (
        !Array.isArray(agenda.appointments) ||
        !Array.isArray(available.slots) ||
        !Array.isArray(centers.units)
      )
        throw new Error('Resposta inválida da agenda.');
      shared.setAppointments(agenda.appointments);
      setSlots(available.slots);
      setUnits(centers.units);
      setLoaded(true);
      setSyncError('');
      if (
        uncertain.current &&
        agenda.appointments.some((a) => a.slotId === attempt.current.slot && a.status === 'booked')
      ) {
        uncertain.current = false;
        attempt.current = { slot: '', id: requestId() };
        setSlotId('');
        setError('');
        setMessage('Agendamento confirmado! Sua solicitação já está na agenda do hemocentro.');
      }
    } finally {
      if (current === generation.current) loading.current = false;
    }
  }
  useEffect(() => {
    let mounted = true;
    setLoaded(false);
    setSlots([]);
    setSlotId('');
    setSelectedDate('');
    setPending('');
    setError('');
    setSyncError('');
    setMessage('');
    if (!session) return;
    setBusy(true);
    void load()
      .catch((e) => {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 401) shared.signOut();
        else setSyncError(e instanceof Error ? e.message : 'Falha ao carregar.');
      })
      .finally(() => {
        if (mounted && !actionLock.current) setBusy(false);
      });
    const timer = setInterval(() => {
      if (
        mode !== 'booking' ||
        AppState.currentState !== 'active' ||
        actionLock.current ||
        loading.current
      )
        return;
      void load().catch((e) => {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 401) shared.signOut();
        else
          setSyncError('Não foi possível atualizar as vagas. Tente atualizar antes de confirmar.');
      });
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
      generation.current++;
    };
  }, [session?.token, unitId, mode]);
  const selected = slots.find((slot) => slot.id === slotId);
  const existing = appointments.find((a) => a.status === 'booked' && a.date === selectedDate);
  const blockedDay = existing && !(uncertain.current && existing.slotId === attempt.current.slot);
  if (!session) return null;
  return (
    <>
      <Title
        subtitle={
          mode === 'booking'
            ? 'Escolha a unidade e o horário para sua visita de doação.'
            : 'Acompanhe as visitas solicitadas ao hemocentro.'
        }
      >
        {mode === 'booking' ? 'Agendar doação' : 'Meus agendamentos'}
      </Title>
      <ErrorText testID="appointment-error" message={error || syncError || shared.refreshError} />
      {busy && !loaded && <Notice>Carregando horários e agendamentos…</Notice>}
      {message && (
        <Text testID="appointment-feedback" accessibilityLiveRegion="polite" style={s.body}>
          {message}
        </Text>
      )}
      {mode === 'booking' && (
        <>
          <Notice>
            Você pode fazer a pré-triagem no aplicativo antes de sair de casa. Ela é orientativa:
            reservar um horário não confirma aptidão, e a triagem completa continua no hemocentro.
          </Notice>
          <Text style={s.sectionTitle}>Escolha o hemocentro</Text>
          <View style={s.choices}>
            {units.map((unit) => (
              <Choice
                key={unit.id}
                title={unit.name}
                selected={unit.id === unitId}
                disabled={busy}
                onPress={() => selectUnit(unit.id)}
              />
            ))}
          </View>
          <Text style={s.sectionTitle}>Escolha o dia</Text>
          <View style={s.choices}>
            {[...new Set(slots.map((slot) => slot.date))].map((date) => (
              <Choice
                key={date}
                title={dateLabel(date, true)}
                selected={date === selectedDate}
                disabled={busy}
                onPress={() => {
                  setError('');
                  setSelectedDate(date);
                  setSlotId('');
                }}
              />
            ))}
          </View>
          {loaded && !busy && !slots.length && (
            <Notice>
              Não há horários futuros. A equipe precisa disponibilizar novos horários.
            </Notice>
          )}
          {blockedDay && !message && (
            <Notice>
              Você já tem um agendamento nesse dia, na {existing.unitName}, às {existing.time}.
              Consulte sua agenda antes de reservar outro horário.
            </Notice>
          )}
          {blockedDay && !message && (
            <Button secondary title="Ver meus agendamentos" onPress={() => root('donations')} />
          )}
          {selectedDate && !blockedDay && (
            <>
              <Text style={s.sectionTitle}>Escolha o horário</Text>
              <View style={s.choices}>
                {slots
                  .filter((slot) => slot.date === selectedDate)
                  .map((slot) => (
                    <Choice
                      key={slot.id}
                      title={
                        slot.available > 0
                          ? `${slot.time} · ${slot.available} vaga(s)`
                          : `${slot.time} · Esgotado`
                      }
                      selected={slot.id === slotId}
                      disabled={busy || slot.available < 1}
                      onPress={() => {
                        setError('');
                        setSlotId(slot.id);
                      }}
                    />
                  ))}
              </View>
            </>
          )}
          {selected && !blockedDay && (
            <Card pink>
              <Label>CONFIRA SEU AGENDAMENTO</Label>
              <Text style={s.cardTitle}>
                {dateLabel(selected.date)} · {selected.time}
              </Text>
              <Body>{units.find((unit) => unit.id === unitId)?.name}</Body>
              <Body>{session.user.name}</Body>
              <Button
                testID="confirm-appointment"
                title="Confirmar agendamento"
                disabled={selected.available < 1}
                busy={busy}
                onPress={() =>
                  void action(async () => {
                    if (attempt.current.slot !== selected.id)
                      attempt.current = { slot: selected.id, id: requestId() };
                    try {
                      await sharedRequest(session.url, '/v1/appointments', session.token, 'POST', {
                        slotId: selected.id,
                        requestId: attempt.current.id,
                      });
                    } catch (e) {
                      uncertain.current = !(e instanceof ApiError) || e.status >= 500;
                      if (e instanceof ApiError && e.status === 409) await load().catch(() => {});
                      throw e;
                    }
                    // Confirmação da gravação é independente da atualização seguinte da lista.
                    uncertain.current = false;
                    setSlotId('');
                    attempt.current = { slot: '', id: requestId() };
                    setMessage(
                      'Agendamento realizado! Sua solicitação já está na agenda do hemocentro.',
                    );
                    await load().catch(() =>
                      setSyncError(
                        'O agendamento foi confirmado, mas a lista não pôde ser atualizada. Tente atualizar a agenda.',
                      ),
                    );
                  })
                }
              />
              <Body muted>
                Agendamento em unidade fictícia. A aptidão para doar será avaliada presencialmente.
              </Body>
            </Card>
          )}
          {message && <Button title="Ver meus agendamentos" onPress={() => root('donations')} />}
        </>
      )}
      {mode === 'visits' && (
        <>
          <Button title="Agendar doação" onPress={() => root('home')} secondary />
          {loaded && !appointments.length && (
            <Notice>
              Você ainda não tem agendamentos. Faça sua solicitação pela página inicial.
            </Notice>
          )}
          {appointments.map((appointment) => (
            <Card key={appointment.id}>
              <Label>
                {appointment.status === 'cancelled'
                  ? 'CANCELADO'
                  : appointment.canCancel
                    ? 'AGENDADO · VISITA PARA DOAÇÃO'
                    : 'DATA ENCERRADA'}
              </Label>
              <Text style={s.cardTitle}>
                {dateLabel(appointment.date)} · {appointment.time}
              </Text>
              <Body>{appointment.unitName}</Body>
              {appointment.canCancel &&
                (pending === appointment.id ? (
                  <>
                    <Body>Deseja cancelar este agendamento?</Body>
                    <Button
                      title="Confirmar cancelamento"
                      busy={busy}
                      onPress={() =>
                        void action(async () => {
                          await sharedRequest(
                            session.url,
                            `/v1/appointments/${appointment.id}/cancel`,
                            session.token,
                            'POST',
                          );
                          setPending('');
                          setMessage('Agendamento cancelado.');
                          shared.setAppointments(
                            appointments.map((a) =>
                              a.id === appointment.id
                                ? { ...a, status: 'cancelled', canCancel: false }
                                : a,
                            ),
                          );
                          await load().catch(() =>
                            setSyncError(
                              'O cancelamento foi confirmado, mas a lista não pôde ser atualizada. Tente atualizar a agenda.',
                            ),
                          );
                        })
                      }
                    />
                    <Button secondary title="Manter agendamento" onPress={() => setPending('')} />
                  </>
                ) : (
                  <Button
                    secondary
                    title="Cancelar agendamento"
                    onPress={() => setPending(appointment.id)}
                  />
                ))}
            </Card>
          ))}
        </>
      )}
      <Button
        secondary
        title="Atualizar horários e agendamentos"
        busy={busy}
        onPress={() => void action(load)}
      />
    </>
  );
}

export function PrivacyScreen() {
  const shared = useSharedAgenda();
  const { session } = shared;
  const [exported, setExported] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) shared.signOut();
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  if (!session) return null;
  return (
    <>
      <Title subtitle="Consulte seus dados e controle sua conta.">Privacidade</Title>
      <Notice>
        Nome, e-mail e agendamentos são usados para organizar sua visita. CPF, tipo sanguíneo e
        respostas de saúde não são enviados para agendar. Use somente dados fictícios neste
        protótipo.
      </Notice>
      <ErrorText message={error} />
      <Button
        title="Consultar e copiar meus dados"
        busy={busy}
        onPress={() =>
          void action(async () => {
            const result = await sharedRequest(session.url, '/v1/me/export', session.token);
            setExported(JSON.stringify(result, null, 2));
          })
        }
      />
      {exported && (
        <Text selectable style={s.body}>
          {exported}
        </Text>
      )}
      <Card>
        <Text style={s.cardTitle}>Excluir minha conta</Text>
        <Body>
          A exclusão remove seus agendamentos e encerra suas sessões. Para confirmar, escreva
          EXCLUIR.
        </Body>
        <Field
          label="Confirmação de exclusão"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          maxLength={7}
        />
        <Button
          secondary
          title="Excluir minha conta"
          disabled={confirmation !== 'EXCLUIR'}
          busy={busy}
          onPress={() =>
            void action(async () => {
              await sharedRequest(session.url, '/v1/me', session.token, 'DELETE', { confirmation });
              shared.signOut();
            })
          }
        />
      </Card>
    </>
  );
}
