import React from 'react';
import Constants from '@shared/constants';
import LegalPage from './LegalPage';

/** Contact address shown on the legal pages. Change here and it changes everywhere. */
export const CONTACT_EMAIL = 'support@db-world.in';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="26 August 2026">
      <p>
        This policy explains what DB World (<strong>db-world.in</strong>) collects, why,
        and what you can do about it. It covers the website and the DB World Android app.
      </p>

      <h2>What we collect</h2>
      <p><strong>If you browse without an account</strong>, we collect only what is needed to serve
        and protect the site: your IP address, browser and device type, the pages you
        request, and the time of the request. This sits in standard server logs.</p>
      <p><strong>If you create an account</strong>, we additionally store your email address, a
        one-way hash of your password (never the password itself), and the activity tied
        to your account — what you have watched, your watchlist, your requests and your
        sign-in history.</p>
      <p><strong>Optional features you choose to use</strong> store more:</p>
      <ul>
        <li><strong>Password manager</strong> — entries are encrypted before storage.</li>
        <li><strong>Document wallet</strong> — documents are encrypted at rest with AES-GCM.</li>
        <li><strong>IPO tracker</strong> — the applications you record against an IPO.</li>
        <li><strong>Weather</strong> — your location, only if you grant permission, and only
          to fetch a forecast. It is not stored on our servers.</li>
        <li><strong>Notifications</strong> — a device token, if you enable push.</li>
      </ul>

      <h2>Cookies and similar technologies</h2>
      <p>We use a strictly necessary cookie to keep you signed in. It cannot be turned off
        without breaking sign-in.</p>
      <p>We also use <strong>Google AdSense</strong> to display advertising. Google and its
        partners may set cookies or read device identifiers to serve and measure ads,
        including personalised ads based on your prior browsing. You can opt out of
        personalised advertising at{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
          Google Ads Settings</a>, and review how Google handles this data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
          policies.google.com/technologies/partner-sites</a>.</p>
      <p>If you are in the EEA, the UK or Switzerland, you will be asked for consent before
        any advertising cookie is set, and you can change that choice at any time.</p>

      <h2>Third parties we send data to</h2>
      <ul>
        <li><strong>Google AdSense</strong> — advertising, as described above.</li>
        <li><strong>The Movie Database (TMDB)</strong> — film and TV metadata. Requests for
          artwork go to TMDB&rsquo;s servers, which means they see your IP address.</li>
        <li><strong>Firebase Cloud Messaging</strong> — push notification delivery, if enabled.</li>
      </ul>
      <p>We do not sell your personal information, and we do not share it with anyone
        beyond what is listed here.</p>

      <h2>How long we keep it</h2>
      <p>Server logs are retained for a limited operational period. Account data is kept
        while your account exists. Delete your account and the associated data is removed,
        except where we are required to retain something by law.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Access, correct or delete your account data from your profile page.</li>
        <li>Withdraw advertising consent at any time via the consent controls.</li>
        <li>Revoke location or notification permission in your browser or device settings.</li>
        <li>Request a copy of your data, or its deletion, by writing to us.</li>
      </ul>

      <h2>Children</h2>
      <p>DB World is not directed at children under 13, and we do not knowingly collect
        their personal information. If you believe a child has given us data, contact us
        and we will remove it.</p>

      <h2>Security</h2>
      <p>Traffic is served over HTTPS. Passwords are hashed, and password-manager and
        wallet contents are encrypted at rest. No system is perfectly secure, so please
        use a strong, unique password.</p>

      <h2>Changes</h2>
      <p>If this policy changes materially we will update the date above and, where the
        change is significant, notify you in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
        or via the <a href={Constants.DB_CONTACT_ROUTE}>contact page</a>.
      </p>
    </LegalPage>
  );
}
