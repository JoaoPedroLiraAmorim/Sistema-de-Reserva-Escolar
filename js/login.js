/**
 * login.js — Lógica da tela de login
 * Depende de: store.js
 */

'use strict';

// Credenciais demo (definidas em JS, não no HTML como atributos visíveis)
const DEMO_CREDENTIALS = [
    { email: 'professor@demo.com',   password: '123456' },
    { email: 'proatec@demo.com',     password: '123456' },
    { email: 'coordenacao@demo.com', password: '123456' },
];

// Se já logado, redireciona direto
(function () {
    const session = ERS.getSession();
    if (session) {
        const map = {
            professor:   'pages/professor.html',
            proatec:     'pages/proatec.html',
            coordenacao: 'pages/proatec.html',
        };
        window.location.href = map[session.role] || 'pages/professor.html';
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Toggle de senha
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput  = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.style.color = type === 'text' ? 'var(--color-primary)' : '';
        });
    }

    // Preencher credenciais demo via JS (sem data-pass exposto no HTML)
    document.querySelectorAll('.demo-pill').forEach((pill, index) => {
        const cred = DEMO_CREDENTIALS[index];
        if (!cred) return;
        pill.addEventListener('click', () => {
            document.getElementById('email').value    = cred.email;
            document.getElementById('password').value = cred.password;
            document.getElementById('login-error').style.display = 'none';
        });
    });

    // Formulário de login (ERS.login é async)
    document.getElementById('login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorEl  = document.getElementById('login-error');
        const btnLogin = document.getElementById('btn-login');

        errorEl.style.display = 'none';
        btnLogin.textContent   = 'Entrando...';
        btnLogin.disabled      = true;

        try {
            const result = await ERS.login(email, password);
            if (result.ok) {
                const map = {
                    professor:   'pages/professor.html',
                    proatec:     'pages/proatec.html',
                    coordenacao: 'pages/proatec.html',
                };
                window.location.href = map[result.user.role] || 'pages/professor.html';
            } else {
                errorEl.textContent   = result.message;
                errorEl.style.display = 'block';
                btnLogin.textContent  = 'Entrar';
                btnLogin.disabled     = false;
            }
        } catch (err) {
            errorEl.textContent   = 'Erro ao processar login. Tente novamente.';
            errorEl.style.display = 'block';
            btnLogin.textContent  = 'Entrar';
            btnLogin.disabled     = false;
        }
    });
});
