const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

exports.checkAppointments = async function ({
  m,
  d,
  db,
  base,
  donorPassword,
  restartApi,
  loginDonor,
}) {
  // Falhas apenas nesta janela isolada. O servidor continua gravando no PostgreSQL real.
  await m.evaluate(`(() => {
    const state = window.__bookingTest = { original: window.fetch.bind(window), requests: [], readsBlocked: true, loseCreate: 0, loseCancel: 0, failReadsAfterCreate: false };
    window.fetch = async (input, init) => {
      const path = new URL(typeof input==='string' ? input : input.url).pathname;
      const method = init?.method || 'GET';
      if (method==='GET' && path.startsWith('/v1/') && state.readsBlocked) throw new TypeError('Conexão de teste indisponível');
      if (method==='POST' && path==='/v1/appointments') state.requests.push(JSON.parse(init.body));
      const response = await state.original(input,init);
      if (method==='POST' && path==='/v1/appointments') {
        if (response.ok && state.loseCreate) { state.loseCreate--; state.readsBlocked=true; throw new TypeError('Resposta perdida após gravar'); }
        if (response.ok && state.failReadsAfterCreate) { state.failReadsAfterCreate=false; state.readsBlocked=true; }
        else state.readsBlocked=false;
      }
      if (method==='POST' && path.endsWith('/cancel') && response.ok) {
        if (state.loseCancel) { state.loseCancel--; state.readsBlocked=true; throw new TypeError('Resposta de cancelamento perdida'); }
        state.readsBlocked=false;
      }
      return response;
    };
  })()`);
  const active = async () =>
    (await db.query("SELECT count(*)::int n FROM appointments WHERE status='booked'")).rows[0].n;
  const visible = (id) => `(() => {
    const element=document.querySelector('[data-testid="${id}"]');
    if(!element) return false;
    const rect=element.getBoundingClientRect();
    let ancestor=element.parentElement;
    while(ancestor && getComputedStyle(ancestor).overflowY!=='auto' && getComputedStyle(ancestor).overflowY!=='scroll') ancestor=ancestor.parentElement;
    const viewport=ancestor ? ancestor.getBoundingClientRect() : {top:0,bottom:innerHeight};
    return rect.top>=viewport.top-1 && rect.bottom<=viewport.bottom+1;
  })()`;
  const openBooking = async () => {
    await m.click('Início');
    await m.click('Agendar doação', '[role="button"] [dir="auto"]');
  };
  const ready = () => m.until('document.querySelectorAll("[role=radio]").length>=9');
  const chooseFirst = async () => {
    await ready();
    await m.evaluate('document.querySelectorAll("[role=radio]")[2].click()');
    await m.until(
      'Array.from(document.querySelectorAll("[role=radio]")).some(e=>e.textContent.includes("09:00 ·"))',
    );
    await m.click('09:00 · 2 vaga(s)');
  };
  const confirmed = () =>
    m.until('document.body.innerText.includes("Sua solicitação já está na agenda do hemocentro")');
  const myAppointments = async () => {
    await m.click('Ver meus agendamentos');
    await m.until('document.body.innerText.includes("AGENDADO · VISITA PARA DOAÇÃO")');
  };
  const cancelMobile = async () => {
    await m.click('Cancelar agendamento');
    await m.click('Confirmar cancelamento');
  };

  await openBooking();
  await m.until('document.body.innerText.includes("Sem conexão com o servidor")');
  assert.equal(
    await m.evaluate('document.body.innerText.includes("Não há horários futuros")'),
    false,
  );
  await m.evaluate('window.__bookingTest.readsBlocked=false');
  await m.click('Atualizar horários e agendamentos');
  await ready();
  await m.click('Unidade Jardim Paulista');
  await chooseFirst();
  await m.click('Unidade Vitalis Centro');
  await ready();
  assert.equal(
    await m.evaluate('document.querySelectorAll("[role=radio][aria-checked=true]").length'),
    1,
  );
  await chooseFirst();
  await m.screenshot('05-agendar-doacao');

  await m.evaluate(
    'window.__bookingTest.loseCreate=1; const confirm=document.querySelector("[data-testid=confirm-appointment]"); confirm.click(); confirm.click();',
  );
  await m.until('document.body.innerText.includes("Não foi possível confirmar o agendamento")');
  await m.until(visible('appointment-error'));
  assert.equal(await active(), 1);
  assert.equal(
    await m.evaluate('window.__bookingTest.requests.length'),
    1,
    'Duplo clique não deve enviar duas requisições',
  );
  await m.screenshot('14-resposta-perdida');
  await m.click('Confirmar agendamento');
  await confirmed();
  await m.until(visible('appointment-feedback'));
  const requests = await m.evaluate('window.__bookingTest.requests');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1], 'A repetição deve usar a mesma chave de tentativa');
  assert.equal(await active(), 1);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM audit_events WHERE action='appointment_created'"))
      .rows[0].n,
    1,
  );
  await d.until(
    'Array.from(document.querySelectorAll("tbody tr")).some(r=>r.textContent.includes("Lia Protótipo"))',
  );
  await d.screenshot('06-solicitacao-recebida');
  await myAppointments();
  await m.screenshot('07-meus-agendamentos');
  await d.evaluate(`(() => {
    const original=window.__desktopFetch=window.fetch.bind(window);
    window.__blockAgenda=false;
    window.fetch=async (input,init) => {
      const path=new URL(typeof input==='string' ? input : input.url).pathname;
      if (window.__blockAgenda && path==='/v1/appointments' && (init?.method||'GET')==='GET') throw new TypeError('Consulta indisponível após cancelar');
      const response=await original(input,init);
      if (path.endsWith('/cancel') && response.ok) window.__blockAgenda=true;
      return response;
    };
  })()`);
  await d.click('Cancelar reserva');
  await d.click('Confirmar cancelamento');
  await d.until(
    'document.body.innerText.includes("Cancelamento confirmado. A vaga foi liberada.")',
  );
  assert.equal(
    await d.evaluate(
      'Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Cancelar reserva")',
    ),
    false,
  );
  await d.evaluate(
    'window.fetch=window.__desktopFetch; delete window.__desktopFetch; delete window.__blockAgenda',
  );
  await d.click('Atualizar agendamentos');
  await m.until('document.body.innerText.includes("CANCELADO")');
  assert.equal(await active(), 0);

  // A criação foi confirmada, mas os GETs seguintes falham: preservar a confirmação.
  await openBooking();
  await chooseFirst();
  await m.evaluate('window.__bookingTest.failReadsAfterCreate=true');
  await m.click('Confirmar agendamento');
  await confirmed();
  await m.until('document.body.innerText.includes("O agendamento foi confirmado, mas a lista")');
  await m.until(visible('appointment-feedback'));
  assert.equal(
    await m.evaluate('document.querySelector("[data-testid=confirm-appointment]")===null'),
    true,
  );
  assert.equal(await active(), 1);
  await m.screenshot('15-confirmado-sem-atualizacao');
  await m.evaluate('window.__bookingTest.readsBlocked=false');
  await m.click('Atualizar horários e agendamentos');
  await myAppointments();
  const secondId = (await db.query("SELECT id FROM appointments WHERE status='booked'")).rows[0].id;

  await restartApi();
  await m.click('Atualizar horários e agendamentos');
  await m.until('document.body.innerText.includes("AGENDADO · VISITA PARA DOAÇÃO")');
  await d.click('Atualizar agendamentos');
  await d.until('document.querySelector("table")?.textContent.includes("Agendado")');

  // Cancelamento já gravado pode ser repetido após perda de resposta.
  await m.evaluate('window.__bookingTest.loseCancel=1');
  await cancelMobile();
  await m.until('document.body.innerText.includes("Não foi possível confirmar o cancelamento")');
  assert.equal(await active(), 0);
  await m.click('Confirmar cancelamento');
  await m.until('document.body.innerText.includes("Agendamento cancelado.")');
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM audit_events WHERE action='appointment_cancelled' AND resource_id=$1",
        [secondId],
      )
    ).rows[0].n,
    1,
  );
  await d.until(
    '!Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Cancelar reserva")',
  );

  // Outro doador ocupa a última vaga depois de a tela carregar.
  await openBooking();
  await chooseFirst();
  await m.evaluate('window.__bookingTest.readsBlocked=true');
  const slot = (
    await db.query(
      "SELECT id FROM slots WHERE unit_id='centro' AND starts_at>now() ORDER BY starts_at LIMIT 1",
    )
  ).rows[0];
  await db.query('UPDATE slots SET capacity=1 WHERE id=$1', [slot.id]);
  const api = async (path, token, method = 'GET', body) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const response = await api('/v1/auth/login', undefined, 'POST', {
    email: 'ana@exemplo.com',
    password: donorPassword,
  });
  assert.equal(response.status, 200);
  const competitor = (await response.json()).token;
  try {
    const other = await api('/v1/appointments', competitor, 'POST', {
      slotId: slot.id,
      requestId: randomUUID(),
    });
    assert.equal(other.status, 201);
    const otherId = (await other.json()).id;
    await m.click('Confirmar agendamento');
    await m.until('document.body.innerText.includes("As vagas deste horário foram preenchidas")');
    await m.until(
      'Array.from(document.querySelectorAll("[role=radio]")).some(e=>e.textContent.includes("09:00 · Esgotado") && e.getAttribute("aria-disabled")==="true")',
    );
    assert.equal(
      await m.evaluate(
        'document.querySelector("[data-testid=confirm-appointment]").getAttribute("aria-disabled")',
      ),
      'true',
    );
    assert.equal(await active(), 1);
    await m.screenshot('16-ultima-vaga-ocupada');
    assert.equal((await api(`/v1/appointments/${otherId}/cancel`, competitor, 'POST')).status, 204);
  } finally {
    await api('/v1/auth/logout', competitor, 'POST');
  }
  await db.query('UPDATE slots SET capacity=2 WHERE id=$1', [slot.id]);
  await m.click('Atualizar horários e agendamentos');
  await m.until(
    'Array.from(document.querySelectorAll("[role=radio]")).some(e=>e.textContent.includes("09:00 · 2 vaga(s)") && e.getAttribute("aria-disabled")!=="true")',
  );
  await m.click('Confirmar agendamento');
  await confirmed();
  assert.equal(await active(), 1);
  await myAppointments();
  await cancelMobile();
  await m.until('document.body.innerText.includes("Agendamento cancelado.")');
  assert.equal(await active(), 0);

  // Uma reserva passada é histórico: nenhum dos clientes oferece cancelamento.
  const pastSlot = randomUUID();
  await db.query(
    "INSERT INTO slots(id,unit_id,starts_at,capacity) VALUES($1,'centro',now()-interval '1 day',2)",
    [pastSlot],
  );
  await db.query(
    `INSERT INTO appointments(id,donor_id,slot_id,service_date,request_id) SELECT $1,a.id,s.id,(s.starts_at AT TIME ZONE 'America/Sao_Paulo')::date,$3 FROM accounts a CROSS JOIN slots s WHERE a.email='lia@exemplo.com' AND s.id=$2`,
    [randomUUID(), pastSlot, randomUUID()],
  );
  await m.click('Atualizar horários e agendamentos');
  await m.until('document.body.innerText.includes("DATA ENCERRADA")');
  assert.equal(
    await m.evaluate(
      'Array.from(document.querySelectorAll("[role=button]")).some(e=>e.textContent.trim()==="Cancelar agendamento")',
    ),
    false,
  );
  await d.until('document.querySelector("table")?.textContent.includes("Data encerrada")');
  assert.equal(
    await d.evaluate(
      'Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Cancelar reserva")',
    ),
    false,
  );

  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE account_id=(SELECT id FROM accounts WHERE email='lia@exemplo.com')",
  );
  await m.click('Atualizar horários e agendamentos');
  await m.until('document.body.innerText.includes("Bom te ver de novo.")');
  await loginDonor();
  await m.click('Agenda');
  await m.until('document.body.innerText.includes("DATA ENCERRADA")');
  await m.evaluate('window.fetch=window.__bookingTest.original; delete window.__bookingTest');
  console.log(
    'Agendamento ponta a ponta: rede indisponível, troca de unidade, duplo clique, resposta perdida, reinício da API, cancelamento pelos dois clientes, última vaga, histórico e sessão expirada verificados.',
  );
};
