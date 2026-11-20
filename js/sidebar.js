(function () {
    'use strict';

    const PAGE_MAP = {
        proatec:       'proatec.html',
        agenda:        'agendaProatec.html',
        equipamentos:  'equipamentos.html',
        salas:         'salas.html',
        relatorio:     'relatorio.html',
        bloqueios:     'bloqueios.html',
    };

    function buildSidebarHTML(activePage) {
        const nav = [
            { page: 'proatec',      href: 'proatec.html',      icon: 'home',          label: 'Início' },
            { page: 'agenda',       href: 'agendaProatec.html', icon: 'calendar_today',label: 'Reservas' },
            { page: 'equipamentos', href: 'equipamentos.html',  icon: 'computer',      label: 'Equipamentos' },
            { page: 'salas',        href: 'salas.html',         icon: 'meeting_room',  label: 'Salas' },
            { page: 'relatorio',    href: 'relatorio.html',     icon: 'bar_chart',     label: 'Relatórios' },
        ];

        const navLinks = nav.map(item => `
            <a href="${item.href}" class="nav-link${activePage === item.page ? ' active' : ''}"
               data-tooltip="${item.label}" data-page="${item.page}">
                <span class="material-symbols-outlined">${item.icon}</span>
                <span class="nav-text">${item.label}</span>
            </a>`).join('');

        return `
        <aside class="sidebar collapsed" id="sidebar" aria-label="Menu Lateral">
            <div class="sidebar-header">
                <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn"
                        aria-label="Recolher ou expandir menu lateral" title="Alternar Menu Lateral">
                    <span class="material-symbols-outlined toggle-icon">chevron_left</span>
                </button>
                <div class="sidebar-brand-text" id="sidebarBrandWrapper" title="Coordenação - Gestão de Laboratório">
                    <h1>Alceu Reservas</h1>
                    <p>Coordenação</p>
                </div>
            </div>

            <nav class="sidebar-nav">
                ${navLinks}

            </nav>

            <div class="sidebar-footer">
                <div class="user-profile" data-tooltip="Carregando perfil...">
                    <div class="user-avatar">U</div>
                    <div class="user-info">
                        <p class="user-name">Usuário</p>
                        <p class="user-role">Acesso autorizado</p>
                    </div>
                </div>

                <div class="sidebar-subnav">
                    <a href="../index.html" class="nav-link logout" data-tooltip="Sair">
                        <span class="material-symbols-outlined">logout</span>
                        <span class="nav-text">Sair</span>
                    </a>
                </div>
            </div>
        </aside>

        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;
    }

    function injectSidebar() {
        const mount = document.getElementById('sidebar-mount');
        if (!mount) return;

        const activePage = document.body.getAttribute('data-page') || '';
        mount.outerHTML = buildSidebarHTML(activePage);

        const backdrops = document.querySelectorAll('.sidebar-backdrop');
        backdrops.forEach((backdrop, index) => {
            if (index > 0) backdrop.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSidebar);
    } else {
        injectSidebar();
    }

})();
