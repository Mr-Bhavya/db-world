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
 * ── LAYOUT ──
 * The section fills its host's width and constrains only the PROSE to a reading
 * measure. It first shipped as a 900px column with `mx: 'auto'`, which centred it
 * inside the hub's 1840px container and left it visibly adrift from the dashboard grid
 * above — it read as stray text under the page rather than part of it. Text is
 * measure-limited because a 1800px line is unreadable; the section is not, because it
 * has to line up with whatever it sits beneath.
 *
 * Term lists render as a card grid rather than a flat run of `dt`/`dd` pairs, which at
 * six or more entries was a wall. Still a real `<dl>` — the grid is on the `dl` itself,
 * so the semantics a screen reader and a crawler see are unchanged.
 *
 * @param {object}  props
 * @param {string}  props.page       Key in `site-content.json` → `pages`.
 * @param {boolean} [props.showLead] Render the lead paragraph. Off where the page
 *                                   already has its own intro above the fold.
 * @param {boolean} [props.divider]  Rule along the top, separating this from whatever
 *                                   it follows. Wanted on a page that ends in cards or
 *                                   widgets; not on one that is already only prose.
 * @param {object}  [props.sx]
 */
export default function EditorialSections({ page, showLead = true, divider = false, sx }) {
  const T = useT();
  const content = pageContent(page);

  // A missing key degrades to no block, never to a blank screen.
  if (!content?.sections?.length) return null;

  /** Prose gets a reading measure; the section itself does not. See the layout note. */
  const measure = { maxWidth: '68ch' };

  return (
    <Box
      component="section"
      // Not <article>: this is supporting reference copy about the page, not the
      // page's primary subject.
      sx={{
        color: T.textPrimary,
        ...(divider
          ? {
            borderTop: `1px solid ${T.border}`,
            mt: { xs: 5, md: 7 },
            pt: { xs: 4, md: 5.5 },
          }
          : {}),
        ...sx,
      }}
    >
      {showLead && content.lead && (
        <Typography
          sx={{
            ...measure,
            fontSize: { xs: 14.5, md: 16 },
            lineHeight: 1.75,
            color: T.textMuted,
            mb: { xs: 3.5, md: 4.5 },
          }}
        >
          {content.lead}
        </Typography>
      )}

      {content.sections.map((section) => (
        <Box key={section.heading} sx={{ mb: { xs: 4, md: 5 }, '&:last-of-type': { mb: 0 } }}>
          {/* h2 throughout: the page's own hero owns the single h1, and a second one
              here would leave the document with two competing top-level headings. */}
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 13, md: 13.5 },
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: T.textFaint,
              mb: { xs: 1.75, md: 2.25 },
            }}
          >
            {section.heading}
          </Typography>

          {section.paragraphs?.map((paragraph) => (
            <Typography
              key={paragraph.slice(0, 48)}
              sx={{
                ...measure,
                fontSize: { xs: 14.5, md: 15.5 },
                lineHeight: 1.8,
                color: T.textMuted,
                mb: 2,
                '&:last-child': { mb: 0 },
              }}
            >
              {paragraph}
            </Typography>
          ))}

          {section.list && (
            // A real <dl> — these are term/definition pairs and the markup should say
            // so. The grid lives on the dl, so turning a wall of rows into cards costs
            // nothing semantically.
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gap: { xs: 1.25, md: 1.5 },
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(280px, 1fr))' },
              }}
            >
              {section.list.map((item) => (
                <Box
                  key={item.term}
                  sx={{
                    p: { xs: 1.75, md: 2 },
                    borderRadius: 2.5,
                    bgcolor: T.glassHover,
                    border: `1px solid ${T.border}`,
                    transition: 'border-color .18s ease',
                    '&:hover': { borderColor: T.borderHover },
                    minWidth: 0,
                  }}
                >
                  <Typography
                    component="dt"
                    sx={{ fontSize: 13.5, fontWeight: 800, color: T.teal, mb: 0.6 }}
                  >
                    {item.term}
                  </Typography>
                  <Typography
                    component="dd"
                    sx={{ m: 0, fontSize: 13.5, lineHeight: 1.65, color: T.textMuted }}
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
