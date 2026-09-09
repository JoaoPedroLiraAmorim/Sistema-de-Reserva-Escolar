/**
 * login-novo.js — Lógica da Nova Tela de Login (EduLab Reserve)
 * Design Limpo e Centralizado
 * Depende de: store.js (ERS)
 */

'use strict';

// Redireciona caso o usuário já possua uma sessão ativa válida
(function () {
    if (typeof ERS !== 'undefined') {
        const session = ERS.getSession();
        if (session) {
            const roleRedirectMap = {
                professor:   'pages/professor.html',
                proatec:     'pages/proatec.html',
                coordenacao: 'pages/proatec.html',
            };
            window.location.href = roleRedirectMap[session.role] || 'pages/professor.html';
        }
    }
})();

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
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Seletor de Perfis Rápidos de Demonstração
    // ─────────────────────────────────────────────────────────────
    const roleTabs = document.querySelectorAll('.role-tab-btn');
    const emailInput = document.getElementById('email');
    const feedbackPill = document.getElementById('roleFeedbackPill');
    const feedbackText = document.getElementById('roleFeedbackText');
    const errorBox = document.getElementById('login-error');

    const roleNameMap = {
        professor:   'Prof. Marcelo (Professor)',
        proatec:     'João Almeida (PROATEC)',
        coordenacao: 'Dra. Sandra Lima (Coordenação)',
    };

    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const role = tab.dataset.role;
            const email = tab.dataset.email;
            const pass = tab.dataset.pass;

            // Marca aba ativa
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Preenche os campos
            if (emailInput) emailInput.value = email;
            if (passwordInput) passwordInput.value = pass;

            // Limpa mensagem de erro se houver
            if (errorBox) {
                errorBox.style.display = 'none';
            }

            // Exibe mensagem de feedback discreta
            if (feedbackPill && feedbackText && roleNameMap[role]) {
                feedbackText.textContent = `Acesso rápido: ${roleNameMap[role]}`;
                feedbackPill.style.display = 'flex';
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Submissão do Formulário de Login
    // ─────────────────────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    const btnLogin  = document.getElementById('btn-login');
    const btnText   = btnLogin ? btnLogin.querySelector('.btn-text') : null;

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email    = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            if (!email || !password) {
                showError('Informe seu e-mail e sua senha.');
                return;
            }

            // Feedback de carregamento no botão
            if (errorBox) errorBox.style.display = 'none';
            if (btnLogin) {
                btnLogin.classList.add('loading');
                btnLogin.disabled = true;
                if (btnText) btnText.textContent = 'Entrando...';
            }

            try {
                if (typeof ERS === 'undefined') {
                    showError('Erro interno: Módulo de dados não encontrado.');
                    resetButton();
                    return;
                }

                // ERS.login é uma função assíncrona (retorna Promise)
                const result = await ERS.login(email, password);

                if (result.ok) {
                    if (btnText) btnText.textContent = 'Sucesso!';

                    // Salva e-mail caso checkbox esteja marcado
                    const rememberCheck = document.getElementById('rememberEmail');
                    if (rememberCheck && rememberCheck.checked) {
                        localStorage.setItem('edulab_saved_email', email);
                    } else {
                        localStorage.removeItem('edulab_saved_email');
                    }

                    const roleMap = {
                        professor:   'pages/professor.html',
                        proatec:     'pages/proatec.html',
                        coordenacao: 'pages/proatec.html',
                    };

                    const targetUrl = roleMap[result.user.role] || 'pages/professor.html';
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 200);
                } else {
                    showError(result.message || 'E-mail ou senha incorretos.');
                    resetButton();
                }
            } catch (err) {
                console.error('Erro na autenticação:', err);
                showError('Erro ao processar login. Tente novamente.');
                resetButton();
            }
        });
    }

    function showError(msg) {
        if (!errorBox) return;
        const msgSpan = errorBox.querySelector('.error-text') || errorBox;
        msgSpan.textContent = msg;
        errorBox.style.display = 'flex';
    }

    function resetButton() {
        if (!btnLogin) return;
        btnLogin.classList.remove('loading');
        btnLogin.disabled = false;
        if (btnText) btnText.textContent = 'Entrar';
    }

    // Carrega e-mail lembrado anteriormente se existir
    const savedEmail = localStorage.getItem('edulab_saved_email');
    if (savedEmail && emailInput && !emailInput.value) {
        emailInput.value = savedEmail;
        const rememberCheck = document.getElementById('rememberEmail');
        if (rememberCheck) rememberCheck.checked = true;
    }
});
