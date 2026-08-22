# AI-Powered Communication Stress-Testing — Master Canonical Execution Plan

**Product:** Crew (Team Kratos)  
**Feature:** Communication Stress Testing  
**Canonical launch surface:** Engagement Hub  
**Status:** Master implementation blueprint  
**Target:** Guarded tenant beta in 7–9 weeks  
**Version:** Master v1.0  
**Date:** 2026-08-22

---

## 1. Executive Outcome

Crew will let an authorized user test an unsent workplace message before sending it. The service simulates three protected, role-based workplace lenses, identifies likely communication friction using evidence from the submitted draft, calculates an explainable 0–100 friction score in deterministic server code, and produces a bounded candidate rewrite.

**The author remains responsible for the final communication.**

### Non-negotiable principles

1. AI proposes; deterministic code validates and scores; humans decide.
2. The feature **never** publishes, blocks, or changes a draft automatically.
3. The model **never** receives employee records, payroll, attendance, biometric data, chat data, or other personal workplace records in beta.
4. The model **never** returns the composite numerical score.
5. A failed or incomplete analysis can **never** appear as a low-friction result.
6. A rewrite **cannot** invent dates, approvals, staffing capacity, compensation, policy facts, guarantees, or commitments not present in the source draft.
7. Every completed analysis is **immutable**. A re-test creates a new record.
8. Every feature record is **tenant-scoped**; clients never provide tenant or actor IDs.
9. Only a fully validated result with all three required persona reactions and a validated rewrite can receive a score.
10. Only the human author can decide whether to use the rewrite or publish/send the message.

---

## 2. Product Scope

### 2.1 Launch use cases

**HR/Admin announcement author**
- Opens the existing Engagement Hub announcement composer.
- Stress-tests the current draft.
- Reviews persona reactions, score, risks, and rewrite.
- Optionally applies the rewrite locally.
- Uses the existing announcement broadcast flow.

**Manager / Team Lead**
- Opens a review-only draft flow in Engagement Hub.
- Stress-tests an announcement or team message.
- Reviews concerns and rewrite.
- Can apply/copy the rewrite for their normal authorized channel.
- Does **not** receive company-wide announcement broadcast permission merely from receiving communication-review permission.

### 2.2 Launch channels

- `ANNOUNCEMENT`
- `TEAM_MESSAGE`

Only `ANNOUNCEMENT` may be linked to the existing Crew `Announcement` record in beta.

### 2.3 Explicitly out of beta

- Policy RAG/context retrieval
- Custom personas
- Trend analytics
- Meeting transcript processing
- Socket.IO/SSE streaming
- Individual employee prediction
- Person-level communication analytics
- Automatic publishing or approval decisions

---

## 3. Protected AI Personas

Exactly three protected system personas are active per tenant:

| Key | Lens |
|---|---|
| `senior_developer` | Testing, engineering quality, dependencies, operational feasibility |
| `hr_people_partner` | Workload, fairness, people impact, policy-review signals |
| `product_lead` | Delivery trade-offs, deadlines, customer/release impact |

System personas:
- are seeded **per tenant**;
- are protected and cannot be edited/deleted in beta;
- must remain active;
- are **never** global `tenantId = null` records.

Custom personas are a Phase 7 capability and must use structured role/focus fields only.

---

## 4. Verified Repository Fit

