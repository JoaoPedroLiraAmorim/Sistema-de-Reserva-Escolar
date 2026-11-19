/* Cache em memória; todas as gravações são confirmadas pelo servidor. */
(function () {
    'use strict';
    if (window.ERS_DEMO) {
        const logout = ERS.logout;
        ERS.logout = () => { logout(); sessionStorage.removeItem('alceu_demo'); return true; };
        document.addEventListener('DOMContentLoaded', async () => {
            await ERS.ready;
            const session = ERS.getSession();
            if (!session) { location.replace('../index.html'); return; }
            const expected = document.body.classList.contains('teacher-page') ? 'professor' : 'coordenacao';
            if (session.role !== expected) { location.replace(session.role === 'professor' ? 'professor.html' : 'proatec.html'); return; }
            document.dispatchEvent(new Event('ers:ready'));
            const main = document.querySelector('.teacher-main-content, .dashboard-content');
            main?.insertAdjacentHTML('afterbegin', '<p class="demo-notice" role="status">Demonstração · dados fictícios salvos neste navegador.</p>');
            document.documentElement.classList.remove('app-loading');
        });
        return;
    }
    let refreshing;
    const pending = new Map();
    async function api(path, body) {
        const response = await fetch('/api/' + path, { cache: 'no-store', credentials: 'same-origin',
            ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
        const data = await response.json();
        if (response.status === 401) { location.replace('../index.html'); throw new Error('Sua sessão terminou. Entre novamente.'); }
        if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
        return data;
    }
    const status = document.createElement('div');
    status.className = 'app-status'; status.setAttribute('role', 'status'); status.textContent = 'Carregando seus dados…';
    document.body.append(status);
    function refresh(notify = true) {
        if (refreshing) return refreshing;
        refreshing = api('agenda/estado').then(data => {
            window.ERS_DATA = data; status.hidden = true;
            if (notify) window.dispatchEvent(new Event('ers:reservations-updated'));
        }).finally(() => { refreshing = null; });
        return refreshing;
    }
    function mutate(action, args) {
        const key = JSON.stringify([action, args]);
        if (pending.has(key)) return pending.get(key);
        const promise = (async () => {
            try {
                const { result } = await api('agenda/acao', { acao: action, args });
                if (refreshing) await refreshing.catch(() => {});
                try { await refresh(); }
                catch { status.textContent = 'Alteração salva. Recarregue para consultar os dados atualizados.'; status.hidden = false; }
                return result;
            } catch (error) { return { ok: false, message: error.message }; }
            finally { pending.delete(key); }
        })();
        pending.set(key, promise); return promise;
    }
    for (const action of ['createReservation', 'updateReservation', 'cancelReservation', 'confirmPickup', 'saveStudentAssignments', 'addRoom', 'toggleRoom', 'createBlock', 'deleteBlock', 'addNotebooks', 'registerNotebookDefect', 'registerNotebookAvailability']) {
        ERS[action] = (...args) => mutate(action, args);
    }
    for (const action of ['updateNotebookStatus', 'updateNotebookBrandCounts', 'deleteNotebookBrand', 'resetDemoData']) {
        ERS[action] = async () => ({ ok: false, message: 'Operação indisponível.' });
    }
    ERS.logout = async () => {
        try { await api('conta/sair', {}); window.ERS_DATA.session = null; return true; }
        catch (error) { ERS.showToast(error.message, 'error'); return false; }
    };
    ERS.refresh = refresh;
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await refresh(false);
            const expected = document.body.classList.contains('teacher-page') ? 'professor' : 'coordenacao';
            if (ERS.getSession().role !== expected) { location.replace(ERS.getSession().role === 'professor' ? 'professor.html' : 'proatec.html'); return; }
            document.dispatchEvent(new Event('ers:ready'));
            document.documentElement.classList.remove('app-loading');
            setInterval(() => {
                if (!document.hidden) refresh().catch(() => { status.textContent = 'Sem conexão para atualizar os dados. Tentaremos novamente.'; status.hidden = false; });
            }, 15000);
        } catch (error) {
            status.replaceChildren(document.createTextNode(error.message + ' '));
            const retry = document.createElement('button'); retry.textContent = 'Tentar novamente'; retry.className = 'btn-primary';
            retry.onclick = () => location.reload(); status.append(retry); status.hidden = false;
        }
    });
})();
