/**
 * agendaProatec.js — Lógica da agenda semanal do PROATEC/Coordenação
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

let currentSession = null;
let currentWeekMonday = ERS.getMonday(new Date());

const ALL_SLOTS = [
    '07:00', '07:50', '08:40', '09:30', '10:20', '11:10',
    '13:00', '13:50', '14:40', '15:30',
    '19:00', '19:50', '20:40',
];

// ─────────────────────────────────────────────────────────────
//  INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentSession = AUTH.requireAuth(['proatec', 'coordenacao']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();
    AUTH.adaptSidebarByRole(currentSession);

    // Mostrar botão de bloqueio apenas para Coordenação
    if (currentSession.role === 'coordenacao') {
        document.querySelectorAll('.coordenacao-only').forEach(el => el.style.display = '');
        document.getElementById('btnOpenBlock').style.display = '';
    }

    // Navegação de semana
    document.getElementById('btnPrevWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        renderSchedule();
    });
    document.getElementById('btnNextWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        renderSchedule();
    });

    // Botões de modal
    document.getElementById('btnOpenNewReservation').addEventListener('click', () => {
        populateRoomSelect('res-room');
        document.getElementById('res-date').value = ERS.today();
        document.getElementById('res-error').style.display = 'none';
        openModal('new-reservation-modal');
    });

    document.getElementById('btnOpenBlock')?.addEventListener('click', () => {
        document.getElementById('blk-date').value = ERS.today();
        document.getElementById('blk-error').style.display = 'none';
        openModal('block-modal');
    });

    // Formulários
    document.getElementById('new-res-form').addEventListener('submit', handleCreateReservation);
    document.getElementById('block-form').addEventListener('submit', handleCreateBlock);

    renderSchedule();
});

// ─────────────────────────────────────────────────────────────
//  GRADE SEMANAL
// ─────────────────────────────────────────────────────────────
function populateRoomSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">Sem sala</option>';
    ERS.getActiveRooms().forEach(r => {
        sel.innerHTML += `<option value="${r.nome}">${r.nome}</option>`;
    });
}

function renderSchedule() {
    const weekDays = ERS.getWeekDays(currentWeekMonday);
    const todayStr = ERS.today();

    const first = weekDays[0];
    const last  = weekDays[4];
    document.getElementById('weekRangeLabel').textContent =
        `${first.getDate()} ${ERS.MESES[first.getMonth()]} - ${last.getDate()} ${ERS.MESES[last.getMonth()]}`;
    document.getElementById('weekLabel').textContent =
        currentWeekMonday.getDate() === ERS.getMonday(new Date()).getDate()
            ? 'Semana Atual'
            : 'Semana Selecionada';

    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // Cabeçalho: coluna de hora + dias
    const timeHeader = document.createElement('div');
    timeHeader.className = 'schedule-header time-col';
    timeHeader.textContent = 'Horário';
    grid.appendChild(timeHeader);

    weekDays.forEach(d => {
        const dk = ERS.dateKey(d);
        const h = document.createElement('div');
        h.className = 'schedule-header' + (dk === todayStr ? ' today-header' : '');
        h.textContent = `${ERS.DIAS_SEMANA[d.getDay()]} - ${d.getDate()}`;
        grid.appendChild(h);
    });

    // Linhas de horário
    ALL_SLOTS.forEach((slotStart, idx) => {
        const slotEnd = ALL_SLOTS[idx + 1]
            || (parseInt(slotStart.split(':')[0]) + 1).toString().padStart(2, '0') + ':00';

        const timeCell = document.createElement('div');
        timeCell.className = 'schedule-time';
        timeCell.textContent = slotStart;
        grid.appendChild(timeCell);

        weekDays.forEach(d => {
            const dk   = ERS.dateKey(d);
            const cell = document.createElement('div');
            cell.className = 'schedule-cell';

            // Bloqueios
            ERS.getBlocks()
                .filter(b => b.data === dk && ERS.timesOverlap(slotStart, slotEnd, b.inicio, b.fim))
                .forEach(b => {
                    const card = document.createElement('div');
                    card.className = 'schedule-card error block-card';
                    card.innerHTML = `<h4>🔒 Bloqueado</h4><p>${b.motivo}</p>`;
                    cell.appendChild(card);
                });

            // Reservas
            ERS.getReservationsByDate(dk)
                .filter(r => ERS.timesOverlap(slotStart, slotEnd, r.inicio, r.fim))
                .forEach(r => {
                    const card = document.createElement('div');
                    card.className = 'schedule-card ' + (r.situacao === 'cancelada' ? 'error' : 'neutral');
                    card.style.cursor = 'pointer';
                    card.innerHTML = `<h4>${r.sala || 'Sem sala'} — ${r.notebooks || 0} notebooks</h4><p>${r.professorNome}</p>`;
                    card.addEventListener('click', () => openDetailModal(r.id));
                    cell.appendChild(card);
                });

            grid.appendChild(cell);
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  MODAL: DETALHES / CANCELAR
// ─────────────────────────────────────────────────────────────
function openDetailModal(id) {
    const r = ERS.getReservations().find(r => r.id === id);
    if (!r) return;

    document.getElementById('modalUsageTitle').textContent    = `${r.sala || 'Sem sala'} — ${r.professorNome}`;
    document.getElementById('modalUsageSubtitle').textContent = `${r.inicio}–${r.fim} • ${r.turma}`;
    document.getElementById('usageDetailBody').innerHTML = `
        <div class="detail-list">
            <div><strong>Data:</strong> ${ERS.formatDate(r.data)}</div>
            <div><strong>Horário:</strong> ${r.inicio} – ${r.fim}</div>
            <div><strong>Turma:</strong> ${r.turma}</div>
            ${r.sala      ? `<div><strong>Sala:</strong> ${r.sala}</div>` : ''}
            ${r.notebooks ? `<div><strong>Notebooks:</strong> ${r.notebooks}</div>` : ''}
            <div><strong>Professor:</strong> ${r.professorNome}</div>
            <div><strong>Situação:</strong>
                <span style="font-weight:600; color:${r.situacao === 'confirmada' ? '#16a34a' : '#dc2626'}">
                    ${r.situacao}
                </span>
            </div>
        </div>
    `;

    const btnCancel = document.getElementById('btn-cancel-detail');
    if (r.situacao === 'confirmada') {
        btnCancel.style.display = '';
        btnCancel.onclick = () => {
            if (!confirm('Cancelar esta reserva?')) return;
            ERS.cancelReservation(r.id);
            closeModal('register-usage-modal');
            ERS.showToast('Reserva cancelada com sucesso.', 'success');
            renderSchedule();
        };
    } else {
        btnCancel.style.display = 'none';
    }

    openModal('register-usage-modal');
}

// ─────────────────────────────────────────────────────────────
//  CRIAR RESERVA
// ─────────────────────────────────────────────────────────────
function handleCreateReservation(e) {
    e.preventDefault();
    const errEl = document.getElementById('res-error');
    errEl.style.display = 'none';

    const data     = document.getElementById('res-date').value;
    const inicio   = document.getElementById('res-start').value;
    const fim      = document.getElementById('res-end').value;
    const sala     = document.getElementById('res-room').value;
    const qtd      = parseInt(document.getElementById('res-qty').value) || 0;
    const turma    = document.getElementById('res-turma').value.trim();
    const profNome = document.getElementById('res-professor').value.trim();

    const result = ERS.createReservation({
        professorId:   currentSession.userId,
        professorNome: profNome || currentSession.nome,
        data, inicio, fim,
        sala: sala || null,
        notebooks: qtd,
        turma,
    });

    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('new-reservation-modal');
    document.getElementById('new-res-form').reset();
    ERS.showToast('Reserva criada com sucesso!', 'success');
    renderSchedule();
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
    ERS.showToast('Bloqueio criado. Novas reservas nesse período serão impedidas.', 'success');
    renderSchedule();
}
