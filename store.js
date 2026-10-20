// store.js — capa única de datos del alumno (el "seam" del trasplante).
//
// Modelo HIDRATAR + GET SÍNCRONO (clave para no volver async toda la app):
//   - Al entrar, Store.hydrate() trae de Supabase TODO el estado del alumno en UNA consulta y lo
//     deja en memoria (_mem). También lo cachea en localStorage (offline / primer pintado).
//   - Store.get(key)  -> SÍNCRONO, devuelve el string guardado o null (igual contrato que
//     localStorage.getItem: el valor es SIEMPRE un string; la app hace JSON.parse donde toca).
//   - Store.set(key, str) -> actualiza memoria + caché YA, y persiste en Supabase en segundo plano
//     (con indicador guardando/guardado/error). Patrón híbrido del briefing (2.1c + 2.2).
//   - Store.remove(key) -> borra de memoria, caché y Supabase.
//
// `value` se guarda como jsonb que contiene el string tal cual (round-trip string->jsonb->string).
// `key` es la clave lógica ('tfm-notes', …); el prefijo por usuario lo da la sesión, no userKey().
// Ver docs/STORAGE_MAP.md.

(function () {
  var CACHE_PREFIX = 'tfm_cache_';
  var _mem = {};            // key -> string (estado del alumno en memoria)
  var _ready = false;       // ¿hidratado desde Supabase?
  var _uid = null;

  function cacheKey(key) { return CACHE_PREFIX + (_uid || 'anon') + '_' + key; }
  function notify(state) { try { if (window.__tfmSave) window.__tfmSave(state); } catch (e) {} }

  async function resolveUid() {
    try { var r = await window.sb.auth.getUser(); return r && r.data && r.data.user ? r.data.user.id : null; }
    catch (e) { return null; }
  }

  var Store = {
    // Carga TODO el estado del alumno en memoria. Llamar en initAppForUser ANTES de pintar.
    async hydrate() {
      _mem = {}; _ready = false;
      _uid = await resolveUid();
      if (!_uid) { _ready = true; return; }
      try {
        var res = await window.sb.from('student_state').select('key, value').eq('user_id', _uid);
        if (res.error) throw res.error;
        (res.data || []).forEach(function (row) {
          // value viene de jsonb; guardamos SIEMPRE string (lo que la app espera de getItem).
          var v = row.value;
          _mem[row.key] = (typeof v === 'string' || v === null) ? v : JSON.stringify(v);
          try { localStorage.setItem(cacheKey(row.key), _mem[row.key]); } catch (e) {}
        });
        _ready = true;
      } catch (e) {
        // Sin red: tiramos de la caché local de este usuario para no dejar la app vacía.
        console.warn('[store] hydrate offline, uso caché local:', e && e.message);
        _ready = false;
      }
    },

    // Lectura SÍNCRONA (contrato de localStorage.getItem: string | null).
    get: function (key) {
      if (_ready && Object.prototype.hasOwnProperty.call(_mem, key)) return _mem[key];
      if (key in _mem) return _mem[key];
      try { var c = localStorage.getItem(cacheKey(key)); return c === null ? null : c; } catch (e) { return null; }
    },

    // Escritura: memoria + caché YA (no se pierde trabajo), Supabase en segundo plano.
    set: function (key, value) {
      value = (value === undefined || value === null) ? null : String(value);
      _mem[key] = value;
      try { localStorage.setItem(cacheKey(key), value); } catch (e) {}
      if (!_uid) return;                       // sin sesión aún: queda en caché; hydrate/login reconcilia
      notify('saving');
      window.sb.from('student_state')
        .upsert({ user_id: _uid, key: key, value: value, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,key' })
        .then(function (res) { notify(res.error ? 'error' : 'saved'); })
        .catch(function () { notify('error'); });
    },

    remove: function (key) {
      delete _mem[key];
      try { localStorage.removeItem(cacheKey(key)); } catch (e) {}
      if (!_uid) return;
      window.sb.from('student_state').delete().eq('user_id', _uid).eq('key', key)
        .then(function () {}).catch(function () {});
    },
  };

  window.Store = Store;
})();
