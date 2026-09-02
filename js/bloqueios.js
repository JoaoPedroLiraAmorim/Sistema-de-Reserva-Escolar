/**
 * bloqueios.js — Gestão de bloqueios de períodos (exclusivo Coordenação)
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

let currentSession = null;

document.addEventListener('DOMContentLoaded', () => {
    currentSession = AUTH.requireAuth(['coordenacao']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();

    document.getElementById('btnOpenBlock').addEventListener('click', () => {
        document.getElementById('blk-date').value = ERS.today();
        document.getElementById('blk-error').style.display = 'none';
        openModal('block-modal');
    });

    document.getElementById('block-form').addEventListener('submit', handleCreateBlock);

    renderBlocks();
});

// ─────────────────────────────────────────────────────────────
//  LISTA DE BLOQUEIOS
// ─────────────────────────────────────────────────────────────
function renderBlocks() {
    const blocks = ERS.getBlocks()
        .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
    const list = document.getElementById('block-list');

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
            <button class="btn-delete-block" onclick="deleteBlock('${b.id}')">
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
}

// ─────────────────────────────────────────────────────────────
//  CRIAR BLOQUEIO
// ─────────────────────────────────────────────────────────────
function handleCreateBlock(e) {
    e.preventDefault();
    const errEl = document.getElementById('blk-error');
    errEl.style.display = 'none';

    const data   = document.getElementById('blk-date').value;
    const inicio = document.getElementById('blk-start').value;
    const fim    = document.getElementById('blk-end').value;
    const motivo = document.getElementById('blk-motivo').value.trim();

    const result = ERS.createBlock({ data, inicio, fim, motivo, criadoPor: currentSession.nome });
    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('block-modal');
    document.getElementById('block-form').reset();
    renderBlocks();
    ERS.showToast('Bloqueio criado. Novas reservas nesse período serão impedidas.', 'success');
}
