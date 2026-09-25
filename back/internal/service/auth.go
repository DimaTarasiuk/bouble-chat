package service

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	jwtpkg "chat.com/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmptyCredentials   = errors.New("login and password required")
	ErrPasswordsMismatch  = errors.New("passwords do not match")
	ErrPasswordTooShort   = errors.New("password too short")
	ErrUsernameTaken      = errors.New("username already taken")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidRole        = errors.New("invalid role")
	ErrCannotChangeHead   = errors.New("cannot change head role")
	ErrInvalidProfile     = errors.New("invalid profile")
	ErrGenderRequired     = errors.New("gender required")
	ErrBanned             = errors.New("banned")
	ErrSessionRevoked     = errors.New("session revoked")
)

const minPasswordLen = 6

type AuthService struct {
	users  repository.UserRepo
	secret string
}

func NewAuthService(users repository.UserRepo, secret string) *AuthService {
	return &AuthService{users: users, secret: secret}
}

func (s *AuthService) Register(ctx context.Context, username, password, passwordConfirm, gender string) (domain.User, string, error) {
	username = strings.TrimSpace(username)
	gender = strings.TrimSpace(gender)
	if username == "" || password == "" {
		return domain.User{}, "", ErrEmptyCredentials
	}
	if utf8.RuneCountInString(password) < minPasswordLen {
		return domain.User{}, "", ErrPasswordTooShort
	}
	if password != passwordConfirm {
		return domain.User{}, "", ErrPasswordsMismatch
	}
	if gender != domain.GenderMale && gender != domain.GenderFemale {
		return domain.User{}, "", ErrGenderRequired
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

	user, err := s.users.Create(ctx, username, string(hash), gender)
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
	if user.BannedAt != nil {
		return domain.User{}, "", ErrBanned
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

type ProfileInput struct {
	Username  string
	FirstName string
	LastName  string
	BirthDate *string
	Gender    string
}

func (s *AuthService) UpdateProfile(ctx context.Context, userID int64, in ProfileInput) (domain.User, string, error) {
	username := strings.TrimSpace(in.Username)
	if username == "" {
		return domain.User{}, "", ErrEmptyCredentials
	}
	if !domain.ValidGender(in.Gender) {
		return domain.User{}, "", ErrInvalidProfile
	}

	var birth *time.Time
	if in.BirthDate != nil {
		raw := strings.TrimSpace(*in.BirthDate)
		if raw != "" {
			parsed, err := time.Parse("2006-01-02", raw)
			if err != nil {
				return domain.User{}, "", ErrInvalidProfile
			}
			birth = &parsed
		}
	}

	user, err := s.users.UpdateProfile(ctx, userID, repository.ProfileUpdate{
		Username:  username,
		FirstName: strings.TrimSpace(in.FirstName),
		LastName:  strings.TrimSpace(in.LastName),
		BirthDate: birth,
		Gender:    in.Gender,
	})
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

func (s *AuthService) ListAllUsers(ctx context.Context, actorRole string) ([]domain.User, error) {
	if actorRole != domain.RoleHead {
		return nil, ErrForbidden
	}
	return s.users.ListAll(ctx)
}

func (s *AuthService) Authorize(ctx context.Context, userID int64, issuedAt time.Time) (domain.AuthState, error) {
	state, err := s.users.GetAuthState(ctx, userID)
	if err != nil {
		return domain.AuthState{}, err
	}
	if state.BannedAt != nil {
		return domain.AuthState{}, ErrBanned
	}
	if state.SessionsRevokedAt != nil && issuedAt.Before(*state.SessionsRevokedAt) {
		return domain.AuthState{}, ErrSessionRevoked
	}
	if state.Role == "" {
		state.Role = domain.RoleUser
	}
	return state, nil
}

func (s *AuthService) TouchLastSeen(ctx context.Context, userID int64) error {
	return s.users.TouchLastSeen(ctx, userID)
}
