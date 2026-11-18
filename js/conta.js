'use strict';

const $ = id => document.getElementById(id);
const inviteHash = new URLSearchParams(location.hash.slice(1)).get('convite');
if (inviteHash) {
    sessionStorage.setItem('alceu-convite', inviteHash);
    history.replaceState(null, '', location.pathname + location.search);
}
const convite = sessionStorage.getItem('alceu-convite');
const erro = $('erro-conta');
const dataAgenda = $('data-agenda');
const salasSelect = $('sala');
let conta;
let leitura = 0;

function mostrarErro(message = '') {
    erro.textContent = message;
    erro.hidden = !message;
    if (message) erro.scrollIntoView({ block: 'nearest' });
}

async function api(path, body) {
    const options = { cache: 'no-store' };
    if (body) Object.assign(options, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const response = await fetch('/api/' + path, options);
    if (response.status === 404 && path === 'conta/config') throw new Error('O acesso por conta própria ainda não foi habilitado neste endereço.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'O serviço está indisponível no momento.');
    return data;
}

async function executar(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    mostrarErro();
    try {
        await action();
    } catch (error) {
        mostrarErro(error.name === 'NotAllowedError' ? 'A chave de acesso foi cancelada ou expirou. Tente novamente.' : error.message);
    } finally {
        button.disabled = false;
    }
}

function acao(texto, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-secondary';
    button.textContent = texto;
    button.addEventListener('click', () => executar(button, callback));
    return button;
}

function registro(texto, button) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = texto;
    item.append(label);
    if (button) item.append(button);
    return item;
}

async function carregarAgenda() {
    if (!dataAgenda.value) return;
    const versao = ++leitura;
    $('agenda').replaceChildren();
    $('agenda-status').textContent = 'Carregando agenda…';
    let dados;
    try {
        dados = await api('agenda/salas?data=' + dataAgenda.value);
    } catch (error) {
        if (versao !== leitura) return;
        $('agenda-status').textContent = 'Não foi possível consultar este dia.';
        throw error;
    }
    if (versao !== leitura) return;
    const salaSelecionada = salasSelect.value;
    salasSelect.replaceChildren(new Option('Selecione uma sala', ''), ...dados.salas
        .filter(sala => sala.ativa).map(sala => new Option(sala.nome, sala.id)));
    if (dados.salas.some(sala => sala.ativa && sala.id === salaSelecionada)) salasSelect.value = salaSelecionada;

    const coordena = conta.papel === 'coordenacao';
    $('agenda-status').textContent = dados.reservas.length ? '' : 'Nenhuma reserva de sala neste dia.';
    $('agenda').replaceChildren(...dados.reservas.map(reserva => {
        const podeCancelar = reserva.minha || coordena;
        const cancelar = podeCancelar ? acao('Cancelar reserva', async () => {
            if (!window.confirm('Cancelar esta reserva?')) return;
            await api('agenda/cancelar', { id: reserva.id });
            await carregarAgenda();
        }) : null;
        return registro(`${reserva.inicio}–${reserva.fim} · ${reserva.sala}${reserva.minha ? ' · Sua reserva' : ''}`, cancelar);
    }));
    if (coordena) {
        $('salas').replaceChildren(...dados.salas.map(sala => registro(
            `${sala.nome} · ${sala.ativa ? 'Ativa' : 'Inativa'}`,
            acao(sala.ativa ? 'Desativar' : 'Ativar', async () => {
                await api('agenda/sala/atividade', { id: sala.id, ativa: !sala.ativa });
                await carregarAgenda();
            }),
        )));
    }
}

function receberForm(formId, action) {
    $(formId).addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = Object.fromEntries(new FormData(form));
        executar(event.submitter || form.querySelector('button[type="submit"]'), () => action(body, form));
    });
}

receberForm('reserva-form', async (body, form) => {
    await api('agenda/reservar', { ...body, data: dataAgenda.value });
    form.reset();
    await carregarAgenda();
    $('agenda-status').textContent = 'Sala reservada.';
});
receberForm('sala-form', async (body, form) => {
    await api('agenda/sala/cadastrar', body);
    form.reset();
    await carregarAgenda();
});
receberForm('convite-form', async (body, form) => {
    const result = await api('conta/convites', body);
    $('link-convite').value = new URL(result.link, location.origin).href;
    $('convite-gerado').hidden = false;
    $('status-convite').textContent = '';
    form.reset();
});
$('copiar-convite').onclick = () => executar($('copiar-convite'), async () => {
    await navigator.clipboard.writeText($('link-convite').value);
    $('status-convite').textContent = 'Link copiado.';
});
$('sair').onclick = () => executar($('sair'), async () => {
    await api('conta/sair', {});
    location.assign('../');
});
dataAgenda.onchange = () => { mostrarErro(); carregarAgenda().catch(error => mostrarErro(error.message)); };
$('google').onclick = () => executar($('google'), async () => {
    const { url } = await api('conta/google/iniciar', convite ? { convite } : {});
    location.assign(url);
});
$('chave').onclick = () => executar($('chave'), async () => {
    const webAuthn = window.SimpleWebAuthnBrowser;
    if (!webAuthn?.browserSupportsWebAuthn()) throw new Error('Este navegador não oferece chaves de acesso. Atualize-o ou entre pelo Google, se disponível.');
    const rota = convite ? 'cadastro' : 'login';
    const { options, id } = await api('conta/' + rota + '/opcoes', convite ? { convite } : {});
    const credencial = convite
        ? await webAuthn.startRegistration({ optionsJSON: options })
        : await webAuthn.startAuthentication({ optionsJSON: options });
    await api('conta/' + rota + '/verificar', { id, credencial });
    location.replace(location.pathname);
});

async function iniciar() {
    const config = await api('conta/config');
    ({ conta } = await api('conta/sessao'));
    if (conta) {
        sessionStorage.removeItem('alceu-convite');
        $('area-conta').hidden = false;
        $('area-coordenacao').hidden = conta.papel !== 'coordenacao';
        $('usuario').textContent = conta.email;
        dataAgenda.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        await carregarAgenda();
        return;
    }
    $('acesso').hidden = false;
    $('google').hidden = !config.google;
    if (convite) {
        $('titulo-acesso').textContent = 'Aceitar convite';
        $('instrucao-acesso').textContent = 'Crie sua chave de acesso ou use o endereço Google indicado no convite, quando disponível.';
        $('chave').textContent = 'Criar chave de acesso';
    }
    const motivo = new URL(location.href).searchParams.get('erro');
    if (motivo === 'convite') mostrarErro('Abra um convite válido e selecione o endereço de e-mail indicado.');
    if (motivo === 'google') mostrarErro('O acesso pelo Google não foi concluído. Tente novamente.');
}
iniciar().catch(error => mostrarErro(error.message)).finally(() => { $('carregando').hidden = true; });
