function json(data, status = 200, extraHeaders = {}) {
    return Response.json(data, {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
    });
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
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
        // As telas existentes dependem dos endereços terminados em .html.
        if (pathname === '/') {
            const url = new URL(request.url);
            url.pathname = '/index.html';
            return env.ASSETS.fetch(new Request(url, request));
        }
        return env.ASSETS.fetch(request);
    },
};
