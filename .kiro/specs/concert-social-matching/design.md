# Design Document: Pixel Music World — Virtual Concert + Social Matching

## 1. System Architecture Overview

### สถาปัตยกรรมระดับสูง (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Canvas 2D    │  │  Socket.io   │  │  REST API Client         │ │
│  │  (Renderer)   │  │  (Real-time) │  │  (Auth, Profile, etc.)   │ │
│  └───────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   Load Balancer     │
                    │   (Nginx/Railway)   │
                    └─────────┬──────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Express.js API Server + Socket.io Server                     │  │
│  │  (Authentication Middleware, Rate Limiting, Request Routing)   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │Auth_Service│ │Profile_Svc │ │Match_Engine│ │ Room_Service   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │Chat_Service│ │Music_Svc   │ │Dating_Svc  │ │ Payment_Svc    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────────────────┐  │
│  │Avatar_Svc  │ │Moderation  │ │ Animation_Engine (Client-side) │  │
│  └────────────┘ └────────────┘ └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  PostgreSQL   │  │    Redis     │  │  Cloudinary / S3         │ │
│  │  (Primary DB) │  │  (Cache/Pub) │  │  (Media Storage)         │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### หลักการออกแบบ (Design Principles)

1. **Modular Monolith** — เริ่มต้นด้วย Monolith ที่แยก Service เป็น Module ชัดเจน พร้อมแยกเป็น Microservices ในอนาคต
2. **Event-Driven** — ใช้ Redis Pub/Sub สำหรับ inter-service communication
3. **Progressive Enhancement** — ต่อยอดจาก Codebase เดิม (Express + Socket.io) โดยไม่ต้อง Rewrite ทั้งหมด
4. **Thai Market First** — ออกแบบให้รองรับ Line Login, PromptPay, ภาษาไทย เป็นลำดับแรก
5. **Budget-Conscious** — เลือก Managed Services ที่ราคาถูกหรือฟรี ในช่วง MVP

---

## 2. Phased Development Roadmap (แผนพัฒนาเป็นเฟส)

### Phase 1: Foundation (สัปดาห์ 1-4) — Auth, Database, Basic Profile

**เป้าหมาย:** วางรากฐานระบบ เปลี่ยนจาก In-Memory เป็น Persistent Storage และมีระบบ Auth ที่ปลอดภัย

**Requirements ที่ครอบคลุม:**
- Requirement 1: การลงทะเบียนและเข้าสู่ระบบ (AC 1-11)
- Requirement 2: การจัดการโปรไฟล์ (AC 1-7) — เฉพาะ Basic Fields
- Requirement 15: ความปลอดภัยของข้อมูล (AC 1-2, 5-7)

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 1 | Database Setup | ติดตั้ง PostgreSQL, ออกแบบ Schema เริ่มต้น, Migration tools (Knex.js) |
| 1 | Project Restructure | แยก Server code เป็น Module, เพิ่ม TypeScript (optional), ESLint |
| 2 | Auth System | Passport.js + JWT, Email/Password registration, Age verification (18+) |
| 2 | Line OAuth | Line LIFF SDK integration, Account linking |
| 3 | Basic Profile | CRUD Profile, Photo upload (Cloudinary), Validation |
| 3 | Session Management | JWT token refresh, Single active session policy |
| 4 | Socket.io Auth | Migrate Socket.io ให้รองรับ Authenticated sessions |
| 4 | Testing & QA | Unit tests, Integration tests, Security audit |

**Deliverables:**
- ระบบ Login/Register ที่ใช้งานได้จริง (Email + Line)
- Database Schema ที่รองรับ User, Profile, Session
- Socket.io ที่ต้อง Auth ก่อนเชื่อมต่อ
- Age verification gate

---

### Phase 2: Social Core (สัปดาห์ 5-8) — Matching, Profile Discovery, Chat

**เป้าหมาย:** สร้างระบบ Social หลัก — ดูโปรไฟล์ กดไลค์ แมตช์ และแชทหลังแมตช์

**Requirements ที่ครอบคลุม:**
- Requirement 4: ระบบ Matching (AC 1-10)
- Requirement 5: การดูโปรไฟล์ (AC 1-7)
- Requirement 7: ระบบแชทและข้อความ (AC 1-8)
- Requirement 9: ความปลอดภัย (AC 1-3, 5-6) — เฉพาะ Report/Block เบื้องต้น

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 5 | Like/Pass System | Like, Pass, Mutual Match detection, Daily limit (20/day) |
| 5 | Profile Discovery | Proximity-based (64px), Press E to view, Profile_Card UI |
| 6 | Match Engine | Match creation, Match list, Unmatch, 30-day cooldown |
| 6 | Interest Indicator | Glow outline สำหรับคนที่ share ≥3 genres |
| 7 | DM System | Real-time messaging via Socket.io, Message delivery status |
| 7 | Chat Features | Room-wide chat, Proximity chat (150px), Offline message storage |
| 8 | Notification System | In-app notifications, Match alerts, Message notifications |
| 8 | Block/Report Basic | Block user, Basic report system, Chat word filter |

