document.addEventListener('ers:ready', () => {

    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarBrandWrapper = document.getElementById('sidebarBrandWrapper');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const SIDEBAR_STORAGE_KEY = 'escola_sidebar_collapsed';

    if (sidebar) {

        const initSidebarState = () => {
            if (window.innerWidth > 768) {
                const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);

                const isCollapsed = savedState !== null ? savedState === 'true' : false;
                setSidebarCollapsed(isCollapsed);
            } else {
                sidebar.classList.remove('collapsed');
                document.body.classList.remove('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-collapsed', 'sidebar-expanded');
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

        let wasMobile = window.innerWidth <= 768;
        window.addEventListener('resize', () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile === wasMobile) return;
            wasMobile = isMobile;

            if (isMobile) {
                sidebar.classList.remove('collapsed');
                document.body.classList.remove('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-collapsed', 'sidebar-expanded');
                sidebar.classList.remove('open');
                document.querySelectorAll('.sidebar-backdrop').forEach(backdrop => backdrop.classList.remove('active'));
            } else {
                sidebar.classList.remove('open');
                document.querySelectorAll('.sidebar-backdrop').forEach(backdrop => backdrop.classList.remove('active'));
                const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);
                setSidebarCollapsed(savedState === 'true');
            }
        });

        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    document.querySelectorAll('.sidebar-backdrop').forEach(backdrop => backdrop.classList.remove('active'));
                    return;
                }
                toggleSidebar();
            });
        }

        if (sidebarBrandWrapper) {
            sidebarBrandWrapper.addEventListener('click', (e) => {
                if (window.innerWidth > 768 && sidebar.classList.contains('collapsed')) {
                    e.stopPropagation();
                    setSidebarCollapsed(false);
                }
            });
        }

        if (sidebarBackdrop) {
            document.querySelectorAll('.sidebar-backdrop').forEach(backdrop => backdrop.addEventListener('click', () => {
                sidebar.classList.remove('open');
                document.querySelectorAll('.sidebar-backdrop').forEach(item => item.classList.remove('active'));
            }));
        }

        document.addEventListener('click', (e) => {
            if (sidebar.contains(e.target)) return;

            if (window.innerWidth > 768) {

            } else {

                if (sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    document.querySelectorAll('.sidebar-backdrop').forEach(backdrop => backdrop.classList.remove('active'));
                }
            }
        });

        document.querySelectorAll('.sidebar .nav-link, .quick-actions-grid .action-card, .link-action').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('http') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
                    const targetPath = href.split('/').pop().split('?')[0];

                    if (currentPath === targetPath) {
                        e.preventDefault();
                        return;
                    }

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

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
                const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);
                const isCollapsed = savedState !== null ? savedState === 'true' : false;
                setSidebarCollapsed(isCollapsed);
            }
        });
    }

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add('hidden');
            }
        });
    });

    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-modal], .btn-close');
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

});

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showConfirmModal(options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Confirmar Ação',
            message = 'Tem certeza de que deseja prosseguir com esta ação?',
            icon = 'help',
            type = 'primary',
            confirmText = 'Confirmar',
            cancelText = 'Cancelar'
        } = options;

        let modalEl = document.getElementById('system-confirm-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'system-confirm-modal';
            modalEl.className = 'modal-backdrop hidden';
            modalEl.innerHTML = `
                <div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="sys-confirm-title" aria-describedby="sys-confirm-msg">
                    <button type="button" class="btn-close confirm-close" id="sys-confirm-close" aria-label="Fechar">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <div class="modal-confirm-body">
                        <div class="modal-confirm-icon-wrapper" id="sys-confirm-icon-wrapper">
                            <span class="material-symbols-outlined" id="sys-confirm-icon">help</span>
                        </div>
                        <h3 class="modal-confirm-title" id="sys-confirm-title"></h3>
                        <p class="modal-confirm-message" id="sys-confirm-msg"></p>
                    </div>
                    <div class="modal-confirm-footer">
                        <button type="button" class="btn-secondary" id="sys-confirm-btn-cancel">Cancelar</button>
                        <button type="button" class="btn-primary" id="sys-confirm-btn-ok">Confirmar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        const iconWrapper = modalEl.querySelector('#sys-confirm-icon-wrapper');
        const iconEl      = modalEl.querySelector('#sys-confirm-icon');
        const titleEl     = modalEl.querySelector('#sys-confirm-title');
        const msgEl       = modalEl.querySelector('#sys-confirm-msg');
        const btnCancel   = modalEl.querySelector('#sys-confirm-btn-cancel');
        const btnOk       = modalEl.querySelector('#sys-confirm-btn-ok');
        const btnClose    = modalEl.querySelector('#sys-confirm-close');
        const trigger     = document.activeElement;

        iconWrapper.className = `modal-confirm-icon-wrapper ${type}`;
        iconEl.textContent = icon;

        titleEl.textContent = title;
        msgEl.innerHTML = message;

        btnCancel.textContent = cancelText;
        btnOk.textContent = confirmText;

        if (type === 'danger') {
            btnOk.className = 'btn-danger';
            btnOk.style.background = '';
            btnOk.style.borderColor = '';
        } else if (type === 'success') {
            btnOk.className = 'btn-primary';
            btnOk.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btnOk.style.borderColor = '#059669';
        } else {
            btnOk.className = 'btn-primary';
            btnOk.style.background = '';
            btnOk.style.borderColor = '';
        }

        const cleanup = () => {
            modalEl.classList.add('hidden');
            document.removeEventListener('keydown', handleKeyDown);
            modalEl.removeEventListener('click', handleBackdropClick);
            btnCancel.onclick = null;
            btnOk.onclick = null;
            btnClose.onclick = null;
            if (trigger?.isConnected) trigger.focus();
        };

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };

        const handleBackdropClick = (e) => {
            if (e.target === modalEl) {
                handleCancel();
            }
        };

        btnOk.onclick = handleConfirm;
        btnCancel.onclick = handleCancel;
        btnClose.onclick = handleCancel;
        modalEl.addEventListener('click', handleBackdropClick);
        document.addEventListener('keydown', handleKeyDown);

        modalEl.classList.remove('hidden');
        btnCancel.focus();
    });
}

window.showConfirmModal = showConfirmModal;
if (window.ERS) {
    window.ERS.confirmModal = showConfirmModal;
}
