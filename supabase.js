// supabase.js — cliente único de Supabase para toda la app.
// Carga supabase-js v2 por CDN (app sin build). config.js define window.__SUPABASE.
// Debe cargarse DESPUÉS de config.js y del script UMD de supabase-js, y ANTES de store.js.
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[supabase] falta el script UMD de supabase-js (CDN) antes de supabase.js');
    return;
  }
  var cfg = window.__SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || cfg.anonKey === 'PON_AQUI_LA_ANON_KEY') {
    console.error('[supabase] config.js sin URL/anonKey — copia config.example.js a config.js');
    return;
  }
  // Sesión persistente en localStorage y auto-refresh del token (el alumno no re-loguea cada rato).
  window.sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tfm_sb_session' },
  });
})();
