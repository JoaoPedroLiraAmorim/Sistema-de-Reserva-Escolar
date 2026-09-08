/**
 * equipamentos.js — Gestão simples e amigável de notebooks da escola
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.EquipamentosModule = (function() {
    let currentSession = null;
    let isInitialized = false;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;

        if (!isInitialized) {
            isInitialized = true;

            // Botão Adicionar Notebook (Cabeçalho)
            document.getElementById('btnAddEquipment')?.addEventListener('click', () => {
                document.getElementById('add-eq-form')?.reset();
                document.getElementById('new-brand-group')?.classList.add('hidden');
                const brandNewInput = document.getElementById('add-brand-new');
                if (brandNewInput) brandNewInput.required = false;
                const errEl = document.getElementById('add-eq-error');
                if (errEl) errEl.style.display = 'none';
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
                        newGroup?.classList.remove('hidden');
                        if (newInput) {
                            newInput.required = true;
                            newInput.focus();
                        }
                    } else {
                        newGroup?.classList.add('hidden');
                        if (newInput) newInput.required = false;
                    }
                });
            }

            // Submissão dos Formulários
            document.getElementById('add-eq-form')?.addEventListener('submit', handleAddEquipment);
            document.getElementById('edit-status-form')?.addEventListener('submit', handleEditStatus);
        }

        renderEquipmentView();
    }

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
        const statsBar = document.getElementById('eq-stats-bar');
        if (statsBar) {
            statsBar.innerHTML = `
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
                        <span class="material-symbols-outlined">error</span>
                    </div>
                    <div class="stat-pill-info">
                        <h4>Quebrados</h4>
                        <div class="stat-num">${qbr}</div>
                    </div>
                </div>
            `;
        }

        // 2. Grid de Cards por Marca
        const grid = document.getElementById('eq-cards-grid');
        if (!grid) return;

        if (notebooks.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-eq">
                    <span class="material-symbols-outlined">devices</span>
                    <p>Nenhum notebook cadastrado no momento.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = notebooks.map(nb => {
            const pctFunc = nb.total > 0 ? Math.round((nb.funcionando / nb.total) * 100) : 0;
            const pctDef  = nb.total > 0 ? Math.round((nb.defeito / nb.total) * 100) : 0;
            const pctQbr  = nb.total > 0 ? Math.round((nb.quebrado / nb.total) * 100) : 0;

            return `
                <div class="eq-brand-card">
                    <div class="eq-brand-header">
                        <div class="brand-badge-name">
                            <span class="material-symbols-outlined">laptop_mac</span>
                            <h3>${nb.marca}</h3>
                        </div>
                        <div class="eq-brand-actions">
                            <button type="button" class="btn-icon-action" onclick="openEditStatusModal('${nb.id}')" title="Editar quantidades">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button type="button" class="btn-icon-action danger" onclick="handleDeleteBrand('${nb.id}', '${nb.marca}')" title="Remover marca">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>

                    <div class="eq-total-banner">
                        <span class="eq-total-number">${nb.total}</span>
                        <span class="eq-total-label">notebooks no total</span>
                    </div>

                    <!-- Linha visual empilhada -->
                    <div class="eq-stacked-bar" title="${nb.funcionando} disponíveis / ${nb.defeito} em conserto / ${nb.quebrado} quebrados">
                        <div class="stacked-fill green" style="width: ${pctFunc}%;"></div>
                        <div class="stacked-fill orange" style="width: ${pctDef}%;"></div>
                        <div class="stacked-fill red" style="width: ${pctQbr}%;"></div>
                    </div>

                    <!-- 3 contadores com cores -->
                    <div class="eq-status-row">
                        <div class="status-box green">
                            <span class="status-num">${nb.funcionando}</span>
                            <span class="status-name">Disponíveis</span>
                        </div>
                        <div class="status-box orange">
                            <span class="status-num">${nb.defeito}</span>
                            <span class="status-name">Em conserto</span>
                        </div>
                        <div class="status-box red">
                            <span class="status-num">${nb.quebrado}</span>
                            <span class="status-name">Quebrados</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL: ADICIONAR NOTEBOOKS
    // ─────────────────────────────────────────────────────────────
    function handleAddEquipment(e) {
        e.preventDefault();
        const errEl = document.getElementById('add-eq-error');
        if (errEl) errEl.style.display = 'none';

        const selectVal = document.getElementById('add-brand-select')?.value;
        const brand = selectVal === '__new__'
            ? document.getElementById('add-brand-new')?.value.trim()
            : selectVal;

        if (!brand) {
            if (errEl) { errEl.textContent = 'Selecione ou digite o nome da marca.'; errEl.style.display = 'block'; }
            return;
        }

        const qty = parseInt(document.getElementById('add-qty')?.value) || 0;
        if (qty < 1) {
            if (errEl) { errEl.textContent = 'Informe uma quantidade válida (mínimo 1).'; errEl.style.display = 'block'; }
            return;
        }

        const result = ERS.addNotebooks(brand, qty, 'funcionando');
        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('add-eq-modal');
        document.getElementById('add-eq-form')?.reset();
        renderEquipmentView();
        ERS.showToast(`${qty} notebook(s) ${brand} adicionado(s) com sucesso!`, 'success');
        if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL: EDITAR QUANTIDADES DA MARCA
    // ─────────────────────────────────────────────────────────────
    function openEditStatusModal(id) {
        const nb = ERS.getNotebooks().find(n => n.id === id);
        if (!nb) return;

        const idInput = document.getElementById('edit-nb-id');
        const titleEl = document.getElementById('edit-modal-title');
        const funcEl = document.getElementById('edit-func');
        const defEl = document.getElementById('edit-def');
        const qbrEl = document.getElementById('edit-qbr');
        const errEl = document.getElementById('edit-eq-error');

        if (idInput) idInput.value = nb.id;
        if (titleEl) titleEl.textContent = `Editar Notebooks: ${nb.marca}`;
        if (funcEl) funcEl.value = nb.funcionando;
        if (defEl) defEl.value = nb.defeito;
        if (qbrEl) qbrEl.value = nb.quebrado;
        if (errEl) errEl.style.display = 'none';

        openModal('edit-status-modal');
    }

    function handleEditStatus(e) {
        e.preventDefault();
        const errEl = document.getElementById('edit-eq-error');
        if (errEl) errEl.style.display = 'none';

        const id = document.getElementById('edit-nb-id')?.value;
        const funcionando = parseInt(document.getElementById('edit-func')?.value);
        const defeito = parseInt(document.getElementById('edit-def')?.value);
        const quebrado = parseInt(document.getElementById('edit-qbr')?.value);

        if (isNaN(funcionando) || isNaN(defeito) || isNaN(quebrado) || funcionando < 0 || defeito < 0 || quebrado < 0) {
            if (errEl) { errEl.textContent = 'Informe apenas números positivos.'; errEl.style.display = 'block'; }
            return;
        }

        const result = typeof ERS.updateNotebookBrandCounts === 'function'
            ? ERS.updateNotebookBrandCounts(id, { funcionando, defeito, quebrado })
            : { ok: false, message: 'Função de atualização não encontrada' };

        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('edit-status-modal');
        renderEquipmentView();
        ERS.showToast('Quantidades atualizadas com sucesso!', 'success');
        if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
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
            if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
        } else {
            ERS.showToast(result.message, 'error');
        }
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
        render: renderEquipmentView,
        openEditStatusModal,
        handleDeleteBrand
    };
})();

// Exporta funções chamadas inline no HTML / onclick
window.openEditStatusModal = function(id) {
    window.EquipamentosModule?.openEditStatusModal(id);
};
window.handleDeleteBrand = function(id, marca) {
    window.EquipamentosModule?.handleDeleteBrand(id, marca);
};
