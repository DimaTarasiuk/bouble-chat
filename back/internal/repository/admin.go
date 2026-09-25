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

type AdminRepository struct {
	db *pgxpool.Pool
}

type AdminRepo interface {
	UserCounts(ctx context.Context, userID int64) (chats int, messages int, err error)
	Ban(ctx context.Context, userID int64, reason string) error
	Unban(ctx context.Context, userID int64) error
	RevokeSessions(ctx context.Context, userID int64) error

	Stats(ctx context.Context, onlineUserIDs []int64) (domain.Stats, error)
	InsertOnlineSnapshot(ctx context.Context, count int) error

	CreateAnnouncement(ctx context.Context, createdBy int64, text string) (domain.Announcement, error)
	ListAnnouncements(ctx context.Context, limit int) ([]domain.Announcement, error)
	PendingAnnouncements(ctx context.Context, userID int64) ([]domain.Announcement, error)
	AckAnnouncement(ctx context.Context, userID, announcementID int64) error

	CreateFeedback(ctx context.Context, userID int64, text string) (domain.Feedback, error)
	ListFeedback(ctx context.Context, limit int) ([]domain.Feedback, error)
	UnreadFeedbackCount(ctx context.Context, userID int64) (int, error)
	MarkFeedbackRead(ctx context.Context, userID, lastID int64) error
	HeadIDs(ctx context.Context) ([]int64, error)
}

func NewAdminRepository() *AdminRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}
	return &AdminRepository{db: pool}
}

func (r *AdminRepository) Close() {
	r.db.Close()
}

func (r *AdminRepository) UserCounts(ctx context.Context, userID int64) (int, int, error) {
	var chats, messages int
	err := r.db.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*)::int FROM conversations WHERE initiator_id = $1 OR recipient_id = $1),
		  (SELECT COUNT(*)::int FROM messages WHERE user_id = $1)
	`, userID).Scan(&chats, &messages)
	return chats, messages, err
}

func (r *AdminRepository) Ban(ctx context.Context, userID int64, reason string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users
		SET banned_at = NOW(), ban_reason = $2, sessions_revoked_at = NOW()
		WHERE id = $1
	`, userID, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AdminRepository) Unban(ctx context.Context, userID int64) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users
		SET banned_at = NULL, ban_reason = ''
		WHERE id = $1
	`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AdminRepository) RevokeSessions(ctx context.Context, userID int64) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users SET sessions_revoked_at = NOW() WHERE id = $1
	`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

const todayStartSQL = `(date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') AT TIME ZONE 'Europe/Kyiv')`

