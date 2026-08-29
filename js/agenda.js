/**
 * Sistema de Reserva Escolar - agenda.js
 * Comportamentos específicos para a tela de Agenda de Reservas (PROATEC)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. Adição dinâmica de linhas de alunos/notebooks no modal
    // ---------------------------------------------------------
    const btnAddNotebookRow = document.getElementById('btnAddNotebookRow');
    const usageRowsContainer = document.getElementById('usageRowsContainer');
    let notebookCount = 3;

    if (btnAddNotebookRow && usageRowsContainer) {
        btnAddNotebookRow.addEventListener('click', () => {
            notebookCount++;
            const row = document.createElement('div');
            row.className = 'usage-row';
            row.innerHTML = `
                <div class="notebook-label-badge">Notebook ${String(notebookCount).padStart(2, '0')}</div>
                <input type="text" class="student-input" placeholder="Digite o nome do aluno">
            `;
            usageRowsContainer.appendChild(row);
        });
    }
});

/**
 * Abre modal de registro de uso preenchendo os dados do agendamento clicado
 * @param {string} room - Nome da sala (ex: 'Sala 12')
 * @param {string} teacher - Nome do professor (ex: 'Prof. Carlos')
 * @param {string} count - Quantidade de equipamentos (ex: '20 notebooks')
 */
function openUsageModal(room, teacher, count) {
    const title = document.getElementById('modalUsageTitle');
    const sub = document.getElementById('modalUsageSubtitle');
    if (title) title.innerText = `${room} — ${teacher}`;
    if (sub) sub.innerText = `Alocação de ${count} aos alunos`;
    openModal('register-usage-modal');
}
