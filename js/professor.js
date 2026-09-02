/**
 * professor.js — Lógica da página do Professor
 * Depende de: store.js, auth.js, main.js
 */

'use strict';

let currentSession = null;
let currentWeekMonday = ERS.getMonday(new Date());
let currentShift = 'manha';
let selectedResId = null;

const SHIFT_SLOTS = {
    manha: [
        { start: '07:00', end: '07:50' },
        { start: '07:50', end: '08:40' },
        { start: '08:40', end: '09:30' },
        { start: '09:30', end: '10:20' },
        { start: '10:35', end: '11:25' },
        { start: '11:25', end: '12:15' },
    ],
    tarde: [
        { start: '13:00', end: '13:50' },
        { start: '13:50', end: '14:40' },
        { start: '14:40', end: '15:30' },
        { start: '15:30', end: '16:20' },
    ],
    noite: [
        { start: '19:00', end: '19:50' },
        { start: '19:50', end: '20:40' },
        { start: '20:40', end: '21:30' },
    ],
};

// ─────────────────────────────────────────────────────────────
//  INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentSession = AUTH.requireAuth(['professor']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();

    // Navegação de semana
    document.getElementById('btnPrevWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        renderCalendar();
    });
    document.getElementById('btnNextWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        renderCalendar();
    });

    // Turno
    document.querySelectorAll('.shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentShift = btn.dataset.shift;
            renderCalendar();
        });
    });

    // Nova reserva
    document.getElementById('btnOpenNewReservation').addEventListener('click', () => {
        document.getElementById('res-date').value = ERS.today();
        document.getElementById('res-error').style.display = 'none';
        updateAvailInfo();
        populateRoomSelect();
        openModal('new-reservation-modal');
    });

    // Mobile nav buttons
    document.getElementById('mobileNewResBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('btnOpenNewReservation').click();
    });

    document.getElementById('mobileMyResBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('my-reservations-section')?.scrollIntoView({ behavior: 'smooth' });
    });


    // Disponibilidade ao mudar campos
    document.getElementById('res-quantity').addEventListener('input', updateAvailInfo);
    document.getElementById('res-start').addEventListener('change', updateAvailInfo);
    document.getElementById('res-end').addEventListener('change', updateAvailInfo);
    document.getElementById('res-date').addEventListener('change', updateAvailInfo);

    // Submit do formulário
    document.getElementById('new-reservation-form').addEventListener('submit', handleCreateReservation);

    renderCalendar();
    renderMyReservations();
    renderActiveChip();
});

