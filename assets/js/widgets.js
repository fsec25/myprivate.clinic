(function () {
  const API_URL = '/api/chat';

  /* ── Styles ── */
  const style = document.createElement('style');
  style.textContent = `
    /* WhatsApp widget */
    .mpc-wa {
      position: fixed;
      bottom: 28px;
      left: 28px;
      z-index: 9990;
    }
    .mpc-wa-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #25D366;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(37,211,102,0.45);
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .mpc-wa-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(37,211,102,0.55); }

    /* Chat toggle button */
    .mpc-chat {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 9990;
      font-family: 'Jost', sans-serif;
    }
    .mpc-chat-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #0D2B1F;
      border: 2px solid rgba(201,168,76,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(13,43,31,0.5);
      cursor: pointer;
      margin-left: auto;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .mpc-chat-toggle:hover { transform: scale(1.06); box-shadow: 0 6px 32px rgba(13,43,31,0.6); }
    @keyframes mpc-glow-pulse {
      0%, 100% { box-shadow: 0 4px 24px rgba(13,43,31,0.5), 0 0 0 0 rgba(201,168,76,0.5); }
      50% { box-shadow: 0 4px 24px rgba(13,43,31,0.5), 0 0 0 10px rgba(201,168,76,0); }
    }
    .mpc-chat-toggle { animation: mpc-glow-pulse 2.4s ease-in-out infinite; }

    /* Panel */
    .mpc-chat-panel {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 420px;
      background: #fff;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 60px rgba(0,0,0,0.2);
      overflow: hidden;
      display: none;
      flex-direction: column;
      height: 100dvh;
      max-height: 100dvh;
    }
    @media (min-height: 700px) {
      .mpc-chat-panel {
        bottom: 100px;
        right: 28px;
        border-radius: 16px;
        height: calc(100dvh - 140px);
        max-height: 720px;
      }
    }
    .mpc-chat-panel.open { display: flex; }

    /* Header */
    .mpc-chat-head {
      background: #0D2B1F;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .mpc-head-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(201,168,76,0.15);
      border: 1px solid rgba(201,168,76,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .mpc-head-text { flex: 1; }
    .mpc-chat-head h4 {
      color: #F7F3EB;
      font-size: 15px;
      font-weight: 500;
      margin: 0 0 3px;
      letter-spacing: 0.02em;
    }
    .mpc-chat-head p {
      color: rgba(247,243,235,0.5);
      font-size: 11px;
      margin: 0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .mpc-chat-close {
      background: none;
      border: none;
      color: rgba(247,243,235,0.5);
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.2s;
    }
    .mpc-chat-close:hover { color: #F7F3EB; }

    /* Body */
    .mpc-chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .mpc-msg {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .mpc-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #0D2B1F;
      border: 1px solid rgba(201,168,76,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .mpc-bubble {
      background: #F4F4F4;
      border-radius: 4px 16px 16px 16px;
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 270px;
    }
    .mpc-bubble a { color: #C9A84C; text-decoration: none; }
    .mpc-user-bubble {
      background: #0D2B1F;
      color: #F7F3EB;
      border-radius: 16px 4px 16px 16px;
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.7;
      max-width: 240px;
      margin-left: auto;
    }

    /* Quick replies */
    .mpc-quick-replies {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 42px;
      margin-top: -4px;
    }
    .mpc-quick-btn {
      background: #fff;
      border: 1.5px solid rgba(13,43,31,0.2);
      color: #0D2B1F;
      font-family: 'Jost', sans-serif;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.03em;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    .mpc-quick-btn:hover { background: #0D2B1F; color: #F7F3EB; border-color: #0D2B1F; }
    .mpc-quick-btn.used { opacity: 0.4; pointer-events: none; }

    /* Typing indicator */
    .mpc-typing {
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 4px 2px;
    }
    .mpc-typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #aaa;
      animation: mpc-bounce 1.2s infinite;
    }
    .mpc-typing span:nth-child(2) { animation-delay: 0.2s; }
    .mpc-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes mpc-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    /* Input */
    .mpc-input-wrap {
      padding: 12px 14px;
      border-top: 1px solid rgba(0,0,0,0.07);
      display: flex;
      gap: 10px;
      align-items: flex-end;
      flex-shrink: 0;
      background: #fafafa;
    }
    .mpc-input {
      flex: 1;
      border: 1.5px solid rgba(0,0,0,0.12);
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 14px;
      font-family: 'Jost', sans-serif;
      outline: none;
      resize: none;
      line-height: 1.4;
      background: #fff;
      transition: border-color 0.2s;
    }
    .mpc-input:focus { border-color: #C9A84C; }
    .mpc-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #0D2B1F;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .mpc-send:hover { background: #1a4a35; }
    .mpc-send:disabled { background: #ccc; cursor: default; }

    /* Footer CTAs */
    .mpc-chat-foot {
      padding: 10px 14px 14px;
      border-top: 1px solid rgba(0,0,0,0.06);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      background: #fafafa;
    }
    .mpc-chat-foot a {
      flex: 1;
      text-align: center;
      padding: 10px 8px;
      font-size: 12px;
      font-family: 'Jost', sans-serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .mpc-foot-book { background: #C9A84C; color: #0D2B1F; }
    .mpc-foot-book:hover { background: #b8963e; }
    .mpc-foot-call { background: #0D2B1F; color: #F7F3EB; }
    .mpc-foot-call:hover { background: #1a4a35; }

    /* Greeting bubble */
    .mpc-greeting {
      position: absolute;
      bottom: 72px;
      right: 0;
      background: #0D2B1F;
      color: #F7F3EB;
      font-family: 'Jost', sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.5;
      padding: 12px 16px 12px 14px;
      border-radius: 12px 12px 0 12px;
      border: 1px solid rgba(201,168,76,0.3);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.4s ease, transform 0.4s ease;
      pointer-events: none;
      cursor: pointer;
    }
    .mpc-greeting.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }
    .mpc-greeting.hiding {
      opacity: 0;
      transform: translateY(8px);
    }
    .mpc-greeting-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      flex-shrink: 0;
      animation: mpc-bounce 2s infinite;
    }
    .mpc-greeting-close {
      background: none;
      border: none;
      color: rgba(247,243,235,0.45);
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      margin-left: 4px;
      transition: color 0.2s;
    }
    .mpc-greeting-close:hover { color: #F7F3EB; }

    @media (max-width: 440px) {
      .mpc-chat-panel { width: 100vw; right: 0; border-radius: 16px 16px 0 0; bottom: 0; height: 100dvh; max-height: 100dvh; }
      .mpc-chat { bottom: 20px; right: 20px; }
      .mpc-bubble { max-width: calc(100vw - 100px); }
    }
  `;
  document.head.appendChild(style);

  /* ── WhatsApp button ── */
  const wa = document.createElement('div');
  wa.className = 'mpc-wa';
  wa.innerHTML = `
    <a class="mpc-wa-btn" href="https://wa.me/447424172034?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20an%20appointment" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.847L.047 23.998l6.345-1.463A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.791 9.791 0 01-5.006-1.374l-.36-.214-3.716.856.883-3.614-.234-.37A9.79 9.79 0 012.182 12C2.182 6.569 6.569 2.182 12 2.182c5.43 0 9.818 4.387 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
    </a>`;
  document.body.appendChild(wa);

  /* ── AI Chatbot ── */
  const avatarSVG = `<svg width="16" height="19" viewBox="0 0 62 76" fill="none"><path d="M2 2 H60 V46 Q60 68 31 74 Q2 68 2 46 Z" stroke="#C9A84C" stroke-width="3" fill="none"/><text x="31" y="55" text-anchor="middle" font-family="serif" font-size="40" font-weight="600" fill="#F7F3EB">P</text></svg>`;

  const chat = document.createElement('div');
  chat.className = 'mpc-chat';
  chat.innerHTML = `
    <div class="mpc-chat-panel" id="mpcPanel">
      <div class="mpc-chat-head">
        <div class="mpc-head-avatar">${avatarSVG}</div>
        <div class="mpc-head-text">
          <h4>My Private Clinic</h4>
          <p>Ask us anything</p>
        </div>
        <button class="mpc-chat-close" id="mpcClose" aria-label="Close chat">&#x2715;</button>
      </div>
      <div class="mpc-chat-body" id="mpcBody">
        <div class="mpc-msg">
          <div class="mpc-avatar">${avatarSVG}</div>
          <div class="mpc-bubble">Hello! How can I help you today?</div>
        </div>
        <div class="mpc-quick-replies" id="mpcQuickReplies">
          <button class="mpc-quick-btn" data-msg="I'd like to book an appointment">Book an appointment</button>
          <button class="mpc-quick-btn" data-msg="What are your prices?">View pricing</button>
          <button class="mpc-quick-btn" data-msg="Where are you located?">Find the clinic</button>
          <button class="mpc-quick-btn" data-msg="What services do you offer?">Ask a question</button>
        </div>
      </div>
      <div class="mpc-input-wrap">
        <textarea class="mpc-input" id="mpcInput" rows="1" placeholder="Type your message…" aria-label="Your message"></textarea>
        <button class="mpc-send" id="mpcSend" aria-label="Send">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F7F3EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="mpc-chat-foot">
        <a href="https://ehr.usejump.co.uk/patient/book/HWPXF87Q/in-person-appointments-fatima--ox2khu" target="_blank" rel="noopener" class="mpc-foot-book">Book Online</a>
        <a href="tel:07424172034" class="mpc-foot-call">Call Us</a>
      </div>
    </div>
    <div class="mpc-greeting" id="mpcGreeting">
      <span class="mpc-greeting-dot"></span>
      <span id="mpcGreetingText">Any questions? I'm here to help.</span>
      <button class="mpc-greeting-close" id="mpcGreetingClose" aria-label="Dismiss">&#x2715;</button>
    </div>
    <button class="mpc-chat-toggle" id="mpcToggle" aria-label="Open chat" aria-expanded="false">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    </button>`;
  document.body.appendChild(chat);

  const panel   = document.getElementById('mpcPanel');
  const toggle  = document.getElementById('mpcToggle');
  const closeBtn= document.getElementById('mpcClose');
  const body    = document.getElementById('mpcBody');
  const input   = document.getElementById('mpcInput');
  const sendBtn = document.getElementById('mpcSend');
  const quickReplies = document.getElementById('mpcQuickReplies');

  const history = [];
  const greeting = document.getElementById('mpcGreeting');
  const greetingClose = document.getElementById('mpcGreetingClose');

  // Show greeting after 8 seconds, hide after 12 seconds
  const greetingTimer = setTimeout(() => {
    if (!panel.classList.contains('open')) {
      greeting.classList.add('visible');
      setTimeout(() => hideGreeting(), 12000);
    }
  }, 8000);

  function hideGreeting() {
    greeting.classList.add('hiding');
    setTimeout(() => greeting.remove(), 400);
  }

  greetingClose.addEventListener('click', (e) => {
    e.stopPropagation();
    hideGreeting();
  });

  greeting.addEventListener('click', () => {
    hideGreeting();
    panel.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    setTimeout(() => input.focus(), 100);
  });

  // Scroll trigger — show pricing teaser when pricing section enters viewport
  const pricingSection = document.querySelector('.lp-pricing');
  if (pricingSection) {
    let pricingTriggered = false;
    const pricingObserver = new IntersectionObserver((entries) => {
      if (pricingTriggered) return;
      if (entries[0].isIntersecting && !panel.classList.contains('open')) {
        pricingTriggered = true;
        pricingObserver.disconnect();
        clearTimeout(greetingTimer);
        const greetingText = document.getElementById('mpcGreetingText');
        if (greetingText) greetingText.textContent = 'Not sure which appointment to book?';
        if (!greeting.classList.contains('hiding')) {
          greeting.classList.add('visible');
          setTimeout(() => hideGreeting(), 10000);
        }
      }
    }, { threshold: 0.2 });
    pricingObserver.observe(pricingSection);
  }

  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
    if (isOpen) setTimeout(() => input.focus(), 100);
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  });

  // Quick reply buttons
  quickReplies.addEventListener('click', (e) => {
    const btn = e.target.closest('.mpc-quick-btn');
    if (!btn) return;
    // Fade out all quick replies
    quickReplies.querySelectorAll('.mpc-quick-btn').forEach(b => b.classList.add('used'));
    setTimeout(() => quickReplies.remove(), 400);
    sendMessage(btn.dataset.msg);
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener('click', () => sendMessage());

  function appendUserBubble(text) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;';
    row.innerHTML = `<div class="mpc-user-bubble">${escHtml(text)}</div>`;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function appendBotBubble(html) {
    const row = document.createElement('div');
    row.className = 'mpc-msg';
    row.innerHTML = `<div class="mpc-avatar">${avatarSVG}</div><div class="mpc-bubble">${html}</div>`;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'mpc-msg';
    row.id = 'mpcTyping';
    row.innerHTML = `<div class="mpc-avatar">${avatarSVG}</div><div class="mpc-bubble"><div class="mpc-typing"><span></span><span></span><span></span></div></div>`;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function escHtml(str) {
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,'<em>$1</em>')
      .replace(/\n/g,'<br>');
  }

  async function sendMessage(overrideText) {
    const text = overrideText || input.value.trim();
    if (!text) return;

    if (!overrideText) {
      input.value = '';
      input.style.height = 'auto';
    }
    sendBtn.disabled = true;

    appendUserBubble(text);
    history.push({ role: 'user', content: text });

    const typingRow = showTyping();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      typingRow.remove();
      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const reply = data.reply || 'Sorry, I couldn\'t get a response. Please call us on 07424 172034.';

      history.push({ role: 'assistant', content: reply });
      appendBotBubble(escHtml(reply));

    } catch {
      typingRow.remove();
      appendBotBubble('Sorry, something went wrong. Please <a href="tel:07424172034">call us</a> or <a href="https://wa.me/447424172034" target="_blank" rel="noopener">WhatsApp</a> directly.');
    }

    sendBtn.disabled = false;
    if (!overrideText) input.focus();
  }
})();
