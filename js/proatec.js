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

        list.innerHTML = todayRes.map((r, i) => {
            let actionBadge = '';
            if (r.notebooks > 0) {
                if (!r.retiradaConfirmada) {
                    actionBadge = `<button type="button" class="btn-mini-pickup" onclick="ProatecModule.handleConfirmPickup('${r.id}')" title="Confirmar entrega de notebooks"><span class="material-symbols-outlined">inventory_2</span> Entregar</button>`;
                } else {
                    actionBadge = `<span class="badge badge-success"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:-1px;">verified</span> Entregue</span>`;
                }
            } else {
                actionBadge = `<span class="badge badge-neutral">Somente Sala</span>`;
            }

            return `
                <div class="agenda-item${i === 0 ? ' highlight' : ''}">
                    <span class="agenda-time">${r.inicio}</span>
                    <div class="agenda-details">
                        <h4 class="agenda-teacher">${r.professorNome}</h4>
                        <p class="agenda-room">${r.sala || '—'} • ${r.notebooks ? r.notebooks + ' notebooks' : 'sem notebooks'}</p>
                    </div>
                    <div class="agenda-actions-col">
                        ${actionBadge}
                    </div>
                </div>
            `;
        }).join('');

        const next = todayRes[0];
        let heroAction = '';
        if (next.notebooks > 0) {
            if (!next.retiradaConfirmada) {
                heroAction = `
                    <button type="button" class="btn-pickup-hero" onclick="ProatecModule.handleConfirmPickup('${next.id}')">
                        <span class="material-symbols-outlined">check_circle</span>
                        Confirmar Retirada (${next.notebooks} notebooks)
                    </button>
                `;
            } else {
                heroAction = `
                    <div class="pickup-hero-done">
                        <span class="material-symbols-outlined">verified</span>
                        <span>Retirada confirmada por <strong>${next.retiradaConfirmadaPor || 'PROATEC'}</strong></span>
                        ${next.alunosRegistrados ? `<span class="badge badge-primary" style="margin-left:auto;">${next.alunosNotebooks.length} alunos registrados</span>` : `<span class="badge badge-neutral" style="margin-left:auto;">Aguardando professor registrar alunos</span>`}
                    </div>
                `;
            }
        }

        pickup.innerHTML = `
            <div class="pickup-badge-time">
                <span class="material-symbols-outlined">schedule</span>
                <span>${next.inicio} — turma ${next.turma || 'Geral'}</span>
            </div>
            <h4 class="pickup-teacher">${next.professorNome}</h4>
            <p class="pickup-room">${next.sala || 'Sem sala'} • ${next.notebooks ? next.notebooks + ' notebooks' : 'Sem notebooks'}</p>
            ${heroAction}
        `;
    }

    function handleConfirmPickup(id) {
        const r = ERS.getReservations().find(x => x.id === id);
        if (!r) return;
        const confirmMsg = `Confirmar a entrega de ${r.notebooks} notebook(s) para ${r.professorNome}?\n\nIsso liberará imediatamente o botão de registro de alunos na tela do professor.`;
        if (!confirm(confirmMsg)) return;

        const result = ERS.confirmPickup(id, currentSession ? currentSession.nome : 'PROATEC');
        if (result.ok) {
            ERS.showToast(`Retirada de notebooks confirmada para ${r.professorNome}! O professor já pode registrar os alunos.`, 'success');
            render();
        } else {
            ERS.showToast(result.message, 'error');
        }
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
        renderBrandGrid,
        handleConfirmPickup
    };
})();
