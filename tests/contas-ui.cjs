const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.UI_BASE_URL || 'http://localhost:8787';
const fixture = process.env.UI_CONVITE_FILE;
const future = '2099-09-14';

async function navegador(browser) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
            isUserVerified: true, automaticPresenceSimulation: true,
        },
    });
    return page;
}

async function aceitar(page, convite) {
    await page.goto(base + '/pages/conta.html' + new URL(convite).hash);
    await page.getByRole('button', { name: 'Criar chave de acesso' }).click();
    const result = page.getByRole('heading', { name: 'Agenda de salas' });
    const erro = page.locator('#erro-conta');
    await result.or(erro.filter({ visible: true })).waitFor();
    assert.equal(await erro.isVisible(), false, await erro.textContent());
}

function post(page, path, body) {
    return page.evaluate(async ({ path, body }) => {
        const res = await fetch('/api/' + path, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        return { status: res.status, data: await res.json() };
    }, { path, body });
}

(async () => {
    assert.ok(fixture, 'Defina UI_CONVITE_FILE com um convite de coordenação do D1 local.');
    const browser = await chromium.launch();
    try {
        const coord = await navegador(browser);
        const professor = await navegador(browser);
        const adminLink = fs.readFileSync(fixture, 'utf8').trim();
        await aceitar(coord, adminLink);
        assert.ok(await coord.locator('#area-coordenacao').isVisible());

        const suffix = Date.now();
        await coord.locator('#nome-sala').fill('Sala de teste ' + suffix);
        await coord.getByRole('button', { name: 'Cadastrar sala' }).click();
        await coord.locator('#salas').getByText('Sala de teste ' + suffix + ' · Ativa').waitFor();

        await coord.locator('#email-convite').fill('professor-' + suffix + '@exemplo.com');
        await coord.getByRole('button', { name: 'Gerar convite' }).click();
        await coord.locator('#convite-gerado').waitFor();
        const invitation = await coord.locator('#link-convite').inputValue();
        await aceitar(professor, invitation);
        assert.equal(await professor.locator('#area-coordenacao').isVisible(), false);
        assert.equal((await post(professor, 'conta/convites', { email: 'outro@exemplo.com' })).status, 403);

        const other = await navegador(browser);
        await other.goto(base + '/pages/conta.html');
        const replay = await post(other, 'conta/cadastro/opcoes', { convite: new URL(invitation).hash.split('=')[1] });
        assert.equal(replay.status, 404);
        assert.equal((await other.request.get(base + '/api/agenda/salas')).status(), 401);
        assert.equal((await other.request.post(base + '/api/conta/login/opcoes', {
            headers: { Origin: 'https://outro.exemplo.com' }, data: {},
        })).status(), 403);

        const rooms = (await coord.request.get(base + '/api/agenda/salas')).ok();
        assert.equal(rooms, true);
        const salas = (await (await coord.request.get(base + '/api/salas')).json()).salas;
        const salaId = salas.find(sala => sala.nome === 'Sala de teste ' + suffix).id;
        const booking = { salaId, data: future, inicio: '07:00', fim: '07:50' };
        const first = await Promise.all([post(professor, 'agenda/reservar', booking), post(professor, 'agenda/reservar', booking)]);
        assert.deepEqual(first.map(result => result.status).sort(), [201, 409]);
        assert.equal((await post(coord, 'agenda/reservar', { ...booking, inicio: '07:50', fim: '08:40' })).status, 201);

        await professor.locator('#data-agenda').fill(future);
        await professor.getByText('07:00–07:50 · Sala de teste ' + suffix + ' · Sua reserva').waitFor();
        await professor.getByText('07:50–08:40 · Sala de teste ' + suffix).waitFor();
        const reservations = await (await professor.request.get(base + '/api/agenda/salas?data=' + future)).json();
        const otherId = reservations.reservas.find(item => !item.minha).id;
        assert.equal((await post(professor, 'agenda/cancelar', { id: otherId })).status, 404);

        await professor.getByRole('button', { name: 'Sair', exact: true }).click();
        await professor.waitForURL(base + '/');
        assert.equal((await professor.request.get(base + '/api/agenda/salas')).status(), 401);
        await professor.goto(base + '/pages/conta.html');
        await professor.getByRole('button', { name: 'Entrar com chave de acesso' }).click();
        await professor.getByRole('heading', { name: 'Agenda de salas' }).waitFor();
        console.log('Contas validadas: chave de acesso, convite único, sessão, perfis, D1 e reservas concorrentes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
