/**
 * bloqueios.js — Gestão de bloqueios de períodos (exclusivo Coordenação)
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.BloqueiosModule = (function() {
    let currentSession = null;
    let isInitialized = false;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;

        if (!isInitialized) {
            isInitialized = true;

            const openBlockBtn = document.getElementById('btnOpenBlockPage') || document.getElementById('btnOpenBlock');
            openBlockBtn?.addEventListener('click', () => {
                const dateEl = document.getElementById('blk-date');
                if (dateEl) dateEl.value = ERS.today();
                const errEl = document.getElementById('blk-error');
                if (errEl) errEl.style.display = 'none';
                openModal('block-modal');
            });

            // Se o form ainda não teve handler registrado
            const form = document.getElementById('block-form');
            if (form && !form.dataset.boundBloqueios) {
                form.dataset.boundBloqueios = 'true';
                form.addEventListener('submit', handleCreateBlock);
            }
        }

        renderBlocks();
    }

    // ─────────────────────────────────────────────────────────────
    //  LISTA DE BLOQUEIOS
    // ─────────────────────────────────────────────────────────────
    function renderBlocks() {
        const blocks = ERS.getBlocks()
            .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
        const list = document.getElementById('block-list');
        if (!list) return;

        if (blocks.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">event_available</span>
                    <p>Nenhum bloqueio cadastrado.</p>
                    <p>Crie um bloqueio para impedir reservas em datas específicas.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = blocks.map(b => `
            <div class="block-item">
                <div class="block-icon">
                    <span class="material-symbols-outlined">block</span>
                </div>
                <div class="block-body">
                    <div class="block-title">${b.motivo}</div>
                    <div class="block-meta">
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">calendar_today</span>
                            ${ERS.formatDate(b.data)}
                        </span>
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">schedule</span>
                            ${b.inicio} – ${b.fim}
                        </span>
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">person</span>
                            ${b.criadoPor}
                        </span>
                    </div>
                </div>
                <button type="button" class="btn-delete-block" onclick="deleteBlock('${b.id}')">
                    <span class="material-symbols-outlined">delete</span>
                    Excluir
                </button>
            </div>
        `).join('');
    }

    function deleteBlock(id) {
        if (!confirm('Remover este bloqueio? Reservas neste período voltarão a ser permitidas.')) return;
        ERS.deleteBlock(id);
        renderBlocks();
        ERS.showToast('Bloqueio removido com sucesso.', 'success');
        if (window.AgendaProatecModule?.render) window.AgendaProatecModule.render();
    }

    // ─────────────────────────────────────────────────────────────
    //  CRIAR BLOQUEIO
    // ─────────────────────────────────────────────────────────────
    function handleCreateBlock(e) {
        e.preventDefault();
        const errEl = document.getElementById('blk-error');
        if (errEl) errEl.style.display = 'none';

        const data   = document.getElementById('blk-date')?.value;
        const inicio = document.getElementById('blk-start')?.value;
        const fim    = document.getElementById('blk-end')?.value;
        const motivo = document.getElementById('blk-motivo')?.value.trim();

        if (!data || data < ERS.today()) {
            if (errEl) { errEl.textContent = 'A data do bloqueio não pode ser anterior a hoje.'; errEl.style.display = 'block'; }
            return;
        }

        if (!inicio || !fim || inicio >= fim) {
            if (errEl) { errEl.textContent = 'O horário de início deve ser anterior ao horário de término.'; errEl.style.display = 'block'; }
            return;
        }

        const creator = currentSession ? currentSession.nome : 'Coordenação';
        const result = ERS.createBlock({ data, inicio, fim, motivo, criadoPor: creator });
        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('block-modal');
        document.getElementById('block-form')?.reset();
        renderBlocks();
        ERS.showToast('Bloqueio criado. Novas reservas nesse período serão impedidas.', 'success');
        if (window.AgendaProatecModule?.render) window.AgendaProatecModule.render();
    }

    // Fallback para carregamento isolado da página bloqueios.html
    if (!window.isSpaMode && window.location.pathname.includes('bloqueios.html')) {
        document.addEventListener('DOMContentLoaded', () => {
            const s = AUTH.requireAuth(['coordenacao']);
            if (s) {
                AUTH.renderUserInfo(s);
                AUTH.setupLogout();
                init(s);
            }
        });
    }

    return {
        init,
        render: renderBlocks,
        deleteBlock
    };
})();

// Exporta funções chamadas inline no HTML / onclick
window.deleteBlock = function(id) {
    window.BloqueiosModule?.deleteBlock(id);
};
