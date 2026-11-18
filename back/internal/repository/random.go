package repository

import (
	"context"
	"errors"
	"log"
	"os"
	"slices"
	"strconv"
	"time"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const randomMatchLockKey = 7_100_001

type RandomRepository struct {
	db *pgxpool.Pool
}

type RandomRepo interface {
	CreateGuest(ctx context.Context, prefs domain.RandomPrefs, anonID string) (domain.RandomGuest, error)
	GetGuest(ctx context.Context, id string) (domain.RandomGuest, error)
	Enqueue(ctx context.Context, guest domain.RandomGuest) (*domain.RandomGuest, int64, error)
	Dequeue(ctx context.Context, guestID string) error
	PruneQueue(ctx context.Context, keep []string, queuedBefore time.Time) error
	ActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error)
	EndActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error)
	CreateMessage(ctx context.Context, sessionID int64, fromGuest, text string, replyToID *int64) (domain.RandomMessage, error)
	GetMessage(ctx context.Context, id int64) (domain.RandomMessage, int64, error)
	ListMessages(ctx context.Context, sessionID int64, limit int) ([]domain.RandomMessage, error)
	ListSessionsAdmin(ctx context.Context, status string, limit int, beforeID int64) ([]domain.RandomSessionAdmin, error)
	GetSessionAdmin(ctx context.Context, id int64) (domain.RandomSessionAdmin, error)
	DeleteEndedSession(ctx context.Context, id int64) error
	DeleteAllEndedSessions(ctx context.Context) (int64, error)
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

const guestColumns = `g.id::text, g.anon_id::text, g.gender, g.age_min, g.age_max, g.seek_gender, g.seek_age_min, g.seek_age_max, g.created_at`

func scanGuest(row pgx.Row) (domain.RandomGuest, error) {
	var g domain.RandomGuest
	err := row.Scan(&g.ID, &g.AnonID, &g.Gender, &g.AgeMin, &g.AgeMax, &g.SeekGender, &g.SeekAgeMin, &g.SeekAgeMax, &g.CreatedAt)
	return g, err
}

func (r *RandomRepository) CreateGuest(ctx context.Context, p domain.RandomPrefs, anonID string) (domain.RandomGuest, error) {
	return scanGuest(r.db.QueryRow(ctx, `
		INSERT INTO random.guests AS g (anon_id, gender, age_min, age_max, seek_gender, seek_age_min, seek_age_max)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
		RETURNING `+guestColumns,
		anonID, p.Gender, p.AgeMin, p.AgeMax, p.SeekGender, p.SeekAgeMin, p.SeekAgeMax))
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

const randomMessageSelect = `
	SELECT m.id, m.session_id, m.from_guest::text, g.gender, m.text, m.created_at,
		rm.id, CASE WHEN rg.gender = 'female' THEN 'Вона' ELSE 'Він' END, rm.text
	FROM random.messages m
	JOIN random.guests g ON g.id = m.from_guest
	LEFT JOIN random.messages rm ON rm.id = m.reply_to_message_id
	LEFT JOIN random.guests rg ON rg.id = rm.from_guest`

func scanRandomMessage(scan interface {
	Scan(dest ...any) error
}) (domain.RandomMessage, int64, error) {
	var m domain.RandomMessage
	var sessionID int64
	var replyID *int64
	var replyFrom, replyText *string
	err := scan.Scan(
		&m.ID, &sessionID, &m.FromGuest, &m.FromGender, &m.Text, &m.CreatedAt,
		&replyID, &replyFrom, &replyText,
	)
	if err != nil {
		return domain.RandomMessage{}, 0, err
	}
	if replyID != nil && replyFrom != nil && replyText != nil {
		m.ReplyTo = &domain.ReplyPreview{ID: *replyID, From: *replyFrom, Text: *replyText}
	}
	return m, sessionID, nil
}

func (r *RandomRepository) CreateMessage(ctx context.Context, sessionID int64, fromGuest, text string, replyToID *int64) (domain.RandomMessage, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		WITH m AS (
			INSERT INTO random.messages (session_id, from_guest, text, reply_to_message_id)
			VALUES ($1, $2::uuid, $3, $4)
			RETURNING id
		), s AS (
			UPDATE random.sessions SET last_message_at = NOW() WHERE id = $1
		)
		SELECT id FROM m
	`, sessionID, fromGuest, text, replyToID).Scan(&id)
	if err != nil {
		return domain.RandomMessage{}, err
	}
	m, _, err := r.GetMessage(ctx, id)
	return m, err
}

func (r *RandomRepository) GetMessage(ctx context.Context, id int64) (domain.RandomMessage, int64, error) {
	m, sessionID, err := scanRandomMessage(r.db.QueryRow(ctx, randomMessageSelect+`
		WHERE m.id = $1
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RandomMessage{}, 0, ErrNotFound
	}
	return m, sessionID, err
}

