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

type ConversationRepository struct {
	db *pgxpool.Pool
}

type ConversationRepo interface {
	FindPair(ctx context.Context, userA, userB int64) (domain.Conversation, error)
	Create(ctx context.Context, initiatorID, recipientID int64, peer string) (domain.Conversation, error)
	ListForUser(ctx context.Context, userID int64) ([]domain.Conversation, error)
	GetByID(ctx context.Context, id, userID int64) (domain.Conversation, error)
}

func NewConversationRepository() *ConversationRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}
	return &ConversationRepository{db: pool}
}

func (r *ConversationRepository) FindPair(ctx context.Context, userA, userB int64) (domain.Conversation, error) {
	var c domain.Conversation
	q := `SELECT c.id,
				 CASE WHEN c.initiator_id = $1 THEN u_rec.username ELSE u_ini.username END,
				 c.created_at
		  FROM conversations c
		  JOIN users u_ini ON u_ini.id = c.initiator_id
		  JOIN users u_rec ON u_rec.id = c.recipient_id
		  WHERE LEAST(c.initiator_id, c.recipient_id) = LEAST($1::bigint, $2::bigint)
		    AND GREATEST(c.initiator_id, c.recipient_id) = GREATEST($1::bigint, $2::bigint)`
	err := r.db.QueryRow(ctx, q, userA, userB).Scan(&c.ID, &c.Peer, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Conversation{}, ErrNotFound
		}
		return domain.Conversation{}, err
	}
	return c, nil
}

func (r *ConversationRepository) Create(ctx context.Context, initiatorID, recipientID int64, peer string) (domain.Conversation, error) {
	var c domain.Conversation
	q := `INSERT INTO conversations (initiator_id, recipient_id)
		  VALUES ($1, $2)
		  RETURNING id, created_at`
	err := r.db.QueryRow(ctx, q, initiatorID, recipientID).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return domain.Conversation{}, err
	}
	c.Peer = peer
	return c, nil
}

func (r *ConversationRepository) ListForUser(ctx context.Context, userID int64) ([]domain.Conversation, error) {
	list := make([]domain.Conversation, 0)
	q := `SELECT c.id,
				 CASE WHEN c.initiator_id = $1 THEN u_rec.username ELSE u_ini.username END,
				 c.created_at
		  FROM conversations c
		  JOIN users u_ini ON u_ini.id = c.initiator_id
		  JOIN users u_rec ON u_rec.id = c.recipient_id
		  WHERE c.initiator_id = $1 OR c.recipient_id = $1
		  ORDER BY c.created_at DESC`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var c domain.Conversation
		if err := rows.Scan(&c.ID, &c.Peer, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (r *ConversationRepository) GetByID(ctx context.Context, id, userID int64) (domain.Conversation, error) {
	var c domain.Conversation
	q := `SELECT c.id,
				 CASE WHEN c.initiator_id = $2 THEN u_rec.username ELSE u_ini.username END,
				 c.created_at
		  FROM conversations c
		  JOIN users u_ini ON u_ini.id = c.initiator_id
		  JOIN users u_rec ON u_rec.id = c.recipient_id
		  WHERE c.id = $1
		    AND (c.initiator_id = $2 OR c.recipient_id = $2)`
	err := r.db.QueryRow(ctx, q, id, userID).Scan(&c.ID, &c.Peer, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Conversation{}, ErrNotFound
		}
		return domain.Conversation{}, err
	}
	return c, nil
}
