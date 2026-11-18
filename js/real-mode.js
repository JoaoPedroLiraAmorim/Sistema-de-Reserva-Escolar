'use strict';
const inApp = location.pathname.includes('/pages/');
if (!inApp) sessionStorage.removeItem('alceu_demo');
window.ERS_DEMO = inApp && sessionStorage.getItem('alceu_demo') === '1';
window.ERS_REAL = !window.ERS_DEMO;
window.ERS_DATA = { session: null, rooms: [], notebooks: [], reservations: [], blocks: [], professors: [] };
if (inApp) document.documentElement.classList.add('app-loading');
