/**
 * equipamentos.js — Gestão de notebooks/equipamentos
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

let currentSession = null;
const BRAND_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

document.addEventListener('DOMContentLoaded', () => {
    currentSession = AUTH.requireAuth(['proatec', 'coordenacao']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();
    AUTH.adaptSidebarByRole(currentSession);

    document.getElementById('btnAddEquipment').addEventListener('click', () => openModal('add-eq-modal'));
    document.getElementById('add-eq-form').addEventListener('submit', handleAddEquipment);

    renderTable();
});

// ─────────────────────────────────────────────────────────────
//  TABELA DE NOTEBOOKS
// ─────────────────────────────────────────────────────────────
function renderTable() {
    const notebooks = ERS.getNotebooks();

    const total = notebooks.reduce((a, n) => a + n.total, 0);
    const func  = notebooks.reduce((a, n) => a + n.funcionando, 0);
    const def   = notebooks.reduce((a, n) => a + n.defeito, 0);
    const qbr   = notebooks.reduce((a, n) => a + n.quebrado, 0);

    document.getElementById('eq-summary').innerHTML = `
        <div class="eq-summary-card"><h4>Total cadastrado</h4><div class="num">${total}</div></div>
        <div class="eq-summary-card"><h4>Funcionando</h4><div class="num green">${func}</div></div>
        <div class="eq-summary-card"><h4>Com defeito</h4><div class="num orange">${def}</div></div>
        <div class="eq-summary-card"><h4>Quebrados</h4><div class="num red">${qbr}</div></div>
    `;

    document.getElementById('eq-tbody').innerHTML = notebooks.map((nb, i) => `
        <tr>
            <td>
                <div class="eq-brand-pill">
                    <div class="eq-brand-dot" style="background:${BRAND_COLORS[i % BRAND_COLORS.length]}"></div>
                    <strong>${nb.marca}</strong>
                </div>
            </td>
            <td class="eq-stat"><span class="eq-stat-num">${nb.total}</span></td>
            <td class="eq-stat">
                <span class="eq-stat-num stat-green">${nb.funcionando}</span>
                <div class="eq-actions">
                    <button class="btn-add-eq" onclick="adjustNb('${nb.id}','funcionando',1)" title="Adicionar">+</button>
                    <button class="btn-rm-eq"  onclick="adjustNb('${nb.id}','funcionando',-1)" title="Remover">−</button>
                </div>
            </td>
            <td class="eq-stat">
                <span class="eq-stat-num stat-orange">${nb.defeito}</span>
                <div class="eq-actions">
                    <button class="btn-add-eq" onclick="adjustNb('${nb.id}','defeito',1)" title="Adicionar">+</button>
                    <button class="btn-rm-eq"  onclick="adjustNb('${nb.id}','defeito',-1)" title="Remover">−</button>
                </div>
            </td>
            <td class="eq-stat">
                <span class="eq-stat-num stat-red">${nb.quebrado}</span>
                <div class="eq-actions">
                    <button class="btn-add-eq" onclick="adjustNb('${nb.id}','quebrado',1)" title="Adicionar">+</button>
                    <button class="btn-rm-eq"  onclick="adjustNb('${nb.id}','quebrado',-1)" title="Remover">−</button>
                </div>
            </td>
            <td>
                <button class="btn-add-eq btn-add-brand"
                    onclick="document.getElementById('add-brand').value='${nb.marca}'; openModal('add-eq-modal');"
                    title="Adicionar mais desta marca">
                    + Adicionar
                </button>
            </td>
        </tr>
    `).join('');
}

function adjustNb(id, field, delta) {
    const result = ERS.updateNotebookStatus(id, field, delta);
    if (!result.ok) {
        ERS.showToast(result.message, 'error');
        return;
    }
    renderTable();
}

function handleAddEquipment(e) {
    e.preventDefault();
    const brand = document.getElementById('add-brand').value;
    const qty   = parseInt(document.getElementById('add-qty').value) || 0;
    if (qty < 1) return;

    ERS.addNotebooks(brand, qty);
    closeModal('add-eq-modal');
    document.getElementById('add-eq-form').reset();
    renderTable();
    ERS.showToast(`${qty} notebook(s) ${brand} cadastrado(s) com sucesso!`, 'success');
}
