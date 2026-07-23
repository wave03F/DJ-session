# Implementation Tasks: Pixel Music World — Phase 1 Foundation

## Phase 1: Foundation (สัปดาห์ 1-4)

เป้าหมาย: วางรากฐานระบบ Auth, Database, Basic Profile, Socket.io Auth

---

### Task 1: Project Restructure & Dependencies

- [ ] 1. Restructure project folders:
  ```
  /src
    /config        — db, redis, cloudinary config
    /middleware    — auth, validation, error handling
    /services     — auth, profile, room, music (modular)
    /routes       — REST API routes
    /models       — Knex query builders
    /socket       — Socket.io event handlers
    /utils        — helpers, constants
  /migrations     — Knex migration files
  /seeds          — Seed data
  /public         — Static frontend (existing)
  ```
- [ ] 2. Install core dependencies:
  - `knex` + `pg` (PostgreSQL)
  - `jsonwebtoken` + `bcryptjs`
  - `passport` + `passport-local` + `passport-line`
  - `express-validator` or `joi`
  - `multer` + `cloudinary`
  - `dotenv`
  - `cors` + `helmet`
  - `ioredis` (Redis client)
- [ ] 3. Create `.env.example` with required environment variables
- [ ] 4. Set up `knexfile.js` for migration configuration
- [ ] 5. Add npm scripts: `migrate`, `migrate:rollback`, `seed`, `dev`
- [ ] 6. Update `package.json` with new scripts and dependencies

**Requirements covered:** Foundation for all requirements

---

### Task 2: Database Schema — Core Tables (users, profiles, sessions)

- [ ] 1. Create migration: `001_create_users_table.js`
  - id (UUID, PK), email (unique), password_hash, nickname, date_of_birth, age_verified, oauth_provider, oauth_id, is_premium, is_suspended, created_at, updated_at, last_login_at
- [ ] 2. Create migration: `002_create_profiles_table.js`
  - id (UUID, PK), user_id (FK → users), display_name, bio, gender, relationship_status, discovery_age_min, discovery_age_max, discovery_gender, discovery_genre_threshold, is_active, updated_at
- [ ] 3. Create migration: `003_create_profile_photos_table.js`
  - id (UUID, PK), profile_id (FK → profiles), url, position (1-6), is_verified, created_at
- [ ] 4. Create migration: `004_create_sessions_table.js`
  - id (UUID, PK), user_id (FK → users), token_hash, device_info, is_active, expires_at, created_at
- [ ] 5. Create migration: `005_create_user_genres_table.js`
  - id (UUID, PK), user_id (FK → users), genre (VARCHAR)
- [ ] 6. Run migrations and verify schema

**Requirements covered:** Req 1 (Auth), Req 2 (Profile), Req 15 (Data Security)

---

### Task 3: Auth Service — Registration & Login

- [ ] 1. Create `src/services/authService.js`:
  - `register(email, password, nickname, dateOfBirth)` — validate age ≥ 18, hash password (bcrypt cost 12), create user + empty profile
  - `login(email, password)` — verify credentials, generate JWT access token (15min) + refresh token (7 days)
  - `refreshToken(refreshToken)` — validate and issue new access token
  - `logout(userId)` — invalidate session
  - `forgotPassword(email)` — generate reset token (1hr expiry)
  - `resetPassword(token, newPassword)` — validate token, update password
- [ ] 2. Create `src/routes/auth.js` with endpoints:
  - POST `/api/auth/register`
  - POST `/api/auth/login`
  - POST `/api/auth/logout`
  - POST `/api/auth/refresh`
  - POST `/api/auth/forgot-password`
  - POST `/api/auth/reset-password`
- [ ] 3. Create `src/middleware/auth.js`:
  - `requireAuth` — verify JWT from Authorization header
  - `optionalAuth` — attach user if token present, continue if not
- [ ] 4. Implement single active session policy:
  - On login, deactivate all previous sessions for the user
  - Store session in DB with token_hash
- [ ] 5. Create `src/middleware/validate.js` for request validation
- [ ] 6. Age verification: reject registration if calculated age < 18

**Requirements covered:** Req 1 (AC 1-11), Req 15 (AC 1, 7)

---

### Task 4: Line OAuth Integration

- [ ] 1. Install `passport-line-auth` or use Line Login API directly
- [ ] 2. Create `src/services/lineAuthService.js`:
  - Handle Line OAuth callback
  - Create or link account based on Line user ID
  - Extract profile info (name, picture) from Line
- [ ] 3. Add routes:
  - GET `/api/auth/line` — redirect to Line authorization
  - GET `/api/auth/line/callback` — handle callback, create/link account, return JWT
- [ ] 4. Create `.env` entries for LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_CALLBACK_URL
- [ ] 5. Handle edge case: Line account already linked to another user

**Requirements covered:** Req 1 (AC 6)

---

### Task 5: Basic Profile Service

