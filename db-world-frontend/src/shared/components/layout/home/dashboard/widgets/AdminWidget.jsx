import React from 'react';

import { useT } from '@shared/theme';
import WidgetShell from '../WidgetShell';
import { Stat, StatRow, WidgetFallback, WidgetNote } from '../widgetParts';

/**
 * Admin Console's tile: the two request queues that need a human. Only ever rendered for
 * OWNER/ADMIN — the registry filters it out otherwise, and the server omits the section too.
 */
export default function AdminWidget({ widget, summary, isLoading, ...shell }) {
  const T = useT();
  const admin = summary?.admin;

  if (!admin && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const media = admin?.pendingMediaRequests ?? 0;
  const catalog = admin?.pendingCatalogRequests ?? 0;
  const total = media + catalog;

  return (
    <WidgetShell widget={widget} {...shell}>
      <StatRow>
        <Stat
          loading={isLoading}
          value={media}
          label="File requests"
          color={media > 0 ? widget.accent : undefined}
          compact
        />
        <Stat
          loading={isLoading}
          value={catalog}
          label="New titles"
          color={catalog > 0 ? widget.accent : undefined}
          compact
        />
      </StatRow>

      {!isLoading && (
        <WidgetNote color={total > 0 ? widget.accent : T.textMuted}>
          {total > 0
            ? `${total} request${total === 1 ? '' : 's'} waiting on you`
            : 'Nothing pending — the queue is clear.'}
        </WidgetNote>
      )}
    </WidgetShell>
  );
}
