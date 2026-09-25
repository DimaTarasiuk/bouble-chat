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
	Create(ctx context.Context, conversationID int64, from string, text string, replyToID *int64) (domain.Message, error)
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

func scanMessageWithReply(row pgx.Row) (domain.Message, error) {
	var m domain.Message
	var replyID *int64
	var replyFrom, replyText *string
	err := row.Scan(
		&m.ID, &m.From, &m.Text, &m.CreatedAt,
		&replyID, &replyFrom, &replyText,
	)
	if err != nil {
		return domain.Message{}, err
	}
	if replyID != nil && replyFrom != nil && replyText != nil {
		m.ReplyTo = &domain.ReplyPreview{
			ID:   *replyID,
			From: *replyFrom,
			Text: *replyText,
		}
	}
	return m, nil
}

func (r *MessageRepository) GetByConversation(ctx context.Context, conversationID int64) ([]domain.Message, error) {
	messages := make([]domain.Message, 0)
	sql := `SELECT m.id, m.username, m.message_content, m.created_at,
	               r.id, r.username, r.message_content
			FROM messages m
			LEFT JOIN messages r ON r.id = m.reply_to_message_id
			WHERE m.conversation_id = $1
			ORDER BY m.created_at ASC, m.id ASC
			LIMIT 1000`

	rows, err := r.db.Query(ctx, sql, conversationID)
	if err != nil {
		log.Printf("Issue with query GetByConversation %v", err)
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		m, err := scanMessageWithReply(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func (r *MessageRepository) Create(ctx context.Context, conversationID int64, from string, text string, replyToID *int64) (domain.Message, error) {
	m, err := scanMessageWithReply(r.db.QueryRow(ctx, `
		INSERT INTO messages (username, message_content, conversation_id, reply_to_message_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, message_content, created_at,
		          (SELECT id FROM messages WHERE id = $4),
		          (SELECT username FROM messages WHERE id = $4),
		          (SELECT message_content FROM messages WHERE id = $4)
	`, from, text, conversationID, replyToID))
	return m, err
}

func (r *MessageRepository) GetByID(ctx context.Context, id int64) (domain.Message, int64, error) {
	var m domain.Message
	var conversationID int64
	var replyID *int64
	var replyFrom, replyText *string
	err := r.db.QueryRow(ctx, `
		SELECT m.id, m.username, m.message_content, m.created_at, m.conversation_id,
		       r.id, r.username, r.message_content
		FROM messages m
		LEFT JOIN messages r ON r.id = m.reply_to_message_id
		WHERE m.id = $1
	`, id).Scan(
		&m.ID, &m.From, &m.Text, &m.CreatedAt, &conversationID,
		&replyID, &replyFrom, &replyText,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, 0, ErrNotFound
		}
		return domain.Message{}, 0, err
	}
	if replyID != nil && replyFrom != nil && replyText != nil {
		m.ReplyTo = &domain.ReplyPreview{
			ID:   *replyID,
			From: *replyFrom,
			Text: *replyText,
		}
	}
	return m, conversationID, nil
}

func (r *MessageRepository) UpdateText(ctx context.Context, id int64, text string) (domain.Message, error) {
	m, err := scanMessageWithReply(r.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE messages
			SET message_content = $2
			WHERE id = $1
			RETURNING id, username, message_content, created_at, reply_to_message_id
		)
		SELECT u.id, u.username, u.message_content, u.created_at,
		       r.id, r.username, r.message_content
		FROM updated u
		LEFT JOIN messages r ON r.id = u.reply_to_message_id
	`, id, text))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, ErrNotFound
		}
		return domain.Message{}, err
	}
	return m, nil
}
