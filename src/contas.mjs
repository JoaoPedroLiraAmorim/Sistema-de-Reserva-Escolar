import {
    generateAuthenticationOptions, generateRegistrationOptions,
    verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { base64url, createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, json, readJson } from './http.mjs';

const DURACAO_SESSAO = 8 * 60 * 60;
const DURACAO_CONVITE = 48 * 60 * 60;
const DURACAO_DESAFIO = 5 * 60;
const PAGINA = '/pages/conta.html';
const CALLBACK_GOOGLE = '/api/conta/google/retorno';
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

function googleDisponivel(env) {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function cookies(url) {
    const secure = url.protocol === 'https:';
    const prefix = secure ? '__Host-alceu_' : 'alceu_';
    return {
        ler(request, key) {
            const cookie = request.headers.get('Cookie')?.split(';').map(item => item.trim())
                .find(item => item.startsWith(prefix + key + '='));
            return cookie?.slice(prefix.length + key.length + 1);
        },
        criar(key, value, maxAge) {
            return `${prefix}${key}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
        },
    };
}

function redirect(location, ...setCookies) {
    const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
    return new Response(null, { status: 303, headers });
}

export async function sessao(request, db, url) {
    const value = cookies(url).ler(request, 'sessao');
    if (!tokenValido(value)) return null;
    return db.prepare(`SELECT c.id, c.email, c.papel FROM sessoes s
        JOIN contas c ON c.id = s.conta_id
        WHERE s.hash = ? AND s.expira > ? AND c.ativa = 1`).bind(await hash(value), agora()).first();
}

async function abrirSessao(request, db, url, conta) {
    const value = token();
    const anterior = cookies(url).ler(request, 'sessao');
    const statements = [db.prepare('DELETE FROM sessoes WHERE expira <= ?').bind(agora())];
    if (tokenValido(anterior)) {
        statements.push(db.prepare('DELETE FROM sessoes WHERE hash = ?').bind(await hash(anterior)));
    }
    statements.push(db.prepare('INSERT INTO sessoes (hash, conta_id, expira) VALUES (?, ?, ?)')
        .bind(await hash(value), conta, agora() + DURACAO_SESSAO));
    await db.batch(statements);
    return cookies(url).criar('sessao', value, DURACAO_SESSAO);
}

function emailValido(value) {
    return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function convitePorHash(db, convite) {
    return db.prepare('SELECT email, papel FROM convites WHERE hash = ? AND expira > ?').bind(convite, agora()).first();
}

async function criarConta(db, convite, credenciais) {
    const id = crypto.randomUUID();
    const [insert] = await db.batch([
        db.prepare(`INSERT INTO contas (id, email, papel, google_sub, chave_id, chave_publica, contador)
            SELECT ?, email, papel, ?, ?, ?, ? FROM convites WHERE hash = ? AND expira > ?
            ON CONFLICT(email) DO NOTHING`).bind(id, credenciais.google ?? null, credenciais.chave?.id ?? null,
            credenciais.chave ? base64url.encode(credenciais.chave.publicKey) : null,
            credenciais.chave?.counter ?? 0, convite, agora()),
        db.prepare('DELETE FROM convites WHERE hash = ? AND EXISTS (SELECT 1 FROM contas WHERE id = ?)').bind(convite, id),
    ]);
    if (insert.meta.changes !== 1) throw new HttpError(409, 'Este convite já foi usado ou expirou.');
    return id;
}

async function salvarDesafio(db, tipo, desafio, convite = null, verificador = null) {
    const id = token();
    await db.batch([
        db.prepare('DELETE FROM desafios WHERE expira <= ?').bind(agora()),
        db.prepare('INSERT INTO desafios (id, tipo, desafio, convite, verificador, expira) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(await hash(id), tipo, desafio, convite, verificador, agora() + DURACAO_DESAFIO),
    ]);
    return id;
}

async function consumirDesafio(db, tipo, id) {
    if (!tokenValido(id)) throw new HttpError(400, 'Sessão de login inválida. Tente novamente.');
    const flow = await db.prepare(`DELETE FROM desafios WHERE id = ? AND tipo = ? AND expira > ?
        RETURNING desafio, convite, verificador`).bind(await hash(id), tipo, agora()).first();
    if (!flow) throw new HttpError(400, 'Sessão de login expirada. Tente novamente.');
    return flow;
}

async function chaveOptions(db, url, cadastro, body) {
    let convite = null;
    let options;
    if (cadastro) {
        if (!tokenValido(body.convite)) throw new HttpError(400, 'Convite inválido.');
        convite = await hash(body.convite);
        const dados = await convitePorHash(db, convite);
        if (!dados) throw new HttpError(404, 'Convite inválido, usado ou expirado.');
        options = await generateRegistrationOptions({
            rpID: url.hostname,
            rpName: 'Alceu Reservas',
            userName: dados.email,
            attestationType: 'none',
            authenticatorSelection: { userVerification: 'required', residentKey: 'required' },
        });
    } else {
        options = await generateAuthenticationOptions({ rpID: url.hostname, userVerification: 'required' });
    }
    return json({ options, id: await salvarDesafio(db, cadastro ? 'cadastro' : 'login', options.challenge, convite) });
}

async function chaveVerificar(request, db, url, cadastro, body) {
    const flow = await consumirDesafio(db, cadastro ? 'cadastro' : 'login', body.id);
    const response = body.credencial;
    if (typeof response?.id !== 'string' || response.id.length > 1400) {
        throw new HttpError(400, 'Chave de acesso inválida.');
    }
    const expected = { expectedOrigin: url.origin, expectedRPID: url.hostname, expectedChallenge: flow.desafio, requireUserVerification: true };
    let conta;
    if (cadastro) {
        const result = await verifyRegistrationResponse({ ...expected, response }).catch(() => null);
        if (!result?.verified) throw new HttpError(400, 'O navegador não confirmou a chave de acesso.');
        conta = await criarConta(db, flow.convite, { chave: result.registrationInfo.credential });
    } else {
        const row = await db.prepare('SELECT id, chave_publica, contador FROM contas WHERE chave_id = ? AND ativa = 1')
            .bind(response.id).first();
        if (!row) throw new HttpError(401, 'Chave de acesso não reconhecida.');
        const result = await verifyAuthenticationResponse({
            ...expected, response,
            credential: { id: response.id, publicKey: base64url.decode(row.chave_publica), counter: row.contador },
        }).catch(() => null);
        if (!result?.verified) throw new HttpError(401, 'Chave de acesso inválida. Tente novamente.');
        const updated = await db.prepare('UPDATE contas SET contador = ? WHERE id = ? AND contador = ? AND ativa = 1')
            .bind(result.authenticationInfo.newCounter, row.id, row.contador).run();
        if (updated.meta.changes !== 1) throw new HttpError(409, 'O acesso mudou. Tente novamente.');
        conta = row.id;
    }
    return json({ ok: true }, 200, { 'Set-Cookie': await abrirSessao(request, db, url, conta) });
}

async function googleOptions(db, url, env, body) {
    if (!googleDisponivel(env)) throw new HttpError(503, 'O acesso pelo Google ainda não está disponível.');
    let convite = null;
    if (body.convite !== undefined) {
        if (!tokenValido(body.convite)) throw new HttpError(400, 'Convite inválido.');
        convite = await hash(body.convite);
        if (!await convitePorHash(db, convite)) throw new HttpError(404, 'Convite inválido, usado ou expirado.');
    }
    const nonce = token();
    const verifier = token();
    const state = await salvarDesafio(db, 'google', nonce, convite, verifier);
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorize.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + CALLBACK_GOOGLE,
        response_type: 'code', scope: 'openid email', state, nonce,
        code_challenge: await hash(verifier), code_challenge_method: 'S256', prompt: 'select_account',
    }).toString();
    return json({ url: authorize.href }, 200, { 'Set-Cookie': cookies(url).criar('google', state, DURACAO_DESAFIO) });
}

async function googleCallback(request, db, url, env) {
    const cookie = cookies(url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const clear = cookie.criar('google', '', 0);
    try {
        if (!googleDisponivel(env) || !code || code.length > 2048 || !tokenValido(state) || state !== cookie.ler(request, 'google')) {
            throw new HttpError(400, 'Acesso pelo Google interrompido.');
        }
        const flow = await consumirDesafio(db, 'google', state);
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
            body: new URLSearchParams({
                grant_type: 'authorization_code', code, code_verifier: flow.verificador,
                redirect_uri: url.origin + CALLBACK_GOOGLE,
                client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
            }),
        });
        if (!response.ok) throw new HttpError(401, 'O Google recusou este acesso.');
        const { id_token: idToken } = await response.json();
        const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), {
            issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID,
            algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'nonce', 'email', 'email_verified'],
            maxTokenAge: '5 minutes',
        });
        const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
        const trustedEmail = email.endsWith('@gmail.com') || Boolean(payload.hd);
        if (payload.nonce !== flow.desafio || payload.email_verified !== true || !emailValido(email) || !trustedEmail ||
            (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== env.GOOGLE_CLIENT_ID)) {
            throw new HttpError(401, 'O Google não confirmou este endereço.');
        }
        let conta;
        if (flow.convite) {
            const convite = await convitePorHash(db, flow.convite);
            if (convite?.email !== email) throw new HttpError(403, 'Use o endereço exato do convite.');
            conta = await criarConta(db, flow.convite, { google: payload.sub });
        } else {
            const row = await db.prepare('SELECT id FROM contas WHERE google_sub = ? AND email = ? AND ativa = 1')
                .bind(payload.sub, email).first();
            if (!row) throw new HttpError(403, 'Conta sem acesso. Abra o convite enviado pela coordenação.');
            conta = row.id;
        }
        return redirect(PAGINA, clear, await abrirSessao(request, db, url, conta));
    } catch (error) {
        const reason = error instanceof HttpError && error.status === 403 ? 'convite' : 'google';
        return redirect(PAGINA + '?erro=' + reason, clear);
    }
}

async function criarConvite(db, email) {
    if (!emailValido(email)) throw new HttpError(400, 'Informe um e-mail válido.');
    const value = token();
    const result = await db.prepare(`INSERT INTO convites (hash, email, papel, expira)
        SELECT ?, ?, 'professor', ? WHERE NOT EXISTS (SELECT 1 FROM contas WHERE email = ?)
        ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, expira = excluded.expira
        WHERE convites.papel = 'professor'`).bind(await hash(value), email, agora() + DURACAO_CONVITE, email).run();
    if (result.meta.changes !== 1) throw new HttpError(409, 'Este e-mail já está cadastrado ou tem um convite administrativo.');
    return json({ link: PAGINA + '#convite=' + value, horas: 48 }, 201);
}

export async function rotaConta(request, env, url) {
    const { DB } = env;
    const path = url.pathname.slice('/api/conta/'.length);
    if (path === 'config' && request.method === 'GET') return json({ google: googleDisponivel(env) });
    if (path === 'google/retorno' && request.method === 'GET') return googleCallback(request, DB, url, env);
    if (path === 'sessao' && request.method === 'GET') {
        return json({ conta: await sessao(request, DB, url) });
    }
    if (request.method !== 'POST') return json({ error: 'Rota não encontrada.' }, 404);
    if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origem não autorizada.');
    if (path === 'sair') {
        const cookie = cookies(url);
        const value = cookie.ler(request, 'sessao');
        if (tokenValido(value)) await DB.prepare('DELETE FROM sessoes WHERE hash = ?').bind(await hash(value)).run();
        return json({ ok: true }, 200, { 'Set-Cookie': cookie.criar('sessao', '', 0) });
    }
    if (path === 'convites') {
        const conta = await sessao(request, DB, url);
        if (!conta || conta.papel !== 'coordenacao') throw new HttpError(403, 'Apenas a coordenação pode emitir convites.');
        const { email } = await readJson(request);
        return criarConvite(DB, typeof email === 'string' ? email.trim().toLowerCase() : email);
    }
    if (path === 'google/iniciar') return googleOptions(DB, url, env, await readJson(request));
    if (path === 'cadastro/opcoes' || path === 'login/opcoes') {
        return chaveOptions(DB, url, path.startsWith('cadastro'), await readJson(request));
    }
    if (path === 'cadastro/verificar' || path === 'login/verificar') {
        return chaveVerificar(request, DB, url, path.startsWith('cadastro'), await readJson(request));
    }
    return json({ error: 'Rota não encontrada.' }, 404);
}
