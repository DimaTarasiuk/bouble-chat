package repository

import (
	"context"
	"errors"
	"log"
	"os"
	"time"

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

type ProfileUpdate struct {
	Username  string
	FirstName string
	LastName  string
	BirthDate *time.Time
	Gender    string
}

type UserRepo interface {
	Create(ctx context.Context, username, passwordHash string) (domain.User, error)
	GetByID(ctx context.Context, id int64) (domain.User, error)
	GetByUsername(ctx context.Context, username string) (domain.User, error)
	Search(ctx context.Context, query string, excludeID int64, limit int) ([]domain.User, error)
	ListAll(ctx context.Context) ([]domain.User, error)
	UpdateRole(ctx context.Context, username, role string) (domain.User, error)
	UpdateProfile(ctx context.Context, userID int64, patch ProfileUpdate) (domain.User, error)
	TouchLastSeen(ctx context.Context, username string) error
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

const userReturning = `id, username, role, first_name, last_name, birth_date, gender, last_seen_at, password_hash, created_at`

func scanUser(row pgx.Row) (domain.User, error) {
	var u domain.User
	var birth *time.Time
	err := row.Scan(
		&u.ID, &u.Username, &u.Role,
		&u.FirstName, &u.LastName, &birth, &u.Gender, &u.LastSeen,
		&u.PassHash, &u.CreatedAt,
	)
	if err != nil {
		return domain.User{}, err
	}
	if birth != nil {
		s := birth.Format("2006-01-02")
		u.BirthDate = &s
	}
	return u, nil
}

func (r *UserRepository) Create(ctx context.Context, username, passwordHash string) (domain.User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `
		INSERT INTO users (username, password_hash)
		VALUES ($1, $2)
		RETURNING `+userReturning+`
	`, username, passwordHash))
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
	u, err := scanUser(r.db.QueryRow(ctx, `
		SELECT `+userReturning+`
		FROM users
		WHERE id = $1
	`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (domain.User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `
		SELECT `+userReturning+`
		FROM users
		WHERE username = $1
	`, username))
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
	rows, err := r.db.Query(ctx, `
		SELECT id, username, role, created_at
		FROM users
		WHERE username ILIKE $1
		  AND id <> $2
		ORDER BY username
		LIMIT $3
	`, query+"%", excludeID, limit)
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

func (r *UserRepository) ListAll(ctx context.Context) ([]domain.User, error) {
	users := make([]domain.User, 0)
	rows, err := r.db.Query(ctx, `
		SELECT id, username, role, last_seen_at, created_at
		FROM users
		ORDER BY username
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.LastSeen, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepository) UpdateRole(ctx context.Context, username, role string) (domain.User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `
		UPDATE users
		SET role = $2
		WHERE username = $1
		RETURNING `+userReturning+`
	`, username, role))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}

func (r *UserRepository) UpdateProfile(ctx context.Context, userID int64, patch ProfileUpdate) (domain.User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `
		UPDATE users
		SET username = $2,
		    first_name = $3,
		    last_name = $4,
		    birth_date = $5,
		    gender = $6
		WHERE id = $1
		RETURNING `+userReturning+`
	`, userID, patch.Username, patch.FirstName, patch.LastName, patch.BirthDate, patch.Gender))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.User{}, ErrUsernameTaken
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, ErrNotFound
		}
		return domain.User{}, err
	}
	return u, nil
}

func (r *UserRepository) TouchLastSeen(ctx context.Context, username string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET last_seen_at = NOW()
		WHERE username = $1
	`, username)
	return err
}
