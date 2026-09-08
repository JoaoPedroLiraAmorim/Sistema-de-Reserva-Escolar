/**
 * Sistema de Reserva Escolar — sidebar.js
 * Injeta dinamicamente o HTML da sidebar em todas as páginas internas.
 * Elimina a duplicação de ~60 linhas de HTML em cada página.
 *
 * Uso: Adicionar <div id="sidebar-mount"></div> no lugar do <aside>,
 *      e <script src="../js/sidebar.js"></script> ANTES dos demais scripts.
 *
 * O atributo data-page no <body> indica qual link marcar como ativo.
 * Ex: <body data-page="proatec">
 */

(function () {
    'use strict';

    // Mapa de página → nome do arquivo HTML (sem extensão)
    // Usado para marcar o link ativo na sidebar
    const PAGE_MAP = {
        proatec:       'proatec.html',
        agenda:        'agendaProatec.html',
        equipamentos:  'equipamentos.html',
        salas:         'salas.html',
        relatorio:     'relatorio.html',
        bloqueios:     'bloqueios.html',
    };

    // HTML da sidebar (único ponto de verdade)
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
                <div class="sidebar-brand-wrapper" id="sidebarBrandWrapper" title="PROATEC - Gestão de Laboratório">
                    <div class="sidebar-brand-icon">
                        <span class="material-symbols-outlined">laptop_mac</span>
                    </div>
                    <div class="sidebar-brand-text">
                        <h1>PROATEC</h1>
                        <p>Gestão de Laboratório</p>
                    </div>
                </div>
                <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn"
                        aria-label="Recolher ou expandir menu lateral" title="Alternar Menu">
                    <span class="material-symbols-outlined toggle-icon">chevron_left</span>
                </button>
            </div>

            <nav class="sidebar-nav">
                ${navLinks}
                <!-- Item exclusivo da Coordenação: injetado por auth.js -->
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
                    <a href="salas.html" class="nav-link${activePage === 'salas' ? ' active' : ''}"
                       data-tooltip="Salas" data-page="salas">
                        <span class="material-symbols-outlined">meeting_room</span>
                        <span class="nav-text">Salas</span>
                    </a>
                    <a href="../index.html" class="nav-link logout" data-tooltip="Sair">
                        <span class="material-symbols-outlined">logout</span>
                        <span class="nav-text">Sair</span>
                    </a>
                </div>
            </div>
        </aside>

        <!-- Backdrop para Mobile -->
        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;
    }

    // Injeta a sidebar no mount point antes do DOMContentLoaded
    // (executa sync durante o parsing do HTML)
    function injectSidebar() {
        const mount = document.getElementById('sidebar-mount');
        if (!mount) return;

        const activePage = document.body.getAttribute('data-page') || '';
        mount.outerHTML = buildSidebarHTML(activePage);
    }

    // Se o DOM já está pronto (script carregado depois), injeta agora
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSidebar);
    } else {
        injectSidebar();
    }

})();
