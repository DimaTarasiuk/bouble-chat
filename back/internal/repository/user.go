package repository

import (
	"context"
	"log"
	"os"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct{
	db *pgxpool.Pool
}

type UserRepo interface{
	Create(ctx context.Context, username, passwordHash string)(domain.User, error)
	GetByUSername(ctx context.Context, username string)(domain.User, error)
}

func NewUserRepository() *UserRepository{
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil{
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}

	return &UserRepository{
		db: pool,
	}
}

func (r *UserRepository)Create(ctx context.Context, username, passwordHash string)(domain.User, error){
	var u domain.User
	createQuery := `INSERT INTO users (username, password_hash) 
					VALUES ($1, $2)
					RETURNING id, username, password_hash, created_at;
	`
	err := r.db.QueryRow(ctx, createQuery,username,passwordHash).Scan(
		&u.ID, &u.Username, &u.PassHash, &u.CreatedAt,
	)
	if err != nil{
		log.Printf("Failed to create user with err -> %w", err)
		return domain.User{}, err
	}

	return u, nil
	
}

func (r *UserRepository)GetByUsername(ctx context.Context, username string)(domain.User, error){
 	var u domain.User
	getUserQuery := `SELECT id, username, password_hash, created_at 
					 FROM users 
					 WHERE username = $1
	`
	err := r.db.QueryRow(ctx,getUserQuery, username).Scan(
		&u.ID, &u.Username, &u.PassHash, &u.CreatedAt,
	)
	if err != nil{
		return domain.User{}, err
	}
	return u, nil
}