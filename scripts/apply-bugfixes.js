// node scripts/apply-bugfixes.js — fixes the page-side payment bugs (safe to re-run)
const fs=require('fs');
const edit=(f,pairs)=>{let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs)s=s.split(a).join(b);fs.writeFileSync(f,s);console.log('patched',f);};
// signup pages save to localStorage, so payment-success must read localStorage
edit('public/payment-success.html',[
 ["sessionStorage.getItem(storageKey)","localStorage.getItem(storageKey)"],
 ["sessionStorage.getItem('paymongo_session_id')","localStorage.getItem('paymongo_session_id')"],
 ["sessionStorage.removeItem(storageKey)","localStorage.removeItem(storageKey)"],
 ["sessionStorage.removeItem('paymongo_session_id')","localStorage.removeItem('paymongo_session_id')"],
 ["sessionStorage.getItem('paypal_order_id') || token","localStorage.getItem('paypal_order_id') || token"],
 ["sessionStorage.removeItem('paypal_order_id')","localStorage.removeItem('paypal_order_id')"]]);
// upgrade checkout: APIs return approvalUrl / checkoutUrl, not url
edit('public/profile.html',[["if (d.url) window.location.href = d.url;","const _u = d.approvalUrl || d.checkoutUrl || d.url; if (_u) window.location.href = _u;"]]);
