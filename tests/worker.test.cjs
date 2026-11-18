const test = require('node:test');
const assert = require('node:assert/strict');

const worker = import('../src/worker.mjs').then(module => module.default);
const request = (pathname, method = 'GET') => new Request('https://edulab.test' + pathname, { method });

test('health informa apenas a disponibilidade da API e não permite cache', async () => {
    const response = await (await worker).fetch(request('/api/health'), {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, service: 'edulab-api' });
});

test('health aceita HEAD e rejeita escrita', async () => {
    const head = await (await worker).fetch(request('/api/health', 'HEAD'), {});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const post = await (await worker).fetch(request('/api/health', 'POST'), {});
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('Allow'), 'GET, HEAD');
});

test('rotas desconhecidas da API retornam JSON 404, sem cair na página HTML', async () => {
    for (const route of ['/api', '/api/reservas', '/api/health/extra']) {
        const response = await (await worker).fetch(request(route), {});
        assert.equal(response.status, 404);
        assert.ok(response.headers.get('Content-Type').includes('application/json'));
    }
});

test('arquivos da interface são encaminhados ao binding de assets', async () => {
    const original = request('/pages/professor.html');
    const response = await (await worker).fetch(original, {
        ASSETS: { fetch: req => { assert.equal(req, original); return new Response('tela'); } },
    });
    assert.equal(await response.text(), 'tela');
});

test('a raiz serve index.html sem mudar os caminhos das páginas existentes', async () => {
    await (await worker).fetch(request('/'), {
        ASSETS: { fetch: req => {
            assert.equal(new URL(req.url).pathname, '/index.html');
            return new Response('acesso');
        } },
    });
});

test('salas converte o booleano do SQL e não expõe metadados do banco', async () => {
    const response = await (await worker).fetch(request('/api/salas'), {
        DB: { prepare: () => ({ all: async () => ({ results: [
            { id: 's1', nome: 'Ativa', ativa: 1 }, { id: 's2', nome: 'Inativa', ativa: 0 },
        ], meta: { internal: 'não expor' } }) }) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { salas: [
        { id: 's1', nome: 'Ativa', ativa: true }, { id: 's2', nome: 'Inativa', ativa: false },
    ] });
});

test('salas aceita banco vazio e HEAD; rejeita escrita sem consultar o banco', async () => {
    const env = { DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } };
    const empty = await (await worker).fetch(request('/api/salas'), env);
    assert.deepEqual(await empty.json(), { salas: [] });
    const head = await (await worker).fetch(request('/api/salas', 'HEAD'), env);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const post = await (await worker).fetch(request('/api/salas', 'POST'), {});
    assert.equal(post.status, 405);
});

test('falha no banco retorna 503 sem detalhes internos', async () => {
    const response = await (await worker).fetch(request('/api/salas'), {
        DB: { prepare: () => { throw new Error('SQL e detalhes internos'); } },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('SQL e detalhes internos'), false);
});