- [ ] 1. Create `src/services/profileService.js`:
  - `getProfile(userId)` — return profile with photos and genres
  - `updateProfile(userId, data)` — update display_name, bio, age fields
  - `updateGenres(userId, genres[])` — set music genre preferences
  - `updateDiscoveryPreferences(userId, prefs)` — age range, gender pref, genre threshold
- [ ] 2. Create `src/routes/profiles.js` with endpoints:
  - GET `/api/profiles/me` — get own profile
  - PUT `/api/profiles/me` — update profile fields
  - PUT `/api/profiles/me/genres` — update music genres
  - PUT `/api/profiles/me/preferences` — update discovery preferences
- [ ] 3. Implement photo upload:
  - POST `/api/profiles/me/photos` — upload via Cloudinary (max 6 photos, JPEG/PNG, ≤5MB, min 200x200)
  - DELETE `/api/profiles/me/photos/:id` — remove photo
- [ ] 4. Create `src/config/cloudinary.js` — Cloudinary SDK configuration
- [ ] 5. Validation rules:
  - display_name: required, max 100 chars
  - bio: max 500 chars
  - photos: 1-6, JPEG/PNG only, max 5MB each
  - genres: from predefined list
- [ ] 6. Profile completeness check: require display_name + 1 photo + bio before marking active

**Requirements covered:** Req 2 (AC 1-7)

---

### Task 6: Socket.io Authentication Refactor

- [ ] 1. Create `src/socket/authMiddleware.js`:
  - Extract JWT from Socket.io handshake auth or query
  - Verify token validity
  - Attach user data to socket instance
  - Reject unauthorized connections
- [ ] 2. Refactor `src/socket/index.js` (from existing server.js):
  - Apply auth middleware to all connections
  - On connect: load user profile, attach to socket
  - On disconnect: clean up player state
- [ ] 3. Update existing game events to use authenticated user:
  - `join` → use socket.user instead of anonymous data
  - `move` → validate against authenticated player
  - `chat-message` → use authenticated nickname
- [ ] 4. Create `src/socket/roomHandler.js` — room join/leave logic
- [ ] 5. Create `src/socket/chatHandler.js` — chat event handlers
- [ ] 6. Create `src/socket/musicHandler.js` — music queue handlers (keep existing logic)
- [ ] 7. Update client `public/app.js`:
  - Send JWT token on socket connection
  - Handle auth failure (redirect to login)

**Requirements covered:** Req 1 (session management), Req 3 (room system foundation)

---

### Task 7: Configuration & Environment Setup

- [ ] 1. Create `src/config/database.js` — Knex instance with connection pooling
- [ ] 2. Create `src/config/redis.js` — ioredis client (for sessions, future use)
- [ ] 3. Create `src/config/jwt.js` — JWT secret, expiry constants
- [ ] 4. Create `src/middleware/errorHandler.js` — global error handling
- [ ] 5. Create `src/middleware/rateLimiter.js` — basic rate limiting (using Redis)
- [ ] 6. Add `helmet()` and `cors()` to Express app
- [ ] 7. Create `docker-compose.yml` for local PostgreSQL + Redis

**Requirements covered:** Req 14 (performance foundation), Req 15 (security headers)

---

### Task 8: Integration & Smoke Testing

- [ ] 1. Test: Register with valid data → returns JWT + creates user in DB
- [ ] 2. Test: Register under 18 → rejected with appropriate message
- [ ] 3. Test: Login → returns valid JWT, old sessions invalidated
- [ ] 4. Test: Access protected route without token → 401
- [ ] 5. Test: Update profile → persists to DB
- [ ] 6. Test: Upload photo → stored in Cloudinary, URL saved in DB
- [ ] 7. Test: Socket.io connect with valid token → success
- [ ] 8. Test: Socket.io connect without token → rejected
- [ ] 9. Test: Existing game features (movement, chat, music) still work with auth
- [ ] 10. Create seed data: test user, sample profile, sample photos

**Requirements covered:** Verification of Phase 1 deliverables

---

## Summary

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Task 1: Project Restructure | 1 day | P0 |
| Task 2: Database Schema | 1 day | P0 |
| Task 3: Auth Service | 3 days | P0 |
| Task 4: Line OAuth | 2 days | P1 |
| Task 5: Profile Service | 2 days | P0 |
| Task 6: Socket.io Auth | 2 days | P0 |
| Task 7: Config & Environment | 1 day | P0 |
| Task 8: Integration Testing | 1 day | P0 |
| **Total** | **~13 days (2.5 weeks)** | |

Phase 1 deliverables เมื่อเสร็จ:
- ✅ ระบบ Login/Register (Email + Line OAuth)
- ✅ Age verification gate (18+)
- ✅ PostgreSQL database with proper schema
- ✅ Basic profile management + photo upload
- ✅ Socket.io requires authentication
- ✅ Existing game features preserved (backward-compatible)