| Existing asset | Verified state | Implementation consequence |
|---|---|---|
| [`EngagementHub.jsx`](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx) | Owns the announcement composer ([lines 456–525](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx#L456-L525)) | Add review controls to the existing composer modal; do not create a second sender |
| `POST /api/announcements` | Restricted by `authorize(1)` ([`announcements.js:10`](file:///e:/Team-Kratos/backend/src/routes/announcements.js#L10)) | Preserve existing broadcast authority in beta |
| [`role.js`](file:///e:/Team-Kratos/backend/src/middleware/role.js) | Numeric `authorize(N)` only | Add `requirePermission(key)` without changing existing routes |
| [`RoleDefinition.permissions`](file:///e:/Team-Kratos/backend/prisma/schema.prisma#L126) | Fine-grained JSON permissions already exist | Add four communication permissions and server-side validation |
| [`permissions.js`](file:///e:/Team-Kratos/frontend/src/lib/permissions.js) | Uses explicit JSON permissions with level fallback when unconfigured | Mirror the same semantics on the backend |
| [`db.js`](file:///e:/Team-Kratos/backend/src/config/db.js) | Tenant context injected via `AsyncLocalStorage` | Every new domain model explicitly stores `tenantId` |
| [`geminiClient.js`](file:///e:/Team-Kratos/backend/src/services/geminiClient.js) | Server-side Gemini client | Only the provider adapter may call Gemini |
| [`cronJobs.js`](file:///e:/Team-Kratos/backend/src/workers/cronJobs.js) | Existing cron registration point using `basePrisma` per-tenant loops | Register retention/redaction job here |
| Tenant creation | Two paths: [`authController.js:424`](file:///e:/Team-Kratos/backend/src/controllers/authController.js#L424) and [`superadminController.js:42`](file:///e:/Team-Kratos/backend/src/controllers/superadminController.js#L42) | Both invoke the same idempotent seeder; existing tenants use a backfill |
| [`cacheManager.js`](file:///e:/Team-Kratos/backend/src/config/cacheManager.js) | Redis + in-memory fallback; `isRedisAvailable` not exported | Rate limiter must use shared Redis and fail closed; export `getRedisHealth()` |
| Console permissions | [`consoleController.js:419-477`](file:///e:/Team-Kratos/backend/src/controllers/consoleController.js#L419-L477) reads/writes `RoleDefinition.permissions` JSON | Add server-side key validation; extend frontend with 4 checkboxes |

> [!WARNING]
> **Pre-existing repository issue:** [`superadminController.js:53-65`](file:///e:/Team-Kratos/backend/src/controllers/superadminController.js#L53-L65) creates an admin user **without** `roleDefinitionId`. The persona/config seeder must not assume the admin user has a role definition.

---

## 5. Locked Architecture Decisions

| Decision | Master rule |
|---|---|
| AI boundary | Gemini interprets draft text and generates bounded role-lens reactions + candidate rewrite |
| Validation | Server-side Zod + evidence validation + taxonomy validation |
| Score | Deterministic `SCORING_V1` in backend |
| Transport | One bounded HTTP request in beta |
| Provider calls | One structured Gemini call returning all 3 reactions + 1 rewrite |
| Repair | At most one whole-response repair attempt |
| Provider hard cap | **20 seconds** |
| UX target | P95 successful response **≤12 seconds** |
| Timeout hierarchy | Target ≤12s; hard ceiling 20s; after hard ceiling → no score |
| Rate limit | Redis-backed, **fail-closed** |
| Feature flag | Global `COMMUNICATION_STRESS_TEST_ENABLED` **AND** tenant `CommunicationReviewConfig.enabled` |
| Retention | 90-day detailed data; 365-day de-identified aggregate/audit metadata; then redaction |
| Re-test | New immutable test with optional `parentTestId` |
| Announcement linking | One review may link to at most one announcement in beta |
| Tenant isolation | Every domain record contains `tenantId`; ID lookups also apply explicit ownership filters |
| Publishing | Existing `authorize(1)` behavior remains unchanged |
| Streaming | Not built unless post-pilot evidence justifies it |
| Meeting transcripts | Separate initiative |

---

## 6. User Journey

```mermaid
flowchart LR
  A[Author enters unsent draft] --> B[Stress-test message]
  B --> C[Auth + Permission + Validation + Rate limit]
  C --> D[Input/DLP guard]
  D --> E[Versioned prompt builder]
  E --> F[One structured Gemini call]
  F --> G[Server schema + evidence + rewrite validation]
  G --> H{3 reactions + rewrite valid?}
  H -->|No| I[INCOMPLETE / FAILED — no score]
  H -->|Yes| J[Deterministic SCORING_V1]
  J --> K[Review UI]
  K --> L{Author decision}
  L -->|Use rewrite| M[Update local draft only]
  L -->|Edit + re-test| B
  L -->|Keep original| N[Keep original draft]
  M --> O{Can publish company announcement?}
  N --> O
  O -->|Yes| P[Existing announcement flow]
  O -->|No| Q[Copy/use in normal authorized channel]
```

### Result presentation

Every completed result displays:

1. Overall friction label and 0–100 score
2. Five contributing dimensions (not just a coloured gauge)
3. Three persona cards with: concise concern, exact short evidence from the draft, likely impact, practical mitigation
4. Candidate rewrite with: "What changed", "What still needs a human decision"
5. Disclaimer: *"This is a role-based scenario review, not a prediction of individual employees or a policy decision."*
6. Controls: **Use rewrite**, **Keep draft**, **Edit and re-test**, **Try again**

A Critical result recommends HR/policy-owner review but **never disables publishing automatically**.

### Required scenario acceptance

For: *"The sprint deadline is moving from Friday to tomorrow morning. Everyone needs to stay online tonight."*

- Score **≥60** (HIGH or CRITICAL band)
- Senior Developer: testing/release quality concern
- HR/People Partner: after-hours work / fairness / policy review concern
- Product Lead: deadline/delivery/customer trade-off concern
- Rewrite: retains urgency, adds clarity/safeguards/escalation path/flexibility, does **not** invent overtime or compensation promises

---

## 7. RBAC and Permissions

### 7.1 New permission keys

| Permission | Fallback when `permissions` is unconfigured | Explicit permission object |
|---|---|---|
| `communication_stress_test` | `level ≤ 2` | Must be `true` |
| `view_all_communication_stress_tests` | `level ≤ 1` | Must be `true` |
| `manage_communication_personas` | `level ≤ 1` | Must be `true` |
| `view_communication_trends` | `level ≤ 1` | Must be `true` |

Level 0 owner always has access. An explicitly configured permissions object is deny-by-default for new keys.

### 7.2 Backend middleware

Create `backend/src/middleware/requirePermission.js`:

```js
const { PERMISSION_DEFAULTS } = require('../config/communicationReviewPolicy');

const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    const roleDef = req.user?.roleDefinition;
    if (!roleDef) {
      return res.status(401).json({ error: 'Unauthorized: No role attached to session.' });
    }

    // SuperAdmin bypass — matches role.js pattern
    if (roleDef.name === 'SuperAdmin' && req.user.tenantId === null) {
      return next();
    }

    // Owner always has access — matches permissions.js:4
    if (roleDef.level === 0) return next();

    const perms = roleDef.permissions;

    // Explicit permissions object — matches permissions.js:11-12
    if (perms !== null && perms !== undefined && typeof perms === 'object') {
      if (perms[permissionKey] === true) return next();
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    // Null permissions — level-based fallback
    const rule = PERMISSION_DEFAULTS[permissionKey];
    if (rule && roleDef.level <= rule.maxLevel) return next();

    return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
  };
};

module.exports = requirePermission;
```

### 7.3 Capabilities endpoint

`GET /api/communication-stress-tests/capabilities` returns server-computed permissions:

```json
{
  "canStressTest": true,
  "canViewAll": false,
  "canManagePersonas": false,
  "canViewTrends": false,
  "canPublishAnnouncements": false,
  "featureEnabled": true
}
```

### 7.4 Permission administration

- Extend existing `/api/console/permissions` editor with four new checkboxes
- Backend must validate that only known permission keys are persisted
- The `updatePermissions` controller ([`consoleController.js:440`](file:///e:/Team-Kratos/backend/src/controllers/consoleController.js#L440)) currently accepts arbitrary JSON — add server-side key validation

### 7.5 Frontend permission fallback additions

Add to [`permissions.js`](file:///e:/Team-Kratos/frontend/src/lib/permissions.js) switch statement before `default`:

```js
    case 'communication_stress_test':           return l <= 2;
    case 'view_all_communication_stress_tests': return l <= 1;
    case 'manage_communication_personas':       return l <= 1;
    case 'view_communication_trends':           return l <= 1;
```

---

## 8. Data Model

### 8.1 New Models

```prisma
enum SourceType {
  ANNOUNCEMENT
  TEAM_MESSAGE
}

enum TestStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  INCOMPLETE
  EXPIRED
  REDACTED
}

enum FrictionBand {
  LOW
  MODERATE
  HIGH
  CRITICAL
}

model CommunicationReviewConfig {
  id                    String   @id @default(uuid())
  tenantId              String   @unique
  tenant                Tenant   @relation(fields: [tenantId], references: [id])
  enabled               Boolean  @default(false)
  policyContextEnabled  Boolean  @default(false)
  personaBuilderEnabled Boolean  @default(false)
  analyticsEnabled      Boolean  @default(false)
  detailRetentionDays   Int      @default(90)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model CommunicationPersona {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  key         String
  name        String
  roleFamily  String
  focusAreas  String[]
  isSystem    Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdById String?
  createdBy   User?    @relation("PersonaCreator", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, key])
  @@index([tenantId, isActive])
}

model CommunicationStressTest {
  id                   String       @id @default(uuid())
  tenantId             String
  tenant               Tenant       @relation(fields: [tenantId], references: [id])
  createdById          String
  idempotencyKey       String
  parentTestId         String?
  sourceType           SourceType
  title                String       @db.VarChar(160)
  message              String       @db.Text
  category             String?
  contentFingerprint   String
  status               TestStatus   @default(PENDING)
  overallFrictionScore Int?
  frictionBand         FrictionBand?
  dimensionScores      Json?
  rewriteMessage       String?      @db.Text
  rewriteMetadata      Json?
  modelVersion         String?
  promptVersion        String?
  scoringVersion       String?
  expiresAt            DateTime?
  redactedAt           DateTime?
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  reactions CommunicationPersonaReaction[]
  events    CommunicationStressTestEvent[]

  @@unique([tenantId, createdById, idempotencyKey])
  @@index([tenantId, createdById])
  @@index([tenantId, createdAt])
  @@index([tenantId, status])
}

model CommunicationPersonaReaction {
  id           String                  @id @default(uuid())
  tenantId     String
  stressTestId String
  stressTest   CommunicationStressTest @relation(fields: [stressTestId], references: [id], onDelete: Cascade)
  personaKey   String
  personaName  String
  summary      String?                 @db.Text
  concernTypes String[]
  maxSeverity  String?
  concerns     Json
  mitigations  Json?
  createdAt    DateTime                @default(now())

  @@unique([stressTestId, personaKey])
  @@index([tenantId, stressTestId])
}

model CommunicationStressTestEvent {
  id           String                  @id @default(uuid())
  tenantId     String
  stressTestId String
  stressTest   CommunicationStressTest @relation(fields: [stressTestId], references: [id], onDelete: Cascade)
  actorId      String?
  eventType    String
  metadata     Json?
  createdAt    DateTime                @default(now())

  @@index([tenantId, stressTestId])
}
```

### 8.2 Model additions

**Tenant model** — add:
```prisma
  communicationReviewConfig   CommunicationReviewConfig?
  communicationPersonas       CommunicationPersona[]
  communicationStressTests    CommunicationStressTest[]
```

**User model** — add after `intelligenceSignals` ([line 397](file:///e:/Team-Kratos/backend/prisma/schema.prisma#L397)):
```prisma
  createdPersonas     CommunicationPersona[] @relation("PersonaCreator")
```

**Announcement model** — add:
```prisma
  stressTestId      String?  @unique
  stressTestVariant String?
```

### 8.3 Content fingerprint

`contentFingerprint` = HMAC-SHA-256 using `COMMUNICATION_STRESS_TEST_HASH_KEY`. Never store an unhashed deterministic value.

---

## 9. Enums and Lifecycle

```
SourceType:       ANNOUNCEMENT | TEAM_MESSAGE
TestStatus:       PENDING | RUNNING | COMPLETED | FAILED | INCOMPLETE | EXPIRED | REDACTED
FrictionBand:     LOW | MODERATE | HIGH | CRITICAL
Variant:          ORIGINAL | REWRITE | EDITED_REWRITE
ConcernSeverity:  LOW | MEDIUM | HIGH | CRITICAL
EventType:        CREATED | COMPLETED | FAILED | REWRITE_APPLIED | REWRITE_DISMISSED |
                  ORIGINAL_PUBLISHED | REWRITE_PUBLISHED | EDITED_REWRITE_PUBLISHED |
                  RETENTION_REDACTED
```

A re-test **never** overwrites its parent:
```
Original Test
├── immutable draft
├── immutable reactions
├── immutable rewrite
├── immutable score
└── immutable version metadata

Retest → New CommunicationStressTest record (parentTestId = Original)
```

---

## 10. Fixed Concern Taxonomy

| Dimension | Concern types | Weight |
|---|---|---|
| Clarity | `AMBIGUOUS_ACTION`, `AMBIGUOUS_OWNER`, `AMBIGUOUS_TIMELINE`, `MISSING_RATIONALE`, `MISSING_ESCALATION_PATH` | 0.25 |
| Workload | `COMPRESSED_TIMELINE`, `AFTER_HOURS_EXPECTATION`, `UNPLANNED_SCOPE`, `CAPACITY_RISK` | 0.25 |
| Fairness & people risk | `UNEQUAL_TREATMENT`, `POTENTIALLY_EXCLUSIONARY_LANGUAGE`, `COERCIVE_LANGUAGE`, `POLICY_REVIEW_REQUIRED` | 0.20 |
| Delivery & operational risk | `TESTING_RISK`, `RELEASE_RISK`, `SECURITY_RISK`, `SAFETY_RISK`, `CUSTOMER_IMPACT_RISK`, `DEPENDENCY_RISK` | 0.20 |
| Tone | `BLAMING_LANGUAGE`, `DISMISSIVE_LANGUAGE`, `ALARMIST_TONE` | 0.10 |

Per persona: maximum 5 concerns, no duplicate concern type, evidence 6–240 characters, one fixed severity, concise impact, practical mitigation.

The server rejects: unknown types, duplicates, invalid excerpts, excessive output, missing persona keys, and schema violations.

---

## 11. Deterministic Scoring — SCORING_V1

The model returns concern types and severities **only**. The server calculates everything.

```
severityBase:     LOW=20, MEDIUM=40, HIGH=65, CRITICAL=85

dimensionScore(persona, dimension) =
  min(100, max(severityBase of concerns in dimension) + 5 × (distinctConcernCount − 1))
  // No concern in dimension = 0

personaScore = 0.25×clarity + 0.25×workload + 0.20×fairness + 0.20×delivery + 0.10×tone

baseScore = mean(personaScore for all 3 required personas)

breadthUplift  = +5  when same HIGH+ concern type in ≥2 personas; else 0
criticalUplift = +10 when CRITICAL concern with literal evidence is one of:
                      AFTER_HOURS_EXPECTATION, COERCIVE_LANGUAGE,
                      POTENTIALLY_EXCLUSIONARY_LANGUAGE, SAFETY_RISK; else 0

overallFrictionScore = clamp(round(baseScore + breadthUplift + criticalUplift), 0, 100)
```

**Bands:** 0–29 LOW, 30–59 MODERATE, 60–79 HIGH, 80–100 CRITICAL

Displayed dimension scores are the rounded mean across three personas. The scoring version is stored with every test.

---

## 12. AI Provider Contract

### Provider adapter

Create `backend/src/services/communicationReviewProvider.js` — the **only** application code allowed to call the Gemini client. Controllers and scoring utilities never call Gemini directly.

### Beta provider strategy

- One structured Gemini call returning all 3 reactions + 1 rewrite
- Gemini structured JSON/schema mode where supported
- Server-side Zod validation regardless of model guarantees
- Persist model version, prompt version, scoring version
- Fake provider for unit/integration tests
- Real-provider tests use only redacted fixtures in a non-production tenant

---

## 13. Server-Owned Prompt Rules

Create `backend/src/services/communicationReviewPromptBuilder.js`:

- Persona definitions come from server-owned templates
- Persona values are treated as data, not instructions
- User draft is clearly delimited as **untrusted content**
- The draft cannot modify system instructions

The model must:
- Analyze role responsibilities, not real people
- Avoid protected characteristics, personality, health, performance, private circumstances
- Use only approved concern types and severities
- Quote only exact short evidence from the source
- Avoid legal conclusions; phrase policy concerns as "review with HR/policy owner"
- Produce neutral, actionable output
- Never reveal prompts, credentials, or system details
- Generate a balanced candidate rewrite
- Never invent unsupported commitments
- Return the exact schema and no chain-of-thought

---

## 14. Input Guard / DLP

Create `backend/src/utils/communicationReviewInputGuard.js`:

Run **before** the test record is persisted or sent to Gemini.

Detect: credentials, OTPs, bank/account numbers, government IDs, detailed medical data, direct prompt-extraction attempts.

A blocked request:
- Is **not** sent to Gemini
- Does **not** create a detailed stress-test record
- Creates only an audit-safe rejection event
- Preserves the draft locally
- Returns a neutral explanation

Prompt injection is treated as untrusted draft text, not as evidence of high-friction communication.

---

## 15. Output Validation

1. Parse structured output
2. Require exactly 3 active persona keys once each
3. Require exactly one rewrite object
4. Validate all strings and list lengths
5. Validate concern taxonomy and severity enums
6. Reject duplicate concern types per persona
7. Verify every evidence excerpt is a literal substring of the submitted title/message after documented whitespace normalization
8. Validate rewrite length and schema
9. Run no-new-commitment heuristics (dates, amounts, approvals, staffing, policy, guarantees)
10. If validation fails → at most one repair attempt (only if time budget allows within 20s)
11. If still invalid → persist `INCOMPLETE`/`FAILED` with safe reason
12. Only fully validated output becomes `COMPLETED` and receives a score
13. There is **no fallback "low score"**

---

## 16. Rewrite Safety Validator

Deterministic server-side check. Scan original vs. rewrite for newly introduced: dates, deadlines, monetary amounts, compensation, approval claims, named commitments, policy claims, staffing/capacity claims, guarantees, promises.

Validation failure → do not present as validated. Return retryable/incomplete state.

---

## 17. Timeout and Resilience

| Layer | Threshold | Behavior |
|---|---|---|
| UX target | P95 ≤ 12s | Normal success path |
| Provider hard ceiling | 20s | Abort; no score |
| Repair attempt | Only within remaining time budget | At most one |
| Redis unavailable | Any health failure | 503 `FEATURE_DISABLED`; draft preserved |

### Redis fail-closed implementation

Export `getRedisHealth()` from [`cacheManager.js`](file:///e:/Team-Kratos/backend/src/config/cacheManager.js):

```js
module.exports = {
  getCache, setCache, delCache,
  getRedisHealth: () => ({ available: isRedisAvailable, client: redisClient }),
};
```

If `available === false`: return 503, do **not** use in-memory fallback for rate limiting.

---

## 18. Rate Limiting and Idempotency

### Limits

| Constraint | Value | Mechanism |
|---|---|---|
| Per user per hour | 10 | Redis `INCR` + TTL |
| Per tenant per day | 100 | Redis `INCR` + TTL |
| In-flight lock | 30 seconds | Redis `SET NX` |

### Idempotency

- `Idempotency-Key` header required on create requests
- Same key + same actor + same fingerprint → return existing result
- Same key + different fingerprint → `409 IDEMPOTENCY_CONFLICT`
- Same key must never execute a second provider call

---

## 19. API Contract

| Method | Route | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/communication-stress-tests/capabilities` | authenticated | Server-derived capabilities |
| `POST` | `/api/communication-stress-tests` | `communication_stress_test` | Create/run stress test |
| `GET` | `/api/communication-stress-tests/:id` | creator or `view_all` | Read result |
| `POST` | `/api/communication-stress-tests/:id/retest` | creator | Create immutable re-test |
| `POST` | `/api/communication-stress-tests/:id/events` | creator | Record bounded interaction event |

Static routes **must** be declared before `/:id`.

### Create request

```http
POST /api/communication-stress-tests
Idempotency-Key: <uuid>
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "sourceType": "ANNOUNCEMENT",
  "title": "Sprint delivery update",
  "category": "Urgent",
  "message": "The sprint deadline is moving from Friday to tomorrow morning. Everyone needs to stay online tonight."
}
```

Client may **not** provide: tenant ID, user ID, persona list, score input, model, prompt, provider configuration, policy snippets.

### Error codes

| Code | HTTP | Behavior |
|---|---|---|
| `FEATURE_DISABLED` | 403/503 | Disable action, preserve draft |
| `FORBIDDEN` | 403 | Generic denial |
| `NOT_FOUND` | 404 | Do not leak cross-tenant existence |
| `VALIDATION_FAILED` | 400 | Bounded input feedback |
| `SENSITIVE_CONTENT_BLOCKED` | 422 | Keep draft local; no provider call |
| `RATE_LIMITED` | 429 | Preserve draft; provide retry guidance |
| `IDEMPOTENCY_CONFLICT` | 409 | Require changed draft/new key |
| `ANALYSIS_INCOMPLETE` | 503 | No score; retry |
| `ANALYSIS_UNAVAILABLE` | 503 | No score; retry |
| `AUDIT_UNAVAILABLE` | 503 | Do not call provider if creation audit cannot be recorded |

---

## 20. Announcement Link Integrity

Extend `POST /api/announcements` with optional `stressTestId` and `stressTestVariant`.

Before linking, verify:
1. Test belongs to the same tenant
2. Test belongs to the same publishing user
3. `sourceType === ANNOUNCEMENT`
4. `status === COMPLETED`
5. Test is not expired/redacted
6. Test is not already linked to another announcement
7. `ORIGINAL` → content matches stored original
8. `REWRITE` → message matches stored rewrite, title unchanged
9. `EDITED_REWRITE` → traced as metadata, not a claim AI authored the final text

On validation failure: reject only the linkage, never silently attach. After successful save: write test event + `AuditLog`, do **not** duplicate existing Socket.IO/notification fan-out.

---

## 21. Retention and Privacy

| Retention tier | Duration | Content |
|---|---|---|
| Detailed test data | 90 days | Full draft, rewrite, evidence, reactions |
| De-identified aggregate | 365 days | Score bands, concern types, version metadata |
| After expiry | Redacted | Only minimum safe audit metadata |

### Redaction job

Create `backend/src/jobs/redactExpiredCommunicationStressTests.js`:
- Mark `REDACTED`, remove draft/rewrite/evidence/summary/mitigation content
- Retain only aggregate dimensions/band/type counts, version/audit references
- Run in dry-run mode before production enablement
- Before-expiry deletion requests use the same redaction path

### Logging rules

Logs may contain **only**: IDs, error codes, status, version identifiers, safe metrics.  
Logs must **never** contain: full drafts, full rewrites, raw Gemini payloads, hidden prompts, sensitive evidence.  
Add an automated log-sanitization test.

---

## 22. Implementation Phases

### Phase 0 — Preflight, governance, fixtures (2–3 days)

No code changes.

**Work:**
- Confirm locked decisions and Gemini data-processing terms
- Select beta tenant
- Build 30+ message redacted fixture set (routine, deadline/overtime, policy, emergency, injection, sensitive-data)
- Define independent expected labels with HR/Product/Engineering
- Configure environment:
  ```env
  COMMUNICATION_STRESS_TEST_ENABLED=false
  COMMUNICATION_STRESS_TEST_HASH_KEY=<64-char hex>
  REDIS_URL=redis://...
  GEMINI_MODEL=...
  ```
- Define incident/rollback owners

**Exit gate:** Fixtures and data boundary approved; production enablement = false.

---

### Phase 1 — Permission, config, service skeleton (3 days)

**New files (6):**

| File | Purpose |
|---|---|
| `backend/src/middleware/requirePermission.js` | Permission-key middleware |
| `backend/src/config/communicationReviewPolicy.js` | Permission registry + feature flags + rate limits |
| `backend/src/routes/communicationStressTests.js` | Express router |
| `backend/src/controllers/communicationStressTestController.js` | REST controller skeleton |
| `backend/src/services/communicationStressTestService.js` | Service skeleton (no AI) |
| `backend/src/validators/communicationStressTest.js` | Zod input schemas |

**Modified files (3):**

| File | Change |
|---|---|
| [`server.js`](file:///e:/Team-Kratos/backend/src/server.js) | Add route mount after [line 211](file:///e:/Team-Kratos/backend/src/server.js#L211) |
| [`permissions.js`](file:///e:/Team-Kratos/frontend/src/lib/permissions.js) | Add 4 switch cases before [line 32](file:///e:/Team-Kratos/frontend/src/lib/permissions.js#L32) |
| [`cacheManager.js`](file:///e:/Team-Kratos/backend/src/config/cacheManager.js) | Export `getRedisHealth()` |

**Route structure:**
```js
router.use(auth);
router.get('/capabilities', ctrl.getCapabilities);           // static first
router.post('/', requirePermission('communication_stress_test'), ctrl.createStressTest);
router.get('/:id', ctrl.getStressTest);                      // dynamic after
router.post('/:id/retest', requirePermission('communication_stress_test'), ctrl.retestStressTest);
router.post('/:id/events', ctrl.createEvent);
```

**Exit gate:** No Gemini call exists. All endpoints reject unauthorized/disabled/malformed requests correctly.

---

### Phase 2 — Prisma, seeding, retention (3–4 days)

**New files (4):**

| File | Purpose |
|---|---|
| `backend/prisma/migrations/…/migration.sql` | Auto-generated |
| `backend/src/services/communicationPersonaSeeder.js` | Idempotent seeder (3 personas + config) |
| `backend/src/scripts/backfillCommunicationReviewConfig.js` | One-time backfill |
| `backend/src/jobs/redactExpiredCommunicationStressTests.js` | Daily retention redaction |

**Modified files (4):**

| File | Change |
|---|---|
| [`schema.prisma`](file:///e:/Team-Kratos/backend/prisma/schema.prisma) | Add 5 models, 3 enums, relations |
| [`authController.js`](file:///e:/Team-Kratos/backend/src/controllers/authController.js) | Call seeder inside signup `$transaction` (after [line 500](file:///e:/Team-Kratos/backend/src/controllers/authController.js#L500)) |
| [`superadminController.js`](file:///e:/Team-Kratos/backend/src/controllers/superadminController.js) | Call seeder after tenant creation (after [line 72](file:///e:/Team-Kratos/backend/src/controllers/superadminController.js#L72)) |
| [`cronJobs.js`](file:///e:/Team-Kratos/backend/src/workers/cronJobs.js) | Register daily redaction cron at 3 AM |

**Seeder design:**
```js
async function seed(prismaClient, tenantId) {
  await prismaClient.communicationReviewConfig.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, enabled: false },
  });
  for (const persona of SYSTEM_PERSONAS) {
    await prismaClient.communicationPersona.upsert({
      where: { tenantId_key: { tenantId, key: persona.key } },
      update: {},
      create: { tenantId, ...persona, isSystem: true, isActive: true },
    });
  }
}
```

**Exit gate:** Migration succeeds on blank + production-like DBs. Backfill runs twice without duplicates. Existing tests unchanged.

---

### Phase 3 — AI provider, taxonomy, scoring, audit (4–5 days)

**New files (5+):**

| File | Purpose |
|---|---|
| `backend/src/services/communicationReviewProvider.js` | Gemini adapter |
| `backend/src/services/communicationReviewPromptBuilder.js` | Versioned prompt templates |
| `backend/src/utils/communicationReviewInputGuard.js` | DLP / input sanitization |
| `backend/src/utils/communicationFrictionScoring.js` | Deterministic `SCORING_V1` |
| `backend/tests/communicationReview/` | Fixtures, mocks, scoring snapshots |

**Exit gate:** Required scenario passes. Scoring snapshots stable. Invalid output cannot become `COMPLETED`. Raw drafts absent from logs.

---

### Phase 4 — Resilience, cost control, security gate (3–4 days)

**New files (1):**

| File | Purpose |
|---|---|
| `backend/src/middleware/communicationStressTestRateLimit.js` | Redis-backed rate limiter (fail-closed) |

**Work:** Redis counters/locks, idempotency, IDOR tests, provider/Redis outage tests, DLP bypass tests, injection tests, threat-model review.

**Exit gate:** Integration/security suite passes. Redis outage fails closed. P95 fixture run ≤12s with 20s hard cap.

---

### Phase 5 — Engagement Hub UI and announcement linkage (4–5 days)

**New files (5):**

| File | Purpose |
|---|---|
| `frontend/src/components/communication/CommunicationReviewDialog.jsx` | Main review modal |
| `frontend/src/components/communication/FrictionScoreCard.jsx` | Score + dimension visualization |
| `frontend/src/components/communication/PersonaReactionCard.jsx` | Persona concern card |
| `frontend/src/components/communication/RewriteComparison.jsx` | Original vs. rewrite diff |
| `frontend/src/lib/communicationStressApi.js` | API client wrapper |

**Modified files (2):**

| File | Change |
|---|---|
| [`EngagementHub.jsx`](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx) | Add "Stress-test" button in composer ([line 514](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx#L514)) + manager review panel ([line 288](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx#L288)) |
| [`announcementController.js`](file:///e:/Team-Kratos/backend/src/controllers/announcementController.js) | Accept/validate `stressTestId`/`stressTestVariant` |

**Exit gate:** E2E covers manager review-only, HR/Admin original/rewrite/edit-rewrite broadcast, failed review, expired result.

---

### Phase 6 — Controlled pilot and guarded beta (5–7 days)

Enable internal tenant → design-partner tenant. Weekly output review against fixtures.

**Beta exit gates:**
- ≥90% of relevant fixture outputs surface top-two risks
- No cross-tenant disclosure, sensitive-data forwarding, or unmitigated harmful suggestion
- P95 ≤12s, provider/parse failure <5%
- ≥70% of pilot results rated helpful or neutral
- Every critical report has owner and disposition

---

### Phase 7 — Custom personas and aggregate trends (4–6 days, post-beta)

Custom persona CRUD (name + role family + fixed focus enums only). Max 20 active per tenant. Trends endpoint with suppression below 10 tests. No manager leaderboard.

### Phase 8 — Policy context (1 sprint, separate approval)

RAG-style vetted policy snippets. Requires HR-approved corpus and Security approval.

### Phase 9 — Streaming decision (2–4 days, conditional)

Only if P95 exceeds target after Phase 6 measurement.

### Phase 10 — Meeting transcripts (separate initiative, 1–2 sprints)

Requires recording consent, retention policy, separate data model.

---

## 23. Complete File Inventory

### New backend files (15)

```
backend/src/middleware/requirePermission.js
backend/src/config/communicationReviewPolicy.js
backend/src/routes/communicationStressTests.js
backend/src/controllers/communicationStressTestController.js
backend/src/services/communicationStressTestService.js
backend/src/validators/communicationStressTest.js
backend/src/services/communicationPersonaSeeder.js
backend/src/scripts/backfillCommunicationReviewConfig.js
backend/src/jobs/redactExpiredCommunicationStressTests.js
backend/src/services/communicationReviewProvider.js
backend/src/services/communicationReviewPromptBuilder.js
backend/src/utils/communicationReviewInputGuard.js
backend/src/utils/communicationFrictionScoring.js
backend/src/middleware/communicationStressTestRateLimit.js
backend/tests/communicationReview/
```

### New frontend files (5)

```
frontend/src/components/communication/CommunicationReviewDialog.jsx
frontend/src/components/communication/FrictionScoreCard.jsx
frontend/src/components/communication/PersonaReactionCard.jsx
frontend/src/components/communication/RewriteComparison.jsx
frontend/src/lib/communicationStressApi.js
```

### Modified files (9)

| File | Phase | Change |
|---|---|---|
| [`server.js`](file:///e:/Team-Kratos/backend/src/server.js) | 1 | +1 route mount |
| [`permissions.js`](file:///e:/Team-Kratos/frontend/src/lib/permissions.js) | 1 | +4 switch cases |
| [`cacheManager.js`](file:///e:/Team-Kratos/backend/src/config/cacheManager.js) | 1 | Export `getRedisHealth()` |
| [`schema.prisma`](file:///e:/Team-Kratos/backend/prisma/schema.prisma) | 2 | +5 models, +3 enums, relations |
| [`authController.js`](file:///e:/Team-Kratos/backend/src/controllers/authController.js) | 2 | +2 lines: seeder call |
| [`superadminController.js`](file:///e:/Team-Kratos/backend/src/controllers/superadminController.js) | 2 | +2 lines: seeder call |
| [`cronJobs.js`](file:///e:/Team-Kratos/backend/src/workers/cronJobs.js) | 2 | Register redaction cron |
| [`EngagementHub.jsx`](file:///e:/Team-Kratos/frontend/src/pages/EngagementHub.jsx) | 5 | Stress-test button + manager review |
| [`announcementController.js`](file:///e:/Team-Kratos/backend/src/controllers/announcementController.js) | 5 | Accept/validate stress-test linkage |

---

## 24. Verification Matrix

| Area | Required verification |
|---|---|
| Permissions | Owner, HR Admin, Manager, Employee, configured custom role, stale UI vs server denial |
| Tenant isolation | Cross-tenant test/detail/retest/event/persona/announcement-link IDs; no existence disclosure |
| Migration | Blank DB, production-like DB, repeated backfill, both tenant creation paths |
| Seeding | Three personas per tenant, no `tenantId=null`, repeated upsert |
| Input validation | Empty/large input, invalid enums, client score/model/persona injection |
| DLP | Bank/ID/OTP/medical/sensitive cases |
| Prompt injection | Instruction override attempts, prompt exfiltration |
| Provider | Valid JSON, invalid JSON, missing/extra persona, bad enum, unsupported evidence |
| Timeout | Near-12s response, repair budget, 20s hard failure |
| Scoring | Every severity/type mapping, dimension caps, uplift rules, deterministic snapshots |
| Rewrite | New date/amount/approval/staffing/policy/guarantee detection |
| Idempotency | Same key replay, changed payload conflict, concurrent requests |
| Redis | Outage, TTL, counters, in-flight lock |
| Audit | Creation fail-closed, completion retry, no raw payload in logs |
| Retention | Dry-run, actual redaction, deletion request |
| Announcement | Original/rewrite/edit-rewrite match, expiry, reuse, wrong user/tenant |
| UI/a11y | Draft preservation, error/retry, keyboard, focus, screen reader, responsive, reduced motion |
| E2E | Full scenario: composer → API → DB → result → rewrite → authorized publication |

---

## 25. Observability and Alerts

### Metrics

- Tests started/completed/failed/incomplete
- Rewrite applied/dismissed
- Re-test rate and score-delta
- P50/P95 latency
- Provider cost/token estimate
- Parse repair rate, DLP block rate, rate-limit rate
- Redis health, audit failures, retention job counts
- Cross-tenant denial anomalies

### Alert thresholds

| Signal | Threshold | Action |
|---|---|---|
| Provider/parse failures | >5% / 30 min | Investigate; disable flag if sustained |
| P95 latency | >12s / 30 min | Investigate provider/concurrency |
| Redis unavailable | Any production failure | Fail closed, alert platform owner |
| Boundary bypass | Any | Disable feature, security incident |
| Harmful/fabricated output | Any | Disable flag, triage, patch before re-enable |

---

## 26. Rollback

1. Disable tenant `CommunicationReviewConfig.enabled`, or set global `COMMUNICATION_STRESS_TEST_ENABLED=false`
2. Existing unreviewed announcement publishing remains fully operational
3. Do **not** delete review/audit records during rollback
4. Ship forward fix/migration; re-enable only after relevant phase exit gate passes

---

## 27. Definition of Ready to Code

Phase 1 can begin when:

- [ ] `COMMUNICATION_STRESS_TEST_ENABLED=false` globally
- [ ] `COMMUNICATION_STRESS_TEST_HASH_KEY` is a 32-byte-or-stronger secret
- [ ] Beta Redis instance and `REDIS_URL` exist
- [ ] Gemini model configured and verified against structured fixture
- [ ] Provider credentials configured securely
- [ ] Product owner named
- [ ] HR owner named
- [ ] Engineering owner named
- [ ] Security/Privacy owner named
- [ ] On-call owner named
- [ ] Beta tenant selected

---

## 28. Verification Commands

```bash
# Phase 1 — Permission middleware
cd backend && npx jest tests/communicationReview/requirePermission.test.js

# Phase 2 — Migration
cd backend && npx prisma migrate dev --name communication_stress_test
cd backend && npx prisma migrate status

# Phase 2 — Backfill
cd backend && node src/scripts/backfillCommunicationReviewConfig.js

# Phase 3 — Scoring snapshots
cd backend && npx jest tests/communicationReview/scoring.test.js

# Phase 3 — Input guard
cd backend && npx jest tests/communicationReview/inputGuard.test.js

# Phase 4 — Rate limit integration
cd backend && REDIS_URL=redis://localhost:6379 npx jest tests/communicationReview/rateLimit.test.js

# Phase 5 — Full scenario test
curl -s -X POST http://localhost:5000/api/communication-stress-tests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"sourceType":"ANNOUNCEMENT","title":"Sprint delivery update","category":"Urgent","message":"The sprint deadline is moving from Friday to tomorrow morning. Everyone needs to stay online tonight."}' \
  | jq '.frictionBand, .overallFrictionScore'
# Expected: "HIGH" or "CRITICAL", score >= 60
```

---

## 29. Dependency Graph

```mermaid
flowchart TD
  P0["Phase 0<br/>Preflight & Fixtures"] --> P1
  P1["Phase 1<br/>Permission + Config"] --> P2
  P2["Phase 2<br/>Prisma + Seeding"] --> P3
  P3["Phase 3<br/>AI Provider + Scoring"] --> P4
  P4["Phase 4<br/>Rate Limits + Security"] --> P5
  P5["Phase 5<br/>Engagement Hub UI"] --> P6
  P6["Phase 6<br/>Pilot Beta"] --> P7
  P6 --> P9["Phase 9<br/>Streaming (if needed)"]
  P7["Phase 7<br/>Personas & Trends"] --> P8["Phase 8<br/>Policy Context"]
  P6 --> P10["Phase 10<br/>Transcripts"]

  style P0 fill:#f3e8ff,stroke:#7c3aed
  style P1 fill:#dbeafe,stroke:#2563eb
  style P2 fill:#dbeafe,stroke:#2563eb
  style P3 fill:#dbeafe,stroke:#2563eb
  style P4 fill:#dbeafe,stroke:#2563eb
  style P5 fill:#d1fae5,stroke:#059669
  style P6 fill:#fef3c7,stroke:#d97706
  style P7 fill:#e5e7eb,stroke:#6b7280
  style P8 fill:#e5e7eb,stroke:#6b7280
  style P9 fill:#e5e7eb,stroke:#6b7280
  style P10 fill:#e5e7eb,stroke:#6b7280
```

---

## 30. Final Implementation Rule

```
Human draft
    ↓
Auth + Tenant + Permission
    ↓
DLP/Input Guard
    ↓
Versioned Prompt
    ↓
Gemini
    ↓
Schema + Evidence + Rewrite Validation
    ↓
Deterministic SCORING_V1
    ↓
Human Review
    ↓
Human Choice
    ↓
Existing Publish/Send Flow
```

**Core product contract:** AI proposes. Server validates and scores. Human decides.
