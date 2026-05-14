<div align="center">
  <br />
  <a href="https://www.freecustom.email">
    <img src="https://www.freecustom.email/logo.webp" alt="FreeCustom.Email" width="72" />
  </a>
  <br />
  <br />

  <h1>FCE Discord Bot</h1>

  <p><b>Disposable inboxes, OTP extraction, and real-time email delivery — right inside Discord.</b></p>

  <p>
    One command to get an inbox. One command to read OTPs.<br />
    Real-time email alerts via WebSocket. Full API access without leaving Discord.
  </p>

  <br />

  <p>
    <a href="https://discord.com/oauth2/authorize?client_id=1504547278679969812"><strong>→ Add to Server</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://www.freecustom.email/api/discord"><strong>Bot Page</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://www.freecustom.email/api/docs"><strong>API Docs</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://www.freecustom.email/api/pricing"><strong>API Pricing</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://discord.com/invite/Ztp7kT2QBz"><strong>Support Server</strong></a>
  </p>

  <br />

  <p>
    <a href="https://github.com/DishIs/fce-discord-bot/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/DishIs/fce-discord-bot?style=for-the-badge" alt="License" />
    </a>
    <a href="https://github.com/DishIs/fce-discord-bot/stargazers">
      <img src="https://img.shields.io/github/stars/DishIs/fce-discord-bot?style=for-the-badge" alt="Stars" />
    </a>
    <a href="https://github.com/DishIs/fce-discord-bot/issues">
      <img src="https://img.shields.io/github/issues/DishIs/fce-discord-bot?style=for-the-badge" alt="Issues" />
    </a>
    <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js v14" />
  </p>

  <br />
  <br />
</div>

---

## What is this?

