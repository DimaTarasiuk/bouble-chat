# Chat App

Real-time chat application built with Go backend and React frontend.

## Stack

**Backend**
- Go 1.25
- chi — HTTP router
- gorilla/websocket — WebSocket
- pgx/v5 — PostgreSQL driver
- goose — database migrations
- godotenv — environment variables
- golang-jwt — JWT after registration
- golang.org/x/crypto/bcrypt — password hashing

**Frontend**
- React + Vite

**Infrastructure**
- PostgreSQL 16 (Docker, local)
- Neon Postgres (production)
- Render Web Service (production)

## Project Structure

```
chat/
├── render.yaml            # Render Blueprint
├── back/
│   ├── api/cmd/           # entry point
│   ├── internal/
│   │   ├── domain/        # entities
│   │   ├── repository/    # database layer
│   │   ├── service/       # business logic
│   │   └── handler/       # HTTP + WebSocket handlers
│   ├── pkg/jwt/           # JWT generate / parse
│   ├── pkg/ws/            # WebSocket hub
│   ├── db/migrations/     # SQL migrations
│   ├── docker-compose.yml
│   └── Makefile
└── front/                 # React frontend
```

## Auth

The app shows **login** by default, with a switch to **registration**.

Registration fields:

- Login
- Password
- Password confirmation

Login fields:

- Login
- Password

`POST /api/register` creates the user, hashes the password with bcrypt, and returns a JWT.  
`POST /api/login` checks the password and returns a JWT.

The token is stored in `localStorage` and sent on later requests. **Вийти** in the chat header clears the session on the client (no server-side logout).

Protected endpoints:

- `GET /api/users?q=` — search users by login
- `GET /api/conversations` and `POST /api/conversations` — private chats
- `GET /api/conversations/{id}/messages` and `POST /api/conversations/{id}/messages`
- `GET /ws?token=&conversation_id=` — events for that chat only

There is **no global room**. After login you search a user by login and open a 1:1 chat. The message author is taken from the JWT.

## Getting Started

### Prerequisites

- Go 1.25+
- Docker
- Node.js 20+
- goose (`go install github.com/pressly/goose/v3/cmd/goose@latest`)

### Setup

**1. Clone and configure**

```bash
cp back/.env.dev back/.env
```

Edit `back/.env` and set `JWT_SECRET`.

**2. Start the database**

```bash
make db-up
```

**3. Run migrations**

```bash
make migrate-up
```

**4. Start the backend**

```bash
make run
```

**5. Start the frontend**

```bash
cd front
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy: Render + Neon

The production deployment uses one Render Web Service:

- the Docker image builds the React frontend;
- the Go server serves both the frontend and API from one domain;
- WebSocket uses the same HTTPS domain (`wss://`);
- migrations run automatically before every server start;
- PostgreSQL is hosted separately on Neon.

### 1. Create the Neon project

In the Neon project creation screen:

1. Choose **PostgreSQL 18**.
2. Choose a region close to Render. This repository uses Render `frankfurt`, so select an AWS Frankfurt / `eu-central-1` Neon region if it is available.
3. Create the project. The default database and role are suitable.

Open **Connect** in the Neon dashboard and copy two connection strings:

- **Pooled connection** (hostname contains `-pooler`) → Render `DATABASE_URL`.
- **Direct connection** (hostname does not contain `-pooler`) → Render `DATABASE_MIGRATION_URL`.

Keep `sslmode=require` in both URLs. Do not commit either URL to Git.

The application uses the pooled URL during normal operation. Goose uses the direct URL for schema migrations.

### 2. Push the repository

Render deploys from a Git repository, so push the project to GitHub or GitLab, including `render.yaml`.

### 3. Create the Render Blueprint

1. Open the Render dashboard.
2. Click **New → Blueprint**.
3. Connect the repository.
4. Render reads `render.yaml` and creates the `bouble-chat` web service.
5. When Render asks for environment variables, enter:
   - `DATABASE_URL` — the Neon **pooled** URL.
   - `DATABASE_MIGRATION_URL` — the Neon **direct** URL.
6. `JWT_SECRET` is generated automatically by Render.
7. Click **Apply** and wait for the deploy.

The container applies every migration from `back/db/migrations`, starts the API on Render's `PORT`, and serves the built frontend. No separate Render Static Site is required.

After deployment:

- open the generated `https://...onrender.com` URL;
- check `https://...onrender.com/health` — it should return `{"status":"ok"}`;
- register two users and test a private chat.

### Free tier limitations

- A free Render Web Service sleeps after inactivity. The first request after sleep can take some time.
- Sleeping or redeploying disconnects active WebSockets; the browser reconnects when a chat is opened again.
- Neon can also suspend an idle compute and wake it on the next database request.
- The local Docker database is not copied to Neon. Production starts with an empty database after migrations.

### Production environment variables

| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | yes | Neon pooled connection URL |
| `DATABASE_MIGRATION_URL` | recommended | Neon direct connection URL |
| `JWT_SECRET` | yes | Generated by Render |
| `PORT` | automatic | Supplied by Render |
| `FRONTEND_URL` | no | Only needed if the frontend is later hosted separately |

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | no | Register a user |
| POST | `/api/login` | no | Log in |
| GET | `/api/users?q=` | Bearer | Search users by login |
| GET | `/api/conversations` | Bearer | List my private chats |
| POST | `/api/conversations` | Bearer | Find or create a 1:1 chat |
| GET | `/api/conversations/{id}/messages` | Bearer | Messages in a chat |
| POST | `/api/conversations/{id}/messages` | Bearer | Send a private message |
| GET | `/ws` | `?token=&conversation_id=` | WebSocket for that chat |

### POST /api/register

Request:
```json
{
  "username": "ivan",
  "password": "1234",
  "password_confirm": "1234"
}
```

Response `201`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "ivan",
    "created_at": "2026-09-21T17:14:55+03:00"
  }
}
```

Errors:

| Status | `error` |
|--------|---------|
| 400 | `login and password required` |
| 400 | `passwords do not match` |
| 409 | `username already taken` |

### POST /api/login

Request:
```json
{
  "username": "ivan",
  "password": "1234"
}
```

Response `200` — same JSON as register (`token` + `user`).

Errors:

| Status | `error` |
|--------|---------|
| 400 | `login and password required` |
| 401 | `invalid credentials` |

### GET /api/users?q=

Requires `Authorization: Bearer <token>`. Returns users whose login starts with `q`, excluding yourself.

### POST /api/conversations

Requires `Authorization: Bearer <token>`.

Request:
```json
{
  "username": "ivan"
}
```

Response `200` — existing or newly created chat:

```json
{
  "id": 1,
  "peer": "ivan",
  "created_at": "2026-09-21T17:40:00+03:00"
}
```

### POST /api/conversations/{id}/messages

Requires `Authorization: Bearer <token>` and membership in that chat.

Request:
```json
{
  "text": "Hello!"
}
```

Response `201`:
```json
{
  "id": 1,
  "from": "ivan",
  "text": "Hello!",
  "time": "2026-05-05T13:00:00+03:00"
}
```

`from` comes from the token.

## Makefile Commands

```bash
make run          # run the server
make build        # build binary
make db-up        # start PostgreSQL
make db-down      # stop PostgreSQL
make migrate-up   # apply migrations
make migrate-down # rollback last migration
make tidy         # go mod tidy
```
