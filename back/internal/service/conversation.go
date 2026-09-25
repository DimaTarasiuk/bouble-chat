package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

var (
	ErrCannotChatSelf = errors.New("cannot chat with yourself")
	ErrForbidden      = errors.New("forbidden")
	ErrEmptyText      = errors.New("text required")
	ErrEditExpired    = errors.New("edit window expired")
)

const messageEditWindow = 10 * time.Minute

type ConversationService struct {
	users repository.UserRepo
	convs repository.ConversationRepo
	msgs  repository.MessageRepo
}

func NewConversationService(users repository.UserRepo, convs repository.ConversationRepo, msgs repository.MessageRepo) *ConversationService {
	return &ConversationService{users: users, convs: convs, msgs: msgs}
}

func (s *ConversationService) SearchUsers(ctx context.Context, query string, excludeID int64) ([]domain.User, error) {
	query = strings.TrimSpace(query)
	query = strings.ReplaceAll(query, "%", "")
	query = strings.ReplaceAll(query, "_", "")
	if query == "" {
		return []domain.User{}, nil
	}
	return s.users.Search(ctx, query, excludeID, 20)
}

func (s *ConversationService) List(ctx context.Context, userID int64) ([]domain.Conversation, error) {
	return s.convs.ListForUser(ctx, userID)
}

func (s *ConversationService) FindOrCreate(ctx context.Context, userID int64, peerUsername string) (domain.Conversation, error) {
	peerUsername = strings.TrimSpace(peerUsername)
	if peerUsername == "" {
		return domain.Conversation{}, repository.ErrNotFound
	}

	peer, err := s.users.GetByUsername(ctx, peerUsername)
	if err != nil {
		return domain.Conversation{}, err
	}
	if peer.ID == userID {
		return domain.Conversation{}, ErrCannotChatSelf
	}

	existing, err := s.convs.FindPair(ctx, userID, peer.ID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return domain.Conversation{}, err
	}

	created, err := s.convs.Create(ctx, userID, peer.ID, peer.Username)
	if err != nil {
		existing, findErr := s.convs.FindPair(ctx, userID, peer.ID)
		if findErr == nil {
			return existing, nil
		}
		return domain.Conversation{}, err
	}
	return created, nil
}

func (s *ConversationService) Get(ctx context.Context, userID, convID int64) (domain.Conversation, error) {
	c, err := s.convs.GetByID(ctx, convID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return domain.Conversation{}, ErrForbidden
		}
		return domain.Conversation{}, err
	}
	return c, nil
}

func (s *ConversationService) Messages(ctx context.Context, userID, convID int64) ([]domain.Message, error) {
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return nil, err
	}
	return s.msgs.GetByConversation(ctx, convID)
}

func (s *ConversationService) Send(ctx context.Context, userID int64, username string, convID int64, text string) (domain.Message, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return domain.Message{}, ErrEmptyText
	}
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return domain.Message{}, err
	}
	return s.msgs.Create(ctx, convID, username, text)
}

func (s *ConversationService) EditMessage(ctx context.Context, userID int64, username string, convID, msgID int64, text string) (domain.Message, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return domain.Message{}, ErrEmptyText
	}
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return domain.Message{}, err
	}

	msg, msgConvID, err := s.msgs.GetByID(ctx, msgID)
	if err != nil {
		return domain.Message{}, err
	}
	if msgConvID != convID {
		return domain.Message{}, ErrForbidden
	}
	if msg.From != username {
		return domain.Message{}, ErrForbidden
	}
	if time.Since(msg.CreatedAt) > messageEditWindow {
		return domain.Message{}, ErrEditExpired
	}

	return s.msgs.UpdateText(ctx, msgID, text)
}
