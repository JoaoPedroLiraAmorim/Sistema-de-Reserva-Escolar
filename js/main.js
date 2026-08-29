/**
 * Sistema de Reserva Escolar - main.js
 * Funções globais compartilhadas (Modais, Sidebar Mobile, Atalhos de Teclado)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. Controle de Sidebar (Responsividade / Menu Mobile)
    // ---------------------------------------------------------
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        // Fecha a sidebar ao clicar fora dela em dispositivos móveis
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
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
    // 3. Modais: Fechamento por clique no fundo escuro
    // ---------------------------------------------------------
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add('hidden');
            }
        });
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
