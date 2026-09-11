import React from 'react';
import Constants from '@shared/constants';
import LegalPage from './LegalPage';
import { CONTACT_EMAIL } from './PrivacyPolicy';

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="26 August 2026">
      <p>
        These terms govern your use of DB World (<strong>db-world.in</strong>) and the DB
        World Android app.
      </p>
      <p>
        Browsing DB World signifies acceptance of these terms. Creating an account
        requires it explicitly: the registration form will not submit until you tick the
        box confirming you have read and accepted this page and the{' '}
        <a href={Constants.DB_PRIVACY_ROUTE}>Privacy Policy</a>. If you do not accept
        them, please do not use the service.
      </p>

      <h2>The service</h2>
      <p>DB World is a personal media and utility platform. Some parts — browsing the
        catalogue and the IPO tracker, the games and the weather forecast — are open to
        everyone. Others, including playback, downloads, requests, the password manager
        and the document wallet, require an account.</p>

      <h2>Your account</h2>
      <p>Accounts are free. You must be old enough to form a binding contract where you
        live, and at least 13 in any case.</p>
      <ul>
        <li>You are responsible for keeping your password secure and for everything done
          under your account.</li>
        <li>Provide accurate information when registering.</li>
        <li>One person per account. Do not share credentials.</li>
        <li>Tell us promptly if you believe your account has been compromised.</li>
      </ul>
      <p>We may suspend or terminate an account that breaches these terms.</p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service unlawfully, or to infringe anyone&rsquo;s rights.</li>
        <li>Attempt to gain unauthorised access to any part of the system or to other
          users&rsquo; data.</li>
        <li>Probe, scan, overload or disrupt the service or its infrastructure.</li>
        <li>Scrape or redistribute content in bulk, or resell access.</li>
        <li>Interfere with advertising, or generate artificial ad impressions or clicks.</li>
      </ul>

      <h2>Content and intellectual property</h2>
      <p>Film and television metadata and artwork are supplied by{' '}
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">The
        Movie Database (TMDB)</a> and remain the property of their respective owners. DB
        World is not endorsed or certified by TMDB.</p>
      <p>Media accessible through an account is intended for personal use by the account
        holder. You are responsible for ensuring your use complies with the law in your
        jurisdiction. If you hold rights in material you believe is available here
        improperly, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
        enough detail to identify it and we will act on it.</p>

      <h2>Your own content</h2>
      <p>Anything you store — password entries, wallet documents, reviews, requests —
        remains yours. You grant us only the permission needed to store and display it
        back to you as part of running the service.</p>

      <h2>Advertising</h2>
      <p>The service is supported in part by advertising, including Google AdSense. Ads
        are supplied by third parties and their presence is not an endorsement. Your
        dealings with an advertiser are between you and them.</p>

      <h2>Availability</h2>
      <p>DB World is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. It is self-hosted
        and offered without a service-level commitment: it may be unavailable for
        maintenance, and features may change or be withdrawn. We do not warrant that it
        will be uninterrupted or error-free.</p>

      <h2>Limitation of liability</h2>
      <p>To the extent permitted by law, DB World is not liable for indirect, incidental
        or consequential loss, nor for loss of data or profit arising from your use of the
        service. Keep your own backups of anything you cannot afford to lose.</p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms. The date above reflects the current version, and
        continuing to use the service after a change means you accept it.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or the{' '}
        <a href={Constants.DB_CONTACT_ROUTE}>contact page</a>. See also our{' '}
        <a href={Constants.DB_PRIVACY_ROUTE}>Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
