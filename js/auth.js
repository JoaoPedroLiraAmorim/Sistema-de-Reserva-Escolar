/**
 * Sistema de Reserva Escolar — auth.js
 * Guard de autenticação e renderização de dados do usuário logado.
 * Deve ser carregado DEPOIS de store.js em todas as páginas protegidas.
 */

(function () {
    'use strict';

    /**
     * Verifica se há sessão ativa. Se não houver, redireciona para o login.
     * @param {string[]} [allowedRoles] — roles permitidas nessa página. Se vazio, qualquer role é aceita.
     * @returns {object|null} session object ou null (e já redirecionou)
     */
    function requireAuth(allowedRoles = []) {
        const session = ERS.getSession();
        const isRoot = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';

        if (!session) {
            window.location.href = isRoot;
            return null;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
            // Redireciona para a página correta do perfil
            redirectByRole(session.role);
            return null;
        }

        return session;
    }

    /**
     * Redireciona para a página inicial do perfil correto.
     */
    function redirectByRole(role) {
        const base = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        switch (role) {
            case 'professor':   window.location.href = base + 'professor.html'; break;
            case 'proatec':     window.location.href = base + 'proatec.html'; break;
            case 'coordenacao': window.location.href = base + 'proatec.html'; break;
            default:
                window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
        }
    }

    /**
     * Preenche elementos de UI com dados do usuário (nome, avatar, cargo).
     * Procura por IDs/classes padrão usados nas páginas existentes.
     */
    function renderUserInfo(session) {
        if (!session) return;

        const roleLabels = {
            professor:   'Docente',
            proatec:     'Coordenador PROATEC',
            coordenacao: 'Coordenação',
        };

        // Header do Professor (teacher-*)
        const teacherGreeting = document.querySelector('.teacher-greeting');
        if (teacherGreeting) teacherGreeting.textContent = `Olá, ${session.nome}`;

        const teacherName = document.querySelector('.teacher-user-name');
        if (teacherName) teacherName.textContent = session.nome;

        const teacherRole = document.querySelector('.teacher-user-role');
        if (teacherRole) teacherRole.textContent = roleLabels[session.role] || session.role;

        const teacherAvatar = document.querySelector('.teacher-avatar');
        if (teacherAvatar) teacherAvatar.textContent = session.avatarLetter;

        // Sidebar PROATEC (user-*)
        const userName = document.querySelector('.user-name');
        if (userName) userName.textContent = session.nome;

        const userRole = document.querySelector('.user-role');
        if (userRole) userRole.textContent = roleLabels[session.role] || session.role;

        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) userAvatar.textContent = session.avatarLetter;

        // Saudação dashboard
        const greeting = document.querySelector('.dashboard-greeting');
        if (greeting) greeting.textContent = `Olá, ${session.nome.split(' ')[0]}`;

        // h2 de saudação em proatec.html
        const h2Ola = document.querySelector('.dashboard-content h2');
        if (h2Ola && h2Ola.textContent.startsWith('Olá')) {
            h2Ola.textContent = `Olá, ${session.nome.split(' ')[0]}`;
        }

        // Data badge
        const dateBadge = document.querySelector('.date-badge');
        if (dateBadge) {
            const now = new Date();
            const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            dateBadge.textContent = now.toLocaleDateString('pt-BR', opts)
                .replace(/^\w/, c => c.toUpperCase());
        }
    }

    /**
     * Configura links de logout em todas as páginas.
     */
    function setupLogout() {
        document.querySelectorAll('a.logout, #btnLogout, .btn-header-logout').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                ERS.logout();
                const isInPages = window.location.pathname.includes('/pages/');
                window.location.href = isInPages ? '../index.html' : 'index.html';
            });
        });
    }

    /**
     * Adapta a sidebar PROATEC de acordo com o role:
     * - Coordenação vê link "Bloqueios" extra
     * - Professor não deveria ver a sidebar do PROATEC (não chega aqui normalmente)
     */
    function adaptSidebarByRole(session) {
        if (!session) return;

        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Adiciona link de Bloqueios para Coordenação
        if (session.role === 'coordenacao') {
            const nav = sidebar.querySelector('.sidebar-nav');
            if (nav && !document.getElementById('nav-bloqueios')) {
                const link = document.createElement('a');
                link.href = 'bloqueios.html';
                link.className = 'nav-link';
                link.id = 'nav-bloqueios';
                if (window.location.pathname.includes('bloqueios')) link.classList.add('active');
                link.innerHTML = `
                    <span class="material-symbols-outlined">block</span>
                    <span>Bloqueios</span>
                `;
                nav.appendChild(link);
            }

            // Atualiza label do sidebar header para coordenação
            const brandText = sidebar.querySelector('.sidebar-brand-text p');
            if (brandText) brandText.textContent = 'Coordenação';
            const brandH1 = sidebar.querySelector('.sidebar-brand-text h1');
            if (brandH1) brandH1.textContent = 'EduLab';
        }

        // Corrige links # para páginas reais
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const text = link.querySelector('span:last-child')?.textContent?.trim();
            if (text === 'Equipamentos' && link.getAttribute('href') === '#') {
                link.href = 'equipamentos.html';
            }
            if (text === 'Salas' && link.getAttribute('href') === '#') {
                link.href = 'salas.html';
            }
        });

        // Marca link ativo conforme página atual
        const currentPage = window.location.pathname.split('/').pop();
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href !== '#' && href !== '../index.html') {
                if (href === currentPage || href.replace('../', '') === currentPage) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            }
        });
    }

    // Exposição pública
    window.AUTH = { requireAuth, redirectByRole, renderUserInfo, setupLogout, adaptSidebarByRole };

})();
