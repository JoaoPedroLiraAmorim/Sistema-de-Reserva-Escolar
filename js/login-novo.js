/**
 * login-novo.js — Lógica da Nova Tela de Login (Alceu Reservas)
 * Design Limpo e Centralizado
 * Depende de: store.js (ERS)
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────────────────────
    // 1. Alternar Visibilidade da Senha (Eye Toggle)
    // ─────────────────────────────────────────────────────────────
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput     = document.getElementById('password');

    const svgEyeOpen = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    `;

    const svgEyeClosed = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
        </svg>
    `;

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.innerHTML = isPassword ? svgEyeClosed : svgEyeOpen;
            togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Exibir senha');
            togglePasswordBtn.setAttribute('aria-pressed', String(isPassword));
        });
    }

    const emailInput = document.getElementById('email');
    const errorBox = document.getElementById('login-error');

    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const btnText = btnLogin.querySelector('.btn-text');
    const googleButton = document.getElementById('login-google');
    const resetButton = document.getElementById('login-redefinir');
    const resendButton = document.getElementById('login-reenviar');
    const status = document.getElementById('login-status');
    let busy = false;

    async function api(path, body) {
        const request = { cache: 'no-store' };
        if (body) Object.assign(request, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const response = await fetch('/api/' + path, request);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'O acesso está indisponível no momento.');
        return data;
    }

    const firebaseReady = api('conta/config').then(async ({ firebaseConfig }) => {
        if (!firebaseConfig) return null;
        const { prepararLogin } = await import('./firebase-conta.js');
        const auth = prepararLogin(firebaseConfig);
        googleButton.disabled = false;
        return auth;
    }).catch(() => null);

    async function abrirSistema() {
        const { conta } = await api('conta/sessao');
        if (!conta) throw new Error('Não foi possível abrir sua sessão. Entre novamente.');
        location.assign(conta.papel === 'coordenacao' ? 'pages/proatec.html' : 'pages/professor.html');
    }

    async function autenticacao() {
        const auth = await firebaseReady;
        if (!auth) throw new Error('O acesso está indisponível no momento. Tente novamente.');
        return auth;
    }

    function mensagem(message = '') {
        status.textContent = message;
        status.hidden = !message;
    }

    async function executar(button, action) {
        if (busy) return;
        busy = true;
        button.disabled = true;
        errorBox.style.display = 'none';
        mensagem();
        const loading = button === btnLogin;
        if (loading) {
            btnLogin.classList.add('loading');
            btnText.textContent = 'Entrando...';
        }
        try {
            await action();
        } catch (error) {
            const messages = {
                'auth/invalid-credential': 'E-mail ou senha inválidos.',
                'auth/wrong-password': 'E-mail ou senha inválidos.',
                'auth/user-not-found': 'E-mail ou senha inválidos.',
                'auth/email-already-in-use': 'Este e-mail já tem uma conta. Use Entrar ou Esqueceu a senha.',
                'auth/weak-password': 'A senha precisa ter pelo menos seis caracteres.',
                'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
                'auth/popup-blocked': 'Permita a abertura da janela do Google e tente novamente.',
                'auth/account-exists-with-different-credential': 'Entre pelo método que já usa para este e-mail.',
                'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
                'auth/network-request-failed': 'Falha na conexão. Confira a internet e tente novamente.',
                'auth/operation-not-allowed': 'Este método de login está indisponível.',
                'auth/unauthorized-domain': 'O login com Google está indisponível neste endereço.',
            };
            showError(messages[error.code] ?? error.message);
        } finally {
            busy = false;
            button.disabled = false;
            if (loading) {
                btnLogin.classList.remove('loading');
                btnText.textContent = 'Entrar';
            }
        }
    }

    function lerEmail() {
        if (emailInput.validity.valid) return emailInput.value.trim();
        showError('Informe um e-mail válido.');
        emailInput.setAttribute('aria-invalid', 'true');
        emailInput.focus();
        return null;
    }

    function lembrar(email) {
        if (document.getElementById('rememberEmail').checked) localStorage.setItem('edulab_saved_email', email);
        else localStorage.removeItem('edulab_saved_email');
    }

    loginForm.addEventListener('submit', event => {
        event.preventDefault();
        if (busy) return;
        clearFieldErrors();
        const email = lerEmail();
        if (!email) return;
        const password = passwordInput.value;
        if (!password) {
            showError('Informe sua senha.');
            passwordInput.setAttribute('aria-invalid', 'true');
            passwordInput.focus();
            return;
        }
        const button = event.submitter ?? btnLogin;
        const cadastrar = button.id === 'login-cadastrar';
        resendButton.hidden = true;

        executar(button, async () => {
            const auth = await autenticacao();
            if (cadastrar) {
                if (password.length < 6) throw new Error('A senha precisa ter pelo menos seis caracteres.');
                await auth.cadastrar(email, password);
                mensagem('Enviamos um link de confirmação. Confirme seu e-mail e depois entre na conta.');
                passwordInput.value = '';
                resendButton.hidden = false;
                return;
            }
            if (await auth.entrar(email, password, api)) {
                lembrar(email);
                await abrirSistema();
                return;
            }
            mensagem('Confirme seu e-mail antes de entrar.');
            resendButton.hidden = false;
        });
    });

    googleButton.addEventListener('click', () => executar(googleButton, async () => {
        await (await autenticacao()).entrarGoogle(api);
        await abrirSistema();
    }));

    resetButton.addEventListener('click', () => executar(resetButton, async () => {
        const email = lerEmail();
        if (!email) return;
        await (await autenticacao()).redefinir(email);
        mensagem('Se o endereço tiver uma conta, você receberá as instruções para redefinir a senha.');
    }));

    resendButton.addEventListener('click', () => executar(resendButton, async () => {
        await (await autenticacao()).reenviar();
        mensagem('Enviamos outro link de confirmação.');
    }));

    function showError(msg) {
        if (!errorBox) return;
        const msgSpan = errorBox.querySelector('.error-text') || errorBox;
        msgSpan.textContent = msg;
        errorBox.style.display = 'flex';
        emailInput?.setAttribute('aria-describedby','login-error');
        passwordInput?.setAttribute('aria-describedby','login-error caps-hint');
    }

    function clearFieldErrors() {
        emailInput?.removeAttribute('aria-invalid');
        passwordInput?.removeAttribute('aria-invalid');
        emailInput?.removeAttribute('aria-describedby');
        passwordInput?.setAttribute('aria-describedby','caps-hint');
    }
    [emailInput,passwordInput].forEach(input=>input?.addEventListener('input',()=>{
        clearFieldErrors();
        if (input === emailInput) {
            mensagem();
            resendButton.hidden = true;
        }
        if(errorBox)errorBox.style.display='none';
    }));
    passwordInput?.addEventListener('keyup',e=>{
        const hint=document.getElementById('caps-hint');
        if(hint)hint.hidden=!e.getModifierState('CapsLock');
    });
    const helpDialog=document.getElementById('access-help-dialog');
    document.querySelectorAll('[data-access-help]').forEach(button=>button.addEventListener('click',()=>helpDialog?.showModal()));

    // Carrega e-mail lembrado anteriormente se existir
    const savedEmail = localStorage.getItem('edulab_saved_email');
    if (savedEmail && emailInput && !emailInput.value) {
        emailInput.value = savedEmail;
        const rememberCheck = document.getElementById('rememberEmail');
        if (rememberCheck) rememberCheck.checked = true;
    }
});
