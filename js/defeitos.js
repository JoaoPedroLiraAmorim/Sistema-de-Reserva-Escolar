/* Relatos por etiqueta, separados do controle de quantidades do estoque. */
(function () {
    'use strict';
    const demoKey = 'alceu_demo:ers_defects';
    const tag = value => String(value || '').trim().toLocaleLowerCase('pt-BR');
    let detailReservation = null;
    let reportReservation = null;
    let reportGeneration = 0;
    let initialized = false;
    let lastReportsMarkup = null;
    const escape = value => ERS.escapeHtml(String(value || ''));
    const dateTime = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

    function getReports() {
        if (window.ERS_REAL) return window.ERS_DATA?.defects || [];
        try { return JSON.parse(localStorage.getItem(demoKey)) || []; } catch { return []; }
    }
    function reportsFor(id) { return getReports().filter(d => d.reservaId === id); }
    function canReport(r) {
        const now = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
        return r && ERS.getSession()?.role === 'professor' && r.professorId === ERS.getSession()?.userId &&
            r.situacao === 'confirmada' && !ERS.isReservationBlocked(r) && r.notebooks > 0 && r.data === now.slice(0, 10) && r.inicio <= now.slice(11) && r.fim > now.slice(11);
    }
    function saveDemo(reports) {
        localStorage.setItem(demoKey, JSON.stringify(reports));
        window.dispatchEvent(new Event('ers:reservations-updated'));
    }
    function installDemoActions() {
        if (!window.ERS_DEMO) return;
        ERS.reportNotebookDefect = async data => {
            const r = ERS.getReservations().find(r => r.id === data.reservaId);
            if (!canReport(r)) return { ok: false, message: 'Reporte defeitos durante o horário de sua reserva com notebooks.' };
            const etiqueta = data.etiqueta.trim(), descricao = data.descricao.trim();
            if (!etiqueta || etiqueta.length > 100 || !descricao || descricao.length > 2000) return { ok: false, message: 'Informe uma etiqueta e uma descrição válidas.' };
            if (reportsFor(r.id).some(d => tag(d.etiqueta) === tag(etiqueta))) return { ok: false, message: 'Já existe um relato para esta etiqueta nesta reserva.' };
            const aluno = (r.alunosNotebooks || []).find(a => tag(a.etiqueta) === tag(etiqueta))?.aluno || '';
            saveDemo([...getReports(), { id: crypto.randomUUID(), reservaId: r.id, professorId: r.professorId, professorNome: r.professorNome,
                etiqueta, descricao, aluno, criadoEm: new Date().toISOString(), lidoEm: null, data: r.data, inicio: r.inicio, fim: r.fim, turma: r.turma, marca: r.marca, sala: r.sala }]);
            return { ok: true };
        };
        ERS.markDefectRead = async id => {
            if (ERS.getSession()?.role !== 'coordenacao') return { ok: false, message: 'Apenas a coordenação pode marcar relatos como lidos.' };
            const reports = getReports(), report = reports.find(d => d.id === id);
            if (!report) return { ok: false, message: 'Relato não encontrado.' };
            report.lidoEm ||= new Date().toISOString(); saveDemo(reports); return { ok: true };
        };
    }
    function reportMarkup(d) {
        const r = ERS.getReservations().find(r => r.id === d.reservaId);
        const aluno = r?.alunosNotebooks?.find(a => tag(a.etiqueta) === tag(d.etiqueta))?.aluno || d.aluno;
        return `<article class="defect-report"><div class="defect-heading"><strong>Notebook ${escape(d.etiqueta)}</strong><span class="badge ${d.lidoEm ? 'badge-neutral' : 'badge-warning'}">${d.lidoEm ? 'Lido' : 'Novo relato'}</span></div>
            <p class="defect-description">${escape(d.descricao)}</p>
            <p>${escape(d.professorNome)} · ${escape(ERS.formatDate(d.data))} · ${escape(d.inicio)}–${escape(d.fim)}</p>
            ${aluno ? `<p class="defect-warning">Defeito reportado neste notebook · aluno vinculado: ${escape(aluno)}</p>` : ''}
            <p class="defect-timestamp">Reportado em ${escape(dateTime(d.criadoEm))}${d.lidoEm ? ' · Lido em ' + escape(dateTime(d.lidoEm)) : ''}</p>
            ${ERS.getSession()?.role === 'coordenacao' && !d.lidoEm ? `<button class="btn-secondary" type="button" data-read-defect="${escape(d.id)}">Marcar como lido</button>` : ''}</article>`;
    }
    function renderDetail(r) {
        detailReservation = r;
        const footer = document.querySelector('#res-detail-modal .modal-footer');
        if (!footer) return;
        let button = document.getElementById('btn-report-defect');
        if (!button) {
            button = document.createElement('button'); button.id = 'btn-report-defect'; button.type = 'button'; button.className = 'btn-secondary'; button.textContent = 'Reportar defeito';
            button.onclick = () => openReport(detailReservation); footer.prepend(button);
        }
        button.hidden = !canReport(r);
        document.getElementById('reservation-defect-reports')?.remove();
        const reports = reportsFor(r.id);
        if (reports.length) {
            const section = document.createElement('section'); section.id = 'reservation-defect-reports'; section.className = 'defect-detail';
            section.innerHTML = '<h4>Defeitos reportados</h4>' + reports.map(reportMarkup).join(''); document.getElementById('res-detail-body').append(section);
        }
    }
    function openReport(r) {
        if (!canReport(r)) { ERS.showToast('Reporte defeitos durante o horário de sua reserva com notebooks.', 'warning'); return; }
        reportReservation = r;
        reportGeneration++;
        const form = document.getElementById('report-defect-form'); form.reset();
        form.querySelector('[type="submit"]').disabled = false;
        document.getElementById('report-defect-error').hidden = true;
        document.getElementById('report-defect-context').textContent = `${ERS.formatDate(r.data)} · ${r.inicio}–${r.fim}`;
        closeModal('res-detail-modal'); openModal('report-defect-modal'); document.getElementById('defect-tag').focus();
    }
    function closeReport() {
        reportGeneration++;
        closeModal('report-defect-modal');
        if (reportReservation) {
            openReservationDetail(reportReservation.id);
            requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('btn-report-defect')?.focus()));
        }
    }
    function renderAssignmentWarnings() {
        const modal = document.getElementById('register-students-modal');
        if (!modal) return;
        const reports = reportsFor(modal.dataset.reservaId);
        modal.querySelectorAll('.student-row').forEach(row => {
            const input = row.querySelector('.input-etiqueta'); if (!input) return;
            let warning = row.querySelector('.defect-assignment-warning');
            if (!warning) { warning = document.createElement('p'); warning.className = 'defect-warning defect-assignment-warning'; warning.setAttribute('role', 'status'); input.parentElement.append(warning); }
            const found = reports.some(d => tag(d.etiqueta) === tag(input.value));
            const text = found ? 'Defeito reportado neste notebook.' : '';
            if (warning.textContent !== text) warning.textContent = text;
            warning.hidden = !found;
            if (!warning.id) warning.id = 'defect-warning-' + crypto.randomUUID();
            if (found) input.setAttribute('aria-describedby', warning.id); else input.removeAttribute('aria-describedby');
        });
    }
    function renderRecordWarnings() {
        const table = document.getElementById('records-table-container');
        if (!table) return;
        const id = table.dataset.reservaId;
        const reports = reportsFor(id);
        table.querySelectorAll('tbody tr').forEach(row => {
            const label = row.querySelector('.record-tag-badge strong');
            if (!label || !reports.some(d => tag(d.etiqueta) === tag(label.textContent)) || row.querySelector('.defect-warning')) return;
            const warning = document.createElement('p'); warning.className = 'defect-warning'; warning.textContent = 'Defeito reportado neste notebook.'; label.closest('td').append(warning);
        });
    }
    function updateBadges() {
        if (ERS.getSession()?.role !== 'coordenacao') return;
        const count = getReports().filter(d => !d.lidoEm).length;
        document.querySelectorAll('[data-defect-count]').forEach(el => { el.textContent = String(count); el.hidden = count === 0; });
        document.querySelectorAll('.sidebar-nav a[data-page="relatorio"]').forEach(link => {
            let badge = link.querySelector('[data-defect-count]');
            if (!badge) { badge = document.createElement('span'); badge.className = 'defect-count'; badge.dataset.defectCount = ''; link.append(badge); }
            badge.textContent = String(count); badge.hidden = count === 0;
            link.setAttribute('aria-label', count ? `Relatórios, ${count} defeito${count === 1 ? '' : 's'} reportado${count === 1 ? '' : 's'} não lido${count === 1 ? '' : 's'}` : 'Relatórios');
        });
    }
    function setTab(tab) {
        document.querySelectorAll('[data-report-tab]').forEach(b => { const selected = b.dataset.reportTab === tab; b.setAttribute('aria-pressed', String(selected)); b.classList.toggle('active', selected); });
        document.getElementById('report-reservations-panel').hidden = tab !== 'reservas';
        document.getElementById('report-defects-panel').hidden = tab !== 'defeitos';
        document.querySelector('.reports-filter-group').hidden = tab === 'defeitos';
        renderReports();
    }
    function renderReports() {
        const list = document.getElementById('defects-list');
        if (!list) return;
        const reports = getReports().slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
        const markup = reports.length ? reports.map(reportMarkup).join('') : '<p class="defect-empty">Nenhum defeito reportado.</p>';
        if (lastReportsMarkup !== markup) { list.innerHTML = markup; lastReportsMarkup = markup; }
        updateBadges();
    }
    async function markRead(button) {
        button.disabled = true;
        const result = await ERS.markDefectRead(button.dataset.readDefect);
        if (!result.ok) { button.disabled = false; ERS.showToast(result.message, 'error'); return; }
        renderReports(); updateBadges();
        const target = document.querySelector('#defects-list [data-read-defect]') || document.querySelector('[data-report-tab="defeitos"]');
        target?.focus();
    }
    function init() {
        if (initialized) return; initialized = true;
        installDemoActions();
        if (document.getElementById('res-detail-modal')) {
            document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop hidden" id="report-defect-modal" role="dialog" aria-modal="true" aria-labelledby="report-defect-title"><div class="modal">
                <div class="modal-header"><div><h3 id="report-defect-title">Reportar defeito</h3><p id="report-defect-context"></p></div><button type="button" class="btn-close" aria-label="Fechar relato de defeito"><span class="material-symbols-outlined">close</span></button></div>
                <form id="report-defect-form"><div class="modal-body"><label for="defect-tag">Número da etiqueta</label><input class="form-control" id="defect-tag" name="etiqueta" required maxlength="100" autocomplete="off"><label for="defect-description">Descrição do defeito</label><textarea class="form-control" id="defect-description" name="descricao" required maxlength="2000" rows="4"></textarea><p id="report-defect-error" class="defect-warning" role="alert" hidden></p></div><div class="modal-footer"><button type="submit" class="btn-primary">Enviar relato</button></div></form></div></div>`);
            const modal = document.getElementById('report-defect-modal');
            modal.querySelector('.btn-close').onclick = closeReport;
            modal.addEventListener('click', e => { if (e.target === modal) modal.querySelector('.btn-close').click(); });
            document.getElementById('report-defect-form').addEventListener('submit', async e => {
                e.preventDefault(); const button = e.target.querySelector('[type="submit"]'); button.disabled = true;
                const reservation = reportReservation, generation = reportGeneration;
                try {
                    const result = await ERS.reportNotebookDefect({ reservaId: reservation.id, etiqueta: document.getElementById('defect-tag').value, descricao: document.getElementById('defect-description').value });
                    if (generation !== reportGeneration || modal.classList.contains('hidden')) return;
                    if (!result.ok) { const error = document.getElementById('report-defect-error'); error.textContent = result.message; error.hidden = false; return; }
                    closeModal(modal.id); ERS.showToast('Defeito reportado à coordenação.', 'success'); openReservationDetail(reservation.id);
                } catch { if (generation === reportGeneration && !modal.classList.contains('hidden')) { const error = document.getElementById('report-defect-error'); error.textContent = 'Não foi possível enviar o relato. Tente novamente.'; error.hidden = false; } }
                finally { if (generation === reportGeneration) button.disabled = false; }
            });
            const rows = document.getElementById('student-rows-body');
            if (rows) { rows.addEventListener('input', renderAssignmentWarnings); new MutationObserver(renderAssignmentWarnings).observe(rows, { childList: true }); }
        }
        document.querySelectorAll('[data-report-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.reportTab)));
        document.addEventListener('click', e => { const button = e.target.closest('[data-read-defect]'); if (button) markRead(button); });
        const records = document.getElementById('records-table-container');
        if (records) new MutationObserver(renderRecordWarnings).observe(records, { childList: true });
        renderReports(); updateBadges();
    }
    window.Defeitos = { renderDetail, renderAssignmentWarnings, renderRecordWarnings, getReports, reportsFor, closeReport };
    document.addEventListener('ers:ready', init);
    window.addEventListener('ers:reservations-updated', () => {
        if (!initialized) return;
        updateBadges(); renderReports(); renderAssignmentWarnings(); renderRecordWarnings();
        if (detailReservation && !document.getElementById('res-detail-modal')?.classList.contains('hidden')) {
            const current = ERS.getReservations().find(r => r.id === detailReservation.id); if (current) renderDetail(current);
        }
    });
    window.addEventListener('storage', e => { if (e.key === demoKey) { updateBadges(); renderReports(); } });
})();