**Deliverables:**
- ระบบ Like/Pass/Match ที่ทำงานได้ครบ
- Profile Card popup เมื่อเดินเข้าใกล้
- DM chat ระหว่างคนที่แมตช์กัน
- ระบบ Block/Report เบื้องต้น
- Notification system

---

### Phase 3: Concert Experience (สัปดาห์ 9-12) — Room System, Music, Animation

**เป้าหมาย:** ยกระดับประสบการณ์คอนเสิร์ต — ระบบห้อง, เพลง, และอนิเมชั่น

**Requirements ที่ครอบคลุม:**
- Requirement 3: ระบบห้องคอนเสิร์ต (AC 1-8)
- Requirement 8: ระบบเพลงและ DJ (AC 1-7)
- Requirement 11: อนิเมชั่น (AC 1-3, 9-12) — Movement + Music Reactive
- Requirement 6: ปฏิสัมพันธ์ในคอนเสิร์ต (AC 2, 5-6)

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 9 | Room System | Room creation (Premium/Admin), Max capacity (100), Queue system |
| 9 | Event Scheduling | Scheduled events, Event listing, Push notifications |
| 10 | Music Queue Overhaul | Vote skip (50%), Upvote reorder, Collaborative playlist |
| 10 | Playback Sync | Server-side timestamp correction, Late joiner sync |
| 11 | Character Animation | Walk cycle (4-frame), Idle breathing, Run animation |
| 11 | Sprite Sheet System | แยก Sprite เป็น Sheet, Direction-based rendering |
| 12 | Music Reactive Effects | Beat-sync bounce, Speaker pulse, Stage lighting shifts |
| 12 | Room Management | Auto-close empty rooms, Reconnection (60s grace), Room archiving |

**Deliverables:**
- ระบบห้องที่รองรับ Creation, Scheduling, Auto-management
- Music queue ที่มี Vote skip, Upvote
- Character animations (walk, idle, run) ด้วย Sprite Sheet
- Music reactive visual effects

---

### Phase 4: Avatar & Identity (สัปดาห์ 13-16) — Customization, Gender, Clothing

**เป้าหมาย:** ให้ผู้ใช้แสดงตัวตนผ่าน Avatar ที่ปรับแต่งได้

**Requirements ที่ครอบคลุม:**
- Requirement 12: ระบบ Avatar Customization (AC 1-12)
- Requirement 11: อนิเมชั่น (AC 4-8) — Social/Emote Animations

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 13 | Gender/Body System | Male, Female, Non-binary body types, Base sprites |
| 13 | Sprite Layer System | Layered rendering (hair, top, bottom, shoes, accessories) |
| 14 | Clothing Items | ออกแบบ Free base items (5 ชิ้น/หมวด), Premium items |
| 14 | Color Customization | Hair palette (20+ สี), Skin tone (10+ โทน) |
| 15 | Emote Animations | Dance (BPM-synced), Wave, Couple dance, Heart particles |
| 15 | Avatar Preview | Profile Card avatar display, Real-time avatar update broadcast |
| 16 | Shop UI (Basic) | Virtual item browser, Equip/Unequip UI |
| 16 | Social Animations | Match confetti, Like heart animation, Chat bubble pop-in |

**Deliverables:**
- ระบบเลือกเพศ/Body type
- Clothing system แบบ Layered sprites
- Free base items + Preview ของ Premium items
- Emote animations ที่ sync กับเพลง
- Avatar แสดงบน Profile Card

---

### Phase 5: Dating & Relationships (สัปดาห์ 17-20) — Dating System, Status, Couple Features

**เป้าหมาย:** เพิ่มมิติความสัมพันธ์ — Virtual Date, Relationship Status, Couple features

**Requirements ที่ครอบคลุม:**
- Requirement 13: ระบบ Dating และสถานะความสัมพันธ์ (AC 1-15)
- Requirement 6: ปฏิสัมพันธ์ในคอนเสิร์ต (AC 1, 4) — Couple emotes, VIP

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 17 | Relationship Status | Single/In Relationship, Mutual confirmation, Heart badge |
| 17 | Status Filtering | Filter discovery by status, Hide "In Relationship" from matching |
| 18 | Virtual Date Rooms | 4 themes (rooftop, beach, cafe, music garden), Private rooms (400x300) |
| 18 | Date Invitation | Invite system, Accept/Reject, 3 invites/day (free) |
| 19 | Date Activities | Mini-games (quiz, word games), Shared music listening |
| 19 | Date Rating | Post-date rating (1-5 stars), Feed into recommendation |
| 20 | Couple Features | Shared playlist, Heart trail, Couple avatar frame |
| 20 | Couple Emotes | Special emotes, Private couple room, Couple dance sync |

**Deliverables:**
- ระบบสถานะความสัมพันธ์ที่ต้อง Mutual confirm
- Virtual Date rooms 4 ธีม
- Mini-games และ Activities ในห้อง Date
- Couple features (shared playlist, heart trail, couple emotes)

---

### Phase 6: Monetization & Safety (สัปดาห์ 21-24) — Premium, Payments, Moderation

**เป้าหมาย:** สร้างรายได้จากแพลตฟอร์มและดูแลความปลอดภัยอย่างครบถ้วน

