/**
 * Sistema de Reserva Escolar - professor.js
 * Comportamentos específicos para o Portal do Professor
 */

const TOTAL_RESERVED_NOTEBOOKS = 20;

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. Alternância dos botões de turno (Manhã / Tarde / Noite)
    // ---------------------------------------------------------
    const shiftButtons = document.querySelectorAll('.shift-btn');
    shiftButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            shiftButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ---------------------------------------------------------
    // 2. Inicialização do Modal de Registro de Uso
    // ---------------------------------------------------------
    initRegistrationRows();
});

/**
 * Inicializa linhas padrão no modal de registro (completamente manuais e vazias)
 */
function initRegistrationRows() {
    const list = document.getElementById('reg-rows-list');
    if (!list) return;

    list.innerHTML = '';

    // Inicializa com 5 linhas vazias para preenchimento manual imediato
    for (let i = 0; i < 5; i++) {
        addRegistrationRow();
    }

    updateRegistrationCounter();
}

/**
 * Adiciona uma nova linha de registro (Etiqueta manual + Aluno manual)
 * @param {string} tag 
 * @param {string} student 
 */
function addRegistrationRow(tag = '', student = '') {
    const list = document.getElementById('reg-rows-list');
    if (!list) return;

    const currentRows = list.querySelectorAll('.reg-row');

    const row = document.createElement('div');
    row.className = 'reg-row';
    row.innerHTML = `
        <input 
            type="text" 
            class="reg-tag-input" 
            placeholder="Ex: 12, 45, NT-03" 
            value="${tag}"
            oninput="updateRegistrationCounter()"
            aria-label="Nº da etiqueta do notebook"
        >
        <input 
            type="text" 
            class="reg-student-input" 
            placeholder="Nome do aluno" 
            value="${student}"
            oninput="updateRegistrationCounter()"
            aria-label="Nome do aluno"
        >
        <button 
            type="button" 
            class="btn-remove-row" 
            onclick="removeRegistrationRow(this)" 
            title="Remover linha"
            aria-label="Remover linha"
        >
            <span class="material-symbols-outlined">delete_outline</span>
        </button>
    `;

    list.appendChild(row);
    updateRegistrationCounter();

    // Foca no primeiro input da linha recém adicionada se for inserção manual pelo botão
    if (!tag && !student && currentRows.length > 0) {
        const firstInput = row.querySelector('.reg-tag-input');
        if (firstInput) firstInput.focus();
    }
}

/**
 * Remove uma linha de registro
 * @param {HTMLElement} btn 
 */
function removeRegistrationRow(btn) {
    const row = btn.closest('.reg-row');
    if (!row) return;

    const list = document.getElementById('reg-rows-list');
    const totalRows = list ? list.querySelectorAll('.reg-row').length : 0;

    // Garante que fique pelo menos 1 linha vazia
    if (totalRows <= 1) {
        const tagInput = row.querySelector('.reg-tag-input');
        const studentInput = row.querySelector('.reg-student-input');
        if (tagInput) tagInput.value = '';
        if (studentInput) studentInput.value = '';
        updateRegistrationCounter();
        return;
    }

    row.remove();
    updateRegistrationCounter();
}

/**
 * Atualiza o contador de notebooks preenchidos
 */
function updateRegistrationCounter() {
    const list = document.getElementById('reg-rows-list');
    const countEl = document.getElementById('reg-count');
    const totalEl = document.getElementById('reg-total');
    const badgeEl = document.querySelector('.reg-counter-badge');

    if (!list || !countEl || !totalEl) return;

    const rows = list.querySelectorAll('.reg-row');
    let filledCount = 0;

    rows.forEach(row => {
        const tagVal = row.querySelector('.reg-tag-input')?.value.trim();
        const studentVal = row.querySelector('.reg-student-input')?.value.trim();
        if (tagVal || studentVal) {
            filledCount++;
        }
    });

    countEl.textContent = filledCount;
    totalEl.textContent = TOTAL_RESERVED_NOTEBOOKS;

    if (badgeEl) {
        if (filledCount >= TOTAL_RESERVED_NOTEBOOKS) {
            badgeEl.classList.add('completed');
        } else {
            badgeEl.classList.remove('completed');
        }
    }
}

/**
 * Processa a confirmação do registro de uso
 * @param {Event} e 
 */
function submitUsageRegistration(e) {
    e.preventDefault();

    const list = document.getElementById('reg-rows-list');
    if (!list) return;

    const rows = list.querySelectorAll('.reg-row');
    const registeredItems = [];

    rows.forEach(row => {
        const tag = row.querySelector('.reg-tag-input')?.value.trim();
        const student = row.querySelector('.reg-student-input')?.value.trim();
        if (tag || student) {
            registeredItems.push({ tag, student });
        }
    });

    if (registeredItems.length === 0) {
        showToast('Informe ao menos um notebook com etiqueta ou nome de aluno.', 'warning');
        return;
    }

    // Fecha o modal
    closeModal('register-usage-modal');

    // Atualiza o chip no cabeçalho para indicar que foi registrado
    const chipText = document.querySelector('.active-res-chip .chip-text');
    const chipLabel = document.querySelector('.active-res-chip .chip-label');
    const chipBtn = document.getElementById('btnOpenRegisterModal');

    if (chipLabel) {
        chipLabel.textContent = `Uso registrado (${registeredItems.length}/${TOTAL_RESERVED_NOTEBOOKS})`;
    }
    if (chipText) {
        chipText.textContent = `Sala 12 • ${registeredItems.length} notebooks em uso`;
    }
    if (chipBtn) {
        chipBtn.innerHTML = `
            <span class="material-symbols-outlined">edit</span>
            <span>Editar uso</span>
        `;
    }

    // Feedback visual para o usuário
    showToast(`Sucesso! ${registeredItems.length} notebook(s) registrado(s) para a aula atual.`, 'success');
}

/**
 * Exibe notificação toast flutuante
 * @param {string} message 
 * @param {string} type - 'success' | 'warning' | 'error'
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    const iconName = type === 'success' ? 'check_circle' : (type === 'warning' ? 'warning' : 'info');
    toast.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 20px;">${iconName}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}
