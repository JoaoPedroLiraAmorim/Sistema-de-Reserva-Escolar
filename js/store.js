/**
 * Sistema de Reserva Escolar — store.js
 * Módulo central de dados e lógica de negócio para demonstração local.
 * Usa LocalStorage para persistência entre sessões.
 */

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    //  CONSTANTES
    // ─────────────────────────────────────────────────────────────
    const KEYS = {
        USERS:        'ers_users',
        ROOMS:        'ers_rooms',
        NOTEBOOKS:    'ers_notebooks',
        RESERVATIONS: 'ers_reservations',
        BLOCKS:       'ers_blocks',
        SESSION:      'ers_session',
        SEEDED:       'ers_seeded',
    };

    // Horários disponíveis no sistema (fonte única de verdade)
    const TIME_SLOTS = [
        { start: '07:00', end: '07:50' },
        { start: '07:50', end: '08:40' },
        { start: '08:40', end: '09:30' },
        { start: '09:30', end: '10:20' },
        { start: '10:35', end: '11:25' },
        { start: '11:25', end: '12:15' },
        { start: '13:00', end: '13:50' },
        { start: '13:50', end: '14:40' },
        { start: '14:40', end: '15:30' },
        { start: '15:30', end: '16:20' },
        { start: '19:00', end: '19:50' },
        { start: '19:50', end: '20:40' },
        { start: '20:40', end: '21:30' },
    ];

    // Turnos derivados dos TIME_SLOTS (fonte única — elimina duplicação nos outros JS)
    const SHIFT_SLOTS = {
        manha: TIME_SLOTS.slice(0, 6),
        tarde: TIME_SLOTS.slice(6, 10),
        noite: TIME_SLOTS.slice(10),
    };

    // ─────────────────────────────────────────────────────────────
    //  UTILITÁRIOS
    // ─────────────────────────────────────────────────────────────
    function load(key) {
        try { return JSON.parse(localStorage.getItem(key)) || null; }
        catch { return null; }
    }

    function save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /** Formata Date → 'YYYY-MM-DD' */
    function dateKey(date) {
        if (typeof date === 'string') return date;
        const d = new Date(date);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    /** Retorna 'YYYY-MM-DD' para hoje */
    function today() { return dateKey(new Date()); }

    /** Retorna 'YYYY-MM-DD' para N dias a partir de hoje */
    function dayOffset(n) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return dateKey(d);
    }

    /** Compara horários: retorna true se [s1,e1) e [s2,e2) se sobrepõem */
    function timesOverlap(s1, e1, s2, e2) {
        return s1 < e2 && e1 > s2;
    }

    /** Escapa HTML para evitar XSS em inserções dinâmicas */
    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str || '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Hash SHA-256 assíncrono de uma string.
     * @returns {Promise<string>} hex digest
     */
    async function hashPassword(plain) {
        try {
            if (typeof crypto !== 'undefined' && crypto && crypto.subtle) {
                const encoder = new TextEncoder();
                const data = encoder.encode(plain);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            console.warn('Crypto subtle não disponível:', e);
        }
        if (plain === '123456') {
            return '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
        }
        return plain;
    }

    // ─────────────────────────────────────────────────────────────
    //  SEED INICIAL
    // ─────────────────────────────────────────────────────────────
    async function seed() {
        const h = await hashPassword('123456');

        if (load(KEYS.SEEDED)) {
            // Se já semeado, garante que a lista de usuários existe e tem as contas demo
            const currentUsers = load(KEYS.USERS);
            if (!currentUsers || !currentUsers.length) {
                save(KEYS.USERS, [
                    { id: 'u1', email: 'professor@demo.com',   password: '123456', passwordHash: h, role: 'professor',   nome: 'Prof. Marcelo',    avatarLetter: 'M' },
                    { id: 'u2', email: 'proatec@demo.com',     password: '123456', passwordHash: h, role: 'proatec',     nome: 'João Almeida',     avatarLetter: 'J' },
                    { id: 'u3', email: 'coordenacao@demo.com', password: '123456', passwordHash: h, role: 'coordenacao', nome: 'Dra. Sandra Lima',  avatarLetter: 'S' },
                ]);
            }
            return;
        }

        // Usuários
        save(KEYS.USERS, [
            { id: 'u1', email: 'professor@demo.com',   password: '123456', passwordHash: h, role: 'professor',   nome: 'Prof. Marcelo',    avatarLetter: 'M' },
            { id: 'u2', email: 'proatec@demo.com',     password: '123456', passwordHash: h, role: 'proatec',     nome: 'João Almeida',     avatarLetter: 'J' },
            { id: 'u3', email: 'coordenacao@demo.com', password: '123456', passwordHash: h, role: 'coordenacao', nome: 'Dra. Sandra Lima',  avatarLetter: 'S' },
        ]);

        // Salas
        save(KEYS.ROOMS, [
            { id: 'r1', nome: 'Aquário',         ativa: true },
            { id: 'r2', nome: 'Sala de Leitura', ativa: true },
            { id: 'r3', nome: 'Sala de Vídeo',   ativa: true },
        ]);

        // Notebooks (por marca)
        save(KEYS.NOTEBOOKS, [
            { id: 'nb1', marca: 'Dell',     total: 50, funcionando: 42, defeito: 5, quebrado: 3 },
            { id: 'nb2', marca: 'Lenovo',   total: 30, funcionando: 28, defeito: 2, quebrado: 0 },
            { id: 'nb3', marca: 'Acer',     total: 25, funcionando: 15, defeito: 7, quebrado: 3 },
            { id: 'nb4', marca: 'Positivo', total: 20, funcionando: 9,  defeito: 8, quebrado: 3 },
        ]);

        // Reservas mock
        const d0 = today();
        const d1 = dayOffset(1);
        const d2 = dayOffset(2);
        const d3 = dayOffset(3);

        save(KEYS.RESERVATIONS, [
            { id: genId(), professorId: 'u1', professorNome: 'Prof. Marcelo',      data: d0, inicio: '07:00', fim: '07:50', sala: 'Aquário',         notebooks: 20, turma: '3A Info',  situacao: 'confirmada' },
            { id: genId(), professorId: 'u1', professorNome: 'Prof. Marcelo',      data: d1, inicio: '08:40', fim: '09:30', sala: 'Sala de Leitura', notebooks: 15, turma: '2B Admin', situacao: 'confirmada' },
            { id: genId(), professorId: 'u3', professorNome: 'Prof. Ana Souza',    data: d0, inicio: '07:50', fim: '08:40', sala: 'Sala de Vídeo',   notebooks: 10, turma: '1C Log',   situacao: 'confirmada' },
            { id: genId(), professorId: 'u3', professorNome: 'Prof. Carlos Lima',  data: d1, inicio: '07:00', fim: '07:50', sala: 'Aquário',         notebooks: 25, turma: '3B Info',  situacao: 'confirmada' },
            { id: genId(), professorId: 'u3', professorNome: 'Prof. Maria Santos', data: d2, inicio: '13:00', fim: '13:50', sala: 'Sala de Leitura', notebooks: 15, turma: '2A Admin', situacao: 'confirmada' },
            { id: genId(), professorId: 'u3', professorNome: 'Prof. Ricardo Neves',data: d3, inicio: '09:30', fim: '10:20', sala: 'Aquário',         notebooks: 30, turma: '3C Info',  situacao: 'confirmada' },
        ]);

        // Bloqueio mock
        save(KEYS.BLOCKS, [
            { id: genId(), data: d2, inicio: '07:00', fim: '09:30', motivo: 'Manutenção preventiva nos equipamentos', criadoPor: 'Dra. Sandra Lima', criadoEm: new Date().toISOString() },
        ]);

        save(KEYS.SEEDED, true);
    }

    // ─────────────────────────────────────────────────────────────
    //  AUTENTICAÇÃO
    // ─────────────────────────────────────────────────────────────
    async function login(email, password) {
        let users = load(KEYS.USERS);
        if (!users || !users.length) {
            await seed();
            users = load(KEYS.USERS) || [];
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').toString();

        let h = null;
        try {
            h = await hashPassword(cleanPassword);
        } catch (e) {
            console.warn('Erro ao gerar hash:', e);
        }

        let user = users.find(u =>
            u.email && u.email.trim().toLowerCase() === cleanEmail &&
            (
                (h && u.passwordHash === h) ||
                u.password === cleanPassword ||
                (cleanPassword === '123456' && ['professor@demo.com', 'proatec@demo.com', 'coordenacao@demo.com'].includes(cleanEmail))
            )
        );

        // Fallback garantido para as contas demo
        if (!user && cleanPassword === '123456') {
            const demoMap = {
                'professor@demo.com':   { id: 'u1', role: 'professor',   nome: 'Prof. Marcelo',    avatarLetter: 'M' },
                'proatec@demo.com':     { id: 'u2', role: 'proatec',     nome: 'João Almeida',     avatarLetter: 'J' },
                'coordenacao@demo.com': { id: 'u3', role: 'coordenacao', nome: 'Dra. Sandra Lima',  avatarLetter: 'S' },
            };
            if (demoMap[cleanEmail]) {
                user = { ...demoMap[cleanEmail], email: cleanEmail, password: '123456', passwordHash: h };
                users.push(user);
                save(KEYS.USERS, users);
            }
        }

        if (!user) return { ok: false, message: 'E-mail ou senha incorretos. Selecione um perfil acima.' };
        const session = { userId: user.id, role: user.role, nome: user.nome, avatarLetter: user.avatarLetter, email: user.email };
        save(KEYS.SESSION, session);
        return { ok: true, user: session };
    }

    function logout() {
        localStorage.removeItem(KEYS.SESSION);
    }

    function getSession() {
        return load(KEYS.SESSION);
    }

    // ─────────────────────────────────────────────────────────────
    //  SALAS
    // ─────────────────────────────────────────────────────────────
    function getRooms() { return load(KEYS.ROOMS) || []; }

    function getActiveRooms() { return getRooms().filter(r => r.ativa); }

    function toggleRoom(id) {
        const rooms = getRooms();
        const r = rooms.find(r => r.id === id);
        if (r) {
            r.ativa = !r.ativa;
            save(KEYS.ROOMS, rooms);
            return true;
        }
        return false;
    }

    function addRoom(nome) {
        const rooms = getRooms();
        if (rooms.find(r => r.nome.toLowerCase() === nome.toLowerCase())) return { ok: false, message: 'Sala já cadastrada.' };
        rooms.push({ id: genId(), nome, ativa: true });
        save(KEYS.ROOMS, rooms);
        return { ok: true };
    }

    // ─────────────────────────────────────────────────────────────
    //  NOTEBOOKS
    // ─────────────────────────────────────────────────────────────
    function getNotebooks() { return load(KEYS.NOTEBOOKS) || []; }

    /** Retorna lista de marcas únicas (sem duplicatas) */
    function getBrands() {
        return [...new Set(getNotebooks().map(n => n.marca).filter(Boolean))];
    }

    function getDisponivelByBrand(marca) {
        if (!marca || marca === 'Qualquer marca' || marca === '') return getTotalDisponivel();
        const nb = getNotebooks().find(n => n.marca.toLowerCase() === marca.toLowerCase());
        return nb ? nb.funcionando : 0;
    }

    function getTotalDisponivel() {
        return getNotebooks().reduce((acc, n) => acc + n.funcionando, 0);
    }

    function addNotebooks(marca, quantidade, situacao = 'funcionando') {
        const notebooks = getNotebooks();
        const qtd = parseInt(quantidade) || 0;
        if (qtd <= 0) return { ok: false, message: 'Informe uma quantidade válida.' };
        const cleanBrand = marca.trim();
        if (!cleanBrand) return { ok: false, message: 'Informe o nome da marca.' };

        let nb = notebooks.find(n => n.marca.toLowerCase() === cleanBrand.toLowerCase());
        if (nb) {
            nb.total += qtd;
            if (situacao === 'defeito') nb.defeito += qtd;
            else if (situacao === 'quebrado') nb.quebrado += qtd;
            else nb.funcionando += qtd;
        } else {
            const func = situacao === 'funcionando' ? qtd : 0;
            const def  = situacao === 'defeito' ? qtd : 0;
            const qbr  = situacao === 'quebrado' ? qtd : 0;
            notebooks.push({ id: genId(), marca: cleanBrand, total: qtd, funcionando: func, defeito: def, quebrado: qbr });
        }
        save(KEYS.NOTEBOOKS, notebooks);
        return { ok: true };
    }

    function updateNotebookBrandCounts(id, { funcionando, defeito, quebrado }) {
        const notebooks = getNotebooks();
        const nb = notebooks.find(n => n.id === id);
        if (!nb) return { ok: false, message: 'Marca não encontrada.' };

        const f = Math.max(0, parseInt(funcionando) || 0);
        const d = Math.max(0, parseInt(defeito) || 0);
        const q = Math.max(0, parseInt(quebrado) || 0);

        nb.funcionando = f;
        nb.defeito = d;
        nb.quebrado = q;
        nb.total = f + d + q;

        save(KEYS.NOTEBOOKS, notebooks);
        return { ok: true, notebook: nb };
    }

    function deleteNotebookBrand(id) {
        let notebooks = getNotebooks();
        if (!notebooks.find(n => n.id === id)) return { ok: false, message: 'Marca não encontrada.' };
        notebooks = notebooks.filter(n => n.id !== id);
        save(KEYS.NOTEBOOKS, notebooks);
        return { ok: true };
    }

    function updateNotebookStatus(id, field, delta) {
        const notebooks = getNotebooks();
        const nb = notebooks.find(n => n.id === id);
        if (!nb) return { ok: false, message: 'Notebook não encontrado.' };
        if (nb[field] + delta < 0) return { ok: false, message: 'Quantidade não pode ser negativa.' };
        nb[field] += delta;
        save(KEYS.NOTEBOOKS, notebooks);
        return { ok: true };
    }

    // ─────────────────────────────────────────────────────────────
    //  RESERVAS
    // ─────────────────────────────────────────────────────────────
    function getReservations() { return load(KEYS.RESERVATIONS) || []; }

    function getReservationsByDate(date) {
        const dk = dateKey(date);
        return getReservations().filter(r => r.data === dk && r.situacao !== 'cancelada');
    }

    function getReservationsByUser(userId) {
        return getReservations().filter(r => r.professorId === userId);
    }

    function notebooksReservadosNoPeriodo(data, inicio, fim, excludeId = null) {
        const resDia = getReservationsByDate(data);
        return resDia
            .filter(r => r.id !== excludeId && timesOverlap(inicio, fim, r.inicio, r.fim))
            .reduce((acc, r) => acc + (r.notebooks || 0), 0);
    }

    function checkConflicts({ data, inicio, fim, sala, notebooks, excludeId = null }) {
        const dk = dateKey(data);

        // 1. Verificar bloqueios
        const blocks = getBlocks();
        const bloqueio = blocks.find(b => b.data === dk && timesOverlap(inicio, fim, b.inicio, b.fim));
        if (bloqueio) {
            return { ok: false, message: `Período bloqueado pela Coordenação: "${bloqueio.motivo}" (${bloqueio.inicio}–${bloqueio.fim}).` };
        }

        const resDia = getReservationsByDate(dk);
        const conflitantes = resDia.filter(r => r.id !== excludeId && timesOverlap(inicio, fim, r.inicio, r.fim));

        // 2. Verificar conflito de sala
        if (sala) {
            const conflSala = conflitantes.find(r => r.sala === sala);
            if (conflSala) {
                return { ok: false, message: `Conflito de sala: "${sala}" já está reservada das ${conflSala.inicio}–${conflSala.fim} por ${conflSala.professorNome}.` };
            }
        }

        // 3. Verificar disponibilidade de notebooks
        if (notebooks && notebooks > 0) {
            const totalDisp = getTotalDisponivel();
            const jaReservados = notebooksReservadosNoPeriodo(dk, inicio, fim, excludeId);
            const disponivel = totalDisp - jaReservados;
            if (notebooks > disponivel) {
                return { ok: false, message: `Notebooks insuficientes: ${disponivel} disponíveis para esse horário, mas você solicitou ${notebooks}.` };
            }
        }

        return { ok: true };
    }

    function createReservation({ professorId, professorNome, data, inicio, fim, sala, notebooks, turma }) {
        if (!inicio || !fim) return { ok: false, message: 'Informe o horário de início e fim.' };
        if (inicio >= fim)   return { ok: false, message: 'O horário de início deve ser anterior ao fim.' };
        if (!sala && (!notebooks || notebooks <= 0)) {
            return { ok: false, message: 'Selecione ao menos uma sala ou uma quantidade de notebooks.' };
        }

        const conflict = checkConflicts({ data, inicio, fim, sala: sala || null, notebooks: notebooks || 0 });
        if (!conflict.ok) return conflict;

        const reservation = {
            id: genId(),
            professorId, professorNome,
            data: dateKey(data),
            inicio, fim,
            sala: sala || null,
            notebooks: notebooks || 0,
            turma: turma || '',
            situacao: 'confirmada',
            criadoEm: new Date().toISOString(),
        };

        const list = getReservations();
        list.push(reservation);
        save(KEYS.RESERVATIONS, list);
        return { ok: true, reservation };
    }

    function cancelReservation(id) {
        const list = getReservations();
        const r = list.find(r => r.id === id);
        if (!r) return { ok: false, message: 'Reserva não encontrada.' };
        r.situacao = 'cancelada';
        save(KEYS.RESERVATIONS, list);
        return { ok: true };
    }

    function updateReservation(id, updates) {
        const list = getReservations();
        const r = list.find(r => r.id === id);
        if (!r) return { ok: false, message: 'Reserva não encontrada.' };

        const dados = { ...r, ...updates };
        const conflict = checkConflicts({
            data: dados.data, inicio: dados.inicio, fim: dados.fim,
            sala: dados.sala, notebooks: dados.notebooks, excludeId: id,
        });
        if (!conflict.ok) return conflict;

        Object.assign(r, updates);
        save(KEYS.RESERVATIONS, list);
        return { ok: true, reservation: r };
    }

    // ─────────────────────────────────────────────────────────────
    //  BLOQUEIOS
    // ─────────────────────────────────────────────────────────────
    function getBlocks() { return load(KEYS.BLOCKS) || []; }

    function createBlock({ data, inicio, fim, motivo, criadoPor }) {
        if (!data || !inicio || !fim || !motivo) return { ok: false, message: 'Preencha todos os campos do bloqueio.' };
        if (inicio >= fim) return { ok: false, message: 'O horário de início deve ser anterior ao fim.' };

        const block = { id: genId(), data: dateKey(data), inicio, fim, motivo, criadoPor, criadoEm: new Date().toISOString() };
        const list = getBlocks();
        list.push(block);
        save(KEYS.BLOCKS, list);
        return { ok: true, block };
    }

    function deleteBlock(id) {
        const list = getBlocks().filter(b => b.id !== id);
        save(KEYS.BLOCKS, list);
        return { ok: true };
    }

    // ─────────────────────────────────────────────────────────────
    //  UTILITÁRIOS DE UI
    // ─────────────────────────────────────────────────────────────

    /**
     * Exibe toast genérico com botão de fechar.
     * Usa textContent para evitar XSS.
     */
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) { console.warn('[Toast]', message); return; }

        const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.setAttribute('role', 'alert');

        // Ícone
        const iconEl = document.createElement('span');
        iconEl.className = 'material-symbols-outlined';
        iconEl.style.fontSize = '20px';
        iconEl.textContent = icons[type] || 'info';

        // Mensagem (textContent — sem XSS)
        const msgEl = document.createElement('span');
        msgEl.textContent = message;

        // Botão fechar
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close-btn';
        closeBtn.setAttribute('aria-label', 'Fechar notificação');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => dismissToast(toast));

        toast.appendChild(iconEl);
        toast.appendChild(msgEl);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        // Auto-dismiss após 5s
        const timer = setTimeout(() => dismissToast(toast), 5000);
        toast._dismissTimer = timer;
    }

    function dismissToast(toast) {
        if (toast._dismissTimer) clearTimeout(toast._dismissTimer);
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 350);
    }

    /** Formata data 'YYYY-MM-DD' → 'DD/MM/YYYY' */
    function formatDate(dk) {
        if (!dk) return '';
        const [y, m, d] = dk.split('-');
        return `${d}/${m}/${y}`;
    }

    /** Nomes dos dias da semana em pt-BR */
    const DIAS_SEMANA      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DIAS_SEMANA_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    /** Retorna a segunda-feira da semana que contém a data dada */
    function getMonday(date) {
        const d = new Date(date);
        d.setHours(12, 0, 0, 0); // evita bug de timezone
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return d;
    }

    /** Retorna array de 5 datas (Seg→Sex) de uma semana, dado a segunda-feira */
    function getWeekDays(monday) {
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            return d;
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  SEGURANÇA — Listener de storage para detectar logout em outra aba
    // ─────────────────────────────────────────────────────────────
    window.addEventListener('storage', (e) => {
        if (e.key === KEYS.SESSION && e.newValue === null) {
            // Sessão removida em outra aba → redireciona para login
            const isInPages = window.location.pathname.includes('/pages/');
            window.location.href = isInPages ? '../index.html' : 'index.html';
        }
    });

    // ─────────────────────────────────────────────────────────────
    //  EXPOSIÇÃO PÚBLICA
    // ─────────────────────────────────────────────────────────────
    window.ERS = {
        // Auth (login agora é async)
        login, logout, getSession,
        // Salas
        getRooms, getActiveRooms, toggleRoom, addRoom,
        // Notebooks
        getNotebooks, getTotalDisponivel, getBrands, getDisponivelByBrand,
        addNotebooks, updateNotebookStatus, updateNotebookBrandCounts, deleteNotebookBrand,
        // Reservas
        getReservations, getReservationsByDate, getReservationsByUser,
        createReservation, cancelReservation, updateReservation, checkConflicts,
        // Bloqueios
        getBlocks, createBlock, deleteBlock,
        // Utils
        showToast, formatDate, dateKey, today, dayOffset, escapeHtml,
        getMonday, getWeekDays, timesOverlap,
        DIAS_SEMANA, DIAS_SEMANA_FULL, MESES, MESES_FULL,
        TIME_SLOTS, SHIFT_SLOTS,
    };

    // ─────────────────────────────────────────────────────────────
    //  INICIALIZAÇÃO
    // ─────────────────────────────────────────────────────────────
    seed();

})();
