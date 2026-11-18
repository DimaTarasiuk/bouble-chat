package repository

import (
	"context"
	"errors"
	"log"
	"os"
	"slices"
	"time"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// randomMatchLockKey serializes matchmaking so two guests that enqueue at the
// same moment always see each other instead of both skipping and waiting.
const randomMatchLockKey = 7_100_001

type RandomRepository struct {
	db *pgxpool.Pool
}

type RandomRepo interface {
	CreateGuest(ctx context.Context, prefs domain.RandomPrefs) (domain.RandomGuest, error)
	GetGuest(ctx context.Context, id string) (domain.RandomGuest, error)
	Enqueue(ctx context.Context, guest domain.RandomGuest) (*domain.RandomGuest, int64, error)
	Dequeue(ctx context.Context, guestID string) error
	PruneQueue(ctx context.Context, keep []string, queuedBefore time.Time) error
	ActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error)
	EndActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error)
	CreateMessage(ctx context.Context, sessionID int64, fromGuest, text string) (domain.RandomMessage, error)
	ListMessages(ctx context.Context, sessionID int64, limit int) ([]domain.RandomMessage, error)
}

func NewRandomRepository() *RandomRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("Unable to ping DB -> %v", err)
	}

	return &RandomRepository{db: pool}
}

func (r *RandomRepository) Close() {
	r.db.Close()
}

const guestColumns = `g.id::text, g.gender, g.age_min, g.age_max, g.seek_gender, g.seek_age_min, g.seek_age_max, g.created_at`

func scanGuest(row pgx.Row) (domain.RandomGuest, error) {
	var g domain.RandomGuest
	err := row.Scan(&g.ID, &g.Gender, &g.AgeMin, &g.AgeMax, &g.SeekGender, &g.SeekAgeMin, &g.SeekAgeMax, &g.CreatedAt)
	return g, err
}

func (r *RandomRepository) CreateGuest(ctx context.Context, p domain.RandomPrefs) (domain.RandomGuest, error) {
	return scanGuest(r.db.QueryRow(ctx, `
		INSERT INTO random.guests AS g (gender, age_min, age_max, seek_gender, seek_age_min, seek_age_max)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+guestColumns,
		p.Gender, p.AgeMin, p.AgeMax, p.SeekGender, p.SeekAgeMin, p.SeekAgeMax))
}

func (r *RandomRepository) GetGuest(ctx context.Context, id string) (domain.RandomGuest, error) {
	g, err := scanGuest(r.db.QueryRow(ctx, `
		SELECT `+guestColumns+` FROM random.guests g WHERE g.id = $1::uuid
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RandomGuest{}, ErrNotFound
	}
	return g, err
}

// Enqueue puts the guest into the queue and tries to pair it with the oldest
// mutually compatible waiting guest. It returns the peer and the new session
// ID on a match, or (nil, 0) when the guest is left waiting. If someone else
// already matched this guest, the existing active session is returned.
func (r *RandomRepository) Enqueue(ctx context.Context, g domain.RandomGuest) (*domain.RandomGuest, int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, randomMatchLockKey); err != nil {
		return nil, 0, err
	}

	var activeID int64
	var peerID string
	err = tx.QueryRow(ctx, `
		SELECT id, CASE WHEN guest_a = $1::uuid THEN guest_b::text ELSE guest_a::text END
		FROM random.sessions
		WHERE status = 'active' AND (guest_a = $1::uuid OR guest_b = $1::uuid)
	`, g.ID).Scan(&activeID, &peerID)
	switch {
	case err == nil:
		peer, err := scanGuest(tx.QueryRow(ctx, `SELECT `+guestColumns+` FROM random.guests g WHERE g.id = $1::uuid`, peerID))
		if err != nil {
			return nil, 0, err
		}
		return &peer, activeID, tx.Commit(ctx)
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, 0, err
	}

	peer, err := scanGuest(tx.QueryRow(ctx, `
		SELECT `+guestColumns+`
		FROM random.queue q
		JOIN random.guests g ON g.id = q.guest_id
		WHERE q.guest_id <> $1::uuid
		  AND ($2 = 'any' OR g.gender = $2)
		  AND g.age_min <= $4 AND g.age_max >= $3
		  AND (g.seek_gender = 'any' OR g.seek_gender = $5)
		  AND $6 <= g.seek_age_max AND $7 >= g.seek_age_min
		ORDER BY q.created_at
		LIMIT 1
	`, g.ID, g.SeekGender, g.SeekAgeMin, g.SeekAgeMax, g.Gender, g.AgeMin, g.AgeMax))
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO random.queue (guest_id) VALUES ($1::uuid) ON CONFLICT (guest_id) DO NOTHING
		`, g.ID); err != nil {
			return nil, 0, err
		}
		return nil, 0, tx.Commit(ctx)
	}
	if err != nil {
		return nil, 0, err
	}

	var sessionID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO random.sessions (guest_a, guest_b) VALUES ($1::uuid, $2::uuid) RETURNING id
	`, peer.ID, g.ID).Scan(&sessionID); err != nil {
		return nil, 0, err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM random.queue WHERE guest_id IN ($1::uuid, $2::uuid)
	`, peer.ID, g.ID); err != nil {
		return nil, 0, err
	}
	return &peer, sessionID, tx.Commit(ctx)
}

func (r *RandomRepository) Dequeue(ctx context.Context, guestID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM random.queue WHERE guest_id = $1::uuid`, guestID)
	return err
}