func (r *RandomRepository) ListMessages(ctx context.Context, sessionID int64, limit int) ([]domain.RandomMessage, error) {
	rows, err := r.db.Query(ctx, randomMessageSelect+`
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
		m, _, err := scanRandomMessage(rows)
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

const randomSessionAdminSelect = `
	SELECT s.id, s.status, s.created_at, s.ended_at, s.last_message_at,
		a.id::text, a.anon_id::text, a.gender, a.age_min, a.age_max,
		b.id::text, b.anon_id::text, b.gender, b.age_min, b.age_max,
		COALESCE((SELECT COUNT(*) FROM random.messages m WHERE m.session_id = s.id), 0),
		COALESCE((
			SELECT m.text FROM random.messages m
			WHERE m.session_id = s.id
			ORDER BY m.id DESC LIMIT 1
		), '')
	FROM random.sessions s
	JOIN random.guests a ON a.id = s.guest_a
	JOIN random.guests b ON b.id = s.guest_b`

func scanSessionAdmin(scan interface {
	Scan(dest ...any) error
}) (domain.RandomSessionAdmin, error) {
	var s domain.RandomSessionAdmin
	var aMin, aMax, bMin, bMax int
	err := scan.Scan(
		&s.ID, &s.Status, &s.CreatedAt, &s.EndedAt, &s.LastMessageAt,
		&s.GuestA.ID, &s.GuestA.AnonID, &s.GuestA.Gender, &aMin, &aMax,
		&s.GuestB.ID, &s.GuestB.AnonID, &s.GuestB.Gender, &bMin, &bMax,
		&s.MessageCount, &s.LastText,
	)
	if err != nil {
		return domain.RandomSessionAdmin{}, err
	}
	s.GuestA.Age = domain.FormatAgeBand(aMin, aMax)
	s.GuestB.Age = domain.FormatAgeBand(bMin, bMax)
	return s, nil
}

func (r *RandomRepository) ListSessionsAdmin(ctx context.Context, status string, limit int, beforeID int64) ([]domain.RandomSessionAdmin, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	args := []any{}
	where := `WHERE 1=1`
	if status == domain.RandomSessionActive || status == domain.RandomSessionEnded {
		args = append(args, status)
		where += ` AND s.status = $` + strconv.Itoa(len(args))
	}
	if beforeID > 0 {
		args = append(args, beforeID)
		where += ` AND s.id < $` + strconv.Itoa(len(args))
	}
	args = append(args, limit)
	rows, err := r.db.Query(ctx, randomSessionAdminSelect+`
		`+where+`
		ORDER BY COALESCE(s.last_message_at, s.created_at) DESC, s.id DESC
		LIMIT $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.RandomSessionAdmin, 0, limit)
	for rows.Next() {
		s, err := scanSessionAdmin(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *RandomRepository) GetSessionAdmin(ctx context.Context, id int64) (domain.RandomSessionAdmin, error) {
	s, err := scanSessionAdmin(r.db.QueryRow(ctx, randomSessionAdminSelect+`
		WHERE s.id = $1
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RandomSessionAdmin{}, ErrNotFound
	}
	return s, err
}

func (r *RandomRepository) cleanupOrphanGuests(ctx context.Context, guestIDs ...string) {
	for _, id := range guestIDs {
		if id == "" {
			continue
		}
		_, _ = r.db.Exec(ctx, `
			DELETE FROM random.guests g
			WHERE g.id = $1::uuid
			  AND NOT EXISTS (
				SELECT 1 FROM random.sessions s
				WHERE s.guest_a = g.id OR s.guest_b = g.id
			  )
			  AND NOT EXISTS (
				SELECT 1 FROM random.queue q WHERE q.guest_id = g.id
			  )
		`, id)
	}
}

func (r *RandomRepository) DeleteEndedSession(ctx context.Context, id int64) error {
	var guestA, guestB string
	err := r.db.QueryRow(ctx, `
		DELETE FROM random.sessions
		WHERE id = $1 AND status = 'ended'
		RETURNING guest_a::text, guest_b::text
	`, id).Scan(&guestA, &guestB)
	if errors.Is(err, pgx.ErrNoRows) {
		var status string
		err2 := r.db.QueryRow(ctx, `SELECT status FROM random.sessions WHERE id = $1`, id).Scan(&status)
		if errors.Is(err2, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err2 != nil {
			return err2
		}
		return ErrConflict
	}
	if err != nil {
		return err
	}
	r.cleanupOrphanGuests(ctx, guestA, guestB)
	return nil
}

func (r *RandomRepository) DeleteAllEndedSessions(ctx context.Context) (int64, error) {
	rows, err := r.db.Query(ctx, `
		DELETE FROM random.sessions
		WHERE status = 'ended'
		RETURNING guest_a::text, guest_b::text
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	seen := make(map[string]struct{})
	var n int64
	for rows.Next() {
		var a, b string
		if err := rows.Scan(&a, &b); err != nil {
			return n, err
		}
		n++
		seen[a] = struct{}{}
		seen[b] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return n, err
	}
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	r.cleanupOrphanGuests(ctx, ids...)
	return n, nil
}
