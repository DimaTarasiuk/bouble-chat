package repository

import (
	"context"
	"fmt"
	"log"
	"os"

	"chat.com/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepository struct{
	db *pgxpool.Pool
}

type MessageRepo interface{
	GetAll(ctx context.Context)([]domain.Message, error)
	Create(ctx context.Context, from domain.Sender, text string)(domain.Message, error)
}

func NewMessageRepository() *MessageRepository{

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil{
		log.Printf("failed to connect to db with: -> %v", err)
		os.Exit(1)
	}

	err = pool.Ping(context.Background())
	if err != nil {
		log.Fatalf("Unable to ping DB -> %v", err)
	}
	log.Printf("Ping of Postgres is successful" )

	return &MessageRepository{
		db: pool,
	}

}

func (r *MessageRepository) GetAll(ctx context.Context)([]domain.Message, error){
	var messages []domain.Message

	sql := "SELECT id, from_user, message_content, created_at FROM messages limit 1000"
	
	rows, err := r.db.Query(ctx, sql)
	if err != nil {
		log.Printf("Issue with query Get all %v", err)
	}
	defer rows.Close()

	for rows.Next(){
		var m domain.Message
		rows.Scan(&m.ID, &m.From, &m.Text, &m.CreatedAt)
		messages = append(messages, m)
	}
	if len(messages) == 0 {
    	fmt.Print("no messages")
	}

	return messages, nil
}

func (r *MessageRepository) Create(ctx context.Context, from domain.Sender, text string)(domain.Message, error){
	var m domain.Message

	createQuery := "insert into messages (from_user, message_content) values($1, $2) RETURNING id, from_user, message_content, created_at"
	row := r.db.QueryRow(ctx, createQuery, from, text)

	err := row.Scan(&m.ID, &m.From, &m.Text, &m.CreatedAt)
	
	return m, err

}