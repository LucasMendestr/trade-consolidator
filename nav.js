function renderSidebar() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  sb.innerHTML = '' +
    '<div class="sidebar-header">' +
    '  <div class="sidebar-brand">' +
    '    <span class="brand-logo" title="Trade Consolidator">' +
    '      <svg class="logo-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '        <rect x="3" y="12" width="4" height="9" rx="1"></rect>' +
    '        <rect x="10" y="7" width="4" height="14" rx="1"></rect>' +
    '        <rect x="17" y="3" width="4" height="18" rx="1"></rect>' +
    '      </svg>' +
    '    </span>' +
    '    <span class="brand-name">Trade Consolidator</span>' +
    '  </div>' +
    '  <button id="sidebarToggle" class="sidebar-toggle">≪</button>' +
    '</div>' +
    '<div class="sidebar-actions">' +
    '  <button class="btn btn-upload" onclick="openUploadModal()">+ Upload CSV</button>' +
    '</div>' +
    '<ul class="nav-list">' +
    '  <li class="nav-item"><a class="nav-link" href="dashboard.html"><span class="nav-icon">📊</span><span class="nav-text">Dashboard</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="trades.html"><span class="nav-icon">📋</span><span class="nav-text">Trades</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="strategies.html"><span class="nav-icon">🧠</span><span class="nav-text">Estratégias</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="diario.html"><span class="nav-icon">📓</span><span class="nav-text">Diário</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="reportes.html"><span class="nav-icon">📈</span><span class="nav-text">Reportes</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="playbook.html"><span class="nav-icon">📘</span><span class="nav-text">Playbook</span></a></li>' +
    '  <li class="nav-item"><a class="nav-link" href="contas.html"><span class="nav-icon">🏦</span><span class="nav-text">Contas</span></a></li>' +
    '</ul>';
  try {
    var btn = document.getElementById('sidebarToggle');
    if (btn) {
      btn.addEventListener('click', function(){
        sb.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
      });
    }
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', function(){
  renderSidebar();
  try { if (typeof initSidebarActive === 'function') initSidebarActive(); } catch(e) {}
});