**Requirements ที่ครอบคลุม:**
- Requirement 10: ระบบ Monetization (AC 1-7)
- Requirement 9: ความปลอดภัย (AC 4, 6-11) — Full Moderation
- Requirement 6: ปฏิสัมพันธ์ (AC 3) — VIP Area

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 21 | Payment Integration | Omise SDK (PromptPay, Credit Card, Mobile Banking) |
| 21 | Premium Subscription | Subscription model, Unlimited likes, See who liked you |
| 22 | Virtual Item Shop | Purchase items, Inventory system, Transaction history |
| 22 | VIP System | VIP ticket purchase, VIP area access, VIP badge |
| 23 | Content Moderation | Photo scanning (AI-based), Auto-suspend (3 reports/24h) |
| 23 | Report System Full | Report categories, Priority queue, Moderator dashboard |
| 24 | Rate Limiting | 60 msg/min, 30 move/sec, 10 profile views/min |
| 24 | Age Verification | ID upload verification, Age badge, Underage restriction |

**Deliverables:**
- Payment system ผ่าน Omise (PromptPay + Credit Card)
- Premium subscription tier
- Virtual item shop
- Full moderation system (AI photo scan, report queue, auto-suspend)
- Rate limiting on all actions

---

### Phase 7: Polish & Launch (สัปดาห์ 25-28) — Performance, Security, Launch Prep

**เป้าหมาย:** เตรียมพร้อมสำหรับ Production Launch — Performance, Security Hardening, App Store

**Requirements ที่ครอบคลุม:**
- Requirement 14: ประสิทธิภาพและ Scalability (AC 1-6)
- Requirement 15: ความปลอดภัยของข้อมูล (AC 3-4) — Encryption at rest, Account deletion
- Cross-cutting: Performance tuning, Security hardening

**งานหลัก:**
| สัปดาห์ | งาน | รายละเอียด |
|---------|------|------------|
| 25 | Performance Optimization | Target 30 FPS, Canvas rendering optimization, Asset lazy loading |
| 25 | WebSocket Scaling | Redis adapter for Socket.io, Horizontal scaling tests |
| 26 | Database Optimization | Query optimization (<100ms reads), Connection pooling, Indexing |
| 26 | CDN & Caching | Static asset CDN, Redis caching strategy, API response caching |
| 27 | Security Hardening | TLS 1.2+, Encryption at rest, PDPA compliance audit |
| 27 | Account Management | Account deletion (30 days), Data export, Privacy controls |
| 28 | App Store Prep | PWA optimization, Apple/Google age rating (17+), Store assets |
| 28 | Beta Testing & Launch | Closed beta, Bug fixes, Launch marketing, Monitoring setup |

**Deliverables:**
- 10K concurrent WebSocket connections supported
- 30 FPS animation target met
- PDPA compliant data handling
- App Store/Play Store ready (PWA wrapper)
- Production monitoring and alerting

---

## 3. Tech Stack (เทคโนโลยีที่เลือกใช้)

### Backend

| Layer | Technology | เหตุผล |
|-------|-----------|--------|
| Runtime | **Node.js 20 LTS** | ต่อยอดจาก Codebase เดิม, Event-driven เหมาะกับ Real-time |
| Framework | **Express.js 4.x** | ใช้อยู่แล้ว, เพิ่ม Router แยกตาม Service |
| Real-time | **Socket.io 4.x** | ใช้อยู่แล้ว, เพิ่ม Redis Adapter สำหรับ Scaling |
| Database | **PostgreSQL 15** | Relational data (users, matches, messages), JSONB for flexible fields |
| ORM/Query Builder | **Knex.js** | Lightweight, Migration support, ไม่หนักเท่า Prisma |
| Cache/Pub-Sub | **Redis 7** | Session store, Rate limiting, Pub/Sub for inter-service events |
| Auth | **Passport.js + JWT** | Modular strategies (Local, Line, Google), Stateless tokens |
| Validation | **Joi / Zod** | Request validation, Schema definition |
| Task Queue | **BullMQ** (Redis-based) | Background jobs (email, notifications, moderation) |

### Authentication & OAuth

| Component | Technology | เหตุผล |
|-----------|-----------|--------|
| Token | **JWT (RS256)** | Stateless, Short-lived access (15min) + Long-lived refresh (7d) |
| Line Login | **Line LIFF SDK v2** | Thai market priority, Deep integration with Line ecosystem |
| Google OAuth | **Passport-Google-OAuth20** | Secondary login option |
| Session | **Redis-backed sessions** | Single active session enforcement, Fast lookup |

### Frontend (Client)

| Layer | Technology | เหตุผล |
|-------|-----------|--------|
| Rendering | **Canvas 2D** (keep existing) | ต่อยอดจากเดิม, เพิ่ม Sprite Sheet system |
| Sprite System | **Custom Sprite Sheet Engine** | Layered rendering, Direction-based animation |
| UI Overlays | **Vanilla JS + CSS** (→ อนาคต: Preact) | เบา, ไม่เพิ่ม Bundle size, ค่อยๆ Migrate |
| State Management | **Custom Event Bus** | Client-side state sync, Decouple UI from game loop |
| Audio | **YouTube IFrame API** | ใช้อยู่แล้ว, Copyright-safe |
| Build Tool | **Vite** | Fast dev server, Bundle optimization |

