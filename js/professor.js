/**
 * Sistema de Reserva Escolar - professor.js
 * Comportamentos específicos para o Portal do Professor
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. Alternância dos botões de turno (Manhã / Tarde / Noite)
    // ---------------------------------------------------------
    const shiftButtons = document.querySelectorAll('.shift-btn');
    shiftButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            shiftButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
});
