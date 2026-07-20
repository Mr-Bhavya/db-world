import React from 'react';

/*
 * Unified app loader — Netflix-intro-style reveal.
 *
 * Kept byte-for-byte identical (class names + CSS) to the pre-React boot loader in
 * /index.html so the boot → React handoff is seamless.
 *
 * The "DB" brand mark appears large and centred, holds a beat, then shrinks to its
 * normal size while "WORLD" writes on after it (each letter inked left-to-right via a
 * max-width wipe, staggered). Because the wordmark is centred, "DB" slides left as
 * "WORLD" grows in — mirroring the Netflix "N → NETFLIX" move. Letters are brand
 * teal; a white highlight then sweeps across on a loop, over a thin teal bar. No
 * cursor. The reveal is quick; the rest of the loader's fixed minimum time is spent
 * looping the shimmer, so total loader time is unchanged.
 *
 *   variant="full"  — full-screen wordmark loader; optional `message` status line.
 *   variant="bar"   — slim teal top bar (Suspense fallback + auth check).
 */
const MARK = 'DB';
const REST = 'WORLD';

const CSS = `
html,body{margin:0;background:#000}
#app-loader,.dbl-root{position:fixed;inset:0;z-index:1300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(18px,5vw,26px);background:#000;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#app-loader{transition:opacity .45s ease}
.dbl-hide{opacity:0!important;pointer-events:none}
.dbl-word{display:flex;align-items:flex-end;justify-content:center;font:800 clamp(24px,8vw,42px)/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-shadow:0 0 8px rgba(20,184,166,.32);will-change:transform}
.dbl-word .mark{flex:none;color:#14b8a6;margin-right:.28em;transform-origin:center center;transform:scale(2);will-change:transform;animation:dbl-mark 1.1s cubic-bezier(.22,1,.36,1) both,dbl-shine 2.2s ease-in-out 1.9s infinite}
.dbl-word .l{flex:none;overflow:hidden;max-width:0;color:#14b8a6;padding-right:.06em;animation:dbl-type .34s cubic-bezier(.4,0,.2,1) calc(1s + var(--i) * .13s) both,dbl-shine 2.2s ease-in-out calc(1.95s + var(--i) * .07s) infinite}
.dbl-msg{color:rgba(255,255,255,.6);font:600 clamp(11px,3.2vw,13px)/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.24em;text-transform:uppercase;text-align:center;max-width:80vw;animation:dbl-fade .6s ease 2s both}
.dbl-load{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(20,184,166,.12);overflow:hidden}
.dbl-load>span{position:absolute;top:0;height:100%;width:38%;left:-38%;background:linear-gradient(90deg,transparent,#14b8a6,#2dd4bf,transparent);animation:dbl-slide 1.6s cubic-bezier(.4,0,.2,1) infinite}
.dbl-bar{position:fixed;top:0;left:0;right:0;height:3px;z-index:1400;background:rgba(20,184,166,.10);overflow:hidden}
.dbl-bar>span{position:absolute;top:0;height:100%;width:38%;left:-38%;background:linear-gradient(90deg,transparent,#14b8a6,#2dd4bf,transparent);animation:dbl-slide 1.5s cubic-bezier(.4,0,.2,1) infinite}
@keyframes dbl-mark{0%{transform:scale(2);opacity:0}18%{opacity:1}48%{transform:scale(2)}100%{transform:scale(1);opacity:1}}
@keyframes dbl-type{from{max-width:0}to{max-width:1.5em}}
@keyframes dbl-shine{0%{color:#14b8a6}12%{color:#f0fdfa}26%,100%{color:#14b8a6}}
@keyframes dbl-slide{to{left:120%}}
@keyframes dbl-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){
  .dbl-word .mark{animation:none!important;transform:none}
  .dbl-word .l{animation:none!important;max-width:none;color:#14b8a6}
  .dbl-load>span,.dbl-bar>span{animation:none!important;left:0;width:100%;opacity:.55}
  .dbl-msg{animation:none!important}
}
`;

export default function AppLoader({ variant = 'full', message }) {
  if (variant === 'bar') {
    return (
      <>
        <style>{CSS}</style>
        <div className="dbl-bar" role="status" aria-label={message || 'Loading'}>
          <span />
        </div>
      </>
    );
  }

  const restLetters = REST.split('').map((ch, i) => (
    <span key={i} className="l" style={{ '--i': i }}>{ch}</span>
  ));

  return (
    <>
      <style>{CSS}</style>
      <div className="dbl-root" role="status" aria-live="polite" aria-label={message || 'Loading DB World'}>
        <div className="dbl-word" aria-hidden="true">
          <span className="mark">{MARK}</span>
          {restLetters}
        </div>
        {message ? <div className="dbl-msg">{message}</div> : null}
        <div className="dbl-load"><span /></div>
      </div>
    </>
  );
}
