import http from 'k6/http';
import { check, sleep } from 'k6';

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
  const res1 = http.get('https://db-world.in/');
  check(res1, {
    'GET / => status 200': (r) => r.status === 200,
    'GET / => response time < 500ms': (r) => r.timings.duration < 500,
  });

  // 🎥 Request 2 - Movie Records API
  const res2 = http.get('https://db-world.in/api/cinema/record/type/movie?&page=0&size=12', {
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJzYW04QGdtYWlsLmNvbSIsImlhdCI6MTc0NTM3OTEzMywiZXhwIjoxNzQ1NDE1MTMzfQ.DsKFzigsbW-HQxwl-HOR1kyvrH0Rg9H4GwtFb6BdtaUG3wgAkZIBEM2tUzs3n2nJVpJeGjwYGrLVvG42Ga0RQg',
    },
  });
  check(res2, {
    'GET /api/cinema/record => status 200': (r) => r.status === 200,
    'GET /api/cinema/record => response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  // 🔐 Request 3 - Auth Login
  const payload = JSON.stringify({
    email: 'sam8@gmail.com',
    password: '1234',
  });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const res3 = http.post('https://db-world.in/api/auth/login', payload, params);
  check(res3, {
    'POST /api/auth/login => status 200': (r) => r.status === 200,
    'POST /api/auth/login => response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  const res4 = http.get('https://db-world.in/api/stream/download/uuid/68969606-9ad7-45cf-bf9e-6587d4985515?t=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJzYW04QGdtYWlsLmNvbSIsImlhdCI6MTc0NTM3OTEzMywiZXhwIjoxNzQ1NDE1MTMzfQ.DsKFzigsbW-HQxwl-HOR1kyvrH0Rg9H4GwtFb6BdtaUG3wgAkZIBEM2tUzs3n2nJVpJeGjwYGrLVvG42Ga0RQg');
  check(res4, {
    'status is 200': (r) => r.status === 200 || r.status === 206 || r.status === 203,
    'is video or stream': (r) =>
      r.headers['Content-Type'] &&
      (r.headers['Content-Type'].includes('video') || r.headers['Content-Type'].includes('application/octet-stream')),
    'response size > 1MB': (r) => r.body.length > 1 * 1024 * 1024,
  });

  sleep(1); // Pause for 1 second before next iteration
}