### Storage & Media

| Component | Technology | เหตุผล |
|-----------|-----------|--------|
| Photos | **Cloudinary** (Free tier: 25GB) | Auto-resize, Format optimization, Content moderation API |
| Sprite Assets | **CDN (Cloudflare R2)** | ราคาถูก, Global edge caching |
| Backup | **pg_dump + S3-compatible** | Daily automated backups |

### Payments

| Component | Technology | เหตุผล |
|-----------|-----------|--------|
| Payment Gateway | **Omise** | Thai payment gateway, รองรับ PromptPay, Credit Card, Mobile Banking |
| Subscription | **Omise Recurring** | Monthly subscription management |
| Webhook | **Omise Webhooks** | Payment confirmation, Subscription status updates |

### Deployment & Infrastructure

| Component | Technology | เหตุผล (MVP → Scale) |
|-----------|-----------|---------------------|
| Hosting (MVP) | **Railway** | $5/mo, Free PostgreSQL addon, Auto-deploy from Git |
| Hosting (Scale) | **AWS ECS / GCP Cloud Run** | Auto-scaling, Production-grade |
| Database (MVP) | **Railway PostgreSQL** | Included in plan, Managed |
| Database (Scale) | **AWS RDS / Supabase** | High availability, Auto-backup |
| Redis (MVP) | **Railway Redis** or **Upstash** (Free tier) | Serverless Redis, Pay-per-use |
| CI/CD | **GitHub Actions** | Free for public repos, Matrix testing |
| Monitoring | **Better Stack** (Free tier) | Uptime monitoring, Log aggregation |
| Error Tracking | **Sentry** (Free tier) | Error capture, Performance monitoring |

### Development Tools

| Tool | Purpose |
|------|---------|
| **TypeScript** (gradual adoption) | Type safety สำหรับ Service layer |
| **ESLint + Prettier** | Code style consistency |
| **Vitest** | Unit/Integration testing |
| **GitHub Actions** | CI/CD pipeline |
| **Docker Compose** | Local development environment |

---

## 4. Database Schema (Core Entities)

### Entity Relationship Diagram (ข้อความ)

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│  users   │──1:1──│   profiles   │──1:N──│profile_photos│
└──────────┘       └──────────────┘       └──────────────┘
     │                    │
     │ 1:N                │ 1:N
     ▼                    ▼
┌──────────┐       ┌──────────────┐
│ sessions │       │ user_genres  │
└──────────┘       └──────────────┘
     │
     │ M:N (via likes/matches)
     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    likes     │──────▶│   matches    │──────▶│conversations │
└──────────────┘       └──────────────┘       └──────────────┘
                                                     │ 1:N
                                                     ▼
                                              ┌──────────────┐
                                              │   messages   │
                                              └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    rooms     │──1:N──│room_players  │       │  music_queue │
└──────────────┘       └──────────────┘       └──────────────┘
                                              
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   avatars    │──1:N──│avatar_items  │       │  shop_items  │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│relationships │       │    dates     │       │   payments   │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐
│   reports    │       │    blocks    │
└──────────────┘       └──────────────┘
```

### Core Tables

#### users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),          -- NULL for OAuth-only users
  nickname      VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  age_verified  BOOLEAN DEFAULT FALSE,
  oauth_provider VARCHAR(20),          -- 'line', 'google', 'facebook'
  oauth_id      VARCHAR(255),
  is_premium    BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  is_suspended  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

#### profiles
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name    VARCHAR(100) NOT NULL,
  bio             TEXT CHECK (char_length(bio) <= 500),
  gender          VARCHAR(20),           -- 'male', 'female', 'non-binary'
  relationship_status VARCHAR(20) DEFAULT 'single',  -- 'single', 'in_relationship'
  partner_id      UUID REFERENCES users(id),
  discovery_age_min  INT DEFAULT 18,
  discovery_age_max  INT DEFAULT 50,
  discovery_gender   VARCHAR(20),        -- preference filter
  discovery_genre_threshold INT DEFAULT 3,
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### profile_photos
```sql
CREATE TABLE profile_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,
  position    INT NOT NULL CHECK (position BETWEEN 1 AND 6),
  is_verified BOOLEAN DEFAULT FALSE,     -- passed content moderation
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### likes
```sql
CREATE TABLE likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  liked_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liker_id, liked_id)
);
CREATE INDEX idx_likes_liked_id ON likes(liked_id);
```

#### matches
```sql
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  matched_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(user1_id, user2_id)
);
```

#### messages
```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id       UUID REFERENCES users(id),
  content         TEXT CHECK (char_length(content) <= 500),
  status          VARCHAR(20) DEFAULT 'sent',  -- 'sent', 'delivered', 'read'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

#### rooms
```sql
CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  created_by    UUID REFERENCES users(id),
  genre_tags    TEXT[],
  max_capacity  INT DEFAULT 100,
  is_scheduled  BOOLEAN DEFAULT FALSE,
  scheduled_at  TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### avatars
