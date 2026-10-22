import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import logo from './assets/vitalis-logo.png';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { Badge, Dialog, Empty, FormError, Notice, Panel, Stat } from './components/ui';
import { addMovement, bloodTypes, createDemo, getStock, restoreDemo } from './prototype/model';
import type {
  BloodType,
  Movement,
  MovementKind,
  PrototypeData,
  StockStatus,
} from './prototype/model';
import {
  administrator,
  createOfficeDemo,
  formatDate,
  localDate,
  normalize,
  registerDonation,
  restoreOffice,
  saveCampaign,
  saveDonor,
} from './prototype/office';
import type { Campaign, OfficeData, UnitSettings } from './prototype/office';
import {
  AgendaView,
  DonationForm,
  DonationsView,
  DonorForm,
  DonorsView,
  ProfileView,
  ScreeningView,
} from './views/DonorViews';
import { CampaignForm, CampaignReview, CampaignsView, emptyCampaign } from './views/CampaignViews';
import { MovementView } from './views/MovementView';
import { SharedAgendaView, AppointmentSummary } from './views/SharedAgendaView';
import { getAgendaSession, loginAgenda, logoutAgenda } from './prototype/sharedApi';
import { MobilePublication } from './components/MobilePublication';

type View =
  | 'overview'
  | 'stock'
  | 'movements'
  | 'movement-form'
  | 'movement-done'
  | 'donors'
  | 'donor-profile'
  | 'donor-form'
  | 'donations'
  | 'donation-form'
  | 'appointments'
  | 'screening'
  | 'alerts'
  | 'alert-form'
  | 'alert-review'
  | 'alert-done'
  | 'settings';
