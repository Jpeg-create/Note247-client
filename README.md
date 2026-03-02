# Note247

> A privacy-first, real-time collaborative document editor with end-to-end encryption — built for writers, developers, and teams who take data ownership seriously.

<br />

## Live Demo

**[note247.app](https://note247.app)** — no account required to try it.

<br />

## Overview

Note247 is a full-stack web application that lets users create, edit, and share documents in real time. Every document created by a registered user is **encrypted in the browser before it leaves the device** — the server stores only ciphertext and can never read your notes.

The project covers the full spectrum: cryptography, WebSocket infrastructure, REST API design, relational database modelling, CI/CD, and a production React frontend — all built and maintained as a solo project.

<br />

## Key Features

- **End-to-End Encryption** — AES-256-GCM encryption with PBKDF2 key derivation (310,000 iterations, OWASP 2024 recommended). Keys never leave the browser.
- **Real-Time Collaboration** — Multiple users can edit the same document simultaneously via Socket.io rooms. Live collaborator avatars, cursor presence, and instant sync.
- **Secure Share Links** — Per-document encryption keys embedded in the URL hash (`#k=...`). The hash is never sent to the server, so sharing the link shares the key — and nothing else.
- **Account Recovery** — 24-word recovery phrase (BIP39-style wordlist) generated at signup. If a user forgets their password, they can unwrap their encryption key using the recovery phrase and set a new password without losing any data.
- **AI Writing Assistant** — Streaming AI chat and text rewrite actions (improve, summarise, translate, fix code, explain) powered by Claude Haiku, with full document context.
- **Document Organisation** — Folders with custom colours, drag-to-move, and a search across all documents.
- **Version History** — Every save creates a version snapshot. Users can browse and restore any previous version of a document.
- **Multi-Language Code Editor** — CodeMirror-powered code editor with syntax highlighting for 15+ languages, plus a rich text editor and Markdown preview mode.
- **Guest Mode** — Visitors can create up to 5 documents without an account. Guest sessions are tracked server-side with rate limiting.
- **Password-Protected Documents** — Optional bcrypt-hashed document passwords for an extra layer of access control on top of encryption.

<br />

## Architecture

```
┌─────────────────────┐        HTTPS / WSS        ┌──────────────────────────┐
│   React + Vite      │ ◄────────────────────────► │  Node.js + Express       │
│   (Vercel)          │                            │  + Socket.io (Railway)   │
│                     │                            │                          │
│  WebCrypto API      │                            │  JWT Auth                │
│  AES-256-GCM        │                            │  Rate Limiting           │
│  PBKDF2 (310k)      │                            │  Helmet Security Headers │
│  In-browser only    │                            │  Socket.io Rooms         │
└─────────────────────┘                            └──────────┬───────────────┘
                                                              │
                                                              │ SQL (TLS)
                                                              ▼
                                                   ┌──────────────────────────┐
                                                   │  PostgreSQL              │
                                                   │  (Supabase)              │
                                                   │                          │
                                                   │  Stores ciphertext only  │
                                                   │  Server cannot decrypt   │
                                                   └──────────────────────────┘
```

<br />

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.io | Real-time WebSocket collaboration |
| PostgreSQL (Supabase) | Persistent storage |
| `node-postgres` (pg) | Database client with connection pooling |
| JSON Web Tokens (JWT) | Stateless authentication — HS256 |
| bcryptjs | Password hashing (cost factor 12) |
| express-rate-limit | Per-route and per-user rate limiting |
| Helmet.js | HTTP security headers |
| Anthropic SDK | Claude Haiku AI streaming |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework and build tooling |
| WebCrypto API | Native browser cryptography — zero dependencies |
| Socket.io Client | Real-time collaboration |
| CodeMirror 6 | Code editor with syntax highlighting |
| React Router v6 | Client-side routing |
| Axios | HTTP client with interceptors |

### Infrastructure
| Service | Role |
|---|---|
| Railway | Node.js server hosting |
| Vercel | React frontend hosting + edge CDN |
| Supabase | Managed PostgreSQL + connection pooler |

<br />

## Encryption Design

The E2EE implementation uses the browser's native **WebCrypto API** exclusively — no third-party crypto libraries.

```
Signup flow:
  password + keySalt ──PBKDF2 (310k iterations)──► encryptionKey (AES-256-GCM)
  recoveryWords + recoverySalt ──PBKDF2──► backupKey
  encryptionKey ──AES-GCM wrap──► wrappedKey (stored on server)

  Document content:
  plaintext ──AES-256-GCM (encryptionKey)──► ciphertext (stored on server)

Share link flow:
  generateKey() ──► docKey (random AES-256-GCM key)
  docKey ──base64url──► URL hash (#k=...)  [never sent to server]
  content ──AES-256-GCM (docKey)──► ciphertext (stored on server)
  recipient imports docKey from URL hash, decrypts locally
```

The server stores: ciphertext, wrapped key, salts. It has none of the keys required to decrypt any of it.

<br />

## Real-Time Collaboration

Real-time sync is built on a **pub/sub room model** using Socket.io:

1. Every document has a `shortId` that becomes the socket room name
2. On open, clients emit `join-doc` — the server verifies access, registers the socket in the room, and broadcasts the collaborator list
3. Keystrokes emit `doc-change` events — the server fans out to all other sockets in the room (`socket.to(room).emit(...)`)
4. HTTP saves (Ctrl+S / autosave) also broadcast via the socket layer so viewers stay synced even if their socket briefly dropped
5. On disconnect, the server removes the user from the room and broadcasts the updated collaborator list

Content flowing through the socket is encrypted ciphertext. The server is a relay — it never reads document content.

<br />

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/salt` | Fetch key derivation salt for an email |
| `POST` | `/api/auth/signup` | Register — accepts encryption setup data |
| `POST` | `/api/auth/login` | Login — returns JWT |
| `GET` | `/api/auth/me` | Verify token, return user profile |
| `GET` | `/api/auth/recovery-data` | Fetch wrapped key for account recovery |
| `POST` | `/api/auth/recover` | Reset password using recovery phrase |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/docs` | Create document |
| `GET` | `/api/docs` | List user's documents |
| `GET` | `/api/docs/search` | Search documents by title |
| `GET` | `/api/docs/:shortId` | Fetch document (with password header support) |
| `PUT` | `/api/docs/:shortId` | Save document |
| `DELETE` | `/api/docs/:shortId` | Delete document |
| `GET` | `/api/docs/:shortId/versions` | List version history |
| `GET` | `/api/docs/:shortId/versions/:versionId` | Fetch specific version |

### Folders, AI, Users
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/folders` | List / create folders |
| `PUT` | `/api/folders/:id` | Rename or recolour folder |
| `DELETE` | `/api/folders/:id` | Delete folder (docs become unfiled) |
| `PUT` | `/api/folders/assign/:shortId` | Move document to folder |
| `POST` | `/api/ai/chat` | Streaming AI chat with doc context |
| `POST` | `/api/ai/rewrite` | AI text transformation actions |
| `GET` | `/api/users/:username` | Public user profile |
| `GET` | `/health` | Server health + version |
| `GET` | `/health/db` | Database connectivity check |

<br />

## Security

- **JWT authentication** with HS256 algorithm guard — algorithm confusion attacks prevented
- **CORS** locked to exact production origin only — localhost allowed only in development
- **Helmet.js** sets `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, and more
- **Rate limiting** layered per route:
  - Global: 300 req/min
  - Auth routes: 20 req/15 min
  - Recovery data: 5 req/15 min per IP (returns sensitive wrapped key)
  - Account recovery: 3 req/hour per email (prevents brute-force resets)
  - AI routes: 20 req/min per user (keyed by user ID, not IP)
- **bcrypt** for password hashing (cost factor 12)
- **Parameterised SQL queries** throughout — no string interpolation, no SQL injection surface
- **Input validation** with `express-validator` on all mutation endpoints
- **Socket write authorisation** — every socket is checked against the DB before being granted write access to a room

<br />

## Project Structure

```
note247-server/
├── db/
│   ├── index.js          # Connection pool, IPv4 forcing, SSL config
│   ├── schema.sql        # Full database schema
│   └── migration.sql     # Incremental migrations
├── middleware/
│   ├── auth.js           # JWT verification + optional auth
│   └── guestLimit.js     # Guest session tracking + doc limit enforcement
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── documents.js      # Document CRUD + version history
│   ├── folders.js        # Folder management
│   ├── ai.js             # AI chat + rewrite (streaming)
│   └── users.js          # Public user profiles
├── socket/
│   └── collaboration.js  # Socket.io rooms, write auth, presence
└── index.js              # Server bootstrap, CORS, rate limiters, routes

note247-client/
├── src/
│   ├── context/
│   │   └── AuthContext.jsx      # Auth state, login/signup/recover flows, session key management
│   ├── hooks/
│   │   ├── useSocket.js         # Socket.io connection with ref-based callbacks
│   │   ├── useEncryption.js     # Reactive encrypt/decrypt bound to session key
│   │   └── useGuestSession.js   # Guest doc tracking in localStorage
│   ├── utils/
│   │   ├── crypto.js            # WebCrypto: AES-GCM, PBKDF2, key wrap/unwrap, recovery phrase
│   │   └── api.js               # Axios instance with auth interceptors + 30s timeout
│   ├── pages/
│   │   ├── Editor.jsx           # Main editor — tabs, autosave, collab, share, versions, AI
│   │   └── Dashboard.jsx        # Document list, folders, search, templates
│   └── components/
│       ├── RichTextEditor.jsx   # Contenteditable rich text editor
│       ├── CodeMirrorEditor.jsx # CodeMirror 6 code editor
│       ├── ShareModal.jsx       # Share link generation with E2EE key in hash
│       ├── AIChatSidebar.jsx    # Streaming AI chat panel
│       └── VersionsModal.jsx    # Version history browser + restore
```

<br />

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase free tier works)
- Anthropic API key (optional — AI features only)

