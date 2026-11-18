export function json(data, status = 200, extraHeaders = {}) {
    return Response.json(data, {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
    });
}

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function readJson(request) {
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
        throw new HttpError(415, 'Envie os dados em JSON.');
    }
    if (!request.body) throw new HttpError(400, 'Dados inválidos.');

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32_768) {
            await reader.cancel();
            throw new HttpError(413, 'Dados muito grandes.');
        }
        body += decoder.decode(value, { stream: true });
    }
    try {
        const data = JSON.parse(body + decoder.decode());
        if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    } catch {
        // Responder da mesma forma a um JSON inválido e a um objeto ausente.
    }
    throw new HttpError(400, 'Dados inválidos.');
}