// ─────────────────────────────────────────────────────────────
//  CALENDÁRIO
// ─────────────────────────────────────────────────────────────
function renderCalendar() {
    const weekDays = ERS.getWeekDays(currentWeekMonday);
    const slots = SHIFT_SLOTS[currentShift];

    const first = weekDays[0];
    const last = weekDays[4];
    document.getElementById('weekLabel').textContent =
        `${first.getDate()} ${ERS.MESES[first.getMonth()]} — ${last.getDate()} ${ERS.MESES[last.getMonth()]}`;

    // Cabeçalho
    const thead = document.getElementById('calendarHead');
    const todayStr = ERS.today();
    thead.innerHTML = `<tr>
        <th class="time-col-header"><span class="material-symbols-outlined">schedule</span></th>
        ${weekDays.map(d => {
            const dk = ERS.dateKey(d);
            const isToday = dk === todayStr;
            return `<th${isToday ? ' class="today-col"' : ''}>
                <div class="day-header-tag">${ERS.DIAS_SEMANA_FULL[d.getDay()]}</div>
                <div class="day-header-number">${d.getDate()}</div>
            </th>`;
        }).join('')}
    </tr>`;

    // Corpo
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

    slots.forEach(slot => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-col-cell">
            <span class="time-start">${slot.start}</span>
            <span class="time-end">${slot.end}</span>
        </td>`;

        weekDays.forEach(d => {
            const dk = ERS.dateKey(d);
            const isToday = dk === todayStr;
            const td = document.createElement('td');
            if (isToday) td.className = 'today-cell';

            const dayReservations = ERS.getReservationsByDate(dk);
            const slotReservations = dayReservations.filter(r =>
                ERS.timesOverlap(slot.start, slot.end, r.inicio, r.fim)
            );

            const blocks = ERS.getBlocks().filter(b =>
                b.data === dk && ERS.timesOverlap(slot.start, slot.end, b.inicio, b.fim)
            );

            let html = '';

            blocks.forEach(b => {
                html += `<div class="calendar-events-container">
                    <div class="calendar-event-card event-block" title="${b.motivo}">
                        <span class="event-teacher">🔒 Bloqueado</span>
                        <span class="event-desc">${b.motivo}</span>
                        <span class="event-room"><span class="material-symbols-outlined">block</span> ${b.inicio}–${b.fim}</span>
                    </div>
                </div>`;
            });

            if (slotReservations.length > 0) {
                html += `<div class="calendar-events-container">`;
                slotReservations.forEach(r => {
                    const isMine = r.professorId === currentSession.userId;
                    const colorClass = isMine ? 'primary' : 'tertiary';
                    html += `<div class="calendar-event-card ${colorClass}${isMine ? ' event-mine' : ''}"
                        data-res-id="${r.id}" onclick="openReservationDetail('${r.id}')">
                        ${isMine ? '<span class="event-mine-label">Minha</span>' : ''}
                        <span class="event-teacher">${r.professorNome}</span>
                        <span class="event-desc">${r.notebooks ? r.notebooks + ' notebooks' : ''}${r.notebooks && r.sala ? ', ' : ''}${r.sala || ''}</span>
                        <span class="event-room">
                            <span class="material-symbols-outlined">group</span>
                            ${r.turma}
                        </span>
                    </div>`;
                });
                html += `</div>`;
            }

            td.innerHTML = html;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// ─────────────────────────────────────────────────────────────
//  MINHAS RESERVAS
// ─────────────────────────────────────────────────────────────
function renderMyReservations() {
    const list = document.getElementById('myResList');
    if (!list || !currentSession) return;

    const myRes = ERS.getReservationsByUser(currentSession.userId)
        .sort((a, b) => a.data.localeCompare(b.data));

    if (myRes.length === 0) {
        list.innerHTML = `<p class="empty-msg">Você ainda não tem reservas.</p>`;
        return;
    }

    list.innerHTML = myRes.map(r => `
        <div class="my-res-item">
            <div class="res-date">${ERS.formatDate(r.data)}</div>
            <div class="res-info">
                <strong>${r.inicio}–${r.fim} • ${r.turma}</strong>
                <p>${[r.sala, r.notebooks ? r.notebooks + ' notebooks' : ''].filter(Boolean).join(' • ')}</p>
            </div>
            <div class="res-actions">
                <span class="badge-situacao badge-${r.situacao}">${r.situacao === 'confirmada' ? 'Confirmada' : 'Cancelada'}</span>
                ${r.situacao === 'confirmada' ? `<button class="btn-res-cancel" onclick="cancelRes('${r.id}')">Cancelar</button>` : ''}
            </div>
        </div>
    `).join('');
}

function renderActiveChip() {
    if (!currentSession) return;
    const chip = document.getElementById('active-chip');
    const todayRes = ERS.getReservationsByDate(ERS.today())
        .filter(r => r.professorId === currentSession.userId && r.situacao === 'confirmada');

    if (todayRes.length > 0) {
        const r = todayRes[0];
        chip.classList.remove('hidden');
        document.getElementById('active-chip-text').textContent =
            `${r.inicio}–${r.fim} ${r.sala ? '• ' + r.sala : ''} ${r.turma ? '• ' + r.turma : ''}`;
    } else {
        chip.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────────────────────
//  CRIAR RESERVA
// ─────────────────────────────────────────────────────────────
function populateRoomSelect() {
    const sel = document.getElementById('res-room');
    sel.innerHTML = '<option value="">Sem sala (somente notebooks)</option>';
    ERS.getActiveRooms().forEach(r => {
        sel.innerHTML += `<option value="${r.nome}">${r.nome}</option>`;
    });
}

function updateAvailInfo() {
    const infoEl = document.getElementById('avail-info');
    const total = ERS.getTotalDisponivel();
    infoEl.textContent = `${total} notebooks disponíveis no total.`;
}

function handleCreateReservation(e) {
    e.preventDefault();
    const errEl = document.getElementById('res-error');
    errEl.style.display = 'none';

    const data   = document.getElementById('res-date').value;
    const inicio = document.getElementById('res-start').value;
    const fim    = document.getElementById('res-end').value;
    const sala   = document.getElementById('res-room').value;
    const qtd    = parseInt(document.getElementById('res-quantity').value) || 0;
    const turma  = document.getElementById('res-turma').value.trim();

    const result = ERS.createReservation({
        professorId:   currentSession.userId,
        professorNome: currentSession.nome,
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
    document.getElementById('new-reservation-form').reset();
    ERS.showToast('Reserva criada com sucesso!', 'success');
    renderCalendar();
    renderMyReservations();
    renderActiveChip();
}

// ─────────────────────────────────────────────────────────────
//  DETALHES / CANCELAR
// ─────────────────────────────────────────────────────────────
function openReservationDetail(id) {
    const r = ERS.getReservations().find(r => r.id === id);
    if (!r) return;

    selectedResId = id;
    const isMine = r.professorId === currentSession.userId;

    document.getElementById('res-detail-body').innerHTML = `
        <div class="detail-list">
            <div><strong>Data:</strong> ${ERS.formatDate(r.data)}</div>
            <div><strong>Horário:</strong> ${r.inicio} – ${r.fim}</div>
            <div><strong>Turma:</strong> ${r.turma}</div>
            ${r.sala ? `<div><strong>Sala:</strong> ${r.sala}</div>` : ''}
            ${r.notebooks ? `<div><strong>Notebooks:</strong> ${r.notebooks}</div>` : ''}
            <div><strong>Professor:</strong> ${r.professorNome}</div>
            <div><strong>Situação:</strong> <span class="badge-situacao badge-${r.situacao}">${r.situacao}</span></div>
        </div>
    `;

    const btnCancel = document.getElementById('btn-cancel-res');
    if (isMine && r.situacao === 'confirmada') {
        btnCancel.style.display = '';
        btnCancel.onclick = () => cancelRes(id);
    } else {
        btnCancel.style.display = 'none';
    }

    openModal('res-detail-modal');
}

function cancelRes(id) {
    if (!confirm('Tem certeza que deseja cancelar esta reserva? Os recursos ficarão disponíveis novamente.')) return;
    const result = ERS.cancelReservation(id);
    if (result.ok) {
        closeModal('res-detail-modal');
        ERS.showToast('Reserva cancelada. Recursos liberados.', 'success');
        renderCalendar();
        renderMyReservations();
        renderActiveChip();
    } else {
        ERS.showToast(result.message, 'error');
    }
}
