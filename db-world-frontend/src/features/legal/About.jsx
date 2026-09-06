import React from 'react';

import EditorialSections from '@shared/content/EditorialSections';
import { pageContent } from '@shared/content/siteContent';
import LegalPage from './LegalPage';

/**
 * About DB World.
 *
 * An AdSense reviewer looks for a site that says who runs it, how it is funded and what
 * it does with your data — and until now the only answers lived in the privacy policy,
 * which is not where anyone looks for them. It is also the page most likely to be read
 * by a person deciding whether the site is a real thing or a template.
 *
 * The copy comes from the shared content file, so `SeoRenderController` serves crawlers
 * the same words from `/api/seo/page/about`. On the plain `LegalPage` shell rather than
 * the app's glass surfaces, matching privacy/terms/contact — a reviewer should not have
 * to work out whether an animated panel is content.
 */
export default function About() {
  const content = pageContent('about');

  return (
    <LegalPage title={content?.h1 ?? 'About DB World'}>
      {/* The shell owns the h1, so the block below starts at h2 — which is what
          EditorialSections emits. */}
      <EditorialSections page="about" sx={{ maxWidth: 'none', mx: 0, px: 0, py: 0 }} />
    </LegalPage>
  );
}