```sql
CREATE TABLE avatars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  body_type   VARCHAR(20) NOT NULL DEFAULT 'male',
  hair_color  VARCHAR(7),       -- hex color
  skin_tone   VARCHAR(7),       -- hex color
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### avatar_equipped_items
```sql
CREATE TABLE avatar_equipped_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id   UUID REFERENCES avatars(id) ON DELETE CASCADE,
  item_id     UUID REFERENCES shop_items(id),
  slot        VARCHAR(20) NOT NULL,  -- 'hair', 'top', 'bottom', 'shoes', 'accessory'
  UNIQUE(avatar_id, slot)
);
```

#### shop_items
```sql
CREATE TABLE shop_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(20) NOT NULL,   -- 'hair', 'top', 'bottom', 'shoes', 'accessory', 'emote'
  sprite_url  VARCHAR(500) NOT NULL,
  price       INT DEFAULT 0,          -- 0 = free
  is_premium  BOOLEAN DEFAULT FALSE,
  gender_restriction VARCHAR(20),     -- NULL = all, 'male', 'female'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### payments
```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  omise_charge_id VARCHAR(255),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'THB',
  payment_method  VARCHAR(30),        -- 'credit_card', 'promptpay', 'mobile_banking'
  status          VARCHAR(20),        -- 'pending', 'successful', 'failed', 'refunded'
  item_type       VARCHAR(30),        -- 'subscription', 'virtual_item', 'vip_ticket'
  item_id         UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### reports
```sql
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID REFERENCES users(id),
  reported_id   UUID REFERENCES users(id),
  category      VARCHAR(30) NOT NULL,  -- 'harassment', 'inappropriate_content', 'spam', 'fake_profile', 'underage'
  description   TEXT,
  status        VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'reviewed', 'action_taken', 'dismissed'
  priority      INT DEFAULT 3,         -- 1=critical, 5=low
  reviewed_by   UUID,
  action_taken  VARCHAR(30),           -- 'warn', 'suspend', 'ban'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Design (Key Endpoints)

### Authentication Service (`/api/auth`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/auth/register` | สมัครสมาชิก (email, password, nickname, dob) | 1 |
| POST | `/api/auth/login` | เข้าสู่ระบบ (email + password) | 1 |
| POST | `/api/auth/logout` | ออกจากระบบ (invalidate token) | 1 |
| POST | `/api/auth/refresh` | Refresh access token | 1 |
| POST | `/api/auth/forgot-password` | ส่ง Reset link ทาง email | 1 |
| POST | `/api/auth/reset-password` | ตั้งรหัสผ่านใหม่ | 1 |
| GET | `/api/auth/line` | Line OAuth redirect | 1 |
| GET | `/api/auth/line/callback` | Line OAuth callback | 1 |
| GET | `/api/auth/google` | Google OAuth redirect | 1 |
| GET | `/api/auth/google/callback` | Google OAuth callback | 1 |

### Profile Service (`/api/profiles`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/api/profiles/me` | ดูโปรไฟล์ตัวเอง | 1 |
| PUT | `/api/profiles/me` | อัปเดตโปรไฟล์ | 1 |
| POST | `/api/profiles/me/photos` | อัปโหลดรูป (multipart) | 1 |
| DELETE | `/api/profiles/me/photos/:id` | ลบรูป | 1 |
| GET | `/api/profiles/:userId` | ดูโปรไฟล์ผู้อื่น | 2 |
| PUT | `/api/profiles/me/preferences` | ตั้งค่า Discovery preferences | 2 |
| PUT | `/api/profiles/me/genres` | อัปเดต Music genre preferences | 2 |

### Matching Service (`/api/matches`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/matches/like/:userId` | กดไลค์ | 2 |
| POST | `/api/matches/pass/:userId` | กด Pass | 2 |
| GET | `/api/matches` | ดูรายการ Match ทั้งหมด | 2 |
| DELETE | `/api/matches/:matchId` | Unmatch | 2 |
| GET | `/api/matches/likes-received` | ดูคนที่กดไลค์เรา (Premium) | 6 |
| GET | `/api/matches/suggestions` | แนะนำคนที่น่าสนใจ | 2 |

### Chat Service (`/api/chat`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/api/chat/conversations` | ดูรายการ Conversations | 2 |
| GET | `/api/chat/conversations/:id/messages` | ดูข้อความใน Conversation | 2 |
| POST | `/api/chat/conversations/:id/messages` | ส่งข้อความ (fallback REST) | 2 |

> **Note:** ข้อความ Real-time ส่งผ่าน Socket.io event `dm:send` / `dm:receive`

### Room Service (`/api/rooms`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/api/rooms` | ดูรายการห้องที่ active/upcoming | 3 |
| POST | `/api/rooms` | สร้างห้อง (Premium/Admin only) | 3 |
| GET | `/api/rooms/:id` | ดูรายละเอียดห้อง | 3 |
| POST | `/api/rooms/:id/join` | เข้าร่วมห้อง | 3 |
| POST | `/api/rooms/:id/leave` | ออกจากห้อง | 3 |
| POST | `/api/rooms/:id/register-interest` | ลงทะเบียนสนใจ Event | 3 |

