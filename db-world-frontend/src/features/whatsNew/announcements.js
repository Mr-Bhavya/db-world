import { LiveTv as LiveTvIcon, ReceiptLong as TallyIcon } from '@mui/icons-material';

import Constants from '@shared/constants';

/**
 * Features worth introducing the first time someone opens the app after they land.
 *
 * <p>`id` is shared with the app registry in `homeData`, so one entry drives both the
 * walkthrough and the "New" badge on that app's tile — and dismissing the walkthrough
 * clears the badge, because they are the same fact.
 *
 * <p>**Remove an entry once it stops being news.** Nothing expires these automatically,
 * and a permanent "New" badge trains people to ignore badges. Anyone who has already
 * dismissed it keeps their seen record, so re-adding an id later will not re-announce it
 * to them — bump the id (`live-tv-v2`) if you genuinely want to say something again.
 */
export const ANNOUNCEMENTS = [
  {
    id: 'live-tv',
    label: 'Live TV',
    Icon: LiveTvIcon,
    accent: '#84cc16',
    route: Constants.DB_LIVE_TV_ROUTE,
    blurb: 'Live channels, streamed straight from the broadcaster.',
    steps: [
      {
        title: 'Live channels, free to watch',
        body: 'Browse live TV alongside your library. Channels stream directly from their '
            + 'own networks, so nothing is stored here and nothing counts against your library.',
      },
      {
        title: 'Find something in seconds',
        body: 'Filter by category from the bar at the top, or open Filters for country, '
            + 'network, quality and language. Search matches channel names and categories.',
      },
      {
        title: 'It keeps itself tidy',
        body: 'Every stream is checked automatically and dead ones are hidden, so what you '
            + 'see should play. If a channel has more than one source, it switches to the '
            + 'next by itself when one drops.',
      },
    ],
  },
  {
    id: 'tally',
    label: 'Tally',
    Icon: TallyIcon,
    accent: '#ec4899',
    route: Constants.DB_TALLY_ROUTE,
    blurb: 'Split expenses with people and groups.',
    steps: [
      {
        title: 'Split expenses without the spreadsheet',
        body: 'Track what you paid, what you owe and who owes you, across one-off splits '
            + 'and ongoing groups.',
      },
      {
        title: 'They do not need an account',
        body: 'Add people by name and settle up with them anyway. Import an existing '
            + 'history straight from a Splitwise CSV.',
      },
      {
        title: 'See where you stand',
        body: 'Per-ledger reports show balances and settle-up suggestions, so closing out '
            + 'a trip or a flat is a couple of taps.',
      },
    ],
  },
];

/** The announcements this device has not dismissed yet, in registry order. */
export function pendingAnnouncements(seen) {
  return ANNOUNCEMENTS.filter((a) => !seen.includes(a.id));
}
