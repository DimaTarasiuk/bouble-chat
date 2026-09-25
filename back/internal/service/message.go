package service

import (
	"context"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

type Service interface {
	GetByConversation(ctx context.Context, conversationID int64) ([]domain.Message, error)
	Create(ctx context.Context, conversationID int64, from string, text string) (domain.Message, error)
}

type MessageService struct {
	repo repository.MessageRepo
}

func NewMessageService(repo repository.MessageRepo) *MessageService {
	return &MessageService{repo: repo}
}

func (s *MessageService) GetByConversation(ctx context.Context, conversationID int64) ([]domain.Message, error) {
	return s.repo.GetByConversation(ctx, conversationID)
}

func (s *MessageService) Create(ctx context.Context, conversationID int64, from string, text string) (domain.Message, error) {
	return s.repo.Create(ctx, conversationID, from, text, nil)
}
