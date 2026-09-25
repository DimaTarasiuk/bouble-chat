package repository

import (
	"context"
	"errors"
	"log"
	"os"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepository struct {
	db *pgxpool.Pool
}

type MessageRepo interface {
	GetByConversation(ctx context.Context, conversationID int64) ([]domain.Message, error)
	GetByID(ctx context.Context, id int64) (domain.Message, int64, error)
	Create(ctx context.Context, conversationID int64, from string, text string) (domain.Message, error)
	UpdateText(ctx context.Context, id int64, text string) (domain.Message, error)
}

func NewMessageRepository() *MessageRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}

	err = pool.Ping(context.Background())
	if err != nil {
		log.Fatalf("Unable to ping DB -> %v", err)
	}
	log.Printf("Ping of Postgres is successful")

	return &MessageRepository{
		db: pool,
	}
}

func (r *MessageRepository) GetByConversation(ctx context.Context, conversationID int64) ([]domain.Message, error) {
	messages := make([]domain.Message, 0)
	sql := `SELECT id, username, message_content, created_at
			FROM messages
			WHERE conversation_id = $1
			ORDER BY created_at ASC, id ASC
			LIMIT 1000`

	rows, err := r.db.Query(ctx, sql, conversationID)
	if err != nil {
		log.Printf("Issue with query GetByConversation %v", err)
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.ID, &m.From, &m.Text, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func (r *MessageRepository) Create(ctx context.Context, conversationID int64, from string, text string) (domain.Message, error) {
	var m domain.Message
	createQuery := `INSERT INTO messages (username, message_content, conversation_id)
					VALUES ($1, $2, $3)
					RETURNING id, username, message_content, created_at`
	err := r.db.QueryRow(ctx, createQuery, from, text, conversationID).Scan(
		&m.ID, &m.From, &m.Text, &m.CreatedAt,
	)
	return m, err
}

func (r *MessageRepository) GetByID(ctx context.Context, id int64) (domain.Message, int64, error) {
	var m domain.Message
	var conversationID int64
	err := r.db.QueryRow(ctx, `
		SELECT id, username, message_content, created_at, conversation_id
		FROM messages
		WHERE id = $1
	`, id).Scan(&m.ID, &m.From, &m.Text, &m.CreatedAt, &conversationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, 0, ErrNotFound
		}
		return domain.Message{}, 0, err
	}
	return m, conversationID, nil
}

func (r *MessageRepository) UpdateText(ctx context.Context, id int64, text string) (domain.Message, error) {
	var m domain.Message
	err := r.db.QueryRow(ctx, `
		UPDATE messages
		SET message_content = $2
		WHERE id = $1
		RETURNING id, username, message_content, created_at
	`, id, text).Scan(&m.ID, &m.From, &m.Text, &m.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, ErrNotFound
		}
		return domain.Message{}, err
	}
	return m, nil
}
