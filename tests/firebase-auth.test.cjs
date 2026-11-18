const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const origin = 'https://edulab.test';
const projectId = 'demo-reservas';
const env = { ACCOUNT_ORIGIN: origin, FIREBASE_PROJECT_ID: projectId, FIREBASE_WEB_API_KEY: 'test-public-key' };
const authPath = '/api/conta/entrar';
const worker = import('../src/worker.mjs').then(module => module.default);

function banco(t) {
    const sql = new DatabaseSync(':memory:');
    t.after(() => sql.close());
    for (const file of ['0001_criar_salas', '0002_contas_e_reservas', '0003_identidade_firebase']) {
        sql.exec(readFileSync(join(__dirname, '..', 'migrations', file + '.sql'), 'utf8'));
    }
    const DB = {
        prepare(query) {
            const statement = sql.prepare(query);
            return { bind: (...params) => ({
                first: async () => statement.get(...params) ?? null,
                run: async () => ({ meta: statement.run(...params) }),
            }) };
        },
        async batch(statements) {
            sql.exec('BEGIN');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sql.exec('COMMIT');
                return results;
            } catch (error) {
                sql.exec('ROLLBACK');
                throw error;
            }
        },
    };
    return { sql, DB };
}

async function call(path, config, body, options = {}) {
    const headers = new Headers();
    if (options.cookie) headers.set('Cookie', options.cookie);
    if (body) {
        headers.set('Origin', options.origin ?? origin);
        headers.set('Content-Type', 'application/json');
    }
    return (await worker).fetch(new Request(origin + path, {
        method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
    }), config);
}

test('configuração pública exige o projeto e a chave Web e convites foram desativados', async () => {
    const config = await call('/api/conta/config', env);
    assert.deepEqual(await config.json(), {
        firebaseConfig: { projectId, apiKey: env.FIREBASE_WEB_API_KEY, authDomain: projectId + '.firebaseapp.com' },
    });
    assert.deepEqual(await (await call('/api/conta/config', { ACCOUNT_ORIGIN: origin })).json(), { firebaseConfig: null });
    assert.equal((await call(authPath, { ACCOUNT_ORIGIN: origin }, { idToken: 'token' })).status, 503);
    assert.equal((await call(authPath, env, { idToken: 'token' }, { origin: 'https://outro.test' })).status, 403);
    assert.equal((await call('/api/conta/convites', env, { email: 'professor@exemplo.com' })).status, 404);
});

test('D1 só cria professores com identidade verificada e mantém o papel em novos logins', async t => {
    const { sql, DB } = banco(t);
    const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const key = { ...await exportJWK(publicKey), kid: 'firebase-test' };
    t.mock.method(globalThis, 'fetch', async url => {
        assert.equal(String(url), 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
        return Response.json({ keys: [key] });
    });

    function emitir({ uid = 'professor', email = 'professor@exemplo.com', verificado = true, provider = 'password',
        aud = projectId, authTime = Math.floor(Date.now() / 1000) } = {}) {
        return new SignJWT({ email, email_verified: verificado, auth_time: authTime, firebase: { sign_in_provider: provider } })
            .setProtectedHeader({ alg: 'RS256', kid: 'firebase-test' })
            .setIssuer('https://securetoken.google.com/' + aud).setAudience(aud).setSubject(uid)
            .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    }
    const config = { ...env, DB };
    for (const [claims, status] of [
        [{ verificado: false }, 403],
        [{ aud: 'outro-projeto' }, 401],
        [{ provider: 'anonymous' }, 401],
        [{ authTime: 1 }, 401],
    ]) {
        assert.equal((await call(authPath, config, { idToken: await emitir(claims) })).status, status);
    }
    assert.equal((await call(authPath, config, { idToken: 'token-sem-assinatura' })).status, 401);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contas').get().n, 0);

    const entrar = async (claims, cookie) => call(authPath, config, {
        idToken: await emitir(claims), papel: 'coordenacao',
    }, { cookie });
    const login = await entrar();
    assert.equal(login.status, 200);
    const authCookie = login.headers.get('Set-Cookie');
    assert.match(authCookie, /^__Host-alceu_sessao=\S+; Path=\/; Max-Age=28800; HttpOnly; SameSite=Lax; Secure$/);
    const cookie = authCookie.split(';')[0];
    const sessao = async session => (await (await call('/api/conta/sessao', config, null, { cookie: session })).json()).conta;
    const conta = await sessao(cookie);
    assert.equal(conta.papel, 'professor');
    assert.equal((await call('/api/agenda/acao', config, { acao: 'addRoom', args: ['Laboratório'] }, { cookie })).status, 403);
    assert.equal((await entrar({ uid: 'outra-identidade' })).status, 409);

    sql.prepare("UPDATE contas SET papel = 'coordenacao' WHERE id = ?").run(conta.id);
    const retorno = await entrar({ provider: 'google.com' }, cookie);
    const outraSessao = retorno.headers.get('Set-Cookie').split(';')[0];
    assert.equal(await sessao(cookie), null, 'A sessão anterior foi revogada.');
    assert.equal((await sessao(outraSessao)).papel, 'coordenacao');
    assert.equal((await call('/api/agenda/acao', config, { acao: 'addRoom', args: ['Laboratório'] }, { cookie: outraSessao })).status, 200);

    await call('/api/conta/sair', config, {}, { cookie: outraSessao });
    assert.equal(await sessao(outraSessao), null);
});
