const $ = id => document.getElementById(id);
const card = document.querySelector('.verification-card');
const params = new URLSearchParams(location.search);
const code = params.get('oobCode');
const mode = params.get('mode');
const validLink = ['verifyEmail', 'resetPassword', 'recoverEmail'].includes(mode) && code && code.length <= 2048;

history.replaceState(null, '', location.pathname);
let confirmation;

function errorState(error) {
    card.dataset.state = 'error';
    $('verification-title').textContent = 'Não foi possível confirmar.';
    const network = error.code === 'auth/network-request-failed' || error instanceof TypeError;
    const expired = ['auth/expired-action-code', 'auth/invalid-action-code'].includes(error.code);
    $('verification-description').textContent = network ? 'Confira sua conexão e tente novamente.' : expired
        ? 'Este link expirou ou já foi utilizado. Entre na sua conta para conferir o acesso ou solicitar uma nova confirmação.'
        : 'Abra o link recebido no seu e-mail. Se precisar, entre na conta para solicitar outro link.';
    $('verification-status').textContent = network ? 'Sua confirmação ainda não foi concluída.' : 'Sua conta continua protegida.';
    $('verification-confirm').hidden = true;
    $('verification-password-form').hidden = true;
    $('verification-password-form').reset();
    $('verification-email').hidden = true;
    $('verification-login').hidden = false;
    $('verification-retry').hidden = !network;
}

async function prepare() {
    $('verification-retry').hidden = true;
    try {
        if (!validLink) throw Object.assign(new Error('Link inválido'), { code: 'auth/invalid-action-code' });
        const response = await fetch('/api/conta/config', { cache: 'no-store' });
        if (!response.ok) throw new Error('Configuração indisponível.');
        const { firebaseConfig } = await response.json();
        if (!firebaseConfig) throw new Error('Configuração indisponível.');
        const { prepararConfirmacao } = await import('./firebase-conta.js');
        confirmation = prepararConfirmacao(firebaseConfig);
        const email = await confirmation.conferir(code, mode);
        card.dataset.state = 'ready';
        $('verification-title').innerHTML = 'Falta só confirmar<br>seu e-mail.';
        $('verification-description').textContent = 'Confirme que este endereço é seu para começar a planejar suas aulas com o Alceu Reservas.';
        $('verification-email').textContent = email;
        $('verification-email').hidden = false;
        $('verification-confirm').hidden = false;
        $('verification-confirm').disabled = false;
        $('verification-login').hidden = true;
        $('verification-status').textContent = 'É rápido e você só precisa fazer isso uma vez.';
        if (mode === 'resetPassword') {
            $('verification-title').textContent = 'Escolha sua nova senha.';
            $('verification-description').textContent = 'Crie uma senha para voltar a acessar suas reservas com segurança.';
            $('verification-confirm').hidden = true;
            $('verification-password-form').hidden = false;
            $('verification-status').textContent = 'Sua senha só será alterada quando você salvar.';
        } else if (mode === 'recoverEmail') {
            $('verification-title').textContent = 'Recupere seu e-mail.';
            $('verification-description').textContent = 'Confirme para desfazer a alteração do endereço de e-mail da sua conta.';
            $('verification-confirm').textContent = 'Recuperar meu e-mail';
        }
    } catch (error) { errorState(error); }
}
$('verification-confirm').addEventListener('click', async () => {
    const button = $('verification-confirm');
    if (button.disabled) return;
    button.disabled = true; card.setAttribute('aria-busy', 'true');
    $('verification-status').textContent = 'Confirmando seu e-mail…';
    try {
        await confirmation.confirmar(code);
        card.dataset.state = 'success';
        $('verification-title').textContent = mode === 'recoverEmail' ? 'E-mail recuperado!' : 'E-mail confirmado!';
        $('verification-description').textContent = mode === 'recoverEmail'
            ? 'Seu endereço de e-mail foi recuperado. Se você não reconhece a alteração, redefina sua senha na tela de login.'
            : 'Tudo certo com seu cadastro. Agora você pode entrar e organizar suas próximas aulas.';
        $('verification-email').hidden = true; button.hidden = true;
        $('verification-login').hidden = false;
        $('verification-status').textContent = 'Seu próximo passo é entrar no sistema.';
    } catch (error) { errorState(error); }
    finally { card.removeAttribute('aria-busy'); }
});
$('verification-retry').addEventListener('click', prepare);
$('verification-password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    if (button.disabled) return;
    if ($('verification-password').value !== $('verification-password-repeat').value) {
        $('verification-status').textContent = 'As senhas não conferem. Digite a mesma senha nos dois campos.';
        $('verification-password-repeat').focus(); return;
    }
    button.disabled = true; card.setAttribute('aria-busy', 'true');
    try {
        await confirmation.redefinir(code, $('verification-password').value);
        form.reset(); form.hidden = true; card.dataset.state = 'success';
        $('verification-title').textContent = 'Nova senha salva!';
        $('verification-description').textContent = 'Tudo pronto. Entre no Alceu Reservas com sua nova senha.';
        $('verification-email').hidden = true;
        $('verification-login').hidden = false;
        $('verification-status').textContent = 'Sua conta continua protegida.';
    } catch (error) {
        if (['auth/weak-password', 'auth/password-does-not-meet-requirements'].includes(error.code)) {
            $('verification-status').textContent = 'Escolha uma senha mais forte e tente novamente.';
        } else errorState(error);
    } finally { button.disabled = false; card.removeAttribute('aria-busy'); }
});
prepare();
