/**
 * salas.js — Gestão de salas reserváveis
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.SalasModule = (function() {
    let currentSession = null;
    let isInitialized = false;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;

        if (!isInitialized) {
            isInitialized = true;

            document.getElementById('btnAddRoom')?.addEventListener('click', () => {
                const errEl = document.getElementById('room-error');
                if (errEl) errEl.style.display = 'none';
                openModal('add-room-modal');
            });

            document.getElementById('add-room-form')?.addEventListener('submit', handleAddRoom);
        }

        renderRooms();
    }

    // ─────────────────────────────────────────────────────────────
    //  GRID DE SALAS
    // ─────────────────────────────────────────────────────────────
    function renderRooms() {
        const rooms    = ERS.getRooms();
        const todayRes = ERS.getReservationsByDate(ERS.today());
        const grid     = document.getElementById('rooms-grid');
        if (!grid) return;

        if (rooms.length === 0) {
            grid.innerHTML = `<p class="empty-msg">Nenhuma sala cadastrada.</p>`;
            return;
        }

        grid.innerHTML = rooms.map(room => {
            const roomRes = todayRes.filter(r => r.sala === room.nome);
            const resText = roomRes.length > 0
                ? roomRes.map(r => `${r.inicio}–${r.fim} (${r.professorNome})`).join(', ')
                : 'Sem reservas hoje';

            return `
                <div class="room-card${room.ativa ? '' : ' inactive'}">
                    <div class="room-card-header">
                        <div class="room-icon">
                            <span class="material-symbols-outlined">meeting_room</span>
                        </div>
                        <span class="room-status ${room.ativa ? 'ativa' : 'inativa'}">${room.ativa ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <div class="room-name">${room.nome}</div>
                    <div class="room-meta">
                        <span class="material-symbols-outlined">event</span>
                        ${roomRes.length} reserva(s) hoje
                    </div>
                    <div class="room-today-reservations">${resText}</div>
                    <div class="room-card-actions">
                        <button class="btn-toggle-room ${room.ativa ? 'desativar' : 'ativar'}"
                            onclick="toggleRoom('${room.id}')">
                            <span class="material-symbols-outlined">${room.ativa ? 'toggle_off' : 'toggle_on'}</span>
                            ${room.ativa ? 'Desativar' : 'Ativar'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function toggleRoom(id) {
        ERS.toggleRoom(id);
        renderRooms();
        const room = ERS.getRooms().find(r => r.id === id);
        ERS.showToast(`Sala ${room ? (room.ativa ? 'ativada' : 'desativada') : ''} com sucesso.`, 'success');
        if (window.AgendaProatecModule?.populateRoomSelect) window.AgendaProatecModule.populateRoomSelect();
    }

    function handleAddRoom(e) {
        e.preventDefault();
        const input = document.getElementById('room-name-input');
        const name  = input ? input.value.trim() : '';
        const errEl = document.getElementById('room-error');
        const result = ERS.addRoom(name);

        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('add-room-modal');
        document.getElementById('add-room-form')?.reset();
        renderRooms();
        ERS.showToast(`Sala "${name}" cadastrada com sucesso!`, 'success');
        if (window.AgendaProatecModule?.populateRoomSelect) window.AgendaProatecModule.populateRoomSelect();
    }

    // Fallback para carregamento isolado da página
    if (!window.isSpaMode) {
        document.addEventListener('DOMContentLoaded', () => {
            const s = AUTH.requireAuth(['proatec', 'coordenacao']);
            if (s) {
                AUTH.renderUserInfo(s);
                AUTH.setupLogout();
                AUTH.adaptSidebarByRole(s);
                init(s);
            }
        });
    }

    return {
        init,
        render: renderRooms,
        toggleRoom
    };
})();

// Exporta funções chamadas inline no HTML / onclick
window.toggleRoom = function(id) {
    window.SalasModule?.toggleRoom(id);
};
