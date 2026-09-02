/**
 * equipamentos.js — Gestão simples e amigável de notebooks da escola
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

    // Botão Adicionar Notebook (Cabeçalho)
    document.getElementById('btnAddEquipment').addEventListener('click', () => {
        document.getElementById('add-eq-form').reset();
        document.getElementById('new-brand-group').classList.add('hidden');
        document.getElementById('add-brand-new').required = false;
        document.getElementById('add-eq-error').style.display = 'none';
        populateBrandOptions();
        openModal('add-eq-modal');
    });

    // Seletor de Marca no Modal
    const brandSelect = document.getElementById('add-brand-select');
    if (brandSelect) {
        brandSelect.addEventListener('change', () => {
            const newGroup = document.getElementById('new-brand-group');
            const newInput = document.getElementById('add-brand-new');
            if (brandSelect.value === '__new__') {
                newGroup.classList.remove('hidden');
                newInput.required = true;
                newInput.focus();
            } else {
                newGroup.classList.add('hidden');
                newInput.required = false;
            }
        });
    }

    // Submissão dos Formulários
    document.getElementById('add-eq-form').addEventListener('submit', handleAddEquipment);
    document.getElementById('edit-status-form').addEventListener('submit', handleEditStatus);

    renderEquipmentView();
});

// ─────────────────────────────────────────────────────────────
//  POPULAR OPÇÕES DE MARCA NO MODAL
// ─────────────────────────────────────────────────────────────
function populateBrandOptions() {
    const sel = document.getElementById('add-brand-select');
    if (!sel) return;

    const existingBrands = ERS.getBrands();
    const defaultBrands = ['Dell', 'Lenovo', 'Acer', 'Positivo'];
    const allBrands = Array.from(new Set([...defaultBrands, ...existingBrands]));

    sel.innerHTML = '<option value="">Selecione a marca...</option>' +
        allBrands.map(b => `<option value="${b}">${b}</option>`).join('') +
        '<option value="__new__">+ Outra marca...</option>';
}

// ─────────────────────────────────────────────────────────────
//  RENDERIZAÇÃO DOS CARDS E RESUMO SIMPLES
// ─────────────────────────────────────────────────────────────
function renderEquipmentView() {
    const notebooks = ERS.getNotebooks();

    const total = notebooks.reduce((a, n) => a + n.total, 0);
    const func  = notebooks.reduce((a, n) => a + n.funcionando, 0);
    const def   = notebooks.reduce((a, n) => a + n.defeito, 0);
    const qbr   = notebooks.reduce((a, n) => a + n.quebrado, 0);

    // 1. Mini Resumo no topo
    document.getElementById('eq-stats-bar').innerHTML = `
        <div class="eq-stat-pill-card">
            <div class="stat-pill-icon blue">
                <span class="material-symbols-outlined">laptop</span>
            </div>
            <div class="stat-pill-info">
                <h4>Total</h4>
                <div class="stat-num">${total}</div>
            </div>
        </div>

        <div class="eq-stat-pill-card">
            <div class="stat-pill-icon green">
                <span class="material-symbols-outlined">check_circle</span>
            </div>
            <div class="stat-pill-info">
                <h4>Disponíveis</h4>
                <div class="stat-num">${func}</div>
            </div>
        </div>

        <div class="eq-stat-pill-card">
            <div class="stat-pill-icon orange">
                <span class="material-symbols-outlined">build</span>
            </div>
            <div class="stat-pill-info">
                <h4>Com defeito</h4>
                <div class="stat-num">${def}</div>
            </div>
        </div>

        <div class="eq-stat-pill-card">
            <div class="stat-pill-icon red">
                <span class="material-symbols-outlined">cancel</span>
            </div>
            <div class="stat-pill-info">
                <h4>Quebrados</h4>
                <div class="stat-num">${qbr}</div>
            </div>
        </div>
    `;

    // 2. Grid de Cards por Marca
    const grid = document.getElementById('eq-cards-grid');
    if (notebooks.length === 0) {
        grid.innerHTML = `
            <div class="eq-empty-state">
                <p>Nenhum notebook cadastrado. Clique em <strong>"Adicionar notebook"</strong> acima para começar.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = notebooks.map(nb => `
        <div class="eq-brand-card">
            <div class="eq-brand-header">
                <div class="eq-brand-title">
                    <div class="eq-brand-icon">
                        <span class="material-symbols-outlined">laptop_mac</span>
                    </div>
                    <div>
                        <h4>${nb.marca}</h4>
                        <span class="eq-brand-total">Total: ${nb.total} notebooks</span>
                    </div>
                </div>
                <button type="button" class="btn-icon-del" onclick="handleDeleteBrand('${nb.id}', '${nb.marca}')" title="Excluir marca">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>

            <div class="eq-status-boxes-row">
                <div class="status-box green" title="Prontos para reserva">
                    <span class="status-box-num">${nb.funcionando}</span>
                    <span class="status-box-label">Disponíveis</span>
                </div>
                <div class="status-box orange" title="Em conserto / manutenção">
                    <span class="status-box-num">${nb.defeito}</span>
                    <span class="status-box-label">Defeito</span>
                </div>
                <div class="status-box red" title="Quebrados / Inutilizados">
                    <span class="status-box-num">${nb.quebrado}</span>
                    <span class="status-box-label">Quebrados</span>
                </div>
            </div>

            <div class="eq-card-footer">
                <button type="button" class="btn-card-edit" onclick="openEditStatusModal('${nb.id}')">
                    <span class="material-symbols-outlined">edit</span>
                    <span>Editar quantidades</span>
                </button>
            </div>
        </div>
    `).join('');
}

// ─────────────────────────────────────────────────────────────
//  MODAL: ADICIONAR NOTEBOOKS
// ─────────────────────────────────────────────────────────────
function handleAddEquipment(e) {
    e.preventDefault();
    const errEl = document.getElementById('add-eq-error');
    errEl.style.display = 'none';

    const brandSelect = document.getElementById('add-brand-select').value;
    let brand = brandSelect;
    if (brandSelect === '__new__') {
        brand = document.getElementById('add-brand-new').value.trim();
        if (!brand) {
            errEl.textContent = 'Informe o nome da marca.';
            errEl.style.display = 'block';
            return;
        }
    }

    if (!brand) {
        errEl.textContent = 'Selecione ou informe a marca do notebook.';
        errEl.style.display = 'block';
        return;
    }

    const qty = parseInt(document.getElementById('add-qty').value) || 0;
    if (qty < 1) {
        errEl.textContent = 'Informe uma quantidade válida (mínimo 1).';
        errEl.style.display = 'block';
        return;
    }

    const result = ERS.addNotebooks(brand, qty, 'funcionando');
    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('add-eq-modal');
    document.getElementById('add-eq-form').reset();
    renderEquipmentView();
    ERS.showToast(`${qty} notebook(s) ${brand} adicionado(s) com sucesso!`, 'success');
}

// ─────────────────────────────────────────────────────────────
//  MODAL: EDITAR QUANTIDADES DA MARCA
// ─────────────────────────────────────────────────────────────
function openEditStatusModal(id) {
    const nb = ERS.getNotebooks().find(n => n.id === id);
    if (!nb) return;

    document.getElementById('edit-nb-id').value = nb.id;
    document.getElementById('edit-modal-title').textContent = `Editar Notebooks: ${nb.marca}`;
    document.getElementById('edit-func').value = nb.funcionando;
    document.getElementById('edit-def').value = nb.defeito;
    document.getElementById('edit-qbr').value = nb.quebrado;
    document.getElementById('edit-eq-error').style.display = 'none';

    openModal('edit-status-modal');
}

function handleEditStatus(e) {
    e.preventDefault();
    const errEl = document.getElementById('edit-eq-error');
    errEl.style.display = 'none';

    const id = document.getElementById('edit-nb-id').value;
    const funcionando = parseInt(document.getElementById('edit-func').value);
    const defeito = parseInt(document.getElementById('edit-def').value);
    const quebrado = parseInt(document.getElementById('edit-qbr').value);

    if (isNaN(funcionando) || isNaN(defeito) || isNaN(quebrado) || funcionando < 0 || defeito < 0 || quebrado < 0) {
        errEl.textContent = 'Informe apenas números positivos.';
        errEl.style.display = 'block';
        return;
    }

    const result = typeof ERS.updateNotebookBrandCounts === 'function'
        ? ERS.updateNotebookBrandCounts(id, { funcionando, defeito, quebrado })
        : { ok: false, message: 'Função de atualização não encontrada' };

    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('edit-status-modal');
    renderEquipmentView();
    ERS.showToast('Quantidades atualizadas com sucesso!', 'success');
}

// ─────────────────────────────────────────────────────────────
//  EXCLUIR MARCA
// ─────────────────────────────────────────────────────────────
function handleDeleteBrand(id, marca) {
    if (!confirm(`Deseja remover os notebooks da marca "${marca}"?`)) {
        return;
    }

    const result = typeof ERS.deleteNotebookBrand === 'function'
        ? ERS.deleteNotebookBrand(id)
        : { ok: false, message: 'Função não disponível' };

    if (result.ok) {
        renderEquipmentView();
        ERS.showToast(`Marca "${marca}" removida.`, 'success');
    } else {
        ERS.showToast(result.message, 'error');
    }
}
