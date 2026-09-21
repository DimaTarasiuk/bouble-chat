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
