/* Pellwood store: shared data, product renders, theme, cart and cart drawer.
   Products, prices and stock are fictional. No network: every render is inline SVG
   drawn from material tokens in theme.css, so a finish change re-colours it. */
(function () {
  'use strict';

  /* Extra lucide icons, verbatim paths (lucide.dev). icons.js carries the rest. */
  const EXTRA = {
    'bag': '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
    'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'loader': '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
  };
  const ns = 'http://www.w3.org/2000/svg';
  const sprite = document.createElementNS(ns, 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('class', 'sr-only');
  sprite.innerHTML = Object.entries(EXTRA).map(([k, v]) =>
    `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('');
  document.body.insertBefore(sprite, document.body.firstChild);

  const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ------------------------------------------------------------------ data */
  /* Pellwood is a fictional workshop. Every piece is cut after it is ordered and
     joined with wooden joints. A few finished pieces sit ready in the workshop;
     a wood can be paused while the right boards are not in. */
  const LEAD = '6 to 8 weeks';
  const FINISHES = {
    'oak': { name: 'Oiled oak', kind: 'wood' },
    'walnut': { name: 'Oiled walnut', kind: 'wood' },
    'ash': { name: 'Oiled ash', kind: 'wood' },
    'ebonised': { name: 'Ebonised oak', kind: 'wood' },
    'oat': { name: 'Oat wool', kind: 'fabric' },
    'moss': { name: 'Moss wool', kind: 'fabric' },
    'charcoal': { name: 'Charcoal wool', kind: 'fabric' }
  };

  const PRODUCTS = [
    { id: 'rook-bookcase', name: 'Rook Bookcase', type: 'shelf', cat: 'Shelving', added: '2025-02-10', rank: 1,
      finishes: ['oak', 'walnut', 'ash', 'ebonised'],
      sizes: [
        { id: '80', label: '80 cm', dim: 'W 80 x D 32 x H 190 cm', short: '2 sections', price: 18500, units: 2 },
        { id: '120', label: '120 cm', dim: 'W 120 x D 32 x H 190 cm', short: '3 sections', price: 24800, units: 3 },
        { id: '160', label: '160 cm', dim: 'W 160 x D 32 x H 190 cm', short: '4 sections', price: 31200, units: 4 }],
      ready: { 'oak:120': 2 }, paused: { 'walnut:160': 'February 2027' },
      pausedWhy: 'We are waiting on walnut boards long enough for the 160 cm shelves.',
      blurb: 'Solid posts and shelves joined with through tenons and oak pegs, with no screws in the frame. The back is tongue and groove boards, so it is solid wood all the way through.',
      joinery: 'Through mortise and tenon, pegged with oak', weight: '48 kg', delivered: 'Delivered built and carried in',
      detail: 'THROUGH TENON, OAK PEG', detailTab: 'Joint' },
    { id: 'settle-sofa', name: 'Settle Sofa', type: 'sofa', cat: 'Seating', added: '2025-06-02', rank: 2,
      finishes: ['oat', 'moss', 'charcoal'],
      sizes: [
        { id: '2', label: '2 seat', dim: 'W 168 x D 88 x H 76 cm', short: 'W 168 cm', price: 42000, units: 2 },
        { id: '3', label: '3 seat', dim: 'W 214 x D 88 x H 76 cm', short: 'W 214 cm', price: 51500, units: 3 }],
      ready: { 'oat:2': 1 }, paused: {},
      blurb: 'An oiled oak frame with pegged mortise and tenon joints under deep wool cushions. The covers zip off, and if a joint ever loosens the frame can be re-glued at the workshop.',
      joinery: 'Pegged mortise and tenon, oak frame', weight: '58 kg', delivered: 'Delivered built and carried in',
      detail: 'ZIP-OFF WOOL COVER', detailTab: 'Cover' },
    { id: 'trestle-table', name: 'Trestle Table', type: 'table', cat: 'Tables', added: '2024-11-18', rank: 3,
      finishes: ['oak', 'walnut', 'ebonised'],
      sizes: [
        { id: '180', label: '180 cm', dim: 'W 180 x D 90 x H 74 cm', short: 'Seats 6', price: 36000, units: 180 },
        { id: '220', label: '220 cm', dim: 'W 220 x D 90 x H 74 cm', short: 'Seats 8', price: 42500, units: 220 }],
      ready: {}, paused: {},
      blurb: 'A thick top on two trestles held by a stretcher with tusk tenons. Knock out the two wedges and it comes apart into three pieces for a narrow stair.',
      joinery: 'Tusk tenon with knock-out wedges', weight: '62 kg', delivered: 'Delivered in 3 parts, wedged together in your room',
      parts: ['TOP', '2 TRESTLES', 'STRETCHER'], detail: 'TUSK TENON, WEDGE', detailTab: 'Wedge' },
    { id: 'pegged-bed', name: 'Pegged Bed', type: 'bed', cat: 'Beds', added: '2025-01-20', rank: 4,
      finishes: ['oak', 'walnut'],
      sizes: [
        { id: 'q', label: 'Queen', dim: 'W 160 x L 210 x H 92 cm', short: 'For a 160 cm mattress', price: 39900, units: 240 },
        { id: 'k', label: 'King', dim: 'W 180 x L 210 x H 92 cm', short: 'For a 180 cm mattress', price: 44600, units: 264 }],
      ready: {}, paused: {},
      blurb: 'A slatted bed that needs no box spring. The headboard is pegged, and the side rails lock into the posts with wedged tusk tenons, so it can be taken down to move.',
      joinery: 'Pegged headboard, side rails on wedged tusk tenons', weight: '71 kg', delivered: 'Delivered in 5 parts and put together in your room',
      parts: ['HEADBOARD', 'FOOTBOARD', '2 RAILS', 'SLATS'], detail: 'PEGGED HEADBOARD JOINT', detailTab: 'Joint' },
    { id: 'writing-desk', name: 'Writing Desk', type: 'desk', cat: 'Tables', added: '2026-08-24', rank: 5,
      finishes: ['oak', 'walnut', 'ash'],
      sizes: [
        { id: '120', label: '120 cm', dim: 'W 120 x D 65 x H 74 cm', short: 'One drawer', price: 22500, units: 120 },
        { id: '140', label: '140 cm', dim: 'W 140 x D 65 x H 74 cm', short: 'One drawer', price: 24900, units: 140 }],
      ready: { 'ash:120': 1 }, paused: {},
      blurb: 'A desk with one hand-cut dovetailed drawer that runs on waxed wooden runners. The legs are tenoned into the apron and pegged.',
      joinery: 'Dovetailed drawer, pegged apron', weight: '34 kg', delivered: 'Delivered built and carried in',
      detail: 'DOVETAILED DRAWER', detailTab: 'Drawer' },
    { id: 'low-shelf', name: 'Long Low Shelf', type: 'shelf-low', cat: 'Shelving', added: '2026-10-05', rank: 6,
      finishes: ['oak', 'walnut', 'ebonised'],
      sizes: [
        { id: '120', label: '120 cm', dim: 'W 120 x D 40 x H 56 cm', short: '3 sections', price: 16800, units: 3 },
        { id: '160', label: '160 cm', dim: 'W 160 x D 40 x H 56 cm', short: '4 sections', price: 21400, units: 4 }],
      ready: {}, paused: {},
      blurb: 'The Rook joinery at knee height, for records or a television. 56 cm tall, with a cable slot cut into the back boards.',
      joinery: 'Through mortise and tenon, pegged with oak', weight: '29 kg', delivered: 'Delivered built and carried in',
      detail: 'THROUGH TENON, OAK PEG', detailTab: 'Joint' },
    { id: 'turned-lamp', name: 'Turned Floor Lamp', type: 'lamp', cat: 'Lighting', added: '2025-04-22', rank: 7,
      finishes: ['ash'],
      sizes: [{ id: 'one', label: 'One size', dim: 'H 160 x Shade 38 cm', short: 'H 160 cm', price: 7800, units: 1 }],
      ready: { 'ash:one': 3 }, paused: {},
      blurb: 'A turned ash stem tenoned into a weighted base, under a paper shade. It takes one standard E27 bulb and switches at the foot.',
      joinery: 'Stem tenoned into the base', weight: '7 kg', delivered: 'Delivered built, shade packed separately',
      detail: 'FOOT SWITCH ON THE CABLE', detailTab: 'Switch' },
    { id: 'spindle-bench', name: 'Spindle Bench', type: 'bench', cat: 'Seating', added: '2024-08-05', rank: 8,
      finishes: ['oak', 'ash'],
      sizes: [
        { id: '100', label: '100 cm', dim: 'W 100 x D 34 x H 45 cm', short: 'Seats 2', price: 9600, units: 100 },
        { id: '140', label: '140 cm', dim: 'W 140 x D 34 x H 45 cm', short: 'Seats 3', price: 11800, units: 140 }],
      ready: {}, paused: {},
      blurb: 'A thick seat on splayed legs, each one wedged through the seat from above, the way Windsor chairs are made.',
      joinery: 'Wedged through tenons', weight: '14 kg', delivered: 'Delivered built and carried in',
      detail: 'WEDGED LEG TENON', detailTab: 'Joint' },
    { id: 'pedestal-table', name: 'Pedestal Side Table', type: 'pedestal', cat: 'Tables', added: '2025-07-30', rank: 9,
      finishes: ['walnut'],
      sizes: [{ id: 'one', label: 'One size', dim: 'D 42 x H 52 cm', short: 'H 52 cm', price: 6400, units: 1 }],
      ready: { 'walnut:one': 4 }, paused: {},
      blurb: 'A turned walnut stem wedged into the top and set in a round base. 52 cm tall, a little above a sofa arm.',
      joinery: 'Turned stem, wedged into the top', weight: '6 kg', delivered: 'Delivered built',
      detail: 'WEDGED STEM', detailTab: 'Joint' },
    { id: 'cord-stool', name: 'Cord Stool', type: 'stool', cat: 'Seating', added: '2024-05-12', rank: 10,
      finishes: ['oak'],
      sizes: [{ id: 'one', label: 'One size', dim: 'W 40 x D 36 x H 65 cm', short: 'Counter height', price: 4900, units: 1 }],
      ready: {}, paused: { 'oak:one': 'March 2027' }, pausedWhy: 'The paper cord for the seats is on order.',
      blurb: 'An oak counter stool, 65 cm tall, with a seat woven from paper cord. A worn seat can be cut out and woven again.',
      joinery: 'Pegged mortise and tenon, woven cord seat', weight: '4 kg', delivered: 'Delivered built',
      detail: 'WOVEN PAPER CORD SEAT', detailTab: 'Seat' }
  ];
  const MAX_QTY = 4;
  const FREE_DELIVERY = 20000;
  const byId = id => PRODUCTS.find(p => p.id === id);
  const readyOf = (p, f, s) => p.ready[`${f}:${s}`] || 0;
  const pausedOf = (p, f, s) => p.paused[`${f}:${s}`] || '';
  const maxQty = (p, f, s) => (pausedOf(p, f, s) ? 0 : MAX_QTY);
  const available = p => p.finishes.some(f => p.sizes.some(s => !pausedOf(p, f, s.id)));
  const anyReady = p => p.finishes.some(f => p.sizes.some(s => readyOf(p, f, s.id) > 0));
  const single = p => p.finishes.length === 1 && p.sizes.length === 1;
  const minPrice = p => Math.min(...p.sizes.map(s => s.price));
  const money = n => '฿' + n.toLocaleString('en-US');
  /* The variant a card shows: a ready one if there is one, else the first that can be ordered. */
  const showVariant = p => {
    for (const f of p.finishes) for (const s of p.sizes) if (readyOf(p, f, s.id) > 0) return { finish: f, size: s.id };
    for (const f of p.finishes) for (const s of p.sizes) if (!pausedOf(p, f, s.id)) return { finish: f, size: s.id };
    return { finish: p.finishes[0], size: p.sizes[0].id };
  };
  const whenShips = (p, f, s, qty = 1) => {
    const r = readyOf(p, f, s);
    if (r >= qty) return 'Ready, ships this week';
    if (r > 0) return `${r} ships this week, the rest in ${LEAD}`;
    return `Made to order, ${LEAD}`;
  };

  /* --------------------------------------------------------------- renders */
  /* Front elevations on a 400 x 300 board, ground at y 262. Each returns its
     markup, its bounds, and the point of its most telling detail. */
  const R = (x, y, w, h, c, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}" ${extra}/>`;
  const G = 262;
  const shadow = (w, cx = 200) => `<ellipse cx="${cx}" cy="${G + 2}" rx="${w / 2 + 14}" ry="6" class="shadow"/>`;
  const plank = (x, y, w, h = 7) => R(x, y, w, h, 'wood', 'rx="1"') + R(x, y + h - 2, w, 2, 'wood-shade');
  const peg = (x, y) => `<circle cx="${x}" cy="${y}" r="1.6" class="peg"/>`;

  const DRAW = {
    shelf(units, tall = true) {
      const bay = 56, pw = 8, w = units * bay + pw, x0 = 200 - w / 2, H = tall ? 206 : 84, top = G - H;
      const levels = tall ? 5 : 2;
      let s = shadow(w);
      s += R(x0 + pw, top + 8, w - 2 * pw, H - 20, 'back');
      for (let i = 1; i < units * 3; i++) s += `<line x1="${x0 + pw + i * (w - 2 * pw) / (units * 3)}" y1="${top + 8}" x2="${x0 + pw + i * (w - 2 * pw) / (units * 3)}" y2="${G - 12}" class="line"/>`;
      const ys = [];
      for (let l = 0; l < levels; l++) ys.push(top + 8 + l * ((H - 26) / (levels - 1)));
      ys.forEach(y => { s += plank(x0 + pw / 2, y, w - pw); });
      s += plank(x0 - 4, top, w + 8, 8);
      for (let i = 0; i <= units; i++) {
        const x = x0 + i * bay;
        s += R(x, top + 6, pw, H - 6, 'frame', 'rx="1"');
        ys.forEach(y => { s += peg(x + pw / 2, y + 3.5); });
      }
      return { s, joint: { x: x0 + pw / 2, y: ys[1] + 3 }, b: [x0 - 4, top, w + 8, G - top] };
    },
    'shelf-low'(units) { return DRAW.shelf(units, false); },
    sofa(seats) {
      const seatW = 66 * seats, arm = 14, w = seatW + arm * 2, x0 = 200 - w / 2;
      let s = shadow(w);
      [x0 + 2, x0 + w - 10].forEach(x => { s += R(x, 180, 8, 82, 'frame', 'rx="1"'); });
      s += R(x0 + 2, 234, w - 4, 10, 'frame', 'rx="1"');
      s += R(x0, 176, arm + 4, 8, 'wood', 'rx="2"') + R(x0 + w - arm - 4, 176, arm + 4, 8, 'wood', 'rx="2"');
      for (let i = 0; i < seats; i++) {
        const cx = x0 + arm + i * 66;
        s += R(cx + 1, 150, 64, 58, 'fabric', 'rx="8"') + R(cx + 1, 202, 64, 6, 'fabric-shade', 'rx="3"');
        s += R(cx + 1, 206, 64, 28, 'fabric', 'rx="4"') + R(cx + 1, 230, 64, 4, 'fabric-shade');
        s += `<path d="M${cx + 6} 212 H${cx + 60}" class="line" stroke-dasharray="2 2"/>`;
      }
      [x0 + 6, x0 + w - 6].forEach(x => { s += peg(x, 239); });
      return { s, joint: { x: x0 + arm + 34, y: 212 }, b: [x0, 150, w, G - 150] };
    },
    table(len) {
      const w = Math.round(len * 1.3), x0 = 200 - w / 2;
      let s = shadow(w);
      const legs = [x0 + 24, x0 + w - 34];
      s += R(legs[0], 206, legs[1] - legs[0] + 10, 7, 'wood', 'rx="1"');
      legs.forEach((x, i) => {
        s += R(x, 188, 10, 70, 'frame', 'rx="1"') + R(x - 16, 254, 42, 8, 'frame', 'rx="2"') + R(x - 10, 186, 30, 6, 'frame');
        const tx = i === 0 ? x - 10 : x + 10;
        s += R(tx, 206, 10, 7, 'wood', 'rx="1"');
        s += `<polygon points="${tx + (i === 0 ? 3 : 4)},203 ${tx + (i === 0 ? 7 : 8)},203 ${tx + (i === 0 ? 6 : 7)},216 ${tx + (i === 0 ? 4 : 5)},216" class="wood-shade"/>`;
      });
      s += R(x0, 172, w, 14, 'wood', 'rx="1"') + R(x0, 182, w, 4, 'wood-shade');
      return { s, joint: { x: legs[0] - 5, y: 209 }, b: [x0, 172, w, G - 172] };
    },
    desk(len) {
      const w = Math.round(len * 1.6), x0 = 200 - w / 2;
      let s = shadow(w);
      s += R(x0 + 8, 190, 8, 72, 'frame', 'rx="1"') + R(x0 + w - 16, 190, 8, 72, 'frame', 'rx="1"');
      s += R(x0 + 16, 190, w - 32, 12, 'frame');
      const dx = x0 + w / 2 - 40;
      s += R(dx, 192, 80, 18, 'wood', 'rx="1"') + R(dx, 208, 80, 2, 'wood-shade');
      s += `<circle cx="${dx + 40}" cy="201" r="2.2" class="wood-shade"/>`;
      s += `<path d="M${dx + 2} 194 l4 3 -4 3 4 3 -4 3" class="line"/>`;
      s += R(x0, 182, w, 9, 'wood', 'rx="1"') + R(x0, 189, w, 2, 'wood-shade');
      [x0 + 12, x0 + w - 12].forEach(x => { s += peg(x, 196); });
      return { s, joint: { x: dx + 4, y: 200 }, b: [x0, 182, w, G - 182] };
    },
    bench(len) {
      const w = Math.round(len * 1.7), x0 = 200 - w / 2;
      let s = shadow(w + 20);
      const leg = (xt, xb) => `<polygon points="${xt - 4},224 ${xt + 4},224 ${xb + 4},262 ${xb - 4},262" class="frame"/>`;
      s += leg(x0 + 26, x0 + 8) + leg(x0 + w - 26, x0 + w - 8) + leg(x0 + 46, x0 + 36) + leg(x0 + w - 46, x0 + w - 36);
      s += R(x0 + 20, 242, w - 40, 4, 'frame');
      s += R(x0, 212, w, 14, 'wood', 'rx="2"') + R(x0, 222, w, 4, 'wood-shade');
      [x0 + 26, x0 + w - 26].forEach(x => { s += `<rect x="${x - 3}" y="212" width="6" height="3" class="wood-shade"/>`; });
      return { s, joint: { x: x0 + 26, y: 216 }, b: [x0 - 6, 212, w + 12, G - 212] };
    },
    pedestal() {
      let s = shadow(70);
      s += `<ellipse cx="200" cy="258" rx="34" ry="5" class="frame"/>` + R(166, 252, 68, 6, 'frame', 'rx="3"');
      s += R(195, 186, 10, 68, 'wood');
      s += `<ellipse cx="200" cy="204" rx="8" ry="4" class="wood"/><ellipse cx="200" cy="238" rx="9" ry="4" class="wood"/>`;
      s += `<path d="M195 214 H205 M195 228 H205" class="line"/>`;
      s += R(160, 176, 80, 10, 'wood', 'rx="2"') + R(160, 183, 80, 3, 'wood-shade');
      s += `<rect x="198" y="176" width="4" height="3" class="wood-shade"/>`;
      return { s, joint: { x: 200, y: 182 }, b: [160, 176, 80, G - 176] };
    },
    lamp() {
      let s = `<ellipse cx="200" cy="${G}" rx="32" ry="5" class="shadow"/>`;
      s += `<path d="M212 254 C240 256 250 258 262 260" class="cord"/>`;
      s += R(238, 254, 14, 6, 'frame', 'rx="2"');
      s += R(197, 112, 6, 140, 'wood');
      s += `<ellipse cx="200" cy="150" rx="5" ry="3" class="wood-shade"/><ellipse cx="200" cy="200" rx="5" ry="3" class="wood-shade"/>`;
      s += R(176, 248, 48, 12, 'frame', 'rx="4"');
      s += `<polygon points="166,56 234,56 250,108 150,108" class="paper"/><polygon points="166,56 234,56 250,108 150,108" class="line"/>`;
      return { s, joint: { x: 245, y: 257 }, b: [150, 56, 112, G - 56] };
    },
    bed(units) {
      const w = units, x0 = 200 - w / 2;
      let s = shadow(w);
      s += R(x0, 150, 10, 112, 'frame', 'rx="1"') + R(x0 + w - 10, 150, 10, 112, 'frame', 'rx="1"');
      s += R(x0 + 10, 156, w - 20, 50, 'wood');
      for (let i = 1; i < 8; i++) s += `<line x1="${x0 + 10 + i * (w - 20) / 8}" y1="158" x2="${x0 + 10 + i * (w - 20) / 8}" y2="204" class="line"/>`;
      [160, 198].forEach(y => { s += peg(x0 + 5, y) + peg(x0 + w - 5, y); });
      s += R(x0 + 18, 186, (w - 46) / 2, 22, 'paper', 'rx="8"') + R(x0 + 28 + (w - 46) / 2, 186, (w - 46) / 2, 22, 'paper', 'rx="8"');
      s += R(x0 + 10, 202, w - 20, 26, 'paper', 'rx="5"');
      s += R(x0 + 10, 212, w - 20, 16, 'fabric', 'rx="3"') + R(x0 + 10, 224, w - 20, 4, 'fabric-shade');
      s += R(x0 + 10, 228, w - 20, 18, 'wood', 'rx="1"') + R(x0 + 10, 243, w - 20, 3, 'wood-shade');
      [x0 + 5, x0 + w - 5].forEach(x => { s += `<circle cx="${x}" cy="237" r="3" class="wood-shade"/>`; });
      return { s, joint: { x: x0 + 5, y: 160 }, b: [x0, 150, w, G - 150] };
    },
    stool() {
      let s = shadow(64);
      [170, 224].forEach(x => { s += R(x, 202, 6, 60, 'frame', 'rx="1"'); });
      s += R(176, 236, 48, 4, 'frame') + R(176, 250, 48, 3, 'frame');
      s += R(166, 194, 68, 10, 'wood', 'rx="2"');
      s += R(170, 196, 60, 6, 'cord');
      for (let i = 0; i < 10; i++) s += `<line x1="${172 + i * 6}" y1="196" x2="${175 + i * 6}" y2="202" class="line"/>`;
      [173, 227].forEach(x => { s += peg(x, 238); });
      return { s, joint: { x: 200, y: 199 }, b: [164, 194, 72, G - 194] };
    }
  };

  const drawProduct = (p, size) => {
    const sz = p.sizes.find(s => s.id === size) || p.sizes[0];
    return DRAW[p.type](sz.units);
  };

  const ROOM = (inner) => `
    <rect x="0" y="0" width="400" height="${G}" class="wall"/>
    <rect x="0" y="${G}" width="400" height="${300 - G}" class="floor"/>
    <rect x="28" y="34" width="70" height="108" class="window"/>
    <path d="M63 34 V142 M28 88 H98" class="line"/>
    <ellipse cx="200" cy="${G + 12}" rx="168" ry="10" class="shadow" opacity="0.5"/>
    <g>${inner}</g>
    <rect x="344" y="226" width="30" height="36" class="pot" rx="2"/>
    <path d="M359 228 C340 190 330 170 336 150 C352 168 358 196 359 228 Z" class="plant"/>
    <path d="M359 228 C372 196 384 182 392 168 C392 196 378 214 359 228 Z" class="plant-shade"/>
    <path d="M359 228 C356 196 362 172 372 156 C374 184 368 206 359 228 Z" class="plant"/>`;

  /* Taken apart: only for pieces that really come apart, labelled from the data. */
  const PARTS = (p) => {
    const lab = (x, y, t) => `<text x="${x}" y="${y}" class="part-label">${t}</text>`;
    let s = shadow(300);
    if (p.type === 'table') {
      s += R(54, 236, 292, 14, 'wood', 'rx="1"') + R(54, 246, 292, 4, 'wood-shade');
      s += R(70, 250, 70, 12, 'frame', 'rx="2"') + R(150, 250, 70, 12, 'frame', 'rx="2"') + R(232, 252, 110, 10, 'wood', 'rx="1"');
      s += lab(54, 226, p.parts[0]) + lab(70, 280, p.parts[1]) + lab(232, 280, p.parts[2]);
    } else {
      s += R(40, 170, 120, 92, 'wood', 'rx="2"') + R(176, 200, 104, 62, 'wood', 'rx="2"');
      for (let i = 1; i < 6; i++) s += `<line x1="${40 + i * 20}" y1="174" x2="${40 + i * 20}" y2="258" class="line"/>`;
      s += R(296, 248, 70, 6, 'frame') + R(296, 256, 70, 6, 'frame');
      for (let i = 0; i < 5; i++) s += R(296 + i * 2, 220 - i * 6, 66, 4, 'wood-shade');
      s += lab(40, 160, p.parts[0]) + lab(176, 190, p.parts[1]) + lab(296, 280, p.parts[2]) + lab(296, 188, p.parts[3]);
    }
    return s;
  };

  /* Fit a front view to its piece, so a side table does not sit lost in a tile
     drawn for a sofa. minW keeps small pieces from being blown up to sofa size. */
  const fitBox = ([x, y, w, h], minW = 210) => {
    const pad = 0.16 * Math.max(w, h);
    let bw = Math.max(minW, w + 2 * pad), bh = h + 2 * pad;
    if (bw / bh < 4 / 3) bw = bh * 4 / 3; else bh = bw * 3 / 4;
    const cx = x + w / 2, cy = y + h / 2 + 4;
    return `${(cx - bw / 2).toFixed(1)} ${(cy - bh / 2).toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)}`;
  };

  /* The views a product really has: no taken-apart view for a piece that arrives built. */
  const viewsOf = p => [['front', 'Front'], ['detail', p.detailTab], ['room', 'In a room']].concat(p.parts ? [['parts', 'Taken apart']] : []);

  /* view: front | detail | room | parts. Returns a full <svg>. */
  const renderSVG = (p, { finish, size, view = 'front', label = '', cls = 'render', fit = true }) => {
    const { s, joint, b } = drawProduct(p, size);
    let vb = '0 0 400 300';
    if (view === 'front' && fit) vb = fitBox(b);
    if (view === 'parts') vb = fitBox(p.type === 'table' ? [50, 218, 300, 68] : [36, 148, 334, 136], 260);
    let body;
    if (view === 'room') body = ROOM(`<g transform="translate(20 0)">${s}</g>`);
    else if (view === 'parts') body = PARTS(p);
    else if (view === 'detail') {
      const k = 4.5;
      const lw = p.detail.length * 6.2 + 12, tx = Math.min(254, 392 - lw);
      body = `<g transform="translate(200 150) scale(${k}) translate(${-joint.x} ${-joint.y})">${s}</g>
        <circle cx="200" cy="150" r="46" class="callout"/>
        <rect x="${tx - 6}" y="84" width="${lw}" height="20" rx="2" class="label-bg"/>
        <text x="${tx}" y="98" class="part-label">${p.detail}</text>`;
    } else body = s;
    const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" data-finish="${finish}" ${aria} focusable="false">${body}</svg>`;
  };

  /* The collection hero: four pieces in one room, each in its own wood. */
  /* The collection hero: four pieces in one room, each in its own wood, all drawn
     to one scale. K is the bookcase's own scale (206 units for 190 cm). Each piece is
     stretched to its real width and height at K, standing on the same floor line, and
     placed left to right with clear floor between them. */
  const K = 206 / 190;
  const put = ({ s, b }, finish, wCm, hCm, x, bodyW = b[2]) => {
    const sx = (wCm * K / bodyW).toFixed(3), sy = (hCm * K / b[3]).toFixed(3);
    return `<g data-finish="${finish}" transform="translate(${x} ${G}) scale(${sx} ${sy}) translate(${-b[0]} ${-G})">${s}</g>`;
  };
  const renderHero = (label) => `<svg class="render" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}" focusable="false">
      <rect x="0" y="0" width="600" height="${G}" class="wall"/>
      <rect x="0" y="${G}" width="600" height="${300 - G}" class="floor"/>
      <rect x="290" y="44" width="92" height="104" class="window"/>
      <path d="M336 44 V148 M290 96 H382" class="line"/>
      <ellipse cx="340" cy="${G + 14}" rx="200" ry="10" class="shadow" opacity="0.5"/>
      ${put(DRAW.shelf(3), 'oak', 120, 190, 60)}
      ${put(DRAW.pedestal(), 'walnut', 42, 52, 218)}
      ${put(DRAW.sofa(2), 'moss', 168, 76, 294)}
      ${put(DRAW.lamp(), 'ash', 38, 160, 494, 100)}
    </svg>`;

  /* ------------------------------------------------------------------ theme */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the page still works */ } }
  };
  const root = document.documentElement;
  const setTheme = (t) => {
    root.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.setAttribute('aria-pressed', String(t === 'dark'));
    });
  };
  let initialTheme = store.get('pellwood-theme', null);
  if (!initialTheme) { try { initialTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { initialTheme = 'light'; } }
  setTheme(initialTheme);
  document.querySelectorAll('.theme-toggle').forEach(b => b.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next); store.set('pellwood-theme', next);
  }));

  /* ------------------------------------------------------------------- cart */
  let cart = store.get('pellwood-cart', []);
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter(l => byId(l.pid));
  const save = () => store.set('pellwood-cart', cart);
  const lineKey = (pid, finish, size) => `${pid}|${finish}|${size}`;
  const lineOf = l => {
    const p = byId(l.pid); const sz = p.sizes.find(s => s.id === l.size) || p.sizes[0];
    return { p, sz, total: sz.price * l.qty, max: Math.max(1, maxQty(p, l.finish, l.size)) };
  };
  const count = () => cart.reduce((a, l) => a + l.qty, 0);
  const subtotal = () => cart.reduce((a, l) => a + lineOf(l).total, 0);

  const live = document.createElement('div');
  live.className = 'sr-only'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);
  const announce = (msg) => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); };

  const updateCount = (bump) => {
    const n = count();
    document.querySelectorAll('.cart-btn').forEach(b => {
      const c = b.querySelector('.cart-count');
      c.textContent = String(n);
      b.setAttribute('aria-label', `Cart, ${n} ${n === 1 ? 'item' : 'items'}`);
      if (bump) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    });
  };

  /* ----------------------------------------------------------------- drawer */
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const drawer = document.createElement('div');
  drawer.className = 'drawer'; drawer.id = 'cart-drawer';
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'cart-title');
  drawer.innerHTML = `
    <div class="drawer-head">
      <h2 id="cart-title" tabindex="-1">Your cart <span class="n"></span></h2>
      <button class="icon-btn" type="button" data-close aria-label="Close cart">${icon('x', 'ico ico-md')}</button>
    </div>
    <div class="meter" aria-live="off"></div>
    <div class="drawer-body"></div>
    <div class="drawer-foot"></div>`;
  document.body.append(scrim, drawer);
  const site = document.querySelector('.site');
  let opener = null, highlight = null;

  /* The empty cart counts what is really waiting in the workshop, from the stock data. */
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const emptyCopy = () => {
    const n = PRODUCTS.filter(anyReady).length, all = PRODUCTS.length;
    const say = (k) => WORDS[k] || String(k);
    const lead = `Most pieces are made to order in ${LEAD}.`;
    if (!n) return lead;
    const who = say(n).charAt(0).toUpperCase() + say(n).slice(1);
    return `${lead} ${who} of the ${say(all)} also ${n === 1 ? 'has' : 'have'} a finished piece waiting in the workshop that ships this week.`;
  };

  const renderDrawer = () => {
    const n = count(), sub = subtotal();
    drawer.querySelector('.n').textContent = `(${n})`;
    const meter = drawer.querySelector('.meter');
    const body = drawer.querySelector('.drawer-body');
    const foot = drawer.querySelector('.drawer-foot');
    if (!cart.length) {
      meter.hidden = true; foot.hidden = true; meter.innerHTML = ''; foot.innerHTML = '';
      body.innerHTML = `<div class="drawer-empty">
        ${icon('bag', 'ico-xl')}
        <h3>Nothing in your cart yet.</h3>
        <p>${emptyCopy()}</p>
        <a class="btn btn-primary" href="index.html#grid" data-shop>Shop the collection</a>
        <button class="text-btn" type="button" data-close>Close the cart</button>
      </div>`;
      return;
    }
    meter.hidden = false; foot.hidden = false;
    const left = FREE_DELIVERY - sub, pct = Math.min(100, Math.round(sub / FREE_DELIVERY * 100));
    meter.classList.toggle('done', left <= 0);
    meter.innerHTML = `<p>${left > 0 ? `${icon('truck')}<span>${money(left)} more for free delivery</span>` : `${icon('circle-check')}<span>Free delivery is on this order</span>`}</p>
      <div class="bar" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="fill" style="inline-size:${pct}%"></div></div>`;
    body.innerHTML = `<ul class="lines">${cart.map((l, i) => {
      const { p, sz, total, max } = lineOf(l);
      const added = highlight === lineKey(l.pid, l.finish, l.size);
      return `<li class="line-item${added ? ' added' : ''}" data-i="${i}">
        <div class="line-thumb">${renderSVG(p, { finish: l.finish, size: l.size })}</div>
        <div class="line-info">
          ${added ? '<span class="badge line-tag">Just added</span>' : ''}
          <div class="line-top"><a class="line-name" href="product.html?p=${p.id}">${p.name}</a><span class="line-price">${money(total)}</span></div>
          <p class="line-variant">${FINISHES[l.finish].name}${p.sizes.length > 1 ? `, ${sz.label}` : ''}</p>
          <p class="line-ship">${whenShips(p, l.finish, l.size, l.qty)}</p>
          <div class="line-actions">
            <div class="stepper sm" role="group" aria-label="Quantity of ${p.name}">
              <button class="icon-btn" type="button" data-dec aria-label="One fewer ${p.name}" ${l.qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
              <output aria-live="polite">${l.qty}</output>
              <button class="icon-btn" type="button" data-inc aria-label="One more ${p.name}" ${l.qty >= max ? 'disabled' : ''}>${icon('plus')}</button>
            </div>
            <button class="text-btn danger" type="button" data-remove>Remove<span class="sr-only"> ${p.name}</span></button>
          </div>
        </div>
      </li>`;
    }).join('')}</ul>`;
    foot.innerHTML = `
      <div class="sum"><span>Subtotal</span><span class="v">${money(sub)}</span></div>
      <div class="sum"><span>Delivery</span><span class="v">${left <= 0 ? 'Free' : 'From ' + money(900)}</span></div>
      <div class="sum total"><span>Total</span><span class="v">${money(sub + (left <= 0 ? 0 : 900))}</span></div>
      <button class="btn btn-primary btn-lg btn-block" type="button" data-checkout>Check out</button>
      <p class="foot-note" role="status"></p>`;
  };

  const focusables = () => [...drawer.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el === document.activeElement);

  const openDrawer = (from, focusTitle) => {
    opener = from || document.activeElement;
    renderDrawer();
    drawer.classList.add('open'); scrim.classList.add('open');
    document.body.classList.add('locked');
    if (site) site.inert = true;
    document.querySelectorAll('.cart-btn').forEach(b => b.setAttribute('aria-expanded', 'true'));
    requestAnimationFrame(() => {
      if (focusTitle) drawer.querySelector('#cart-title').focus();
      else (drawer.querySelector('[data-close]')).focus();
    });
  };
  const closeDrawer = (restore = true) => {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open'); scrim.classList.remove('open');
    document.body.classList.remove('locked');
    if (site) site.inert = false;
    highlight = null;
    document.querySelectorAll('.cart-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (restore && opener && document.contains(opener)) opener.focus();
  };

  drawer.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement.id === 'cart-title')) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  scrim.addEventListener('click', () => closeDrawer());
  drawer.addEventListener('click', e => {
    /* "Shop the collection" on the page that holds the collection: close the cart,
       then take the reader to the grid and put focus on its heading. */
    const shop = e.target.closest('a[data-shop]');
    const grid = document.getElementById('grid');
    if (shop && grid) {
      e.preventDefault();
      closeDrawer(false);
      const title = document.getElementById('col-title');
      grid.scrollIntoView({ block: 'start' });
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
      return;
    }
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-close')) { closeDrawer(); return; }
    if (t.hasAttribute('data-checkout')) {
      drawer.querySelector('.foot-note').textContent = 'This is an example shop, so checkout stops here and nothing is charged. Your cart stays saved on this device.';
      return;
    }
    const li = t.closest('.line-item'); if (!li) return;
    const i = +li.dataset.i, l = cart[i]; const { p, max } = lineOf(l);
    let focusSel = null;
    if (t.hasAttribute('data-inc')) { l.qty = Math.min(max, l.qty + 1); focusSel = l.qty >= max ? '[data-dec]' : '[data-inc]'; announce(`${p.name}, quantity ${l.qty}.`); }
    else if (t.hasAttribute('data-dec')) { l.qty = Math.max(1, l.qty - 1); focusSel = l.qty <= 1 ? '[data-inc]' : '[data-dec]'; announce(`${p.name}, quantity ${l.qty}.`); }
    else if (t.hasAttribute('data-remove')) { cart.splice(i, 1); announce(`${p.name} removed. ${count()} items in cart.`); }
    save(); updateCount(false); renderDrawer();
    if (focusSel) { const el = drawer.querySelector(`.line-item[data-i="${i}"] ${focusSel}`); if (el) el.focus(); }
    else { (drawer.querySelector('.line-item [data-remove]') || drawer.querySelector('.drawer-empty a') || drawer.querySelector('[data-close]')).focus(); }
  });
  document.querySelectorAll('.cart-btn').forEach(b => b.addEventListener('click', () => openDrawer(b, false)));

  const addToCart = (pid, finish, size, qty, from) => {
    const p = byId(pid); const max = maxQty(p, finish, size);
    const k = lineKey(pid, finish, size);
    const existing = cart.find(l => lineKey(l.pid, l.finish, l.size) === k);
    if (existing) existing.qty = Math.min(max, existing.qty + qty);
    else cart.unshift({ pid, finish, size, qty: Math.min(max, qty) });
    save(); highlight = k; updateCount(true);
    const sz = p.sizes.find(s => s.id === size);
    announce(`${p.name}${p.sizes.length > 1 ? ', ' + sz.label : ''}, ${FINISHES[finish].name}, added to cart. ${count()} items in cart.`);
    openDrawer(from, true);
  };

  /* Busy state for any add button: full strength, spinner in place of the icon. */
  const busy = (btn, label, fn) => {
    if (btn.getAttribute('aria-busy') === 'true') return;
    const txt = btn.querySelector('.label'); const before = txt.textContent;
    btn.setAttribute('aria-busy', 'true'); txt.textContent = label;
    setTimeout(() => { btn.removeAttribute('aria-busy'); txt.textContent = before; fn(); }, 650);
  };

  /* --------------------------------------------------------------- listbox */
  /* Select-only combobox: a button trigger that announces its value, a real
     listbox, arrows / Home / End / typeahead / Enter / Space / Escape / Tab. */
  const makeListbox = (rootEl, onPick) => {
    const trig = rootEl.querySelector('.lb-trigger');
    const list = rootEl.querySelector('.lb-list');
    const valueEl = trig.querySelector('.lb-value');
    const opts = () => [...list.querySelectorAll('[role="option"]')];
    const isOpen = () => trig.getAttribute('aria-expanded') === 'true';
    const setOpen = (v) => { trig.setAttribute('aria-expanded', String(v)); list.hidden = !v; };
    const selected = () => opts().find(o => o.getAttribute('aria-selected') === 'true') || opts()[0];
    const pick = (o, silent) => {
      opts().forEach(x => x.setAttribute('aria-selected', String(x === o)));
      valueEl.textContent = o.dataset.label || o.textContent.trim();
      setOpen(false); if (!silent) trig.focus();
      onPick(o.dataset.value);
    };
    trig.addEventListener('click', () => { const v = !isOpen(); setOpen(v); if (v) selected().focus(); });
    trig.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); selected().focus(); }
      else if (e.key === 'Escape' && isOpen()) { e.preventDefault(); setOpen(false); }
    });
    let typed = '', typedAt = 0;
    list.addEventListener('keydown', e => {
      const o = opts(), i = o.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); o[Math.min(o.length - 1, i + 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); o[Math.max(0, i - 1)].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); o[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); o[o.length - 1].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) pick(o[i]); }
      else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trig.focus(); }
      else if (e.key === 'Tab') { setOpen(false); }
      else if (e.key.length === 1) {
        const now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + e.key.toLowerCase(); typedAt = now;
        const hit = o.find(x => (x.dataset.label || x.textContent).trim().toLowerCase().startsWith(typed));
        if (hit) hit.focus();
      }
    });
    list.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) pick(o); });
    document.addEventListener('click', e => { if (isOpen() && !rootEl.contains(e.target)) setOpen(false); });
    opts().forEach(o => { o.tabIndex = -1; });
    return { pick, opts };
  };

  updateCount(false);
  window.Pellwood = { PRODUCTS, FINISHES, LEAD, byId, readyOf, pausedOf, maxQty, available, anyReady, single, showVariant, whenShips, viewsOf, minPrice, money, renderSVG, renderHero, icon, addToCart, busy, makeListbox, openDrawer, store };
})();