const navigation: Array<{ view: View; title: string; icon: IconName }> = [
  { view: 'overview', title: 'Visão geral', icon: 'grid' },
  { view: 'stock', title: 'Estoque de sangue', icon: 'drop' },
  { view: 'movements', title: 'Movimentações', icon: 'arrows' },
  { view: 'donors', title: 'Doadores', icon: 'users' },
  { view: 'donations', title: 'Doações', icon: 'heart' },
  { view: 'appointments', title: 'Agendamentos', icon: 'calendar' },
  { view: 'alerts', title: 'Alertas', icon: 'bell' },
];
const titles: Record<View, [string, string]> = {
  overview: [
    'Uma visão para cuidar melhor.',
    'Acompanhe a operação e priorize o que precisa da sua atenção.',
  ],
  stock: ['Estoque de sangue', 'Disponibilidade da unidade, organizada por tipo sanguíneo.'],
  movements: ['Movimentações de bolsas', 'Rastreie as entradas e saídas registradas pela equipe.'],
  'movement-form': [
    'Registrar movimentação',
    'Informe os dados para manter a rastreabilidade do estoque.',
  ],
  'movement-done': ['Movimentação registrada', 'O fluxo de registro foi concluído no protótipo.'],
  donors: [
    'Quem mantém essa conexão viva.',
    'Consulte os perfis e acompanhe a jornada dos doadores.',
  ],
  'donor-profile': [
    'Perfil do doador',
    'Informações para acompanhar o atendimento e a comunicação.',
  ],
  'donor-form': ['Cadastro do doador', 'Organize as informações necessárias ao atendimento.'],
  donations: [
    'Doações que fazem a diferença.',
    'Consulte os registros vinculados aos doadores da unidade.',
  ],
  'donation-form': ['Registrar doação', 'Toda doação deve estar vinculada a um doador cadastrado.'],
  appointments: ['Agenda da unidade', 'Organize os horários e acompanhe as etapas de atendimento.'],
  screening: [
    'Pré-triagem do doador',
    'Respostas de apoio à preparação do atendimento presencial.',
  ],
  alerts: ['Comunicação que mobiliza.', 'Acompanhe os alertas de escassez da unidade.'],
  'alert-form': [
    'Preparar alerta de escassez',
    'Transforme a necessidade da unidade em uma comunicação direcionada.',
  ],
  'alert-review': ['Confira antes de mobilizar.', 'Revise o público e o conteúdo da comunicação.'],
  'alert-done': ['Uma conexão iniciada.', 'O fluxo de comunicação foi concluído no protótipo.'],
  settings: ['Configurações da unidade', 'Dados institucionais, conta e preferências da operação.'],
};
const statusNames: Record<StockStatus, string> = {
  adequado: 'Estável',
  baixo: 'Baixo',
  critico: 'Crítico',
};
const statusTone = { adequado: 'good', baixo: 'low', critico: 'critical' } as const;
const stockKey = 'vitalis.desktop.demo.v1';
const officeKey = 'vitalis.desktop.office.v1';
const accountInitials = () =>
  (getAgendaSession()?.user.name ?? administrator)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function loadLocal<T>(key: string, restore: (raw: string) => T, create: () => T) {
  try {
    const raw = localStorage.getItem(key);
    return { data: raw ? restore(raw) : create(), notice: '' };
  } catch {
    return {
      data: create(),
      notice:
        'Não foi possível recuperar parte da demonstração anterior. Os dados de exemplo dessa parte foram restaurados.',
    };
  }
}
function currentSection(view: View): View {
  if (view.startsWith('movement-')) return 'movements';
  if (view.startsWith('donor-')) return 'donors';
  if (view === 'donation-form') return 'donations';
  if (view === 'screening') return 'appointments';
  if (view.startsWith('alert-')) return 'alerts';
  return view;
}
function Login({ onEnter }: { onEnter: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-brand-panel">
        <img src={logo} alt="Vitalis" className="login-logo" />
        <div className="login-brand-copy">
          <h1>
            Gestão que aproxima.
            <br />
            Cuidado que
            <br />
            transforma.
          </h1>
          <p>
            Doadores, estoques e comunicação
            <br />
            conectados em um só lugar.
          </p>
        </div>
        <small>VITALIS / HEMOCENTROS</small>
      </section>
      <section className="login-form-panel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError('');
            void loginAgenda(String(form.get('email') ?? ''), String(form.get('password') ?? ''))
              .then(() => onEnter())
              .catch((cause) =>
                setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'),
              )
              .finally(() => setBusy(false));
          }}
        >
          <span className="area-label">ÁREA ADMINISTRATIVA</span>
          <h2>
            Cuidar de vidas
            <br />
            começa com uma conexão.
          </h2>
          <p>Acesse a gestão da sua unidade de coleta.</p>
          <label>
            E-mail institucional
            <input
              type="email"
              name="email"
              defaultValue="hemocentro@vitalis.demo"
              autoComplete="off"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              name="password"
              defaultValue="VitalisDemo2026!"
              autoComplete="off"
              required
            />
          </label>
          <FormError message={error} />
          <button className="button primary full" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar no hemocentro'}
          </button>
          <Notice>
            Acesso predefinido do hemocentro fictício: hemocentro@vitalis.demo · VitalisDemo2026!
            Use somente dados de teste. O acesso é validado pela API.
          </Notice>
        </form>
      </section>
    </main>
  );
}
function MovementTable({
  rows,
  all,
  compact = false,
}: {
  rows: Movement[];
  all: Movement[];
  compact?: boolean;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Histórico de movimentações de exemplo</caption>
        <thead>
          <tr>
            <th>Registro</th>
            <th>Data / hora</th>
            <th>Tipo</th>
            <th>Sangue</th>
            <th>Quantidade</th>
            <th>Responsável</th>
            {!compact && <th>Origem / destino</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>MOV-{String(261 + all.findIndex((m) => m.id === row.id)).padStart(4, '0')}</td>
              <td>
                {new Date(row.createdAt)
                  .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  .replace('.', '')}{' '}
                ·{' '}
                {new Date(row.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td>{row.kind === 'entrada' ? 'Entrada' : 'Saída'}</td>
              <td>{row.bloodType}</td>
              <td>{row.quantity} bolsas</td>
              <td>{row.responsible}</td>
              {!compact && <td title={row.note}>{row.location || row.reason}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function Success({
  title,
  description,
  detail,
  children,
}: {
  title: string;
  description: string;
  detail: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="success-panel">
      <h2>{title}</h2>
      <span className="success-icon">
        <Icon name="check" size={30} />
      </span>
      <h3>{description}</h3>
      <p>{detail}</p>
      <Notice>
        Estado demonstrativo: nenhuma base real foi alterada e nenhuma mensagem real foi enviada.
      </Notice>
      <div className="form-actions">{children}</div>
    </Panel>
  );
}
function Settings({
  settings,
  onSave,
  onLogout,
  onReset,
}: {
  settings: UnitSettings;
  onSave: (value: UnitSettings) => void;
  onLogout: () => void;
  onReset: () => void;
}) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = Object.fromEntries(
      ['name', 'city', 'phone', 'email', 'region'].map((key) => [
        key,
        String(form.get(key) ?? '').trim(),
      ]),
    ) as unknown as UnitSettings;
    if (!next.name || !next.city || !next.email || !next.region) {
      setError('Preencha os dados obrigatórios da unidade.');
      return;
    }
    onSave(next);
  }
  return (
    <div className="split-layout">
      <Panel title="Unidade de coleta">
        <form className="data-form" onSubmit={submit}>
          <label>
            Nome da unidade
            <input name="name" defaultValue={settings.name} maxLength={80} required />
          </label>
          <div className="form-row">
            <label>
              Cidade / UF
              <input name="city" defaultValue={settings.city} maxLength={100} required />
            </label>
            <label>
              Contato institucional
              <input name="phone" defaultValue={settings.phone} maxLength={25} />
            </label>
          </div>
          <label>
            E-mail institucional
            <input
              name="email"
              type="email"
              defaultValue={settings.email}
              maxLength={120}
              required
            />
          </label>
          <label>
            Região dos alertas
            <input name="region" defaultValue={settings.region} maxLength={100} required />
          </label>
          <FormError message={error} />
          <button className="button primary" type="submit">
            Salvar configurações
          </button>
        </form>
      </Panel>
      <Panel title="Conta administrativa" className="summary-panel">
        <span className="large-avatar">{accountInitials()}</span>
        <h3>{getAgendaSession()?.user.name ?? administrator}</h3>
        <p>Equipe administrativa da unidade</p>
        <hr />
        <Badge>Acesso autenticado</Badge>
        <p className="small">
          Dados pessoais e de saúde devem ser acessados apenas pela equipe autorizada. Utilize
          somente dados fictícios neste protótipo.
        </p>
        <button className="button secondary full" onClick={onLogout}>
          Sair da conta
        </button>
        <button className="text-link reset-button" onClick={onReset}>
          <Icon name="reset" size={15} />
          Restaurar demonstração
        </button>
      </Panel>
    </div>
  );
}

export default function App() {
  const [initialStock] = useState(() => loadLocal(stockKey, restoreDemo, createDemo));
  const [initialOffice] = useState(() => loadLocal(officeKey, restoreOffice, createOfficeDemo));
  const [data, setData] = useState<PrototypeData>(initialStock.data);
  const [office, setOffice] = useState<OfficeData>(initialOffice.data);
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getAgendaSession()));
  const [view, setView] = useState<View>('overview');
  const [selectedDonor, setSelectedDonor] = useState<string | undefined>();
  const [movementType, setMovementType] = useState<BloodType>('O+');
  const [movementKind, setMovementKind] = useState<MovementKind>('entrada');
  const [lastMovement, setLastMovement] = useState<Movement | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialStock.notice || initialOffice.notice);
  const [bloodFilter, setBloodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(stockKey, JSON.stringify(data));
      localStorage.setItem(officeKey, JSON.stringify(office));
      setError('');
    } catch {
      setError(
        'O armazenamento local está indisponível. As alterações durarão apenas nesta sessão.',
      );
    }
  }, [data, office]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(next: View) {
    setView(next);
    setBloodFilter('all');
    setStatusFilter('all');
    setKindFilter('all');
    setQuery('');
    window.scrollTo(0, 0);
  }
  function showDonor(id: string) {
    setSelectedDonor(id);
    navigate('donor-profile');
  }
  function showScreening(id: string) {
    setSelectedDonor(id);
    navigate('screening');
  }
  function newMovement(type: BloodType = 'O+', kind: MovementKind = 'entrada') {
    setMovementType(type);
    setMovementKind(kind);
    navigate('movement-form');
  }
  function newCampaign(type: BloodType = 'O-') {
    setCampaign(emptyCampaign(type, office.settings.region));
    navigate('alert-form');
  }
  function enter() {
    setLoggedIn(true);
  }
  function logout() {
    logoutAgenda();
    setLoggedIn(false);
    navigate('overview');
  }
  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => {
      if (!getAgendaSession()) {
        setLoggedIn(false);
        setView('overview');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loggedIn]);
  const stock = getStock(data);
  const total = stock.reduce((sum, item) => sum + item.quantity, 0);
  const critical = stock.filter((item) => item.status === 'critico');
  const low = stock.filter((item) => item.status === 'baixo');
  const focusType = critical[0]?.bloodType ?? 'O-';
  const person = office.donors.find((d) => d.id === selectedDonor);
  const upcoming = office.appointments
    .filter((a) => a.date >= localDate() && a.status === 'Agendado')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const appointment = upcoming[0];
  const appointmentDonor = office.donors.find((d) => d.id === appointment?.donorId);
  const sortedMovements = [...data.movements].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const filteredMovements = sortedMovements.filter(
    (m) =>
      (bloodFilter === 'all' || bloodFilter === m.bloodType) &&
      (kindFilter === 'all' || kindFilter === m.kind) &&
      normalize(`${m.responsible} ${m.reason} ${m.note} ${m.location ?? ''}`).includes(
        normalize(query),
      ),
  );
  const filteredStock = stock.filter(
    (item) =>
      (bloodFilter === 'all' || bloodFilter === item.bloodType) &&
      (statusFilter === 'all' || statusFilter === item.status),
  );
  const [title, subtitle] = titles[view];
  let action: ReactNode = null;
  if (view === 'stock' || view === 'movements')
    action = (
      <button className="button primary" onClick={() => newMovement()}>
        {view === 'stock' ? 'Registrar movimentação' : 'Nova movimentação'}
      </button>
    );
  if (view === 'donors')
    action = (
      <button
        className="button primary"
        onClick={() => {
          setSelectedDonor(undefined);
          navigate('donor-form');
        }}
      >
        Cadastrar doador
      </button>
    );
  if (view === 'donations')
    action = (
      <button
        className="button primary"
        onClick={() => {
          setSelectedDonor(undefined);
          navigate('donation-form');
        }}
      >
        Registrar doação
      </button>
    );
  if (view === 'alerts')
    action = (
      <button className="button primary" onClick={() => newCampaign()}>
        Criar alerta
      </button>
    );
  const bloodSelect = (
    <select
      aria-label="Filtrar por tipo sanguíneo"
      value={bloodFilter}
      onChange={(e) => setBloodFilter(e.target.value)}
    >
      <option value="all">Todos os tipos</option>
      {bloodTypes.map((type) => (
        <option key={type}>{type}</option>
      ))}
    </select>
  );

  if (!loggedIn) return <Login onEnter={enter} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="Vitalis, visão geral"
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
        >
          <img src={logo} alt="Vitalis" />
        </a>
        <div className="workspace-label">GESTÃO DO HEMOCENTRO</div>
        <nav aria-label="Navegação principal">
          {navigation.map((item) => (
            <button
              className={`nav-item ${currentSection(view) === item.view ? 'active' : ''}`}
              aria-current={currentSection(view) === item.view ? 'page' : undefined}
              key={item.view}
              onClick={() => navigate(item.view)}
            >
              <Icon name={item.icon} size={19} />
              {item.title}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" size={19} />
            Configurações
          </button>
          <div className="sidebar-profile">
            <span className="avatar">{accountInitials()}</span>
            <div>
              <strong>{getAgendaSession()?.user.name ?? administrator}</strong>
              <span>Equipe administrativa</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="unit-label">UNIDADE {office.settings.name.toUpperCase()}</span>
            <p>
              {office.settings.city} / {title}
            </p>
          </div>
          <div className="topbar-right">
            <Badge>Dados de exemplo</Badge>
            <button
              className="icon-button"
              aria-label="Abrir alertas"
              onClick={() => navigate('alerts')}
            >
              <Icon name="bell" />
            </button>
            <button
              className="avatar"
              aria-label="Abrir configurações da conta"
              onClick={() => navigate('settings')}
            >
              {accountInitials()}
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          <div className="page-heading">
            <div>
              <h1>
                {view === 'movement-done' && lastMovement?.kind === 'saida'
                  ? 'Saída registrada'
                  : title}
              </h1>
              <p>{subtitle}</p>
            </div>
            {action}
          </div>
          {(notice || error) && (
            <div className="recovery-notice">
              <Notice warning>{error || notice}</Notice>
              {!error && (
                <button
                  className="icon-button"
                  onClick={() => setNotice('')}
                  aria-label="Dispensar aviso"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          )}

          {view === 'overview' && (
            <>
              <AppointmentSummary onOpen={() => navigate('appointments')} />
              <div className="stats-grid">
                <Stat label="Bolsas disponíveis" value={total} detail="Em oito tipos sanguíneos" />
                <Stat
                  label="Doações hoje"
                  value={office.donations.filter((d) => d.date === localDate()).length}
                  detail="Registros confirmados pela unidade"
                />
                <Stat
                  label="Agendamentos do dia"
                  value={office.appointments.filter((a) => a.date === localDate()).length}
                  detail={`${upcoming.filter((a) => a.date === localDate()).length} atendimentos ainda previstos`}
                />
                <Stat
                  label="Doadores cadastrados"
                  value={office.donors.length.toLocaleString('pt-BR')}
                  detail={`Base da unidade ${office.settings.name}`}
                />
              </div>
              <div className="dashboard-highlights">
                <section className="highlight-card">
                  <h2>
                    {critical.length
                      ? `A região precisa de ${focusType}`
                      : 'Cada doação mantém essa conexão.'}
                  </h2>
                  <div className="highlight-meta">
                    <span>{critical.length ? 'ESTOQUE CRÍTICO' : 'ACOMPANHAMENTO DO ESTOQUE'}</span>
                    <span>
                      {stock.find((s) => s.bloodType === focusType)!.quantity} bolsas disponíveis
                    </span>
                  </div>
                  <p>Mobilize os doadores da região com um alerta direcionado.</p>
                  <button className="button primary" onClick={() => newCampaign(focusType)}>
                    Preparar alerta
                  </button>
                </section>
                <section className="appointment-card">
                  <h2>Seu próximo atendimento</h2>
                  {appointment && appointmentDonor ? (
                    <>
                      <h3>
                        {appointment.time} · {appointmentDonor.name}
                      </h3>
                      <p>
                        {appointmentDonor.bloodType} / Pré-triagem{' '}
                        {appointmentDonor.screening ? 'respondida' : 'pendente'} /{' '}
                        {appointment.status}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>Uma nova conexão vem aí.</h3>
                      <p>Nenhum atendimento pendente na demonstração.</p>
                    </>
                  )}
                  <button className="button secondary" onClick={() => navigate('appointments')}>
                    Abrir agenda do dia
                  </button>
                </section>
              </div>
              <Panel title="Movimentações recentes" aside="Últimos registros">
                <MovementTable rows={sortedMovements.slice(0, 3)} all={data.movements} compact />
                <div className="panel-actions">
                  <button className="button secondary" onClick={() => navigate('movements')}>
                    Ver movimentações
                  </button>
                </div>
              </Panel>
            </>
          )}
          {view === 'stock' && (
            <>
              <div className="stats-grid three">
                <Stat label="Disponíveis" value={total} detail="Bolsas registradas na unidade" />
                <Stat
                  label="Nível crítico"
                  value={`${critical.length} ${critical.length === 1 ? 'tipo' : 'tipos'}`}
                  detail={
                    critical.length
                      ? `${critical.map((s) => s.bloodType).join(', ')} requer atenção`
                      : 'Todos os tipos acima da faixa crítica'
                  }
                />
                <Stat
                  label="Estoque baixo"
                  value={`${low.length} ${low.length === 1 ? 'tipo' : 'tipos'}`}
                  detail={
                    low.length
                      ? `${low.map((s) => s.bloodType).join(', ')} em atenção`
                      : 'Sem tipos nessa faixa'
                  }
                />
              </div>
              <Panel
                title="Posição atual"
                aside={`Atualização · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              >
                <div className="inline-filters">
                  {bloodSelect}
                  <select
                    aria-label="Filtrar por nível de estoque"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos os níveis</option>
                    <option value="adequado">Estável</option>
                    <option value="baixo">Baixo</option>
                    <option value="critico">Crítico</option>
                  </select>
                </div>
                {filteredStock.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo sanguíneo</th>
                          <th>Bolsas</th>
                          <th>Situação</th>
                          <th>Acompanhamento</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStock.map((item) => (
                          <tr key={item.bloodType}>
                            <td>{item.bloodType}</td>
                            <td>{item.quantity}</td>
                            <td>
                              <Badge tone={statusTone[item.status]}>
                                {statusNames[item.status]}
                              </Badge>
                            </td>
                            <td>
                              {item.status === 'critico'
                                ? 'Priorizar mobilização'
                                : item.status === 'baixo'
                                  ? 'Acompanhar reposição'
                                  : 'Estoque acompanhado'}
                            </td>
                            <td>
                              <button
                                className="table-action"
                                onClick={() => newMovement(item.bloodType)}
                              >
                                Movimentar
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
                <Notice warning>Os níveis e as quantidades desta tela são ilustrativos.</Notice>
              </Panel>
            </>
          )}
          {view === 'movements' && (
            <>
              <div className="filters movement-filters">
                <label>
                  Movimentação
                  <select
                    aria-label="Filtrar por movimentação"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                  >
                    <option value="all">Todas as movimentações</option>
                    <option value="entrada">Entradas</option>
                    <option value="saida">Saídas</option>
                  </select>
                </label>
                <label>Tipo sanguíneo{bloodSelect}</label>
                <label>
                  Buscar no histórico
                  <input
                    aria-label="Buscar movimentações"
                    placeholder="Responsável, origem ou observação"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <Panel
                title="Histórico de movimentações"
                aside={`${filteredMovements.length} registros de exemplo`}
              >
                <MovementTable rows={filteredMovements} all={data.movements} />
              </Panel>
              <div className="section-gap">
                <Notice>
                  Cada movimentação identifica a quantidade, o tipo sanguíneo e o responsável pelo
                  registro.
                </Notice>
              </div>
            </>
          )}
          {view === 'movement-form' && (
            <MovementView
              key={`${movementType}-${movementKind}`}
              initialType={movementType}
              initialKind={movementKind}
              stock={stock}
              unit={`${office.settings.name} — ${office.settings.city}`}
              onCancel={() => navigate('movements')}
              onSave={(movement) => {
                setData(addMovement(data, movement));
                setLastMovement(movement);
                navigate('movement-done');
              }}
            />
          )}
          {view === 'movement-done' && lastMovement && (
            <Success
              title={
                lastMovement.kind === 'entrada' ? 'Tudo certo por aqui.' : 'Movimentação concluída.'
              }
              description={`${lastMovement.kind === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso.`}
              detail={
                <>
                  {lastMovement.bloodType} · {lastMovement.quantity} bolsas
                  <br />
                  {formatDate(lastMovement.createdAt.slice(0, 10))} · {lastMovement.responsible}
                </>
              }
            >
              <button className="button primary" onClick={() => navigate('movements')}>
                Ver movimentações
              </button>
              <button className="button secondary" onClick={() => navigate('stock')}>
                Consultar estoque
              </button>
            </Success>
          )}
          {view === 'donors' && <DonorsView data={office} onProfile={showDonor} />}
          {view === 'donor-profile' && person && (
            <ProfileView
              data={office}
              donor={person}
              onEdit={() => navigate('donor-form')}
              onDonation={() => navigate('donation-form')}
              onScreening={() => showScreening(person.id)}
            />
          )}
          {view === 'donor-form' && (
            <DonorForm
              donor={person}
              onCancel={() => navigate('donors')}
              onSave={(donor) => {
                setOffice(saveDonor(office, donor));
                setSelectedDonor(donor.id);
                navigate('donor-profile');
                setToast('Cadastro salvo na demonstração.');
              }}
            />
          )}
          {view === 'donations' && <DonationsView data={office} />}
          {view === 'donation-form' && (
            <DonationForm
              data={office}
              donorId={selectedDonor}
              onCancel={() => navigate('donations')}
              onProfile={showDonor}
              onSave={(donation) => {
                setOffice(registerDonation(office, donation));
                navigate('donations');
                setToast('Doação registrada. A entrada de bolsas é realizada separadamente.');
              }}
            />
          )}
          {view === 'appointments' && (
            <>
              <SharedAgendaView />
              <details className="section-gap">
                <summary>Agenda local anterior · dados de exemplo</summary>
                <AgendaView data={office} onProfile={showDonor} onScreening={showScreening} />
              </details>
            </>
          )}
          {view === 'screening' && person && (
            <ScreeningView
              donor={person}
              onBack={() => navigate('appointments')}
              onProfile={() => showDonor(person.id)}
            />
          )}
          {view === 'alerts' && (
            <CampaignsView
              data={office}
              onOpen={(value) => {
                setCampaign(value);
                navigate('alert-review');
              }}
            />
          )}
          {view === 'alert-form' && campaign && (
            <CampaignForm
              key={campaign.id}
              data={office}
              initial={campaign}
              onCancel={() => navigate('alerts')}
              onReview={(value) => {
                const next = saveCampaign(office, { ...value, status: 'draft' });
                setOffice(next);
                setCampaign(next.campaigns.find((c) => c.id === value.id)!);
                navigate('alert-review');
              }}
            />
          )}
          {view === 'alert-review' && campaign && (
            <CampaignReview
              data={office}
              campaign={campaign}
              onEdit={() => navigate('alert-form')}
              onBack={() => navigate('alerts')}
              onConfirm={() => {
                const next = saveCampaign(office, { ...campaign, status: 'sent' });
                setOffice(next);
                setCampaign(next.campaigns.find((c) => c.id === campaign.id)!);
                navigate('alert-done');
              }}
            />
          )}
          {view === 'alert-done' && campaign && (
            <Success
              title="Alerta preparado para mobilizar."
              description="Envio simulado concluído."
              detail={
                <>
                  {campaign.bloodType} / {campaign.recipientIds.length} destinatários
                  <br />
                  {campaign.channels.join(' e ')} / {campaign.region}
                </>
              }
            >
              <MobilePublication campaign={campaign} settings={office.settings} />
              <button className="button primary" onClick={() => navigate('alerts')}>
                Voltar aos alertas
              </button>
            </Success>
          )}
          {view === 'settings' && (
            <Settings
              settings={office.settings}
              onSave={(settings) => {
                setOffice({ ...office, settings });
                setToast('Configurações salvas neste dispositivo.');
              }}
              onLogout={logout}
              onReset={() => setResetOpen(true)}
            />
          )}
          <footer className="page-footer">
            VITALIS / Dados demonstrativos para apresentação do protótipo.
          </footer>
        </main>
      </div>
      {resetOpen && (
        <Dialog title="Restaurar a demonstração?" onClose={() => setResetOpen(false)}>
          <p>
            As movimentações, cadastros, doações, alertas e configurações adicionados neste
            protótipo serão substituídos pelos dados fictícios iniciais.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setResetOpen(false)}>
              Cancelar
            </button>
            <button
              className="button primary"
              onClick={() => {
                setData(createDemo());
                setOffice(createOfficeDemo());
                setResetOpen(false);
                navigate('overview');
                setToast('Dados de exemplo restaurados.');
              }}
            >
              Restaurar dados de exemplo
            </button>
          </div>
        </Dialog>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <Icon name="check" size={18} />
            {toast}
            <button
              className="icon-button"
              aria-label="Fechar confirmação"
              onClick={() => setToast('')}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
