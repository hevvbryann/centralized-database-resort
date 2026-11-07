(() => {
  'use strict';
  // Keep large tables contained without removing any columns or controls.
  document.querySelectorAll('table').forEach(table => {
    if (table.closest('.responsive-table, .table-wrap, .table-responsive, .data-table-wrap, .caretaker-table-wrap')) return;
    const region = document.createElement('div');
    region.className = 'responsive-table';
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', table.getAttribute('aria-label') || 'Scrollable data table');
    table.before(region);
    region.append(table);
  });
  // Escape closes mobile navigation and returns focus to its own menu button.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open], .modal.show')) return;
    const toggle = document.querySelector('.site-menu-toggle[aria-expanded="true"], .customer-menu-toggle[aria-expanded="true"], .caretaker-menu-toggle[aria-expanded="true"], .owner-menu-toggle[aria-expanded="true"]');
    if (toggle) { toggle.click(); toggle.focus(); }
  });
})();
