/**
 * relatorio.js — Relatórios de reservas por data
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.RelatorioModule = (function() {
    const ICON_COLORS = ['primary', 'secondary', 'tertiary'];
    const ICON_NAMES  = ['laptop_mac', 'laptop_chromebook', 'laptop_windows'];
    let currentSession = null;
    let isInitialized = false;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;

        const dateInput = document.getElementById('report-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = ERS.today();
        }

        if (!isInitialized) {
            isInitialized = true;
            if (dateInput) {
                dateInput.addEventListener('change', () => renderReport(dateInput.value));
            }
        }

        renderReport(dateInput ? dateInput.value : ERS.today());
    }

    // ─────────────────────────────────────────────────────────────
    //  RELATÓRIO
    // ─────────────────────────────────────────────────────────────
    function renderReport(dateStr) {
        if (!dateStr) dateStr = ERS.today();

        // Inclui canceladas para o relatório completo
        const reservations = ERS.getReservations()
            .filter(r => r.data === dateStr)
            .sort((a, b) => a.inicio.localeCompare(b.inicio));

        const dateLabel = document.getElementById('date-label');
        if (dateLabel) {
            dateLabel.textContent = dateStr === ERS.today() ? 'Hoje' : ERS.formatDate(dateStr);
        }

        const totalRes       = reservations.length;
        const totalNotebooks = reservations.reduce((a, r) => a + (r.notebooks || 0), 0);
        const canceladas     = reservations.filter(r => r.situacao === 'cancelada').length;

        const statsEl = document.getElementById('report-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card">
                    <p class="stat-label">Reservas</p>
                    <p class="stat-value">${totalRes}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Notebooks</p>
                    <p class="stat-value primary">${totalNotebooks}</p>
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
                    <p>Nenhuma reserva para esta data.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = reservations.map((r, i) => `
            <article class="report-card${r.situacao === 'cancelada' ? ' upcoming' : ''}">
                <div class="report-card-header">
                    <div class="report-lead">
                        <div class="report-icon-box ${ICON_COLORS[i % ICON_COLORS.length]}">
                            <span class="material-symbols-outlined">${ICON_NAMES[i % ICON_NAMES.length]}</span>
                        </div>
                        <div class="report-details">
                            <div class="report-title-row">
                                <h3 class="report-teacher-name">${r.professorNome}</h3>
                                <span class="report-class-tag">• Turma ${r.turma}</span>
                                ${r.situacao === 'cancelada' ? '<span class="badge badge-neutral">Cancelada</span>' : ''}
                            </div>
                            <div class="report-meta-row">
                                <span class="report-meta-item">
                                    <span class="material-symbols-outlined">schedule</span>
                                    ${r.inicio} – ${r.fim}
                                </span>
                                ${r.sala ? `<span class="report-meta-item">
                                    <span class="material-symbols-outlined">meeting_room</span>
                                    ${r.sala}
                                </span>` : ''}
                                ${r.notebooks ? `<span class="report-meta-item">
                                    <span class="material-symbols-outlined">laptop</span>
                                    ${r.notebooks} notebooks
                                </span>` : ''}
                            </div>
                        </div>
                    </div>
                    <span class="badge badge-${r.situacao === 'confirmada' ? 'primary' : 'neutral'}">
                        ${r.situacao === 'confirmada' ? 'Confirmada' : 'Cancelada'}
                    </span>
                </div>
            </article>
        `).join('');
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
        render: function(d) {
            const input = document.getElementById('report-date');
            renderReport(d || (input ? input.value : ERS.today()));
        }
    };
})();
