'use strict';

let currentSession = null;
let currentWeekMonday = ERS.getMonday(new Date());
let currentShift = 'manha';

const SHIFT_SLOTS = ERS.SHIFT_SLOTS;
const bookingDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
});

document.addEventListener('ers:ready', () => {
    currentSession = AUTH.requireAuth(['professor']);
    if (!currentSession) return;

    AUTH.renderUserInfo(currentSession);
    AUTH.setupLogout();

    document.getElementById('btnPrevWeek').addEventListener('click', () => {
        showTeacherCalendarWeek(ERS.dayOffset(-7, currentWeekMonday));
    });
    document.getElementById('btnNextWeek').addEventListener('click', () => {
        showTeacherCalendarWeek(ERS.dayOffset(7, currentWeekMonday));
    });

    document.querySelectorAll('.shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shift-btn').forEach(button => {
                button.classList.toggle('active', button === btn);
                button.setAttribute('aria-pressed', button === btn);
            });
            currentShift = btn.dataset.shift;
            renderCalendar();
        });
    });

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

    }

    document.getElementById('btnOpenNewReservation').addEventListener('click', () => openTeacherReservationForm());

    document.getElementById('new-reservation-form').addEventListener('submit', handleSaveReservation);
    document.getElementById('calendarBody').addEventListener('click', event => {
        const card = event.target.closest('button[data-res-id]');
        if (card) openReservationDetail(card.dataset.resId);
    });
    document.getElementById('myResList').addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button?.dataset.resId) openReservationDetail(button.dataset.resId);
        if (button?.dataset.cancelId) cancelRes(button.dataset.cancelId);
        if (button?.id === 'empty-new-reservation') openTeacherReservationForm();
    });

    document.getElementById('btnAddStudentRow')?.addEventListener('click', () => addStudentRow());
    document.getElementById('register-students-form')?.addEventListener('submit', handleSaveStudentRegistration);

    window.addEventListener('storage', (e) => {
        if (e.key === 'ers_reservations') {
            renderActiveChip();
            renderCalendar();
            renderMyReservations();
        }
    });

    renderCalendar();
    renderMyReservations();
    renderActiveChip();

    setInterval(() => {
        if (!document.hidden) {
            renderMyReservations();
            renderActiveChip();
            renderCalendar();
        }
    }, 60000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { renderMyReservations(); renderActiveChip(); renderCalendar(); }
    });
});

function reservationShift(start) {
    if (start >= '19:00') return 'noite';
    return start >= '13:00' ? 'tarde' : 'manha';
}

function populateTimeSlots(shift, booking) {
    const form = document.getElementById('new-reservation-form');
    form.dataset.shift = shift;
    const slots = SHIFT_SLOTS[shift];
    const previous = booking || ERS.getReservations().find(r => r.id === form.dataset.reservationId);

    for (const [id, key, found, title] of [
        ['res-start', 'start', previous?.inicio, 'Selecione o início'],
        ['res-end', 'end', previous?.fim, 'Selecione o fim']
    ]) {
        const field = document.getElementById(id);
        const value = booking ? found : field.value;
        const times = slots.map(slot => slot[key]);
        if (found && shift === reservationShift(previous.inicio) && !times.includes(found)) times.push(found);
        field.replaceChildren(new Option(title, ''), ...times.sort().map(time => new Option(time, time)));
        if (times.includes(value)) field.value = value;
    }
}

function populateBrandSelect() {
    const sel = document.getElementById('res-brand');
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = '<option value="">Qualquer marca</option>';
    if (typeof ERS.getBrands === 'function') {
        sel.append(...ERS.getBrands().map(brand => new Option(brand, brand)));
    }
    if (curVal) sel.value = curVal;
}

function showTeacherCalendarWeek(date) {
    const monday = ERS.getMonday(date);
    if (ERS.dateKey(monday) === ERS.dateKey(currentWeekMonday)) return;
    currentWeekMonday = monday;
    renderCalendar();
}

