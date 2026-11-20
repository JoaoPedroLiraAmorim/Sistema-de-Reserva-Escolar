document.addEventListener('DOMContentLoaded', () => {

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

function openUsageModal(room, teacher, count) {
    const title = document.getElementById('modalUsageTitle');
    const sub = document.getElementById('modalUsageSubtitle');
    if (title) title.innerText = `${room} — ${teacher}`;
    if (sub) sub.innerText = `Alocação de ${count} aos alunos`;
    openModal('register-usage-modal');
}
