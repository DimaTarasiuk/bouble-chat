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
- PostgreSQL 16 (Docker)

## Project Structure

```
chat/
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

- `GET /api/messages` and `POST /api/messages` — header `Authorization: Bearer <token>`
- `GET /ws` — query `?token=<token>` (browser WebSocket cannot set headers)

The message author is taken from the JWT, not from the request body.

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

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | no | Register a user |
| POST | `/api/login` | no | Log in |
| GET | `/api/messages` | Bearer | Get all messages |
| POST | `/api/messages` | Bearer | Send a message |
| GET | `/ws` | `?token=` | WebSocket connection |

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

### POST /api/messages

Requires `Authorization: Bearer <token>`.

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