### Music Service (`/api/music`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/music/queue` | เพิ่มเพลงเข้า Queue | 3 |
| GET | `/api/music/queue/:roomId` | ดู Queue ของห้อง | 3 |
| POST | `/api/music/vote-skip` | โหวต Skip | 3 |
| POST | `/api/music/upvote/:songId` | Upvote เพลงใน Queue | 3 |
| POST | `/api/music/playlist` | สร้าง Collaborative Playlist | 3 |

### Avatar Service (`/api/avatars`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/api/avatars/me` | ดู Avatar ปัจจุบัน | 4 |
| PUT | `/api/avatars/me` | อัปเดต Avatar (body, colors) | 4 |
| PUT | `/api/avatars/me/equip` | สวมใส่ Item | 4 |
| GET | `/api/avatars/shop` | ดูร้านค้า Items | 4 |
| POST | `/api/avatars/shop/purchase/:itemId` | ซื้อ Item | 6 |
| GET | `/api/avatars/inventory` | ดู Inventory ของตัวเอง | 4 |

### Dating Service (`/api/dating`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/dating/invite/:userId` | ส่งคำเชิญ Date | 5 |
| POST | `/api/dating/invite/:inviteId/accept` | ตอบรับ Date | 5 |
| POST | `/api/dating/invite/:inviteId/reject` | ปฏิเสธ Date | 5 |
| POST | `/api/dating/relationship/request/:userId` | ขอเป็นแฟน | 5 |
| POST | `/api/dating/relationship/confirm/:requestId` | ตอบรับเป็นแฟน | 5 |
| DELETE | `/api/dating/relationship` | เลิกความสัมพันธ์ | 5 |
| POST | `/api/dating/dates/:dateId/rate` | ให้คะแนน Date | 5 |

### Payment Service (`/api/payments`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/payments/subscribe` | สมัคร Premium | 6 |
| POST | `/api/payments/purchase` | ซื้อ Virtual item / VIP ticket | 6 |
| GET | `/api/payments/history` | ดูประวัติการชำระเงิน | 6 |
| POST | `/api/payments/webhook/omise` | Omise Webhook endpoint | 6 |

### Moderation Service (`/api/moderation`)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/moderation/report` | รายงานผู้ใช้ | 2 |
| POST | `/api/moderation/block/:userId` | Block ผู้ใช้ | 2 |
| DELETE | `/api/moderation/block/:userId` | Unblock | 2 |
| GET | `/api/moderation/reports` | ดูรายงาน (Admin) | 6 |
| POST | `/api/moderation/reports/:id/action` | ดำเนินการ (Admin) | 6 |

---

### Socket.io Events (Real-time)

#### Connection & Room Events
```
Client → Server:
  'authenticate'     { token }              // Auth ก่อน join
  'join-room'        { roomId }             // เข้าร่วมห้อง
  'leave-room'       { roomId }             // ออกจากห้อง
  'move'             { x, y, direction }    // เคลื่อนที่

Server → Client:
  'authenticated'    { user, player }       // Auth สำเร็จ
  'room-state'       { players, queue, ... }// State เริ่มต้น
  'player-joined'    { player }             // ผู้เล่นเข้า
  'player-left'      { playerId }           // ผู้เล่นออก
  'player-moved'     { id, x, y, dir }     // ผู้เล่นเคลื่อนที่
```

#### Social & Matching Events
```
Client → Server:
  'like'             { targetUserId }
  'pass'             { targetUserId }

Server → Client:
  'match-created'    { match, partner }     // แมตช์สำเร็จ!
  'like-received'    { fromUser } (Premium) // มีคนกดไลค์
  'notification'     { type, data }         // Generic notification
```

#### Chat Events
```
Client → Server:
  'dm:send'          { matchId, content }
  'room-chat'        { message }
  'proximity-chat'   { message }

Server → Client:
  'dm:receive'       { message }
  'dm:status'        { messageId, status }
  'room-chat'        { playerId, nickname, message }
  'proximity-chat'   { playerId, nickname, message }
```

#### Music Events
```
Client → Server:
  'add-song'         { videoId, title }
  'vote-skip'        {}
  'upvote-song'      { songId }
  'song-ended'       {}

Server → Client:
  'play-song'        { song, startTime }
  'queue-updated'    [ queue ]
  'skip-vote-count'  { current, needed }
  'beat-tick'        { bpm, timestamp }     // สำหรับ sync animation
```

#### Emote & Animation Events
```
Client → Server:
  'emote'            { type }               // 'dance', 'wave', etc.
  'couple-emote'     { type, partnerId }

Server → Client:
  'player-emote'     { playerId, type }
  'couple-emote'     { player1Id, player2Id, type }
  'effect'           { type, position }     // spotlight, confetti
```

---

## 6. Infrastructure (Deployment & Scaling Strategy)

### MVP Deployment (Phase 1-4) — Budget: ~$20-50/เดือน

