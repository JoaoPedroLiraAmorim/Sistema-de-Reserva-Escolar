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

test('login Google exige configuração, mesma origem e estado ligado ao navegador', async () => {
    const app = await worker;
    const origin = 'https://edulab.test';
    const env = { ACCOUNT_ORIGIN: origin };
    const start = origin + '/api/conta/google/iniciar';
    const attempt = source => new Request(start, {
        method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal((await app.fetch(attempt(origin), env)).status, 503);
    assert.equal((await app.fetch(attempt('https://fora.test'), env)).status, 403);

    const google = { ...env, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'test-secret' };
    const callback = origin + '/api/conta/google/retorno?state=' + 'a'.repeat(43) + '&code=test';
    const response = await app.fetch(new Request(callback), google);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), '/pages/conta.html?erro=google');
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0; HttpOnly; SameSite=Lax; Secure/);
});

test('retorno Google verifica assinatura e emite sessão para conta Google convidada', async t => {
    const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const key = { ...await exportJWK(publicKey), kid: 'key' };
    const jwt = await new SignJWT({ nonce: 'nonce', email: 'professor@escola.edu.br', email_verified: true, hd: 'escola.edu.br' })
        .setProtectedHeader({ alg: 'RS256', kid: 'key' })
        .setIssuer('https://accounts.google.com').setAudience('client').setSubject('subject')
        .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (String(url) === 'https://oauth2.googleapis.com/token') {
            assert.equal(options.body.get('code_verifier'), 'verifier');
            return Response.json({ id_token: jwt });
        }
        assert.equal(String(url), 'https://www.googleapis.com/oauth2/v3/certs');
        return Response.json({ keys: [key] });
    });

    const db = {
        prepare(sql) {
            return { bind: (...values) => ({
                async first() {
                    if (sql.startsWith('DELETE FROM desafios')) {
                        assert.equal(values[1], 'google');
                        return { desafio: 'nonce', verificador: 'verifier', convite: null };
                    }
                    assert.match(sql, /FROM contas WHERE google_sub/);
                    assert.deepEqual(values, ['subject', 'professor@escola.edu.br']);
                    return { id: 'conta-existente' };
                },
                sql,
            }) };
        },
        async batch(statements) {
            assert.ok(statements.some(statement => statement.sql.startsWith('INSERT INTO sessoes')));
        },
    };
    const state = 'a'.repeat(43);
    const response = await (await worker).fetch(new Request(
        'https://edulab.test/api/conta/google/retorno?code=test&state=' + state,
        { headers: { Cookie: '__Host-alceu_google=' + state } },
    ), { ACCOUNT_ORIGIN: 'https://edulab.test', DB: db, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'test-secret' });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), '/pages/conta.html');
    assert.ok(response.headers.getSetCookie().some(cookie => /^__Host-alceu_sessao=\S+; Path=\/; Max-Age=28800; HttpOnly; SameSite=Lax; Secure$/.test(cookie)));
});
