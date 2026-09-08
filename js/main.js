/**
 * Sistema de Reserva Escolar - main.js
 * Funções globais compartilhadas (Modais, Sidebar Mobile, Atalhos de Teclado)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. Controle de Sidebar (Retrátil com Ícones Clicáveis)
    // ---------------------------------------------------------
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarBrandWrapper = document.getElementById('sidebarBrandWrapper');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const SIDEBAR_STORAGE_KEY = 'escola_sidebar_collapsed';

    if (sidebar) {
        // Aplica estado inicial salvo ou padrão (recolhido por padrão no desktop)
        const initSidebarState = () => {
            if (window.innerWidth > 768) {
                const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);
                // Se não houver preferência salva, inicia recolhido (ícones visíveis)
                const isCollapsed = savedState !== null ? savedState === 'true' : true;
                setSidebarCollapsed(isCollapsed);
            } else {
                sidebar.classList.remove('collapsed');
                document.body.classList.remove('sidebar-collapsed');
            }
        };

        const setSidebarCollapsed = (collapsed) => {
            if (collapsed) {
                sidebar.classList.add('collapsed');
                document.body.classList.add('sidebar-collapsed');
                document.documentElement.classList.add('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-expanded');
                localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
            } else {
                sidebar.classList.remove('collapsed');
                document.body.classList.remove('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-collapsed');
                document.documentElement.classList.add('sidebar-expanded');
                localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false');
            }
        };

        const toggleSidebar = () => {
            const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
            setSidebarCollapsed(!isCurrentlyCollapsed);
        };

        // Garante atributos data-tooltip em todos os links e perfil
        const setupTooltips = () => {
            sidebar.querySelectorAll('.nav-link').forEach(link => {
                if (!link.getAttribute('data-tooltip')) {
                    const text = link.querySelector('.nav-text, span:last-child')?.textContent?.trim();
                    if (text) link.setAttribute('data-tooltip', text);
                }
            });

            const userProfile = sidebar.querySelector('.user-profile');
            if (userProfile && !userProfile.getAttribute('data-tooltip')) {
                const userName = userProfile.querySelector('.user-name')?.textContent?.trim() || 'Usuário';
                userProfile.setAttribute('data-tooltip', userName);
            }
        };

        initSidebarState();
        setupTooltips();

        // Botão de recolher/expandir na própria sidebar
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebar();
            });
        }

        // Clique no logotipo/marca: se estiver recolhido, expande
        if (sidebarBrandWrapper) {
            sidebarBrandWrapper.addEventListener('click', (e) => {
                if (window.innerWidth > 768 && sidebar.classList.contains('collapsed')) {
                    e.stopPropagation();
                    setSidebarCollapsed(false);
                }
            });
        }

        // Botões de menu nos cabeçalhos dos dashboards/painéis
        document.querySelectorAll('.menu-toggle, #menuToggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.innerWidth <= 768) {
                    const isOpen = sidebar.classList.toggle('open');
                    if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active', isOpen);
                } else {
                    toggleSidebar();
                }
            });
        });

        // Fechamento no Mobile via Backdrop
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebarBackdrop.classList.remove('active');
            });
        }

        // Fecha a sidebar ao clicar fora dela em dispositivos móveis
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) && 
                !e.target.closest('.menu-toggle, #menuToggle')) {
                sidebar.classList.remove('open');
                if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
            }
        });

        // Transição suave ao navegar por um link da sidebar ou atalhos
        document.querySelectorAll('.sidebar .nav-link, .quick-actions-grid .action-card, .link-action').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('http') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
                    const targetPath = href.split('/').pop().split('?')[0];

                    // Se já estiver na mesma tela, previne recarregar
                    if (currentPath === targetPath) {
                        e.preventDefault();
                        return;
                    }

                    // Anima saída suave do conteúdo atual antes de trocar de página
                    const content = document.querySelector('.dashboard-content');
                    if (content) {
                        e.preventDefault();
                        content.classList.add('page-exit');
                        setTimeout(() => {
                            window.location.href = href;
                        }, 110);
                        return;
                    }
                }

                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
                }
            });
        });

        // Reajusta em redimensionamento de tela
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
                const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);
                const isCollapsed = savedState !== null ? savedState === 'true' : true;
                setSidebarCollapsed(isCollapsed);
            }
        });
    }

    // ---------------------------------------------------------
    // 2. Modais: Abertura rápida pelo botão padrão
    // ---------------------------------------------------------
    const btnOpenNewReservation = document.getElementById('btnOpenNewReservation');
    if (btnOpenNewReservation) {
        btnOpenNewReservation.addEventListener('click', () => {
            openModal('new-reservation-modal');
        });
    }

    // ---------------------------------------------------------
    // 3. Modais: Fechamento por clique no fundo escuro ou botões de fechar
    // ---------------------------------------------------------
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add('hidden');
            }
        });
    });

    // Fechamento automático para qualquer botão com data-close-modal ou .btn-close ou .btn-cancel-modal
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-modal], .btn-close, .btn-cancel-modal');
        if (closeBtn) {
            const targetId = closeBtn.getAttribute('data-close-modal');
            if (targetId) {
                closeModal(targetId);
            } else {
                const backdrop = closeBtn.closest('.modal-backdrop');
                if (backdrop) backdrop.classList.add('hidden');
            }
        }
    });

    // ---------------------------------------------------------
    // 4. Modais: Fechamento pela tecla Escape
    // ---------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });

});

/**
 * Abre um modal pelo ID
 * @param {string} modalId - ID do elemento .modal-backdrop
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Fecha um modal pelo ID
 * @param {string} modalId - ID do elemento .modal-backdrop
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}
