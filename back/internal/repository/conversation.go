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
	Create(ctx context.Context, initiatorID, recipientID int64, peer, peerGender string) (domain.Conversation, error)
	ListForUser(ctx context.Context, userID int64) ([]domain.Conversation, error)
	ListHiddenForUser(ctx context.Context, userID int64) ([]domain.Conversation, error)
	GetByID(ctx context.Context, id, userID int64) (domain.Conversation, error)
	MarkRead(ctx context.Context, conversationID, userID int64) error
	HideForUser(ctx context.Context, conversationID, userID int64) error
	UnhideForUser(ctx context.Context, conversationID, userID int64) error
	DismissForUser(ctx context.Context, conversationID, userID int64) error
	ClearDismissed(ctx context.Context, conversationID, userID int64) error
	InboxState(ctx context.Context, conversationID, userID int64) (bool, bool, error)
	HistoryFloor(ctx context.Context, conversationID, userID int64) (int64, error)
	BumpHistoryFloor(ctx context.Context, conversationID, userID int64) error
}

func NewConversationRepository() *ConversationRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}
	return &ConversationRepository{db: pool}
}

func (r *ConversationRepository) Close() {
	r.db.Close()
}

const conversationPeerColumns = `c.id, p.id, p.username, p.gender, c.created_at`

const conversationPeerJoin = `
	JOIN users p ON p.id = CASE WHEN c.initiator_id = $1 THEN c.recipient_id ELSE c.initiator_id END`

func (r *ConversationRepository) FindPair(ctx context.Context, userA, userB int64) (domain.Conversation, error) {
	var c domain.Conversation
	err := r.db.QueryRow(ctx, `
		SELECT `+conversationPeerColumns+`
		FROM conversations c
		`+conversationPeerJoin+`
		WHERE LEAST(c.initiator_id, c.recipient_id) = LEAST($1::bigint, $2::bigint)
		  AND GREATEST(c.initiator_id, c.recipient_id) = GREATEST($1::bigint, $2::bigint)
	`, userA, userB).Scan(&c.ID, &c.PeerID, &c.Peer, &c.PeerGender, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Conversation{}, ErrNotFound
		}
		return domain.Conversation{}, err
	}
	return c, nil
}

func (r *ConversationRepository) Create(ctx context.Context, initiatorID, recipientID int64, peer, peerGender string) (domain.Conversation, error) {
	c := domain.Conversation{PeerID: recipientID, Peer: peer, PeerGender: peerGender}
	err := r.db.QueryRow(ctx, `
		INSERT INTO conversations (initiator_id, recipient_id)
		VALUES ($1, $2)
		RETURNING id, created_at
	`, initiatorID, recipientID).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return domain.Conversation{}, err
	}
	return c, nil
}

const conversationListSelect = `
		SELECT ` + conversationPeerColumns + `,
		       (
		         SELECT COUNT(*)::int
		         FROM messages m
		         WHERE m.conversation_id = c.id
		           AND m.user_id IS DISTINCT FROM $1
		           AND m.id > GREATEST(
		                 COALESCE(cr.last_read_message_id, 0),
		                 COALESCE((SELECT cc.after_message_id FROM conversation_clears cc WHERE cc.conversation_id = c.id AND cc.user_id = $1), 0)
		               )
		       )
		FROM conversations c
		` + conversationPeerJoin + `
		LEFT JOIN conversation_reads cr
		  ON cr.conversation_id = c.id AND cr.user_id = $1
		WHERE (c.initiator_id = $1 OR c.recipient_id = $1)
		  AND EXISTS (
		        SELECT 1 FROM messages msg
		        WHERE msg.conversation_id = c.id
		          AND msg.id > COALESCE((SELECT cc.after_message_id FROM conversation_clears cc WHERE cc.conversation_id = c.id AND cc.user_id = $1), 0)
		  )`

