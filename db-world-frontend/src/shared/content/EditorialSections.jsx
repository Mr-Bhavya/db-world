import { Box, Typography } from '@mui/material';

import { useT } from '@shared/theme';
import { pageContent } from './siteContent';

/**
 * The editorial block that gives a page something to be about.
 *
 * Renders the shared copy in `site-content.json` for one page key. `SeoRenderController`
 * walks the SAME JSON to build its crawler HTML, so the two stay in step by
 * construction — which is what keeps dynamic rendering legitimate rather than cloaking.
 * Handles exactly the two section shapes that file documents (`paragraphs` and `list`);
 * teaching it a third means teaching the Java side too.
 *
 * This exists because AdSense rejected the site in September 2026 for "low value
 * content" and for ads on screens without publisher content. A launcher grid, a game
 * board and a weather widget are all screens with nothing to read — this is what turns
 * them into pages, and it is why the ad units on them are allowed to render at all.
 *
 * @param {object}  props
 * @param {string}  props.page          Key in `site-content.json` → `pages`.
 * @param {boolean} [props.showLead]    Render the lead paragraph. Off where the page
 *                                      already has its own intro above the fold.
 * @param {object}  [props.sx]
 */
export default function EditorialSections({ page, showLead = true, sx }) {
  const T = useT();
  const content = pageContent(page);

  // A missing key degrades to no block, never to a blank screen.
  if (!content?.sections?.length) return null;

  return (
    <Box
      component="section"
      // Not <article>: this is supporting reference copy about the page, not the
      // page's primary subject.
      sx={{
        maxWidth: 900,
        mx: 'auto',
        px: { xs: 2, md: 3 },
        py: { xs: 4, md: 6 },
        color: T.textPrimary,
        ...sx,
      }}
    >
      {showLead && content.lead && (
        <Typography
          sx={{
            fontSize: { xs: 15, md: 16.5 },
            lineHeight: 1.7,
            color: T.textMuted,
            mb: { xs: 3, md: 4 },
          }}
        >
          {content.lead}
        </Typography>
      )}

      {content.sections.map((section) => (
        <Box key={section.heading} sx={{ mb: { xs: 3.5, md: 4.5 }, '&:last-of-type': { mb: 0 } }}>
          {/* h2 throughout: the page's own hero owns the single h1, and a second one
              here would leave the document with two competing top-level headings. */}
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 17, md: 19 },
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: T.textPrimary,
              mb: 1.5,
            }}
          >
            {section.heading}
          </Typography>

          {section.paragraphs?.map((paragraph) => (
            <Typography
              key={paragraph.slice(0, 48)}
              sx={{
                fontSize: { xs: 14.5, md: 15.5 },
                lineHeight: 1.75,
                color: T.textMuted,
                mb: 1.75,
                '&:last-child': { mb: 0 },
              }}
            >
              {paragraph}
            </Typography>
          ))}

          {section.list && (
            // A real <dl>: these are term/definition pairs, and the markup should say
            // so for a screen reader and for anything parsing the page.
            <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.75 }}>
              {section.list.map((item) => (
                <Box key={item.term}>
                  <Typography
                    component="dt"
                    sx={{ fontSize: { xs: 14, md: 14.5 }, fontWeight: 800, color: T.teal, mb: 0.35 }}
                  >
                    {item.term}
                  </Typography>
                  <Typography
                    component="dd"
                    sx={{ m: 0, fontSize: { xs: 14, md: 15 }, lineHeight: 1.7, color: T.textMuted }}
                  >
                    {item.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
