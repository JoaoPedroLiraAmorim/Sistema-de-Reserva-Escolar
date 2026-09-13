/**
 * relatorio.js — Relatórios de reservas e registros de equipamentos/alunos
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.RelatorioModule = (function() {
    const ICON_COLORS = ['primary', 'secondary', 'tertiary'];
    const ICON_NAMES  = ['laptop_mac', 'laptop_chromebook', 'laptop_windows'];
    let currentSession = null;
    let isInitialized = false;
    let filterMode = 'all'; // 'all' | 'today' | 'date'
    let selectedDate = null;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;

        const dateInput = document.getElementById('report-date');

        if (!isInitialized) {
            isInitialized = true;

            if (dateInput) {
                dateInput.addEventListener('change', () => {
                    if (dateInput.value) {
                        setFilterMode('date', dateInput.value);
                    } else {
                        setFilterMode('all');
                    }
                });
            }

            // Fechar modal ao clicar fora ou pressionar ESC
            const modalBackdrop = document.getElementById('records-modal');
            if (modalBackdrop) {
                modalBackdrop.addEventListener('click', (e) => {
                    if (e.target === modalBackdrop) {
                        closeRecordsModal();
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeRecordsModal();
                }
            });
        }

        // Inicia exibindo todas as reservas para visualização imediata
        setFilterMode('all');
    }

    // ─────────────────────────────────────────────────────────────
    //  CONTROLE DE FILTROS
    // ─────────────────────────────────────────────────────────────
    function setFilterMode(mode, customDate = null) {
        filterMode = mode;
        const btnAll   = document.getElementById('btn-filter-all');
        const btnToday = document.getElementById('btn-filter-today');
        const dateInput = document.getElementById('report-date');
        const dateLabel = document.getElementById('date-label');

        if (btnAll)   btnAll.classList.toggle('active', mode === 'all');
        if (btnToday) btnToday.classList.toggle('active', mode === 'today');

        if (mode === 'all') {
            selectedDate = null;
            if (dateInput) dateInput.value = '';
            if (dateLabel) dateLabel.textContent = 'Todas as Reservas';
        } else if (mode === 'today') {
            selectedDate = ERS.today();
            if (dateInput) dateInput.value = selectedDate;
            if (dateLabel) dateLabel.textContent = 'Hoje';
        } else if (mode === 'date') {
            selectedDate = customDate || (dateInput ? dateInput.value : ERS.today());
            if (dateInput) dateInput.value = selectedDate;
            if (dateLabel) {
                dateLabel.textContent = selectedDate === ERS.today() ? 'Hoje' : ERS.formatDate(selectedDate);
            }
        }

        renderReport();
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDERIZAÇÃO DO RELATÓRIO
    // ─────────────────────────────────────────────────────────────
    function renderReport() {
        const allReservations = ERS.getReservations();
        let reservations = [];

        if (filterMode === 'all') {
            // Todas as reservas: confirmadas e canceladas, ordenadas pela data (mais recentes primeiro)
            reservations = [...allReservations].sort((a, b) => {
                const cmpDate = (b.data || '').localeCompare(a.data || '');
                if (cmpDate !== 0) return cmpDate;
                return (a.inicio || '').localeCompare(b.inicio || '');
            });
        } else {
            const targetDate = selectedDate || ERS.today();
            reservations = allReservations
                .filter(r => r.data === targetDate)
                .sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
        }

        // Estatísticas sem quantidade de notebooks (apenas contagem de reservas)
        const totalRes    = reservations.length;
        const confirmadas = reservations.filter(r => r.situacao === 'confirmada').length;
        const canceladas  = reservations.filter(r => r.situacao === 'cancelada').length;

        const statsEl = document.getElementById('report-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card">
                    <p class="stat-label">Total de Reservas</p>
                    <p class="stat-value">${totalRes}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Confirmadas</p>
                    <p class="stat-value success">${confirmadas}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Canceladas</p>
                    <p class="stat-value danger">${canceladas}</p>
                </div>
            `;
        }

        const list = document.getElementById('reports-list');
        if (!list) return;

        if (reservations.length === 0) {
            list.innerHTML = `
                <div class="empty-state-report">
                    <span class="material-symbols-outlined">event_busy</span>
                    <p>Nenhuma reserva encontrada para este filtro.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = reservations.map((r, i) => {
            const isConfirmed = r.situacao === 'confirmada';
            const hasRecords = Array.isArray(r.alunosNotebooks) && r.alunosNotebooks.length > 0;
            const recordsCount = hasRecords ? r.alunosNotebooks.length : 0;

            return `
                <article class="report-card${!isConfirmed ? ' report-card-canceled' : ''}">
                    <div class="report-card-header">
                        <div class="report-lead">
                            <div class="report-icon-box ${ICON_COLORS[i % ICON_COLORS.length]}">
                                <span class="material-symbols-outlined">${ICON_NAMES[i % ICON_NAMES.length]}</span>
                            </div>
                            <div class="report-details">
                                <div class="report-title-row">
                                    <h3 class="report-teacher-name">${ERS.escapeHtml(r.professorNome)}</h3>
                                    <span class="report-class-tag">• Turma ${ERS.escapeHtml(r.turma)}</span>
                                    <span class="badge badge-${isConfirmed ? 'primary' : 'neutral'}">
                                        ${isConfirmed ? 'Confirmada' : 'Cancelada'}
                                    </span>
                                </div>
                                <div class="report-meta-row">
                                    <span class="report-meta-item">
                                        <span class="material-symbols-outlined">calendar_today</span>
                                        ${ERS.formatDate(r.data)}
                                    </span>
                                    <span class="report-meta-item">
                                        <span class="material-symbols-outlined">schedule</span>
                                        ${r.inicio} – ${r.fim}
                                    </span>
                                    ${r.sala ? `
                                    <span class="report-meta-item">
                                        <span class="material-symbols-outlined">meeting_room</span>
                                        ${ERS.escapeHtml(r.sala)}
                                    </span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="report-card-actions">
                            <button type="button" class="btn-view-records" onclick="RelatorioModule.openRecordsModal('${r.id}')" title="Visualizar numeração dos notebooks e alunos que utilizaram">
                                <span class="material-symbols-outlined">assignment</span>
                                <span>Ver registros</span>
                                ${recordsCount > 0 ? `<span class="records-count-badge">${recordsCount}</span>` : ''}
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL: REGISTROS DE NOTEBOOKS E ALUNOS
    // ─────────────────────────────────────────────────────────────
    function openRecordsModal(resId) {
        const backdrop = document.getElementById('records-modal');
        if (!backdrop) return;

        const reservations = ERS.getReservations();
        const r = reservations.find(x => x.id === resId);
        if (!r) {
            ERS.showToast('Reserva não encontrada.', 'error');
            return;
        }

        // 1. Resumo da Reserva
        const infoEl = document.getElementById('records-res-info');
        if (infoEl) {
            const isConfirmed = r.situacao === 'confirmada';
            infoEl.innerHTML = `
                <div class="record-info-grid">
                    <div class="record-info-item">
                        <span class="info-label">Professor</span>
                        <span class="info-val"><strong>${ERS.escapeHtml(r.professorNome || 'Não informado')}</strong></span>
                    </div>
                    <div class="record-info-item">
                        <span class="info-label">Turma</span>
                        <span class="info-val">${ERS.escapeHtml(r.turma || '—')}</span>
                    </div>
                    <div class="record-info-item">
                        <span class="info-label">Data</span>
                        <span class="info-val">${ERS.formatDate(r.data)}</span>
                    </div>
                    <div class="record-info-item">
                        <span class="info-label">Horário</span>
                        <span class="info-val">${r.inicio} – ${r.fim}</span>
                    </div>
                    <div class="record-info-item">
                        <span class="info-label">Sala</span>
                        <span class="info-val">${ERS.escapeHtml(r.sala || 'Geral')}</span>
                    </div>
                    <div class="record-info-item">
                        <span class="info-label">Situação</span>
                        <span class="badge badge-${isConfirmed ? 'primary' : 'neutral'}">${isConfirmed ? 'Confirmada' : 'Cancelada'}</span>
                    </div>
                </div>
            `;
        }

        // 2. Tabela de Registros de Notebooks e Alunos
        const container = document.getElementById('records-table-container');
        if (container) {
            const hasRecords = Array.isArray(r.alunosNotebooks) && r.alunosNotebooks.length > 0;

            if (hasRecords) {
                container.innerHTML = `
                    <div class="records-table-wrapper">
                        <table class="records-table">
                            <thead>
                                <tr>
                                    <th class="col-num">#</th>
                                    <th class="col-tag">Nº / Etiqueta do Notebook</th>
                                    <th>Aluno que Utilizou</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${r.alunosNotebooks.map((item, idx) => `
                                    <tr>
                                        <td class="col-num">${idx + 1}</td>
                                        <td class="col-tag">
                                            <span class="record-tag-badge">
                                                <span class="material-symbols-outlined">laptop</span>
                                                <strong>${ERS.escapeHtml(item.etiqueta || item.notebook || 'S/N')}</strong>
                                            </span>
                                        </td>
                                        <td class="col-student-name">
                                            <div class="student-cell">
                                                <span class="material-symbols-outlined student-icon">person</span>
                                                <span>${ERS.escapeHtml(item.aluno || item.alunoNome || 'Não informado')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="records-table-summary">
                        <span class="material-symbols-outlined">check_circle</span>
                        <span>Total de <strong>${r.alunosNotebooks.length}</strong> notebooks e alunos registrados pelo professor.</span>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="records-empty-state">
                        <span class="material-symbols-outlined">assignment_late</span>
                        <h4>Nenhum registro encontrado</h4>
                        <p>${r.situacao === 'cancelada'
                            ? 'Esta reserva foi cancelada e não possui registro de notebooks e alunos.'
                            : 'O professor responsável ainda não realizou o registro dos notebooks e alunos que utilizaram os equipamentos.'
                        }</p>
                    </div>
                `;
            }
        }

        backdrop.classList.remove('hidden');
    }

    function closeRecordsModal() {
        const backdrop = document.getElementById('records-modal');
        if (backdrop) {
            backdrop.classList.add('hidden');
        }
    }

    // Fallback para carregamento direto da página
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
        setFilterMode,
        openRecordsModal,
        closeRecordsModal,
        render: function(d) {
            if (d) {
                setFilterMode('date', d);
            } else {
                renderReport();
            }
        }
    };
})();
