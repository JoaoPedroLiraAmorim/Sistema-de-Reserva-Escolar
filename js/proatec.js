/**
 * proatec.js — Lógica do dashboard PROATEC
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.ProatecModule = (function() {
    let currentSession = null;
    let refreshTimer   = null;

    function init(session) {
        currentSession = session || AUTH.requireAuth(['proatec', 'coordenacao']);
        if (!currentSession) return;

        document.getElementById('equipmentForm')?.addEventListener('submit', handleEquipmentSubmit);

        // Atualização em tempo real entre abas
        window.addEventListener('storage', (e) => {
            if (e.key === 'ers_reservations') {
                render();
            }
        });

        // Verificação periódica para habilitar o card assim que der o horário da aula
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            renderTodayReservations();
        }, 15000);

        render();
    }

    function render() {
        renderTodayReservations();
        renderBrandGrid();
    }

    // ─────────────────────────────────────────────────────────────
    //  RESERVAS DO DIA
    // ─────────────────────────────────────────────────────────────
    let currentModalReservationIds = [];

    // ─────────────────────────────────────────────────────────────
    //  RESERVAS DO DIA & CONTROLE DE RETIRADA
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

        // 1. Lista cronológica (apenas indicativo de status — confirmação exclusiva no card)
        list.innerHTML = todayRes.map((r, i) => {
            let statusBadge = '';
            if (r.notebooks > 0) {
                if (r.retiradaConfirmada) {
                    statusBadge = `<span class="badge badge-success" title="Retirada já confirmada"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:-1px;">verified</span> Entregue</span>`;
                } else if (ERS.isPickupTimeReady(r)) {
                    statusBadge = `<span class="badge badge-warning" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;" title="Horário iniciado — confirme a retirada no card ao lado"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:-1px;">alarm_on</span> No horário</span>`;
                } else {
                    statusBadge = `<span class="badge badge-neutral" title="Aguardando o horário da aula"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:-1px;">schedule</span> Agendada</span>`;
                }
            } else {
                statusBadge = `<span class="badge badge-neutral">Somente Sala</span>`;
            }

            return `
                <div class="agenda-item${i === 0 ? ' highlight' : ''}">
                    <span class="agenda-time">${r.inicio}</span>
                    <div class="agenda-details">
                        <h4 class="agenda-teacher">${ERS.escapeHtml(r.professorNome)}</h4>
                        <p class="agenda-room">${ERS.escapeHtml(r.sala || '—')} • ${r.notebooks ? r.notebooks + ' notebooks' : 'sem notebooks'}</p>
                    </div>
                    <div class="agenda-actions-col">
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');

        // 2. Card de Retirada (Regra de Negócio: só pode confirmar quando der o horário, nunca antes!)
        const nbReservations = todayRes.filter(r => r.notebooks > 0 && r.situacao !== 'cancelada');
        const readyReservations = nbReservations.filter(r => !r.retiradaConfirmada && ERS.isPickupTimeReady(r));

        if (readyReservations.length > 1) {
            // CASO A: Mais de uma turma pronta para retirada no horário atual
            const teacherNames = readyReservations.map(x => x.professorNome).join(', ');
            pickup.innerHTML = `
                <div class="pickup-badge-time pickup-badge-live">
                    <span class="material-symbols-outlined">alarm_on</span>
                    <span>No Horário • ${readyReservations.length} turmas aguardando</span>
                </div>
                <h4 class="pickup-teacher">${readyReservations.length} turmas com reserva agora</h4>
                <p class="pickup-room">${ERS.escapeHtml(teacherNames)}</p>
                <p style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px; line-height: 1.4;">
                    Há mais de uma turma aguardando notebooks neste horário. Selecione qual turma confirmar conforme os alunos/professores forem chegando.
                </p>
                <button type="button" class="btn-pickup-hero btn-pickup-multiple" id="btn-open-multi-pickup" onclick="ProatecModule.openMultiplePickupModal()">
                    <span class="material-symbols-outlined">checklist</span>
                    Visualizar Reservas (${readyReservations.length})
                </button>
            `;
        } else if (readyReservations.length === 1) {
            // CASO B: Apenas uma turma pronta para retirada no horário atual
            const r = readyReservations[0];
            pickup.innerHTML = `
                <div class="pickup-badge-time pickup-badge-live">
                    <span class="material-symbols-outlined">alarm_on</span>
                    <span>No Horário • ${r.inicio} — turma ${ERS.escapeHtml(r.turma || 'Geral')}</span>
                </div>
                <h4 class="pickup-teacher">${ERS.escapeHtml(r.professorNome)}</h4>
                <p class="pickup-room">${ERS.escapeHtml(r.sala || 'Sem sala fixa')} • ${r.notebooks} notebook(s)${r.marca && r.marca !== 'Qualquer marca' ? ' (' + ERS.escapeHtml(r.marca) + ')' : ''}</p>
                <button type="button" class="btn-pickup-hero" id="btn-confirm-single-pickup" onclick="ProatecModule.handleConfirmPickup('${r.id}')">
                    <span class="material-symbols-outlined">check_circle</span>
                    Confirmar Retirada (${r.notebooks} notebooks)
                </button>
            `;
        } else {
            // CASO C: Nenhuma reserva pronta no momento (ou ainda não deu o horário, ou todas concluídas)
            const upcoming = nbReservations.filter(r => !r.retiradaConfirmada && !ERS.isPickupTimeReady(r));

            if (upcoming.length > 0) {
                const nextStart = upcoming[0].inicio;
                const nextBatch = upcoming.filter(r => r.inicio === nextStart);

                let batchTitle = '';
                let batchDesc  = '';

                if (nextBatch.length === 1) {
                    const next = nextBatch[0];
                    batchTitle = next.professorNome;
                    batchDesc  = `${next.sala || 'Sem sala'} • ${next.notebooks} notebook(s)${next.marca && next.marca !== 'Qualquer marca' ? ' (' + next.marca + ')' : ''}`;
                } else {
                    batchTitle = `${nextBatch.length} turmas agendadas para ${nextStart}`;
                    batchDesc  = nextBatch.map(x => x.professorNome).join(', ');
                }

                pickup.innerHTML = `
                    <div class="pickup-badge-time">
                        <span class="material-symbols-outlined">schedule</span>
                        <span>Próxima retirada às ${nextStart}</span>
                    </div>
                    <h4 class="pickup-teacher">${ERS.escapeHtml(batchTitle)}</h4>
                    <p class="pickup-room">${ERS.escapeHtml(batchDesc)}</p>
                    <div class="pickup-waiting-banner">
                        <span class="material-symbols-outlined">lock_clock</span>
                        <div>
                            <strong>Disponível a partir das ${nextStart}</strong>
                            <p>A confirmação de retirada só é liberada quando o horário da reserva iniciar.</p>
                        </div>
                    </div>
                `;
            } else {
                const delivered = nbReservations.filter(r => r.retiradaConfirmada);
                if (delivered.length > 0) {
                    pickup.innerHTML = `
                        <div class="pickup-all-done">
                            <span class="material-symbols-outlined" style="font-size: 36px; color: #10b981;">task_alt</span>
                            <h4 style="margin: 8px 0 2px 0; font-size: 15px; color: var(--color-text-primary);">Entregas concluídas!</h4>
                            <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary);">${delivered.length} retirada(s) de notebooks confirmada(s) hoje.</p>
                        </div>
                    `;
                } else {
                    pickup.innerHTML = `
                        <div class="pickup-empty-state">
                            <span class="material-symbols-outlined">inventory_2</span>
                            <p>Nenhuma entrega de notebooks agendada para hoje.</p>
                        </div>
                    `;
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL: SELEÇÃO DE QUAL TURMA CONFIRMAR (QUANDO HÁ MÚLTIPLAS)
    // ─────────────────────────────────────────────────────────────
    function openMultiplePickupModal() {
        const todayRes = ERS.getReservationsByDate(ERS.today());
        // Turmas prontas para retirada no horário atual ou recém-confirmadas da mesma rodada
        const ready = todayRes.filter(r => r.notebooks > 0 && r.situacao !== 'cancelada' && ERS.isPickupTimeReady(r));
        if (ready.length === 0) {
            ERS.showToast('Nenhuma reserva pronta para retirada no momento.', 'warning');
            return;
        }

        currentModalReservationIds = ready.map(r => r.id);
        renderPickupCardsInModal();
        openModal('pickup-selection-modal');
    }

    function renderPickupCardsInModal() {
        const container = document.getElementById('pickup-cards-container');
        if (!container) return;

        const allRes = ERS.getReservations();
        const items = currentModalReservationIds.map(id => allRes.find(r => r.id === id)).filter(Boolean);

        if (items.length === 0) {
            container.innerHTML = `<p class="empty-msg">Nenhuma turma para exibir.</p>`;
            return;
        }

        container.innerHTML = items.map(r => {
            const isDone = Boolean(r.retiradaConfirmada);
            let timeStr = '';
            if (r.retiradaConfirmadaEm) {
                try {
                    const d = new Date(r.retiradaConfirmadaEm);
                    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                } catch {
                    timeStr = '';
                }
            }

            return `
                <div class="pickup-turma-card ${isDone ? 'confirmed' : 'pending'}" id="turma-card-${r.id}">
                    <div class="turma-card-header">
                        <div>
                            <h4 class="turma-card-teacher">${ERS.escapeHtml(r.professorNome)}</h4>
                            <span class="turma-card-meta">${ERS.escapeHtml(r.turma || 'Geral')} • ${ERS.escapeHtml(r.sala || 'Sem sala fixa')} • Horário: ${r.inicio} – ${r.fim}</span>
                        </div>
                        ${isDone
                            ? `<span class="badge badge-success"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:-1px;">verified</span> Confirmada</span>`
                            : `<span class="badge badge-warning" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">Aguardando Chegada</span>`
                        }
                    </div>
                    <div class="turma-card-body">
                        <span class="turma-nb-count">
                            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--color-primary);">laptop_chromebook</span>
                            ${r.notebooks} notebook(s)${r.marca && r.marca !== 'Qualquer marca' ? ' (' + ERS.escapeHtml(r.marca) + ')' : ''}
                        </span>
                        <div>
                            ${isDone
                                ? `<div class="turma-confirmed-badge">
                                       <span class="material-symbols-outlined" style="font-size:14px;">verified</span>
                                       <span>Entregue ${timeStr ? 'às ' + timeStr : ''} por ${ERS.escapeHtml(r.retiradaConfirmadaPor || 'PROATEC')}</span>
                                   </div>`
                                : `<button type="button" class="btn-confirm-turma" onclick="ProatecModule.confirmPickupFromModal('${r.id}')">
                                       <span class="material-symbols-outlined">check_circle</span>
                                       Confirmar Retirada desta Turma
                                   </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function confirmPickupFromModal(id) {
        const r = ERS.getReservations().find(x => x.id === id);
        if (!r) return;

        const confirmMsg = `Confirmar a entrega de ${r.notebooks} notebook(s) para ${r.professorNome} (${r.turma || 'Turma geral'})?\n\nIsso liberará imediatamente o botão de registrar alunos na tela deste professor.`;
        if (!confirm(confirmMsg)) return;

        const result = ERS.confirmPickup(id, currentSession ? currentSession.nome : 'PROATEC');
        if (result.ok) {
            ERS.showToast(`Retirada de notebooks confirmada para ${r.professorNome}!`, 'success');
            renderPickupCardsInModal();
            renderTodayReservations();
        } else {
            ERS.showToast(result.message, 'error');
        }
    }

    function handleConfirmPickup(id) {
        const r = ERS.getReservations().find(x => x.id === id);
        if (!r) return;

        if (!ERS.isPickupTimeReady(r)) {
            ERS.showToast(`A retirada só pode ser confirmada quando der o horário da reserva (a partir das ${r.inicio}).`, 'warning');
            return;
        }

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
        handleConfirmPickup,
        openMultiplePickupModal,
        confirmPickupFromModal
    };
})();
