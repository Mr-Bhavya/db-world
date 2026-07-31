/**
 * Password Manager — shared crypto + strength utilities
 * ------------------------------------------------------
 * Single source of truth for secure generation and strength scoring.
 * Previously the generator was copy-pasted in GeneratePassword + AddPassword;
 * both now import from here.
 */

// ─── Character pools ──────────────────────────────────────────────────────────
export const POOLS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
};

// Characters that are easy to confuse (O/0, l/1/I, etc.)
const SIMILAR = /[O0Il1|`'".,;:]/g;

// ─── Unbiased CSPRNG integer in [0, max) via rejection sampling ───────────────
const randomInt = (max) => {
  if (max <= 0) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const arr = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(arr);
    x = arr[0];
  } while (x >= limit);
  return x % max;
};

const pick = (charset) => charset[randomInt(charset.length)];

// Fisher–Yates shuffle backed by the CSPRNG.
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Generate a cryptographically secure random password.
 * Guarantees at least one character from every enabled pool.
 */
export const generatePassword = ({
  length = 16,
  upper = true,
  lower = true,
  numbers = true,
  symbols = true,
  excludeSimilar = false,
} = {}) => {
  const clean = (s) => (excludeSimilar ? s.replace(SIMILAR, '') : s);

  const active = [
    upper   && clean(POOLS.upper),
    lower   && clean(POOLS.lower),
    numbers && clean(POOLS.numbers),
    symbols && clean(POOLS.symbols),
  ].filter(Boolean);

  if (active.length === 0) return '';

  const all = active.join('');
  const len = Math.max(length, active.length);

  // One guaranteed char from each active pool, then fill the rest.
  const out = active.map(pick);
  while (out.length < len) out.push(pick(all));

  return shuffle(out).join('');
};

// ─── Passphrase mode ──────────────────────────────────────────────────────────
// Compact, memorable, unambiguous word list (EFF-style short words).
export const WORDS = [
  'able','acid','aged','also','arch','army','atom','aunt','away','baby','back','bald',
  'band','bank','barn','base','bath','bead','beam','bean','bear','beat','bell','belt',
  'bend','best','bike','bird','bite','blue','boat','body','bold','bolt','bone','book',
  'boot','born','boss','both','bowl','brave','bread','brick','bright','bring','brush',
  'cabin','cable','cake','calm','camp','cane','card','care','cart','case','cash','cave',
  'cell','chair','chalk','charm','chart','chase','cheer','chess','chief','chin','city',
  'clay','clean','clear','click','cliff','climb','clock','cloud','coal','coast','coat',
  'code','coin','cold','comet','cook','cool','coral','cost','crab','craft','crane','crew',
  'crop','cube','curl','daily','dance','dark','dash','dawn','deal','deer','desk','dial',
  'dice','disk','dive','dock','dome','door','dove','draft','dream','dress','drift','drop',
  'drum','duck','dune','dusk','eagle','early','earth','east','echo','edge','elbow','elf',
  'elite','ember','entry','fable','fair','fall','farm','fast','fern','film','fire','fish',
  'flag','flame','flint','float','flood','flute','foam','foil','fold','fork','fort','frog',
  'frost','fuel','gate','gear','gift','glad','glass','globe','glow','goat','gold','golf',
  'grape','grass','grid','grip','grove','half','hall','hand','hawk','haze','herb','hero',
  'hill','hive','hold','home','honey','hood','hope','horn','host','hour','hunt','ideal',
  'iron','isle','item','ivory','jade','joke','jump','keen','kite','knot','lace','lake',
  'lamp','land','lane','leaf','leap','lemon','lens','level','light','lily','lime','link',
  'lion','list','load','lock','loft','lunar','maple','march','mark','mask','mast','maze',
  'mint','mist','moon','moss','moth','music','navy','nest','night','noble','north','note',
  'oak','oasis','ocean','olive','onyx','opal','orbit','otter','owl','palm','panda','park',
  'path','peak','pearl','pilot','pine','plum','pond','post','print','prism','pulse','pond',
  'quartz','quest','quick','quiet','radar','rain','ranch','raven','reef','rice','ridge',
  'ring','river','road','robin','rock','root','rope','rose','ruby','safe','sage','sail',
  'salt','sand','scarf','scout','seal','seed','shade','shard','shark','sheep','shell','ship',
  'shore','silk','silver','sky','slate','sled','snow','soft','solar','song','south','spark',
  'spice','spine','spool','sport','spring','stag','star','steam','steel','stem','stone','storm',
  'straw','swan','swift','table','tape','teal','tent','tide','tiger','tile','toast','token',
  'topaz','torch','tower','track','trail','tree','tribe','trout','tulip','tuna','vapor','vast',
  'vault','vine','violet','vivid','wave','west','whale','wheat','wind','wing','wolf','wood',
  'wool','yarn','zebra','zero','zone',
];

/**
 * Generate a memorable passphrase, e.g. "Brave-Tiger-Coral-42".
 */
export const generatePassphrase = ({
  words = 4,
  separator = '-',
  capitalize = true,
  number = true,
} = {}) => {
  const parts = [];
  for (let i = 0; i < words; i++) {
    let w = WORDS[randomInt(WORDS.length)];
    if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    parts.push(w);
  }
  if (number) parts.push(String(randomInt(90) + 10)); // 10–99
  return parts.join(separator);
};

// ─── Strength scoring ─────────────────────────────────────────────────────────
// Levels are index 0..4. Colors are chosen to hold 4.5:1 on both black + white.
export const STRENGTH_LEVELS = [
  { key: 'empty',  label: '—',           color: '#64748b', glow: 'rgba(100,116,139,0.0)'  },
  { key: 'weak',   label: 'Very weak',   color: '#ef4444', glow: 'rgba(239,68,68,0.35)'   },
  { key: 'fair',   label: 'Weak',        color: '#f97316', glow: 'rgba(249,115,22,0.35)'  },
  { key: 'good',   label: 'Fair',        color: '#eab308', glow: 'rgba(234,179,8,0.35)'   },
  { key: 'strong', label: 'Strong',      color: '#22c55e', glow: 'rgba(34,197,94,0.38)'   },
  { key: 'elite',  label: 'Excellent',   color: '#14b8a6', glow: 'rgba(20,184,166,0.42)'  },
];

const activePoolSize = (pw) => {
  let size = 0;
  if (/[a-z]/.test(pw)) size += 26;
  if (/[A-Z]/.test(pw)) size += 26;
  if (/[0-9]/.test(pw)) size += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) size += 32;
  return size || 1;
};

/**
 * Score a password. Returns entropy bits, a 0–5 level index, and the
 * matching STRENGTH_LEVELS entry. Level 5 ("Excellent") = the teal accent tier.
 */
export const scorePassword = (pw) => {
  if (!pw) return { bits: 0, level: 0, ...STRENGTH_LEVELS[0], pct: 0 };

  const poolSize = activePoolSize(pw);
  let bits = pw.length * Math.log2(poolSize);

  // Light heuristics: penalise obvious repeats / sequences.
  if (/(.)\1{2,}/.test(pw)) bits -= 8;              // aaa, 111
  if (/(?:0123|1234|abcd|qwer|asdf)/i.test(pw)) bits -= 8;
  bits = Math.max(bits, 0);

  let level;
  if (bits < 28)      level = 1;
  else if (bits < 40) level = 2;
  else if (bits < 60) level = 3;
  else if (bits < 90) level = 4;
  else                level = 5;

  // pct drives the meter fill; caps at 128 bits for a full bar.
  const pct = Math.min(100, Math.round((bits / 128) * 100));

  return { bits: Math.round(bits), level, pct, ...STRENGTH_LEVELS[level] };
};

// ─── Vault-level analysis (weak / reused across all credentials) ──────────────
/**
 * Given the vault payload (array of { host, credentials:[{ password, ... }] }),
 * returns per-credential-id flags plus aggregate counts for the dashboard.
 */
export const analyzeVault = (vault = []) => {
  const counts = new Map();
  vault.forEach((entry) =>
    entry.credentials?.forEach((c) => {
      const p = (c.password ?? '').trim();
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    })
  );

  const flags = {};        // credId -> { level, weak, reused }
  let weak = 0;
  let reused = 0;
  let total = 0;

  vault.forEach((entry) =>
    entry.credentials?.forEach((c) => {
      const p = (c.password ?? '').trim();
      total += 1;
      const { level } = scorePassword(p);
      const isWeak = p !== '' && level <= 2;
      const isReused = p !== '' && (counts.get(p) ?? 0) > 1;
      if (isWeak) weak += 1;
      if (isReused) reused += 1;
      flags[c.id] = { level, weak: isWeak, reused: isReused };
    })
  );

  // Health score 0–100: start at 100, dock for weak + reused.
  const penalties = total === 0 ? 0 : ((weak * 1.0 + reused * 0.7) / total) * 100;
  const health = total === 0 ? 100 : Math.max(0, Math.round(100 - penalties));

  return { flags, weak, reused, total, health };
};
