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
  const generation = useRef(0);
  function signOut() {
    generation.current++;
    setSession(null);
    setAppointments([]);
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
      if (current === generation.current) setAppointments(result.appointments);
    } catch (error) {
      if (current === generation.current && error instanceof ApiError && error.status === 401)
        signOut();
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
        authenticate,
        signOut,
        refresh,
        setAppointments,
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
  const { root, unitId, selectUnit } = useApp();
  const { session, appointments } = shared;
  const [units, setUnits] = useState<SharedUnit[]>([]);
  const [slots, setSlots] = useState<SharedSlot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const attempt = useRef({ slot: '', id: requestId() });
  const generation = useRef(0);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) shared.signOut();
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    if (!session) return;
    const current = ++generation.current;
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
  }
  useEffect(() => {
    setSlots([]);
    setSlotId('');
    setSelectedDate('');
    setPending('');
    if (!session) return;
    setBusy(true);
    void load()
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) shared.signOut();
        else setError(e instanceof Error ? e.message : 'Falha ao carregar.');
      })
      .finally(() => setBusy(false));
    return () => {
      generation.current++;
    };
  }, [session?.token, unitId]);
  const selected = slots.find((slot) => slot.id === slotId);
  if (!session) return null;
  return (
    <>
      <Title
        subtitle={
          mode === 'booking'
            ? 'Escolha quando ir ao hemocentro para realizar a pré-triagem presencial.'
            : 'Acompanhe as visitas solicitadas ao hemocentro.'
        }
      >
        {mode === 'booking' ? 'Agendar pré-triagem' : 'Meus agendamentos'}
      </Title>
      <ErrorText message={error} />
      {message && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {message}
        </Text>
      )}
      {mode === 'booking' && (
        <>
          <Notice>
            As perguntas e a avaliação serão feitas pela equipe no hemocentro. Você não precisa
            responder a uma pré-triagem digital para agendar.
          </Notice>
          <Text style={s.sectionTitle}>Escolha o hemocentro</Text>
          <View style={s.choices}>
            {units.map((unit) => (
              <Choice
                key={unit.id}
                title={unit.name}
                selected={unit.id === unitId}
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
                onPress={() => {
                  setSelectedDate(date);
                  setSlotId('');
                }}
              />
            ))}
          </View>
          {!busy && !slots.length && (
            <Notice>
              Não há horários futuros. A equipe precisa disponibilizar novos horários.
            </Notice>
          )}
          {selectedDate && (
            <>
              <Text style={s.sectionTitle}>Escolha o horário</Text>
              <View style={s.choices}>
                {slots
                  .filter((slot) => slot.date === selectedDate)
                  .map((slot) => (
                    <Choice
                      key={slot.id}
                      title={`${slot.time} · ${slot.available} vaga(s)`}
                      selected={slot.id === slotId}
                      onPress={() => setSlotId(slot.id)}
                    />
                  ))}
              </View>
            </>
          )}
          {selected && (
            <Card pink>
              <Label>CONFIRA SEU AGENDAMENTO</Label>
              <Text style={s.cardTitle}>
                {dateLabel(selected.date)} · {selected.time}
              </Text>
              <Body>{units.find((unit) => unit.id === unitId)?.name}</Body>
              <Body>{session.user.name}</Body>
              <Button
                title="Confirmar agendamento"
                disabled={selected.available < 1}
                busy={busy}
                onPress={() =>
                  void action(async () => {
                    if (attempt.current.slot !== selected.id)
                      attempt.current = { slot: selected.id, id: requestId() };
                    await sharedRequest(session.url, '/v1/appointments', session.token, 'POST', {
                      slotId: selected.id,
                      requestId: attempt.current.id,
                    });
                    setMessage(
                      'Agendamento realizado! Sua solicitação já está na agenda do hemocentro.',
                    );
                    await load();
                    setSlotId('');
                    attempt.current = { slot: '', id: requestId() };
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
          <Button title="Agendar pré-triagem" onPress={() => root('home')} secondary />
          {!appointments.length && (
            <Notice>
              Você ainda não tem agendamentos. Faça sua solicitação pela página inicial.
            </Notice>
          )}
          {appointments.map((appointment) => (
            <Card key={appointment.id}>
              <Label>
                {appointment.status === 'booked'
                  ? 'AGENDADO · PRÉ-TRIAGEM PRESENCIAL'
                  : 'CANCELADO'}
              </Label>
              <Text style={s.cardTitle}>
                {dateLabel(appointment.date)} · {appointment.time}
              </Text>
              <Body>{appointment.unitName}</Body>
              {appointment.status === 'booked' &&
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
                          await load();
                          setPending('');
                          setMessage('Agendamento cancelado.');
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
