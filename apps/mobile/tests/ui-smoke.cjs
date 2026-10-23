const { app, BrowserWindow } = require('electron');
const { createServer } = require('node:http');
const { mkdtempSync, readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, extname, sep } = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
// Não encerrar antes de terminar a limpeza e informar o código de falha do teste.
app.on('window-all-closed', () => {});
app.setPath('userData', mkdtempSync(join(tmpdir(), 'vitalis-mobile-test-')));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
let apiServer, webServer, dbPool, apiPool, dbOwner, schema;
const donorPassword = 'fixture-mobile-donor-password';
const adminPassword = 'fixture-desktop-admin-password';
async function cleanup() {
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  if (apiServer?.listening) await new Promise((resolve) => apiServer.close(resolve));
  if (webServer?.listening) await new Promise((resolve) => webServer.close(resolve));
  if (apiPool) await apiPool.end();
  if (dbPool) await dbPool.end();
  if (schema && dbOwner) await dbOwner.query(`DROP SCHEMA ${schema} CASCADE`);
  if (dbOwner) await dbOwner.end();
}
const timer = setTimeout(() => {
  console.error('Tempo esgotado no teste mobile.');
  void cleanup().finally(() => app.exit(1));
}, 180000);
const root = resolve(__dirname, '../..');

function driver(window) {
  const evaluate = async (code) => {
    try {
      return await window.webContents.executeJavaScript(code, true);
    } catch (error) {
      throw new Error(`Falha ao executar ${code}: ${error.message}`);
    }
  };
  const until = async (code) => {
    for (let i = 0; i < 250; i++) {
      if (await evaluate(code)) return;
      await delay(40);
    }
    throw new Error(`Condição não atendida: ${code}`);
  };
  const click = async (
    text,
    selector = '[role="button"], button, [role="tab"], [role="radio"]',
  ) => {
    await evaluate(
      `(() => { const e = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!e) throw new Error('Controle ausente: ' + ${JSON.stringify(text)}); e.scrollIntoView({block:'center'}); e.click(); })()`,
    );
    await delay(70);
  };
  const field = async (selector, value) => {
    await evaluate(
      `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('Campo ausente'); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await delay(60);
  };
  const screenshot = async (name) => {
    const dir = process.env.VITALIS_TEST_SCREENSHOTS_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    window.show();
    window.focus();
    for (let attempt = 0; attempt < 3; attempt++) {
      await delay(400);
      try {
        writeFileSync(join(dir, `${name}.png`), (await window.webContents.capturePage()).toPNG());
        return;
      } catch (error) {
        if (attempt === 2) throw new Error(`Captura ${name}: ${error.message}`);
      }
    }
  };
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 3) {
      // Respostas 409 e quedas de conexão são provocadas pelos cenários de recuperação.
      if (
        /^Failed to load resource: (the server responded with a status of 409|net::ERR_CONNECTION_(RESET|REFUSED))/.test(
          event.message,
        )
      )
        return;
      errors.push(event.message);
      console.error('Renderer:', event.message);
    }
  });
  return { evaluate, until, click, field, screenshot };
}

app.whenReady().then(async () => {
  try {
    assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL para o teste isolado.');
    assert.match(new URL(process.env.TEST_DATABASE_URL).pathname, /test/i);
    dbOwner = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    schema = `vitalis_ui_${randomUUID().replaceAll('-', '')}`;
    await dbOwner.query(`CREATE SCHEMA ${schema}`);
    dbPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    const { migrate } = await import(pathToFileURL(join(root, 'api/dist/db/migrate.js')).href);
    const { seed } = await import(pathToFileURL(join(root, 'api/dist/db/seed.js')).href);
    await migrate(dbPool);
    await seed(dbPool, donorPassword, adminPassword);
    const { grantRuntimeRole } = await import(
      pathToFileURL(join(root, 'api/dist/db/runtimeRole.js')).href
    );
    await grantRuntimeRole(dbPool);
    const runtimeUrl = new URL(process.env.DATABASE_URL);
    assert.equal(runtimeUrl.username, 'vitalis_app');
    runtimeUrl.pathname = new URL(process.env.TEST_DATABASE_URL).pathname;
    apiPool = new Pool({
      connectionString: runtimeUrl.toString(),
      options: `-c search_path=${schema}`,
    });
    const { createApp } = await import(pathToFileURL(join(root, 'api/dist/app.js')).href);
    apiServer = createApp(apiPool).listen(
      Number(process.env.VITALIS_UI_API_PORT || 3000),
      '127.0.0.1',
    );
    await new Promise((resolve, reject) => {
      apiServer.once('listening', resolve);
      apiServer.once('error', reject);
    });
    const webRoot = join(root, 'mobile/dist-web');
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.json': 'application/json',
    };
    webServer = createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(webRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(webRoot + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
        res.end(readFileSync(path));
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((resolve) => webServer.listen(0, '127.0.0.1', resolve));
    const mobile = new BrowserWindow({
      width: 390,
      height: 844,
      useContentSize: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const allowedOrigins = new Set([
      `http://127.0.0.1:${webServer.address().port}`,
      `http://127.0.0.1:${process.env.VITALIS_UI_API_PORT}`,
    ]);
    const apiRequests = [];
    mobile.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        if (new URL(details.url).port === process.env.VITALIS_UI_API_PORT)
          apiRequests.push({ method: details.method, path: new URL(details.url).pathname });
        callback({ cancel: !allowedOrigins.has(new URL(details.url).origin) });
      },
    );
    const m = driver(mobile);
    const configure = async () => {
      await m.click('Configurar conexão');
      await m.field(
        'input[aria-label="Endereço da API"]',
        `http://127.0.0.1:${process.env.VITALIS_UI_API_PORT}`,
      );
      await m.click('Ocultar configuração de conexão');
    };
    await mobile.loadURL(`http://127.0.0.1:${webServer.address().port}`);
    await m.until('document.body.innerText.includes("Bom te ver de novo.")');
    assert.equal(await m.evaluate('document.querySelectorAll("[role=tab]").length'), 0);
    await m.screenshot('01-login');
    await configure();
    await m.click('Criar minha conta');
    await m.click('Configurar conexão');
    assert.equal(
      await m.evaluate(
        'document.querySelector("input[aria-label=" + JSON.stringify("Endereço da API") + "]").value',
      ),
      `http://127.0.0.1:${process.env.VITALIS_UI_API_PORT}`,
    );
    await m.click('Ocultar configuração de conexão');
    await m.field('input[aria-label="Nome completo"]', 'Lia Protótipo');
    await m.field('input[aria-label="E-mail"]', 'lia@exemplo.com');
    await m.field('input[aria-label="Senha"]', donorPassword);
    await m.field('input[aria-label="Confirmar senha"]', 'outra-senha');
    await m.click('Criar minha conta');
    assert.ok(
      await m.evaluate('document.body.innerText.includes("As senhas precisam ser iguais")'),
    );
    await m.field('input[aria-label="Confirmar senha"]', donorPassword);
    await m.screenshot('02-cadastro');
    await m.click('Criar minha conta');
    await m.until('document.body.innerText.includes("Olá, Lia.")');
    assert.equal(await m.evaluate('document.querySelectorAll("[role=tab]").length'), 5);
    assert.equal(
      await m.evaluate('document.body.innerText.includes("agenda compartilhada")'),
      false,
    );
    assert.ok(
      await m.evaluate(
        'Array.from(document.images).some(i=>i.src.includes("vitalis-logo")&&i.naturalWidth===2172)',
      ),
    );
    await m.screenshot('03-inicio');
    const quizRequestsStart = apiRequests.length;
    await m.click('Fazer pré-triagem');
    await m.until('document.body.innerText.includes("Pré-triagem no aplicativo")');
    await m.screenshot('10-pre-triagem-inicio');
    await m.click('Começar pré-triagem');
    assert.equal(
      await m.evaluate(
        'document.querySelector("[data-testid=screening-next]").getAttribute("aria-disabled")',
      ),
      'true',
    );
    await m.click('18 a 59 anos');
    await m.click('Continuar');
    await m.click('Sim');
    await m.click('Pergunta anterior');
    await m.click('16 ou 17 anos');
    await m.click('Continuar');
    await m.until('document.body.innerText.includes("autorização do seu responsável")');
    await m.click('Sair e apagar respostas');
    const answerQuiz = async (weight) => {
      await m.click('Fazer pré-triagem');
      await m.click('Começar pré-triagem');
      assert.equal(
        await m.evaluate('document.querySelectorAll("[role=radio][aria-checked=true]").length'),
        0,
      );
      for (const [index, answer] of [
        '18 a 59 anos',
        weight,
        'Sim',
        'Sim',
        'Não',
        'Não',
        'Não se aplica',
        'Nunca doei',
      ].entries()) {
        await m.click(answer);
        if (index === 1) {
          mobile.setContentSize(320, 700);
          await delay(100);
          assert.ok(await m.evaluate('document.documentElement.scrollWidth<=innerWidth'));
          await m.screenshot('11-pre-triagem-pergunta');
          mobile.setContentSize(390, 844);
        }
        await m.click(index === 7 ? 'Ver orientação inicial' : 'Continuar');
      }
    };
    await answerQuiz('Sim');
    await m.until('document.body.innerText.includes("Nenhum alerta inicial nas respostas")');
    assert.ok(
      await m.evaluate('document.body.innerText.includes("não confirma que você está apto")'),
    );
    await m.screenshot('12-pre-triagem-orientacao');
    await m.click('Encerrar e apagar respostas');
    await answerQuiz('Não');
    await m.until('document.body.innerText.includes("Melhor adiar por enquanto")');
    assert.ok(
      await m.evaluate('document.body.innerText.includes("peso mínimo para doar sangue é 50 kg")'),
    );
    await m.screenshot('13-pre-triagem-cuidado');
    await m.click('Encerrar e apagar respostas');
    assert.equal(
      apiRequests
        .slice(quizRequestsStart)
        .some((request) => !['GET', 'OPTIONS'].includes(request.method)),
      false,
    );
    assert.equal((await dbPool.query('SELECT count(*)::int n FROM appointments')).rows[0].n, 0);
    for (const storage of ['localStorage', 'sessionStorage'])
      assert.equal(
        await m.evaluate(
          `JSON.stringify(${storage}).includes('screening') || JSON.stringify(${storage}).includes('pregnancy') || JSON.stringify(${storage}).includes('prepared')`,
        ),
        false,
      );
    console.log(
      'Pré-triagem digital: perguntas condicionais, orientação, cuidados e descarte das respostas sem envio à API verificados.',
    );
    const desktop = new BrowserWindow({
      width: 1400,
      height: 940,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const d = driver(desktop);
    await desktop.loadFile(join(root, 'desktop/out/renderer/index.html'));
    await d.until('document.querySelector(".login-layout")!==null');
    assert.equal(
      await d.evaluate('document.querySelector("[name=email]").value'),
      'hemocentro@vitalis.demo',
    );
    await d.click('Entrar no hemocentro');
    await d.until('document.querySelectorAll(".nav-item").length===8');
    await d.until('document.body.innerText.includes("Solicitações de doação")');
    await d.screenshot('04-inicio-hemocentro');
    await d.click('Agendamentos', '.nav-item');
    await d.until('document.body.innerText.includes("Agendamentos de doação")');
    assert.equal(await d.evaluate('document.querySelector("[name=agendaPassword]")===null'), true);
    await require('./appointments.cjs').checkAppointments({
      m,
      d,
      db: dbPool,
      base: `http://127.0.0.1:${process.env.VITALIS_UI_API_PORT}`,
      donorPassword,
      restartApi: async () => {
        const closed = new Promise((resolve) => apiServer.close(resolve));
        apiServer.closeAllConnections();
        await closed;
        apiServer = createApp(apiPool).listen(Number(process.env.VITALIS_UI_API_PORT), '127.0.0.1');
        await new Promise((resolve, reject) => {
          apiServer.once('listening', resolve);
          apiServer.once('error', reject);
        });
      },
      loginDonor: async () => {
        await configure();
        await m.field('input[aria-label="E-mail"]', 'lia@exemplo.com');
        await m.field('input[aria-label="Senha"]', donorPassword);
        await m.click('Entrar');
        await m.until('document.body.innerText.includes("Olá, Lia.")');
      },
    });
    await m.click('Conta');
    await m.click('Meus dados', '[role="button"] [dir="auto"]');
    await m.field('input[aria-label="Nome completo"]', 'Lia Atualizada');
    await m.click('Salvar alterações');
    await m.click('Voltar à minha conta');
    await m.until('document.body.innerText.includes("Lia Atualizada")');
    await m.click('Privacidade', '[role="button"] [dir="auto"]');
    await m.click('Consultar e copiar meus dados');
    await m.until('document.body.innerText.includes("exportedAt")');
    assert.equal(
      await m.evaluate('JSON.stringify(localStorage).includes("Lia Atualizada")'),
      false,
    );
    assert.equal(
      await m.evaluate(`JSON.stringify(localStorage).includes(${JSON.stringify(donorPassword)})`),
      false,
    );
    await m.screenshot('08-privacidade');
    await m.click('Conta');
    mobile.setContentSize(320, 700);
    await delay(120);
    assert.ok(await m.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await m.screenshot('09-tela-compacta');
    await m.click('Sair da conta');
    await m.until('document.body.innerText.includes("Bom te ver de novo.")');
    assert.equal(await m.evaluate('document.querySelectorAll("[role=tab]").length'), 0);
    await configure();
    await m.field('input[aria-label="E-mail"]', 'lia@exemplo.com');
    await m.field('input[aria-label="Senha"]', donorPassword);
    await m.click('Entrar');
    await m.until('document.body.innerText.includes("Olá, Lia.")');
    await m.click('Agenda');
    await m.until('document.body.innerText.includes("CANCELADO")');
    await mobile.reload();
    await m.until('document.body.innerText.includes("Bom te ver de novo.")');
    assert.equal(await m.evaluate('document.querySelectorAll("[role=tab]").length'), 0);
    await configure();
    await m.field('input[aria-label="E-mail"]', 'lia@exemplo.com');
    await m.field('input[aria-label="Senha"]', donorPassword);
    await m.click('Entrar');
    await m.until('document.body.innerText.includes("Olá, Lia.")');
    await d.click('Alertas', '.nav-item');
    await d.click('Criar alerta');
    await d.field('[name=title]', 'Aviso fictício para doadores');
    await d.click('Revisar alerta');
    await d.click('Confirmar envio simulado');
    await d.click('Publicar no aplicativo');
    await d.until('document.body.innerText.includes("Publicado no aplicativo.")');
    await m.click('Alertas');
    await m.click('Atualizar avisos');
    await m.until('document.body.innerText.includes("Aviso fictício para doadores")');
    await m.click('Conta');
    await m.click('Privacidade', '[role="button"] [dir="auto"]');
    await m.field('input[aria-label="Confirmação de exclusão"]', 'EXCLUIR');
    await m.click('Excluir minha conta');
    await m.until('document.body.innerText.includes("Bom te ver de novo.")');
    assert.equal(
      (await dbPool.query("SELECT count(*)::int n FROM accounts WHERE email='lia@exemplo.com'"))
        .rows[0].n,
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Persistência, retorno ao login após recarregar, publicação autenticada, privacidade e exclusão da conta verificados.',
    );
    clearTimeout(timer);
    await cleanup();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(timer);
    await cleanup();
    app.exit(1);
  }
});