```
┌─────────────────────────────────────────────────────────┐
│                    Railway.app                            │
│  ┌────────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Node.js App   │  │PostgreSQL│  │     Redis      │  │
│  │  (Express +    │  │  (5 GB)  │  │  (Upstash Free │  │
│  │   Socket.io)   │  │          │  │   or Railway)  │  │
│  └────────────────┘  └──────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐               ┌────────────────────┐
│   Cloudinary    │               │   GitHub Actions   │
│ (Photo storage  │               │   (CI/CD Pipeline) │
│  Free: 25GB)    │               │                    │
└─────────────────┘               └────────────────────┘
```

**ค่าใช้จ่ายโดยประมาณ (MVP):**
| Service | Plan | ราคา/เดือน |
|---------|------|-----------|
| Railway (App) | Hobby ($5) | $5 |
| Railway (PostgreSQL) | Included | $0 |
| Upstash Redis | Free tier (10K cmd/day) | $0 |
| Cloudinary | Free (25GB, 25K transforms) | $0 |
| GitHub Actions | Free (2000 min/mo) | $0 |
| Omise | Pay per transaction | ~$0 (until revenue) |
| Domain + SSL | Cloudflare (free SSL) | ~$12/year |
| **Total** | | **~$5-10/เดือน** |

---

### Production Deployment (Phase 5-7) — Scale: 10K+ concurrent users

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS / GCP                                  │
│                                                                   │
│  ┌─────────────────┐                                             │
│  │  CloudFront CDN │ ← Static assets, Sprite sheets             │
│  └────────┬────────┘                                             │
│           │                                                       │
│  ┌────────▼────────┐     ┌──────────────────────────────────┐   │
│  │  ALB (Load      │     │  Auto Scaling Group               │   │
│  │  Balancer)      │────▶│  ┌──────┐ ┌──────┐ ┌──────┐     │   │
│  │  (Sticky        │     │  │Node 1│ │Node 2│ │Node N│     │   │
│  │   Sessions)     │     │  └──────┘ └──────┘ └──────┘     │   │
│  └─────────────────┘     └──────────────────────────────────┘   │
│                                       │                           │
│           ┌───────────────────────────┼───────────────┐          │
│           ▼                           ▼               ▼          │
│  ┌─────────────────┐     ┌──────────────┐   ┌──────────────┐   │
│  │  RDS PostgreSQL │     │ ElastiCache  │   │     S3       │   │
│  │  (Multi-AZ)     │     │ (Redis       │   │ (Media +     │   │
│  │                  │     │  Cluster)    │   │  Backups)    │   │
│  └─────────────────┘     └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Scaling Strategy

#### WebSocket Scaling (Socket.io + Redis Adapter)
```javascript
// การ Scale Socket.io ข้ามหลาย Node
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

**แนวทาง Horizontal Scaling:**
1. **Phase 1-4:** Single Node (Railway) — รองรับ ~1,000 concurrent connections
2. **Phase 5-6:** 2-3 Nodes + Redis Adapter — รองรับ ~5,000 concurrent connections
3. **Phase 7+:** Auto-scaling cluster + Redis Cluster — รองรับ 10,000+ concurrent connections

#### Database Scaling Strategy
1. **Phase 1-4:** Single PostgreSQL instance, Read replicas ยังไม่จำเป็น
2. **Phase 5-6:** เพิ่ม Connection Pooling (PgBouncer), Optimize indexes
3. **Phase 7+:** Read replicas, Table partitioning (messages by date), Archive old data

#### Caching Strategy (Redis)
```
Layer 1: Application Cache
  - User sessions (TTL: 7 days)
  - Profile data (TTL: 5 minutes)
  - Room state (TTL: real-time, evict on change)
  - Rate limit counters (TTL: 1 minute / 1 day)

Layer 2: Computed Cache
  - Match suggestions (TTL: 1 hour)
  - Music queue per room (TTL: real-time)
  - Online user count (TTL: 30 seconds)

Layer 3: Pub/Sub
  - Real-time events between Node instances
  - Match notifications
  - Chat message delivery
```

---

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run test:e2e

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway (Staging)
        uses: railway/deploy@v1

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway (Production)
        uses: railway/deploy@v1
```

---

### Monitoring & Observability

| Component | Tool | Purpose |
|-----------|------|---------|
| Uptime | Better Stack (Free) | Health check ทุก 1 นาที |
| Errors | Sentry (Free tier) | Error tracking + Stack traces |
| Logs | Railway built-in / Axiom | Structured logging (JSON) |
| Metrics | Custom + Redis | Player count, Match rate, Message throughput |
| APM | Sentry Performance | Response time, DB query time |

---

### Security Architecture

```
┌─────────────────────────────────────────────────┐
│                 Security Layers                   │
├─────────────────────────────────────────────────┤
│ L1: Network     │ TLS 1.2+, CORS, CSP headers  │
│ L2: Auth        │ JWT (RS256), Rate limiting    │
│ L3: Application │ Input validation, SQL params  │
│ L4: Data        │ bcrypt (cost 12), AES-256     │
│ L5: Compliance  │ PDPA, Age verification        │
└─────────────────────────────────────────────────┘
```

