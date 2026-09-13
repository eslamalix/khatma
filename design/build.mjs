// Generates the mockup artboards (.dc.html) + canvas.json for the Quran KPIs design canvas.
import { writeFileSync } from 'node:fs';

const C = {
  bg: '#F7F5F0', paper: '#FBF9F4', card: '#FFFFFF', ink: '#1D1C1A', ink2: '#6E6B64', ink3: '#A9A59C',
  line: 'rgba(29,28,26,0.08)', track: '#ECE9E2', accent: '#2F6F5C', accentSoft: '#E6EFEA', warm: '#B4674A',
  heat: ['#EDEAE3', '#D3E4DC', '#A8CBBB', '#6FA68E', '#2F6F5C'],
};

const head = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri+Quran&amp;family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&amp;display=swap">
  <style>
    body { margin: 0; background: ${C.bg}; font-family: 'IBM Plex Sans Arabic', -apple-system, 'SF Arabic', 'Segoe UI', Tahoma, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
    a { color: ${C.accent}; } a:hover { color: #245747; }
    * { box-sizing: border-box; }
    .q { font-family: 'Amiri Quran', 'Amiri', 'Traditional Arabic', serif; }
  </style>
</helmet>
`;
const foot = `</x-dc>
</body>
</html>
`;

const icons = {
  quran: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"></path><path d="M12 6.5v13"></path>',
  awrad: '<circle cx="12" cy="4" r="1.5"></circle><circle cx="16.95" cy="6.05" r="1.5"></circle><circle cx="19" cy="11" r="1.5"></circle><circle cx="16.95" cy="15.95" r="1.5"></circle><circle cx="7.05" cy="6.05" r="1.5"></circle><circle cx="5" cy="11" r="1.5"></circle><circle cx="7.05" cy="15.95" r="1.5"></circle><circle cx="12" cy="18" r="1.5"></circle><path d="M12 19.5V22"></path>',
  home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"></path>',
  stats: '<path d="M5.5 20v-7M12 20V5M18.5 20v-9.5"></path>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"></rect><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"></path>',
};
const svg = (paths, size = 24, color = 'currentColor', sw = 1.7) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const chevL = '<path d="M14.5 6l-6 6 6 6"></path>';
const chevR = '<path d="M9.5 6l6 6-6 6"></path>';
const chevD = '<path d="M7 10l5 5 5-5"></path>';

function tabBar(active) {
  const tabs = [['quran', 'القرآن'], ['awrad', 'الأوراد'], ['home', 'الرئيسية'], ['stats', 'الإحصائيات'], ['calendar', 'التقويم']];
  const items = tabs.map(([k, label]) => {
    const col = k === active ? C.accent : '#8E8A82';
    return `    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px; width: 66px; height: 50px; justify-content: center; color: ${col}">
      ${svg(icons[k], 25, col, k === active ? 2 : 1.7)}
      <span style="font-size: 10.5px; font-weight: ${k === active ? 600 : 500}">${label}</span>
    </div>`;
  }).join('\n');
  return `  <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: rgba(247,245,240,0.88); backdrop-filter: blur(20px); border-top: 1px solid ${C.line}; display: flex; justify-content: space-around; align-items: flex-start; padding: 6px 8px 0">
${items}
  </div>`;
}

const screen = (body, bg = C.bg) =>
  `<div dir="rtl" style="width: 390px; height: 844px; position: relative; overflow: hidden; background: ${bg}">
${body}
</div>
`;

const card = (inner, extra = '') =>
  `<div style="background: ${C.card}; border-radius: 22px; box-shadow: 0 1px 2px rgba(29,28,26,0.04), 0 8px 24px rgba(29,28,26,0.05); ${extra}">${inner}</div>`;

function segmented(opts, active) {
  return `<div style="display: flex; background: ${C.track}; border-radius: 11px; padding: 2px; gap: 2px">
${opts.map((o) => `      <div style="flex: 1; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 13.5px; border-radius: 9px; ${o === active ? `background: ${C.card}; font-weight: 600; box-shadow: 0 1px 3px rgba(29,28,26,0.12)` : `color: ${C.ink2}; font-weight: 500`}">${o}</div>`).join('\n')}
    </div>`;
}

const largeTitle = (t, side = '') => `<div style="display: flex; align-items: center; justify-content: space-between; height: 44px">
      <div style="font-size: 32px; font-weight: 700; letter-spacing: -0.3px">${t}</div>
      ${side}
    </div>`;

// ---------------------------------------------------------------- Home
const home = screen(`  <div style="position: absolute; top: 64px; left: 12px; display: flex; flex-direction: column; align-items: flex-start; font-weight: 300; font-size: 150px; line-height: 0.9; color: rgba(47,111,92,0.10); letter-spacing: -4px; pointer-events: none">
    <div>١٠</div><div>٤٤</div><div>١٦</div>
  </div>
  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 14px">
    <div style="display: flex; justify-content: space-between; align-items: center; height: 36px">
      <div style="font-size: 14px; color: ${C.ink2}; font-weight: 500">الإثنين، ١٤ سبتمبر</div>
      <div style="width: 36px; height: 36px; border-radius: 18px; background: rgba(29,28,26,0.05); display: flex; align-items: center; justify-content: center; color: ${C.ink2}">${svg('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>', 19, C.ink2, 1.6)}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 18px">
      <div style="font-size: 17px; color: ${C.ink2}; font-weight: 500">ختمتك تحتاج منك</div>
      <div style="font-size: 44px; line-height: 1.12; font-weight: 700; letter-spacing: -0.5px">١٠ ساعات<br>و٤٤ دقيقة</div>
      <div style="font-size: 14.5px; color: ${C.ink2}">بمتوسط دقيقة و٤ ثوانٍ لكل صفحة</div>
    </div>
    ${card(`
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div style="font-size: 14px; color: ${C.ink2}; font-weight: 500">المتبقي من ختمتك الثانية</div>
        <div style="font-size: 12.5px; color: ${C.accent}; font-weight: 600; background: ${C.accentSoft}; padding: 3px 9px; border-radius: 20px">٨٪ مكتمل</div>
      </div>
      <div dir="ltr" style="text-align: right; font-size: 46px; font-weight: 500; letter-spacing: -0.5px; margin: 6px 0 12px; font-variant-numeric: tabular-nums">٩:٥٢:٠٠</div>
      <div style="height: 6px; border-radius: 3px; background: ${C.track}; overflow: hidden"><div style="width: 8%; height: 100%; background: ${C.accent}; border-radius: 3px"></div></div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: ${C.ink3}; margin-top: 8px">
        <div>٤٩ من ٦٠٤ صفحة</div><div>٥٥٥ صفحة متبقية</div>
      </div>`, 'background: rgba(255,255,255,0.72); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); padding: 18px 20px 16px')}
    <div style="text-align: center; font-size: 15px; color: ${C.accent}; font-weight: 600">كل دقيقة تفرق</div>
    <div style="height: 56px; border-radius: 18px; background: ${C.accent}; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 16.5px; font-weight: 600; box-shadow: 0 6px 18px rgba(47,111,92,0.25)">
      <span>أكمل القراءة</span><span style="opacity: 0.7; font-weight: 400">صفحة ٥٠ · آل عمران</span>
    </div>
    ${card(`
      <div style="font-size: 16px; font-weight: 600">قرأت البقرة في ٥١ دقيقة</div>
      <div style="font-size: 14px; color: ${C.ink2}; line-height: 1.6; margin-top: 2px">لو قرأت ٥١ دقيقة كل يوم، تختم القرآن في <span style="color: ${C.ink}; font-weight: 600">١٣ يوم</span>.</div>
      <div style="height: 1px; background: ${C.line}; margin: 12px 0"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13.5px">
        <div style="color: ${C.ink2}">لو قرأت يومياً</div>
        <div><span style="font-weight: 600">٣٠ دقيقة</span><span style="color: ${C.ink3}"> ← </span><span style="font-weight: 600; color: ${C.accent}">٢٢ يوم</span></div>
      </div>
      <div style="position: relative; height: 22px; margin-top: 6px">
        <div style="position: absolute; top: 9px; left: 0; right: 0; height: 4px; border-radius: 2px; background: ${C.track}"></div>
        <div style="position: absolute; top: 9px; right: 0; width: 42%; height: 4px; border-radius: 2px; background: ${C.accent}"></div>
        <div style="position: absolute; top: 0; right: calc(42% - 11px); width: 22px; height: 22px; border-radius: 11px; background: #fff; box-shadow: 0 1px 4px rgba(29,28,26,0.25)"></div>
      </div>`, 'background: rgba(255,255,255,0.72); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); padding: 16px 20px 14px')}
  </div>
${tabBar('home')}`);

// ---------------------------------------------------------------- Quran reader
const kpi = (label, value) => `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px">
        <div style="font-size: 11px; color: ${C.ink3}; font-weight: 500">${label}</div>
        <div style="font-size: 16px; font-weight: 600">${value}</div>
      </div>`;
const vdiv = `<div style="width: 1px; height: 26px; background: ${C.line}"></div>`;
const aya = (n) => ` <span style="color: ${C.accent}">﴿${n}﴾</span> `;
const quran = screen(`  <div style="position: absolute; top: 0; left: 0; right: 0; padding: 54px 16px 10px; display: flex; align-items: center; border-bottom: 1px solid ${C.line}; background: ${C.paper}">
      ${kpi('متوسط الصفحة', '١:٠٤ د')}
      ${vdiv}
      ${kpi('المتبقي', '٩٢٪')}
      ${vdiv}
      ${kpi('المدة المتبقية', '٩ س ٥٢ د')}
  </div>
  <div style="position: absolute; top: 112px; left: 0; right: 0; bottom: 144px; overflow: hidden; padding: 18px 22px 0">
    <div style="height: 46px; border: 1px solid rgba(47,111,92,0.35); border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative">
      <div style="position: absolute; inset: 3px; border: 1px solid rgba(47,111,92,0.18); border-radius: 9px"></div>
      <div class="q" style="font-size: 21px; color: ${C.accent}">سُورَةُ آلِ عِمۡرَانَ</div>
    </div>
    <div class="q" style="text-align: center; font-size: 23px; margin: 12px 0 2px">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
    <div class="q" style="font-size: 24.5px; line-height: 2.2; text-align: justify; text-align-last: center">
      الٓمٓ${aya('١')}<span style="background: rgba(47,111,92,0.07); color: #245747; border-radius: 4px; text-decoration: underline; text-decoration-color: rgba(47,111,92,0.55); text-decoration-thickness: 2px; text-underline-offset: 14px">ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُ</span>${aya('٢')}نَزَّلَ عَلَيۡكَ ٱلۡكِتَٰبَ بِٱلۡحَقِّ مُصَدِّقٗا لِّمَا بَيۡنَ يَدَيۡهِ وَأَنزَلَ ٱلتَّوۡرَىٰةَ وَٱلۡإِنجِيلَ${aya('٣')}مِن قَبۡلُ هُدٗى لِّلنَّاسِ وَأَنزَلَ ٱلۡفُرۡقَانَۗ إِنَّ ٱلَّذِينَ كَفَرُواْ بِـَٔايَٰتِ ٱللَّهِ لَهُمۡ عَذَابٞ شَدِيدٞۗ وَٱللَّهُ عَزِيزٞ ذُو ٱنتِقَامٍ${aya('٤')}إِنَّ ٱللَّهَ لَا يَخۡفَىٰ عَلَيۡهِ شَيۡءٞ فِي ٱلۡأَرۡضِ وَلَا فِي ٱلسَّمَآءِ${aya('٥')}هُوَ ٱلَّذِي يُصَوِّرُكُمۡ فِي ٱلۡأَرۡحَامِ كَيۡفَ يَشَآءُۚ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡعَزِيزُ ٱلۡحَكِيمُ${aya('٦')}
    </div>
    <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(to bottom, rgba(251,249,244,0), ${C.paper})"></div>
  </div>
  <div style="position: absolute; bottom: 158px; left: 50%; transform: translateX(-50%); background: ${C.ink}; color: #fff; border-radius: 16px; height: 44px; padding: 0 6px 0 16px; display: flex; align-items: center; gap: 12px; white-space: nowrap; box-shadow: 0 8px 24px rgba(29,28,26,0.22)">
    <span style="font-size: 13px; opacity: 0.7">٦ كلمات محددة</span>
    <div style="height: 32px; padding: 0 12px; border-radius: 11px; background: rgba(255,255,255,0.14); display: flex; align-items: center; font-size: 13.5px; font-weight: 600">احفظ في مجموعة</div>
  </div>
  <div style="position: absolute; left: 0; right: 0; bottom: 84px; height: 60px; background: ${C.paper}; border-top: 1px solid ${C.line}; display: flex; align-items: center; justify-content: space-between; padding: 0 10px">
    <div style="width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; color: ${C.ink2}">${svg(chevR, 22, C.ink2, 2)}</div>
    <div style="display: flex; align-items: center; background: rgba(29,28,26,0.05); border-radius: 14px; height: 40px; padding: 0 4px; font-size: 14px">
      <div style="padding: 0 12px; font-weight: 700">٥٠</div>
      <div style="width: 1px; height: 18px; background: rgba(29,28,26,0.12)"></div>
      <div style="padding: 0 12px; font-weight: 600">آل عمران</div>
      <div style="width: 1px; height: 18px; background: rgba(29,28,26,0.12)"></div>
      <div style="padding: 0 10px 0 6px; color: ${C.ink2}; display: flex; align-items: center; gap: 4px">الجزء ٣ ${svg(chevD, 14, C.ink3, 2)}</div>
    </div>
    <div style="width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center">${svg(chevL, 22, C.ink, 2)}</div>
  </div>
${tabBar('quran')}`, C.paper);

// ---------------------------------------------------------------- Awrad
const R = 72, CIRC = 2 * Math.PI * R;
const listRow = (title, sub, iconBg, iconInner, last) => `<div style="display: flex; align-items: center; gap: 12px; height: 58px; padding: 0 16px; ${last ? '' : `border-bottom: 1px solid ${C.line}`}">
        <div style="width: 34px; height: 34px; border-radius: 10px; background: ${iconBg}; display: flex; align-items: center; justify-content: center">${iconInner}</div>
        <div style="flex: 1; display: flex; flex-direction: column">
          <div style="font-size: 15.5px; font-weight: 600">${title}</div>
          <div style="font-size: 12.5px; color: ${C.ink3}">${sub}</div>
        </div>
        ${svg(chevL, 18, C.ink3, 2)}
      </div>`;
const shield = svg('<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"></path>', 18, C.accent, 1.8);
const leaf = svg('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"></path><path d="M5 19l7-7"></path>', 18, C.accent, 1.8);
const sun = svg('<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"></path>', 18, '#9A7B3C', 1.8);
const moon = svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>', 18, '#4D5B86', 1.8);
const chip = (t, on) => `<div style="height: 34px; padding: 0 14px; border-radius: 17px; display: flex; align-items: center; font-size: 13.5px; font-weight: ${on ? 600 : 500}; ${on ? `background: ${C.ink}; color: #fff` : `background: rgba(29,28,26,0.05); color: ${C.ink2}`}">${t}</div>`;
const awrad = screen(`  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 12px">
    ${largeTitle('الأوراد')}
    ${card(`
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div style="font-size: 13px; color: ${C.ink3}; font-weight: 500">المسبحة</div>
        ${svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"></path><path d="M4 4v4h4"></path>', 18, C.ink3, 1.8)}
      </div>
      <div style="position: relative; width: 168px; height: 168px; margin: 0 auto">
        <svg width="168" height="168" viewBox="0 0 168 168" style="transform: rotate(-90deg)">
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="${C.track}" stroke-width="8"></circle>
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="${C.accent}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(CIRC * 27 / 33).toFixed(1)} ${CIRC.toFixed(1)}"></circle>
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center">
          <div style="font-size: 50px; font-weight: 600; line-height: 1">٢٧</div>
          <div style="font-size: 13px; color: ${C.ink3}; margin-top: 4px">من ٣٣</div>
        </div>
      </div>
      <div class="q" style="text-align: center; font-size: 23px; line-height: 1.6; margin: 2px 0 8px">سُبۡحَانَ ٱللَّهِ</div>
      <div style="display: flex; gap: 8px; justify-content: center">
        ${chip('سبحان الله', true)}${chip('الحمد لله')}${chip('الله أكبر')}
        <div style="width: 34px; height: 34px; border-radius: 17px; background: rgba(29,28,26,0.05); display: flex; align-items: center; justify-content: center">${svg('<path d="M12 6v12M6 12h12"></path>', 16, C.ink2, 2)}</div>
      </div>`, 'padding: 14px 16px 16px')}
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px">
      <div style="font-size: 20px; font-weight: 700">مجموعاتي</div>
      <div style="font-size: 14.5px; color: ${C.accent}; font-weight: 500">+ جديدة</div>
    </div>
    ${card(`
      ${listRow('التحصين', '٤ مقاطع · آية الكرسي، خواتيم البقرة، المعوذات', C.accentSoft, shield)}
      ${listRow('الرقية', '٩ مقاطع', C.accentSoft, leaf, true)}`, 'overflow: hidden; border-radius: 18px')}
    <div style="font-size: 20px; font-weight: 700; padding: 0 4px">الأذكار</div>
    ${card(`
      ${listRow('أذكار الصباح', 'بعد الفجر', '#F4EEDF', sun)}
      ${listRow('أذكار المساء', 'بعد العصر', '#E8EBF3', moon, true)}`, 'overflow: hidden; border-radius: 18px')}
  </div>
${tabBar('awrad')}`);

// ---------------------------------------------------------------- Stats
const stat = (label, value) => `<div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center">
          <div style="font-size: 20px; font-weight: 700">${value}</div>
          <div style="font-size: 11.5px; color: ${C.ink3}; font-weight: 500">${label}</div>
        </div>`;
const rows = [
  ['٤٥', '١:٢٢ – ١:٢٣ م', '١:٠٥', 'أسرع ١١٪', 'fast'],
  ['٤٦', '١:٢٣ – ١:٢٤ م', '٠:٥٨', 'أسرع ٢٢٪', 'fast'],
  ['٤٧', '٩:١٤ – ٩:١٥ م', '١:١٠', 'أبطأ ٤٪', 'slow'],
  ['٤٨', '٩:١٥ – ٩:١٦ م', '١:٠٧', 'أسرع ٩٪', 'fast'],
  ['٤٩', '٩:١٦ – ٩:١٧ م', '١:٢٠', 'أسرع ٦٪', 'fast'],
  ['٥٠', 'الآن', '٠:٤٢', '', 'now'],
  ['٥١', '—', '—', '', 'unread'],
];
const cell = (w, inner, align = 'right') => `<div style="width: ${w}; text-align: ${align}">${inner}</div>`;
const tableRows = rows.map(([p, time, dur, ch, kind], i) => {
  const faded = kind === 'unread';
  const chCol = kind === 'fast' ? C.accent : C.warm;
  const timeCell = kind === 'now'
    ? `<span style="font-size: 12px; font-weight: 600; color: ${C.accent}; background: ${C.accentSoft}; padding: 3px 9px; border-radius: 20px">تقرأها الآن</span>`
    : kind === 'unread' ? `<span style="color: ${C.ink3}">لم تُقرأ بعد</span>`
    : `<div style="font-size: 13.5px">${time}</div><div style="font-size: 11px; color: ${C.ink3}">١٣ سبتمبر</div>`;
  return `      <div style="display: flex; align-items: center; height: 50px; padding: 0 16px; ${i < rows.length - 1 ? `border-bottom: 1px solid ${C.line};` : ''} ${faded ? 'opacity: 0.55;' : ''}">
        ${cell('44px', `<span style="font-size: 15px; font-weight: 700">${p}</span>`)}
        ${cell('142px', timeCell)}
        ${cell('60px', `<span style="font-size: 14.5px; font-weight: 500; font-variant-numeric: tabular-nums">${dur}</span>`)}
        ${cell('74px', ch ? `<span style="font-size: 12.5px; font-weight: 600; color: ${chCol}">${ch}</span>` : '', 'left')}
      </div>`;
}).join('\n');
const stats = screen(`  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 14px">
    ${largeTitle('الإحصائيات')}
    ${card(`
        ${stat('متوسط الصفحة', '١:٠٤')}
        ${vdiv}
        ${stat('هذه الختمة', '٤٩ ص')}
        ${vdiv}
        ${stat('إجمالي القراءة', '١١ س ٣٨ د')}`, 'display: flex; align-items: center; padding: 16px 8px')}
    <div style="background: ${C.accentSoft}; border-radius: 18px; padding: 14px 16px; display: flex; gap: 12px; align-items: center">
      <div style="width: 38px; height: 38px; border-radius: 19px; background: ${C.accent}; display: flex; align-items: center; justify-content: center">${svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"></path>', 18, '#fff', 1.9)}</div>
      <div style="flex: 1">
        <div style="font-size: 15.5px; font-weight: 600">قرأت البقرة أسرع بـ ١٨٪</div>
        <div style="font-size: 12.5px; color: ${C.ink2}; margin-top: 1px">٥١ دقيقة هذه الختمة، مقابل ٦٢ دقيقة في الختمة الأولى</div>
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px 0">
      <div style="font-size: 20px; font-weight: 700">سجل الصفحات</div>
      <div style="width: 170px">${segmented(['الكل', 'سورة', 'جزء'], 'الكل')}</div>
    </div>
    ${card(`
      <div style="display: flex; align-items: center; height: 34px; padding: 0 16px; font-size: 11.5px; color: ${C.ink3}; font-weight: 500; border-bottom: 1px solid ${C.line}">
        ${cell('44px', 'ص')}${cell('142px', 'البداية – النهاية')}${cell('60px', 'المدة')}${cell('74px', 'مقابل الأولى', 'left')}
      </div>
${tableRows}`, 'overflow: hidden; border-radius: 18px')}
  </div>
${tabBar('stats')}`);

// ---------------------------------------------------------------- Calendar shared header
const calHeader = (active) => `${largeTitle('التقويم', `<div style="height: 34px; padding: 0 8px 0 12px; border-radius: 17px; background: rgba(29,28,26,0.05); display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600">
        <div style="width: 22px; height: 22px; border-radius: 11px; background: ${C.accent}; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center">أ</div>أنا ${svg(chevD, 14, C.ink3, 2)}
      </div>`)}
    ${segmented(['شهر', 'أسبوع', 'يوم'], active)}`;
const periodNav = (label, sub) => `<div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0 0">
      <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center">${svg(chevR, 20, C.accent, 2)}</div>
      <div style="text-align: center">
        <div style="font-size: 18px; font-weight: 700">${label}</div>
        <div style="font-size: 12.5px; color: ${C.ink3}">${sub}</div>
      </div>
      <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center">${svg(chevL, 20, C.accent, 2)}</div>
    </div>`;
const d = (n) => String(n).replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[x]);

// ---------------------------------------------------------------- Calendar month
const mins = { 1: 30, 2: 12, 3: 0, 4: 25, 5: 40, 6: 22, 7: 35, 8: 0, 9: 18, 10: 41, 11: 64, 12: 16, 13: 37 };
const lvl = (m) => (m === 0 ? 0 : m < 15 ? 1 : m < 30 ? 2 : m < 45 ? 3 : 4);
const dayCells = [];
for (let i = 0; i < 2; i++) dayCells.push('<div></div>');
for (let n = 1; n <= 30; n++) {
  let style, col = C.ink;
  if (n in mins) { const l = lvl(mins[n]); style = `background: ${C.heat[l]}`; if (l === 4) col = '#fff'; }
  else if (n === 14) style = `box-shadow: inset 0 0 0 2px ${C.accent}`, col = C.accent;
  else style = 'background: transparent', col = C.ink3;
  dayCells.push(`<div style="height: 50px; border-radius: 12px; ${style}; display: flex; align-items: center; justify-content: center; font-size: 14.5px; font-weight: ${n === 14 ? 700 : 500}; color: ${col}">${d(n)}</div>`);
}
const weekdays = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const calMonth = screen(`  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 14px">
    ${calHeader('شهر')}
    ${periodNav('سبتمبر ٢٠٢٦', '٥ س ٤٠ د · ٣١٨ صفحة')}
    <div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-bottom: 6px">
        ${weekdays.map((w) => `<div style="text-align: center; font-size: 12px; color: ${C.ink3}; font-weight: 500">${w}</div>`).join('')}
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">
        ${dayCells.join('\n        ')}
      </div>
    </div>
    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 11.5px; color: ${C.ink3}">
      <span>أقل</span>${C.heat.map((h) => `<div style="width: 13px; height: 13px; border-radius: 4px; background: ${h}"></div>`).join('')}<span>أكثر</span>
    </div>
    ${card(`
      <div style="width: 40px; height: 40px; border-radius: 12px; background: ${C.accentSoft}; display: flex; align-items: center; justify-content: center">${svg('<path d="M6 3h12v18l-6-4-6 4z"></path>', 19, C.accent, 1.8)}</div>
      <div style="flex: 1">
        <div style="font-size: 12.5px; color: ${C.ink3}; font-weight: 500">آخر موقف</div>
        <div style="font-size: 15.5px; font-weight: 600">صفحة ٥٠ · آل عمران</div>
      </div>
      <div style="font-size: 12.5px; color: ${C.ink2}; text-align: left">أمس<br>٩:١٧ م</div>`, 'display: flex; align-items: center; gap: 12px; padding: 14px 16px')}
  </div>
${tabBar('calendar')}`);

// ---------------------------------------------------------------- Calendar week
const week = [['أحد', 6, 22, 21], ['إثنين', 7, 35, 33], ['ثلاثاء', 8, 0, 0], ['أربعاء', 9, 18, 17], ['خميس', 10, 41, 38], ['جمعة', 11, 64, 60], ['سبت', 12, 16, 15]];
const bars = week.map(([name, date, m, p]) => {
  const h = Math.round((m / 64) * 200);
  return `        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; height: 100%">
          <div style="font-size: 12px; font-weight: 600; color: ${m ? C.ink : C.ink3}">${m ? d(m) : '٠'}</div>
          <div style="width: 30px; height: ${Math.max(h, 6)}px; border-radius: 9px; background: ${m ? (m === 64 ? C.accent : '#8DB9A6') : C.track}"></div>
          <div style="font-size: 12px; color: ${C.ink2}; font-weight: 500">${name}</div>
          <div style="font-size: 11px; color: ${C.ink3}">${d(date)}</div>
        </div>`;
}).join('\n');
const miniStat = (label, value, sub) => card(`
        <div style="font-size: 12px; color: ${C.ink3}; font-weight: 500">${label}</div>
        <div style="font-size: 19px; font-weight: 700; margin-top: 2px">${value}</div>
        <div style="font-size: 12px; color: ${C.ink2}">${sub}</div>`, 'flex: 1; padding: 14px 16px; border-radius: 18px');
const calWeek = screen(`  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 14px">
    ${calHeader('أسبوع')}
    ${periodNav('٦ – ١٢ سبتمبر', '٣ س ١٦ د · ١٨٤ صفحة')}
    ${card(`
      <div style="font-size: 12px; color: ${C.ink3}; font-weight: 500; margin-bottom: 8px">دقائق القراءة</div>
      <div style="display: flex; height: 280px; gap: 2px">
${bars}
      </div>`, 'padding: 14px 12px 14px')}
    <div style="display: flex; gap: 12px">
      ${miniStat('أفضل يوم', 'الجمعة', '٦٤ دقيقة · ٦٠ صفحة')}
      ${miniStat('المعدل اليومي', '٢٨ دقيقة', '٢٦ صفحة تقريباً')}
    </div>
  </div>
${tabBar('calendar')}`);

// ---------------------------------------------------------------- Calendar day (clock)
const cx = 160, rr = 108;
const pt = (deg) => [cx + rr * Math.sin((deg * Math.PI) / 180), cx - rr * Math.cos((deg * Math.PI) / 180)].map((v) => v.toFixed(1));
const hourDeg = (h, m) => ((h + m / 60) / 24) * 360;
const sessions = [
  [[5, 2], [5, 20], '٥:٠٢ – ٥:٢٠ ص', 'ص ١٦ – ٣٢ · البقرة', '١٨ د'],
  [[13, 10], [13, 25], '١:١٠ – ١:٢٥ م', 'ص ٣٣ – ٤٦ · البقرة', '١٥ د'],
  [[21, 14], [21, 18], '٩:١٤ – ٩:١٨ م', 'ص ٤٧ – ٤٩ · البقرة', '٤ د'],
];
const arcs = sessions.map(([a, b]) => {
  const [x1, y1] = pt(hourDeg(...a)); const [x2, y2] = pt(hourDeg(...b));
  return `<path d="M ${x1} ${y1} A ${rr} ${rr} 0 0 1 ${x2} ${y2}" fill="none" stroke="${C.accent}" stroke-width="18" stroke-linecap="round"></path>`;
}).join('\n          ');
const tickR = 128, tickC = 2 * Math.PI * tickR;
const ticks = Array.from({ length: 24 }, (_, h) => h).filter((h) => h % 6).map((h) => {
  const a = (h / 24) * 2 * Math.PI;
  const p = (r) => [(cx + r * Math.sin(a)).toFixed(1), (cx - r * Math.cos(a)).toFixed(1)];
  const [x1, y1] = p(124), [x2, y2] = p(131);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink3}" stroke-width="1.4" stroke-linecap="round"></line>`;
}).join('');
const sessionRows = sessions.map(([, , t, p, dur], i) => `<div style="display: flex; align-items: center; gap: 12px; height: 54px; padding: 0 16px; ${i < 2 ? `border-bottom: 1px solid ${C.line}` : ''}">
        <div style="width: 10px; height: 10px; border-radius: 5px; background: ${C.accent}"></div>
        <div style="flex: 1">
          <div style="font-size: 14.5px; font-weight: 600">${t}</div>
          <div style="font-size: 12px; color: ${C.ink3}">${p}</div>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: ${C.ink2}">${dur}</div>
      </div>`).join('\n      ');
const lbl = (x, y, t) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="${C.ink3}" font-family="IBM Plex Sans Arabic, sans-serif">${t}</text>`;
const calDay = screen(`  <div style="position: absolute; inset: 0 0 84px 0; padding: 58px 20px 0; display: flex; flex-direction: column; gap: 12px">
    ${calHeader('يوم')}
    ${periodNav('الأحد ١٣ سبتمبر', '٣ جلسات')}
    <div style="position: relative; width: 320px; height: 320px; margin: 0 auto">
      <svg width="320" height="320" viewBox="0 0 320 320">
          <circle cx="${cx}" cy="${cx}" r="${rr}" fill="none" stroke="${C.track}" stroke-width="18"></circle>
          ${ticks}
          ${arcs}
          ${lbl(160, 28, '١٢ ص')}${lbl(293, 161, '٦ ص')}${lbl(160, 294, '١٢ م')}${lbl(27, 161, '٦ م')}
      </svg>
      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center">
        <div style="font-size: 50px; font-weight: 700; line-height: 1">٣٧</div>
        <div style="font-size: 14px; color: ${C.ink2}; margin-top: 2px">دقيقة</div>
        <div style="font-size: 13px; color: ${C.accent}; font-weight: 600; margin-top: 6px">٣٤ صفحة</div>
      </div>
    </div>
    ${card(`
      ${sessionRows}`, 'overflow: hidden; border-radius: 18px')}
  </div>
${tabBar('calendar')}`);

// ================================================================ WEB (desktop 1440×900)
function sidebar(active) {
  const tabs = [['home', 'الرئيسية'], ['quran', 'القرآن'], ['awrad', 'الأوراد'], ['stats', 'الإحصائيات'], ['calendar', 'التقويم']];
  const items = tabs.map(([k, label]) => {
    const on = k === active;
    return `    <div style="height: 42px; border-radius: 11px; padding: 0 12px; display: flex; align-items: center; gap: 12px; font-size: 15px; ${on ? `background: rgba(47,111,92,0.10); color: ${C.accent}; font-weight: 600` : `color: ${C.ink2}; font-weight: 500`}">
      ${svg(icons[k], 21, on ? C.accent : C.ink2, on ? 2 : 1.7)}<span>${label}</span>
    </div>`;
  }).join('\n');
  return `  <div style="position: absolute; top: 0; right: 0; bottom: 0; width: 240px; background: #F1EEE7; border-left: 1px solid ${C.line}; padding: 26px 14px 20px; display: flex; flex-direction: column; gap: 4px">
    <div style="display: flex; align-items: center; gap: 10px; padding: 0 8px; height: 40px; margin-bottom: 18px">
      <div style="width: 32px; height: 32px; border-radius: 9px; background: ${C.accent}; display: flex; align-items: center; justify-content: center">${svg(icons.quran, 19, '#fff', 1.9)}</div>
      <div style="font-size: 15px; font-weight: 700; color: ${C.ink3}">[اسم التطبيق]</div>
    </div>
${items}
    <div style="flex: 1"></div>
    <div style="display: flex; align-items: center; gap: 10px; padding: 0 8px; height: 44px">
      <div style="width: 30px; height: 30px; border-radius: 15px; background: ${C.accent}; color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center">أ</div>
      <div style="flex: 1; font-size: 14.5px; font-weight: 600">أنا</div>
      ${svg('<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>', 18, C.ink3, 1.7)}
    </div>
  </div>`;
}
const desk = (active, main, bg = C.bg) => `<div dir="rtl" style="width: 1440px; height: 900px; position: relative; overflow: hidden; background: ${bg}">
${sidebar(active)}
  <div style="position: absolute; top: 0; right: 240px; left: 0; bottom: 0; overflow: hidden">
${main}
  </div>
</div>
`;
const deskTitle = (t, side = '') => `<div style="display: flex; align-items: center; justify-content: space-between; height: 44px">
      <div style="font-size: 30px; font-weight: 700; letter-spacing: -0.3px">${t}</div>
      ${side}
    </div>`;

// ---------------------------------------------------------------- Web home
const webHome = desk('home', `    <div dir="ltr" style="position: absolute; bottom: -60px; left: 36px; font-size: 330px; font-weight: 300; line-height: 1; letter-spacing: -8px; color: rgba(47,111,92,0.08); pointer-events: none">١٠:٤٤:١٦</div>
    <div style="position: absolute; inset: 0; padding: 40px 56px; display: flex; flex-direction: column">
      <div style="font-size: 15px; color: ${C.ink2}; font-weight: 500; height: 30px">الإثنين، ١٤ سبتمبر</div>
      <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 76px">
        <div style="font-size: 21px; color: ${C.ink2}; font-weight: 500">ختمتك تحتاج منك</div>
        <div style="font-size: 68px; line-height: 1.1; font-weight: 700; letter-spacing: -1px">١٠ ساعات و٤٤ دقيقة</div>
        <div style="font-size: 17px; color: ${C.ink2}">بمتوسط دقيقة و٤ ثوانٍ لكل صفحة</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin-top: 64px">
        ${card(`
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="font-size: 15px; color: ${C.ink2}; font-weight: 500">المتبقي من ختمتك الثانية</div>
            <div style="font-size: 13px; color: ${C.accent}; font-weight: 600; background: ${C.accentSoft}; padding: 3px 10px; border-radius: 20px">٨٪ مكتمل</div>
          </div>
          <div dir="ltr" style="text-align: right; font-size: 64px; font-weight: 500; letter-spacing: -1px; margin: 8px 0 16px; font-variant-numeric: tabular-nums">٩:٥٢:٠٠</div>
          <div style="height: 7px; border-radius: 4px; background: ${C.track}; overflow: hidden"><div style="width: 8%; height: 100%; background: ${C.accent}; border-radius: 4px"></div></div>
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; color: ${C.ink3}; margin-top: 10px">
            <div>٤٩ من ٦٠٤ صفحة</div><div>٥٥٥ صفحة متبقية</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 22px">
            <div style="font-size: 16px; color: ${C.accent}; font-weight: 600">كل دقيقة تفرق</div>
            <div style="height: 52px; padding: 0 26px; border-radius: 16px; background: ${C.accent}; color: #fff; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 6px 18px rgba(47,111,92,0.25)">
              <span>أكمل القراءة</span><span style="opacity: 0.7; font-weight: 400">صفحة ٥٠ · آل عمران</span>
            </div>
          </div>`, 'background: rgba(255,255,255,0.72); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); grid-column: span 2; padding: 24px 28px')}
        ${card(`
          <div style="font-size: 18px; font-weight: 600">قرأت البقرة في ٥١ دقيقة</div>
          <div style="font-size: 15px; color: ${C.ink2}; line-height: 1.7; margin-top: 4px">لو قرأت ٥١ دقيقة كل يوم، تختم القرآن في <span style="color: ${C.ink}; font-weight: 600">١٣ يوم</span>.</div>
          <div style="height: 1px; background: ${C.line}; margin: 20px 0"></div>
          <div style="font-size: 14px; color: ${C.ink2}">لو قرأت يومياً</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 4px">
            <span style="font-size: 26px; font-weight: 700">٣٠ دقيقة</span><span style="color: ${C.ink3}">←</span><span style="font-size: 26px; font-weight: 700; color: ${C.accent}">٢٢ يوم</span>
          </div>
          <div style="position: relative; height: 22px; margin-top: 18px">
            <div style="position: absolute; top: 9px; left: 0; right: 0; height: 4px; border-radius: 2px; background: ${C.track}"></div>
            <div style="position: absolute; top: 9px; right: 0; width: 42%; height: 4px; border-radius: 2px; background: ${C.accent}"></div>
            <div style="position: absolute; top: 0; right: calc(42% - 11px); width: 22px; height: 22px; border-radius: 11px; background: #fff; box-shadow: 0 1px 4px rgba(29,28,26,0.25)"></div>
          </div>`, 'background: rgba(255,255,255,0.72); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); padding: 24px 28px')}
      </div>
    </div>`);

// ---------------------------------------------------------------- Web Quran (single page)
const webKpiBar = `    <div style="position: absolute; top: 0; left: 0; right: 0; height: 76px; border-bottom: 1px solid ${C.line}; display: flex; align-items: center; justify-content: center">
      <div style="display: flex; align-items: center; width: 560px">
      ${kpi('متوسط الصفحة', '١:٠٤ د')}
      ${vdiv}
      ${kpi('المتبقي', '٩٢٪')}
      ${vdiv}
      ${kpi('المدة المتبقية', '٩ س ٥٢ د')}
      </div>
    </div>`;
const sideArrow = (side, path, col) => `    <div style="position: absolute; top: 50%; ${side}: 48px; width: 52px; height: 52px; margin-top: -26px; border-radius: 26px; background: rgba(29,28,26,0.04); display: flex; align-items: center; justify-content: center">${svg(path, 24, col, 2)}</div>`;
const navPill = (a, b, c) => `    <div style="position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; background: ${C.card}; box-shadow: 0 1px 2px rgba(29,28,26,0.05), 0 6px 20px rgba(29,28,26,0.07); border-radius: 16px; height: 46px; padding: 0 6px; font-size: 15px; white-space: nowrap">
      <div style="padding: 0 16px; font-weight: 700">${a}</div>
      <div style="width: 1px; height: 20px; background: rgba(29,28,26,0.12)"></div>
      <div style="padding: 0 16px; font-weight: 600">${b}</div>
      <div style="width: 1px; height: 20px; background: rgba(29,28,26,0.12)"></div>
      <div style="padding: 0 12px 0 10px; color: ${C.ink2}; display: flex; align-items: center; gap: 6px">${c} ${svg(chevD, 15, C.ink3, 2)}</div>
    </div>`;
const webQuran = desk('quran', `${webKpiBar}
${sideArrow('right', chevR, C.ink2)}
${sideArrow('left', chevL, C.ink)}
    <div style="position: absolute; top: 104px; bottom: 96px; left: 50%; width: 620px; margin-left: -310px; background: #FFFDF8; border-radius: 8px; box-shadow: 0 1px 2px rgba(29,28,26,0.05), 0 12px 40px rgba(29,28,26,0.07); overflow: hidden; padding: 30px 44px 0">
      <div style="height: 50px; border: 1px solid rgba(47,111,92,0.35); border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative">
        <div style="position: absolute; inset: 3px; border: 1px solid rgba(47,111,92,0.18); border-radius: 9px"></div>
        <div class="q" style="font-size: 23px; color: ${C.accent}">سُورَةُ آلِ عِمۡرَانَ</div>
      </div>
      <div class="q" style="text-align: center; font-size: 26px; margin: 14px 0 4px">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
      <div class="q" style="font-size: 28px; line-height: 2.2; text-align: justify; text-align-last: center">
        الٓمٓ${aya('١')}<span style="background: rgba(47,111,92,0.07); color: #245747; border-radius: 4px; text-decoration: underline; text-decoration-color: rgba(47,111,92,0.55); text-decoration-thickness: 2px; text-underline-offset: 14px">ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُ</span>${aya('٢')}نَزَّلَ عَلَيۡكَ ٱلۡكِتَٰبَ بِٱلۡحَقِّ مُصَدِّقٗا لِّمَا بَيۡنَ يَدَيۡهِ وَأَنزَلَ ٱلتَّوۡرَىٰةَ وَٱلۡإِنجِيلَ${aya('٣')}مِن قَبۡلُ هُدٗى لِّلنَّاسِ وَأَنزَلَ ٱلۡفُرۡقَانَۗ إِنَّ ٱلَّذِينَ كَفَرُواْ بِـَٔايَٰتِ ٱللَّهِ لَهُمۡ عَذَابٞ شَدِيدٞۗ وَٱللَّهُ عَزِيزٞ ذُو ٱنتِقَامٍ${aya('٤')}إِنَّ ٱللَّهَ لَا يَخۡفَىٰ عَلَيۡهِ شَيۡءٞ فِي ٱلۡأَرۡضِ وَلَا فِي ٱلسَّمَآءِ${aya('٥')}هُوَ ٱلَّذِي يُصَوِّرُكُمۡ فِي ٱلۡأَرۡحَامِ كَيۡفَ يَشَآءُۚ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡعَزِيزُ ٱلۡحَكِيمُ${aya('٦')}
      </div>
      <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 100px; background: linear-gradient(to bottom, rgba(255,253,248,0), #FFFDF8)"></div>
    </div>
    <div style="position: absolute; bottom: 86px; left: 50%; transform: translateX(-50%); background: ${C.ink}; color: #fff; border-radius: 16px; height: 44px; padding: 0 6px 0 16px; display: flex; align-items: center; gap: 12px; white-space: nowrap; box-shadow: 0 8px 24px rgba(29,28,26,0.22)">
      <span style="font-size: 13px; opacity: 0.7">٦ كلمات محددة</span>
      <div style="height: 32px; padding: 0 12px; border-radius: 11px; background: rgba(255,255,255,0.14); display: flex; align-items: center; font-size: 13.5px; font-weight: 600">احفظ في مجموعة</div>
    </div>
${navPill('٥٠', 'آل عمران', 'الجزء ٣')}`, C.paper);

// ---------------------------------------------------------------- Web Quran (two-page spread, low-fi alternative)
const lines = (n, lastShort) => Array.from({ length: n }, (_, i) =>
  `<div style="height: 11px; border-radius: 6px; background: #E9E4DA; ${i === n - 1 && lastShort ? 'width: 55%; margin: 0 auto' : ''}"></div>`).join('');
const sheet = (pageNo, inner, side) => `<div style="width: 470px; height: 100%; background: #FFFDF8; padding: 34px 40px; display: flex; flex-direction: column; gap: 22px; position: relative; ${side === 'right' ? 'border-radius: 0 8px 8px 0; box-shadow: inset 14px 0 18px -14px rgba(29,28,26,0.12)' : 'border-radius: 8px 0 0 8px; box-shadow: inset -14px 0 18px -14px rgba(29,28,26,0.12)'}">
        ${inner}
        <div style="position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 12px; color: ${C.ink3}">${pageNo}</div>
      </div>`;
const webSpread = desk('quran', `${webKpiBar}
${sideArrow('right', chevR, C.ink2)}
${sideArrow('left', chevL, C.ink)}
    <div style="position: absolute; top: 104px; bottom: 96px; left: 50%; width: 940px; margin-left: -470px; display: flex; box-shadow: 0 1px 2px rgba(29,28,26,0.05), 0 12px 40px rgba(29,28,26,0.07); border-radius: 8px">
      ${sheet('٤٩', `${lines(13, true)}`, 'right')}
      ${sheet('٥٠', `<div style="height: 44px; border: 1px solid rgba(47,111,92,0.3); border-radius: 12px; flex: none"></div><div style="height: 12px; width: 50%; margin: 0 auto; border-radius: 6px; background: #E9E4DA"></div>${lines(11)}`, 'left')}
    </div>
    <div style="position: absolute; top: 92px; right: 40px; font-size: 12px; font-weight: 600; color: ${C.warm}; background: #F6E9E2; padding: 4px 10px; border-radius: 20px">بديل للمقارنة</div>
${navPill('٤٩ – ٥٠', 'البقرة · آل عمران', 'الجزء ٣')}`, C.paper);

// ---------------------------------------------------------------- Web stats
const webRows = [
  ['٤٤', 'البقرة', '١:٢١ م', '١:٢٢ م', '١:٠٢', '١:٠٢', 'أسرع ١٦٪', 'fast'],
  ['٤٥', 'البقرة', '١:٢٢ م', '١:٢٣ م', '١:٠٥', '١:٠٥', 'أسرع ١١٪', 'fast'],
  ['٤٦', 'البقرة', '١:٢٣ م', '١:٢٤ م', '٠:٥٨', '٠:٥٨', 'أسرع ٢٢٪', 'fast'],
  ['٤٧', 'البقرة', '٩:١٤ م', '٩:١٥ م', '١:١٠', '١:٠٧', 'أبطأ ٤٪', 'slow'],
  ['٤٨', 'البقرة', '٩:١٥ م', '٩:١٦ م', '١:٠٧', '١:٠٧', 'أسرع ٩٪', 'fast'],
  ['٤٩', 'البقرة', '٩:١٦ م', '٩:١٧ م', '١:٢٠', '١:٢٠', 'أسرع ٦٪', 'fast'],
  ['٥٠', 'آل عمران', '', '', '٠:٤٢', '١:٠٩', '', 'now'],
  ['٥١', 'آل عمران', '', '', '—', '١:١١', '', 'unread'],
  ['٥٢', 'آل عمران', '', '', '—', '١:٠٩', '', 'unread'],
  ['٥٣', 'آل عمران', '', '', '—', '١:١٤', '', 'unread'],
];
const cols = ['70px', '150px', '90px', '190px', '190px', '120px', '120px', '1fr'];
const gridRow = `display: grid; grid-template-columns: ${cols.join(' ')}; align-items: center; padding: 0 24px`;
const webTable = webRows.map(([p, s, st, en, dur, best, ch, kind], i) => {
  const faded = kind === 'unread';
  const timeCell = (t) => t ? `<div><div style="font-size: 14.5px">${t}</div><div style="font-size: 12px; color: ${C.ink3}">١٣ سبتمبر</div></div>` : `<div style="color: ${C.ink3}">—</div>`;
  const startCell = kind === 'now' ? `<div><span style="font-size: 12.5px; font-weight: 600; color: ${C.accent}; background: ${C.accentSoft}; padding: 3px 10px; border-radius: 20px">تقرأها الآن</span></div>` : kind === 'unread' ? `<div style="color: ${C.ink3}">لم تُقرأ بعد</div>` : timeCell(st);
  return `        <div style="${gridRow}; height: 54px; ${i < webRows.length - 1 ? `border-bottom: 1px solid ${C.line};` : ''} ${faded ? 'opacity: 0.55;' : ''} ${kind === 'now' ? 'background: rgba(47,111,92,0.04);' : ''}">
          <div style="font-size: 15.5px; font-weight: 700">${p}</div>
          <div style="font-size: 14.5px">${s}</div>
          <div style="font-size: 14.5px; color: ${C.ink2}">٣</div>
          ${startCell}
          ${kind === 'now' || faded ? `<div style="color: ${C.ink3}">—</div>` : timeCell(en)}
          <div style="font-size: 15px; font-weight: 500; font-variant-numeric: tabular-nums">${dur}</div>
          <div style="font-size: 15px; color: ${C.ink2}; font-variant-numeric: tabular-nums">${best}</div>
          <div style="font-size: 13.5px; font-weight: 600; color: ${kind === 'fast' ? C.accent : C.warm}">${ch}</div>
        </div>`;
}).join('\n');
const tile = (label, value) => card(`<div style="font-size: 13px; color: ${C.ink3}; font-weight: 500">${label}</div><div style="font-size: 28px; font-weight: 700; margin-top: 4px">${value}</div>`, 'padding: 18px 22px; border-radius: 18px');
const webStats = desk('stats', `    <div style="position: absolute; inset: 0; padding: 36px 56px; display: flex; flex-direction: column; gap: 20px">
      ${deskTitle('الإحصائيات')}
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">
        ${tile('متوسط الصفحة', '١:٠٤ د')}
        ${tile('هذه الختمة', '٤٩ صفحة')}
        ${tile('إجمالي القراءة', '١١ س ٣٨ د')}
        <div style="background: ${C.accentSoft}; border-radius: 18px; padding: 16px 20px; display: flex; gap: 12px; align-items: center">
          <div style="width: 40px; height: 40px; flex: none; border-radius: 20px; background: ${C.accent}; display: flex; align-items: center; justify-content: center">${svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"></path>', 19, '#fff', 1.9)}</div>
          <div>
            <div style="font-size: 15.5px; font-weight: 600">البقرة أسرع بـ ١٨٪</div>
            <div style="font-size: 12.5px; color: ${C.ink2}">٥١ د مقابل ٦٢ د في الختمة الأولى</div>
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px">
        <div style="font-size: 20px; font-weight: 700">سجل الصفحات</div>
        <div style="display: flex; gap: 12px; align-items: center">
          <div style="height: 36px; padding: 0 12px; border-radius: 10px; background: ${C.card}; box-shadow: 0 0 0 1px ${C.line}; display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${C.ink2}">كل السور ${svg(chevD, 14, C.ink3, 2)}</div>
          <div style="width: 220px">${segmented(['الكل', 'سورة', 'جزء'], 'الكل')}</div>
        </div>
      </div>
      ${card(`
        <div style="${gridRow}; height: 42px; font-size: 12.5px; color: ${C.ink3}; font-weight: 500; border-bottom: 1px solid ${C.line}">
          <div>الصفحة</div><div>السورة</div><div>الجزء</div><div>البداية</div><div>النهاية</div><div>المدة</div><div>أفضل وقت</div><div>مقابل الأولى</div>
        </div>
${webTable}`, 'overflow: hidden; border-radius: 18px')}
    </div>`);

// ---------------------------------------------------------------- Web calendar (all three levels at once)
const webDayCells = [];
for (let i = 0; i < 2; i++) webDayCells.push('<div></div>');
for (let n = 1; n <= 30; n++) {
  let style, col = C.ink;
  if (n in mins) { const l = lvl(mins[n]); style = `background: ${C.heat[l]}`; if (l === 4) col = '#fff'; }
  else if (n === 14) style = `box-shadow: inset 0 0 0 2px ${C.accent}`, col = C.accent;
  else style = 'background: transparent', col = C.ink3;
  if (n === 13) style += `; box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.ink}`;
  webDayCells.push(`<div style="height: 56px; border-radius: 12px; ${style}; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: ${n === 14 || n === 13 ? 700 : 500}; color: ${col}">${d(n)}</div>`);
}
const webBars = week.map(([name, date, m]) => {
  const h = Math.round((m / 64) * 140);
  return `          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; height: 100%">
            <div style="font-size: 12.5px; font-weight: 600; color: ${m ? C.ink : C.ink3}">${m ? d(m) : '٠'}</div>
            <div style="width: 44px; height: ${Math.max(h, 6)}px; border-radius: 10px; background: ${m ? (m === 64 ? C.accent : '#8DB9A6') : C.track}"></div>
            <div style="font-size: 12.5px; color: ${C.ink2}; font-weight: 500">${name} ${d(date)}</div>
          </div>`;
}).join('\n');
const cardHead = (t, sub) => `<div style="display: flex; justify-content: space-between; align-items: baseline"><div style="font-size: 17px; font-weight: 700">${t}</div><div style="font-size: 13px; color: ${C.ink3}">${sub}</div></div>`;
const webCal = desk('calendar', `    <div style="position: absolute; inset: 0; padding: 36px 56px; display: flex; flex-direction: column; gap: 20px">
      ${deskTitle('التقويم', `<div style="height: 36px; padding: 0 10px 0 14px; border-radius: 18px; background: rgba(29,28,26,0.05); display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600">
        <div style="width: 24px; height: 24px; border-radius: 12px; background: ${C.accent}; color: #fff; font-size: 11.5px; display: flex; align-items: center; justify-content: center">أ</div>أنا ${svg(chevD, 14, C.ink3, 2)}
      </div>`)}
      <div style="display: flex; gap: 24px; flex: 1; min-height: 0">
        <div style="width: 430px; display: flex; flex-direction: column; gap: 16px">
          ${card(`
            ${periodNav('سبتمبر ٢٠٢٦', '٥ س ٤٠ د · ٣١٨ صفحة')}
            <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; margin: 14px 0 7px">
              ${weekdays.map((w) => `<div style="text-align: center; font-size: 12px; color: ${C.ink3}; font-weight: 500">${w}</div>`).join('')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px">
              ${webDayCells.join('\n              ')}
            </div>
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 11.5px; color: ${C.ink3}; margin-top: 14px">
              <span>أقل</span>${C.heat.map((h) => `<div style="width: 13px; height: 13px; border-radius: 4px; background: ${h}"></div>`).join('')}<span>أكثر</span>
            </div>`, 'padding: 14px 20px 18px')}
          ${card(`
            <div style="width: 40px; height: 40px; border-radius: 12px; background: ${C.accentSoft}; display: flex; align-items: center; justify-content: center">${svg('<path d="M6 3h12v18l-6-4-6 4z"></path>', 19, C.accent, 1.8)}</div>
            <div style="flex: 1">
              <div style="font-size: 12.5px; color: ${C.ink3}; font-weight: 500">آخر موقف</div>
              <div style="font-size: 15.5px; font-weight: 600">صفحة ٥٠ · آل عمران</div>
            </div>
            <div style="font-size: 13px; color: ${C.ink2}">أمس ٩:١٧ م</div>`, 'display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 18px')}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0">
          ${card(`
            ${cardHead('الأسبوع · ٦ – ١٢ سبتمبر', '٣ س ١٦ د · ١٨٤ صفحة')}
            <div style="display: flex; height: 200px; gap: 4px; margin-top: 16px">
${webBars}
            </div>`, 'padding: 20px 24px')}
          ${card(`
            ${cardHead('الأحد ١٣ سبتمبر', '٣ جلسات')}
            <div style="display: flex; align-items: center; gap: 28px; margin-top: 6px">
              <div style="position: relative; width: 320px; height: 320px; flex: none; transform: scale(0.88); margin: -19px">
                <svg width="320" height="320" viewBox="0 0 320 320">
                  <circle cx="${cx}" cy="${cx}" r="${rr}" fill="none" stroke="${C.track}" stroke-width="18"></circle>
                  ${ticks}
                  ${arcs}
                  ${lbl(160, 28, '١٢ ص')}${lbl(293, 161, '٦ ص')}${lbl(160, 294, '١٢ م')}${lbl(27, 161, '٦ م')}
                </svg>
                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center">
                  <div style="font-size: 50px; font-weight: 700; line-height: 1">٣٧</div>
                  <div style="font-size: 14px; color: ${C.ink2}; margin-top: 2px">دقيقة</div>
                  <div style="font-size: 13px; color: ${C.accent}; font-weight: 600; margin-top: 6px">٣٤ صفحة</div>
                </div>
              </div>
              <div style="flex: 1; min-width: 0">
                ${sessionRows}
              </div>
            </div>`, 'padding: 20px 24px')}
        </div>
      </div>
    </div>`);

// ---------------------------------------------------------------- Web awrad
const R2 = 116, CIRC2 = 2 * Math.PI * R2;
const webAwrad = desk('awrad', `    <div style="position: absolute; inset: 0; padding: 36px 56px; display: flex; flex-direction: column; gap: 20px">
      ${deskTitle('الأوراد')}
      <div style="display: flex; gap: 24px; flex: 1; min-height: 0">
        ${card(`
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
            <div style="font-size: 14px; color: ${C.ink3}; font-weight: 500">المسبحة</div>
            ${svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"></path><path d="M4 4v4h4"></path>', 19, C.ink3, 1.8)}
          </div>
          <div style="position: relative; width: 264px; height: 264px; margin-top: 40px">
            <svg width="264" height="264" viewBox="0 0 264 264" style="transform: rotate(-90deg)">
              <circle cx="132" cy="132" r="${R2}" fill="none" stroke="${C.track}" stroke-width="10"></circle>
              <circle cx="132" cy="132" r="${R2}" fill="none" stroke="${C.accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(CIRC2 * 27 / 33).toFixed(1)} ${CIRC2.toFixed(1)}"></circle>
            </svg>
            <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center">
              <div style="font-size: 76px; font-weight: 600; line-height: 1">٢٧</div>
              <div style="font-size: 15px; color: ${C.ink3}; margin-top: 6px">من ٣٣</div>
            </div>
          </div>
          <div class="q" style="text-align: center; font-size: 32px; margin: 26px 0 20px">سُبۡحَانَ ٱللَّهِ</div>
          <div style="display: flex; gap: 8px; justify-content: center">
            ${chip('سبحان الله', true)}${chip('الحمد لله')}${chip('الله أكبر')}
            <div style="width: 34px; height: 34px; border-radius: 17px; background: rgba(29,28,26,0.05); display: flex; align-items: center; justify-content: center">${svg('<path d="M12 6v12M6 12h12"></path>', 16, C.ink2, 2)}</div>
          </div>
          <div style="font-size: 12.5px; color: ${C.ink3}; margin-top: 18px">اضغط المسافة أو انقر للتسبيح</div>`, 'width: 520px; align-self: flex-start; padding: 20px 24px 32px; display: flex; flex-direction: column; align-items: center')}
        <div style="flex: 1; display: flex; flex-direction: column; gap: 14px">
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px">
            <div style="font-size: 20px; font-weight: 700">مجموعاتي</div>
            <div style="font-size: 15px; color: ${C.accent}; font-weight: 500">+ جديدة</div>
          </div>
          ${card(`
            ${listRow('التحصين', '٤ مقاطع · آية الكرسي، خواتيم البقرة، المعوذات', C.accentSoft, shield)}
            ${listRow('الرقية', '٩ مقاطع', C.accentSoft, leaf, true)}`, 'overflow: hidden; border-radius: 18px')}
          <div style="font-size: 20px; font-weight: 700; padding: 8px 4px 0">الأذكار</div>
          ${card(`
            ${listRow('أذكار الصباح', 'بعد الفجر', '#F4EEDF', sun)}
            ${listRow('أذكار المساء', 'بعد العصر', '#E8EBF3', moon, true)}`, 'overflow: hidden; border-radius: 18px')}
        </div>
      </div>
    </div>`);

// ---------------------------------------------------------------- write
const files = {
  'WebHome.dc.html': webHome,
  'WebQuran.dc.html': webQuran,
  'WebQuranSpread.dc.html': webSpread,
  'WebAwrad.dc.html': webAwrad,
  'WebStats.dc.html': webStats,
  'WebCalendar.dc.html': webCal,
  'Main.dc.html': home,
  'Quran.dc.html': quran,
  'Awrad.dc.html': awrad,
  'Stats.dc.html': stats,
  'CalendarMonth.dc.html': calMonth,
  'CalendarWeek.dc.html': calWeek,
  'CalendarDay.dc.html': calDay,
};
for (const [name, body] of Object.entries(files)) writeFileSync(new URL(name, import.meta.url), head + body.replaceAll(" · ", "، ") + foot); // Arabic comma: a middle dot next to Arabic digits reads like a zero

const W = 390, H = 844, GAP = 90;
const canvas = {
  artboards: [
    { file: 'Main.dc.html', title: 'الرئيسية', x: 0, y: 0, w: W, h: H },
    { file: 'Quran.dc.html', title: 'القرآن', x: (W + GAP), y: 0, w: W, h: H },
    { file: 'Awrad.dc.html', title: 'الأوراد', x: 2 * (W + GAP), y: 0, w: W, h: H },
    { file: 'Stats.dc.html', title: 'الإحصائيات', x: 3 * (W + GAP), y: 0, w: W, h: H },
    { file: 'CalendarMonth.dc.html', title: 'التقويم · شهر', x: 0, y: H + 160, w: W, h: H },
    { file: 'CalendarWeek.dc.html', title: 'التقويم · أسبوع', x: (W + GAP), y: H + 160, w: W, h: H },
    { file: 'CalendarDay.dc.html', title: 'التقويم · يوم', x: 2 * (W + GAP), y: H + 160, w: W, h: H },
  ],
  annotations: [
    { id: 'numbers-note', page: 'mobile', x: 3 * (W + GAP), y: H + 160, w: 320, text: 'كل الأرقام في التصميم مترابطة كمثال:\nمتوسط ١:٠٤ د للصفحة × ٦٠٤ = ١٠:٤٤:١٦\nالختمة الثانية: قرأ ٤٩ صفحة (البقرة كاملة في ٥١ د)\nالمتبقي ٥٥٥ صفحة = ٩:٥٢:٠٠ (٩٢٪)' },
    { id: 'web-note', page: 'web', x: 0, y: -260, w: 520, text: 'نفس التطبيق على الويب — كود واحد يتأقلم مع الشاشة:\n• جوال (أقل من ٧٦٨): شريط تبويبات تحت\n• تابلت (٧٦٨–١١٩٩): شريط جانبي أيقونات فقط\n• كمبيوتر (١٢٠٠+): شريط جانبي كامل كما هنا\nالتقويم على الكمبيوتر يعرض الشهر والأسبوع واليوم مع بعض.' },
    { id: 'spread-note', page: 'web', x: 2 * 1520, y: -200, w: 440, text: 'بديل: صفحتين متقابلتين مثل المصحف المفتوح (رسم مبدئي).\nالقرار: صفحة وحدة ولا صفحتين على الشاشات الكبيرة؟' },
  ],
  pages: [{ id: 'mobile', name: 'الجوال' }, { id: 'web', name: 'الويب' }],
  launch: { view: 'canvas', page: 'web' },
};
const WW = 1440, WH = 900, WG = 80;
canvas.artboards.forEach((a) => (a.page = 'mobile'));
canvas.artboards.push(
  { file: 'WebHome.dc.html', title: 'الويب · الرئيسية', page: 'web', x: 0, y: 0, w: WW, h: WH },
  { file: 'WebQuran.dc.html', title: 'الويب · القرآن', page: 'web', x: WW + WG, y: 0, w: WW, h: WH },
  { file: 'WebQuranSpread.dc.html', title: 'الويب · القرآن (بديل صفحتين)', page: 'web', x: 2 * (WW + WG), y: 0, w: WW, h: WH },
  { file: 'WebAwrad.dc.html', title: 'الويب · الأوراد', page: 'web', x: 0, y: WH + 160, w: WW, h: WH },
  { file: 'WebStats.dc.html', title: 'الويب · الإحصائيات', page: 'web', x: WW + WG, y: WH + 160, w: WW, h: WH },
  { file: 'WebCalendar.dc.html', title: 'الويب · التقويم', page: 'web', x: 2 * (WW + WG), y: WH + 160, w: WW, h: WH },
);
writeFileSync(new URL('canvas.json', import.meta.url), JSON.stringify(canvas, null, 2));
console.log('built', Object.keys(files).length, 'artboards');
