import { useState } from 'react';
import type { FormEvent } from 'react';
import { bloodTypes } from '../prototype/model';
import type { BloodType } from '../prototype/model';
import { channels, formatDate, localDate, normalize } from '../prototype/office';
import type { Channel, Donation, Donor, OfficeData } from '../prototype/office';
import { Badge, Empty, FormError, Notice, Panel, Stat } from '../components/ui';

export function DonorsView({
  data,
  onProfile,
}: {
  data: OfficeData;
  onProfile: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const filtered = data.donors.filter(
    (person) =>
      (type === 'all' || person.bloodType === type) &&
      normalize(`${person.name} ${person.cpf} ${person.city}`).includes(normalize(query)),
  );
  return (
    <>
      <div className="filters donor-filters">
        <label>
          Buscar doador
          <input
            aria-label="Buscar doadores"
            placeholder="Nome ou CPF"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Tipo sanguíneo
          <select
            aria-label="Filtrar por tipo sanguíneo"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">Todos os tipos</option>
            {bloodTypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <Panel title="Doadores da unidade" aside={`${data.donors.length} cadastrados`}>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Sangue</th>
                  <th>Cidade</th>
                  <th>Última doação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => {
                  const last = data.donations
                    .filter((d) => d.donorId === person.id)
                    .sort((a, b) => b.date.localeCompare(a.date))[0];
                  return (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      <td>{person.cpf}</td>
                      <td>{person.bloodType}</td>
                      <td>{person.city}</td>
                      <td>{last ? formatDate(last.date) : 'Sem registro'}</td>
                      <td>
                        <button className="table-action" onClick={() => onProfile(person.id)}>
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  );
}

export function ProfileView({
  data,
  donor,
  onEdit,
  onDonation,
  onScreening,
}: {
  data: OfficeData;
  donor: Donor;
  onEdit: () => void;
  onDonation: () => void;
  onScreening: () => void;
}) {
  const history = data.donations
    .filter((item) => item.donorId === donor.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="split-layout profile-layout">
        <Panel title={donor.name}>
          <div className="donor-identity">
            <span className="large-avatar">
              {donor.name
                .split(' ')
                .map((v) => v[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h3>
                {donor.bloodType} · {donor.city}
              </h3>
              <p>Cadastro ativo / CPF: {donor.cpf}</p>
            </div>
          </div>
          <div className="data-form">
            <label>
              E-mail
              <input value={donor.email} readOnly />
            </label>
            <label>
              Telefone
              <input value={donor.phone} readOnly />
            </label>
            <div className="form-actions">
              <button className="button secondary" onClick={onEdit}>
                Editar cadastro
              </button>
              <button className="button primary" onClick={onDonation}>
                Registrar doação
              </button>
            </div>
          </div>
        </Panel>
        <Panel title="Jornada de doação" className="summary-panel">
          <div className="profile-count">
            <span>Doações registradas</span>
            <strong>{String(history.length).padStart(2, '0')}</strong>
            <p>Última doação · {history[0] ? formatDate(history[0].date) : 'Sem registro'}</p>
          </div>
          <div className="summary-section">
            <h2>Pré-triagem mais recente</h2>
            <p>
              {donor.screening
                ? 'Respostas fictícias disponíveis para a equipe responsável.'
                : 'Este perfil ainda não tem respostas na demonstração.'}
            </p>
            {donor.screening && (
              <button className="button secondary full" onClick={onScreening}>
                Consultar respostas
              </button>
            )}
          </div>
        </Panel>
      </div>
      <Panel title="Histórico do doador" className="section-gap">
        {history.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Unidade</th>
                  <th>Tipo de doação</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{data.settings.name}</td>
                    <td>{item.type}</td>
                    <td>
                      <Badge tone="good">Registrada</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>As doações registradas para este perfil aparecerão aqui.</Empty>
        )}
      </Panel>
    </>
  );
}

export function DonorForm({
  donor,
  onSave,
  onCancel,
}: {
  donor?: Donor;
  onSave: (donor: Donor) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (key: string) => String(form.get(key) ?? '').trim();
    try {
      onSave({
        id: donor?.id ?? crypto.randomUUID(),
        name: field('name'),
        bloodType: field('bloodType') as BloodType,
        cpf: field('cpf'),
        birthDate: field('birthDate'),
        email: field('email'),
        phone: field('phone'),
        city: field('city'),
        channels: form.getAll('channels') as Channel[],
        screening: donor?.screening ?? false,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise os dados do doador.');
    }
  }
  return (
    <Panel title="Dados pessoais e contato">
      <form className="data-form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Nome completo
            <input name="name" defaultValue={donor?.name} maxLength={100} required />
          </label>
          <label>
            Tipo sanguíneo
            <select name="bloodType" defaultValue={donor?.bloodType ?? 'O+'}>
              {bloodTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            CPF / identificação fictícia
            <input
              name="cpf"
              defaultValue={donor?.cpf}
              maxLength={20}
              placeholder="Use apenas dados fictícios"
              required
            />
          </label>
          <label>
            Data de nascimento
            <input
              name="birthDate"
              type="date"
              max={localDate()}
              defaultValue={donor?.birthDate}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            E-mail
            <input name="email" type="email" defaultValue={donor?.email} maxLength={120} required />
          </label>
          <label>
            Telefone
            <input name="phone" defaultValue={donor?.phone} maxLength={25} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Cidade / UF
            <input
              name="city"
              defaultValue={donor?.city ?? 'Ourinhos, SP'}
              maxLength={100}
              required
            />
          </label>
          <fieldset className="channel-field">
            <legend>Canais autorizados</legend>
            {channels.map((channel) => (
              <label key={channel}>
                <input
                  type="checkbox"
                  name="channels"
                  value={channel}
                  defaultChecked={donor?.channels.includes(channel)}
                />
                {channel}
              </label>
            ))}
          </fieldset>
        </div>
        <Notice>
          Dados de exemplo. As preferências de contato são usadas apenas nas simulações locais.
        </Notice>
        <FormError message={error} />
        <div className="form-actions">
          <button className="button primary" type="submit">
            Salvar cadastro
          </button>
          <button className="button secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function DonationsView({ data }: { data: OfficeData }) {
  const today = localDate();
  const list = [...data.donations].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Registradas hoje"
          value={list.filter((d) => d.date === today).length}
          detail="Atendimentos concluídos"
        />
        <Stat
          label="Neste mês"
          value={list.filter((d) => d.date.startsWith(today.slice(0, 7))).length}
          detail="Histórico demonstrativo"
        />
        <Stat
          label="Próximos atendimentos"
          value={data.appointments.filter((a) => a.date >= today && a.status === 'Agendado').length}
          detail="Na agenda da unidade"
        />
      </div>
      <Panel title="Últimas doações" aside="Registros da unidade">
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Doador</th>
                  <th>Data</th>
                  <th>Sangue</th>
                  <th>Unidade</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const person = data.donors.find((d) => d.id === item.donorId)!;
                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{person.name}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>{person.bloodType}</td>
                      <td>{data.settings.name}</td>
                      <td>
                        <Badge tone="good">Registrada</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  );
}

export function DonationForm({
  data,
  donorId,
  onSave,
  onCancel,
  onProfile,
}: {
  data: OfficeData;
  donorId?: string;
  onSave: (value: Donation) => void;
  onCancel: () => void;
  onProfile: (id: string) => void;
}) {
  const [selected, setSelected] = useState(donorId ?? data.donors[0]?.id ?? '');
  const [error, setError] = useState('');
  const person = data.donors.find((d) => d.id === selected);
  const last = data.donations
    .filter((d) => d.donorId === selected)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      onSave({
        id: `DOA-${String(143 + data.donations.length).padStart(4, '0')}`,
        donorId: selected,
        date: String(form.get('date')),
        type: String(form.get('type')),
        note: String(form.get('note') ?? ''),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise o registro.');
    }
  }
  return (
    <div className="split-layout">
      <Panel title="Dados da doação">
        <form className="data-form" onSubmit={submit}>
          <label>
            Doador cadastrado
            <select
              name="donorId"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              required
            >
              {data.donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · CPF {d.cpf}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Data da doação
              <input
                type="date"
                name="date"
                defaultValue={localDate()}
                max={localDate()}
                required
              />
            </label>
            <label>
              Tipo de doação
              <select name="type">
                <option>Sangue total</option>
              </select>
            </label>
          </div>
          <label>
            Unidade responsável
            <input value={`${data.settings.name} — ${data.settings.city}`} readOnly />
          </label>
          <label>
            Observações do atendimento
            <textarea name="note" maxLength={160} rows={3} />
          </label>
          <Notice>
            O registro da doação e a entrada de bolsas são etapas distintas do fluxo operacional.
          </Notice>
          <FormError message={error} />
          <div className="form-actions">
            <button className="button primary">Concluir registro</button>
            <button type="button" className="button secondary" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Doador selecionado" className="summary-panel">
        {person && (
          <>
            <Badge tone="good">Cadastro localizado</Badge>
            <h3>{person.name}</h3>
            <p>
              {person.bloodType} · {person.city}
            </p>
            <dl>
              <dt>Última doação</dt>
              <dd>{last ? formatDate(last.date) : 'Sem registro'}</dd>
            </dl>
            <button className="button secondary" onClick={() => onProfile(person.id)}>
              Abrir perfil
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}

export function AgendaView({
  data,
  onProfile,
  onScreening,
}: {
  data: OfficeData;
  onProfile: (id: string) => void;
  onScreening: (id: string) => void;
}) {
  const [day, setDay] = useState(localDate());
  const rows = data.appointments
    .filter((a) => a.date === day)
    .sort((a, b) => a.time.localeCompare(b.time));
  const done = rows.filter((a) => a.status === 'Concluído').length;
  return (
    <>
      <div className="stats-grid three">
        <Stat label="Agendados no dia" value={rows.length} detail={formatDate(day)} />
        <Stat label="Atendimentos concluídos" value={done} detail="Registros da unidade" />
        <Stat label="Ainda previstos" value={rows.length - done} detail="Confira a lista abaixo" />
      </div>
      <Panel
        title={formatDate(day)}
        aside={
          <input
            type="date"
            aria-label="Data da agenda"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        }
      >
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Doador</th>
                  <th>Sangue</th>
                  <th>Pré-triagem</th>
                  <th>Atendimento</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const person = data.donors.find((d) => d.id === row.donorId)!;
                  return (
                    <tr key={row.id}>
                      <td>{row.time}</td>
                      <td>{person.name}</td>
                      <td>{person.bloodType}</td>
                      <td>
                        <Badge tone={person.screening ? 'good' : 'low'}>
                          {person.screening ? 'Respondida' : 'Pendente'}
                        </Badge>
                      </td>
                      <td>{row.status}</td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() =>
                            person.screening ? onScreening(person.id) : onProfile(person.id)
                          }
                        >
                          {person.screening ? 'Ver triagem' : 'Abrir perfil'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Não há agendamentos fictícios nesta data.</Empty>
        )}
      </Panel>
    </>
  );
}

export function ScreeningView({
  donor,
  onBack,
  onProfile,
}: {
  donor: Donor;
  onBack: () => void;
  onProfile: () => void;
}) {
  return (
    <div className="split-layout">
      <Panel title={`${donor.name} · ${donor.bloodType}`}>
        <p className="muted paragraph">Respostas de exemplo para apresentação da interface.</p>
        {donor.screening ? (
          <dl className="screening-answers">
            {[
              ['Você se sente bem hoje?', 'Sim'],
              ['Doou sangue recentemente?', 'Não'],
              ['Usa algum medicamento?', 'Não'],
              ['Teve algum procedimento recente?', 'Não'],
            ].map(([question, answer]) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Empty>Este doador ainda não tem pré-triagem demonstrativa.</Empty>
        )}
        <Notice>
          As respostas não confirmam aptidão. A avaliação é realizada pela equipe responsável na
          unidade.
        </Notice>
        <div className="form-actions">
          <button className="button primary" onClick={onBack}>
            Voltar à agenda
          </button>
        </div>
      </Panel>
      <Panel title="Atendimento" className="summary-panel">
        <h3>{donor.name}</h3>
        <p>Informações de saúde fictícias.</p>
        <p>Acesso demonstrativo da equipe.</p>
        <button className="button secondary full" onClick={onProfile}>
          Abrir cadastro
        </button>
      </Panel>
    </div>
  );
}
