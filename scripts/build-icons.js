// node scripts/build-icons.js  → writes public/css/icons.css
// Replaces Font Awesome: existing <i class="fa-solid fa-xxx"> markup renders as inline SVG (CSS mask). To add an icon, add a line to P (path) and A (FA name → key).
const fs=require('fs');
const P={
house:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
bookmark:'M6 3h12v18l-6-4-6 4z',
grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
clipboard:'M9 3h6v3H9zM7 5H5v16h14V5h-2M9 11h6M9 15h6',
user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6',
search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
logout:'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
left:'M19 12H5M12 19l-7-7 7-7', right:'M5 12h14M12 5l7 7-7 7',
pin:'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
star:'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1z',
check:'M20 6 9 17l-5-5', x:'M18 6 6 18M6 6l12 12',
cr:'M9 6l6 6-6 6', cd:'M6 9l6 6 6-6', cu:'M6 15l6-6 6 6',
phone:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
msg:'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
share:'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
flag:'M5 22V4M5 4h12l-2 4 2 4H5',
eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
eyeoff:'M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9',
plus:'M12 5v14M5 12h14', pen:'M4 20h4L19 9l-4-4L4 16z',
trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
lock:'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
copy:'M9 9h11v11H9zM5 15H4V4h11v1',
gift:'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2 0-4-1-4-3a2 2 0 0 1 4 0zM12 8c2 0 4-1 4-3a2 2 0 0 0-4 0z',
crown:'M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11',
info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.01',
send:'M22 2 11 13M22 2l-7 20-4-9-9-4z',
loader:'M12 3a9 9 0 1 0 9 9',
cal:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
userplus:'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a8 8 0 0 1 16 0M19 8v6M16 11h6',
shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
wrench:'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.7 2.7-2.3-.7-.7-2.3z',
mail:'M3 5h18v14H3zM3 6l9 7 9-7',
camera:'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
ok:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6',
warn:'M12 3 2 21h20zM12 10v5M12 18v.01',
ban:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM5 5l14 14',
bolt:'M13 2 4 14h7l-1 8 9-12h-7z',
clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2',
list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
rocket:'M5 19c-1 0-2-1-2-2 0-2 2-3 3-3l3 3c0 1-1 3-3 3zM9 15l-3-3 6-8c3-2 7-2 9-2 0 2 0 6-2 9l-8 6zM15 9h.01',
chart:'M4 20V10M10 20V4M16 20v-8M22 20H2',
dot:'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
qr:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3',
box:'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21v3h-.2a1.7 1.7 0 0 0-1.4 1z'
};
const A={'house':'house','home':'house','bookmark':'bookmark','bookmark-slash':'bookmark','border-all':'grid','grid-2':'grid','clipboard-list':'clipboard','user':'user','users':'users','magnifying-glass':'search','bell':'bell','right-from-bracket':'logout','arrow-left':'left','arrow-right':'right','arrow-up-right-from-square':'right','location-dot':'pin','map-marker-alt':'pin','star':'star','check':'check','xmark':'x','chevron-right':'cr','chevron-down':'cd','chevron-up':'cu','phone':'phone','phone-volume':'phone','comment-sms':'msg','comment':'msg','share-nodes':'share','flag':'flag','flag-checkered':'flag','eye':'eye','eye-slash':'eyeoff','plus':'plus','pen':'pen','trash':'trash','lock':'lock','copy':'copy','gift':'gift','crown':'crown','circle-info':'info','circle-question':'info','paper-plane':'send','spinner':'loader','calendar-check':'cal','calendar-days':'cal','calendar-xmark':'cal','user-plus':'userplus','shield':'shield','shield-halved':'shield','shield-check':'shield','wrench':'wrench','envelope':'mail','camera':'camera','circle-check':'ok','check-circle':'ok','triangle-exclamation':'warn','ban':'ban','bolt':'bolt','clock':'clock','hourglass-half':'clock','list':'list','list-check':'list','rocket':'rocket','chart-line':'chart','chart-bar':'chart','qrcode':'qr','box':'box','boxes-stacked':'box','sliders':'gear','headset':'phone','inbox':'mail','tag':'box','store':'box','arrow-trend-up':'chart','rotate':'loader','rotate-right':'loader','rotate-left':'left','file-lines':'list','pen-to-square':'pen','flask':'info','crosshairs':'pin','home':'house'};
const svg=d=>`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;
let css=`/* generated by scripts/build-icons.js — do not edit by hand */
.fa-solid,.fa-regular,.fa-brands{--ic:${svg(P.dot)};display:inline-block;width:1em;height:1em;vertical-align:-.125em;background-color:currentColor;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat;font-style:normal;flex-shrink:0}
.fa-spin{animation:fxspin .8s linear infinite}@keyframes fxspin{to{transform:rotate(360deg)}}
.fa-fw{width:1.25em}\n`;
for(const [fa,k] of Object.entries(A)) css+=`.fa-${fa}{--ic:${svg(P[k])}}\n`;
const filled=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linejoin='round'%3E%3Cpath d='${P.star}'/%3E%3C/svg%3E")`;
css+=`.fa-solid.fa-star{--ic:${filled}}\n.fa-solid.fa-bookmark{--ic:${svg(P.bookmark).replace("fill='none'","fill='%23000'")}}\n`;
fs.mkdirSync('public/css',{recursive:true});fs.writeFileSync('public/css/icons.css',css);console.log('icons:',Object.keys(A).length);
