const assert = require('node:assert/strict');

(async () => {
    const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8787';
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'edulab-api' });
    const rooms = await fetch(base + '/api/salas');
    assert.equal(rooms.status, 200, 'Aplique a migração local antes deste teste.');
    const { salas } = await rooms.json();
    assert.ok(Array.isArray(salas));
    for (const sala of salas) {
        assert.equal(typeof sala.id, 'string');
        assert.equal(typeof sala.nome, 'string');
        assert.equal(typeof sala.ativa, 'boolean');
    }
    assert.equal((await fetch(base + '/api/salas', { method: 'POST' })).status, 405);
    for (const url of ['/', '/pages/professor.html', '/css/responsividade.css', '/js/store.js', '/imagens/agenda-real.png']) {
        assert.equal((await fetch(base + url)).status, 200, url);
    }
    for (const url of ['/src/worker.mjs', '/tests/store.test.cjs', '/package.json', '/wrangler.jsonc', '/.env', '/api/reservas']) {
        assert.equal((await fetch(base + url)).status, 404, url);
    }
    assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 405);
    console.log('HTTP validado: API, arquivos públicos e bloqueio de arquivos internos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
