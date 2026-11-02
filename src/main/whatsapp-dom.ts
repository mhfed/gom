// Shared, read-only DOM predicate for auth and unread sampling. The login
// canvas label and auto-logout control were observed on official WhatsApp Web.
// Signed-in structure is conservative; unknown/new layouts remain "ready".
export const whatsappStatusScript = `(()=>{
  const visible=e=>!!(e&&e.getClientRects().length);
  const linking=[...document.querySelectorAll('canvas[role="img"][aria-label],#auto-logout-toggle')].some(e=>visible(e)&&(e.id==='auto-logout-toggle'||/scan.*QR.*link|quét.*QR.*liên kết/i.test(e.getAttribute('aria-label')||'')));
  if(linking)return 'needs-login';
  if(visible(document.querySelector('#side'))&&visible(document.querySelector('#side header'))&&visible(document.querySelector('#side #pane-side')))return 'authenticated';
  const phoneLink=[...document.querySelectorAll('button,[role="button"]')].some(e=>visible(e)&&/^(Log in with QR code|Đăng nhập bằng mã QR)$/i.test(e.textContent.trim()));
  return phoneLink?'needs-login':'ready';
})()`;
