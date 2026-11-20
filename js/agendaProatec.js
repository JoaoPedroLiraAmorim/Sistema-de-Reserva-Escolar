'use strict';

window.AgendaProatecModule = (function() {
    let currentSession = null;
    let currentWeekMonday = ERS.getMonday(new Date());
    let currentShift = 'manha';
    let selectedResId = null;
    let isInitialized = false;

    const SHIFT_SLOTS = ERS.SHIFT_SLOTS;

    function init(session) {
        currentSession = session || AUTH.getSession();
        if (!currentSession) return;
        window.BloqueiosModule?.init(currentSession);

        const btnBlock = document.getElementById('btnOpenBlock');
        if (btnBlock) btnBlock.style.display = 'inline-flex';
        if (currentSession.role === 'coordenacao') {
            document.querySelectorAll('.coordenacao-only').forEach(el => el.style.display = '');
        }

        if (!isInitialized) {
            isInitialized = true;

            document.getElementById('btnPrevWeek')?.addEventListener('click', () => {
                currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
                renderCalendar();
            });
            document.getElementById('btnNextWeek')?.addEventListener('click', () => {
                currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
                renderCalendar();
            });

            document.querySelectorAll('#shiftControl .shift-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#shiftControl .shift-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentShift = btn.dataset.shift;
                    renderCalendar();
                    populateTimeSlots(currentShift);
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

            document.getElementById('btnOpenNewReservation')?.addEventListener('click', () => {
                const dInput = document.getElementById('res-date');
                if (dInput) {
                    dInput.min = ERS.today();
                    if (!dInput.value || dInput.value < ERS.today()) {
                        dInput.value = ERS.today();
                    }
                }
                const errEl = document.getElementById('res-error');
                if (errEl) errEl.style.display = 'none';
                populateTimeSlots(currentShift);
                populateRoomSelect();
                populateBrandSelect();
                const professorSelect = document.getElementById('res-professor');
                if (professorSelect) professorSelect.innerHTML = '<option value="">Selecione um professor</option>' +
                    ERS.getProfessors().map(p => `<option value="${p.id}">${ERS.escapeHtml(p.nome)}</option>`).join('');
                updateAvailInfo();
                openModal('new-reservation-modal');
            });

            document.getElementById('res-quantity')?.addEventListener('input', updateAvailInfo);
            document.getElementById('res-brand')?.addEventListener('change', updateAvailInfo);
            document.getElementById('res-start')?.addEventListener('change', updateAvailInfo);
            document.getElementById('res-end')?.addEventListener('change', updateAvailInfo);
            document.getElementById('res-date')?.addEventListener('change', updateAvailInfo);

            document.getElementById('new-reservation-form')?.addEventListener('submit', handleCreateReservation);
            document.getElementById('btn-delete-blk')?.addEventListener('click', handleDeleteBlock);
        }

        populateTimeSlots(currentShift);
        renderCalendar();
    }

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

    function populateBrandSelect() {
        const sel = document.getElementById('res-brand');
        if (!sel) return;
        const curVal = sel.value;
        sel.innerHTML = '<option value="">Qualquer marca</option>';
        if (typeof ERS.getBrands === 'function') {
            ERS.getBrands().forEach(b => {
                sel.innerHTML += `<option value="${b}">${ERS.escapeHtml(b)}</option>`;
            });
        }
        if (curVal) sel.value = curVal;
    }

    function renderCalendar() {
        const weekLabelEl = document.getElementById('weekLabel');
        const thead = document.getElementById('calendarHead');
        const tbody = document.getElementById('calendarBody');
        if (!weekLabelEl || !thead || !tbody) return;

        const weekDays = ERS.getWeekDays(currentWeekMonday);
        const slots = SHIFT_SLOTS[currentShift] || SHIFT_SLOTS['manha'];

        const first = weekDays[0];
        const last = weekDays[weekDays.length - 1];
        weekLabelEl.textContent =
            `${first.getDate()} ${ERS.MESES[first.getMonth()]} — ${last.getDate()} ${ERS.MESES[last.getMonth()]}`;

        const todayStr = ERS.today();
        thead.innerHTML = `<tr>
            <th class="time-col-header"><span class="material-symbols-outlined">schedule</span></th>
            ${weekDays.map(d => {
                const dk = ERS.dateKey(d);
                const isToday = dk === todayStr;
                return `<th data-date="${dk}"${isToday ? ' class="today-col"' : ''}>
                    <div class="day-header-tag">${ERS.DIAS_SEMANA_FULL[d.getDay()]}</div>
                    <div class="day-header-number">${d.getDate()}</div>
                </th>`;
            }).join('')}
        </tr>`;

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
            td.dataset.date = dk; td.dataset.start = slot.start; td.dataset.end = slot.end;

                const dayReservations = ERS.getReservationsByDate(dk);
                const slotReservations = dayReservations.filter(r =>
                    ERS.timesOverlap(slot.start, slot.end, r.inicio, r.fim)
                );

                const blocks = ERS.getBlocksByDate(dk).filter(b =>
                    ERS.timesOverlap(slot.start, slot.end, b.inicio, b.fim)
                );

                let html = '';

                if (blocks.length > 0) {
                    html += `<div class="calendar-events-container">`;
                    blocks.forEach(b => {
                        html += `<div class="calendar-event-card event-block" title="${ERS.escapeHtml(b.motivo)} (Clique para detalhes)"
                            data-blk-id="${b.id}" onclick="openBlockDetail('${b.id}')">
                            <span class="event-teacher">🔒 Bloqueado</span>
                            <span class="event-desc">${ERS.escapeHtml(b.motivo)}</span>
                            <span class="event-room"><span class="material-symbols-outlined">block</span> ${BloqueiosModule.formatBlockHours(b)}</span>
                        </div>`;
                    });
                    html += `</div>`;
                }

                if (slotReservations.length > 0) {
                    html += `<div class="calendar-events-container">`;
                    slotReservations.forEach(r => {
                        const isCancelled = r.situacao === 'cancelada';
                        const colorClass = isCancelled ? 'error' : 'primary';
                        const blocked = ERS.isReservationBlocked(r);

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
                            <span class="event-teacher">${ERS.escapeHtml(r.professorNome)}</span>
                            ${blocked ? '<span class="reservation-blocked-label">Indisponível por bloqueio</span>' : ''}
                            <span class="event-desc">${ERS.escapeHtml(descText)}</span>
                            <span class="event-room">
                                <span class="material-symbols-outlined">${r.sala ? 'meeting_room' : 'laptop'}</span>
                                ${ERS.escapeHtml(r.sala || (r.marca && r.marca !== 'Qualquer marca' ? r.marca : 'Notebooks'))}
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

    function populateRoomSelect() {
        const sel = document.getElementById('res-room');
        if (!sel) return;
        sel.innerHTML = '<option value="">Sem sala (somente notebooks)</option>';
        ERS.getActiveRooms().forEach(r => {
            sel.innerHTML += `<option value="${ERS.escapeHtml(r.nome)}">${ERS.escapeHtml(r.nome)}</option>`;
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

    async function handleCreateReservation(e) {
        e.preventDefault();
        const errEl = document.getElementById('res-error');
        if (errEl) errEl.style.display = 'none';

        const data     = document.getElementById('res-date')?.value;
        const inicio   = document.getElementById('res-start')?.value;
        const fim      = document.getElementById('res-end')?.value;
        const sala     = document.getElementById('res-room')?.value;
        const marca    = document.getElementById('res-brand')?.value || '';
        const qtd      = parseInt(document.getElementById('res-quantity')?.value) || 0;
        const profInput = document.getElementById('res-professor');
        const professor = ERS.getProfessors().find(p => p.id === profInput?.value);
        if (!professor) {
            if (errEl) { errEl.textContent = 'Selecione o professor responsável pela reserva.'; errEl.style.display = 'block'; }
            return;
        }

        if (!data) {
            if (errEl) { errEl.textContent = 'Por favor, selecione uma data para a reserva.'; errEl.style.display = 'block'; }
            return;
        }
        if (data < ERS.today()) {
            if (errEl) { errEl.textContent = 'Não é permitido agendar reservas para datas anteriores a hoje.'; errEl.style.display = 'block'; }
            return;
        }

        if (!inicio || !fim) {
            if (errEl) { errEl.textContent = 'Por favor, selecione os horários de início e término.'; errEl.style.display = 'block'; }
            return;
        }

        const currentSlots = SHIFT_SLOTS[currentShift] || SHIFT_SLOTS['manha'];
        const validStarts = currentSlots.map(s => s.start);
        const validEnds = currentSlots.map(s => s.end);
        const shiftName = currentShift === 'manha' ? 'Manhã' : currentShift === 'tarde' ? 'Tarde' : 'Noite';

        if (!validStarts.includes(inicio) || !validEnds.includes(fim)) {
            if (errEl) { errEl.textContent = `Os horários selecionados devem pertencer ao turno da ${shiftName}.`; errEl.style.display = 'block'; }
            return;
        }

        if (inicio >= fim) {
            if (errEl) { errEl.textContent = 'O horário de início deve ser anterior ao horário de término.'; errEl.style.display = 'block'; }
            return;
        }
        if (!ERS.isReservationWithinWindow({ data, inicio, fim }, 15)) {
            if (errEl) { errEl.textContent = 'A reserva pode ser criada até 15 minutos após o início e antes do fim do horário.'; errEl.style.display = 'block'; }
            return;
        }

        if (!sala && qtd <= 0) {
            if (errEl) { errEl.textContent = 'Selecione ao menos uma sala ou informe a quantidade de notebooks.'; errEl.style.display = 'block'; }
            return;
        }

        const result = await ERS.createReservation({
            professorId: professor.id,
            professorNome: professor.nome,
            data, inicio, fim,
            sala: sala || null,
            marca: marca || 'Qualquer marca',
            notebooks: qtd,
        });

        if (!result.ok) {
            if (errEl) { errEl.textContent = result.message; errEl.style.display = 'block'; }
            return;
        }

        closeModal('new-reservation-modal');
        document.getElementById('new-reservation-form')?.reset();
        ERS.showToast('Reserva criada com sucesso!', 'success');
        renderCalendar();
        if (window.ProatecModule?.render) window.ProatecModule.render();
    }

    function openReservationDetail(id) {
        const r = ERS.getReservations().find(r => r.id === id);
        if (!r) return;

        selectedResId = id;

        const body = document.getElementById('res-detail-body');
        if (body) {
            let pickupStatusHtml = '';
            if (r.notebooks > 0) {
                if (r.retiradaConfirmada) {
                    pickupStatusHtml = `
                        <div style="margin-top: 6px; padding: 8px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
                            <strong style="color: #065f46; display: flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-outlined" style="font-size: 16px;">verified</span>
                                Retirada confirmada por ${ERS.escapeHtml(r.retiradaConfirmadaPor || 'Coordenação')}
                            </strong>
                            ${r.alunosRegistrados && r.alunosNotebooks && r.alunosNotebooks.length > 0 ? `
                                <div style="margin-top: 8px; font-size: 12px;">
                                    <strong>Alunos registrados (${r.alunosNotebooks.length}):</strong>
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                                        ${r.alunosNotebooks.map(a => `<span style="background:#ffffff; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:11px;"><strong>${ERS.escapeHtml(a.etiqueta)}:</strong> ${ERS.escapeHtml(a.aluno)}</span>`).join('')}
                                    </div>
                                </div>
                            ` : '<p style="margin: 4px 0 0; font-size: 11px; color: #047857;">Aguardando professor registrar alunos/etiquetas.</p>'}
                        </div>
                    `;
                } else {
                    pickupStatusHtml = `
                        <div style="margin-top: 6px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e;">
                            <strong style="display: flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-outlined" style="font-size: 16px;">pending_actions</span>
                                Aguardando confirmação de entrega dos notebooks
                            </strong>
                            <p style="margin: 4px 0 0; font-size: 11px;">Confirme a entrega para liberar o registro de alunos na tela do professor.</p>
                        </div>
                    `;
                }
            }

            body.innerHTML = `
                <div class="detail-list">
                    <div><strong>Data:</strong> ${ERS.formatDate(r.data)}</div>
                    <div><strong>Horário:</strong> ${r.inicio} – ${r.fim}</div>
                    ${r.sala ? `<div><strong>Sala:</strong> ${ERS.escapeHtml(r.sala)}</div>` : ''}
                    ${r.notebooks ? `<div><strong>Notebooks:</strong> ${r.notebooks}${r.marca && r.marca !== 'Qualquer marca' ? ' (' + ERS.escapeHtml(r.marca) + ')' : ''}</div>` : ''}
                    <div><strong>Professor:</strong> ${ERS.escapeHtml(r.professorNome)}</div>
                    <div><strong>Situação:</strong> <span class="badge-situacao badge-${r.situacao}">${r.situacao}</span></div>
                    ${pickupStatusHtml}
                </div>
            `;
        }

        const btnCancel = document.getElementById('btn-cancel-res');
        if (btnCancel) {
            btnCancel.hidden = r.situacao !== 'confirmada';
            btnCancel.onclick = () => cancelRes(id);
        }

        openModal('res-detail-modal');
    }

    async function cancelRes(id) {
        const ok = await showConfirmModal({
            title: 'Cancelar Reserva',
            message: 'Tem certeza de que deseja cancelar esta reserva? Os recursos ficarão disponíveis novamente.',
            icon: 'event_busy',
            type: 'danger',
            confirmText: 'Sim, Cancelar Reserva',
            cancelText: 'Voltar'
        });
        if (!ok) return;

        const result = await ERS.cancelReservation(id);
        if (result.ok) {
            closeModal('res-detail-modal');
            ERS.showToast('Reserva cancelada. Recursos liberados.', 'success');
            renderCalendar();
            if (window.ProatecModule?.render) window.ProatecModule.render();
        } else {
            ERS.showToast(result.message, 'error');
        }
    }

    let selectedBlockId = null;

    function openBlockDetail(id) {
        const b = ERS.getBlocks().find(b => b.id === id);
        if (!b) return;

        selectedBlockId = id;

        const body = document.getElementById('block-detail-body');
        if (body) {
            body.innerHTML = `
                <div class="detail-list">
                    <div><strong>Datas</strong> ${BloqueiosModule.formatBlockDates(b)}</div>
                    <div><strong>Horário</strong> ${BloqueiosModule.formatBlockHours(b)}</div>
                    ${b.motivo ? `<div><strong>Motivo</strong> ${ERS.escapeHtml(b.motivo)}</div>` : ''}
                    <div><strong>Criado por:</strong> ${ERS.escapeHtml(b.criadoPor || 'Sistema')}</div>
                    ${b.criadoEm ? `<div><strong>Registrado em:</strong> ${new Date(b.criadoEm).toLocaleString('pt-BR')}</div>` : ''}
                </div>
            `;
        }

        openModal('block-detail-modal');
    }

    async function handleDeleteBlock() {
        if (!selectedBlockId) return;

        const b = ERS.getBlocks().find(b => b.id === selectedBlockId);
        const ok = await showConfirmModal({
            title: 'Remover Bloqueio',
            message: b
                ? `Deseja realmente remover o bloqueio de <strong>${BloqueiosModule.formatBlockDates(b)}</strong>? Os horários voltarão a ficar disponíveis para reserva.`
                : 'Deseja realmente remover este bloqueio? Os horários voltarão a ficar disponíveis.',
            icon: 'lock_open',
            type: 'danger',
            confirmText: 'Sim, Remover Bloqueio',
            cancelText: 'Cancelar'
        });
        if (!ok) return;

        const result = await ERS.deleteBlock(selectedBlockId);
        if (!result.ok) { ERS.showToast(result.message, 'error'); return; }
        closeModal('block-detail-modal');
        selectedBlockId = null;
        ERS.showToast('Bloqueio removido com sucesso!', 'success');
        renderCalendar();
        if (window.BloqueiosModule?.render) window.BloqueiosModule.render();
    }

    if (!window.isSpaMode) {
        document.addEventListener('ers:ready', () => {
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
        render: renderCalendar,
        openReservationDetail,
        openBlockDetail,
        cancelRes,
        updateAvailInfo,
        populateBrandSelect,
        populateRoomSelect,
        populateTimeSlots
    };
})();

window.openReservationDetail = function(id) {
    window.AgendaProatecModule?.openReservationDetail(id);
};
window.openBlockDetail = function(id) {
    window.AgendaProatecModule?.openBlockDetail(id);
};
window.cancelRes = function(id) {
    window.AgendaProatecModule?.cancelRes(id);
};
