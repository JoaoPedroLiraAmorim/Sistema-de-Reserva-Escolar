'use strict';

const $ = id => document.getElementById(id);
const erro = $('erro-conta');
const dataAgenda = $('data-agenda');
const salasSelect = $('sala');
let conta;
let autenticacao;
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
        const messages = {
            'auth/invalid-credential': 'E-mail ou senha inválidos.',
            'auth/wrong-password': 'E-mail ou senha inválidos.',
            'auth/user-not-found': 'E-mail ou senha inválidos.',
            'auth/email-already-in-use': 'Este e-mail já tem uma conta. Use Entrar ou Esqueci minha senha.',
            'auth/weak-password': 'A senha precisa ter pelo menos seis caracteres.',
            'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
            'auth/popup-blocked': 'Permita a abertura da janela do Google e tente novamente.',
            'auth/account-exists-with-different-credential': 'Entre pelo método que já usa para este e-mail.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
            'auth/network-request-failed': 'Falha na conexão. Confira a internet e tente novamente.',
            'auth/operation-not-allowed': 'Este método de login ainda precisa ser habilitado.',
            'auth/unauthorized-domain': 'Este endereço ainda precisa ser autorizado no Firebase.',
        };
        mostrarErro(messages[error.code] ?? error.message);
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
$('sair').onclick = () => executar($('sair'), async () => {
    await api('conta/sair', {});
    location.assign('../');
});
dataAgenda.onchange = () => { mostrarErro(); carregarAgenda().catch(error => mostrarErro(error.message)); };
const statusAcesso = $('status-acesso');
const emailConta = $('email-conta');
const reenviar = $('reenviar');

$('acesso-form').addEventListener('submit', event => {
    event.preventDefault();
    const button = event.submitter ?? $('acesso-form').querySelector('[name="entrar"]');
    executar(button, async () => {
        statusAcesso.textContent = '';
        reenviar.hidden = true;
        const email = emailConta.value.trim();
        const senha = $('senha-conta').value;

        if (button.name === 'cadastrar') {
            if (senha.length < 6) throw new Error('A senha precisa ter pelo menos seis caracteres.');
            await autenticacao.cadastrar(email, senha);
            statusAcesso.textContent = 'Enviamos um link de confirmação. Confirme o e-mail e depois entre na sua conta.';
            $('senha-conta').value = '';
            reenviar.hidden = false;
            return;
        }
        if (await autenticacao.entrar(email, senha, api)) {
            location.replace(location.pathname);
            return;
        }
        statusAcesso.textContent = 'Confirme o e-mail antes de entrar.';
        reenviar.hidden = false;
    });
});

$('google').onclick = () => executar($('google'), async () => {
    statusAcesso.textContent = '';
    await autenticacao.entrarGoogle(api);
    location.replace(location.pathname);
});
$('redefinir').onclick = () => executar($('redefinir'), async () => {
    if (!emailConta.reportValidity()) return;
    await autenticacao.redefinir(emailConta.value.trim());
    statusAcesso.textContent = 'Se o endereço tiver uma conta, o Firebase enviará as instruções para redefinir a senha.';
});
reenviar.onclick = () => executar(reenviar, async () => {
    await autenticacao.reenviar();
    statusAcesso.textContent = 'Enviamos outro link de confirmação.';
});

async function iniciar() {
    const config = await api('conta/config');
    ({ conta } = await api('conta/sessao'));
    if (conta) {
        $('area-conta').hidden = false;
        $('area-coordenacao').hidden = conta.papel !== 'coordenacao';
        $('usuario').textContent = conta.email;
        dataAgenda.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        await carregarAgenda();
        return;
    }
    $('acesso').hidden = false;
    if (!config.firebaseConfig) {
        $('acesso-form').hidden = true;
        document.querySelector('.conta-ajuda').hidden = true;
        statusAcesso.textContent = 'O acesso à agenda ainda está sendo configurado.';
        return;
    }
    $('acesso-form').hidden = true;
    document.querySelector('.conta-ajuda').hidden = true;
    const firebase = await import('./firebase-conta.js');
    autenticacao = firebase.prepararLogin(config.firebaseConfig);
    $('acesso-form').hidden = false;
    document.querySelector('.conta-ajuda').hidden = false;
}
iniciar().catch(error => mostrarErro(error.message)).finally(() => { $('carregando').hidden = true; });