**Key Security Measures:**
- **Password:** bcrypt cost factor ≥ 12
- **Tokens:** Access token (15 min) + Refresh token (7 days, HTTP-only cookie)
- **Transport:** TLS 1.2+ enforced (HSTS)
- **Data at rest:** AES-256 encryption สำหรับ sensitive fields (photos, bio)
- **Rate Limiting:** Per-user (Token Bucket via Redis)
- **PDPA Compliance:**
  - Consent collection ก่อน data processing
  - Data export (Right to Access)
  - Account deletion within 30 days (Right to Erasure)
  - Cookie consent banner

---

## 7. สรุป Timeline & Milestones

| Phase | สัปดาห์ | Milestone | ผลลัพธ์หลัก |
|-------|---------|-----------|-------------|
| 1 | 1-4 | **Foundation Ready** | Auth + DB + Basic Profile พร้อมใช้ |
| 2 | 5-8 | **Social MVP** ⭐ | Like/Match/Chat ทำงานได้ → **Internal Testing** |
| 3 | 9-12 | **Concert Experience** | Room + Music + Animation ครบ → **Alpha Release** |
| 4 | 13-16 | **Avatar System** | ตัวละครแต่งตัวได้ → **Closed Beta** |
| 5 | 17-20 | **Dating Features** | Virtual Date + Relationship → **Open Beta** |
| 6 | 21-24 | **Monetization** | Payment + Premium + Moderation → **Revenue Ready** |
| 7 | 25-28 | **Production Launch** 🚀 | Performance + Security + Launch → **Public Launch** |

**Critical Path:** Phase 1 → 2 → 3 (MVP ที่ใช้งานได้จริงภายใน 12 สัปดาห์)

**Team Allocation (2-3 devs):**
- **Dev 1 (Backend Lead):** Auth, Database, APIs, Payment integration
- **Dev 2 (Frontend/Game):** Canvas rendering, Animation, Sprite system, UI
- **Dev 3 (Full-stack, สัปดาห์ 5+):** Chat system, Matching logic, Moderation

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket scaling bottleneck | High | Redis Adapter ตั้งแต่ Phase 3, Load testing early |
| Omise integration delays | Medium | เริ่ม Sandbox testing ใน Phase 4, Fallback to Stripe |
| Sprite sheet complexity | Medium | เริ่มจาก simple 2-direction → 4-direction → layered |
| PDPA compliance gaps | High | Legal review ใน Phase 6, Privacy-by-design ตั้งแต่ Phase 1 |
| Content moderation cost | Medium | ใช้ Cloudinary AI (Free tier) ก่อน, เพิ่ม manual review later |
| Line API deprecation/changes | Low | Abstract auth behind Passport.js strategy pattern |
| Canvas 2D performance limit | Medium | Offscreen canvas, Sprite batching, Web Workers for physics |

---

## 9. Correctness Properties

### Property 1: Authentication Integrity
- **Validates: Requirement 1**
- ทุก request ที่ต้อง Auth จะต้องผ่านการ verify JWT token ที่ valid
- Single active session: Login ใหม่ต้อง invalidate session เดิมเสมอ
- Age verification: ไม่มี User ที่อายุ < 18 สามารถสร้างบัญชีได้

### Property 2: Match Consistency
- **Validates: Requirement 4**
- Match เกิดขึ้นก็ต่อเมื่อ Like เป็น Mutual (ทั้ง 2 ฝ่าย Like กัน)
- Like ไม่ซ้ำ: User A → User B ได้แค่ครั้งเดียว
- Daily limit: Free users ไม่สามารถ Like เกิน 20 ครั้ง/วัน
- Unmatch ลบ conversation และ Block ทั้ง 2 ฝ่ายจากการเห็นกัน 30 วัน

### Property 3: Message Delivery Guarantee
- **Validates: Requirement 7**
- ข้อความถูกส่งได้เฉพาะระหว่าง Users ที่ Match กันเท่านั้น
- ข้อความที่ส่งตอน Offline ต้อง Deliver เมื่อ Online
- Block ป้องกันการส่งข้อความทั้ง 2 ทิศทาง

### Property 4: Room Capacity Invariant
- **Validates: Requirement 3**
- จำนวน Players ใน Room ไม่เกิน max_capacity (100) เสมอ
- Room ที่ว่าง > 10 นาที ต้องถูก Close อัตโนมัติ
- Disconnection grace period = 60 วินาที ก่อน Remove

### Property 5: Payment Idempotency
- **Validates: Requirement 10**
- Transaction ที่ fail ต้องไม่หักเงิน
- Subscription activation ภายใน 10 วินาที
- Item ที่ซื้อแล้วต้องอยู่ถาวร แม้ Premium หมดอายุ

### Property 6: Relationship Status Integrity
- **Validates: Requirement 13**
- "In a Relationship" ต้องเป็น Mutual confirmation เท่านั้น
- Users ที่มีสถานะ "In a Relationship" ไม่ปรากฏในระบบ Discovery/Matching
- การเลิกโดยฝ่ายหนึ่ง → ทั้งคู่กลับเป็น "Single"

### Property 7: Rate Limiting Enforcement
- **Validates: Requirement 9, 14**
- Chat: ≤ 60 messages/minute per user
- Movement: ≤ 30 updates/second per user
- Profile views: ≤ 10/minute per user
- Likes: ≤ 20/day (free users)
