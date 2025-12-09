window.addEventListener('load', async function() {
    initSupabase();
    initThemeFromStorage();
    initSidebarActive();
    try {
        const r = await supabaseClient.auth.getUser();
        if (!r.error && r.data && r.data.user) {
            currentUser = r.data.user;
            await loadDataFromSupabase();
            await loadStrategies();
            try { if (typeof loadAccounts === 'function') { await loadAccounts(); } } catch(e){}
        }
    } catch (e) {}
});

function initSidebarActive(){
    try {
        var links = document.querySelectorAll('.sidebar .nav-link');
        if (!links || !links.length) return;
        var path = (location.pathname || '').split('/').pop() || '';
        var stored = null;
        try { stored = localStorage.getItem('active_nav'); } catch(e){}
        var targetHref = path || stored || '';
        var matched = null;
        for (var i=0;i<links.length;i++){ var href = links[i].getAttribute('href')||''; if (href === targetHref) { matched = links[i]; break; } }
        for (var j=0;j<links.length;j++){ links[j].classList.remove('active'); }
        if (matched) { matched.classList.add('active'); }
        for (var k=0;k<links.length;k++){
            links[k].addEventListener('click', function(ev){ var h=this.getAttribute('href')||''; try { localStorage.setItem('active_nav', h); } catch(e){} });
        }
    } catch(e){}
}
