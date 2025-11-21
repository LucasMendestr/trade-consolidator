window.addEventListener('load', async function() {
    initSupabase();
    initThemeFromStorage();
    try {
        const r = await supabaseClient.auth.getUser();
        if (!r.error && r.data && r.data.user) {
            currentUser = r.data.user;
            await loadDataFromSupabase();
            await loadStrategies();
        }
    } catch (e) {}
});