'use strict';
window.ERS_REAL = true;
window.ERS_DATA = { session: null, rooms: [], notebooks: [], reservations: [], blocks: [], professors: [] };
if (location.pathname.includes('/pages/')) document.documentElement.classList.add('app-loading');
