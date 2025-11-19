function setTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'dark') { body.classList.add('theme-dark'); } else { body.classList.add('theme-light'); }
    try { localStorage.setItem('theme', theme); } catch (e) {}
    const radios = document.querySelectorAll('input[name="theme"]');
    for (let i = 0; i < radios.length; i++) { radios[i].checked = radios[i].value === theme; }
}

function initThemeFromStorage() {
    let theme = 'light';
    try { const saved = localStorage.getItem('theme'); if (saved) theme = saved; } catch (e) {}
    setTheme(theme);
}