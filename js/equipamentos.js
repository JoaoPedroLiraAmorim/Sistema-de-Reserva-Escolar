/**
 * equipamentos.js — Gestão de equipamentos e frota de notebooks escolares
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

window.EquipamentosModule = (function() {
    let currentSession = null;
    let isInitialized = false;

    function init(session) {
        currentSession = session || (window.AUTH ? AUTH.getSession() : null);
        if (!currentSession) return;

        if (!isInitialized) {
            isInitialized = true;
            setupEventListeners();
        }

        renderEquipmentView();
    }

    // ─────────────────────────────────────────────────────────────
    //  CONFIGURAÇÃO DE LISTENERS
    // ─────────────────────────────────────────────────────────────
    function setupEventListeners() {
        // 1. Botão Adicionar Notebook (Cabeçalho)
        document.getElementById('btnAddEquipment')?.addEventListener('click', () => {
            const form = document.getElementById('add-eq-form');
            if (form) form.reset();

            const newGroup = document.getElementById('new-brand-group');
            if (newGroup) newGroup.classList.add('hidden');

            const brandNewInput = document.getElementById('add-brand-new');
            if (brandNewInput) brandNewInput.required = false;

            const errEl = document.getElementById('add-eq-error');
            if (errEl) errEl.style.display = 'none';

            populateBrandOptions();
            openModal('add-eq-modal');
        });

        // 2. Seletor de Marca no Modal
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

        // 3. Botões rápidos de quantidade (+5, +10, +20) no Modal de Adicionar
        document.querySelectorAll('.btn-qty-quick').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const toAdd = parseInt(btn.getAttribute('data-add')) || 0;
                const qtyInput = document.getElementById('add-qty');
                if (qtyInput) {
                    const currentVal = parseInt(qtyInput.value) || 0;
                    qtyInput.value = currentVal + toAdd;
                    qtyInput.dispatchEvent(new Event('input'));
                }
            });
        });

        // 4. Steppers numéricos (+ e -) no Modal de Ajustar Estoque
        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const delta = parseInt(btn.getAttribute('data-delta')) || 0;
                const input = document.getElementById(targetId);
                if (input) {
                    const currentVal = parseInt(input.value) || 0;
                    const newVal = Math.max(0, currentVal + delta);
                    input.value = newVal;
                    updateEditModalCalculatedTotal();
                }
            });
        });

        // Atualização em tempo real do total no modal ao digitar
        ['edit-func', 'edit-def', 'edit-qbr'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateEditModalCalculatedTotal);
        });

        // 5. Submissão dos Formulários
        document.getElementById('add-eq-form')?.addEventListener('submit', handleAddEquipment);
        document.getElementById('edit-status-form')?.addEventListener('submit', handleEditStatus);
    }

    // ─────────────────────────────────────────────────────────────
    //  POPULAR OPÇÕES DE MARCA NO MODAL
    // ─────────────────────────────────────────────────────────────
    function populateBrandOptions() {
        const sel = document.getElementById('add-brand-select');
        if (!sel) return;

        const existingBrands = ERS.getBrands ? ERS.getBrands() : [];
        const defaultBrands = ['Dell', 'Lenovo', 'Acer', 'Positivo'];
        const allBrands = Array.from(new Set([...defaultBrands, ...existingBrands]));

        sel.innerHTML = '<option value="">Selecione a marca...</option>' +
            allBrands.map(b => `<option value="${b}">${b}</option>`).join('') +
            '<option value="__new__">+ Outra marca...</option>';
    }

    // ─────────────────────────────────────────────────────────────
    //  CÁLCULO DINÂMICO DO TOTAL NO MODAL DE EDIÇÃO
    // ─────────────────────────────────────────────────────────────
    function updateEditModalCalculatedTotal() {
        const func = parseInt(document.getElementById('edit-func')?.value) || 0;
        const def  = parseInt(document.getElementById('edit-def')?.value) || 0;
        const qbr  = parseInt(document.getElementById('edit-qbr')?.value) || 0;
        const total = Math.max(0, func) + Math.max(0, def) + Math.max(0, qbr);

        const totalBadge = document.getElementById('edit-calc-total');
        if (totalBadge) {
            totalBadge.textContent = `${total} ${total === 1 ? 'unidade' : 'unidades'}`;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDERIZAÇÃO GERAL DA VIEW
    // ─────────────────────────────────────────────────────────────
    function renderEquipmentView() {
        const allNotebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];

        // 1. Atualizar Barra de Indicadores (KPIs sem porcentagem)
        renderKPIStats(allNotebooks);

        // 2. Renderizar Grid de Cards com todos os equipamentos
        renderCardsView(allNotebooks);
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDERIZAR KPI STATS (SEM PORCENTAGEM)
    // ─────────────────────────────────────────────────────────────
    function renderKPIStats(notebooks) {
        const statsBar = document.getElementById('eq-stats-bar');
        if (!statsBar) return;

        const total = notebooks.reduce((a, n) => a + (n.total || 0), 0);
        const func  = notebooks.reduce((a, n) => a + (n.funcionando || 0), 0);
        const def   = notebooks.reduce((a, n) => a + (n.defeito || 0), 0);
        const qbr   = notebooks.reduce((a, n) => a + (n.quebrado || 0), 0);

        statsBar.innerHTML = `
            <div class="eq-stat-pill-card">
                <div class="stat-pill-icon blue">
                    <span class="material-symbols-outlined">inventory_2</span>
                </div>
                <div class="stat-pill-info">
                    <h4>Frota Total</h4>
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
                    <span class="material-symbols-outlined">build_circle</span>
                </div>
                <div class="stat-pill-info">
                    <h4>Em Manutenção</h4>
                    <div class="stat-num">${def}</div>
                </div>
            </div>

            <div class="eq-stat-pill-card">
                <div class="stat-pill-icon red">
                    <span class="material-symbols-outlined">report_problem</span>
                </div>
                <div class="stat-pill-info">
                    <h4>Inoperantes / Baixa</h4>
                    <div class="stat-num">${qbr}</div>
                </div>
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDERIZAR VIEW EM CARDS (SEM PORCENTAGEM)
    // ─────────────────────────────────────────────────────────────
    function renderCardsView(notebooks) {
        const grid = document.getElementById('eq-cards-grid');
        if (!grid) return;

        if (notebooks.length === 0) {
            grid.innerHTML = `
                <div class="eq-empty-state">
                    <span class="material-symbols-outlined">laptop</span>
                    <p>Nenhum equipamento cadastrado no patrimônio ainda.</p>
                    <button type="button" class="btn-primary" onclick="document.getElementById('btnAddEquipment')?.click()">
                        <span class="material-symbols-outlined">add_circle</span>
                        <span>Cadastrar Novos Notebooks</span>
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = notebooks.map(nb => {
            const funcWidth = nb.total > 0 ? (nb.funcionando / nb.total) * 100 : 0;
            const defWidth  = nb.total > 0 ? (nb.defeito / nb.total) * 100 : 0;
            const qbrWidth  = nb.total > 0 ? (nb.quebrado / nb.total) * 100 : 0;

            return `
                <div class="eq-brand-card">
                    <div class="eq-brand-header">
                        <div class="brand-badge-name">
                            <div class="brand-icon-box">
                                <span class="material-symbols-outlined">laptop_mac</span>
                            </div>
                            <h3>${nb.marca}</h3>
                        </div>
                        <div class="eq-brand-actions">
                            <button type="button" class="btn-icon-action" onclick="window.openEditStatusModal('${nb.id}')" title="Ajustar estoque">
                                <span class="material-symbols-outlined">tune</span>
                            </button>
                            <button type="button" class="btn-icon-action danger" onclick="window.handleDeleteBrand('${nb.id}', '${nb.marca}')" title="Excluir marca">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>

                    <div class="eq-total-banner">
                        <span class="eq-total-number">${nb.total}</span>
                        <span class="eq-total-label">notebooks registrados</span>
                    </div>

                    <!-- Barra visual de proporção (sem porcentagem) -->
                    <div class="eq-stacked-bar" title="${nb.funcionando} disponíveis / ${nb.defeito} em conserto / ${nb.quebrado} inoperantes">
                        <div class="stacked-fill green" style="width: ${funcWidth}%;"></div>
                        <div class="stacked-fill orange" style="width: ${defWidth}%;"></div>
                        <div class="stacked-fill red" style="width: ${qbrWidth}%;"></div>
                    </div>

                    <!-- 3 contadores numéricos diretos -->
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
                            <span class="status-name">Inoperantes</span>
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

        const statusInitial = document.getElementById('add-status-initial')?.value || 'funcionando';

        const result = ERS.addNotebooks(brand, qty, statusInitial);
        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('add-eq-modal');
        document.getElementById('add-eq-form')?.reset();
        renderEquipmentView();

        const statusLabelMap = {
            'funcionando': 'disponível(is)',
            'defeito': 'em manutenção',
            'quebrado': 'inoperante(s)'
        };
        const statusLabel = statusLabelMap[statusInitial] || 'registrado(s)';

        ERS.showToast(`${qty} notebook(s) ${brand} adicionado(s) como ${statusLabel}!`, 'success');
        if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL: EDITAR QUANTIDADES DA MARCA
    // ─────────────────────────────────────────────────────────────
    function openEditStatusModal(id) {
        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];
        const nb = notebooks.find(n => n.id === id);
        if (!nb) return;

        const idInput = document.getElementById('edit-nb-id');
        const titleEl = document.getElementById('edit-modal-title');
        const funcEl = document.getElementById('edit-func');
        const defEl = document.getElementById('edit-def');
        const qbrEl = document.getElementById('edit-qbr');
        const errEl = document.getElementById('edit-eq-error');

        if (idInput) idInput.value = nb.id;
        if (titleEl) titleEl.textContent = `Ajustar Estoque: ${nb.marca}`;
        if (funcEl) funcEl.value = nb.funcionando;
        if (defEl) defEl.value = nb.defeito;
        if (qbrEl) qbrEl.value = nb.quebrado;
        if (errEl) errEl.style.display = 'none';

        updateEditModalCalculatedTotal();
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
            if (errEl) { errEl.textContent = 'Informe apenas números inteiros positivos.'; errEl.style.display = 'block'; }
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
        ERS.showToast('Estoque e disponibilidades atualizados com sucesso!', 'success');
        if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
    }

    // ─────────────────────────────────────────────────────────────
    //  EXCLUIR MARCA
    // ─────────────────────────────────────────────────────────────
    function handleDeleteBrand(id, marca) {
        if (!confirm(`Deseja remover os notebooks da marca "${marca}" do inventário?`)) {
            return;
        }

        const result = typeof ERS.deleteNotebookBrand === 'function'
            ? ERS.deleteNotebookBrand(id)
            : { ok: false, message: 'Função não disponível' };

        if (result.ok) {
            renderEquipmentView();
            ERS.showToast(`Marca "${marca}" removida do patrimônio.`, 'success');
            if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
        } else {
            ERS.showToast(result.message, 'error');
        }
    }

    // Carregamento da página
    if (!window.isSpaMode) {
        document.addEventListener('DOMContentLoaded', () => {
            const s = window.AUTH ? AUTH.requireAuth(['proatec', 'coordenacao']) : null;
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

// Exporta funções globais chamadas pelo HTML / onclick
window.openEditStatusModal = function(id) {
    window.EquipamentosModule?.openEditStatusModal(id);
};
window.handleDeleteBrand = function(id, marca) {
    window.EquipamentosModule?.handleDeleteBrand(id, marca);
};
