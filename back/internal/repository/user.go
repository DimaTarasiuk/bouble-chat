package repository

import (
	"context"
	"errors"
	"log"
	"os"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUsernameTaken = errors.New("username taken")
)

type UserRepository struct {
	db *pgxpool.Pool
}

type UserRepo interface {
	Create(ctx context.Context, username, passwordHash string) (domain.User, error)
	GetByID(ctx context.Context, id int64) (domain.User, error)
	GetByUsername(ctx context.Context, username string) (domain.User, error)
	Search(ctx context.Context, query string, excludeID int64, limit int) ([]domain.User, error)
	UpdateRole(ctx context.Context, username, role string) (domain.User, error)
}

func NewUserRepository() *UserRepository {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}

	return &UserRepository{
		db: pool,
	}
}

func (r *UserRepository) Create(ctx context.Context, username, passwordHash string) (domain.User, error) {
	var u domain.User
	createQuery := `INSERT INTO users (username, password_hash)
					VALUES ($1, $2)
					RETURNING id, username, role, password_hash, created_at`
	err := r.db.QueryRow(ctx, createQuery, username, passwordHash).Scan(
		&u.ID, &u.Username, &u.Role, &u.PassHash, &u.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.User{}, ErrUsernameTaken
		}
		log.Printf("Failed to create user with err -> %v", err)
		return domain.User{}, err
	}

	return u, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id int64) (domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT id, username, role, password_hash, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Username, &u.Role, &u.PassHash, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT id, username, role, password_hash, created_at
		FROM users
		WHERE username = $1
	`, username).Scan(&u.ID, &u.Username, &u.Role, &u.PassHash, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}

func (r *UserRepository) Search(ctx context.Context, query string, excludeID int64, limit int) ([]domain.User, error) {
	users := make([]domain.User, 0)
	sql := `SELECT id, username, role, created_at
			FROM users
			WHERE username ILIKE $1
			  AND id <> $2
			ORDER BY username
			LIMIT $3`
	rows, err := r.db.Query(ctx, sql, query+"%", excludeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepository) UpdateRole(ctx context.Context, username, role string) (domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		UPDATE users
		SET role = $2
		WHERE username = $1
		RETURNING id, username, role, password_hash, created_at
	`, username, role).Scan(&u.ID, &u.Username, &u.Role, &u.PassHash, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}
