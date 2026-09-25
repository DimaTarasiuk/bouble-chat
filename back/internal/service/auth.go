package service

import (
	"context"
	"errors"
	"strings"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	jwtpkg "chat.com/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmptyCredentials   = errors.New("login and password required")
	ErrPasswordsMismatch  = errors.New("passwords do not match")
	ErrUsernameTaken      = errors.New("username already taken")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidRole        = errors.New("invalid role")
	ErrCannotChangeHead   = errors.New("cannot change head role")
)

type AuthService struct {
	users  repository.UserRepo
	secret string
}

func NewAuthService(users repository.UserRepo, secret string) *AuthService {
	return &AuthService{users: users, secret: secret}
}

func (s *AuthService) Register(ctx context.Context, username, password, passwordConfirm string) (domain.User, string, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return domain.User{}, "", ErrEmptyCredentials
	}
	if password != passwordConfirm {
		return domain.User{}, "", ErrPasswordsMismatch
	}

	_, err := s.users.GetByUsername(ctx, username)
	if err == nil {
		return domain.User{}, "", ErrUsernameTaken
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return domain.User{}, "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.User{}, "", err
	}

	user, err := s.users.Create(ctx, username, string(hash))
	if err != nil {
		if errors.Is(err, repository.ErrUsernameTaken) {
			return domain.User{}, "", ErrUsernameTaken
		}
		return domain.User{}, "", err
	}

	token, err := jwtpkg.GenerateToken(user.ID, user.Username, user.Role, s.secret)
	if err != nil {
		return domain.User{}, "", err
	}

	return user, token, nil
}

func (s *AuthService) Login(ctx context.Context, username, password string) (domain.User, string, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return domain.User{}, "", ErrEmptyCredentials
	}

	user, err := s.users.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return domain.User{}, "", ErrInvalidCredentials
		}
		return domain.User{}, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(password)); err != nil {
		return domain.User{}, "", ErrInvalidCredentials
	}

	token, err := jwtpkg.GenerateToken(user.ID, user.Username, user.Role, s.secret)
	if err != nil {
		return domain.User{}, "", err
	}

	return user, token, nil
}

func (s *AuthService) Me(ctx context.Context, userID int64) (domain.User, error) {
	return s.users.GetByID(ctx, userID)
}

func (s *AuthService) SetRole(ctx context.Context, actorRole, targetUsername, newRole string) (domain.User, error) {
	if actorRole != domain.RoleHead {
		return domain.User{}, ErrForbidden
	}

	newRole = strings.TrimSpace(newRole)
	if newRole != domain.RoleUser && newRole != domain.RoleAdmin {
		return domain.User{}, ErrInvalidRole
	}

	targetUsername = strings.TrimSpace(targetUsername)
	if targetUsername == "" {
		return domain.User{}, ErrInvalidRole
	}

	target, err := s.users.GetByUsername(ctx, targetUsername)
	if err != nil {
		return domain.User{}, err
	}
	if target.Role == domain.RoleHead {
		return domain.User{}, ErrCannotChangeHead
	}

	return s.users.UpdateRole(ctx, targetUsername, newRole)
}
