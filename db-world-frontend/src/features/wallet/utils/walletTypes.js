import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

/**
 * `iconKey` → component. The backend stores a SEMANTIC key ("passport", "vehicle", "bank") rather
 * than an icon-library class name, so the schema never has to change when the frontend swaps icon
 * sets — this map is the only thing that would.
 *
 * Unknown keys fall back to a generic document icon rather than rendering nothing: an admin can
 * create a type with any key they like, and a missing icon must not leave a hole in the row.
 */
const ICONS = {
  identity: BadgeOutlinedIcon,
  tax: ReceiptLongOutlinedIcon,
  vote: HowToVoteOutlinedIcon,
  certificate: WorkspacePremiumOutlinedIcon,
  passport: PublicOutlinedIcon,
  travel: FlightTakeoffOutlinedIcon,
  licence: CreditCardOutlinedIcon,
  vehicle: DirectionsCarFilledOutlinedIcon,
  insurance: VerifiedUserOutlinedIcon,
  education: SchoolOutlinedIcon,
  bank: AccountBalanceOutlinedIcon,
  health: LocalHospitalOutlinedIcon,
  work: BusinessCenterOutlinedIcon,
  property: HomeWorkOutlinedIcon,
  other: DescriptionOutlinedIcon,
};

export const typeIcon = (iconKey) => ICONS[iconKey] ?? DescriptionOutlinedIcon;

/**
 * A colour per category, for the card's icon tile.
 *
 * Fixed mid-tone hexes rather than theme tokens, for the same reason the IPO lot tiers use them:
 * these are identity, not state, and they have to stay recognisable and legible against both AMOLED
 * black and pure white without the theme reinterpreting them.
 *
 * Scoped deliberately to the TILE. The card's accent edge stays reserved for expiry, so the two
 * never compete: colour inside the tile says what a document is, colour on the edge says whether it
 * needs attention.
 */
const CATEGORY_COLORS = {
  IDENTITY: '#0d9488',
  TRAVEL: '#2563eb',
  VEHICLE: '#7c3aed',
  EDUCATION: '#c026d3',
  FINANCIAL: '#0891b2',
  HEALTH: '#e11d48',
  WORK: '#b45309',
  PROPERTY: '#4d7c0f',
  OTHER: '#64748b',
};

export const categoryColor = (category) => CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;

/** Display order and labels for the picker's groups. Anything with an unrecognised or missing
 * category is filed last under "Other", so an admin-created type is never dropped. */
const CATEGORY_LABELS = {
  IDENTITY: 'Identity',
  TRAVEL: 'Travel',
  VEHICLE: 'Vehicle',
  EDUCATION: 'Education',
  FINANCIAL: 'Financial',
  HEALTH: 'Health',
  WORK: 'Work',
  PROPERTY: 'Property',
  OTHER: 'Other',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export const categoryLabel = (category) => CATEGORY_LABELS[category] ?? CATEGORY_LABELS.OTHER;

/**
 * Groups types for the picker, preserving each group's server-side `sortOrder` within it.
 *
 * Grouping is what makes a thirty-five-item list usable at all — as one flat dropdown the full
 * Indian set is materially worse to use than the six types it replaced, which is the trap this
 * avoids. Empty groups are dropped, so a wallet whose admin has deactivated everything financial
 * never shows an empty "Financial" heading.
 */
export const groupTypesByCategory = (types) => {
  const buckets = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  (types ?? []).forEach((t) => {
    const key = CATEGORY_LABELS[t.category] ? t.category : 'OTHER';
    buckets.get(key).push(t);
  });
  return CATEGORY_ORDER
    .map((key) => ({ key, label: CATEGORY_LABELS[key], types: buckets.get(key) }))
    .filter((g) => g.types.length > 0);
};

/**
 * Distinct holder names already used in this wallet, for the "Belongs to" autocomplete.
 *
 * Derived from the user's own documents rather than stored in a table: a `wallet_holder` entity
 * would need a migration, an admin surface and a cascade story, to hold what is already sitting in
 * a column. Offering the existing values back is what actually matters — free text alone lets
 * "Dad", "Father" and "father" become three different people, and no amount of schema fixes that.
 *
 * Matching is case-insensitive but the FIRST spelling wins, so the list stays stable rather than
 * flipping between casings as documents are added.
 */
export const holderOptions = (docs) => {
  const seen = new Map();
  (docs ?? []).forEach((d) => {
    const name = (d.holderName ?? '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

/**
 * Standard Indian family relationships, offered alongside whatever the wallet already uses.
 *
 * Relationships rather than names on purpose: they are shorter on a chip, they never change, and
 * they are how you would actually say it out loud — "dad's PAN card". Free text still accepts
 * anything, so a par-dadi or a second brother is one keystroke away; this is the common path, not
 * a constraint.
 */
export const HOLDER_PRESETS = [
  'Self', 'Wife', 'Husband',
  'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister',
  'Dada', 'Dadi', 'Nana', 'Nani',
  'Father-in-law', 'Mother-in-law', 'Uncle', 'Aunt',
];

/**
 * Autocomplete options: holders already in the wallet first, then the presets not yet used.
 *
 * Order is the whole trick. Suggesting what you have already typed is what stops "Dad" and "Father"
 * from splitting into two people; offering the standard set after that is what makes the field
 * useful on the very first document, when there is no history to learn from.
 */
export const holderSuggestions = (docs) => {
  const used = holderOptions(docs);
  const usedKeys = new Set(used.map((h) => h.toLowerCase()));
  return [...used, ...HOLDER_PRESETS.filter((p) => !usedKeys.has(p.toLowerCase()))];
};

/**
 * Buckets documents by holder, for the person-grouped grid.
 *
 * Ordering puts the presets' own order first — Self, then Wife/Husband, then Father, Mother and
 * outwards — because that is roughly how a family reads, and alphabetical would open on "Aunt".
 * Anything not in the preset list follows alphabetically, and documents with no holder at all land
 * in a final "Unassigned" section rather than disappearing.
 */
export const groupDocsByHolder = (docs) => {
  const buckets = new Map();
  const unassigned = [];
  (docs ?? []).forEach((d) => {
    const name = (d.holderName ?? '').trim();
    if (!name) { unassigned.push(d); return; }
    const key = name.toLowerCase();
    if (!buckets.has(key)) buckets.set(key, { key, label: name, docs: [] });
    buckets.get(key).docs.push(d);
  });

  const rank = (label) => {
    const i = HOLDER_PRESETS.findIndex((p) => p.toLowerCase() === label.toLowerCase());
    return i === -1 ? HOLDER_PRESETS.length : i;
  };
  const sections = [...buckets.values()].sort((a, b) => {
    const diff = rank(a.label) - rank(b.label);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
  if (unassigned.length > 0) sections.push({ key: '__none', label: 'Unassigned', docs: unassigned });
  return sections;
};
