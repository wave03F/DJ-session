const http = require('http');
const fs = require('fs');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    if (data) h['Content-Length'] = Buffer.byteLength(data);
    const opts = { hostname: 'localhost', port: 3000, path, method, headers: h };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d), h: res.headers }); }
        catch { resolve({ s: res.statusCode, b: d, h: res.headers }); }
      });
    });
    r.on('error', e => reject(e));
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  const results = [];
  const log = (tag, data) => results.push(tag + ' ' + JSON.stringify(data).substring(0, 220));

  // 1. Basic health
  const health = await req('GET', '/api/health');
  log('1.HEALTH', health.b);

  // 2. Detailed health (Phase 7)
  const healthDetail = await req('GET', '/api/health/detailed');
  log('2.HEALTH_DETAIL', { s: healthDetail.s, status: healthDetail.b.status, services: healthDetail.b.services, uptime: healthDetail.b.uptime_seconds });

  // 3. Login
  const l1 = await req('POST', '/api/auth/login', { email: 'test@example.com', password: '12345678' });
  log('3.LOGIN', { s: l1.s, id: l1.b.user?.id });
  if (!l1.b.accessToken) { log('ABORT', 'no token'); fs.writeFileSync('test-results.txt', results.join('\n')); return; }
  const t1 = l1.b.accessToken;

  // 4. Rate limit headers present
  const rHeaders = await req('GET', '/api/profiles/me', null, t1);
  log('4.RATE_LIMIT_HEADERS', {
    limit: rHeaders.h['x-ratelimit-limit'],
    remaining: rHeaders.h['x-ratelimit-remaining']
  });

  // 5. Security headers present (helmet)
  log('5.SECURITY_HEADERS', {
    xContentType: rHeaders.h['x-content-type-options'],
    xFrame: rHeaders.h['x-frame-options'],
    csp: !!rHeaders.h['content-security-policy'] || 'csp-off(dev)'
  });

  // === PHASE 6: PAYMENT TESTS (sandbox mode) ===

  // 6. Subscribe to Premium (sandbox)
  const sub = await req('POST', '/api/payments/subscribe', { plan: 'monthly', isSandbox: true }, t1);
  log('6.SUBSCRIBE', { s: sub.s, plan: sub.b.plan, amount: sub.b.amount, currency: sub.b.currency, activated: sub.b.activated });

  // 7. Payment history
  const hist = await req('GET', '/api/payments/history', null, t1);
  log('7.PAY_HISTORY', { s: hist.s, payments: hist.b.payments?.length, hasSub: !!hist.b.subscription });

  // 8. Try to subscribe again (should fail 409)
  const subDup = await req('POST', '/api/payments/subscribe', { plan: 'monthly', isSandbox: true }, t1);
  log('8.SUB_DUPLICATE', { s: subDup.s, error: subDup.b.error });

  // 9. Purchase a premium item (sandbox)
  const shopItems = await req('GET', '/api/avatars/shop?freeOnly=false');
  const premiumItem = shopItems.b.items?.find(i => i.price > 0);
  if (premiumItem) {
    const purchase = await req('POST', '/api/payments/purchase', { itemId: premiumItem.id, isSandbox: true }, t1);
    log('9.PURCHASE_ITEM', { s: purchase.s, item: purchase.b.item?.name, purchased: purchase.b.purchased });

    // 10. Buy duplicate (should fail 409)
    const dupPurchase = await req('POST', '/api/payments/purchase', { itemId: premiumItem.id, isSandbox: true }, t1);
    log('10.PURCHASE_DUP', { s: dupPurchase.s, error: dupPurchase.b.error });
  }

  // 11. Cancel subscription
  const cancel = await req('DELETE', '/api/payments/subscribe', null, t1);
  log('11.CANCEL_SUB', { s: cancel.s, cancelled: cancel.b.cancelled });

  // === PHASE 7: PDPA & ACCOUNT TESTS ===

  // 12. Export personal data
  const exportData = await req('GET', '/api/account/export', null, t1);
  log('12.DATA_EXPORT', { s: exportData.s, hasUser: !!exportData.b.user, hasProfile: !!exportData.b.profile, payments: exportData.b.payments?.length });

  // 13. Get notifications
  const notifs = await req('GET', '/api/account/notifications', null, t1);
  log('13.NOTIFICATIONS', { s: notifs.s, count: notifs.b.notifications?.length });

  // 14. Mark notifications as read
  const readNotifs = await req('PUT', '/api/account/notifications/read', null, t1);
  log('14.NOTIFS_READ', { s: readNotifs.s, updated: readNotifs.b.updated });

  // 15. Rate limiting test — 11 rapid profile view requests
  let rateLimitHit = false;
  for (let i = 0; i < 11; i++) {
    const r = await req('GET', '/api/profiles/me', null, t1);
    if (r.s === 429) { rateLimitHit = true; break; }
  }
  log('15.RATE_LIMIT_TRIGGER', { rateLimitHit });

  // 16. Auth rate limiting (multiple failed logins)
  let authRateHit = false;
  for (let i = 0; i < 11; i++) {
    const r = await req('POST', '/api/auth/login', { email: 'wrong@test.com', password: 'wrongpassword' });
    if (r.s === 429) { authRateHit = true; break; }
  }
  log('16.AUTH_RATE_LIMIT', { authRateHit });

  log('DONE', 'Phase 6+7 tests completed!');
  fs.writeFileSync('test-results.txt', results.join('\n'));
  console.log('Results written to test-results.txt');
}

run().catch(e => { console.log('FATAL:', e.message); fs.writeFileSync('test-results.txt', 'FATAL: ' + e.message); });
