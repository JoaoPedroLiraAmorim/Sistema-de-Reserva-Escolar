/**
 * salas.js — Gestão de salas reserváveis
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

let currentSession = null;

document.addEventListener('DOMContentLoaded', () => {
    currentSession = AUTH.requireAuth(['proatec', 'coordenacao']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();
    AUTH.adaptSidebarByRole(currentSession);

    document.getElementById('btnAddRoom').addEventListener('click', () => {
        document.getElementById('room-error').style.display = 'none';
        openModal('add-room-modal');
    });
    document.getElementById('add-room-form').addEventListener('submit', handleAddRoom);

    renderRooms();
});

// ─────────────────────────────────────────────────────────────
//  GRID DE SALAS
// ─────────────────────────────────────────────────────────────
function renderRooms() {
    const rooms    = ERS.getRooms();
    const todayRes = ERS.getReservationsByDate(ERS.today());
    const grid     = document.getElementById('rooms-grid');

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
}

function handleAddRoom(e) {
    e.preventDefault();
    const name  = document.getElementById('room-name-input').value.trim();
    const errEl = document.getElementById('room-error');
    const result = ERS.addRoom(name);

    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('add-room-modal');
    document.getElementById('add-room-form').reset();
    renderRooms();
    ERS.showToast(`Sala "${name}" cadastrada com sucesso!`, 'success');
}