// PruneQueue removes guests queued before queuedBefore that are not in keep.
func (r *RandomRepository) PruneQueue(ctx context.Context, keep []string, queuedBefore time.Time) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM random.queue
		WHERE created_at < $2 AND NOT (guest_id::text = ANY($1::text[]))
	`, keep, queuedBefore)
	return err
}

const sessionSelect = `
	SELECT s.id, s.status, s.created_at, p.id::text, p.gender, p.age_min, p.age_max
	FROM random.sessions s
	JOIN random.guests p ON p.id = CASE WHEN s.guest_a = $1::uuid THEN s.guest_b ELSE s.guest_a END`

func scanSession(row pgx.Row) (domain.RandomSession, error) {
	var s domain.RandomSession
	var ageMin, ageMax int
	err := row.Scan(&s.ID, &s.Status, &s.CreatedAt, &s.PeerID, &s.PeerGender, &ageMin, &ageMax)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RandomSession{}, ErrNotFound
	}
	if err != nil {
		return domain.RandomSession{}, err
	}
	s.PeerAge = domain.FormatAgeBand(ageMin, ageMax)
	return s, nil
}

func (r *RandomRepository) ActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error) {
	return scanSession(r.db.QueryRow(ctx, sessionSelect+`
		WHERE s.status = 'active' AND (s.guest_a = $1::uuid OR s.guest_b = $1::uuid)
	`, guestID))
}

func (r *RandomRepository) EndActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error) {
	return scanSession(r.db.QueryRow(ctx, `
		WITH s AS (
			UPDATE random.sessions
			SET status = 'ended', ended_at = NOW()
			WHERE status = 'active' AND (guest_a = $1::uuid OR guest_b = $1::uuid)
			RETURNING id, status, created_at, guest_a, guest_b
		)
		SELECT s.id, s.status, s.created_at, p.id::text, p.gender, p.age_min, p.age_max
		FROM s
		JOIN random.guests p ON p.id = CASE WHEN s.guest_a = $1::uuid THEN s.guest_b ELSE s.guest_a END
	`, guestID))
}

func (r *RandomRepository) CreateMessage(ctx context.Context, sessionID int64, fromGuest, text string) (domain.RandomMessage, error) {
	m := domain.RandomMessage{FromGuest: fromGuest, Text: text}
	err := r.db.QueryRow(ctx, `
		WITH m AS (
			INSERT INTO random.messages (session_id, from_guest, text)
			VALUES ($1, $2::uuid, $3)
			RETURNING id, from_guest, created_at
		), s AS (
			UPDATE random.sessions SET last_message_at = NOW() WHERE id = $1
		)
		SELECT m.id, g.gender, m.created_at
		FROM m JOIN random.guests g ON g.id = m.from_guest
	`, sessionID, fromGuest, text).Scan(&m.ID, &m.FromGender, &m.CreatedAt)
	return m, err
}

func (r *RandomRepository) ListMessages(ctx context.Context, sessionID int64, limit int) ([]domain.RandomMessage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT m.id, m.from_guest::text, g.gender, m.text, m.created_at
		FROM random.messages m
		JOIN random.guests g ON g.id = m.from_guest
		WHERE m.session_id = $1
		ORDER BY m.id DESC
		LIMIT $2
	`, sessionID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]domain.RandomMessage, 0, limit)
	for rows.Next() {
		var m domain.RandomMessage
		if err := rows.Scan(&m.ID, &m.FromGuest, &m.FromGender, &m.Text, &m.CreatedAt); err != nil {
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
