export const authScript = `(()=>{
  const visible=e=>!!(e&&e.getClientRects().length);
  // Reading innerText can force layout; only ambiguous Telegram/Zalo pages need it.
  const loginText=()=>(document.body?.innerText||'').slice(0,30000);
  if(/checkpoint|login|sign.?in|recover|two_step_verification/.test(location.pathname)||visible(document.querySelector('input[type=password]')))return 'needs-login';
  if(location.hostname.includes('facebook.com')||location.hostname.includes('messenger.com')){
    const heading=[...document.querySelectorAll('h1,h2,[role=heading]')].some(e=>visible(e)&&/^(Chats|Đoạn chat|Chat|Tin nhắn)$/i.test(e.textContent.trim()));
    const compose=[...document.querySelectorAll('a,button,[role=button]')].some(e=>visible(e)&&/new message|tin nhắn mới/i.test((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')));
    return heading&&compose?'authenticated':'ready';
  }
  if(location.hostname==='mail.google.com'){
    const inbox=[...document.querySelectorAll('[role="main"],[gh="mtb"],[data-tooltip="Inbox"],[data-tooltip="Hộp thư đến"]')].some(visible);
    return inbox?'authenticated':'ready';
  }
  if(location.hostname==='www.instagram.com'||location.hostname==='instagram.com'){
    const signedIn=[...document.querySelectorAll('a[href^="/direct/"],a[href*="/direct/inbox"],svg[aria-label="Messenger"]')].some(visible);
    return signedIn?'authenticated':'ready';
  }
  if(location.hostname==='slack.com'||location.hostname.endsWith('.slack.com')){
    const signedIn=[...document.querySelectorAll('[data-qa="channel_sidebar"],[data-qa="workspace_name"],[data-qa="workspace_switcher"]')].some(visible);
    return signedIn?'authenticated':'ready';
  }
  if(location.hostname==='discord.com'||location.hostname.endsWith('.discord.com')||location.hostname.endsWith('.discordapp.com')){
    const signedIn=[...document.querySelectorAll('#app-mount [data-list-item-id^="guildsnav"],#app-mount [aria-label="Direct Messages"],#app-mount [aria-label="Servers"]')].some(visible);
    return signedIn?'authenticated':'ready';
  }
  if(location.hostname==='tinder.com'||location.hostname==='www.tinder.com'){
    if(/^\/app\/login(?:\/|$)/.test(location.pathname))return 'needs-login';
    return localStorage.getItem('TinderWeb/APIToken')?'authenticated':'ready';
  }
  if(location.hostname==='web.telegram.org'){
    if(document.querySelector('.auth-pages,.auth-qr-form,.page-auth'))return 'needs-login';
    if(document.querySelector('.chatlist .chatlist-chat,.chatlist a[data-peer-id],.chatlist-chat'))return 'authenticated';
    return /Log in by QR Code|Log in to Telegram|Đăng nhập vào Telegram|Scan.*QR/i.test(loginText())?'needs-login':'ready';
  }
  if(location.hostname==='chat.zalo.me'&&visible(document.querySelector('#contact-search-input,input[placeholder*="Tìm kiếm"],.chat-list')))return 'authenticated';
  if(location.hostname.endsWith('zalo.me')){
    if(/Quét mã QR|Đăng nhập.*Zalo|Scan.*QR/i.test(loginText()))return 'needs-login';
    return document.querySelector('#contact-search-input,input[placeholder*="Tìm kiếm"],.chat-list')?'authenticated':'ready';
  }
  return 'ready';
})()`;
