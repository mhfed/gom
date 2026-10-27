/** Only count indicators are returned; message text and account identifiers never leave the view. */
export const unreadScript = `(()=>{
 const host=location.hostname;
 if(host==='mail.google.com'){
  const title=document.title.match(/^\\(([\\d,]+\\+?)\\)/);
  const label=[...document.querySelectorAll('[aria-label],[data-tooltip]')].map(e=>e.getAttribute('aria-label')||e.getAttribute('data-tooltip')||'').find(v=>/(?:Inbox|Hộp thư đến).*?\\d/i.test(v));
  const count=label?.match(/(\\d[\\d,]*\\+?)/)?.[1];
  return {global:title?.[1]??count??null,loaded:null,kind:'messages'};
 }
 if(host==='www.instagram.com'||host==='instagram.com'){
  const title=document.title.match(/^\\((\\d+\\+?)\\)/);
  const labels=[...document.querySelectorAll('[aria-label],[title]')].map(e=>e.getAttribute('aria-label')||e.getAttribute('title')||'');
  const labeledCount=labels.map(v=>v.match(/(\\d+\\+?).{0,32}(?:unread|new messages?|tin nhắn mới|tin nhắn chưa đọc)/i)?.[1]).find(Boolean);
  const unreadMarker=document.querySelector('[aria-label="Unread"],[aria-label="Chưa đọc"],[data-testid*="unread"]');
  return {global:title?.[1]??labeledCount??(unreadMarker?'1+':null),loaded:null,kind:'conversations'};
 }
 if(host==='slack.com'||host.endsWith('.slack.com')){
  const title=document.title.match(/^\\(([\\d,]+\\+?)\\)/);
  const badges=[...document.querySelectorAll('[data-qa="channel_sidebar_unread_badge"],[data-qa="unread_badge"]')].map(e=>e.textContent.trim()).filter(v=>/^\\d+(?:,\\d{3})*\\+?$/.test(v));
  const total=badges.reduce((sum,v)=>sum+Number(v.replace(/[,+]/g,'')),0);
  const totalText=total?String(total)+(badges.some(v=>v.endsWith('+'))?'+':''):null;
  const unreadMarker=document.querySelector('[aria-label="Unread"],[aria-label="Chưa đọc"]');
  return {global:title?.[1]??totalText??(unreadMarker?'1+':null),loaded:null,kind:'conversations'};
 }
 if(host==='discord.com'||host.endsWith('.discord.com')||host.endsWith('.discordapp.com')){
  const title=document.title.match(/^\\((\\d+\\+?)\\)/);
  const unreadMarker=document.querySelector('[aria-label="Unread"],[aria-label="Chưa đọc"]');
  return {global:title?.[1]??(unreadMarker?'1+':null),loaded:null,kind:'conversations'};
 }
 if(host==='web.telegram.org'){
  const tab=[...document.querySelectorAll('[role="tab"]')].find(e=>{const label=e.cloneNode(true);label.querySelectorAll('.badge').forEach(b=>b.remove());return /^(Unread|Chưa đọc)$/i.test(label.textContent.trim());});
  const badge=tab?.querySelector('.badge');
  return {global:badge?.textContent.trim()??null,loaded:null,kind:'conversations'};
 }
 if(host==='chat.zalo.me'){
  const nav=[...document.querySelectorAll('.z-noti-badge-container')].find(e=>e.querySelector('.fa-Message_28_Filled,.fa-Message_28_Line'));
  if(!nav)return {global:null,loaded:null,kind:'messages'};
  const badge=nav.querySelector('[class*="leftbar-unread-badge"],.z-noti-badge__content,[data-count]');
  const glyph=(badge?.className+' '+(badge?.querySelector('.z-noti-badge__content')?.className||'')).match(/(?:^|\\s)fa-(\\d+)(_Plus|plus)?(?:_|$)/i);
  const value=glyph?(glyph[1]+(glyph[2]?'+':'')):(badge?.getAttribute('data-count')??badge?.textContent.trim());
  const emptyKnownNav=!badge&&nav.children.length===1&&nav.firstElementChild.matches('.fa-Message_28_Filled,.fa-Message_28_Line')&&!nav.textContent.trim();
  return {global:value||(emptyKnownNav?'0':null),loaded:null,kind:'messages'};
 }
 const tabs=[...document.querySelectorAll('[role=tab]')];
 const countTab=tabs.map(e=>e.textContent.trim().match(/^(?:Unread|Chưa đọc)\\s*(\\d+\\+?)$/i)).find(Boolean);
 if(countTab)return {global:countTab[1],loaded:null,kind:'conversations'};
 const dots=document.querySelectorAll('[data-testid="mwthreadlist-item-unread-dot"],[data-testid="unread_indicator"],[aria-label="Unread"],[aria-label="Chưa đọc"]');
 const rows=new Set([...dots].map(e=>e.closest('[role="row"]')).filter(Boolean));
 const title=document.title.match(/^\\((\\d+)\\)\\s*Messenger(?:\\s*\\||$)/i);
 return {global:title?.[1]??null,loaded:rows.size||null,kind:'conversations'};
})()`;
