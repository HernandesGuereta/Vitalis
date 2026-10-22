import { useState } from 'react';
import type { FormEvent } from 'react';
import { bloodTypes, reasons } from '../prototype/model';
import type { BloodType, Movement, MovementKind, StockItem } from '../prototype/model';
import { administrator, localDate } from '../prototype/office';
import { FormError, Notice, Panel } from '../components/ui';

export function MovementView({
  initialType,
  initialKind,
  stock,
  unit,
  onSave,
  onCancel,
}: {
  initialType: BloodType;
  initialKind: MovementKind;
  stock: StockItem[];
  unit: string;
  onSave: (value: Movement) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [bloodType, setBloodType] = useState(initialType);
  const [quantity, setQuantity] = useState(initialKind === 'entrada' ? '8' : '2');
  const [error, setError] = useState('');
  const available = stock.find((item) => item.bloodType === bloodType)!.quantity;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const date = String(values.get('date'));
    const expiry = kind === 'entrada' ? String(values.get('expiresOn') ?? '') : '';
    try {
      if (expiry && expiry < date)
        throw new Error('A validade informada deve ser igual ou posterior à data do registro.');
      onSave({
        id: crypto.randomUUID(),
        bloodType,
        kind,
        quantity: Number(quantity),
        reason: String(values.get('reason')),
        note: String(values.get('note') ?? ''),
        location: String(values.get('location')),
        expiresOn: expiry,
        createdAt:
          date === localDate()
            ? new Date().toISOString()
            : new Date(`${date}T12:00:00`).toISOString(),
        responsible: administrator,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise os dados do registro.');
    }
  }
  return (
    <div className="split-layout movement-layout">
      <Panel>
        <form onSubmit={submit} className="data-form">
          <fieldset className="movement-switch">
            <legend className="sr-only">Tipo de movimentação</legend>
            {(['entrada', 'saida'] as const).map((value) => (
              <label className={value === kind ? 'selected' : ''} key={value}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => {
                    setKind(value);
                    setError('');
                  }}
                />
                {value === 'entrada' ? 'Entrada' : 'Saída'}
              </label>
            ))}
          </fieldset>
          <div className="form-row">
            <label>
              Tipo sanguíneo
              <select
                value={bloodType}
                onChange={(e) => {
                  setBloodType(e.target.value as BloodType);
                  setError('');
                }}
              >
                {bloodTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Quantidade de bolsas
              <input
                name="quantity"
                type="number"
                min="1"
                max="10000"
                step="1"
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError('');
                }}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {kind === 'entrada' ? 'Data do registro' : 'Data da saída'}
              <input
                name="date"
                type="date"
                max={localDate()}
                defaultValue={localDate()}
                required
              />
            </label>
            {kind === 'entrada' && (
              <label>
                Validade informada pela unidade
                <input name="expiresOn" type="date" />
              </label>
            )}
          </div>
          <label>
            {kind === 'entrada' ? 'Origem / destino' : 'Destino'}
            <input
              name="location"
              key={kind}
              maxLength={160}
              required
              defaultValue={
                kind === 'entrada'
                  ? 'Doações realizadas na unidade'
                  : 'Hospital de referência da região'
              }
            />
          </label>
          <label>
            Motivo
            <select name="reason" key={kind}>
              {reasons[kind].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Observação
            <textarea
              name="note"
              rows={2}
              maxLength={160}
              placeholder="Acrescente uma observação ao registro."
            />
          </label>
          <FormError message={error} />
          <div className="form-actions">
            <button type="submit" className="button primary">
              Registrar {kind === 'entrada' ? 'entrada' : 'saída'}
            </button>
            <button type="button" className="button secondary" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </Panel>
      <Panel
        title={kind === 'entrada' ? 'Resumo do registro' : 'Resumo da saída'}
        className="summary-panel"
      >
        <h3>
          {kind === 'entrada' ? 'Entrada' : 'Saída'} · {bloodType}
        </h3>
        <strong className="summary-quantity">
          {kind === 'entrada' ? '+' : '−'}
          {quantity || '0'} bolsas
        </strong>
        <dl>
          <dt>Responsável</dt>
          <dd>{administrator}</dd>
          <dt>Unidade</dt>
          <dd>{unit}</dd>
          <dt>Saldo disponível</dt>
          <dd>
            {available} bolsas de {bloodType}
          </dd>
        </dl>
        <Notice>
          Confira tipo, quantidade e {kind === 'entrada' ? 'origem' : 'destino'} antes de registrar
          a movimentação.
        </Notice>
      </Panel>
    </div>
  );
}
