/**
 * login.js — Lógica da tela de login
 * Depende de: store.js
 */

'use strict';

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

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.style.color = type === 'text' ? 'var(--color-primary)' : '';
    });

    // Pills de demonstração
    document.querySelectorAll('.demo-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.getElementById('email').value    = pill.dataset.email;
            document.getElementById('password').value = pill.dataset.pass;
            document.getElementById('login-error').style.display = 'none';
        });
    });

    // Formulário de login
    document.getElementById('login-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorEl  = document.getElementById('login-error');
        const btnLogin = document.getElementById('btn-login');

        errorEl.style.display = 'none';
        btnLogin.textContent   = 'Entrando...';
        btnLogin.disabled      = true;

        setTimeout(() => {
            const result = ERS.login(email, password);
            if (result.ok) {
                const map = {
                    professor:   'pages/professor.html',
                    proatec:     'pages/proatec.html',
                    coordenacao: 'pages/proatec.html',
                };
                window.location.href = map[result.user.role] || 'pages/professor.html';
            } else {
                errorEl.textContent  = result.message;
                errorEl.style.display = 'block';
                btnLogin.textContent  = 'Entrar';
                btnLogin.disabled     = false;
            }
        }, 400);
    });
});