function renderCalendar() {
    const weekDays = ERS.getWeekDays(currentWeekMonday);
    const slots = SHIFT_SLOTS[currentShift];

    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    document.getElementById('weekLabel').textContent =
        `${first.getDate()} ${ERS.MESES[first.getMonth()]} — ${last.getDate()} ${ERS.MESES[last.getMonth()]}`;

    const thead = document.getElementById('calendarHead');
    const todayStr = ERS.today();
    thead.innerHTML = `<tr>
        <th class="time-col-header" scope="col" aria-label="Horário"><span class="material-symbols-outlined">schedule</span></th>
        ${weekDays.map(d => {
            const dk = ERS.dateKey(d);
            const isToday = dk === todayStr;
            return `<th scope="col" data-date="${dk}"${isToday ? ' class="today-col"' : ''}>
                <div class="day-header-tag">${ERS.DIAS_SEMANA_FULL[d.getDay()]}</div>
                <div class="day-header-number">${d.getDate()}</div>
                <span class="day-header-resources">Reservas e disponibilidade</span>
            </th>`;
        }).join('')}
    </tr>`;

    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

    slots.forEach(slot => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<th class="time-col-cell" scope="row">
            <span class="time-start">${slot.start}</span>
            <span class="time-end">${slot.end}</span>
        </th>`;

        weekDays.forEach(d => {
            const dk = ERS.dateKey(d);
            const isToday = dk === todayStr;
            const td = document.createElement('td');
            if (isToday) td.className = 'today-cell';
            td.dataset.date = dk; td.dataset.start = slot.start; td.dataset.end = slot.end;

            const dayReservations = ERS.getReservationsByDate(dk);
            const slotReservations = dayReservations.filter(r =>
                ERS.timesOverlap(slot.start, slot.end, r.inicio, r.fim)
            );

            const blocks = ERS.getBlocksByDate(dk).filter(b => ERS.timesOverlap(slot.start, slot.end, b.inicio, b.fim));

            let html = '';

            if (blocks.length > 0 || slotReservations.length > 0) {
                html += `<div class="calendar-events-container">`;
                blocks.forEach(b => {
                    html += `<div class="calendar-event-card event-block">
                        <span class="event-teacher">Bloqueado pela coordenação</span>
                        <span class="event-desc">${ERS.escapeHtml(b.motivo)}</span>
                        <span class="event-room"><span class="material-symbols-outlined">block</span> ${b.inicio}–${b.fim}</span>
                    </div>`;
                });
                (blocks.length ? [] : slotReservations).forEach(r => {
                    const isMine = r.professorId === currentSession.userId;
                    const colorClass = isMine ? 'primary event-mine' : 'tertiary';
                    const notebooks = r.notebooks ? `${r.notebooks} notebooks${r.marca && r.marca !== 'Qualquer marca' ? ' · ' + r.marca : ''}` : 'Somente sala';

                    html += `<button type="button" class="calendar-event-card ${colorClass}" data-res-id="${ERS.escapeHtml(r.id)}" aria-haspopup="dialog">
                        <span class="v2-event-time">${r.inicio}–${r.fim}</span>
                        <span class="event-owner-label">${isMine ? 'Sua' : 'Outra'}</span>
                        <span class="event-teacher">${ERS.escapeHtml(r.professorNome)}</span>
                        <span class="event-desc">${ERS.escapeHtml(notebooks)}</span>
                        ${r.sala ? `<span class="event-room"><span class="material-symbols-outlined">meeting_room</span> ${ERS.escapeHtml(r.sala)}</span>` : ''}
                    </button>`;
                });
                html += `</div>`;
            }

            td.innerHTML = html;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function renderMyReservations() {
    const list = document.getElementById('myResList');
    if (!list || !currentSession) return;

    const myRes = ERS.getReservationsByUser(currentSession.userId)
        .filter(r => r.situacao !== 'cancelada' &&
            (r.data > ERS.today() || (r.data === ERS.today() && r.fim > ERS.getCurrentTime())))
        .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));

    const count = document.getElementById('upcoming-count');
    if (count) count.textContent = myRes.length;

    if (myRes.length === 0) {
        list.innerHTML = `<div class="reservation-empty"><span class="material-symbols-outlined">calendar_today</span><p>Você ainda não tem próximas reservas.</p><button type="button" class="btn-primary" id="empty-new-reservation">Nova reserva</button></div>`;
        return;
    }

    list.innerHTML = myRes.map(r => {
        const blocked = ERS.isReservationBlocked(r);
        const nbText = r.notebooks ? `${r.notebooks} notebooks${r.marca && r.marca !== 'Qualquer marca' ? ' · ' + r.marca : ''}` : '';
        const infoDetail = [r.sala, nbText, r.turma].filter(Boolean).join(' • ');
        const id = ERS.escapeHtml(r.id);
        return `
        <article class="my-res-item${blocked ? ' reservation-blocked' : ''}">
            <div class="res-info">
                <time class="res-date" datetime="${r.data}">${bookingDate.format(new Date(r.data + 'T12:00:00Z'))}</time>
                <strong>${r.inicio}–${r.fim}</strong>
                <p>${ERS.escapeHtml(infoDetail) || 'Reserva de recursos'}</p>
            </div>
            <div class="res-actions">
                <span class="badge-situacao ${blocked ? 'badge-blocked' : 'badge-confirmada'}">${blocked ? 'Indisponível por bloqueio' : 'Confirmada'}</span>
                <button type="button" class="btn-secondary" data-res-id="${id}" aria-haspopup="dialog">Ver reserva</button>
                ${r.situacao === 'confirmada' ? `<button type="button" class="btn-res-cancel" data-cancel-id="${id}">Cancelar</button>` : ''}
            </div>
        </article>
    `;
    }).join('');
}

let currentRegResId = null;

function renderActiveChip() {
    currentSession = ERS.getSession() || currentSession;
    if (!currentSession) return;
    const chip = document.getElementById('active-chip');
    if (!chip) return;

    const todayNotebookRes = ERS.getReservationsByDate(ERS.today())
        .filter(r => r.professorId === currentSession.userId && r.situacao === 'confirmada' && r.fim > ERS.getCurrentTime() && (r.notebooks > 0) &&
            !ERS.isReservationBlocked(r))
        .sort((a, b) => Number(b.retiradaConfirmada) - Number(a.retiradaConfirmada) || a.inicio.localeCompare(b.inicio));

    const statusLabel = document.getElementById('active-chip-status');
    const textLabel = document.getElementById('active-chip-text');
    const btnRegister = document.getElementById('btnRegisterNotebooks');
    const btnRegisterText = document.getElementById('btnRegisterNotebooksText');

    if (todayNotebookRes.length > 0) {
        const r = todayNotebookRes[0];
        chip.classList.remove('hidden');
        if (textLabel) {
            textLabel.textContent = `${r.inicio}–${r.fim} ${r.sala ? '• ' + r.sala : ''} • ${r.notebooks} notebooks`;
        }

        if (r.retiradaConfirmada) {
            chip.classList.add('chip-ready');
            if (statusLabel) {
                statusLabel.textContent = r.alunosRegistrados ? 'Notebooks entregues • Alunos registrados' : 'Notebooks entregues pela Coordenação';
            }
            if (btnRegister) {
                btnRegister.style.display = 'inline-flex';
                if (btnRegisterText) {
                    btnRegisterText.textContent = r.alunosRegistrados ? 'Editar registro da aula' : 'Registrar aula';
                }
                btnRegister.onclick = () => openRegisterStudentsModal(r.id);
            }
        } else {
            chip.classList.remove('chip-ready');
            if (statusLabel) {
                statusLabel.textContent = 'Aguardando confirmação da coordenação';
            }
            if (btnRegister) {
                btnRegister.style.display = 'none';
            }
        }
    } else {

        const todayRoomOnly = ERS.getReservationsByDate(ERS.today())
            .filter(r => r.professorId === currentSession.userId && r.situacao === 'confirmada' && r.fim > ERS.getCurrentTime() &&
                !ERS.isReservationBlocked(r));

        if (todayRoomOnly.length > 0) {
            const r = todayRoomOnly[0];
            chip.classList.remove('hidden');
            chip.classList.remove('chip-ready');
            if (textLabel) textLabel.textContent = `${r.inicio}–${r.fim} • ${r.sala}`;
            if (statusLabel) statusLabel.textContent = 'Reserva hoje';
            if (btnRegister) btnRegister.style.display = 'none';
        } else {
            chip.classList.add('hidden');
            if (btnRegister) btnRegister.style.display = 'none';
        }
    }
}

function openRegisterStudentsModal(resId) {
    const r = ERS.getReservations().find(x => x.id === resId);
    if (!r) return;

    currentRegResId = resId;
    document.getElementById('register-students-modal').dataset.reservaId = resId;
    document.getElementById('reg-class').value = r.turma || '';

    document.getElementById('reg-summary-date').textContent = bookingDate.format(new Date(r.data + 'T12:00:00Z'));
    document.getElementById('reg-summary-time').textContent = `${r.inicio} – ${r.fim}`;
    document.getElementById('reg-summary-notebooks').textContent = `${r.notebooks} notebook(s)`;
    document.getElementById('reg-summary-room').textContent = r.sala || 'Sem sala fixa';

    const tbody = document.getElementById('student-rows-body');
    tbody.innerHTML = '';

    const existingAssignments = r.alunosNotebooks || [];
    const countToGenerate = existingAssignments.length > 0 ? existingAssignments.length : (r.notebooks || 1);

    for (let i = 0; i < countToGenerate; i++) {
        const item = existingAssignments[i] || { etiqueta: '', aluno: '' };
        addStudentRow(i + 1, item.etiqueta, item.aluno);
    }

    updateRegCounter();
    const errEl = document.getElementById('reg-error');
    if (errEl) errEl.style.display = 'none';

    openModal('register-students-modal');
    window.Defeitos?.renderAssignmentWarnings();
}

function addStudentRow(num, etiqueta = '', aluno = '') {
    const tbody = document.getElementById('student-rows-body');
    if (!tbody) return;
    const rowNum = num || (tbody.children.length + 1);

    const tr = document.createElement('tr');
    tr.className = 'student-row';
    tr.innerHTML = `
        <td style="text-align: center; font-weight: 600; color: var(--color-text-muted);" class="row-index">${rowNum}</td>
        <td>
            <label>
                <span class="student-field-label">Nº da Etiqueta</span>
                <input type="text" class="form-control input-etiqueta" placeholder="01" value="${ERS.escapeHtml(etiqueta)}">
            </label>
        </td>
        <td>
            <label>
                <span class="student-field-label">Nome do Aluno</span>
                <input type="text" class="form-control input-aluno" placeholder="Nome do aluno" value="${ERS.escapeHtml(aluno)}">
            </label>
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn-remove-row" title="Remover linha" aria-label="Remover">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </td>
    `;

    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            tr.remove();
            reindexRows();
            updateRegCounter();
        } else {
            ERS.showToast('Ao menos um notebook deve constar no registro.', 'warning');
        }
    });

    tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', updateRegCounter);
    });

    tbody.appendChild(tr);
}

function reindexRows() {
    const tbody = document.getElementById('student-rows-body');
    if (!tbody) return;
    Array.from(tbody.children).forEach((tr, i) => {
        const idxEl = tr.querySelector('.row-index');
        if (idxEl) idxEl.textContent = i + 1;
    });
}

function updateRegCounter() {
    const tbody = document.getElementById('student-rows-body');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('.student-row'));
    let filled = 0;
    rows.forEach(r => {
        const et = r.querySelector('.input-etiqueta')?.value.trim();
        const al = r.querySelector('.input-aluno')?.value.trim();
        if (et && al) filled++;
    });
    const counterEl = document.getElementById('reg-counter-text');
    if (counterEl) {
        counterEl.textContent = `${filled} de ${rows.length} notebooks registrados`;
    }
}

async function handleSaveStudentRegistration(e) {
    e.preventDefault();
    if (!currentRegResId) return;

    const tbody = document.getElementById('student-rows-body');
    const rows = Array.from(tbody.querySelectorAll('.student-row'));
    const assignments = [];
    const errEl = document.getElementById('reg-error');

    for (let i = 0; i < rows.length; i++) {
        const et = rows[i].querySelector('.input-etiqueta').value.trim();
        const al = rows[i].querySelector('.input-aluno').value.trim();
        if (et || al) {
            if (!et) {
                errEl.textContent = `Por favor, informe a etiqueta do notebook na linha ${i + 1}.`;
                errEl.style.display = 'block';
                return;
            }
            if (!al) {
                errEl.textContent = `Por favor, informe o nome do aluno na linha ${i + 1}.`;
                errEl.style.display = 'block';
                return;
            }
            assignments.push({ etiqueta: et, aluno: al });
        }
    }

    if (assignments.length === 0) {
        errEl.textContent = 'Preencha ao menos uma etiqueta de notebook e o nome do aluno correspondente.';
        errEl.style.display = 'block';
        return;
    }

    const turma = document.getElementById('reg-class').value.trim();
    if (!turma) {
        errEl.textContent = 'Informe a turma da aula.';
        errEl.style.display = 'block';
        return;
    }
    const result = await ERS.saveStudentAssignments(currentRegResId, assignments, turma);
    if (result.ok) {
        closeModal('register-students-modal');
        ERS.showToast(`Uso de ${assignments.length} notebooks registrado com sucesso!`, 'success');
        renderActiveChip();
        renderCalendar();
        renderMyReservations();
    } else {
        errEl.textContent = result.message || 'Erro ao salvar registro.';
        errEl.style.display = 'block';
    }
}

function populateRoomSelect() {
    const sel = document.getElementById('res-room');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sem sala (somente notebooks)</option>';
    ERS.getActiveRooms().forEach(r => {
        sel.innerHTML += `<option value="${ERS.escapeHtml(r.nome)}">${ERS.escapeHtml(r.nome)}</option>`;
    });
}

function openTeacherReservationForm(booking) {
    const form = document.getElementById('new-reservation-form');
    if (form.dataset.saving) return;
    const editing = Boolean(booking);
    if (!editing && form.dataset.reservationId) form.reset();
    form.dataset.reservationId = booking?.id || '';
    form.dataset.turma = booking?.turma || '';
    document.getElementById('teacher-booking-title').textContent = editing ? 'Editar reserva' : 'Criar nova reserva';
    document.getElementById('teacher-booking-description').textContent = editing
        ? 'Atualize o horário ou os recursos da sua reserva.'
        : 'Escolha quando e quais recursos você precisa.';

    const date = document.getElementById('res-date');
    date.min = ERS.today();
    if (editing) date.value = booking.data;
    else if (!date.value || date.value < date.min) {
        const monday = ERS.dateKey(currentWeekMonday);
        date.value = monday >= date.min ? monday : date.min;
    }
    populateTimeSlots(editing ? reservationShift(booking.inicio) : currentShift, booking);
    populateRoomSelect();
    populateBrandSelect();

    if (editing) {
        document.getElementById('res-room').value = booking.sala || '';
        document.getElementById('res-brand').value = booking.marca || '';
        document.getElementById('res-quantity').value = booking.notebooks || '';
        form.dataset.prefillResource = booking.sala ? (booking.notebooks > 0 ? 'ambos' : 'sala') : 'notebooks';
    }

    document.getElementById('res-error').style.display = 'none';
    openModal('new-reservation-modal');
}

async function handleSaveReservation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.saving) return;
    const reservationId = form.dataset.reservationId;
    const data = document.getElementById('res-date').value;
    const inicio = document.getElementById('res-start').value;
    const fim = document.getElementById('res-end').value;
    const payload = {
        data, inicio, fim,
        sala: document.getElementById('res-room').value || null,
        marca: document.getElementById('res-brand').value || 'Qualquer marca',
        notebooks: Number(document.getElementById('res-quantity').value),
        turma: form.dataset.turma || ''
    };

    const submit = form.querySelector('button[type="submit"]');
    form.dataset.saving = 'true';
    submit.disabled = true;
    let result;
    try {
        result = reservationId
            ? await ERS.updateReservation(reservationId, payload)
            : await ERS.createReservation({ ...payload, professorId: currentSession.userId, professorNome: currentSession.nome });
    } finally {
        delete form.dataset.saving;
        submit.disabled = false;
    }

    if (!result.ok) {
        const error = document.getElementById('res-error');
        error.textContent = result.message;
        error.style.display = 'block';
        error.scrollIntoView({ block: 'nearest' });
        return;
    }

    closeModal('new-reservation-modal');
    form.reset();
    delete form.dataset.reservationId;
    ERS.showToast(reservationId ? 'Reserva atualizada com sucesso!' : 'Reserva criada com sucesso!', 'success');

    currentWeekMonday = ERS.getMonday(data);
    currentShift = reservationShift(inicio);
    document.querySelectorAll('.shift-btn').forEach(button => {
        const active = button.dataset.shift === currentShift;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active);
    });
    renderCalendar();
    renderMyReservations();
    renderActiveChip();
}

function openReservationDetail(id) {
    const r = ERS.getReservations().find(r => r.id === id);
    if (!r) return;

    const isMine = r.professorId === currentSession.userId;

    let studentsHtml = '';
    if (r.alunosRegistrados && r.alunosNotebooks && r.alunosNotebooks.length > 0) {
        studentsHtml = `
            <div style="margin-top: 10px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <strong style="font-size: 13px; color: var(--color-primary); display: flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">assignment_turned_in</span>
                    Alunos e Notebooks Registrados (${r.alunosNotebooks.length})
                </strong>
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                    ${r.alunosNotebooks.map(a => `<span style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px;"><strong>${ERS.escapeHtml(a.etiqueta)}:</strong> ${ERS.escapeHtml(a.aluno)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    document.getElementById('res-detail-body').innerHTML = `
        <div class="detail-list">
            <div><strong>Data:</strong> ${bookingDate.format(new Date(r.data + 'T12:00:00Z'))}</div>
            <div><strong>Horário:</strong> ${r.inicio} – ${r.fim}</div>
            ${r.sala ? `<div><strong>Sala:</strong> ${ERS.escapeHtml(r.sala)}</div>` : ''}
            ${r.notebooks ? `<div><strong>Notebooks:</strong> ${r.notebooks}${r.marca && r.marca !== 'Qualquer marca' ? ' (' + ERS.escapeHtml(r.marca) + ')' : ''}</div>` : ''}
            ${r.turma ? `<div><strong>Turma:</strong> ${ERS.escapeHtml(r.turma)}</div>` : ''}
            <div><strong>Professor:</strong> ${ERS.escapeHtml(r.professorNome)}</div>
            <div><strong>Situação:</strong> <span class="badge-situacao badge-${r.situacao}">${r.situacao}</span></div>
            ${r.retiradaConfirmada ? `<div><strong>Entrega:</strong> <span class="badge badge-success">Retirada confirmada pela Coordenação</span></div>` : (r.notebooks ? `<div><strong>Entrega:</strong> <span class="badge badge-warning">Aguardando confirmação da Coordenação</span></div>` : '')}
            ${studentsHtml}
        </div>
    `;

    const btnDetailReg = document.getElementById('btn-detail-register-students');
    btnDetailReg.hidden = !isMine || !r.notebooks || !r.retiradaConfirmada || ERS.isReservationBlocked(r);
    btnDetailReg.textContent = r.alunosRegistrados ? 'Editar registro da aula' : 'Registrar aula';
    btnDetailReg.onclick = () => {
        closeModal('res-detail-modal');
        openRegisterStudentsModal(id);
    };

    const btnEdit = document.getElementById('btn-detail-edit-res');
    btnEdit.hidden = !ERS.canEditReservation(r, currentSession.userId);
    btnEdit.onclick = () => {
        const booking = ERS.getReservations().find(item => item.id === id);
        if (!booking || !ERS.canEditReservation(booking, currentSession.userId)) {
            ERS.showToast('Esta reserva não está mais disponível para edição.', 'warning');
            return;
        }
        closeModal('res-detail-modal');
        openTeacherReservationForm(booking);
    };

    const btnCancel = document.getElementById('btn-cancel-res');
    btnCancel.hidden = !isMine || r.situacao !== 'confirmada';
    btnCancel.onclick = () => cancelRes(id);
    window.Defeitos?.renderDetail(r);
    openModal('res-detail-modal');
}

async function cancelRes(id) {
    const ok = await showConfirmModal({
        title: 'Cancelar Reserva',
        message: 'Tem certeza de que deseja cancelar esta reserva? Os recursos ficarão disponíveis novamente para outros professores.',
        icon: 'event_busy',
        type: 'danger',
        confirmText: 'Sim, Cancelar',
        cancelText: 'Voltar'
    });
    if (!ok) return;

    const result = await ERS.cancelReservation(id);
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
