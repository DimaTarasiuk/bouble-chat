package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

var (
	ErrCannotModerate      = errors.New("cannot moderate this user")
	ErrAnnouncementInvalid = errors.New("invalid announcement")
)

const maxAnnouncementLen = 2000

type AdminService struct {
	users repository.UserRepo
	admin repository.AdminRepo
}

func NewAdminService(users repository.UserRepo, admin repository.AdminRepo) *AdminService {
	return &AdminService{users: users, admin: admin}
}

func (s *AdminService) UserCard(ctx context.Context, username string, online bool) (domain.UserCard, error) {
	u, err := s.users.GetByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		return domain.UserCard{}, err
	}
	chats, messages, err := s.admin.UserCounts(ctx, u.ID, u.Username)
	if err != nil {
		return domain.UserCard{}, err
	}
	return domain.UserCard{
		User:          u,
		Online:        online,
		ChatsCount:    chats,
		MessagesCount: messages,
	}, nil
}

func (s *AdminService) moderationTarget(ctx context.Context, actorID int64, username string) (domain.User, error) {
	target, err := s.users.GetByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		return domain.User{}, err
	}
	if target.ID == actorID || target.Role == domain.RoleHead {
		return domain.User{}, ErrCannotModerate
	}
	return target, nil
}

func (s *AdminService) Ban(ctx context.Context, actorID int64, username, reason string) (domain.User, error) {
	target, err := s.moderationTarget(ctx, actorID, username)
	if err != nil {
		return domain.User{}, err
	}
	if err := s.admin.Ban(ctx, target.ID, strings.TrimSpace(reason)); err != nil {
		return domain.User{}, err
	}
	return s.users.GetByID(ctx, target.ID)
}

func (s *AdminService) Unban(ctx context.Context, actorID int64, username string) (domain.User, error) {
	target, err := s.moderationTarget(ctx, actorID, username)
	if err != nil {
		return domain.User{}, err
	}
	if err := s.admin.Unban(ctx, target.ID); err != nil {
		return domain.User{}, err
	}
	return s.users.GetByID(ctx, target.ID)
}

func (s *AdminService) Kick(ctx context.Context, actorID int64, username string) (domain.User, error) {
	target, err := s.moderationTarget(ctx, actorID, username)
	if err != nil {
		return domain.User{}, err
	}
	if err := s.admin.RevokeSessions(ctx, target.ID); err != nil {
		return domain.User{}, err
	}
	return target, nil
}

func (s *AdminService) Stats(ctx context.Context, onlineUsers []string) (domain.Stats, error) {
	return s.admin.Stats(ctx, onlineUsers)
}

func (s *AdminService) RecordOnline(ctx context.Context, count int) error {
	return s.admin.InsertOnlineSnapshot(ctx, count)
}

func (s *AdminService) CreateAnnouncement(ctx context.Context, actorID int64, text string) (domain.Announcement, error) {
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > maxAnnouncementLen {
		return domain.Announcement{}, ErrAnnouncementInvalid
	}
	return s.admin.CreateAnnouncement(ctx, actorID, text)
}

func (s *AdminService) ListAnnouncements(ctx context.Context) ([]domain.Announcement, error) {
	return s.admin.ListAnnouncements(ctx, 50)
}

func (s *AdminService) PendingAnnouncements(ctx context.Context, userID int64) ([]domain.Announcement, error) {
	return s.admin.PendingAnnouncements(ctx, userID)
}

func (s *AdminService) AckAnnouncement(ctx context.Context, userID, announcementID int64) error {
	return s.admin.AckAnnouncement(ctx, userID, announcementID)
}
