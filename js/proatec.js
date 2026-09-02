/**
 * proatec.js — Lógica do dashboard PROATEC
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

    document.getElementById('equipmentForm')?.addEventListener('submit', handleEquipmentSubmit);

    renderTodayReservations();
    renderBrandGrid();

});

// ─────────────────────────────────────────────────────────────
//  RESERVAS DO DIA
// ─────────────────────────────────────────────────────────────
function renderTodayReservations() {
    const list   = document.getElementById('today-reservations-list');
    const pickup = document.getElementById('next-pickup-box');
    const todayRes = ERS.getReservationsByDate(ERS.today())
        .sort((a, b) => a.inicio.localeCompare(b.inicio));

    if (todayRes.length === 0) {
        list.innerHTML   = `<p class="empty-msg">Nenhuma reserva para hoje.</p>`;
        pickup.innerHTML = `<p class="empty-msg">Nenhuma reserva hoje.</p>`;
        return;
    }

    list.innerHTML = todayRes.map((r, i) => `
        <div class="agenda-item${i === 0 ? ' highlight' : ''}">
            <span class="agenda-time">${r.inicio}</span>
            <div class="agenda-details">
                <h4 class="agenda-teacher">${r.professorNome}</h4>
                <p class="agenda-room">${r.sala || '—'} • ${r.notebooks ? r.notebooks + ' notebooks' : 'sem notebooks'}</p>
            </div>
            <span class="badge badge-${i === 0 ? 'primary' : 'neutral'}">${i === 0 ? 'Em breve' : 'Confirmada'}</span>
        </div>
    `).join('');

    const next = todayRes[0];
    pickup.innerHTML = `
        <div class="pickup-badge-time">
            <span class="material-symbols-outlined">schedule</span>
            <span>${next.inicio} — turma ${next.turma}</span>
        </div>
        <h4 class="pickup-teacher">${next.professorNome}</h4>
        <p class="pickup-room">${next.sala || 'Sem sala'} • ${next.notebooks || 0} notebooks</p>
    `;
}

// ─────────────────────────────────────────────────────────────
//  GRID DE MARCAS
// ─────────────────────────────────────────────────────────────
function renderBrandGrid() {
    const grid = document.getElementById('brand-grid');
    const notebooks = ERS.getNotebooks();

    grid.innerHTML = notebooks.map(nb => {
        const pct = nb.total > 0 ? Math.round((nb.funcionando / nb.total) * 100) : 0;
        const fillClass = pct >= 70 ? 'primary' : pct >= 40 ? 'secondary' : 'error';
        return `
            <div class="brand-card">
                <span class="brand-name">${nb.marca}</span>
                <div class="brand-count-wrapper">
                    <span class="brand-count">${nb.funcionando}</span>
                    <span class="brand-total">/ ${nb.total}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${fillClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
//  MODAL: CADASTRAR EQUIPAMENTO
// ─────────────────────────────────────────────────────────────
function handleEquipmentSubmit(e) {
    e.preventDefault();
    const brand = document.getElementById('eq-brand').value;
    const qty   = parseInt(document.getElementById('eq-quantity').value) || 1;

    ERS.addNotebooks(brand, qty);
    closeModal('equipment-modal');
    document.getElementById('equipmentForm').reset();
    renderBrandGrid();

    const unitWord = qty === 1 ? 'notebook' : 'notebooks';
    ERS.showToast(`${qty} ${unitWord} (${brand}) cadastrado${qty > 1 ? 's' : ''} com sucesso!`, 'success');
}
