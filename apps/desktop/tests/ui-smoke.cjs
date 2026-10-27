const { app, BrowserWindow } = require('electron');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
let dbOwner, dbPool, schema, apiServer;
async function cleanup() {
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  if (apiServer?.listening) {
    apiServer.closeAllConnections();
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (dbPool) await dbPool.end();
  if (schema && dbOwner) await dbOwner.query(`DROP SCHEMA ${schema} CASCADE`);
  if (dbOwner) await dbOwner.end();
}

// Perfil isolado: nenhum teste altera a demonstração usada pelo usuário.
app.setPath('userData', mkdtempSync(join(tmpdir(), 'vitalis-design-test-')));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (error) => {
  console.error(error);
  void cleanup().finally(() => app.exit(1));
};
const timer = setTimeout(() => fail(new Error('Tempo esgotado no teste da interface.')), 90000);

app.on('web-contents-created', (_event, contents) => {
  const errors = [];
  contents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 3) errors.push(event.message);
  });
  contents.on('render-process-gone', (_event, details) => fail(new Error(JSON.stringify(details))));
  contents.once('did-finish-load', async () => {
    const evaluate = (code) => contents.executeJavaScript(code, true);
    const until = async (code) => {
      for (let i = 0; i < 120; i++) {
        if (await evaluate(code)) return;
        await delay(25);
      }
      throw new Error(`Condição não atendida: ${code}`);
    };
    const click = async (text, selector = 'button') => {
      await evaluate(
        `(() => { const button = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Botão ausente: ' + ${JSON.stringify(text)}); button.click(); })()`,
      );
      await delay(60);
    };
    const field = async (selector, value) => {
      await evaluate(
        `(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) throw new Error('Campo ausente: ' + ${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
      );
      await delay(40);
    };
    const submit = async () => {
      await evaluate('document.querySelector("form").requestSubmit()');
      await delay(80);
    };
    const screenshot = async (name) => {
      const dir = process.env.VITALIS_TEST_SCREENSHOTS_DIR;
      if (!dir) return;
      mkdirSync(dir, { recursive: true });
      await delay(500);
      await evaluate(
        'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
      );
      writeFileSync(join(dir, `${name}.png`), (await contents.capturePage()).toPNG());
    };
    try {
      await until('document.querySelector(".login-layout") !== null');
      await screenshot('01-acesso');
      await submit();
      await until('document.querySelectorAll(".nav-item").length === 8');
      await until('document.querySelector(".brand img")?.complete');
      assert.equal(await evaluate('document.querySelector(".brand img").naturalWidth'), 2172);
      assert.equal(
        await evaluate('document.querySelector(".stat-card > strong").textContent'),
        '221',
      );
      await screenshot('02-visao-geral');
      console.log('Login autenticado do hemocentro e logo original verificados.');

      await click('Estoque de sangue', '.nav-item');
      assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 8);
      await screenshot('03-estoque');
      await field('[aria-label="Filtrar por nível de estoque"]', 'critico');
      await until('document.querySelectorAll("tbody tr").length === 3');
      await click('Registrar movimentação');
      await field('[name="quantity"]', '5');
      await screenshot('04-entrada');
      await submit();
      await until('document.querySelector(".success-panel") !== null');
      await screenshot('05-entrada-registrada');
      await click('Consultar estoque');
      assert.equal(
        await evaluate('document.querySelector(".stat-card > strong").textContent'),
        '226',
      );
      await click('Registrar movimentação');
      await evaluate('document.querySelector("input[value=saida]").click()');
      await until(
        'document.querySelector("input[name=location]")?.value === "Hospital de referência da região"',
      );
      await field('.form-row select', 'AB-');
      await field('[name="quantity"]', '999');
      await submit();
      await until('document.querySelector(".form-error")?.textContent.includes("apenas 2")');
      await field('[name="quantity"]', '1');
      await screenshot('06-saida');
      await submit();
      await until('document.querySelector(".success-panel") !== null');
      await screenshot('07-saida-registrada');
      await click('Movimentações', '.nav-item');
      assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 10);
      await screenshot('08-movimentacoes');
      console.log('Estoque, filtros, entrada, saída e saldo insuficiente verificados.');

      await click('Doadores', '.nav-item');
      await screenshot('09-doadores');
      await field('[aria-label="Buscar doadores"]', 'Ana Oliveira');
      await until('document.querySelectorAll("tbody tr").length === 1');
      await click('Ver perfil');
      await screenshot('10-perfil');
      await click('Consultar respostas');
      await screenshot('11-triagem');
      await click('Abrir cadastro');
      await click('Editar cadastro');
      await screenshot('12-cadastro');
      await field('[name="name"]', 'Ana Oliveira Demo');
      await submit();
      await until('document.querySelector(".panel h2")?.textContent === "Ana Oliveira Demo"');
      await click('Registrar doação');
      await screenshot('13-registrar-doacao');
      await submit();
      await until('document.querySelector("h1")?.textContent === "Doações que fazem a diferença."');
      assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 6);
      await screenshot('14-doacoes');
      await click('Agendamentos', '.nav-item');
      await until('document.querySelector("tbody")?.textContent.includes("Concluído")');
      await screenshot('15-agenda');
      await click('Doadores', '.nav-item');
      await click('Cadastrar doador');
      await field('[name="name"]', 'Carolina Demo');
      await field('[name="cpf"]', 'DEMO-011');
      await field('[name="birthDate"]', '1995-01-01');
      await field('[name="email"]', 'carolina@exemplo.com');
      await submit();
      await until('document.querySelector(".panel h2")?.textContent === "Carolina Demo"');
      console.log('Busca, perfil, pré-triagem, edição/cadastro e doação vinculada verificados.');

      await click('Alertas', '.nav-item');
      await screenshot('16-alertas');
      await until('document.body.innerText.includes("Avisos automáticos de escassez")');
      await until(
        'document.querySelector("[data-testid=stock-sync]")?.textContent.includes("Estoque sincronizado")',
      );
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Criar alerta"))',
        ),
        false,
      );
      assert.ok(await evaluate('document.querySelectorAll(".automatic-alerts article").length>0'));
      await screenshot('17-avisos-automaticos');
      await click('Configurações', '.nav-item');
      await screenshot('20-configuracoes');
      await field('[name="name"]', 'Vitalis Centro Demo');
      await submit();
      await until('document.querySelector(".unit-label")?.textContent.includes("CENTRO DEMO")');
      await new Promise((resolve) => {
        contents.once('did-finish-load', resolve);
        contents.reload();
      });
      await until('document.querySelector(".login-layout") !== null');
      await submit();
      await until('document.querySelector(".stat-card > strong")?.textContent === "225"');
      assert.equal(
        await evaluate(
          'JSON.parse(localStorage.getItem("vitalis.desktop.office.v1")).donors.length',
        ),
        11,
      );
      assert.equal(await evaluate('JSON.stringify(localStorage).includes("vitalis-demo")'), false);
      console.log(
        'Avisos automáticos, preferências de contato, configurações e persistência verificados.',
      );

      await click('Configurações', '.nav-item');
      await click('Restaurar demonstração');
      await click('Cancelar', 'dialog button');
      assert.equal(
        await evaluate(
          'JSON.parse(localStorage.getItem("vitalis.desktop.office.v1")).donors.length',
        ),
        11,
      );
      await click('Restaurar demonstração');
      await click('Restaurar dados de exemplo', 'dialog button');
      await until('document.querySelector(".stat-card > strong")?.textContent === "221"');
      BrowserWindow.fromWebContents(contents).setSize(980, 740);
      await delay(80);
      assert.equal(
        await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
        true,
      );
      await screenshot('21-janela-compacta');
      BrowserWindow.fromWebContents(contents).setContentSize(640, 740);
      await click('Movimentações', '.nav-item');
      await delay(100);
      assert.equal(
        await evaluate('document.activeElement === document.querySelector(".page-heading h1")'),
        true,
      );
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await evaluate('document.querySelector(".table-scroll").tabIndex'), 0);
      contents.setZoomFactor(1.5);
      await delay(100);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await screenshot('22-zoom-e-teclado');
      contents.setZoomFactor(1);

      await click('Configurações', '.nav-item');
      await click('Sair da conta');
      await until('document.querySelector(".login-layout") !== null');
      assert.deepEqual(errors, []);
      console.log(
        'Restauração, cancelamento, layout compacto e saída verificados. Teste de interface concluído.',
      );
      clearTimeout(timer);
      await cleanup();
      app.exit(0);
    } catch (error) {
      await screenshot('falha');
      fail(error);
    }
  });
});
app
  .whenReady()
  .then(async () => {
    assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL antes do teste gráfico.');
    assert.match(new URL(process.env.TEST_DATABASE_URL).pathname, /test/i);
    dbOwner = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    schema = `vitalis_desktop_${randomUUID().replaceAll('-', '')}`;
    await dbOwner.query(`CREATE SCHEMA ${schema}`);
    dbPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    const apiRoot = join(__dirname, '../../api/dist');
    const { migrate } = await import(pathToFileURL(join(apiRoot, 'db/migrate.js')).href);
    const { seed } = await import(pathToFileURL(join(apiRoot, 'db/seed.js')).href);
    await migrate(dbPool);
    await seed(dbPool, 'desktop-donor-fixture-password', 'desktop-admin-fixture-password');
    const { createApp } = await import(pathToFileURL(join(apiRoot, 'app.js')).href);
    apiServer = createApp(dbPool).listen(
      Number(process.env.VITALIS_UI_API_PORT || 3000),
      '127.0.0.1',
    );
    await new Promise((resolve, reject) => {
      apiServer.once('listening', resolve);
      apiServer.once('error', reject);
    });
    await import(pathToFileURL(join(__dirname, '../out/main/index.js')).href);
  })
  .catch(fail);
