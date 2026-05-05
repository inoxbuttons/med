/**
 * MedChat Widget — встраиваемый чат-ассистент клиники.
 *
 * Подключение (одна строка):
 *   <script src="chat-widget.js"
 *     data-clinic-net-id="1"
 *     data-mis-type="medflex"
 *   ></script>
 *
 * Параметры (data-* на теге <script>):
 *   data-clinic-net-id       — ID сети клиник (lpu_group_id в MedFlex)
 *   data-mis-type            — тип МИС: 'medflex', 'infoclinica', или пусто для локальной БД
 *   data-chat-url            — URL chat.html (по умолчанию: рядом со скриптом)
 *   data-title               — заголовок попапа (по умолчанию: 'Чат-ассистент')
 *   data-button-text         — текст кнопки (по умолчанию: 'Записаться онлайн')
 *   data-color               — основной цвет HEX (по умолчанию: #2493f9)
 *   data-position            — позиция кнопки: 'bottom-right' | 'bottom-left' (по умолчанию: 'bottom-right')
 *   data-auto-button         — 'false' чтобы скрыть плавающую кнопку (управление только через API)
 *
 *   data-round-button        — 'true' чтобы показать круглую FAB-кнопку
 *   data-round-button-text   — надпись под кружком (по умолчанию: 'Запись с ассистентом')
 *   data-round-button-color  — цвет кружка (по умолчанию: data-color)
 *   data-round-button-position — позиция: 'bottom-right'|'bottom-left'|'top-right'|'top-left' (по умолчанию: 'bottom-right')
 *   data-round-button-style  — произвольный CSS для контейнера кнопки (например: 'bottom:40px;right:40px;')
 *
 * Публичный API (window.MedChatWidget):
 *   .open()              — открыть попап
 *   .close()             — закрыть попап
 *   .setPatient(data)    — передать данные пациента {firstName,lastName,secondName?,phone,birthday}
 *   .setSession(id)      — задать ID сессии вручную
 *   .buildChatUrl(sid?)  — Promise<string>: построить URL с параметрами (для встроенного iframe)
 */

