// ========================================
// GRUZAPP — единая регистрация + трекинг
// ========================================

(function() {

  // -------- НАСТРОЙКИ (замени на свои) --------
const SUPABASE_URL = 'https://htftklrysatwhqznbtty.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8GinUKWP4PAEdCOvgKhb0w_8jK8Kny5';
  var TG_LINK = 'https://t.me/GruzAppAdmin';
  var MAX_LINK = 'https://max.ru/u/f9LHodD0cOJ2neNnXNioAOftxFKf0F_S6uJDQ6RLYnJ0-DJeneqHt-KmHLA';

  // -------- ПОЛЬЗОВАТЕЛЬ (localStorage) --------
  function getUser() {
    try {
      var raw = localStorage.getItem('gruzapp_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function saveUser(name, contact) {
    localStorage.setItem('gruzapp_user', JSON.stringify({ name: name, contact: contact, ts: Date.now() }));
  }

  function isRegistered() {
    return getUser() !== null;
  }

  // -------- SUPABASE (ленивая загрузка) --------
  var supabase = null;
  var supabaseReady = false;
  var supabaseQueue = [];

  function ensureSupabase(cb) {
    if (supabaseReady) { cb(supabase); return; }
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') { cb(null); return; }

    supabaseQueue.push(cb);
    if (supabaseQueue.length > 1) return; // уже загружается

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = function() {
      try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch(e) {
        console.warn('Supabase init error:', e.message);
        supabase = null;
      }
      supabaseReady = true;
      supabaseQueue.forEach(function(fn) { fn(supabase); });
      supabaseQueue = [];
    };
    script.onerror = function() {
      console.warn('Supabase CDN не загрузился');
      supabaseReady = true;
      supabase = null;
      supabaseQueue.forEach(function(fn) { fn(null); });
      supabaseQueue = [];
    };
    document.head.appendChild(script);
  }

  function getUtm() {
    var p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') || null,
      utm_medium: p.get('utm_medium') || null,
      utm_campaign: p.get('utm_campaign') || null,
      referrer: document.referrer || null,
      page: window.location.pathname
    };
  }

  // Сохранить лида
  function saveLead(name, contact, source) {
    ensureSupabase(function(sb) {
      if (!sb) return;
      sb.from('leads').insert({
        name: name, contact: contact, source: source,
        segment: 'signup', status: 'new', utm: getUtm()
      }).then(function() {}).catch(function(e) { console.warn('Save error:', e); });
    });
  }

  // Трекинг клика
  function trackClick(source, action) {
    ensureSupabase(function(sb) {
      if (!sb) return;
      var user = getUser();
      sb.from('leads').insert({
        name: user ? user.name : action,
        contact: user ? user.contact : source,
        source: source, segment: 'click', status: action, utm: getUtm()
      }).then(function() {}).catch(function(e) { console.warn('Track error:', e); });
    });
  }

  // -------- GATE (мини-форма, один раз) --------
  function renderGate(containerId, source, onSuccess) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (isRegistered()) {
      onSuccess();
      return;
    }

    el.innerHTML =
      '<div class="gate">' +
        '<div class="gate-icon">🔓</div>' +
        '<h2 class="gate-title">Один шаг до инструмента</h2>' +
        '<p class="gate-sub">Введи имя и контакт — все инструменты GRUZAPP откроются. Один раз, без повторов.</p>' +
        '<div class="gate-form">' +
          '<input type="text" id="gate-name" placeholder="Имя" class="gate-input">' +
          '<input type="text" id="gate-contact" placeholder="Телефон или Telegram" class="gate-input">' +
          '<button id="gate-btn" class="gate-submit">Открыть</button>' +
        '</div>' +
        '<div class="gate-privacy">Не спамим. Только по делу.</div>' +
      '</div>';

    document.getElementById('gate-btn').addEventListener('click', function() {
      var name = document.getElementById('gate-name').value.trim();
      var contact = document.getElementById('gate-contact').value.trim();
      if (!name || !contact) return;

      var btn = document.getElementById('gate-btn');
      btn.disabled = true;
      btn.textContent = 'Открываем...';

      saveUser(name, contact);
      saveLead(name, contact, source);

      el.innerHTML = '';
      onSuccess();
    });
  }

  // -------- CTA (кнопки TG + MAX) --------
  function renderCTA(containerId, source, title, subtitle) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user = getUser();
    var nameParam = user
      ? '?text=' + encodeURIComponent('Привет, меня зовут ' + user.name + '. Хочу расчёт доставки.')
      : '';

    el.innerHTML =
      '<div class="cta-final">' +
        '<h3>' + (title || 'Готов обсудить доставку?') + '</h3>' +
        '<p>' + (subtitle || 'Напиши нам — пришлём расчёт за 15 минут.') + '</p>' +
        '<div class="cta-buttons">' +
          '<a href="' + TG_LINK + nameParam + '" target="_blank" class="cta-btn cta-tg" id="cta-tg-' + source + '">' +
            '<span class="cta-icon">✈</span> Написать в Telegram' +
          '</a>' +
          '<a href="' + MAX_LINK + '" target="_blank" class="cta-btn cta-max" id="cta-max-' + source + '">' +
            '<span class="cta-icon">◆</span> Написать в MAX' +
          '</a>' +
        '</div>' +
      '</div>';

    document.getElementById('cta-tg-' + source).addEventListener('click', function() { trackClick(source, 'tg_click'); });
    document.getElementById('cta-max-' + source).addEventListener('click', function() { trackClick(source, 'max_click'); });
  }

  // -------- ЭКСПОРТ --------
  window.GRUZAPP = {
    renderGate: renderGate,
    renderCTA: renderCTA,
    trackClick: trackClick,
    isRegistered: isRegistered,
    getUser: getUser,
    TG_LINK: TG_LINK,
    MAX_LINK: MAX_LINK
  };

})();
