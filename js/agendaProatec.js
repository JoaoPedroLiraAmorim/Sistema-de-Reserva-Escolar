/**
 * agendaProatec.js — Lógica da agenda semanal do PROATEC e Coordenação
 * Espelha a funcionalidade e grade de horários da agenda do professor.
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
    currentSession = AUTH.requireAuth(['proatec', 'coordenacao']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();
    AUTH.adaptSidebarByRole(currentSession);

    // Mostrar botão de bloqueio apenas para Coordenação
    if (currentSession.role === 'coordenacao') {
        document.querySelectorAll('.coordenacao-only').forEach(el => el.style.display = '');
    }

    // Navegação de semana
    document.getElementById('btnPrevWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        renderCalendar();
    });
    document.getElementById('btnNextWeek').addEventListener('click', () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        renderCalendar();
    });

    // Controle de Turnos
    document.querySelectorAll('.shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentShift = btn.dataset.shift;
            renderCalendar();
            populateTimeSlots(currentShift);
        });
    });

    // Configuração dos campos de data com mini-calendário e restrição
    const dateInput = document.getElementById('res-date');
    if (dateInput) {
        dateInput.min = ERS.today();
        const openCalendar = () => {
            try {
                if (typeof dateInput.showPicker === 'function') {
                    dateInput.showPicker();
                }
            } catch (e) {}
        };
        dateInput.addEventListener('click', openCalendar);
        dateInput.addEventListener('focus', openCalendar);
    }

    const blkDateInput = document.getElementById('blk-date');
    if (blkDateInput) {
        blkDateInput.min = ERS.today();
        const openBlkCalendar = () => {
            try {
                if (typeof blkDateInput.showPicker === 'function') {
                    blkDateInput.showPicker();
                }
            } catch (e) {}
        };
        blkDateInput.addEventListener('click', openBlkCalendar);
        blkDateInput.addEventListener('focus', openBlkCalendar);
    }

    // Botão Nova Reserva
    document.getElementById('btnOpenNewReservation').addEventListener('click', () => {
        const dInput = document.getElementById('res-date');
        dInput.min = ERS.today();
        if (!dInput.value || dInput.value < ERS.today()) {
            dInput.value = ERS.today();
        }
        document.getElementById('res-error').style.display = 'none';
        populateTimeSlots(currentShift);
        populateRoomSelect();
        populateBrandSelect();
        updateAvailInfo();
        openModal('new-reservation-modal');
    });

    // Botão Criar Bloqueio
    document.getElementById('btnOpenBlock')?.addEventListener('click', () => {
        const bInput = document.getElementById('blk-date');
        bInput.min = ERS.today();
        if (!bInput.value || bInput.value < ERS.today()) {
            bInput.value = ERS.today();
        }
        document.getElementById('blk-error').style.display = 'none';
        openModal('block-modal');
    });

    // Disponibilidade em tempo real ao mudar campos
    document.getElementById('res-quantity')?.addEventListener('input', updateAvailInfo);
    document.getElementById('res-brand')?.addEventListener('change', updateAvailInfo);
    document.getElementById('res-start')?.addEventListener('change', updateAvailInfo);
    document.getElementById('res-end')?.addEventListener('change', updateAvailInfo);
    document.getElementById('res-date')?.addEventListener('change', updateAvailInfo);

    // Submissão dos Formulários
    document.getElementById('new-reservation-form').addEventListener('submit', handleCreateReservation);
    document.getElementById('block-form').addEventListener('submit', handleCreateBlock);

    populateTimeSlots(currentShift);
    renderCalendar();
});

// ─────────────────────────────────────────────────────────────
//  POPULAR HORÁRIOS POR TURNO
// ─────────────────────────────────────────────────────────────
function populateTimeSlots(shift) {
    const slots = SHIFT_SLOTS[shift] || SHIFT_SLOTS['manha'];
    const selStart = document.getElementById('res-start');
    const selEnd = document.getElementById('res-end');

    if (selStart) {
        const curVal = selStart.value;
        selStart.innerHTML = '<option value="">Selecione o início</option>' +
            slots.map(s => `<option value="${s.start}">${s.start}</option>`).join('');
        if (slots.some(s => s.start === curVal)) {
            selStart.value = curVal;
        }
    }

    if (selEnd) {
        const curVal = selEnd.value;
        selEnd.innerHTML = '<option value="">Selecione o fim</option>' +
            slots.map(s => `<option value="${s.end}">${s.end}</option>`).join('');
        if (slots.some(s => s.end === curVal)) {
            selEnd.value = curVal;
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  POPULAR MARCAS
// ─────────────────────────────────────────────────────────────
function populateBrandSelect() {
    const sel = document.getElementById('res-brand');
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = '<option value="">Qualquer marca</option>';
    if (typeof ERS.getBrands === 'function') {
        ERS.getBrands().forEach(b => {
            sel.innerHTML += `<option value="${b}">${b}</option>`;
        });
    }
    if (curVal) sel.value = curVal;
}

// ─────────────────────────────────────────────────────────────
//  CALENDÁRIO / GRADE DE HORÁRIOS
// ─────────────────────────────────────────────────────────────
function renderCalendar() {
    const weekDays = ERS.getWeekDays(currentWeekMonday);
    const slots = SHIFT_SLOTS[currentShift];

    const first = weekDays[0];
    const last = weekDays[4];
    document.getElementById('weekLabel').textContent =
        `${first.getDate()} ${ERS.MESES[first.getMonth()]} — ${last.getDate()} ${ERS.MESES[last.getMonth()]}`;

    // Cabeçalho dos Dias
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

    // Corpo da Tabela
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

            if (blocks.length > 0) {
                html += `<div class="calendar-events-container">`;
                blocks.forEach(b => {
                    html += `<div class="calendar-event-card event-block" title="${b.motivo}">
                        <span class="event-teacher">🔒 Bloqueado</span>
                        <span class="event-desc">${b.motivo}</span>
                        <span class="event-room"><span class="material-symbols-outlined">block</span> ${b.inicio}–${b.fim}</span>
                    </div>`;
                });
                html += `</div>`;
            }

            if (slotReservations.length > 0) {
                html += `<div class="calendar-events-container">`;
                slotReservations.forEach(r => {
                    const isCancelled = r.situacao === 'cancelada';
                    const colorClass = isCancelled ? 'error' : 'primary';

                    const descParts = [];
                    if (r.notebooks) {
                        const brandText = r.marca && r.marca !== 'Qualquer marca' ? ` (${r.marca})` : '';
                        descParts.push(`${r.notebooks} notebooks${brandText}`);
                    }
                    if (r.sala) {
                        descParts.push(r.sala);
                    }
                    const descText = descParts.join(' • ') || 'Reserva';

                    html += `<div class="calendar-event-card ${colorClass}"
                        data-res-id="${r.id}" onclick="openReservationDetail('${r.id}')">
                        <span class="event-teacher">${r.professorNome}</span>
                        <span class="event-desc">${descText}</span>
                        <span class="event-room">
                            <span class="material-symbols-outlined">${r.sala ? 'meeting_room' : 'laptop'}</span>
                            ${r.sala || (r.marca && r.marca !== 'Qualquer marca' ? r.marca : 'Notebooks')}
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
//  CRIAR RESERVA
// ─────────────────────────────────────────────────────────────
function populateRoomSelect() {
    const sel = document.getElementById('res-room');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sem sala (somente notebooks)</option>';
    ERS.getActiveRooms().forEach(r => {
        sel.innerHTML += `<option value="${r.nome}">${r.nome}</option>`;
    });
}

function updateAvailInfo() {
    const infoEl = document.getElementById('avail-info');
    if (!infoEl) return;
    const brandSel = document.getElementById('res-brand');
    const brand = brandSel ? brandSel.value : '';
    const total = typeof ERS.getDisponivelByBrand === 'function' 
        ? ERS.getDisponivelByBrand(brand) 
        : ERS.getTotalDisponivel();

    if (brand) {
        infoEl.textContent = `${total} notebooks da marca ${brand} disponíveis.`;
    } else {
        infoEl.textContent = `${total} notebooks disponíveis no total.`;
    }
}

function handleCreateReservation(e) {
    e.preventDefault();
    const errEl = document.getElementById('res-error');
    errEl.style.display = 'none';

    const data     = document.getElementById('res-date').value;
    const inicio   = document.getElementById('res-start').value;
    const fim      = document.getElementById('res-end').value;
    const sala     = document.getElementById('res-room').value;
    const marca    = document.getElementById('res-brand') ? document.getElementById('res-brand').value : '';
    const qtd      = parseInt(document.getElementById('res-quantity').value) || 0;
    const profInput = document.getElementById('res-professor');
    const profNome = profInput ? profInput.value.trim() : currentSession.nome;

    // 1. Validação de Data (apenas hoje para frente)
    if (!data) {
        errEl.textContent = 'Por favor, selecione uma data para a reserva.';
        errEl.style.display = 'block';
        return;
    }
    if (data < ERS.today()) {
        errEl.textContent = 'Não é permitido agendar reservas para datas anteriores a hoje.';
        errEl.style.display = 'block';
        return;
    }

    // 2. Validação de Horários
    if (!inicio || !fim) {
        errEl.textContent = 'Por favor, selecione os horários de início e término.';
        errEl.style.display = 'block';
        return;
    }

    // 3. Validação de Horários por Turno
    const currentSlots = SHIFT_SLOTS[currentShift];
    const validStarts = currentSlots.map(s => s.start);
    const validEnds = currentSlots.map(s => s.end);
    const shiftName = currentShift === 'manha' ? 'Manhã' : currentShift === 'tarde' ? 'Tarde' : 'Noite';

    if (!validStarts.includes(inicio) || !validEnds.includes(fim)) {
        errEl.textContent = `Os horários selecionados devem pertencer ao turno da ${shiftName}.`;
        errEl.style.display = 'block';
        return;
    }

    if (inicio >= fim) {
        errEl.textContent = 'O horário de início deve ser anterior ao horário de término.';
        errEl.style.display = 'block';
        return;
    }

    // 4. Validação de Recurso
    if (!sala && qtd <= 0) {
        errEl.textContent = 'Selecione ao menos uma sala ou informe a quantidade de notebooks.';
        errEl.style.display = 'block';
        return;
    }

    const result = ERS.createReservation({
        professorId:   currentSession.userId,
        professorNome: profNome || currentSession.nome,
        data, inicio, fim,
        sala: sala || null,
        marca: marca || 'Qualquer marca',
        notebooks: qtd,
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

    if (!data || data < ERS.today()) {
        errEl.textContent = 'A data do bloqueio não pode ser anterior a hoje.';
        errEl.style.display = 'block';
        return;
    }

    if (!inicio || !fim || inicio >= fim) {
        errEl.textContent = 'O horário de início deve ser anterior ao horário de término.';
        errEl.style.display = 'block';
        return;
    }

    const result = ERS.createBlock({ data, inicio, fim, motivo, criadoPor: currentSession.nome });
    if (!result.ok) {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        return;
    }

    closeModal('block-modal');
    document.getElementById('block-form').reset();
    ERS.showToast('Bloqueio criado. Novas reservas nesse período serão impedidas.', 'success');
    renderCalendar();
}

// ─────────────────────────────────────────────────────────────
//  DETALHES / CANCELAR RESERVA
// ─────────────────────────────────────────────────────────────
function openReservationDetail(id) {
    const r = ERS.getReservations().find(r => r.id === id);
    if (!r) return;

    selectedResId = id;

    document.getElementById('res-detail-body').innerHTML = `
        <div class="detail-list">
            <div><strong>Data:</strong> ${ERS.formatDate(r.data)}</div>
            <div><strong>Horário:</strong> ${r.inicio} – ${r.fim}</div>
            ${r.sala ? `<div><strong>Sala:</strong> ${r.sala}</div>` : ''}
            ${r.notebooks ? `<div><strong>Notebooks:</strong> ${r.notebooks}${r.marca && r.marca !== 'Qualquer marca' ? ' (' + r.marca + ')' : ''}</div>` : ''}
            <div><strong>Professor:</strong> ${r.professorNome}</div>
            <div><strong>Situação:</strong> <span class="badge-situacao badge-${r.situacao}">${r.situacao}</span></div>
        </div>
    `;

    const btnCancel = document.getElementById('btn-cancel-res');
    if (r.situacao === 'confirmada') {
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
    } else {
        ERS.showToast(result.message, 'error');
    }
}
