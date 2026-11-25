(function () {
    'use strict';
    const $ = s => document.querySelector(s);
    const esc = s => window.ERS ? ERS.escapeHtml(String(s ?? '')) : String(s ?? '');
    const paths = {
        school:'M3 9l9-5 9 5-9 5-9-5z M6 11v6c4 3 8 3 12 0v-6 M21 9v8',
        home:'M3 10l9-7 9 7 M5 9v12h5v-7h4v7h5V9',
        calendar:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 18h2',
        laptop:'M5 4h14v12H5z M2 20h20l-3-4H5z',
        room:'M5 21V4h14v17 M3 21h18 M9 21V8h6v13 M12 14h.1',
        clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
        plus:'M12 5v14 M5 12h14',
        close:'M6 6l12 12 M18 6L6 18',
        check:'M5 12l4 4L19 6',
        check_circle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M7 12l3 3 7-7',
        block:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M6 6l12 12',
        list:'M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1',
        grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
        inventory:'M4 8h16v13H4z M3 3h18v5H3z M9 12h6',
        person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
        report:'M5 21V3h14v18z M9 16v-3 M12 16V9 M15 16V6',
        logout:'M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4',
        left:'M15 5l-7 7 7 7', right:'M9 5l7 7-7 7', down:'M5 9l7 7 7-7',
        trash:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
        save:'M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8',
        wrench:'M14 6a6 6 0 0 0-7 7L2 18l4 4 5-5a6 6 0 0 0 7-8l-4 4-3-3 4-4z',
        swap:'M3 7h17l-4-4 M21 17H4l4 4',
        warning:'M12 3L2 21h20L12 3z M12 9v5 M12 17h.01',
        lock:'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
        menu:'M4 6h16 M4 12h16 M4 18h16',
        info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01'
    };
    const aliases = {
        calendar_today:'calendar',calendar_month:'calendar',today:'calendar',event:'calendar',event_note:'calendar',calendar_clock:'calendar',event_available:'calendar',event_busy:'calendar',
        computer:'laptop',devices:'laptop',laptop_mac:'laptop',laptop_chromebook:'laptop',laptop_windows:'laptop',meeting_room:'room',
        schedule:'clock',timer:'clock',alarm_on:'clock',pending:'clock',add:'plus',add_circle:'plus',cancel:'close',delete:'trash',
        bar_chart:'report',history_edu:'list',assignment:'list',assignment_ind:'list',list_alt:'list',checklist:'list',inventory_2:'inventory',
        chevron_left:'left',chevron_right:'right',arrow_forward:'right',expand_more:'down',build:'wrench',report_problem:'warning',sync_alt:'swap',published_with_changes:'swap',
        toggle_off:'swap',toggle_on:'check_circle',lock_open:'lock',help:'info',error:'warning',check_circle_outline:'check_circle',done:'check',done_all:'check'
    };
    function svg(name) {
        return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[aliases[name] || name] || paths.info}"/></svg>`;
    }
    const icon = name => `<span class="material-symbols-outlined" data-icon="${name}" aria-hidden="true">${svg(name)}</span>`;
    function decorate() {
        document.querySelectorAll('.student-row').forEach((row,i)=>{
            row.querySelector('.input-etiqueta')?.setAttribute('aria-label',`Etiqueta do notebook ${i+1}`);
            row.querySelector('.input-aluno')?.setAttribute('aria-label',`Aluno do notebook ${i+1}`);
        });
        document.querySelectorAll('.material-symbols-outlined').forEach(el => {
            if (el.querySelector('svg')) return;
            const name = el.textContent.trim();
            el.dataset.icon = name;
            el.setAttribute('aria-hidden','true');
            const parent = el.closest('button,a');
            if (parent && parent.textContent.trim() === name && !parent.hasAttribute('aria-label')) parent.setAttribute('aria-label',parent.title || ({logout:'Sair',close:'Fechar',chevron_left:'Anterior',chevron_right:'Próximo'}[name] || name));
            el.innerHTML = svg(name);
        });
        document.querySelectorAll('.calendar-event-card[onclick]').forEach(el => {
            el.tabIndex=0;el.setAttribute('role','button');
            if (!el.dataset.keyboard) { el.dataset.keyboard='true'; el.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}}); }
        });
    }
    let queued = false;
    function queueDecorate() {if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;decorate();watchModals();});}}

    const modalStates = new WeakMap();

    function updateBookingViewport() {
        const modal = $('#new-reservation-modal:not(.hidden)');
        const viewport = window.visualViewport;
        if (!modal || !viewport) return;
        modal.style.setProperty('--booking-viewport-top', `${viewport.offsetTop}px`);
        modal.style.setProperty('--booking-viewport-height', `${viewport.height}px`);
    }

    window.visualViewport?.addEventListener('resize', updateBookingViewport);
    window.visualViewport?.addEventListener('scroll', updateBookingViewport);

    function watchModals() {
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            if (modalStates.has(modal)) return;
            const state = { visible: false, trigger: null };
            modalStates.set(modal, state);
            const dialog = modal.matches('[role="dialog"], [role="alertdialog"]') ? modal : modal.querySelector('.modal');
            if (dialog) {
                if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
                dialog.setAttribute('aria-modal', 'true');
                const title = dialog.querySelector('h3');
                if (title) {
                    if (!title.id) title.id = modal.id + '-title';
                    dialog.setAttribute('aria-labelledby', title.id);
                }
            }

            const update = () => {
                const visible = !modal.classList.contains('hidden');
                const changed = state.visible !== visible;
                state.visible = visible;
                if (changed && modal.id !== 'system-confirm-modal') {
                    if (visible) {
                        const focused = document.activeElement;
                        const previousDialog = focused.closest('.modal-backdrop.hidden');
                        state.trigger = modalStates.get(previousDialog)?.trigger || focused;
                        if (modal.id === 'new-reservation-modal') {
                            prepareReservation();
                            updateBookingViewport();
                        }
                        requestAnimationFrame(() => {
                            if (state.visible) modal.querySelector('.btn-close')?.focus({ preventScroll: true });
                        });
                    } else {
                        if (modal.id === 'new-reservation-modal') clearReview();
                        if (state.trigger?.isConnected) state.trigger.focus({ preventScroll: true });
                    }
                }
                document.body.style.overflow = document.querySelector('.modal-backdrop:not(.hidden)') ? 'hidden' : '';
            };
            new MutationObserver(update).observe(modal, { attributes: true, attributeFilter: ['class'] });
            update();
        });
    }

    document.addEventListener('keydown', event => {
        const visible = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
        const modal = visible.find(item => item.contains(document.activeElement)) || visible.at(-1);
        if (!modal) return;
        if (event.key === 'Tab') {
            const focus = [...modal.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[tabindex="0"]')]
                .filter(element => element.tabIndex >= 0 && !element.disabled && element.getClientRects().length);
            if (!focus.length) return;
            const current = focus.indexOf(document.activeElement);
            if (current === -1 || (event.shiftKey ? current === 0 : current === focus.length - 1)) {
                event.preventDefault();
                (event.shiftKey ? focus.at(-1) : focus[0]).focus();
            }
        }
        if (event.key === 'Escape' && modal.id !== 'system-confirm-modal') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (modal.id === 'report-defect-modal' && window.Defeitos) window.Defeitos.closeReport();
            else window.closeModal?.(modal.id);
        }
    }, true);

    const agendaBreakpoint = window.matchMedia('(max-width: 1100px)');
    const phoneAgenda = window.matchMedia('(max-width: 768px), (max-width: 900px) and (max-height: 560px) and (orientation: landscape)');
    const teacherAgenda = document.body.classList.contains('teacher-page');
    let agendaMode = agendaBreakpoint.matches ? 'day' : 'grid';
    let agendaModeChosen = false;
    let selectedAgendaDay;
    const isTeacherDay = () => teacherAgenda && !phoneAgenda.matches && agendaMode === 'day';
    const getAgendaDays = () => [...document.querySelectorAll('#calendarHead th[data-date]')].map(el => el.dataset.date);
    const fullDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const agendaColumnDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const shortWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

    function selectAgendaDay(date) {
        selectedAgendaDay = date;
        if (!getAgendaDays().includes(date)) showTeacherCalendarWeek(date);
        else renderAgenda();
    }

    function moveAgendaDay(direction) {
        const date = new Date(selectedAgendaDay + 'T12:00:00');
        do { date.setDate(date.getDate() + direction); } while (date.getDay() === 0 || date.getDay() === 6);
        selectAgendaDay(ERS.dateKey(date));
    }

    function setupAgenda() {
        const table=$('#calendarTable');if(!table)return;
        const controls=$('.calendar-controls-bar');
        if (teacherAgenda) {
            controls.insertAdjacentHTML('afterbegin', `<div class="teacher-day-controls">
                <div class="v2-day-nav" role="group" aria-label="Navegação diária">
                    <button type="button" id="v2-prev-day" aria-label="Dia anterior">${icon('left')}</button>
                    <h2 id="v2-selected-day" aria-live="polite" aria-atomic="true"></h2>
                    <button type="button" id="v2-next-day" aria-label="Próximo dia">${icon('right')}</button>
                </div>
                <div id="teacher-week-days" role="group" aria-label="Dias da semana"></div>
            </div>`);
            $('#v2-prev-day').onclick = () => moveAgendaDay(-1);
            $('#v2-next-day').onclick = () => moveAgendaDay(1);
        }
        const wrapper = $('.calendar-wrapper-card');
        const tools = document.createElement('div');
        tools.className = 'v2-agenda-tools';
        tools.innerHTML = '<span id="v2-agenda-summary" class="v2-agenda-summary"></span>';
        controls.after(tools);
        if (teacherAgenda) {
            tools.insertAdjacentHTML('beforeend', `<div class="v2-tool-group"><button type="button" class="v2-today">Hoje</button>
                <div class="v2-segment" role="group" aria-label="Visualização da agenda">
                    <button type="button" data-agenda-mode="grid">${icon('grid')}Semana</button>
                    <button type="button" data-agenda-mode="day">${icon('calendar')}Dia</button>
                </div></div>`);
            wrapper.insertAdjacentHTML('afterend','<div class="v2-calendar-legend"><span><i></i>Sua reserva</span><span><i class="other"></i>Outra reserva</span><span><i class="block"></i>Período bloqueado</span></div>');
            $('.v2-today').onclick = () => {
                const today = new Date(ERS.today() + 'T12:00:00');
                const date = today.getDay() === 0 || today.getDay() === 6 ? ERS.getMonday(today) : today;
                selectAgendaDay(ERS.dateKey(date));
            };
            document.querySelectorAll('[data-agenda-mode]').forEach(button => {
                button.onclick = () => {
                    agendaModeChosen = true;
                    agendaMode = button.dataset.agendaMode;
                    renderAgenda();
                };
            });
            agendaBreakpoint.addEventListener('change', event => {
                if (!agendaModeChosen) agendaMode = event.matches ? 'day' : 'grid';
                renderAgenda();
            });
            phoneAgenda.addEventListener('change', renderAgenda);
        }

        const refresh = () => { enhanceCells(); renderAgenda(); };
        const observer = new MutationObserver(refresh);
        observer.observe(table.tHead, { childList: true });
        observer.observe(table.tBodies[0], { childList: true });
        refresh();
    }

    function enhanceCells() {
        const reservations = new Map(ERS.getReservations().map(r => [String(r.id), r]));
        for (const cell of document.querySelectorAll('#calendarBody td[data-date]')) {
            const { date, start, end } = cell.dataset;
            const cards = cell.querySelectorAll('.calendar-event-card');
            for (const card of cards) {
                const booking = reservations.get(card.dataset.resId);
                if (!booking) continue;
                const description = card.querySelector('.event-desc');
                const brand = booking.marca && booking.marca !== 'Qualquer marca' ? ' · ' + booking.marca : '';
                const resources = booking.notebooks ? `${booking.notebooks} notebooks${brand}` : 'Somente sala';
                const time = `${booking.inicio}–${booking.fim}`;
                if (description) description.textContent = resources;
                card.classList.toggle('v2-no-room', !booking.sala);
                card.title = [time, booking.professorNome, resources, booking.sala, booking.turma].filter(Boolean).join(' · ');
                if (!card.querySelector('.v2-event-time')) {
                    const label = document.createElement('span');
                    label.className = 'v2-event-time';
                    label.textContent = time;
                    card.prepend(label);
                }
            }
            if (teacherAgenda || cards.length || cell.querySelector('.v2-cell-action') ||
                !ERS.isReservationWithinWindow({ data: date, inicio: start, fim: end }, 15)) continue;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'v2-cell-action';
            button.textContent = 'Reservar';
            button.setAttribute('aria-label', `Reservar em ${fullDate.format(new Date(date + 'T12:00:00'))} às ${start}`);
            button.onclick = () => quickReserve(date, start, end);
            cell.append(button);
        }
    }
    function compactCalendarCells() {
        document.querySelectorAll('#calendarBody .calendar-events-container').forEach(container => {
            const cards = [...container.querySelectorAll('.calendar-event-card')].filter(c => !c.hidden);
            cards.forEach((card, index) => card.classList.toggle('v2-overflow-card', index >= 2));
            let button = container.querySelector('.v2-more-events');
            if (cards.length <= 2) { button?.remove(); container.classList.remove('v2-expanded'); return; }
            if (!button) {
                button = document.createElement('button'); button.type = 'button'; button.className = 'v2-more-events';
                container.append(button);
            }
            function update() {
                const expanded = container.classList.contains('v2-expanded');
                const hiddenCount = cards.length - 2;
                const label = expanded ? 'Recolher' : `Ver mais ${hiddenCount}`;
                if (button.textContent !== label) button.textContent = label;
                button.setAttribute('aria-expanded', String(expanded));
            }
            button.onclick = () => { container.classList.toggle('v2-expanded'); update(); };
            update();
        });
    }
    function quickReserve(date, start, end, resource) {
        $('#btnOpenNewReservation').click();
        const form = $('#new-reservation-form');
        if (form.dataset.saving) return;
        $('#res-date').value = date;
        $('#res-start').value = start;
        $('#res-end').value = end;
        if (resource) form.dataset.prefillResource = resource;
    }
    function renderTeacherAgenda(days) {
        const today = ERS.today();
        const daily = isTeacherDay();
        document.body.classList.toggle('v2-teacher-day', daily);
        if (!days.includes(selectedAgendaDay)) selectedAgendaDay = days.includes(today) ? today : days[0];

        const dayLabel = $('#v2-selected-day');
        const label = fullDate.format(new Date(selectedAgendaDay + 'T12:00:00'));
        if (dayLabel.textContent !== label) dayLabel.textContent = label;
        $('#calendarTable').setAttribute('aria-label', daily ? `Agenda do professor: ${label}` : 'Grade de horários da agenda do professor');
        const rail = $('#teacher-week-days');
        if (rail.firstElementChild?.dataset.date !== days[0]) {
            rail.replaceChildren(...days.map(date => {
                const day = new Date(date + 'T12:00:00');
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.date = date;
                button.setAttribute('aria-label', fullDate.format(day));
                const weekday = document.createElement('span');
                weekday.textContent = shortWeekday.format(day).replace('.', '');
                const number = document.createElement('strong');
                number.textContent = day.getDate();
                button.append(weekday, number);
                button.onclick = () => selectAgendaDay(date);
                return button;
            }));
        }
        for (const button of rail.children) {
            button.setAttribute('aria-pressed', button.dataset.date === selectedAgendaDay);
            if (button.dataset.date === today) button.setAttribute('aria-current', 'date');
            else button.removeAttribute('aria-current');
        }

        const reservations = new Map(ERS.getReservations().map(r => [String(r.id), r]));
        const bookingsShown = new Set();
        const rooms = ERS.getActiveRooms();
        document.querySelectorAll('#calendarTable [data-date]').forEach(cell => {
            const { date, start, end } = cell.dataset;
            cell.hidden = daily && date !== selectedAgendaDay;
            const heading = cell.querySelector('.day-header-resources');
            if (heading) heading.textContent = agendaColumnDate.format(new Date(date + 'T12:00:00'));
            const cards = [...cell.querySelectorAll('.calendar-event-card[data-res-id]')];
            cards.forEach(card => {
                const booking = reservations.get(card.dataset.resId);
                if (booking && !cell.hidden) bookingsShown.add(booking.id);
            });

            if (!start) return;
            cell.querySelector('.teacher-slot-info')?.remove();
            if (cell.hidden || cell.querySelector('.event-block')) return;

            const slot = document.createElement('div');
            slot.className = 'teacher-slot-info';
            const status = document.createElement('p');
            if (daily) slot.append(status);
            if (!ERS.isReservationWithinWindow({ data: date, inicio: start, fim: end }, 15)) {
                if (daily && !cards.length) {
                    status.textContent = 'Horário encerrado para reservas';
                    cell.append(slot);
                }
                return;
            }

            const active = ERS.getReservationsByDate(date).filter(r => ERS.timesOverlap(start, end, r.inicio, r.fim));
            const freeRooms = rooms.filter(r => !active.some(booking => booking.sala === r.nome)).length;
            const notebooks = ERS.getAvailability({ data: date, inicio: start, fim: end });
            if (daily) {
                status.textContent = notebooks > 0 || freeRooms > 0
                    ? `${notebooks} notebooks livres · ${freeRooms} ${freeRooms === 1 ? 'sala livre' : 'salas livres'}`
                    : 'Recursos ocupados';
                cell.append(slot);
            }
            if (notebooks <= 0 && freeRooms === 0) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = daily ? 'teacher-slot-book' : 'v2-cell-action';
            button.textContent = 'Reservar';
            button.setAttribute('aria-label', `Reservar em ${fullDate.format(new Date(date + 'T12:00:00'))} às ${start}`);
            button.onclick = () => quickReserve(date, start, end, notebooks === 0 ? 'sala' : freeRooms === 0 ? 'notebooks' : '');
            slot.append(button);
            if (!daily) cell.append(slot);
        });
        const count = bookingsShown.size;
        $('#v2-agenda-summary').textContent = `${count} reserva${count === 1 ? '' : 's'} ${daily ? 'neste dia e turno' : 'no turno'}`;
    }

    function renderAgenda() {
        const days = getAgendaDays();
        if (!days.length) return;
        if (teacherAgenda) {
            document.querySelectorAll('[data-agenda-mode]').forEach(button => {
                button.setAttribute('aria-pressed', button.dataset.agendaMode === (isTeacherDay() ? 'day' : 'grid'));
            });
            renderTeacherAgenda(days);
        } else {
            const bookings = new Set([...document.querySelectorAll('#calendarBody [data-res-id]')].map(card => card.dataset.resId));
            $('#v2-agenda-summary').textContent = `${bookings.size} reserva${bookings.size === 1 ? '' : 's'} no turno`;
        }
        compactCalendarCells();
        decorate();
    }
    function availability() {
        const el=$('#avail-info');if(!el)return;el.classList.add('v2-availability');
        const val=id=>$('#'+id)?.value;
        const date=val('res-date'),start=val('res-start'),end=val('res-end');
        const excludeId = $('#new-reservation-form').dataset.reservationId || null;
        const free=date&&start&&end&&start<end?ERS.getAvailability({data:date,inicio:start,fim:end,marca:val('res-brand'),excludeId}):null;
        const requested=Number(val('res-quantity'))||0;
        const conflict = free === null ? {ok:true} : ERS.checkConflicts({data:date,inicio:start,fim:end,sala:val('res-room'),notebooks:requested,marca:val('res-brand'),excludeId});
        el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
        const brand = val('res-brand');
        el.textContent=!conflict.ok ? conflict.message : free===null?'Escolha o horário para consultar os recursos disponíveis.':`${free} notebooks${brand ? ' ' + brand : ''} livres neste período. ${requested?requested+' solicitado(s).':'Você também pode reservar somente uma sala.'}`;
        el.classList.toggle('invalid',!conflict.ok);
    }
    function prepareReservation() {
        const form=$('#new-reservation-form');if(!form)return;
        const body=form.querySelector('.modal-body');
        if(!$('#v2-res-shift')){
            body.insertAdjacentHTML('afterbegin',`<div class="v2-shift-choice"><label for="v2-res-shift">Turno escolar</label><select id="v2-res-shift"><option value="manha">Manhã · 07h às 12h15</option><option value="tarde">Tarde · 13h às 18h15</option><option value="noite">Noite · 19h às 22h30</option></select></div>`);
            $('#v2-res-shift').onchange = event => {
                const shift = event.target.value;
                if (teacherAgenda) populateTimeSlots(shift);
                else $(`.shift-btn[data-shift="${shift}"]`)?.click();
                availability();
            };
        }
        $('#v2-res-shift').value = form.dataset.shift || $('.shift-btn.active')?.dataset.shift || 'manha';
        if (!form.dataset.organized) {
            form.dataset.organized = 'true';
            const dateGroup = $('#res-date').closest('.form-group');
            const timeRow = $('#res-start').closest('.form-row');
            const roomGroup = $('#res-room').closest('.form-group');
            const notebooksRow = $('#res-brand').closest('.form-row');
            const when = document.createElement('fieldset'); when.className = 'booking-section';
            when.innerHTML = '<legend>Quando será a aula?</legend>';
            when.append($('#v2-res-shift').parentElement, dateGroup, timeRow);
            const resources = document.createElement('fieldset'); resources.className = 'booking-section';
            resources.innerHTML = '<legend>Quais recursos você precisa?</legend><div class="resource-choices"><label><input type="radio" name="resource-type" value="notebooks" checked><span>Notebooks</span></label><label><input type="radio" name="resource-type" value="sala"><span>Uma sala</span></label><label><input type="radio" name="resource-type" value="ambos"><span>Os dois</span></label></div>';
            resources.append(roomGroup, notebooksRow);
            body.prepend(when, resources);
            const professor = $('#res-professor')?.closest('.form-group');
            if (professor) when.prepend(professor);
            function resourceMode() {
                const mode = form.querySelector('[name="resource-type"]:checked').value;
                roomGroup.hidden = mode === 'notebooks'; notebooksRow.hidden = mode === 'sala';
                $('#res-room').disabled = mode === 'notebooks'; $('#res-room').required = mode !== 'notebooks';
                $('#res-brand').disabled = mode === 'sala'; $('#res-quantity').disabled = mode === 'sala';
                $('#res-quantity').required = mode !== 'sala'; $('#res-quantity').min = mode === 'sala' ? '0' : '1';
                if (mode === 'notebooks') $('#res-room').value = '';
                if (mode === 'sala') { $('#res-brand').value = ''; $('#res-quantity').value = '0'; }
                else if ($('#res-quantity').value === '0') $('#res-quantity').value = '';
                availability();
            }
            resources.addEventListener('change', event => { if (event.target.name === 'resource-type') resourceMode(); });
            if (!ERS.getTotalDisponivel()) resources.querySelector('[value="sala"]').checked = true;
        }
        if (form.dataset.prefillResource) {
            form.querySelector(`[name="resource-type"][value="${form.dataset.prefillResource}"]`).checked = true;
            delete form.dataset.prefillResource;
        }
        form.querySelector('[name="resource-type"]:checked').dispatchEvent(new Event('change', { bubbles: true }));
        form.querySelector('button[type=submit]').textContent = form.dataset.reservationId ? 'Revisar alterações' : 'Revisar reserva';
        $('#res-error').setAttribute('role', 'alert');
    }

    function clearReview() {
        const form = $('#new-reservation-form');
        if (!form?.classList.contains('v2-reviewing')) return;
        form.classList.remove('v2-reviewing');
        $('#v2-review')?.remove();
        $('#v2-edit-res')?.remove();
        $('#v2-confirm-res')?.remove();
        form.querySelector('button[type="submit"]').hidden = false;
    }
    document.addEventListener('input',e=>{if(e.target.closest('#new-reservation-form'))availability();});
    document.addEventListener('change',e=>{if(e.target.closest('#new-reservation-form'))availability();});
    document.addEventListener('submit',e=>{
        const form=e.target;if(form.id!=='new-reservation-form'||form.dataset.approved==='true')return;
        e.preventDefault();e.stopImmediatePropagation();
        const v=id=>$('#'+id)?.value||'';
        const excludeId = form.dataset.reservationId || null;
        const data={data:v('res-date'),inicio:v('res-start'),fim:v('res-end'),sala:v('res-room'),marca:v('res-brand'),notebooks:Number(v('res-quantity')),turma:form.dataset.turma||'',excludeId};
        let error=(!data.sala&&!data.notebooks?'Escolha uma sala ou informe a quantidade de notebooks.':'');
        const weekday = new Date(data.data + 'T12:00:00').getDay();
        if (weekday === 0 || weekday === 6) error = 'As reservas são de segunda a sexta-feira. Escolha um dia letivo.';
        if (!error && data.inicio >= data.fim) error = 'O horário de início deve ser anterior ao horário de término.';
        if (!error && !ERS.isReservationWithinWindow(data, excludeId ? 10 : 15)) {
            error = excludeId
                ? 'Escolha uma aula dentro da janela de edição de até 10 minutos após o início.'
                : 'A reserva pode ser criada até 15 minutos após o início e antes do fim do horário.';
        }
        if(!error){const c=ERS.checkConflicts(data);if(!c.ok)error=c.message;}
        if(error){$('#res-error').textContent=error;$('#res-error').style.display='block';$('#res-error').scrollIntoView({block:'nearest'});return;}
        $('#res-error').style.display='none';clearReview();form.classList.add('v2-reviewing');
        const date = fullDate.format(new Date(data.data + 'T12:00:00'));
        const title = excludeId ? 'Confira as alterações' : 'Confira antes de reservar';
        form.querySelector('.modal-body').insertAdjacentHTML('beforeend', `<section id="v2-review" class="v2-preview" tabindex="-1">
            <h4>${title}</h4>
            <dl>
                ${$('#res-professor') ? `<dt>Professor</dt><dd>${esc($('#res-professor').selectedOptions[0]?.textContent || '')}</dd>` : ''}
                <dt>Data</dt><dd>${date}</dd>
                <dt>Horário</dt><dd>${data.inicio}–${data.fim}</dd>
                ${data.turma ? `<dt>Turma</dt><dd>${esc(data.turma)}</dd>` : ''}
                <dt>Sala</dt><dd>${esc(data.sala || 'Não solicitada')}</dd>
                <dt>Notebooks</dt><dd>${data.notebooks ? data.notebooks + ' · ' + esc(data.marca || 'Qualquer marca') : 'Não solicitados'}</dd>
            </dl>
        </section>`);
        form.querySelector('button[type="submit"]').hidden = true;
        form.querySelector('.modal-footer').insertAdjacentHTML('beforeend', `
            <button type="button" class="btn-secondary" id="v2-edit-res">Voltar à edição</button>
            <button type="button" class="btn-primary" id="v2-confirm-res">${excludeId ? 'Salvar alterações' : 'Confirmar reserva'}</button>`);
        $('#v2-edit-res').onclick=()=>{clearReview();$('#res-date').focus();};$('#v2-confirm-res').onclick=()=>{clearReview();form.dataset.approved='true';form.requestSubmit();delete form.dataset.approved;};$('#v2-review').focus();
    },true);

    function myReservations() {
        const tabs = [...document.querySelectorAll('[data-teacher-view]')];
        if (!tabs.length) return;
        function select(view, focus = false) {
            const reservations = view === 'reservas';
            $('#teacher-agenda-panel').hidden = reservations;
            $('#my-reservations-section').hidden = !reservations;
            tabs.forEach(tab => {
                const active = tab.dataset.teacherView === view;
                tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
                if (active && focus) tab.focus();
            });
            for (const link of [$('#mobileAgendaBtn'), $('#mobileMyResBtn')]) {
                if (!link) continue;
                const active = link.hash === (reservations ? '#my-reservations-section' : '#teacher-agenda-panel');
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            }
        }
        tabs.forEach((tab, index) => {
            tab.onclick = () => select(tab.dataset.teacherView);
            tab.onkeydown = event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                select(tabs[next].dataset.teacherView, true);
            };
        });
        [['#mobileAgendaBtn', 'agenda'], ['#mobileMyResBtn', 'reservas']].forEach(([selector, view]) => {
            $(selector)?.addEventListener('click', event => {
                event.preventDefault(); select(view);
                $(event.currentTarget.hash).scrollIntoView({ block: 'start' });
            });
        });
        select('agenda');
    }
    function refreshCoordination() {
        const host = $('#coord-overview'); if (!host) return;
        const reservations = ERS.getReservationsByDate(ERS.today());
        const pending = reservations.filter(r => r.notebooks > 0 && !r.retiradaConfirmada && !ERS.isReservationBlocked(r)).length;
        const metrics = [
            ['calendar', 'Reservas hoje', reservations.length, 'Salas e notebooks'],
            ['inventory', 'Retiradas pendentes', pending, 'Para preparar a entrega'],
            ['laptop', 'Notebooks funcionando', ERS.getTotalDisponivel(), 'Estoque da escola'],
            ['block', 'Bloqueios hoje', ERS.getBlocksByDate(ERS.today()).length, 'Prioridade sobre reservas']
        ];
        host.innerHTML = metrics.map(([iconName, label, value, note]) => '<article class="coord-metric"><span class="coord-metric-icon">' + icon(iconName) + '</span><p>' + label + '</p><strong>' + value + '</strong><small>' + note + '</small></article>').join('');
    }
    function chrome() {
        if($('#sidebar'))window.AUTH?.adaptSidebarByRole(ERS.getSession());
        const main=$('main');if(main){main.id=main.id||'main-content';main.tabIndex=-1;document.body.insertAdjacentHTML('afterbegin',`<a class="skip-link" href="#${main.id}">Pular para o conteúdo</a>`);}
        const wrapper=$('.main-wrapper');
        if(wrapper){wrapper.insertAdjacentHTML('afterbegin',`<header class="v2-topbar"><div class="v2-topbar-brand"><button class="v2-mobile-menu" id="v2-mobile-menu" aria-label="Abrir menu de navegação">${icon('menu')}</button><span class="v2-logo">${icon('school')}</span>Alceu Reservas</div><div class="v2-topbar-note"><span>Gestão de salas e notebooks</span><a href="../index.html" id="v2-switch">Trocar perfil</a></div></header>`);$('#v2-switch').textContent='Sair';$('#v2-switch').onclick=async e=>{e.preventDefault();if(await ERS.logout())location.assign('../index.html');};$('#v2-mobile-menu').onclick=e=>{e.stopPropagation();$('#sidebar').classList.toggle('open');$('#sidebarBackdrop')?.classList.toggle('active');};}
        if(main&&!teacherAgenda&&!document.body.classList.contains('login-page'))main.insertAdjacentHTML('beforeend','<footer class="v2-version-footer"><span>Alceu Reservas · Gestão de recursos escolares</span><span>Salas e equipamentos</span></footer>');
        if (location.pathname.endsWith('/proatec.html')) {
            $('.dashboard-header')?.insertAdjacentHTML('afterend', '<section id="coord-overview" class="coord-overview" aria-label="Resumo de hoje"></section>');
            const todayList = $('#today-reservations-list');
            if (todayList) new MutationObserver(refreshCoordination).observe(todayList, {childList:true});
        }
        const registration=$('#register-students-modal .modal-body');if(registration)registration.insertAdjacentHTML('afterbegin','<p class="v2-student-note">Associe cada notebook ao aluno que o utiliza. Os registros ficam disponíveis para você e para a coordenação.</p>');
    }
    window.addEventListener('ers:reservations-updated', () => {
        if (teacherAgenda && typeof renderCalendar === 'function') { renderCalendar(); renderMyReservations(); renderActiveChip(); }
        else { window.ProatecModule?.render(); window.AgendaProatecModule?.render(); window.RelatorioModule?.render(); }
        window.SalasModule?.render(); window.EquipamentosModule?.render(); window.BloqueiosModule?.render();
        refreshCoordination();
    });
    window.addEventListener('storage', event => {
        const key = window.ERS_DEMO && event.key?.startsWith('alceu_demo:') ? event.key.slice('alceu_demo:'.length) : event.key;
        if (['ers_reservations', 'ers_notebooks', 'ers_blocks'].includes(key)) {
            window.dispatchEvent(new Event('ers:reservations-updated'));
        }
    });
    document.addEventListener(window.ERS_REAL && location.pathname.includes('/pages/') ? 'ers:ready' : 'DOMContentLoaded',()=>{chrome();setupAgenda();myReservations();decorate();watchModals();refreshCoordination();new MutationObserver(queueDecorate).observe(document.body,{childList:true,subtree:true,characterData:true});});
})();