func (r *AdminRepository) Stats(ctx context.Context, onlineUserIDs []int64) (domain.Stats, error) {
	var s domain.Stats
	s.OnlineNow = len(onlineUserIDs)
	if onlineUserIDs == nil {
		onlineUserIDs = []int64{}
	}

	err := r.db.QueryRow(ctx, `
		SELECT
		  COUNT(*)::int,
		  COUNT(*) FILTER (WHERE created_at >= `+todayStartSQL+`)::int,
		  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int,
		  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int,
		  COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '24 hours' OR id = ANY($1))::int
		FROM users
	`, onlineUserIDs).Scan(
		&s.TotalUsers,
		&s.Registrations.Today, &s.Registrations.Week, &s.Registrations.Month,
		&s.DAU,
	)
	if err != nil {
		return domain.Stats{}, err
	}

	err = r.db.QueryRow(ctx, `
		SELECT
		  COUNT(*) FILTER (WHERE created_at >= `+todayStartSQL+`)::int,
		  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int,
		  COUNT(*)::int
		FROM messages
		WHERE created_at >= NOW() - INTERVAL '30 days'
	`).Scan(&s.Messages.Today, &s.Messages.Week, &s.Messages.Month)
	if err != nil {
		return domain.Stats{}, err
	}

	s.TopUsers = make([]domain.TopUser, 0)
	rows, err := r.db.Query(ctx, `
		SELECT u.username, COUNT(*)::int
		FROM messages m
		JOIN users u ON u.id = m.user_id
		WHERE m.created_at >= NOW() - INTERVAL '7 days'
		GROUP BY u.id, u.username
		ORDER BY 2 DESC, u.username
		LIMIT 10
	`)
	if err != nil {
		return domain.Stats{}, err
	}
	for rows.Next() {
		var t domain.TopUser
		if err := rows.Scan(&t.Username, &t.Messages); err != nil {
			rows.Close()
			return domain.Stats{}, err
		}
		s.TopUsers = append(s.TopUsers, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return domain.Stats{}, err
	}

	s.OnlineSeries = make([]domain.OnlinePoint, 0)
	rows, err = r.db.Query(ctx, `
		SELECT taken_at, online_count
		FROM online_snapshots
		WHERE taken_at >= NOW() - INTERVAL '24 hours'
		ORDER BY taken_at
	`)
	if err != nil {
		return domain.Stats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.OnlinePoint
		if err := rows.Scan(&p.At, &p.Count); err != nil {
			return domain.Stats{}, err
		}
		s.OnlineSeries = append(s.OnlineSeries, p)
	}
	return s, rows.Err()
}

func (r *AdminRepository) InsertOnlineSnapshot(ctx context.Context, count int) error {
	if _, err := r.db.Exec(ctx, `
		INSERT INTO online_snapshots (taken_at, online_count)
		VALUES (NOW(), $1)
		ON CONFLICT (taken_at) DO NOTHING
	`, count); err != nil {
		return err
	}
	_, err := r.db.Exec(ctx, `
		DELETE FROM online_snapshots WHERE taken_at < NOW() - INTERVAL '30 days'
	`)
	return err
}

func (r *AdminRepository) CreateAnnouncement(ctx context.Context, createdBy int64, text string) (domain.Announcement, error) {
	var a domain.Announcement
	err := r.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO announcements (text, created_by)
			VALUES ($2, $1)
			RETURNING id, text, created_by, created_at
		), acked AS (
			UPDATE users
			SET last_announcement_id = GREATEST(last_announcement_id, (SELECT id FROM inserted))
			WHERE id = $1
		)
		SELECT i.id, i.text, COALESCE(u.username, ''), i.created_at
		FROM inserted i
		LEFT JOIN users u ON u.id = i.created_by
	`, createdBy, text).Scan(&a.ID, &a.Text, &a.CreatedBy, &a.CreatedAt)
	return a, err
}

func (r *AdminRepository) ListAnnouncements(ctx context.Context, limit int) ([]domain.Announcement, error) {
	return r.queryAnnouncements(ctx, `
		SELECT a.id, a.text, COALESCE(u.username, ''), a.created_at
		FROM announcements a
		LEFT JOIN users u ON u.id = a.created_by
		ORDER BY a.id DESC
		LIMIT $1
	`, limit)
}

func (r *AdminRepository) PendingAnnouncements(ctx context.Context, userID int64) ([]domain.Announcement, error) {
	return r.queryAnnouncements(ctx, `
		SELECT a.id, a.text, COALESCE(c.username, ''), a.created_at
		FROM announcements a
		JOIN users me ON me.id = $1
		LEFT JOIN users c ON c.id = a.created_by
		WHERE a.id > me.last_announcement_id
		ORDER BY a.id
	`, userID)
}

func (r *AdminRepository) AckAnnouncement(ctx context.Context, userID, announcementID int64) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users
		SET last_announcement_id = GREATEST(last_announcement_id, $2)
		WHERE id = $1
		  AND EXISTS (SELECT 1 FROM announcements WHERE id = $2)
	`, userID, announcementID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AdminRepository) queryAnnouncements(ctx context.Context, q string, args ...any) ([]domain.Announcement, error) {
	list := make([]domain.Announcement, 0)
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var a domain.Announcement
		if err := rows.Scan(&a.ID, &a.Text, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (r *AdminRepository) CreateFeedback(ctx context.Context, userID int64, text string) (domain.Feedback, error) {
	var f domain.Feedback
	err := r.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO feedback (user_id, text)
			VALUES ($1, $2)
			RETURNING id, user_id, text, created_at
		)
		SELECT i.id, COALESCE(u.username, ''), i.text, i.created_at
		FROM inserted i
		LEFT JOIN users u ON u.id = i.user_id
	`, userID, text).Scan(&f.ID, &f.Username, &f.Text, &f.CreatedAt)
	return f, err
}

func (r *AdminRepository) ListFeedback(ctx context.Context, limit int) ([]domain.Feedback, error) {
	list := make([]domain.Feedback, 0)
	rows, err := r.db.Query(ctx, `
		SELECT f.id, COALESCE(u.username, ''), f.text, f.created_at
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
		ORDER BY f.id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var f domain.Feedback
		if err := rows.Scan(&f.ID, &f.Username, &f.Text, &f.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

func (r *AdminRepository) UnreadFeedbackCount(ctx context.Context, userID int64) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM feedback f
		JOIN users me ON me.id = $1
		WHERE f.id > me.last_feedback_id
	`, userID).Scan(&n)
	return n, err
}

func (r *AdminRepository) MarkFeedbackRead(ctx context.Context, userID, lastID int64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET last_feedback_id = GREATEST(last_feedback_id, LEAST($2, (SELECT COALESCE(MAX(id), 0) FROM feedback)))
		WHERE id = $1
	`, userID, lastID)
	return err
}

func (r *AdminRepository) HeadIDs(ctx context.Context) ([]int64, error) {
	rows, err := r.db.Query(ctx, `SELECT id FROM users WHERE role = $1`, domain.RoleHead)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
