import { firebaseConfig, origemDaConta, rotaConta } from './contas.mjs';
import { HttpError, json } from './http.mjs';
import { rotaReservas } from './sistema.mjs';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const { pathname } = url;
        if (pathname === '/pages/conta.html') return Response.redirect(new URL('/pages/professor.html', url), 302);
        if (pathname.startsWith('/api/conta/') || pathname.startsWith('/api/agenda/')) {
            if (!origemDaConta(url, env)) return json({ error: 'Rota não encontrada.' }, 404);
            try {
                return pathname.startsWith('/api/conta/')
                    ? await rotaConta(request, env, url)
                    : await rotaReservas(request, env, url);
            } catch (error) {
                if (error instanceof HttpError) return json({ error: error.message }, error.status);
                if (url.hostname === 'localhost') console.error(error);
                return json({ error: 'Serviço temporariamente indisponível.' }, 503);
            }
        }
        if (pathname === '/' || pathname === '/index.html' || pathname === '/pages/verificar-email.html') {
            const assetRequest = pathname === '/' ? new Request(new URL('/index.html', url), request) : request;
            const asset = await env.ASSETS.fetch(assetRequest);
            const headers = new Headers(asset.headers);
            const firebase = firebaseConfig(env);
            const frames = firebase ? ` https://${firebase.authDomain} https://accounts.google.com https://apis.google.com` : '';
            headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://apis.google.com; " +
                "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com; " +
                `frame-src 'self'${frames}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
            headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
            headers.set('Referrer-Policy', 'no-referrer');
            if (pathname === '/pages/verificar-email.html') headers.set('Cache-Control', 'no-store');
            return new Response(asset.body, { status: asset.status, headers });
        }
        if (pathname === '/api/health') {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, HEAD' });
            }
            const response = json({ ok: true, service: 'edulab-api' });
            return request.method === 'HEAD'
                ? new Response(null, { status: response.status, headers: response.headers })
                : response;
        }
        if (pathname === '/api/salas') {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, HEAD' });
            }
            try {
                const { results } = await env.DB.prepare(
                    'SELECT id, nome, ativa FROM salas ORDER BY nome COLLATE NOCASE, id'
                ).all();
                const response = json({ salas: results.map(sala => ({ ...sala, ativa: sala.ativa === 1 })) });
                return request.method === 'HEAD'
                    ? new Response(null, { status: response.status, headers: response.headers })
                    : response;
            } catch {
                return json({ error: 'Não foi possível consultar as salas. Verifique a configuração e as migrações do banco.' }, 503);
            }
        }
        if (pathname === '/api' || pathname.startsWith('/api/')) {
            return json({ error: 'Rota não encontrada.' }, 404);
        }
        return env.ASSETS.fetch(request);
    },
};
