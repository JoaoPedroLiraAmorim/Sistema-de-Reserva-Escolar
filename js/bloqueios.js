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
                setDateBounds();
                setHoursVisibility();
                const errEl = document.getElementById('blk-error');
                if (errEl) errEl.style.display = 'none';
                openModal('block-modal');
            });

            document.getElementById('block-form')?.addEventListener('submit', handleCreateBlock);
            document.getElementById('blk-date')?.addEventListener('change', setDateBounds);
            document.getElementById('blk-all-times')?.addEventListener('change', setHoursVisibility);
            window.addEventListener('ers:reservations-updated', renderBlocks);
        }

        renderBlocks();
    }

    function renderBlocks() {
        const blocks = [...ERS.getBlocks()]
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
                    <div class="block-title">${ERS.escapeHtml(b.motivo || 'Bloqueio de reservas')}</div>
                    <div class="block-meta">
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">calendar_today</span>
                            ${formatBlockDates(b)}
                        </span>
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">schedule</span>
                            ${formatBlockHours(b)}
                        </span>
                        <span class="block-meta-item">
                            <span class="material-symbols-outlined">person</span>
                            ${ERS.escapeHtml(b.criadoPor)}
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

    async function deleteBlock(id) {
        const ok = await showConfirmModal({
            title: 'Remover Bloqueio',
            message: 'Deseja realmente remover este bloqueio? As reservas neste período voltarão a ser permitidas.',
            icon: 'lock_open',
            type: 'danger',
            confirmText: 'Remover Bloqueio',
            cancelText: 'Cancelar'
        });
        if (!ok) return;

        const result = await ERS.deleteBlock(id);
        if (!result.ok) { ERS.showToast(result.message, 'error'); return; }
        renderBlocks();
        ERS.showToast('Bloqueio removido com sucesso.', 'success');
        if (window.AgendaProatecModule?.render) window.AgendaProatecModule.render();
    }

    function setDateBounds() {
        const start = document.getElementById('blk-date');
        const end = document.getElementById('blk-date-end');
        start.min = ERS.today();
        if (start.value < start.min) start.value = start.min;
        end.min = start.value;
        if (end.value < end.min) end.value = end.min;
    }

    function setHoursVisibility() {
        const allHours = document.getElementById('blk-all-times').checked;
        document.getElementById('blk-hours').hidden = allHours;
        document.getElementById('blk-start').disabled = allHours;
        document.getElementById('blk-end').disabled = allHours;
    }

    function formatBlockDates(b) {
        const start = ERS.formatDate(b.data);
        return b.dataFim && b.dataFim !== b.data ? `${start} a ${ERS.formatDate(b.dataFim)}` : start;
    }

    function formatBlockHours(b) {
        return b.todosHorarios ? 'Todos os horários' : `${b.inicio} – ${b.fim}`;
    }

    async function handleCreateBlock(e) {
        e.preventDefault();
        const errEl = document.getElementById('blk-error');
        if (errEl) errEl.style.display = 'none';

        const data   = document.getElementById('blk-date')?.value;
        const dataFim = document.getElementById('blk-date-end')?.value;
        const todosHorarios = document.getElementById('blk-all-times').checked;
        const inicio = document.getElementById('blk-start')?.value;
        const fim    = document.getElementById('blk-end')?.value;
        const motivo = document.getElementById('blk-motivo')?.value.trim();

        if (!data || !dataFim || data < ERS.today() || dataFim < data) {
            if (errEl) { errEl.textContent = 'Informe um intervalo de datas válido, a partir de hoje.'; errEl.style.display = 'block'; }
            return;
        }

        if (!todosHorarios && (!inicio || !fim || inicio >= fim)) {
            if (errEl) { errEl.textContent = 'O horário de início deve ser anterior ao horário de término.'; errEl.style.display = 'block'; }
            return;
        }

        const creator = currentSession ? currentSession.nome : 'Coordenação';
        const result = await ERS.createBlock({ data, dataFim, todosHorarios, inicio, fim, motivo, criadoPor: creator });
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

    if (!window.isSpaMode && window.location.pathname.includes('bloqueios.html')) {
        document.addEventListener('ers:ready', () => {
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
        deleteBlock,
        formatBlockDates,
        formatBlockHours
    };
})();

window.deleteBlock = function(id) {
    window.BloqueiosModule?.deleteBlock(id);
};