(function (w, d) {
  'use strict';

  // ── Читаем собственный <script> тег ────────────────────────────────────────

  var _me = d.currentScript;

  function _attr(name, fallback) {
    if (!_me) return fallback || '';
    var v = _me.getAttribute('data-' + name);
    return (v !== null && v !== '') ? v : (fallback || '');
  }

  // Базовый URL (папка, где лежит скрипт) — нужен для нахождения chat.html
  var _base = '';
  if (_me && _me.src) {
    _base = _me.src.replace(/\/[^\/]*$/, '/');
  }

  // ── Конфигурация ────────────────────────────────────────────────────────────

  var _cfg = {
    clinicNetId       : _attr('clinic-net-id') || null,
    misType           : _attr('mis-type')      || null,
    chatUrl           : _attr('chat-url')      || (_base + 'chat.html'),
    title             : _attr('title',        'Чат-ассистент'),
    buttonText        : _attr('button-text',  'Записаться онлайн'),
    color             : _attr('color',        '#2493f9'),
    position          : _attr('position',     'bottom-right'),
    autoButton        : _attr('auto-button',  'true') !== 'false',
    // Круглая FAB-кнопка
    roundButton       : _attr('round-button', 'false') !== 'false',
    roundButtonText   : _attr('round-button-text',     'Запись'),
    roundButtonColor  : _attr('round-button-color')    || null,  // fallback to color
    roundButtonPos    : _attr('round-button-position', 'bottom-right'),
    roundButtonStyle  : _attr('round-button-style')    || '',
  };

  // ── Состояние ───────────────────────────────────────────────────────────────

  var _patient    = null;  // { firstName, lastName, secondName?, phone, birthday }
  var _sessionId  = null;  // кастомный session id (иначе генерируется из cookie)
  var _cachedUrl  = null;  // кешируем URL чтобы не шифровать при каждом открытии
  var _isOpen     = false;

  // ── Инлайн-криптография (AES-256-GCM + RSA-OAEP) ─────────────────────────

  // Публичный ключ должен соответствовать PATIENT_DATA_PRIVATE_KEY в backend/.env
  var _PUBLIC_KEY_PEM = [
    '-----BEGIN PUBLIC KEY-----',
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwJKs8m77lsDKDXzib1Ax',
    'fDA8zHVxsUKu4UNektVql5IdF6EBd9W6s4kke4rpVup4bj14Qwrnoqe2BMJ7QKIq',
    'xA5CzR+R9FdIxLIuUzUX7MuB8CJA83vmIsaM5HqYFEOpUwVgnIyKCZCWDqrFNK1R',
    'LlPhKJoM8ZHB0YgeSMiJiFz8Zp43QxM7r1NVNqlNENVE/84zkuXXOPaWu8EcJCkj',
    'v7ltF4hroAOb2KRTZKAckZcgnclH5MSFXEPUtipVDXSU7iqnWdsJYKFTa9V+rsw3',
    '+w6apBe5cM/vTlmi0iKVk+s5SMF4dLZsON7O1Gkui7+QfSNoYobo58hBivREIFNr',
    'DQIDAQAB',
    '-----END PUBLIC KEY-----',
  ].join('\n');

  function _importPublicKey() {
    var b64 = _PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '');
    var der = Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); });
    return crypto.subtle.importKey('spki', der.buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  }

  function _encryptPatient(patient) {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']).then(function(aesKey) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var data = new TextEncoder().encode(JSON.stringify(patient));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aesKey, data).then(function(encrypted) {
        return crypto.subtle.exportKey('raw', aesKey).then(function(rawKey) {
          return _importPublicKey().then(function(pubKey) {
            return crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, rawKey).then(function(encKey) {
              var b64 = function(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); };
              return { k: b64(encKey), iv: b64(iv), d: b64(encrypted) };
            });
          });
        });
      });
    });
  }

  // ── Session ID (cookie) ──────────────────────────────────────────────────────

  function _getCookie(name) {
    var m = d.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function _setCookie(name, value) {
    var exp = new Date(Date.now() + 90 * 864e5).toUTCString();
    d.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp + '; path=/; SameSite=Lax';
  }
  function _getSessionId() {
    if (_sessionId) return _sessionId;
    var key = 'mdc_session';
    var sid = _getCookie(key);
    if (!sid) {
      sid = 'w-' + Math.random().toString(36).slice(2, 9);
      _setCookie(key, sid);
    }
    return sid;
  }

  // ── Построение URL chat.html ──────────────────────────────────────────────────

  function _buildUrl(sid) {
    var url = _cfg.chatUrl + '?session=' + encodeURIComponent(sid || _getSessionId());
    if (_cfg.clinicNetId) url += '&clinicNetId=' + encodeURIComponent(_cfg.clinicNetId);
    if (_cfg.misType)     url += '&misType='     + encodeURIComponent(_cfg.misType);
    if (!_patient) return Promise.resolve(url);
    return _encryptPatient(_patient).then(function(enc) {
      return url + '&client-data=' + encodeURIComponent(JSON.stringify(enc));
    }).catch(function(err) {
      console.warn('[MedChatWidget] Patient encryption failed:', err);
      return url;
    });
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  var _COLOR      = _cfg.color;
  var _POS_R      = _cfg.position !== 'bottom-left';
  var _RB_COLOR   = _cfg.roundButtonColor || _COLOR;
  var _RB_POS     = _cfg.roundButtonPos;

  function _rbPosCSS() {
    var css = 'position:fixed;z-index:99998;';
    if (_RB_POS === 'bottom-left')  { css += 'bottom:24px;left:24px;'; }
    else if (_RB_POS === 'top-right')   { css += 'top:24px;right:24px;'; }
    else if (_RB_POS === 'top-left')    { css += 'top:24px;left:24px;'; }
    else                            { css += 'bottom:24px;right:24px;'; } // bottom-right default
    return css;
  }

  var _css = [
    ':root{--mdc-color:' + _COLOR + ';--mdc-color-dark:color-mix(in srgb,var(--mdc-color) 80%,#000)}',

    /* Floating button */
    '.mdc-trigger{',
    '  position:fixed;z-index:99998;',
    _POS_R ? 'right:24px;' : 'left:24px;',
    '  bottom:24px;',
    '  display:flex;align-items:center;gap:10px;',
    '  background:var(--mdc-color);color:#fff;',
    '  border:none;border-radius:30px;',
    '  padding:13px 22px;',
    '  font-size:15px;font-weight:600;font-family:inherit;',
    '  cursor:pointer;',
    '  box-shadow:0 4px 20px rgba(0,0,0,.25);',
    '  transition:transform .15s,box-shadow .15s,background .15s;',
    '  line-height:1;',
    '}',
    '.mdc-trigger:hover{background:var(--mdc-color-dark);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.28);}',
    '.mdc-trigger:active{transform:none;}',
    '.mdc-trigger svg{flex-shrink:0;}',

    /* Overlay */
    '.mdc-overlay{',
    '  display:none;position:fixed;inset:0;z-index:99999;',
    '  background:rgba(0,0,0,.55);backdrop-filter:blur(4px);',
    '  align-items:center;justify-content:center;',
    '}',
    '.mdc-overlay.mdc-open{display:flex;}',

    /* Popup */
    '.mdc-popup{',
    '  background:#fff;overflow:hidden;',
    '  width:100vw;height:100dvh;',
    '  display:flex;flex-direction:column;',
    '  animation:mdcIn .22s ease;',
    '}',
    '@keyframes mdcIn{from{opacity:0;transform:scale(.93) translateY(-12px)}to{opacity:1;transform:none}}',
    '@media(min-width:600px){.mdc-popup{',
    '  border-radius:20px;width:600px;',
    '  max-width:calc(100vw - 32px);',
    '  height:720px;max-height:calc(100vh - 40px);',
    '  box-shadow:0 24px 64px rgba(0,0,0,.25);',
    '}}',

    /* Popup header */
    '.mdc-popup__hdr{',
    '  background:var(--mdc-color);color:#fff;',
    '  padding:14px 18px;flex-shrink:0;',
    '  display:flex;align-items:center;justify-content:space-between;',
    '}',
    '.mdc-popup__hdr-title{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;}',
    '.mdc-popup__close{',
    '  background:none;border:none;color:#fff;',
    '  font-size:22px;cursor:pointer;line-height:1;opacity:.8;',
    '  padding:2px 6px;font-family:inherit;',
    '}',
    '.mdc-popup__close:hover{opacity:1;}',

    /* Iframe */
    '.mdc-popup__frame{flex:1;border:none;width:100%;}',

    /* Loading state */
    '.mdc-popup__loading{',
    '  flex:1;display:flex;align-items:center;justify-content:center;',
    '  color:#999;font-size:14px;font-family:inherit;',
    '}',

    /* Round FAB button */
    '.mdc-round-btn{',
    '  display:flex;flex-direction:column;align-items:center;',
    '  cursor:pointer;border:none;background:none;padding:0;',
    '  font-family:inherit;text-decoration:none;',
    '}',
    '@keyframes mdcRbPulse{',
    '  0%{box-shadow:0 6px 20px rgba(0,0,0,.22),0 0 0 0 ' + _RB_COLOR + '66;}',
    '  70%{box-shadow:0 6px 20px rgba(0,0,0,.22),0 0 0 16px ' + _RB_COLOR + '00;}',
    '  100%{box-shadow:0 6px 20px rgba(0,0,0,.22),0 0 0 0 ' + _RB_COLOR + '00;}',
    '}',
    '.mdc-round-btn__circle{',
    '  width:96px;height:96px;border-radius:50%;',
    '  background:' + _RB_COLOR + ';color:#fff;',
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;',
    '  box-shadow:0 6px 20px rgba(0,0,0,.22),0 0 0 0 ' + _RB_COLOR + '66;',
    '  animation:mdcRbPulse 2.2s ease-out infinite;',
    '  flex-shrink:0;padding:10px;box-sizing:border-box;',
    '}',
    '.mdc-round-btn:hover .mdc-round-btn__circle{animation:none;transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.28);}',
    '.mdc-round-btn:active .mdc-round-btn__circle{animation:none;transform:none;}',
    '.mdc-round-btn__label{',
    '  font-size:15px;font-weight:700;color:#fff;',
    '  text-align:center;line-height:1.2;',
    '  max-width:80px;word-break:break-word;',
    '}',
  ].join('');

  // ── HTML ─────────────────────────────────────────────────────────────────────

  function _buildHTML() {
    var svg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
            + '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

    // Robot-in-bubble icon (matches icon.png in project root)
    var svgLg = '<svg width="38" height="42" viewBox="0 0 48 52" fill="none" xmlns="http://www.w3.org/2000/svg">'
              // Antenna ball + stem
              + '<circle cx="24" cy="3" r="2.5" fill="white"/>'
              + '<line x1="24" y1="5.5" x2="24" y2="11" stroke="white" stroke-width="2" stroke-linecap="round"/>'
              // Speech bubble outline
              + '<path d="M16 11 L32 11 Q43 11 43 22 L43 34 Q43 43 32 43 L24 43 L8 52 L16 43 Q5 43 5 34 L5 22 Q5 11 16 11 Z"'
              + ' stroke="white" stroke-width="2.2" stroke-linejoin="round" fill="none"/>'
              // Tail fill
              + '<path d="M24 43 L8 52 L16 43 Z" fill="white"/>'
              // Ear nubs
              + '<rect x="2" y="24" width="3" height="8" rx="1.5" stroke="white" stroke-width="1.8" fill="none"/>'
              + '<rect x="43" y="24" width="3" height="8" rx="1.5" stroke="white" stroke-width="1.8" fill="none"/>'
              // Eyes (goggle style)
              + '<circle cx="17" cy="26" r="4.5" stroke="white" stroke-width="2" fill="none"/>'
              + '<circle cx="31" cy="26" r="4.5" stroke="white" stroke-width="2" fill="none"/>'
              + '<line x1="21.5" y1="26" x2="26.5" y2="26" stroke="white" stroke-width="2"/>'
              // Smile
              + '<path d="M17 34 Q24 41 31 34" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>'
              + '</svg>';

    var closeSvg = '×';

    var html = '';

    if (_cfg.autoButton) {
      html += '<button class="mdc-trigger" id="mdcTrigger" aria-label="' + _cfg.buttonText + '">'
            + svg + '<span>' + _cfg.buttonText + '</span>'
            + '</button>';
    }

    if (_cfg.roundButton) {
      // Позиционирование: inline style на контейнере (можно переопределить через roundButtonStyle)
      var rbStyle = _rbPosCSS() + (_cfg.roundButtonStyle ? _cfg.roundButtonStyle : '');
      html += '<button class="mdc-round-btn" id="mdcRoundBtn" style="' + rbStyle + '" aria-label="' + _cfg.roundButtonText + '">'
            + '<span class="mdc-round-btn__circle">'
            + svgLg
            + '<span class="mdc-round-btn__label">' + _cfg.roundButtonText + '</span>'
            + '</span>'
            + '</button>';
    }

    html += '<div class="mdc-overlay" id="mdcOverlay" role="dialog" aria-modal="true" aria-label="' + _cfg.title + '">'
          + '<div class="mdc-popup" id="mdcPopup">'
          + '<div class="mdc-popup__hdr">'
          + '<span class="mdc-popup__hdr-title">' + svg + _cfg.title + '</span>'
          + '<button class="mdc-popup__close" id="mdcClose" aria-label="Закрыть">' + closeSvg + '</button>'
          + '</div>'
          + '<div class="mdc-popup__loading" id="mdcLoading">Загрузка…</div>'
          + '<iframe class="mdc-popup__frame" id="mdcFrame" src="" title="' + _cfg.title + '" style="display:none"></iframe>'
          + '</div>'
          + '</div>';

    return html;
  }

  // ── Инжект стилей и HTML ─────────────────────────────────────────────────────

  function _inject() {
    var style = d.createElement('style');
    style.textContent = _css;
    d.head.appendChild(style);

    var wrap = d.createElement('div');
    wrap.innerHTML = _buildHTML();
    // Append each child to body (avoid extra wrapper div)
    while (wrap.firstChild) d.body.appendChild(wrap.firstChild);
  }

  // ── Open / Close ─────────────────────────────────────────────────────────────

  function _open() {
    if (_isOpen) return;
    _isOpen = true;
    var overlay = d.getElementById('mdcOverlay');
    var frame   = d.getElementById('mdcFrame');
    var loading = d.getElementById('mdcLoading');
    if (!overlay) return;

    overlay.classList.add('mdc-open');

    // Грузим iframe если ещё не загружен
    if (!frame.src || frame.src === w.location.href) {
      var loadPromise = _cachedUrl ? Promise.resolve(_cachedUrl) : _buildUrl();
      loadPromise.then(function(url) {
        _cachedUrl = url;
        frame.onload = function() {
          if (loading) loading.style.display = 'none';
          frame.style.display = 'block';
        };
        frame.src = url;
      });
    } else {
      if (loading) loading.style.display = 'none';
      frame.style.display = 'block';
    }
  }

  function _close() {
    _isOpen = false;
    var overlay = d.getElementById('mdcOverlay');
    if (overlay) overlay.classList.remove('mdc-open');
  }

  // ── Инициализация ────────────────────────────────────────────────────────────

  function _init() {
    _inject();

    // Плавающая кнопка (pill)
    var trigger = d.getElementById('mdcTrigger');
    if (trigger) trigger.addEventListener('click', _open);

    // Круглая FAB-кнопка
    var roundBtn = d.getElementById('mdcRoundBtn');
    if (roundBtn) roundBtn.addEventListener('click', _open);

    // Кнопка закрытия
    var closeBtn = d.getElementById('mdcClose');
    if (closeBtn) closeBtn.addEventListener('click', _close);

    // Клик по фону
    var overlay = d.getElementById('mdcOverlay');
    if (overlay) overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _close();
    });

    // Esc
    d.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && _isOpen) _close();
    });
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ── Публичный API ────────────────────────────────────────────────────────────

  w.MedChatWidget = {
    /** Открыть попап чата. */
    open: _open,

    /** Закрыть попап чата. */
    close: _close,

    /**
     * Задать данные пациента для автозаполнения.
     * Вызывать после авторизации пользователя на сайте.
     * @param {object|null} data  { firstName, lastName, secondName?, phone, birthday } или null для сброса.
     */
    setPatient: function(data) {
      _patient   = data || null;
      _cachedUrl = null; // сбрасываем кеш — нужно перешифровать
      // Сбрасываем iframe, чтобы при следующем открытии подхватить новые данные
      var frame = d.getElementById('mdcFrame');
      if (frame) { frame.src = ''; frame.style.display = 'none'; }
      var loading = d.getElementById('mdcLoading');
      if (loading) loading.style.display = '';
    },

    /**
     * Задать ID сессии вручную.
     * Полезно для передачи server-side session ID.
     * @param {string} id
     */
    setSession: function(id) {
      _sessionId = id;
      _cachedUrl = null;
      var frame = d.getElementById('mdcFrame');
      if (frame) { frame.src = ''; frame.style.display = 'none'; }
      var loading = d.getElementById('mdcLoading');
      if (loading) loading.style.display = '';
    },

    /**
     * Построить URL chat.html со всеми параметрами.
     * Используется для встраивания чата в элемент страницы (не popup).
     * @param {string} [sid]   ID сессии (опционально, иначе берётся из cookie)
     * @returns {Promise<string>}
     */
    buildChatUrl: function(sid) {
      return _buildUrl(sid);
    },
  };

  // Обратная совместимость — глобальная openChat() для inline-обработчиков onclick
  w.openChat = function(e) { if (e) e.preventDefault(); _open(); };

}(window, document));
