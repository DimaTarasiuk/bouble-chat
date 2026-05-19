include .env
export

BINARY=chat-backend

.PHONY: run build db-up db-down migrate-up migrate-down tidy

run-back:
	go run ./cmd/api/...

build:
	go build -o bin/$(BINARY) ./cmd/api/...

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

migrate-up:
	goose -dir db/migrations postgres "host=${DB_HOST} port=${DB_PORT_EXTERNAL} user=${DB_USER} password=${DB_PASSWORD} dbname=${DB_NAME} sslmode=${DB_SSLMODE}" up

migrate-down:
	goose -dir db/migrations postgres "host=${DB_HOST} port=${DB_PORT_EXTERNAL} user=${DB_USER} password=${DB_PASSWORD} dbname=${DB_NAME} sslmode=${DB_SSLMODE}" down

tidy:
	go mod tidy

run:
	npm run dev --prefix ../front &
	go run ./api/cmd/main.go