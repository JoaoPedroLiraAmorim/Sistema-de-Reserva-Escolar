import { base64url, createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, json, readJson } from './http.mjs';

const DURACAO_SESSAO = 8 * 60 * 60;
const CHAVES_FIREBASE = createRemoteJWKSet(new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
));
const agora = () => Math.floor(Date.now() / 1000);
const token = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
const tokenValido = value => typeof value === 'string' && /^[\w-]{43}$/.test(value);

async function hash(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return base64url.encode(new Uint8Array(digest));
}

export function origemDaConta(url, env) {
    if (env.ACCOUNT_ORIGIN === url.origin && url.protocol === 'https:') return url;
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return url;
    return null;
}

export function firebaseConfig(env) {
    const projectId = env.FIREBASE_PROJECT_ID;
    const apiKey = env.FIREBASE_WEB_API_KEY;
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId ?? '') || !apiKey) return null;
    return { projectId, apiKey, authDomain: `${projectId}.firebaseapp.com` };
}

function cookies(url) {
    const secure = url.protocol === 'https:';
    const name = secure ? '__Host-alceu_sessao' : 'alceu_sessao';
    return {
        ler(request) {
            return request.headers.get('Cookie')?.split(';').map(item => item.trim())
                .find(item => item.startsWith(name + '='))?.slice(name.length + 1);
        },
        criar(value, maxAge) {
            return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
        },
    };
}

export async function sessao(request, db, url) {
    const value = cookies(url).ler(request);
    if (!tokenValido(value)) return null;
    return db.prepare(`SELECT c.id, c.email, c.papel FROM sessoes s
        JOIN contas c ON c.id = s.conta_id
        WHERE s.hash = ? AND s.expira > ? AND c.ativa = 1`).bind(await hash(value), agora()).first();
}

async function abrirSessao(request, db, url, contaId) {
    const value = token();
    const anterior = cookies(url).ler(request);
    const statements = [db.prepare('DELETE FROM sessoes WHERE expira <= ?').bind(agora())];
    if (tokenValido(anterior)) {
        statements.push(db.prepare('DELETE FROM sessoes WHERE hash = ?').bind(await hash(anterior)));
    }
    statements.push(db.prepare('INSERT INTO sessoes (hash, conta_id, expira) VALUES (?, ?, ?)')
        .bind(await hash(value), contaId, agora() + DURACAO_SESSAO));
    await db.batch(statements);
    return cookies(url).criar(value, DURACAO_SESSAO);
}

async function identidadeFirebase(config, idToken) {
    if (typeof idToken !== 'string' || !idToken || idToken.length > 16_000) {
        throw new HttpError(400, 'Login inválido.');
    }
    const result = await jwtVerify(idToken, CHAVES_FIREBASE, {
        issuer: 'https://securetoken.google.com/' + config.projectId,
        audience: config.projectId,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat', 'auth_time', 'email', 'email_verified'],
        maxTokenAge: '5 minutes',
    }).catch(() => null);
    const claims = result?.payload;
    const provider = claims?.firebase?.sign_in_provider;
    if (typeof claims?.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !['google.com', 'password'].includes(provider) || !Number.isInteger(claims.auth_time) ||
        claims.auth_time < agora() - 300 || claims.auth_time > agora() + 30) {
        throw new HttpError(401, 'Entre novamente para continuar.');
    }
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (claims.email_verified !== true || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(403, 'Confirme seu e-mail para entrar.');
    }
    return { id: `firebase:${config.projectId}:${claims.sub}`, email };
}

async function vincularConta(db, identidade) {
    // O papel inicial é decidido aqui, mesmo quando o cliente envia outro papel.
    await db.prepare(`INSERT INTO contas (id, email, papel, identidade_externa)
        VALUES (?, ?, 'professor', ?) ON CONFLICT DO NOTHING`)
        .bind(crypto.randomUUID(), identidade.email, identidade.id).run();
    const conta = await db.prepare('SELECT id, email, ativa FROM contas WHERE identidade_externa = ?')
        .bind(identidade.id).first();
    if (!conta) throw new HttpError(409, 'Este e-mail já está vinculado a outra conta. Procure a coordenação.');
    if (conta.ativa !== 1) throw new HttpError(403, 'Esta conta está desativada.');
    if (conta.email !== identidade.email) {
        const alteracao = await db.prepare(`UPDATE contas SET email = ? WHERE id = ?
            AND NOT EXISTS (SELECT 1 FROM contas WHERE email = ? AND id <> ?)`)
            .bind(identidade.email, conta.id, identidade.email, conta.id).run();
        if (alteracao.meta.changes !== 1) throw new HttpError(409, 'Este e-mail já está vinculado a outra conta.');
    }
    return conta.id;
}

export async function rotaConta(request, env, url) {
    const { pathname } = url;
    const { DB } = env;
    if (request.method === 'GET' && pathname === '/api/conta/config') return json({ firebaseConfig: firebaseConfig(env) });
    if (request.method === 'GET' && pathname === '/api/conta/sessao') return json({ conta: await sessao(request, DB, url) });
    if (request.method !== 'POST') return json({ error: 'Rota não encontrada.' }, 404);
    if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origem não autorizada.');
    if (pathname === '/api/conta/sair') {
        const cookie = cookies(url);
        const value = cookie.ler(request);
        if (tokenValido(value)) await DB.prepare('DELETE FROM sessoes WHERE hash = ?').bind(await hash(value)).run();
        return json({ ok: true }, 200, { 'Set-Cookie': cookie.criar('', 0) });
    }
    if (pathname === '/api/conta/entrar') {
        const config = firebaseConfig(env);
        if (!config) throw new HttpError(503, 'O login ainda está sendo configurado.');
        const { idToken } = await readJson(request);
        const identidade = await identidadeFirebase(config, idToken);
        const contaId = await vincularConta(DB, identidade);
        return json({ ok: true }, 200, { 'Set-Cookie': await abrirSessao(request, DB, url, contaId) });
    }
    return json({ error: 'Rota não encontrada.' }, 404);
}
