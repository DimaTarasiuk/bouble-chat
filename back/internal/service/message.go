package service

import (
	"context"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

type Service interface{
	GetAll(ctx context.Context) ([]domain.Message, error)
	Create(ctx context.Context, from domain.Sender, text string)(domain.Message, error)
}

type MessageService struct{
	repo repository.MessageRepo 
}

func NewMessageService( repo repository.MessageRepo) *MessageService{
	return &MessageService{repo: repo}
}

func (s *MessageService) GetAll(ctx context.Context) ([]domain.Message, error) {
    return s.repo.GetAll(ctx)
}

func (s *MessageService) Create(ctx context.Context, from domain.Sender, text string)(domain.Message, error){
	return s.repo.Create(ctx, from, text)
}