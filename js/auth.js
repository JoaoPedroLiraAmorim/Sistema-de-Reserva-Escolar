(function () {
    'use strict';

    function requireAuth(allowedRoles = []) {
        const session = ERS.getSession();
        const isRoot = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';

        if (!session) {
            window.location.href = isRoot;
            return null;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {

            redirectByRole(session.role);
            return null;
        }

        return session;
    }

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

    function renderUserInfo(session) {
        if (!session) return;

        const roleLabels = {
            professor:   'Docente',
            proatec:     'Coordenação',
            coordenacao: 'Coordenação',
        };

        const teacherGreeting = document.querySelector('.teacher-greeting');
        if (teacherGreeting) teacherGreeting.textContent = `Olá, ${session.nome}`;

        const teacherName = document.querySelector('.teacher-user-name');
        if (teacherName) teacherName.textContent = session.nome;

        const teacherRole = document.querySelector('.teacher-user-role');
        if (teacherRole) teacherRole.textContent = roleLabels[session.role] || session.role;

        const teacherAvatar = document.querySelector('.teacher-avatar');
        if (teacherAvatar) teacherAvatar.textContent = session.avatarLetter;

        const userName = document.querySelector('.user-name');
        if (userName) userName.textContent = session.nome;

        const userRole = document.querySelector('.user-role');
        if (userRole) userRole.textContent = roleLabels[session.role] || session.role;

        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) userAvatar.textContent = session.avatarLetter;

        const greeting = document.querySelector('.dashboard-greeting');
        if (greeting) greeting.textContent = `Olá, ${session.nome.split(' ')[0]}`;

        const h2Ola = document.querySelector('.dashboard-content h2');
        if (h2Ola && h2Ola.textContent.startsWith('Olá')) {
            const firstName = session.nome.replace(/^(Dra?\.|Prof[ªa]?\.?|Professor[a]?)\s*/i, '').split(' ')[0];
            h2Ola.textContent = `Olá, ${firstName}.`;
        }

        const dateBadge = document.querySelector('.date-badge');
        if (dateBadge) {
            const now = new Date();
            const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            dateBadge.textContent = now.toLocaleDateString('pt-BR', opts)
                .replace(/^\w/, c => c.toUpperCase());
        }
    }

    function setupLogout() {
        document.querySelectorAll('a.logout, #btnLogout, .btn-header-logout').forEach(el => {
            el.addEventListener('click', async e => {
                e.preventDefault();
                if (!await ERS.logout()) return;
                const isInPages = window.location.pathname.includes('/pages/');
                window.location.href = isInPages ? '../index.html' : 'index.html';
            });
        });
    }

    function adaptSidebarByRole(session) {
        if (!session) return;

        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        if (window.isSpaMode) {
            if (session.role === 'coordenacao') {
                document.body.classList.add('role-coordenacao');
                document.documentElement.classList.add('role-coordenacao');
                sidebar.querySelectorAll('.coordenacao-only').forEach(el => {
                    el.style.display = 'flex';
                });
                const brandText = sidebar.querySelector('.sidebar-brand-text p');
                if (brandText) brandText.textContent = 'Coordenação';
                const brandH1 = sidebar.querySelector('.sidebar-brand-text h1');
                if (brandH1) brandH1.textContent = 'Alceu Reservas';
            }
            return;
        }

        if (session.role === 'coordenacao') {
            const nav = sidebar.querySelector('.sidebar-nav');
            if (nav && !document.getElementById('nav-bloqueios')) {
                const link = document.createElement('a');
                link.href = 'bloqueios.html';
                link.className = 'nav-link';
                link.id = 'nav-bloqueios';
                link.setAttribute('data-tooltip', 'Bloqueios');
                if (window.location.pathname.includes('bloqueios')) link.classList.add('active');
                link.innerHTML = `
                    <span class="material-symbols-outlined">block</span>
                    <span class="nav-text">Bloqueios</span>
                `;
                nav.appendChild(link);
            }

            const brandText = sidebar.querySelector('.sidebar-brand-text p');
            if (brandText) brandText.textContent = 'Coordenação';
            const brandH1 = sidebar.querySelector('.sidebar-brand-text h1');
            if (brandH1) brandH1.textContent = 'Alceu Reservas';
        }

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

    window.AUTH = { requireAuth, redirectByRole, renderUserInfo, setupLogout, adaptSidebarByRole };

})();
