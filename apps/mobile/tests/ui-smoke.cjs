const { app, BrowserWindow } = require('electron');
const { createServer } = require('node:http');
const { mkdtempSync, readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, extname, sep } = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
app.setPath('userData', mkdtempSync(join(tmpdir(), 'vitalis-mobile-test-')));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
let apiServer, webServer, dbPool, dbOwner, schema;
const donorPassword = 'fixture-mobile-donor-password';
const adminPassword = 'fixture-desktop-admin-password';
async function cleanup() {
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  if (apiServer?.listening) await new Promise((resolve) => apiServer.close(resolve));
  if (webServer?.listening) await new Promise((resolve) => webServer.close(resolve));
  if (dbPool) await dbPool.end();
  if (schema && dbOwner) await dbOwner.query(`DROP SCHEMA ${schema} CASCADE`);
  if (dbOwner) await dbOwner.end();
}
const timer = setTimeout(() => {
  console.error('Tempo esgotado no teste mobile.');
  void cleanup().finally(() => app.exit(1));
}, 120000);
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
    for (let i = 0; i < 120; i++) {
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
    const { createApp } = await import(pathToFileURL(join(root, 'api/dist/app.js')).href);
    apiServer = createApp(dbPool).listen(
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
    mobile.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
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
    await d.until('document.body.innerText.includes("Solicitações de pré-triagem")');
    await d.screenshot('04-inicio-hemocentro');
    await d.click('Agendamentos', '.nav-item');
    await d.until('document.body.innerText.includes("Agendamentos para pré-triagem")');
    assert.equal(await d.evaluate('document.querySelector("[name=agendaPassword]")===null'), true);
    await m.click('Agendar pré-triagem');
    await m.until('document.querySelectorAll("[role=radio]").length>=9');
    assert.equal(await m.evaluate('document.querySelector("input[type=password]")===null'), true);
    assert.equal(
      await m.evaluate('document.body.innerText.includes("Você se sente bem hoje?")'),
      false,
    );
    await m.evaluate('document.querySelectorAll("[role=radio]")[2].click()');
    await delay(80);
    await m.evaluate(
      'Array.from(document.querySelectorAll("[role=radio]")).find(e=>e.textContent.includes("09:00 ·")).click()',
    );
    await delay(80);
    await m.screenshot('05-agendar-pre-triagem');
    await m.click('Confirmar agendamento');
    await m.until(
      'document.body.innerText.includes("Sua solicitação já está na agenda do hemocentro")',
    );
    // Sem clicar em Atualizar: o desktop recebe a alteração pelo fluxo de eventos autenticado.
    await d.until(
      'Array.from(document.querySelectorAll("tbody tr")).some(r=>r.textContent.includes("Lia Protótipo"))',
    );
    await d.screenshot('06-solicitacao-recebida');
    await m.click('Ver meus agendamentos');
    await m.until('document.body.innerText.includes("AGENDADO · PRÉ-TRIAGEM PRESENCIAL")');
    await m.screenshot('07-meus-agendamentos');
    await d.click('Cancelar reserva');
    await d.click('Confirmar cancelamento');
    await d.until('document.querySelector("table")?.textContent.includes("Cancelado")');
    await m.click('Atualizar horários e agendamentos');
    await m.until('document.body.innerText.includes("CANCELADO")');
    console.log(
      'Cadastro de doador, login único, botão na homepage e recebimento automático da solicitação no hemocentro verificados.',
    );
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