The FCE Discord Bot brings the full [FreeCustom.Email API](https://www.freecustom.email/api) to Discord as slash commands. No terminal required. Works for complete beginners who just want a quick disposable inbox, and for power users who want real-time WebSocket alerts, OTP extraction, timeline analysis, and delivery insights — all without leaving Discord.

```
/quickstart          →  Instant inbox + real-time watch in one command
/otp <inbox>         →  Extract the latest OTP from any inbox
/watch start <inbox> →  Get a Discord message the moment an email arrives
/plans               →  Browse and upgrade API plans with one click
```

The bot mirrors the [fce-cli](https://github.com/DishIs/fce-cli) experience exactly — same login flow, same inbox commands, same API surface — but inside Discord.

---

## Commands

### Getting Started
| Command | Description | Plan |
|---|---|---|
| `/login` | Connect your FreeCustom.Email account via browser | Any |
| `/logout` | Disconnect your account | Any |
| `/quickstart` | Register inbox + start watching in one command | Any |
| `/guide` | Step-by-step onboarding walkthrough | Any |
| `/help` | Full command reference | Any |

### Inbox & Messages
| Command | Description | Plan |
|---|---|---|
| `/inbox list` | List all registered inboxes | Any |
| `/inbox add [address]` | Register a new inbox (auto-generates if blank) | Any |
| `/inbox remove <address>` | Unregister an inbox | Any |
| `/messages <inbox>` | List recent emails | Any |
| `/read <inbox> <id>` | Open a specific message | Any |
| `/domains` | List available email domains | Any |

### Power Features
| Command | Description | Plan |
|---|---|---|
| `/otp <inbox>` | Get the latest OTP code | Developer+ |
| `/watch start <inbox>` | Real-time email alerts in this channel | Startup+ |
| `/watch stop <inbox>` | Stop watching | Startup+ |
| `/watch list` | Active watches | Any |
| `/timeline <inbox>` | Email delivery event timeline | Growth+ |
| `/insights <inbox>` | Delivery health and failure analysis | Growth+ |

### Account & Billing
| Command | Description | Plan |
|---|---|---|
| `/status` | Plan, credits, inbox counts | Any |
| `/usage` | Request consumption this month | Any |
| `/plans` | Compare all API plans with upgrade buttons | Any |
| `/me` | Raw API account data | Any |
| `/format json` | Toggle JSON output mode | Any |

### Support
| Command | Description |
|---|---|
| `/support` | Submit a support ticket (replied to via Discord DM) |
| `/feedback` | Leave a star rating and comment |
| `/ping` | Check bot and WebSocket latency |

---

## How Login Works

The bot uses the same browser-based OAuth flow as `fce-cli`:

1. User runs `/login`
2. Bot generates a one-time state token (stored in Redis + Postgres with 3-minute TTL)
3. Bot sends a private "Login" button linking to `https://www.freecustom.email/api/cli-auth?callback=https://bot.freecustom.email/auth/callback&state=<uuid>`
4. User clicks → authenticates in browser → FCE site redirects to the bot's callback server with `?api_key=<key>&state=<uuid>`
5. Callback server validates the state, stores the API key, DMs the user "✓ Logged in"

No passwords ever touch Discord. The API key is stored encrypted in Postgres, never in Discord messages.

---

## Architecture

```
Discord Gateway (discord.js v14)
        │
        ├─ Slash commands → commands/*.ts
        ├─ Button interactions (inbox confirm, feedback stars)
        └─ Modal submissions (support, feedback comment)
                │
                ├─ lib/api.ts      → FCE REST API (api2.freecustom.email/v1)
                ├─ lib/store.ts    → Prisma (Postgres) + ioredis
                ├─ lib/embed.ts    → All Discord embed builders
                └─ lib/upsell.ts   → Plan gate + API error handling

Express HTTP server (:4242)
        ├─ GET  /auth/callback   → OAuth login flow completion
        ├─ GET  /admin/feedback  → Admin: read feedback rows (password-protected)
        └─ GET  /health          → Docker health check

WebSocket pool (handlers/watch-manager.ts)
        └─ One WS conn per (apiKey, inbox) → delivers email → Discord channel
```

### Stack
- **Runtime** — Node.js 22, TypeScript
- **Discord** — discord.js v14
- **Database** — PostgreSQL via Prisma (shared with fce-backend)
- **Cache / Login state** — Redis via ioredis
- **Real-time** — WebSocket client (`ws`) connecting to FCE's streaming API
- **HTTP server** — Express (auth callback + admin endpoints)
- **Hosting** — Docker, deployed on the same server as fce-backend

---

## Self-Hosting

### Prerequisites

- Node.js 22+
- PostgreSQL (can reuse the fce-backend instance)
- Redis (can reuse the fce-backend instance)
- A Discord bot application ([create one here](https://discord.com/developers/applications))
- An nginx reverse proxy pointing `bot.freecustom.email` → `localhost:4242`

### 1. Create the Discord Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Name it `FreeCustom.Email` (or your own name)
3. Go to **Bot** tab → **Reset Token** → copy the token
4. Enable **Message Content Intent** if needed
5. Under **OAuth2 → General**, add your redirect URL: `https://bot.yourdomain.com/auth/callback`

### 2. Generate the Invite Link

In **OAuth2 → URL Generator**:
- Scopes: ✅ `bot` ✅ `applications.commands`
- Bot permissions: ✅ Send Messages · ✅ Embed Links · ✅ Read Message History · ✅ Use Slash Commands · ✅ Send Messages in Threads · ✅ Attach Files

Copy the generated URL — share it to invite the bot to any server.

### 3. Configure

```bash
git clone https://github.com/DishIs/fce-discord-bot.git
cd fce-discord-bot
cp .env.example .env
```

Fill in `.env`:

```bash
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id

FCE_API_BASE=https://api2.freecustom.email/v1
FCE_CLI_AUTH_URL=https://www.freecustom.email/api/cli-auth
CALLBACK_BASE_URL=https://bot.yourdomain.com
CALLBACK_PORT=4242

DATABASE_URL=postgresql://user:pass@localhost:5432/fce_discord_bot
REDIS_URL=redis://localhost:6379

ADMIN_PASSWORD=strong_secret_here   # must match fce-frontend ADMIN_PASSWORD
FEEDBACK_TRIGGER_COUNT=15
```

### 4. Start with Docker (recommended)

Add the bot service to your existing `docker-compose.yml` using `docker/docker-compose.yml` as reference, then:

```bash
docker compose up -d fce-discord-bot
```

The container automatically runs `prisma migrate deploy` on startup.

### 5. Register Slash Commands

Run this once after the bot is up:

```bash
npm run deploy-commands
```

### 6. Manual setup (no Docker)

```bash
npm install
npm run build
npx prisma migrate deploy
npm run deploy-commands
npm start
```

---

## Publishing the Bot on Discord

### Under 100 servers (no verification needed)

By default the bot is **private** — only servers you manually invite via the OAuth link can add it. This is fine for self-hosting.

To make it **public** (anyone can add it):
1. In the Developer Portal → **Bot** tab → turn on **Public Bot**
2. Share your invite URL

### Over 100 servers → Discord Verification required

Once a public bot reaches 100 servers, Discord requires **bot verification**:

1. In the Developer Portal → **App Testers** / **Bot Verification** tab → **Apply for Verification**
2. Fill out the form: describe what the bot does, how it uses each permission, provide support server + privacy policy links
3. Discord reviews (usually 3–5 business days)
4. After approval, the bot can join unlimited servers

The FCE bot's privacy policy URL: `https://www.freecustom.email/privacy`
Support server: `https://discord.com/invite/Ztp7kT2QBz`

---

## Development

```bash
npm install
npm run dev        # runs ts-node src/index.ts directly
npm run build      # compiles TypeScript to dist/
npm start          # runs dist/index.js
npm run deploy-commands   # registers slash commands with Discord
```

### Environment for dev

Set `DISCORD_GUILD_ID` to your dev server ID — commands register instantly to a single guild during development instead of the global 1-hour propagation delay.

---

## Related Repositories

| Repo | Description |
|---|---|
| [fce-frontend](https://github.com/DishIs/fce-frontend) | Next.js web app — deployed on Cloudflare Workers |
| [fce-backend](https://github.com/DishIs/fce-backend) | Cloudflare Workers backend, WebSocket, SMTP pipeline |
| [fce-cli](https://github.com/DishIs/fce-cli) | Terminal CLI — the bot mirrors its commands exactly |
| [fce-sdk](https://github.com/DishIs/fce-sdk) | TypeScript/Python SDK for the FCE API |

---

## Should This Be Open Source?

Yes — same as `fce-cli` and `fce-sdk`. The bot itself is a client of the API; open-sourcing it:
- Builds community trust (users can audit how their API keys are stored)
- Invites contributions (translations, new commands, bug fixes)
- Serves as a reference implementation for anyone building Discord integrations with FCE

The API keys and backend are not exposed. **License: Apache 2.0.**

---

## Contributing

Contributions welcome — bug fixes, new commands, translations, docs. Please open an issue before a large PR.

**Translations:** Add a new file at `src/i18n/<locale>.json` (copy `en.json` as template) and register it in `src/i18n/index.ts`.

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for full terms.

---

<div align="center">
  <br />
  <p>Built and maintained by <a href="https://dishis.tech"><b>DishIs Technologies</b></a></p>
  <p>
    <a href="https://www.freecustom.email">freecustom.email</a>
    &nbsp;·&nbsp;
    <a href="https://discord.com/invite/Ztp7kT2QBz">Discord</a>
    &nbsp;·&nbsp;
    <a href="mailto:dishant@dishis.tech">dishant@dishis.tech</a>
  </p>
  <br />
</div>
