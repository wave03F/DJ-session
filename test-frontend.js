/**
 * Test full frontend flow:
 * 1. HTML loads correctly (all scripts, auth form present)
 * 2. Register via API → get token
 * 3. Login via API → get token
 * 4. Socket connects with token (authenticated mode)
 * 5. Socket connects without token (guest mode)
 * 6. Match list API works
 * 7. Avatar API works
 * 8. Chat conversations API works
 */
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

function getText(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function run() {
  const results = [];
  const log = (tag, data) => results.push(tag + ' ' + JSON.stringify(data).substring(0, 250));

  // 1. Check HTML page loads
  const html = await getText('/');
  const htmlOk = html.s === 200 &&
    html.body.includes('auth-modal') &&
    html.body.includes('tab-login') &&
    html.body.includes('tab-register') &&
    html.body.includes('tab-guest') &&
    html.body.includes('panel-matches') &&
    html.body.includes('panel-chat') &&
    html.body.includes('panel-avatar') &&
    html.body.includes('profile-card.js') &&
    html.body.includes('ui.js') &&
    html.body.includes('animation.js') &&
    html.body.includes('avatar-renderer.js') &&
    html.body.includes('shop-modal');
  log('1.HTML_LOADS', { status: html.s, authModal: htmlOk });

  // 2. Check JS files load
  const uiJs = await getText('/ui.js');
  const animJs = await getText('/animation.js');
  const avatarJs = await getText('/avatar-renderer.js');
  const profileJs = await getText('/profile-card.js');
  log('2.JS_FILES', {
    'ui.js': uiJs.s === 200 && uiJs.body.includes('UI'),
    'animation.js': animJs.s === 200 && animJs.body.includes('AnimationEngine'),
    'avatar-renderer.js': avatarJs.s === 200 && avatarJs.body.includes('AvatarRenderer'),
    'profile-card.js': profileJs.s === 200 && profileJs.body.includes('ProfileCard')
  });

  // 3. CSS loads with new styles
  const css = await getText('/styles.css');
  const cssOk = css.s === 200 &&
    css.body.includes('.auth-tabs') &&
    css.body.includes('.panel-tabs') &&
    css.body.includes('.match-item') &&
    css.body.includes('.dm-msg') &&
    css.body.includes('.avatar-editor') &&
    css.body.includes('.shop-items') &&
    css.body.includes('.profile-card-overlay');
  log('3.CSS_STYLES', { status: css.s, allNewStyles: cssOk });

  // 4. Register new user for frontend test
  const reg = await req('POST', '/api/auth/register', {
    email: 'frontend-test@pmw.com',
    password: 'testpass123',
    nickname: 'FrontEndUser',
    dateOfBirth: '1996-04-15'
  });
  log('4.REGISTER', { s: reg.s, user: reg.b.user?.nickname || reg.b.error });

  // 5. Login
  const login = await req('POST', '/api/auth/login', { email: 'test@example.com', password: '12345678' });
  log('5.LOGIN', { s: login.s, hasToken: !!login.b.accessToken });
  const token = login.b.accessToken;

  if (!token) {
    log('ABORT', 'No token');
    fs.writeFileSync('test-results.txt', results.join('\n'));
    return;
  }

  // 6. Profile API (used by avatar panel)
  const profile = await req('GET', '/api/profiles/me', null, token);
  log('6.PROFILE', { s: profile.s, name: profile.b.display_name, gender: profile.b.gender });

  // 7. Avatar API (used by avatar editor)
  const avatar = await req('GET', '/api/avatars/me', null, token);
  log('7.AVATAR', { s: avatar.s, bodyType: avatar.b.body_type, hairColor: avatar.b.hair_color, equippedCount: avatar.b.equipped?.length });

  // 8. Matches API (used by matches panel)
  const matches = await req('GET', '/api/matches', null, token);
  log('8.MATCHES', { s: matches.s, count: matches.b.matches?.length });

  // 9. Conversations API (used by chat panel)
  const convos = await req('GET', '/api/chat/conversations', null, token);
  log('9.CONVERSATIONS', { s: convos.s, count: convos.b.conversations?.length });

  // 10. Likes remaining (used by matches panel header)
  const likes = await req('GET', '/api/matches/likes-remaining', null, token);
  log('10.LIKES_REMAINING', { s: likes.s, remaining: likes.b.remaining, limit: likes.b.limit });

  // 11. Shop API (used by shop modal)
  const shop = await req('GET', '/api/avatars/shop?category=hair');
  log('11.SHOP', { s: shop.s, itemCount: shop.b.items?.length });

  // 12. Inventory (used by avatar editor equip)
  const inv = await req('GET', '/api/avatars/inventory', null, token);
  log('12.INVENTORY', { s: inv.s, ownedItems: inv.b.items?.length });

  // 13. Notifications (account panel)
  const notifs = await req('GET', '/api/account/notifications', null, token);
  log('13.NOTIFICATIONS', { s: notifs.s, count: notifs.b.notifications?.length });

  // 14. Dating relationship status
  const rel = await req('GET', '/api/dating/relationship', null, token);
  log('14.RELATIONSHIP', { s: rel.s, status: rel.b.status });

  // 15. Swagger docs
  const docs = await getText('/api/docs.json');
  log('15.SWAGGER', { s: docs.s, isJson: docs.body.startsWith('{') });

  // SUMMARY
  const allPassed = [htmlOk, cssOk, login.s === 200, profile.s === 200,
    avatar.s === 200, matches.s === 200, convos.s === 200,
    likes.s === 200, shop.s === 200, inv.s === 200, notifs.s === 200, rel.s === 200];
  const passCount = allPassed.filter(Boolean).length;
  log('SUMMARY', { passed: passCount + '/' + allPassed.length, allPassed: passCount === allPassed.length });

  log('DONE', 'Frontend integration test complete!');
  fs.writeFileSync('test-results.txt', results.join('\n'));
  console.log('Results written to test-results.txt');
}

run().catch(e => {
  console.log('FATAL:', e.message);
  fs.writeFileSync('test-results.txt', 'FATAL: ' + e.message);
});