### Server Setup

```bash
git clone https://github.com/yourusername/note247-server
cd note247-server
npm install
cp .env.example .env
# Fill in .env values (see below)
npm start
```

**Server environment variables:**
```env
DATABASE_URL=postgresql://...
DATABASE_POOLER_URL=postgresql://...   # Supabase pooler for serverless
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend.vercel.app
ANTHROPIC_API_KEY=sk-ant-...           # Optional
NODE_ENV=production
PG_FORCE_IPV4=true                     # Required for Railway
PGSSL=true
PORT=4000
```

### Client Setup

```bash
git clone https://github.com/yourusername/note247-client
cd note247-client
npm install
cp .env.example .env
# Fill in .env values
npm run dev
```

**Client environment variables:**
```env
VITE_API_URL=https://your-server.railway.app/api
VITE_SOCKET_URL=https://your-server.railway.app
VITE_GUEST_DOC_LIMIT=5
```

<br />

## Deployment

| Service | Config |
|---|---|
| **Railway** (server) | Auto-deploys from GitHub. Set env vars in dashboard. `Procfile` included. |
| **Vercel** (client) | Auto-deploys from GitHub. Set `VITE_*` env vars in project settings. |
| **Supabase** (database) | Create a free project, copy `DATABASE_URL` and pooler URL from connection settings. |

