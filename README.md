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
**Frontend**
- React + Vite
**Infrastructure**
- PostgreSQL 16 (Docker)
## Project Structure
 
```
chat/
├── back/
│   ├── cmd/api/           # entry point
│   ├── internal/
│   │   ├── domain/        # entities
│   │   ├── repository/    # database layer
│   │   ├── service/       # business logic
│   │   └── handler/       # HTTP + WebSocket handlers
│   ├── pkg/ws/            # WebSocket hub
│   ├── db/migrations/     # SQL migrations
│   ├── docker-compose.yml
│   └── Makefile
└── front/                 # React frontend
```
 
## Getting Started
 
### Prerequisites
 
- Go 1.25+
- Docker
- Node.js 20+
- goose (`go install github.com/pressly/goose/v3/cmd/goose@latest`)
### Setup
 
**1. Clone and configure**
 
```bash
cp .env.example .env
```
 
Edit `.env` with your values.
 
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
 
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | Get all messages |
| POST | `/api/messages` | Send a message |
| GET | `/ws` | WebSocket connection |
 
### POST /api/messages
 
Request:
```json
{
  "from": "username",
  "text": "Hello!"
}
```
 
Response `201`:
```json
{
  "id": 1,
  "from": "username",
  "text": "Hello!",
  "time": "2026-05-05T13:00:00+03:00"
}
```
 
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
