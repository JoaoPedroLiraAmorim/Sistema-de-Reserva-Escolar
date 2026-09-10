/**
 * Sistema de Reserva Escolar — equipamentos.js
 * Módulo de gestão de notebooks escolares agrupados por marca.
 * Dependências: store.js, auth.js, main.js
 */

'use strict';

window.EquipamentosModule = (function () {
    let currentSession = null;
    let isInitialized = false;
    let selectedBrandId = null;

    /**
     * Inicializa o módulo com a sessão ativa
     */
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
    //  LISTENERS E CONFIGURAÇÕES DE INTERAÇÃO
    // ─────────────────────────────────────────────────────────────
    function setupEventListeners() {
        // 1. Botão Cabeçalho: "+ Adicionar equipamentos"
        const btnAdd = document.getElementById('btnAddEquipment');
        if (btnAdd) {
            btnAdd.addEventListener('click', openAddEquipmentModal);
        }

        // 2. Mudança no seletor de marca (Cadastrar nova marca)
        const brandSelect = document.getElementById('add-brand-select');
        if (brandSelect) {
            brandSelect.addEventListener('change', handleBrandSelectChange);
        }

        // 3. Submissão do Formulário de Adicionar Equipamentos
        const addForm = document.getElementById('add-equipment-form');
        if (addForm) {
            addForm.addEventListener('submit', handleAddEquipmentSubmit);
        }

        // 4. Ação no Modal de Detalhes: "Registrar defeito"
        const btnOpenDefect = document.getElementById('btnOpenRegisterDefect');
        if (btnOpenDefect) {
            btnOpenDefect.addEventListener('click', () => {
                if (selectedBrandId) {
                    closeModal('brand-detail-modal');
                    openRegisterDefectModal(selectedBrandId);
                }
            });
        }

        // 5. Input de quantidade com defeito (Cálculo da prévia em tempo real)
        const defectQtyInput = document.getElementById('defect-qty');
        if (defectQtyInput) {
            defectQtyInput.addEventListener('input', updateDefectPreview);
        }

        // 6. Submissão do Formulário de Registrar Defeito
        const defectForm = document.getElementById('register-defect-form');
        if (defectForm) {
            defectForm.addEventListener('submit', handleRegisterDefectSubmit);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDERIZAÇÃO GERAL DA VIEW
    // ─────────────────────────────────────────────────────────────
    function renderEquipmentView() {
        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];

        renderSummaryCards(notebooks);
        renderBrandCards(notebooks);
    }

    /**
     * Renderiza exatamente os 3 cards de resumo solicitados:
     * 1. TOTAL DE EQUIPAMENTOS
     * 2. DISPONÍVEIS
     * 3. COM DEFEITO
     */
    function renderSummaryCards(notebooks) {
        const container = document.getElementById('eq-summary-cards');
        if (!container) return;

        const totalEquipamentos = notebooks.reduce((acc, n) => acc + (n.total || 0), 0);
        const totalDisponiveis  = notebooks.reduce((acc, n) => acc + (n.funcionando || 0), 0);
        const totalDefeito      = notebooks.reduce((acc, n) => acc + (n.defeito || 0), 0);

        container.innerHTML = `
            <div class="eq-kpi-card">
                <div class="eq-kpi-header">
                    <span class="eq-kpi-title">TOTAL DE EQUIPAMENTOS</span>
                    <span class="material-symbols-outlined eq-kpi-icon">inventory_2</span>
                </div>
                <div class="eq-kpi-value">${totalEquipamentos}</div>
            </div>

            <div class="eq-kpi-card available">
                <div class="eq-kpi-header">
                    <span class="eq-kpi-title">DISPONÍVEIS</span>
                    <span class="material-symbols-outlined eq-kpi-icon">check_circle</span>
                </div>
                <div class="eq-kpi-value">${totalDisponiveis}</div>
            </div>

            <div class="eq-kpi-card defect">
                <div class="eq-kpi-header">
                    <span class="eq-kpi-title">COM DEFEITO</span>
                    <span class="material-symbols-outlined eq-kpi-icon">report_problem</span>
                </div>
                <div class="eq-kpi-value">${totalDefeito}</div>
            </div>
        `;
    }

    /**
     * Renderiza os cards das marcas existentes em grade de 3 colunas.
     * Cada card exibe SOMENTE:
     * - nome da marca
     * - quantidade total (ex: "12 notebooks")
     * - quantidade disponível
     * - quantidade com defeito
     * - pequeno ícone/inicial e seta indicando clique
     */
    function renderBrandCards(notebooks) {
        const grid = document.getElementById('eq-brands-grid');
        if (!grid) return;

        if (!notebooks || notebooks.length === 0) {
            grid.innerHTML = `
                <div class="eq-empty-state">
                    <div class="empty-icon-circle">
                        <span class="material-symbols-outlined">laptop</span>
                    </div>
                    <h3>Nenhum equipamento cadastrado</h3>
                    <p>Adicione novos notebooks ao inventário para começar o gerenciamento.</p>
                    <button type="button" class="btn-primary btn-empty-action" onclick="document.getElementById('btnAddEquipment')?.click()">
                        <span class="material-symbols-outlined">add</span>
                        <span>Adicionar equipamentos</span>
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = notebooks.map(nb => {
            const initial = (nb.marca || 'N').trim().charAt(0).toUpperCase();
            const totalLabel = nb.total === 1 ? '1 notebook' : `${nb.total} notebooks`;

            return `
                <div class="eq-brand-card" 
                     role="button" 
                     tabindex="0" 
                     data-brand-id="${nb.id}"
                     title="Clique para ver detalhes de ${nb.marca}"
                     aria-label="Detalhes da marca ${nb.marca}">
                    
                    <div class="eq-brand-top">
                        <div class="brand-identity">
                            <span class="brand-initial-avatar">${initial}</span>
                            <div class="brand-title-wrap">
                                <h3 class="brand-name">${nb.marca.toUpperCase()}</h3>
                                <span class="brand-total-count">${totalLabel}</span>
                            </div>
                        </div>
                        <span class="material-symbols-outlined brand-arrow-icon" aria-hidden="true">arrow_forward</span>
                    </div>

                    <div class="eq-brand-stats-row">
                        <div class="brand-stat-box available">
                            <span class="brand-stat-label">Disponíveis</span>
                            <span class="brand-stat-num">${nb.funcionando}</span>
                        </div>
                        <div class="brand-stat-box defect">
                            <span class="brand-stat-label">Com defeito</span>
                            <span class="brand-stat-num">${nb.defeito}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Conecta o evento de clique e teclado a cada card de marca
        grid.querySelectorAll('.eq-brand-card').forEach(card => {
            const brandId = card.getAttribute('data-brand-id');
            card.addEventListener('click', () => openBrandDetailModal(brandId));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openBrandDetailModal(brandId);
                }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL 1: DETALHES DA MARCA
    // ─────────────────────────────────────────────────────────────
    function openBrandDetailModal(brandId) {
        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];
        const nb = notebooks.find(n => n.id === brandId);
        if (!nb) return;

        selectedBrandId = nb.id;

        const titleEl = document.getElementById('brand-detail-title');
        const badgeEl = document.getElementById('brand-detail-badge');
        const totalEl = document.getElementById('brand-detail-total');
        const availEl = document.getElementById('brand-detail-available');
        const defectEl = document.getElementById('brand-detail-defect');

        if (titleEl) titleEl.textContent = nb.marca;
        if (badgeEl) badgeEl.textContent = (nb.marca || 'N').trim().charAt(0).toUpperCase();
        if (totalEl) totalEl.textContent = nb.total;
        if (availEl) availEl.textContent = nb.funcionando;
        if (defectEl) defectEl.textContent = nb.defeito;

        openModal('brand-detail-modal');
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL 2: ADICIONAR EQUIPAMENTOS
    // ─────────────────────────────────────────────────────────────
    function openAddEquipmentModal() {
        const form = document.getElementById('add-equipment-form');
        if (form) form.reset();

        const errEl = document.getElementById('add-equipment-error');
        if (errEl) {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }

        const newGroup = document.getElementById('new-brand-group');
        const newInput = document.getElementById('add-brand-new');
        if (newGroup) newGroup.classList.add('hidden');
        if (newInput) {
            newInput.required = false;
            newInput.value = '';
        }

        populateBrandOptions();
        openModal('add-equipment-modal');
    }

    function populateBrandOptions() {
        const sel = document.getElementById('add-brand-select');
        if (!sel) return;

        const existingBrands = ERS.getBrands ? ERS.getBrands() : [];
        const defaultBrands = ['Dell', 'Lenovo', 'Acer'];
        const allBrands = Array.from(new Set([...defaultBrands, ...existingBrands])).filter(Boolean);

        sel.innerHTML = `
            <option value="">Selecione uma marca existente...</option>
            ${allBrands.map(b => `<option value="${b}">${b}</option>`).join('')}
            <option value="__new__">+ Cadastrar nova marca</option>
        `;
    }

    function handleBrandSelectChange() {
        const sel = document.getElementById('add-brand-select');
        const newGroup = document.getElementById('new-brand-group');
        const newInput = document.getElementById('add-brand-new');

        if (sel && sel.value === '__new__') {
            if (newGroup) newGroup.classList.remove('hidden');
            if (newInput) {
                newInput.required = true;
                newInput.focus();
            }
        } else {
            if (newGroup) newGroup.classList.add('hidden');
            if (newInput) {
                newInput.required = false;
                newInput.value = '';
            }
        }
    }

    function handleAddEquipmentSubmit(e) {
        e.preventDefault();

        const errEl = document.getElementById('add-equipment-error');
        if (errEl) errEl.style.display = 'none';

        const sel = document.getElementById('add-brand-select');
        const isNew = sel && sel.value === '__new__';
        const brand = isNew
            ? (document.getElementById('add-brand-new')?.value || '').trim()
            : (sel?.value || '').trim();

        if (!brand) {
            showFormError(errEl, isNew ? 'Informe o nome da nova marca.' : 'Selecione uma marca existente ou cadastre uma nova.');
            return;
        }

        const qtyInput = document.getElementById('add-equipment-qty');
        const qty = parseInt(qtyInput?.value, 10);
        if (isNaN(qty) || qty <= 0) {
            showFormError(errEl, 'A quantidade deve ser um número inteiro maior que zero.');
            qtyInput?.focus();
            return;
        }

        // Desabilita botão durante operação para evitar duplo envio
        const btnSubmit = document.getElementById('btnAddEquipmentSubmit');
        if (btnSubmit) btnSubmit.disabled = true;

        try {
            const result = ERS.addNotebooks(brand, qty);
            if (!result.ok) {
                showFormError(errEl, result.message || 'Erro ao adicionar equipamentos.');
                return;
            }

            closeModal('add-equipment-modal');
            document.getElementById('add-equipment-form')?.reset();
            renderEquipmentView();

            ERS.showToast(`${qty} equipamento(s) da marca ${brand} adicionado(s) com sucesso!`, 'success');
            if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL 3: REGISTRAR DEFEITO
    // ─────────────────────────────────────────────────────────────
    function openRegisterDefectModal(brandId) {
        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];
        const nb = notebooks.find(n => n.id === brandId);
        if (!nb) return;

        selectedBrandId = nb.id;

        const form = document.getElementById('register-defect-form');
        if (form) form.reset();

        const idInput = document.getElementById('defect-brand-id');
        const brandNameDisplay = document.getElementById('defect-brand-display');
        const availableDisplay = document.getElementById('defect-available-current');
        const errEl = document.getElementById('register-defect-error');

        if (idInput) idInput.value = nb.id;
        if (brandNameDisplay) brandNameDisplay.textContent = nb.marca;
        if (availableDisplay) availableDisplay.textContent = nb.funcionando;

        if (errEl) {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }

        // Inicializa a prévia
        updateDefectPreview();

        openModal('register-defect-modal');

        const qtyInput = document.getElementById('defect-qty');
        if (qtyInput) {
            qtyInput.max = nb.funcionando;
            qtyInput.focus();
        }
    }

    /**
     * Atualiza a prévia em tempo real:
     * Disponíveis após alteração: X - qtd
     * Com defeito após alteração: Y + qtd
     */
    function updateDefectPreview() {
        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];
        const nb = notebooks.find(n => n.id === selectedBrandId);
        const previewDisp = document.getElementById('preview-disponiveis');
        const previewDef = document.getElementById('preview-defeito');
        const errEl = document.getElementById('register-defect-error');
        const qtyVal = document.getElementById('defect-qty')?.value.trim();

        if (!nb) return;

        if (!qtyVal) {
            if (previewDisp) previewDisp.textContent = '—';
            if (previewDef) previewDef.textContent = '—';
            if (errEl) errEl.style.display = 'none';
            return;
        }

        const qtd = parseInt(qtyVal, 10);

        if (isNaN(qtd) || qtd <= 0) {
            if (previewDisp) previewDisp.textContent = '—';
            if (previewDef) previewDef.textContent = '—';
            showFormError(errEl, 'A quantidade com defeito deve ser maior que zero.');
            return;
        }

        if (qtd > nb.funcionando) {
            const newDisp = Math.max(0, nb.funcionando - qtd);
            const newDef = nb.defeito + qtd;
            if (previewDisp) previewDisp.textContent = newDisp;
            if (previewDef) previewDef.textContent = newDef;
            showFormError(errEl, `A quantidade informada (${qtd}) excede os equipamentos disponíveis (${nb.funcionando}).`);
            return;
        }

        // Válido
        if (errEl) errEl.style.display = 'none';
        const newDisp = nb.funcionando - qtd;
        const newDef = nb.defeito + qtd;
        if (previewDisp) previewDisp.textContent = newDisp;
        if (previewDef) previewDef.textContent = newDef;
    }

    function handleRegisterDefectSubmit(e) {
        e.preventDefault();

        const errEl = document.getElementById('register-defect-error');
        if (errEl) errEl.style.display = 'none';

        const notebooks = ERS.getNotebooks ? ERS.getNotebooks() : [];
        const nb = notebooks.find(n => n.id === selectedBrandId);
        if (!nb) {
            showFormError(errEl, 'Marca não identificada.');
            return;
        }

        const qtyInput = document.getElementById('defect-qty');
        const qtd = parseInt(qtyInput?.value, 10);

        if (isNaN(qtd) || qtd <= 0) {
            showFormError(errEl, 'A quantidade deve ser um número inteiro maior que zero.');
            qtyInput?.focus();
            return;
        }

        if (qtd > nb.funcionando) {
            showFormError(errEl, `A quantidade informada (${qtd}) excede os equipamentos disponíveis (${nb.funcionando}).`);
            qtyInput?.focus();
            return;
        }

        const btnConfirm = document.getElementById('btnConfirmDefect');
        if (btnConfirm) btnConfirm.disabled = true;

        try {
            const result = ERS.registerNotebookDefect(nb.id, qtd);
            if (!result.ok) {
                showFormError(errEl, result.message || 'Erro ao registrar defeito.');
                return;
            }

            closeModal('register-defect-modal');
            document.getElementById('register-defect-form')?.reset();
            renderEquipmentView();

            ERS.showToast(`Defeito de ${qtd} notebook(s) ${nb.marca} registrado com sucesso!`, 'success');
            if (window.ProatecModule?.renderBrandGrid) window.ProatecModule.renderBrandGrid();
        } finally {
            if (btnConfirm) btnConfirm.disabled = false;
        }
    }

    function showFormError(element, message) {
        if (!element) return;
        element.textContent = message;
        element.style.display = 'block';
    }

    // ─────────────────────────────────────────────────────────────
    //  INICIALIZAÇÃO AUTOMÁTICA DA PÁGINA
    // ─────────────────────────────────────────────────────────────
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
        openBrandDetailModal,
        openAddEquipmentModal,
        openRegisterDefectModal
    };
})();
