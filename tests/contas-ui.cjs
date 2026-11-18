const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.UI_BASE_URL || 'http://localhost:8787';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const requests = [];
        let conta = null;
        await page.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname;
            if (path === '/api/conta/config') return route.fulfill({ json: { firebaseConfig: { projectId: 'demo-alceu' } } });
            if (path === '/api/conta/sessao') return route.fulfill({ json: { conta } });
            if (path === '/api/agenda/salas') return route.fulfill({ json: { salas: [], reservas: [] } });
            requests.push(path);
            if (path === '/api/conta/entrar') {
                assert.ok(['token-email-teste', 'token-google-teste'].includes(route.request().postDataJSON().idToken));
                conta = { email: 'professor@exemplo.com', papel: 'professor' };
                return route.fulfill({ json: { ok: true } });
            }
            if (path === '/api/conta/sair') {
                conta = null;
                return route.fulfill({ json: { ok: true } });
            }
            return route.fulfill({ status: 404, json: { error: 'Rota não encontrada.' } });
        });
        await page.route('**/js/firebase-conta.js', route => route.fulfill({
            contentType: 'application/javascript',
            body: `export function prepararLogin() {
                return {
                    entrar: async (email, password, api) => {
                        if (email === 'nao-confirmado@exemplo.com') return false;
                        await api('conta/entrar', { idToken: 'token-email-teste' });
                        return true;
                    },
                    cadastrar: async () => {},
                    reenviar: async () => {},
                    redefinir: async () => {},
                    entrarGoogle: async api => api('conta/entrar', { idToken: 'token-google-teste' }),
                };
            }`,
        }));

        await page.goto(base + '/pages/conta.html');
        await page.waitForURL(base + '/');
        assert.equal(await page.getByRole('heading', { name: 'Bem-vindo de volta.' }).isVisible(), true);
        const email = page.getByRole('textbox', { name: 'E-mail', exact: true });
        const password = page.getByLabel('Senha', { exact: true });
        const entrar = page.getByRole('button', { name: 'Entrar', exact: true });

        await email.fill('coordenacao@demo.com');
        await password.fill('123456');
        await entrar.click();
        await page.waitForURL('**/pages/proatec.html');
        assert.deepEqual(requests, [], 'A conta de desenvolvimento só usa o armazenamento local.');

        await page.goto(base + '/');
        await email.fill('nao-confirmado@exemplo.com');
        await password.fill('senha-de-teste');
        await page.getByRole('button', { name: 'Criar conta' }).click();
        await page.getByText('Enviamos um link de confirmação.', { exact: false }).waitFor();
        await password.fill('senha-de-teste');
        await entrar.click();
        await page.getByText('Confirme seu e-mail antes de entrar.').waitFor();
        assert.deepEqual(requests, []);
        await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
        await page.getByText('Enviamos outro link de confirmação.').waitFor();
        await page.getByRole('button', { name: 'Esqueceu a senha?' }).click();
        await page.getByText('Se o endereço tiver uma conta', { exact: false }).waitFor();

        await email.fill('professor@exemplo.com');
        await password.fill('senha-de-teste');
        await entrar.click();
        await page.waitForURL('**/pages/conta.html');
        await page.getByRole('heading', { name: 'Agenda de salas' }).waitFor();
        assert.equal(await page.locator('#area-coordenacao').isVisible(), false);
        assert.equal(await page.getByRole('button', { name: 'Entrar com Google' }).count(), 0);
        assert.deepEqual(requests, ['/api/conta/entrar']);

        await page.getByRole('button', { name: 'Sair', exact: true }).click();
        await page.waitForURL(base + '/');
        await page.getByRole('button', { name: 'Entrar com Google' }).click();
        await page.waitForURL('**/pages/conta.html');
        await page.getByRole('heading', { name: 'Agenda de salas' }).waitFor();
        assert.deepEqual(requests, ['/api/conta/entrar', '/api/conta/sair', '/api/conta/entrar']);
        console.log('Acesso unificado validado: demonstração, cadastro e login por e-mail ou Google.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