func (r *ConversationRepository) ListForUser(ctx context.Context, userID int64) ([]domain.Conversation, error) {
	return r.listConversations(ctx, userID, conversationListSelect+`
		  AND NOT EXISTS (
		        SELECT 1 FROM conversation_hidden h
		        WHERE h.conversation_id = c.id AND h.user_id = $1
		  )
		  AND NOT EXISTS (
		        SELECT 1 FROM conversation_dismissed d
		        WHERE d.conversation_id = c.id AND d.user_id = $1
		  )
		ORDER BY c.created_at DESC`)
}

func (r *ConversationRepository) ListHiddenForUser(ctx context.Context, userID int64) ([]domain.Conversation, error) {
	return r.listConversations(ctx, userID, conversationListSelect+`
		  AND EXISTS (
		        SELECT 1 FROM conversation_hidden h
		        WHERE h.conversation_id = c.id AND h.user_id = $1
		  )
		  AND NOT EXISTS (
		        SELECT 1 FROM conversation_dismissed d
		        WHERE d.conversation_id = c.id AND d.user_id = $1
		  )
		ORDER BY c.created_at DESC`)
}

func (r *ConversationRepository) listConversations(ctx context.Context, userID int64, query string) ([]domain.Conversation, error) {
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.Conversation, 0)
	for rows.Next() {
		var c domain.Conversation
		if err := rows.Scan(&c.ID, &c.PeerID, &c.Peer, &c.PeerGender, &c.CreatedAt, &c.UnreadCount); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (r *ConversationRepository) GetByID(ctx context.Context, id, userID int64) (domain.Conversation, error) {
	var c domain.Conversation
	err := r.db.QueryRow(ctx, `
		SELECT `+conversationPeerColumns+`
		FROM conversations c
		`+conversationPeerJoin+`
		WHERE c.id = $2
		  AND (c.initiator_id = $1 OR c.recipient_id = $1)
	`, userID, id).Scan(&c.ID, &c.PeerID, &c.Peer, &c.PeerGender, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Conversation{}, ErrNotFound
		}
		return domain.Conversation{}, err
	}
	return c, nil
}

func (r *ConversationRepository) HideForUser(ctx context.Context, conversationID, userID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO conversation_hidden (conversation_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (conversation_id, user_id) DO NOTHING
	`, conversationID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM conversation_dismissed
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ConversationRepository) UnhideForUser(ctx context.Context, conversationID, userID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM conversation_hidden
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	return err
}

func (r *ConversationRepository) HistoryFloor(ctx context.Context, conversationID, userID int64) (int64, error) {
	var floor int64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(after_message_id, 0)
		FROM conversation_clears
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID).Scan(&floor)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return floor, nil
}

func (r *ConversationRepository) BumpHistoryFloor(ctx context.Context, conversationID, userID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO conversation_clears (conversation_id, user_id, after_message_id)
		VALUES (
			$1,
			$2,
			COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = $1), 0)
		)
		ON CONFLICT (conversation_id, user_id)
		DO UPDATE SET after_message_id = EXCLUDED.after_message_id
	`, conversationID, userID)
	return err
}

func (r *ConversationRepository) DismissForUser(ctx context.Context, conversationID, userID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO conversation_dismissed (conversation_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (conversation_id, user_id) DO NOTHING
	`, conversationID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM conversation_hidden
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ConversationRepository) ClearDismissed(ctx context.Context, conversationID, userID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM conversation_dismissed
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	return err
}

func (r *ConversationRepository) InboxState(ctx context.Context, conversationID, userID int64) (bool, bool, error) {
	var hidden, dismissed bool
	err := r.db.QueryRow(ctx, `
		SELECT
			EXISTS (
				SELECT 1 FROM conversation_hidden
				WHERE conversation_id = $1 AND user_id = $2
			),
			EXISTS (
				SELECT 1 FROM conversation_dismissed
				WHERE conversation_id = $1 AND user_id = $2
			)
	`, conversationID, userID).Scan(&hidden, &dismissed)
	if err != nil {
		return false, false, err
	}
	return hidden, dismissed, nil
}

func (r *ConversationRepository) MarkRead(ctx context.Context, conversationID, userID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id)
		VALUES (
			$1,
			$2,
			COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = $1), 0)
		)
		ON CONFLICT (conversation_id, user_id)
		DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id
	`, conversationID, userID)
	return err
}
