function initSupabase() {
    if (window.supabase) {
        const SUPABASE_URL = 'https://wswqbdjruvsfqhjkdvck.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3FiZGpydXZzZnFoamtkdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzk4MjEsImV4cCI6MjA3ODY1NTgyMX0.-Ulf2Jf4Wf_5JMaPTzgHx5Ifg8sQqKTMW01Sofr3vMY';
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}