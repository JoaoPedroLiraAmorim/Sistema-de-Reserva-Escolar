/**
 * proatec.js — Lógica do dashboard PROATEC
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.ProatecModule = (function() {
    let currentSession = null;

    function init(session) {
        currentSession = session || AUTH.requireAuth(['proatec', 'coordenacao']);
        if (!currentSession) return;

        document.getElementById('equipmentForm')?.addEventListener('submit', handleEquipmentSubmit);
        render();
    }

    function render() {
        renderTodayReservations();
        renderBrandGrid();
    }

    // ─────────────────────────────────────────────────────────────
    //  RESERVAS DO DIA
    // ─────────────────────────────────────────────────────────────
    function renderTodayReservations() {
        const list   = document.getElementById('today-reservations-list');
        const pickup = document.getElementById('next-pickup-box');
        if (!list || !pickup) return;

        const todayRes = ERS.getReservationsByDate(ERS.today())
            .sort((a, b) => a.inicio.localeCompare(b.inicio));

        if (todayRes.length === 0) {
            list.innerHTML = `
                <div class="agenda-empty-state">
                    <span class="material-symbols-outlined">event_available</span>
                    <p>Nenhuma reserva registrada para hoje.</p>
                </div>`;
            pickup.innerHTML = `
                <div class="pickup-empty-state">
                    <span class="material-symbols-outlined">inventory_2</span>
                    <p>Nenhuma entrega agendada para hoje.</p>
                </div>`;
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
                <span>${next.inicio} — turma ${next.turma || 'Geral'}</span>
            </div>
            <h4 class="pickup-teacher">${next.professorNome}</h4>
            <p class="pickup-room">${next.sala || 'Sem sala'} • ${next.notebooks ? next.notebooks + ' notebooks' : 'Sem notebooks'}</p>
        `;
    }

    // ─────────────────────────────────────────────────────────────
    //  GRID DE MARCAS
    // ─────────────────────────────────────────────────────────────
    function renderBrandGrid() {
        const grid = document.getElementById('brand-grid');
        if (!grid) return;
        const notebooks = ERS.getNotebooks();

        if (notebooks.length === 0) {
            grid.innerHTML = `
                <div class="brand-empty-state">
                    <span class="material-symbols-outlined">devices</span>
                    <p>Nenhum equipamento cadastrado no momento.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = notebooks.map(nb => {
            const ratio = nb.total > 0 ? (nb.funcionando / nb.total) : 0;
            const fillClass = ratio >= 0.7 ? 'primary' : ratio >= 0.4 ? 'warning' : 'error';
            const fillWidth = Math.round(ratio * 100);

            return `
                <div class="brand-card">
                    <div class="brand-card-top">
                        <span class="brand-name">${nb.marca}</span>
                        <span class="brand-status-dot ${fillClass}"></span>
                    </div>
                    <div class="brand-count-wrapper">
                        <span class="brand-count">${nb.funcionando}</span>
                        <span class="brand-total">/ ${nb.total}</span>
                    </div>
                    <div class="progress-bar" title="${nb.funcionando} de ${nb.total} notebooks disponíveis">
                        <div class="progress-fill ${fillClass}" style="width: ${fillWidth}%;"></div>
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
        render,
        renderTodayReservations,
        renderBrandGrid
    };
})();