The database schema is auto-created on first server boot — no manual migration step required.

<br />

## Design Decisions

**Why WebCrypto instead of a library like libsodium?**
WebCrypto is built into every modern browser — no bundle size cost, no supply chain risk, hardware-accelerated. The tradeoff is a verbose API, which is abstracted in `utils/crypto.js`.

**Why PBKDF2 over Argon2?**
Argon2 is not available in the WebCrypto API. PBKDF2 at 310,000 iterations with SHA-256 is the current OWASP recommendation for browser-side key derivation where Argon2 is unavailable.

**Why put the doc key in the URL hash?**
The hash fragment is never included in HTTP requests to the server. It exists only in the browser. This means the decryption key for a shared document is mathematically guaranteed to never be logged by the server, CDN, or any proxy — regardless of HTTPS.

**Why Socket.io over raw WebSockets?**
Transport negotiation (polling → WebSocket upgrade) ensures the app works in environments that block raw WebSocket connections. The reconnection logic and room abstraction are also production-grade out of the box.

**Why last-write-wins instead of OT/CRDT?**
OT (Google Docs) and CRDTs (Yjs/Automerge) are significantly more complex to implement correctly, especially combined with E2EE where the server cannot inspect operations. Last-write-wins over Socket.io with autosave every few seconds is appropriate for the current use case. CRDT migration (Yjs) is the planned next step for true conflict-free concurrent editing.

<br />

## Roadmap

- [ ] CRDT-based conflict resolution (Yjs) for true concurrent editing without last-write-wins
- [ ] Redis adapter for horizontal scaling of Socket.io rooms across multiple server instances
- [ ] Per-user AI usage quotas and a usage dashboard
- [ ] Document comments and annotation layer
- [ ] Mobile app (React Native, reusing the crypto and API layers)
- [ ] WebRTC peer-to-peer mode for direct device-to-device collaboration without routing through the server

<br />

## Author

**jpeg** — Full-stack engineer.

Built Note247 end-to-end: system architecture, cryptography implementation, real-time infrastructure, database design, UI/UX, DevOps, and security hardening.

- GitHub: [Jpeg](https://github.com/Jpeg-create)


<br />

## License

