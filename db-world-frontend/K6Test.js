/* global __ENV */ // injected by the k6 runtime, not a browser/node global
import http from 'k6/http';
import { check, sleep } from 'k6';

// Credentials and tokens come from the environment — never commit them. This repo
// is public, and a token/password committed here is leaked the moment it is pushed.
//
//   k6 run \
//     -e BASE_URL=https://db-world.in \
//     -e AUTH_TOKEN=<jwt> \
//     -e LOGIN_EMAIL=<email> -e LOGIN_PASSWORD=<password> \
//     -e STREAM_UUID=<uuid> -e STREAM_TOKEN=<jwt> \
//     K6Test.js
const BASE_URL       = __ENV.BASE_URL || 'https://db-world.in';
const AUTH_TOKEN     = __ENV.AUTH_TOKEN     || '';
const LOGIN_EMAIL    = __ENV.LOGIN_EMAIL    || '';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || '';
const STREAM_UUID    = __ENV.STREAM_UUID    || '';
const STREAM_TOKEN   = __ENV.STREAM_TOKEN   || '';

export const options = {
  vus: 10, // Number of Virtual Users
  duration: '30s', // Total test duration
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be <500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be < 1%
  },
};

export default function () {
  // 🌐 Request 1 - Homepage
  const res1 = http.get(`${BASE_URL}/`);
  check(res1, {
    'GET / => status 200': (r) => r.status === 200,
    'GET / => response time < 500ms': (r) => r.timings.duration < 500,
  });

  // 🎥 Request 2 - Movie Records API (needs AUTH_TOKEN)
  if (AUTH_TOKEN) {
    const res2 = http.get(`${BASE_URL}/api/cinema/record/type/movie?&page=0&size=12`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    check(res2, {
      'GET /api/cinema/record => status 200': (r) => r.status === 200,
      'GET /api/cinema/record => response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  }

  // 🔐 Request 3 - Auth Login (needs LOGIN_EMAIL / LOGIN_PASSWORD)
  if (LOGIN_EMAIL && LOGIN_PASSWORD) {
    const payload = JSON.stringify({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const res3 = http.post(`${BASE_URL}/api/auth/login`, payload, params);
    check(res3, {
      'POST /api/auth/login => status 200': (r) => r.status === 200,
      'POST /api/auth/login => response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  }

  // 📦 Request 4 - Signed stream download (needs STREAM_UUID / STREAM_TOKEN)
  if (STREAM_UUID && STREAM_TOKEN) {
    const res4 = http.get(
      `${BASE_URL}/api/stream/download/uuid/${STREAM_UUID}?t=${STREAM_TOKEN}`,
    );
    check(res4, {
      'status is 200': (r) => r.status === 200 || r.status === 206 || r.status === 203,
      'is video or stream': (r) =>
        r.headers['Content-Type'] &&
        (r.headers['Content-Type'].includes('video') || r.headers['Content-Type'].includes('application/octet-stream')),
      'response size > 1MB': (r) => r.body.length > 1 * 1024 * 1024,
    });
  }

  sleep(1); // Pause for 1 second before next iteration
}
