package repository

import (
	"context"
	"errors"
	"log"
	"os"
	"slices"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepository struct {
	db *pgxpool.Pool
}

type MessageRepo interface {
	ListPage(ctx context.Context, conversationID int64, beforeID *int64, limit int) ([]domain.Message, error)
	GetByID(ctx context.Context, id int64) (domain.Message, int64, error)
	Create(ctx context.Context, conversationID, userID int64, username, text string, replyToID *int64) (domain.Message, error)
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

func (r *MessageRepository) Close() {
	r.db.Close()
}

const messageColumns = `
	m.id, m.user_id, COALESCE(mu.username, m.username), m.message_content, m.created_at,
	rm.id, COALESCE(ru.username, rm.username), rm.message_content`

const messageJoins = `
	LEFT JOIN users mu ON mu.id = m.user_id
	LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
	LEFT JOIN users ru ON ru.id = rm.user_id`

func scanMessage(row pgx.Row, extra ...any) (domain.Message, error) {
	var m domain.Message
	var replyID *int64
	var replyFrom, replyText *string
	dest := append([]any{
		&m.ID, &m.UserID, &m.From, &m.Text, &m.CreatedAt,
		&replyID, &replyFrom, &replyText,
	}, extra...)
	if err := row.Scan(dest...); err != nil {
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

func (r *MessageRepository) ListPage(ctx context.Context, conversationID int64, beforeID *int64, limit int) ([]domain.Message, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+messageColumns+`
		FROM messages m
		`+messageJoins+`
		WHERE m.conversation_id = $1
		  AND ($2::bigint IS NULL OR m.id < $2)
		ORDER BY m.id DESC
		LIMIT $3
	`, conversationID, beforeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]domain.Message, 0, limit)
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	slices.Reverse(messages)
	return messages, nil
}

func (r *MessageRepository) GetByID(ctx context.Context, id int64) (domain.Message, int64, error) {
	var conversationID *int64
	m, err := scanMessage(r.db.QueryRow(ctx, `
		SELECT `+messageColumns+`, m.conversation_id
		FROM messages m
		`+messageJoins+`
		WHERE m.id = $1
	`, id), &conversationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, 0, ErrNotFound
		}
		return domain.Message{}, 0, err
	}
	if conversationID == nil {
		return m, 0, nil
	}
	return m, *conversationID, nil
}

func (r *MessageRepository) Create(ctx context.Context, conversationID, userID int64, username, text string, replyToID *int64) (domain.Message, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		INSERT INTO messages (user_id, username, message_content, conversation_id, reply_to_message_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, userID, username, text, conversationID, replyToID).Scan(&id)
	if err != nil {
		return domain.Message{}, err
	}
	m, _, err := r.GetByID(ctx, id)
	return m, err
}

func (r *MessageRepository) UpdateText(ctx context.Context, id int64, text string) (domain.Message, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE messages SET message_content = $2 WHERE id = $1
	`, id, text)
	if err != nil {
		return domain.Message{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.Message{}, ErrNotFound
	}
	m, _, err := r.GetByID(ctx, id)
	return m, err
}
