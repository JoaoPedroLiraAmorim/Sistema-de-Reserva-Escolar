/* Melhoria progressiva: mantém os módulos e fluxos do projeto original. */
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
    let previousModalFocus;
    function watchModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => {
            if(modalStates.has(m))return;
            modalStates.set(m,false);
            const update=()=>{
                const visible=!m.classList.contains('hidden');
                const was=modalStates.get(m);modalStates.set(m,visible);
                const inner=m.querySelector('.modal');
                if(inner){inner.setAttribute('role','dialog');inner.setAttribute('aria-modal','true');const h=inner.querySelector('h3');if(h){if(!h.id)h.id=m.id+'-title';inner.setAttribute('aria-labelledby',h.id);}}
                if(visible&&!was){previousModalFocus=document.activeElement;requestAnimationFrame(()=>{const focus=m.querySelector('input:not([type=hidden]),select,button');focus?.focus();});if(m.id==='new-reservation-modal'){prepareReservation();}}
                if(!visible&&was){if(m.id==='new-reservation-modal')clearReview();if(previousModalFocus?.isConnected)previousModalFocus.focus();}
                document.body.style.overflow=document.querySelector('.modal-backdrop:not(.hidden)')?'hidden':'';
            };
            new MutationObserver(update).observe(m,{attributes:true,attributeFilter:['class']});update();
        });
    }
    document.addEventListener('keydown',e=>{
        const modals=[...document.querySelectorAll('.modal-backdrop:not(.hidden)')];const modal=modals.at(-1);if(!modal)return;
        if(e.key==='Tab'){
            const focus=[...modal.querySelectorAll('button:not(:disabled),a[href],input:not([type=hidden]),select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);
            if(!focus.length)return;
            if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus();}
            else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus();}
        }
        if(e.key==='Escape'&&modal.id!=='system-confirm-modal'){e.preventDefault();e.stopImmediatePropagation();window.closeModal?.(modal.id);}
    },true);

    const agendaBreakpoint = window.matchMedia('(max-width: 1100px)');
    let agendaMode = agendaBreakpoint.matches ? 'list' : 'grid';
    let agendaModeChosen = false;
    const teacherAgenda = location.pathname.endsWith('/professor.html');
    let selectedAgendaDay;
    const isTeacherDay = () => teacherAgenda && agendaMode === 'list';
    function moveAgendaDay(direction) {
        const date = new Date(selectedAgendaDay + 'T12:00:00');
        do { date.setDate(date.getDate() + direction); } while (date.getDay() === 0);
        selectedAgendaDay = ERS.dateKey(date);
        const days = [...document.querySelectorAll('#calendarHead th[data-date]')].map(el => el.dataset.date);
        if (!days.includes(selectedAgendaDay)) {
            $(direction < 0 ? '#btnPrevWeek' : '#btnNextWeek').click();
        }
        renderAgendaList();
    }
    function setupAgenda() {
        const table=$('#calendarTable');if(!table)return;
        const controls=$('.calendar-controls-bar');
        if (teacherAgenda) {
            controls.insertAdjacentHTML('afterbegin', `<div class="v2-day-nav" aria-label="Navegar pelos dias da agenda"><button type="button" id="v2-prev-day" aria-label="Dia anterior">${icon('left')}</button><h3 id="v2-selected-day" aria-live="polite" aria-atomic="true"></h3><button type="button" id="v2-next-day" aria-label="Próximo dia">${icon('right')}</button></div>`);
            $('#v2-prev-day').onclick = () => moveAgendaDay(-1);
            $('#v2-next-day').onclick = () => moveAgendaDay(1);
        }
        controls.insertAdjacentHTML('afterend',`<div class="v2-agenda-tools"><div class="v2-tool-group"><label>Sala <select id="v2-room-filter"><option value="">Todas as salas</option>${ERS.getRooms().map(r=>`<option>${esc(r.nome)}</option>`).join('')}</select></label>${location.pathname.includes('professor.html')?'<label><input type="checkbox" id="v2-only-mine">Minhas reservas</label>':''}</div><div class="v2-tool-group"><span id="v2-agenda-summary" class="v2-agenda-summary"></span><div class="v2-segment" aria-label="Visualização da agenda"><button type="button" data-agenda-mode="grid" aria-pressed="${agendaMode==='grid'}">${icon('grid')}Semana</button><button type="button" data-agenda-mode="list" aria-pressed="${agendaMode==='list'}">${icon('list')}Lista</button></div></div></div>`);
        const wrapper=$('.calendar-wrapper-card');wrapper.insertAdjacentHTML('afterend','<div id="v2-day-list" class="v2-day-list"></div><div class="v2-calendar-legend"><span><i></i>Minha reserva</span><span><i class="other"></i>Outra reserva</span><span><i class="block"></i>Período bloqueado</span></div>');
        $('#v2-room-filter').onchange=renderAgendaList;$('#v2-only-mine')?.addEventListener('change',renderAgendaList);
        const todayButton = document.createElement('button');
        todayButton.type = 'button'; todayButton.className = 'v2-today'; todayButton.textContent = 'Hoje';
        todayButton.onclick = () => {
            selectedAgendaDay = ERS.today();
            const days = [...document.querySelectorAll('#calendarHead th[data-date]')].map(el => el.dataset.date);
            const monday = ERS.dateKey(ERS.getMonday(new Date()));
            const delta = Math.round((new Date(monday + 'T12:00:00') - new Date(days[0] + 'T12:00:00')) / 604800000);
            for (let i = 0; i < Math.abs(delta); i++) $(delta > 0 ? '#btnNextWeek' : '#btnPrevWeek').click();
            renderAgendaList();
        };
        $('.v2-tool-group:last-child').prepend(todayButton);
        document.querySelectorAll('[data-agenda-mode]').forEach(b=>b.onclick=()=>{agendaModeChosen=true;agendaMode=b.dataset.agendaMode;renderAgendaList();});
        const syncAgendaMode = event => {
            if (!agendaModeChosen) agendaMode = event.matches ? 'list' : 'grid';
            renderAgendaList();
        };
        if (agendaBreakpoint.addEventListener) agendaBreakpoint.addEventListener('change', syncAgendaMode);
        else agendaBreakpoint.addListener(syncAgendaMode);
        new MutationObserver(()=>{decorate();enhanceCells();renderAgendaList();}).observe(table,{childList:true,subtree:true});enhanceCells();renderAgendaList();
    }
    function enhanceCells() {
        document.querySelectorAll('#calendarBody td[data-date]').forEach(td=>{
            const cards=td.querySelectorAll('.calendar-event-card');
            cards.forEach(card=>{
                const reservation=ERS.getReservations().find(r=>r.id===card.dataset.resId);
                if(reservation){const desc=card.querySelector('.event-desc');const value=reservation.notebooks?`${reservation.notebooks} notebooks${reservation.marca&&reservation.marca!=='Qualquer marca'?' · '+reservation.marca:''}`:'Somente sala';if(desc&&desc.textContent!==value)desc.textContent=value;card.classList.toggle('v2-no-room',!reservation.sala);card.title=`${reservation.inicio}–${reservation.fim} · ${reservation.professorNome} · ${value} · ${reservation.sala||'Sem sala'}${reservation.turma?' · '+reservation.turma:''}`;}
                if(!card.querySelector('.v2-event-time')){const r=ERS.getReservations().find(r=>r.id===card.dataset.resId);if(r)card.insertAdjacentHTML('afterbegin',`<span class="v2-event-time">${r.inicio}–${r.fim}</span>`);}
            });
            if(!cards.length&&!td.querySelector('.event-block')&&!td.querySelector('.v2-cell-action')&&
                (td.dataset.date>ERS.today()||(td.dataset.date===ERS.today()&&td.dataset.start>ERS.getCurrentTime()))){
                const b=document.createElement('button');b.type='button';b.className='v2-cell-action';b.textContent=cards.length?'＋ Reservar mais':'＋ Reservar';b.setAttribute('aria-label',`Reservar em ${ERS.formatDate(td.dataset.date)} às ${td.dataset.start}`);b.onclick=()=>quickReserve(td.dataset.date,td.dataset.start,td.dataset.end);td.append(b);
            }
        });
    }
    function compactCalendarCells() {
        document.querySelectorAll('#calendarBody .calendar-events-container').forEach(container => {
            const cards = [...container.querySelectorAll('.calendar-event-card')].filter(c => !c.hidden);
            cards.forEach((card, index) => card.classList.toggle('v2-overflow-card', index >= 2));
            let button = container.querySelector('.v2-more-events');
            if (cards.length <= 2) { button?.remove(); container.classList.remove('v2-expanded'); return; }
            if (!button) {
                button = document.createElement('button'); button.type = 'button'; button.className = 'v2-more-events';
                button.onclick = () => { container.classList.toggle('v2-expanded'); update(); };
                container.append(button);
            }
            function update() {
                const expanded = container.classList.contains('v2-expanded');
                const label = expanded ? 'Recolher reservas' : `+${cards.length - 2} reserva(s) · ver todas`;
                if (button.textContent !== label) button.textContent = label;
                button.setAttribute('aria-expanded', String(expanded));
            }
            // Rebind after filters change so the count always matches visible cards.
            button.onclick = () => { container.classList.toggle('v2-expanded'); update(); };
            update();
        });
    }
    function quickReserve(date,start,end) {
        $('#btnOpenNewReservation').click();$('#res-date').value=date;$('#res-start').value=start;$('#res-end').value=end;availability();
    }
    function renderDailySlots(section, date, room, mine) {
        const list = section.querySelector('.v2-list-items');
        list.innerHTML = '';
        const slots = ERS.SHIFT_SLOTS[$('.shift-btn.active')?.dataset.shift || 'manha'];
        const reservations = ERS.getReservationsByDate(date);
        const blocks = ERS.getBlocks().filter(b => b.data === date);
        slots.forEach(slot => {
            const block = blocks.find(b => ERS.timesOverlap(slot.start, slot.end, b.inicio, b.fim));
            const active = reservations.filter(r => ERS.timesOverlap(slot.start, slot.end, r.inicio, r.fim));
            if (mine && !active.some(r => r.professorId === ERS.getSession()?.userId)) return;
            const past = date < ERS.today() || (date === ERS.today() && slot.start <= ERS.getCurrentTime());
            const notebooks = ERS.getAvailability({data:date, inicio:slot.start, fim:slot.end});
            const rooms = ERS.getActiveRooms().filter(r => (!room || r.nome === room) && !active.some(a => a.sala === r.nome));
            const available = !block && !past && (room ? rooms.length > 0 : notebooks > 0 || rooms.length > 0);
            const item = document.createElement('section');
            item.className = 'day-slot' + (block ? ' day-slot-blocked' : '');
            item.innerHTML = `<div class="day-slot-time"><strong>${slot.start}</strong><span>até ${slot.end}</span></div><div class="day-slot-info"><span class="slot-status">${block ? 'Bloqueado pela coordenação' : past ? 'Horário iniciado ou encerrado' : available ? 'Disponível para reservar' : 'Recursos ocupados'}</span><p>${block ? esc(block.motivo) : `${notebooks} notebooks livres · ${rooms.length} sala${rooms.length === 1 ? '' : 's'} livre${rooms.length === 1 ? '' : 's'}`}</p></div>`;
            if (available) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'btn-secondary day-slot-book'; button.textContent = 'Reservar';
                button.setAttribute('aria-label', `Reservar em ${ERS.formatDate(date)} às ${slot.start}`);
                button.onclick = () => {
                    quickReserve(date, slot.start, slot.end);
                    if (room) queueMicrotask(() => {
                        const choice = $('[name="resource-type"][value="sala"]');
                        choice.checked = true; choice.dispatchEvent(new Event('change', {bubbles:true}));
                        $('#res-room').value = room; availability();
                    });
                };
                item.append(button);
            }
            const visibleReservations = active.filter(r => (!room || r.sala === room) && (!mine || r.professorId === ERS.getSession()?.userId));
            if (!block && visibleReservations.length) {
                const details = document.createElement('details'); details.className = 'day-slot-reservations';
                const summary = document.createElement('summary');
                summary.textContent = `${visibleReservations.length} reserva(s) neste horário`;
                details.append(summary);
                visibleReservations.forEach(r => {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'day-reservation-link';
                    button.textContent = `${r.professorId === ERS.getSession()?.userId ? 'Sua reserva' : r.professorNome} · ${r.notebooks || 0} notebooks${r.sala ? ' · ' + r.sala : ''}`;
                    button.onclick = () => window.openReservationDetail(r.id); details.append(button);
                });
                item.append(details);
            }
            list.append(item);
        });
        if (!list.children.length) list.innerHTML = '<p class="v2-day-empty">Você não tem reservas neste dia e turno.</p>';
    }
    function renderAgendaList() {
        const host=$('#v2-day-list');if(!host)return;
        const room=$('#v2-room-filter').value;const mine=$('#v2-only-mine')?.checked;const session=ERS.getSession();
        const days=[...document.querySelectorAll('#calendarHead th[data-date]')].map(el=>el.dataset.date);
        const daily = isTeacherDay();
        if (!days.includes(selectedAgendaDay)) selectedAgendaDay = days.includes(ERS.today()) ? ERS.today() : days[0];
        document.body.classList.toggle('v2-teacher-day', daily);
        if (teacherAgenda && selectedAgendaDay) {
            $('#v2-selected-day').textContent = new Date(selectedAgendaDay + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'short', year:'numeric'});
        }
        host.innerHTML='';let count=0;
        days.forEach(date=>{
            const seen=new Set(),clones=[];
            document.querySelectorAll(`#calendarBody td[data-date="${date}"] .calendar-event-card`).forEach(card=>{
                const r=ERS.getReservations().find(r=>r.id===card.dataset.resId);
                const match=(card.classList.contains('event-block')||(!room||r?.sala===room)&&(!mine||r?.professorId===session?.userId));
                card.hidden=!match;
                const key=card.dataset.resId||card.dataset.blkId||card.textContent;
                if(match&&!seen.has(key)){seen.add(key);clones.push(card.cloneNode(true));if(r&&(!daily||date===selectedAgendaDay))count++;}
            });
            if (daily && date !== selectedAgendaDay) return;
            const section=document.createElement('section');section.className='v2-day-section';section.innerHTML=`<h3>${new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</h3><div class="v2-list-items"></div>`;
            const list=section.querySelector('.v2-list-items');
            const groups = new Map();
            clones.forEach(c=>{
                c.hidden=false;c.classList.remove('v2-overflow-card');c.removeAttribute('data-keyboard');
                const reservation = ERS.getReservations().find(r=>r.id===c.dataset.resId);
                if (reservation?.turma && c.querySelector('.event-desc')) c.querySelector('.event-desc').textContent += ` · ${reservation.turma}`;
                const block = ERS.getBlocks().find(b=>b.id===c.dataset.blkId);
                const time = reservation ? `${reservation.inicio}–${reservation.fim}` : block ? `${block.inicio}–${block.fim}` : c.querySelector('.event-room')?.textContent.match(/\d{2}:\d{2}–\d{2}:\d{2}/)?.[0] || 'Bloqueio';
                const key = `${reservation?'reservation':'block'}-${time}`;
                if (!groups.has(key)) groups.set(key,{time,cards:[],notebooks:0,reservation:!!reservation});
                const group = groups.get(key);group.cards.push(c);group.notebooks += reservation?.notebooks || 0;
            });
            [...groups.values()].sort((a,b)=>a.time.localeCompare(b.time)).forEach(group=>{
                const item=document.createElement('section');item.className='v2-time-group';
                item.innerHTML=`<header class="v2-time-heading"><h4>${esc(group.time)}</h4><span>${group.reservation ? `${group.cards.length} reserva${group.cards.length===1?'':'s'} · ${group.notebooks} notebooks` : 'Período bloqueado'}</span></header><div class="v2-time-rows"></div>`;
                group.cards.forEach(c=>item.querySelector('.v2-time-rows').append(c));list.append(item);
            });
                if(!clones.length)list.innerHTML='<p class="v2-day-empty">Nenhuma reserva ou bloqueio para este filtro e turno.</p>';
            if (daily) renderDailySlots(section, date, room, mine);
            else if(date>=ERS.today()){const b=document.createElement('button');b.type='button';b.className='v2-cell-action';b.textContent='＋ Nova reserva neste dia';b.onclick=()=>{const slot=ERS.SHIFT_SLOTS[$('.shift-btn.active')?.dataset.shift||'manha'][0];quickReserve(date,slot.start,slot.end);};section.append(b);}
            host.append(section);
        });
        $('.calendar-wrapper-card').hidden=daily||agendaMode!=='grid';host.hidden=!daily&&agendaMode!=='list';$('#v2-agenda-summary').textContent=`${count} reserva${count===1?'':'s'} ${daily?'neste dia e turno':'no turno'}`;
        document.querySelectorAll('[data-agenda-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.agendaMode===agendaMode));compactCalendarCells();decorate();
    }
    function availability() {
        const el=$('#avail-info');if(!el)return;el.classList.add('v2-availability');
        const val=id=>$('#'+id)?.value;
        const date=val('res-date'),start=val('res-start'),end=val('res-end');
        const free=date&&start&&end&&start<end?ERS.getAvailability({data:date,inicio:start,fim:end,marca:val('res-brand')}):null;
        const requested=Number(val('res-quantity'))||0;
        const conflict = free === null ? {ok:true} : ERS.checkConflicts({data:date,inicio:start,fim:end,sala:val('res-room'),notebooks:requested,marca:val('res-brand')});
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
            $('#v2-res-shift').onchange=e=>{document.querySelector(`.shift-btn[data-shift="${e.target.value}"]`)?.click();availability();};
        }
        $('#v2-res-shift').value=$('.shift-btn.active')?.dataset.shift||'manha';
        if (!form.dataset.organized) {
            form.dataset.organized = 'true';
            const dateGroup = $('#res-date').closest('.form-group');
            const timeRow = $('#res-start').closest('.form-row');
            const roomGroup = $('#res-room').closest('.form-group');
            const notebooksRow = $('#res-brand').closest('.form-row');
            const when = document.createElement('fieldset'); when.className = 'booking-section';
            when.innerHTML = '<legend><span>01</span> Quando será a aula?</legend>';
            when.append($('#v2-res-shift').parentElement, dateGroup, timeRow);
            const resources = document.createElement('fieldset'); resources.className = 'booking-section';
            resources.innerHTML = '<legend><span>02</span> Quais recursos você precisa?</legend><div class="resource-choices"><label><input type="radio" name="resource-type" value="notebooks" checked><span>Notebooks</span></label><label><input type="radio" name="resource-type" value="sala"><span>Uma sala</span></label><label><input type="radio" name="resource-type" value="ambos"><span>Os dois</span></label></div>';
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
            form.addEventListener('reset', () => requestAnimationFrame(resourceMode));
            resourceMode();
        }
        form.querySelector('button[type=submit]').textContent='Revisar reserva';
        $('#res-error').setAttribute('role','alert');availability();
    }
    function clearReview(){const f=$('#new-reservation-form');f?.classList.remove('v2-reviewing');$('#v2-review')?.remove();}
    document.addEventListener('input',e=>{if(e.target.closest('#new-reservation-form'))availability();});
    document.addEventListener('change',e=>{if(e.target.closest('#new-reservation-form'))availability();});
    document.addEventListener('submit',e=>{
        const form=e.target;if(form.id!=='new-reservation-form'||form.dataset.approved==='true')return;
        e.preventDefault();e.stopImmediatePropagation();
        const v=id=>$('#'+id)?.value||'';
        const data={data:v('res-date'),inicio:v('res-start'),fim:v('res-end'),sala:v('res-room'),marca:v('res-brand'),notebooks:Number(v('res-quantity'))};
        let error=(!data.sala&&!data.notebooks?'Escolha uma sala ou informe a quantidade de notebooks.':'');
        if (data.data < ERS.today() || (data.data === ERS.today() && data.inicio <= ERS.getCurrentTime())) error = 'Escolha uma data e um horário futuros.';
        if(!error){const c=ERS.checkConflicts(data);if(!c.ok)error=c.message;}
        if(error){$('#res-error').textContent=error;$('#res-error').style.display='block';$('#res-error').scrollIntoView({block:'nearest'});return;}
        $('#res-error').style.display='none';clearReview();form.classList.add('v2-reviewing');
        form.querySelector('.modal-body').insertAdjacentHTML('beforeend',`<section id="v2-review" class="v2-preview" tabindex="-1"><h4>Confira antes de reservar</h4><dl>${$('#res-professor') ? `<dt>Professor</dt><dd>${esc($('#res-professor').selectedOptions[0]?.textContent || '')}</dd>` : ''}<dt>Data</dt><dd>${ERS.formatDate(data.data)}</dd><dt>Horário</dt><dd>${data.inicio}–${data.fim}</dd><dt>Sala</dt><dd>${esc(data.sala||'Não solicitada')}</dd><dt>Notebooks</dt><dd>${data.notebooks ? data.notebooks + ' · ' + esc(data.marca||'Qualquer marca') : 'Não solicitados'}</dd></dl><div class="modal-footer"><button type="button" class="btn-secondary" id="v2-edit-res">Editar</button><button type="button" class="btn-primary" id="v2-confirm-res">Confirmar reserva</button></div></section>`);
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
            $('#mobileAgendaBtn')?.classList.toggle('active', !reservations);
            $('#mobileMyResBtn')?.classList.toggle('active', reservations);
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
                $('.teacher-view-tabs').scrollIntoView({block:'start', behavior:'smooth'});
            });
        });
        select('agenda');
    }
    function refreshCoordination() {
        const host = $('#coord-overview'); if (!host) return;
        const reservations = ERS.getReservationsByDate(ERS.today());
        const pending = reservations.filter(r => r.notebooks > 0 && !r.retiradaConfirmada &&
            !ERS.getBlocks().some(b => b.data === r.data && ERS.timesOverlap(b.inicio,b.fim,r.inicio,r.fim))).length;
        const metrics = [
            ['calendar', 'Reservas hoje', reservations.length, 'Salas e notebooks'],
            ['inventory', 'Retiradas pendentes', pending, 'Para preparar a entrega'],
            ['laptop', 'Notebooks funcionando', ERS.getTotalDisponivel(), 'Estoque da escola'],
            ['block', 'Bloqueios hoje', ERS.getBlocks().filter(b => b.data === ERS.today()).length, 'Prioridade sobre reservas']
        ];
        host.innerHTML = metrics.map(([iconName, label, value, note]) => '<article class="coord-metric"><span class="coord-metric-icon">' + icon(iconName) + '</span><p>' + label + '</p><strong>' + value + '</strong><small>' + note + '</small></article>').join('');
    }
    function chrome() {
        if($('#sidebar'))window.AUTH?.adaptSidebarByRole(ERS.getSession());
        const main=$('main');if(main){main.id=main.id||'main-content';main.tabIndex=-1;document.body.insertAdjacentHTML('afterbegin',`<a class="skip-link" href="#${main.id}">Pular para o conteúdo</a>`);}
        const wrapper=$('.main-wrapper');
        if(wrapper){wrapper.insertAdjacentHTML('afterbegin',`<header class="v2-topbar"><div class="v2-topbar-brand"><button class="v2-mobile-menu" id="v2-mobile-menu" aria-label="Abrir menu de navegação">${icon('menu')}</button><span class="v2-logo">${icon('school')}</span>EduLab Reserve</div><div class="v2-topbar-note"><span>Gestão de salas e notebooks</span><a href="../index.html" id="v2-switch">Trocar perfil</a></div></header>`);$('#v2-switch').onclick=()=>ERS.logout();$('#v2-mobile-menu').onclick=e=>{e.stopPropagation();$('#sidebar').classList.toggle('open');$('#sidebarBackdrop')?.classList.toggle('active');};}
        if(main&&!document.body.classList.contains('login-page'))main.insertAdjacentHTML('beforeend','<footer class="v2-version-footer"><span>EduLab Reserve · Gestão de recursos escolares</span><span>Salas e equipamentos</span></footer>');
        if (location.pathname.endsWith('/proatec.html')) {
            $('.dashboard-header')?.insertAdjacentHTML('afterend', '<section id="coord-overview" class="coord-overview" aria-label="Resumo de hoje"></section>');
            const todayList = $('#today-reservations-list');
            if (todayList) new MutationObserver(refreshCoordination).observe(todayList, {childList:true});
        }
        const registration=$('#register-students-modal .modal-body');if(registration)registration.insertAdjacentHTML('afterbegin','<p class="v2-student-note">Associe cada notebook ao aluno que o utiliza. Os registros ficam disponíveis para a coordenação até o término da reserva.</p>');
    }
    window.addEventListener('ers:reservations-updated', () => {
        if (teacherAgenda && typeof renderCalendar === 'function') { renderCalendar(); renderMyReservations(); renderActiveChip(); }
        else { window.ProatecModule?.render(); window.AgendaProatecModule?.render(); window.RelatorioModule?.render(); }
        refreshCoordination();
    });
    window.addEventListener('storage', event => {
        if (['ers_reservations', 'ers_notebooks', 'ers_blocks'].includes(event.key)) {
            window.dispatchEvent(new Event('ers:reservations-updated'));
        }
    });
    document.addEventListener('DOMContentLoaded',()=>{chrome();setupAgenda();myReservations();decorate();watchModals();refreshCoordination();new MutationObserver(queueDecorate).observe(document.body,{childList:true,subtree:true,characterData:true});});
})();
