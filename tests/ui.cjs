const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Interceptação serve os arquivos locais, sem servidor ou dependência da rede.
const root = path.resolve(__dirname, '..');
const artifacts = process.env.UI_ARTIFACT_DIR;
const sizes = [[320, 740], [390, 844], [768, 1024], [820, 1180], [1024, 768], [1366, 768], [1920, 1080], [844, 390]];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));

(async () => {
    const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
    try {
        const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.hostname !== 'edulab.test') return route.abort();
            const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
            if (!file.startsWith(root + path.sep)) return route.fulfill({ status: 403, body: '' });
            const type = { '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html' }[path.extname(file)];
            try { await route.fulfill({ body: fs.readFileSync(file), contentType: type || 'application/octet-stream' }); }
            catch { await route.fulfill({ status: 404, body: '' }); }
        });
        const visit = async file => { await page.goto('https://edulab.test/' + file); await page.waitForTimeout(80); };
        const login = async role => page.evaluate(role => ERS.login(role + '@demo.com', '123456'), role);
        const noOverflow = async label => {
            const d = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(d.scroll <= d.width + 1, label + ': página ultrapassa a tela');
        };
        const screenshot = async name => {
            if (!artifacts) return;
            fs.mkdirSync(artifacts, { recursive: true });
            await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true });
        };
        await visit('index.html');
        assert.equal(await page.locator('[data-role]').count(), 2);
        for (const [width, height] of sizes) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => ERS.logout()); await visit('index.html');
            await noOverflow('login ' + width);
            await login('professor'); await visit('pages/professor.html');
            await noOverflow('professor ' + width);
            assert.equal(await page.locator('[data-res-tab]').count(), 0);
            assert.equal(await page.locator('#my-reservations-section').isVisible(), false);
            if (width <= 1100) assert.equal(await page.locator('.day-slot').count(), 6);
            if (width === 1366) {
                await page.locator('[data-agenda-mode="list"]').click();
                assert.equal(await page.locator('.day-slot').count(), 6);
                await page.locator('[data-agenda-mode="grid"]').click();
                assert.equal(await page.locator('#calendarTable').isVisible(), true);
            }
            if ([390, 1366].includes(width)) await screenshot('professor-' + width);
            await page.locator('#btnOpenNewReservation').click(); await page.waitForTimeout(50);
            assert.equal(await page.locator('.booking-section').count(), 2);
            const footer = await page.locator('#new-reservation-form > .modal-footer').boundingBox();
            assert.ok(footer.y >= 0 && footer.y + footer.height <= height + 2, 'rodapé acessível em ' + width);
            if (width === 844) await screenshot('reserva-horizontal');
            await page.keyboard.press('Escape');
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await visit('pages/professor.html');
        await page.locator('#btnOpenNewReservation').click();
        await page.locator('#res-date').fill(await page.evaluate(() => ERS.dayOffset(14)));
        await page.locator('#res-start').selectOption('07:00'); await page.locator('#res-end').selectOption('07:50');
        await page.locator('#res-brand').selectOption('Dell'); await page.locator('#res-quantity').fill('2');
        await screenshot('reserva-celular');
        await page.locator('#new-reservation-form button[type="submit"]').click();
        assert.equal(await page.locator('#v2-review').isVisible(), true);
        await screenshot('conferencia-celular');
        await page.locator('#v2-confirm-res').click();
        assert.equal(await page.locator('#new-reservation-modal').isVisible(), false);
        const saved = await page.evaluate(() => ERS.getReservations().find(r => !r.id.startsWith('mock-res-')));
        assert.equal(saved.marca, 'Dell'); assert.equal(saved.notebooks, 2);
        await page.locator('#tab-reservas').click();
        assert.equal(await page.locator('#teacher-agenda-panel').isVisible(), false);
        assert.equal(await page.locator('#my-reservations-section').isVisible(), true);
        await screenshot('proximas-celular');
        await page.locator('#tab-reservas').focus(); await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#tab-agenda').getAttribute('aria-selected'), 'true');
        await page.locator('#v2-room-filter').selectOption('Aquário');
        await page.locator('.day-slot-book').first().click();
        assert.equal(await page.locator('[name="resource-type"][value="sala"]').isChecked(), true);
        assert.equal(await page.locator('#res-room').inputValue(), 'Aquário');
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
            ERS.createBlock({data:ERS.dayOffset(14),inicio:'07:00',fim:'07:50',motivo:'Bloqueio de teste',criadoPor:'Coordenação'});
            window.dispatchEvent(new Event('ers:reservations-updated'));
        });
        await page.locator('#tab-reservas').click();
        assert.equal(await page.locator('.my-res-item.reservation-blocked').count(), 1);
        assert.equal(await page.locator('.reservation-blocked .btn-secondary').count(), 0);
        await page.evaluate(() => {
            const all = ERS.getReservations();
            all.push({ id: 'expired-test', data: ERS.dayOffset(-1), inicio: '07:00', fim: '07:50', alunosNotebooks: [{ aluno: 'Teste' }] });
            localStorage.setItem('ers_reservations', JSON.stringify(all)); ERS.getReservations();
        });
        assert.equal(await page.evaluate(() => localStorage.getItem('ers_reservations').includes('expired-test')), false);

        await login('coordenacao');
        for (const [width, height] of [[320, 740], [820, 1180], [1366, 768]]) {
            await page.setViewportSize({ width, height });
            for (const file of ['proatec', 'agendaProatec', 'equipamentos', 'salas', 'bloqueios', 'relatorio']) {
                await visit('pages/' + file + '.html'); await noOverflow(file + ' ' + width);
                assert.ok(page.url().endsWith(file + '.html'));
                if (file === 'proatec') {
                    assert.equal(await page.locator('.coord-metric').count(), 4);
                    if (width === 1366 || width === 320) await screenshot('coordenacao-' + width);
                    if (width === 320) {
                        await page.locator('#v2-mobile-menu').click();
                        assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), true);
                        await page.locator('#sidebarBackdrop').click({position:{x:310,y:200}});
                        assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), false);
                    }
                }
                if (file === 'agendaProatec' && width === 820) assert.equal(await page.locator('#v2-day-list').isVisible(), true);
            }
        }
        await visit('pages/agendaProatec.html');
        await page.locator('#btnOpenNewReservation').click();
        await page.locator('#res-professor').selectOption('u4');
        await page.locator('#res-date').fill(await page.evaluate(() => ERS.dayOffset(15)));
        await page.locator('#res-start').selectOption('07:00'); await page.locator('#res-end').selectOption('07:50');
        await page.locator('[name="resource-type"][value="sala"]').check();
        await page.locator('#res-room').selectOption('Aquário');
        await page.locator('#new-reservation-form button[type="submit"]').click();
        await page.locator('#v2-confirm-res').click();
        const coordinated = await page.evaluate(() => ERS.getReservations().at(-1));
        assert.equal(coordinated.professorId, 'u4'); assert.equal(coordinated.notebooks, 0); assert.equal(coordinated.sala, 'Aquário');
        await login('proatec');
        assert.equal(await page.evaluate(() => ERS.getSession().role), 'coordenacao');
        await visit('pages/bloqueios.html'); assert.ok(page.url().endsWith('/bloqueios.html'));
        assert.deepEqual(errors, [], 'sem exceções JavaScript');
        console.log('UI validada: 8 viewports, 6 telas de coordenação, formulário, conferência, abas, marca, vínculo do professor, expiração e perfil legado.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
