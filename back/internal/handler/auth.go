package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"chat.com/internal/domain"
	"chat.com/internal/service"
	jwtpkg "chat.com/pkg/jwt"
)

type contextKey string

const userKey contextKey = "authUser"

type AuthUser struct {
	ID       int64
	Username string
}

func UserFromContext(ctx context.Context) (AuthUser, bool) {
	u, ok := ctx.Value(userKey).(AuthUser)
	return u, ok
}

type AuthHandler struct {
	svc    *service.AuthService
	secret string
}

func NewAuth(svc *service.AuthService, secret string) *AuthHandler {
	return &AuthHandler{svc: svc, secret: secret}
}

type registerRequest struct {
	Username        string `json:"username"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  domain.User `json:"user"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	user, token, err := h.svc.Register(r.Context(), req.Username, req.Password, req.PasswordConfirm)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyCredentials):
			writeError(w, http.StatusBadRequest, "login and password required")
		case errors.Is(err, service.ErrPasswordsMismatch):
			writeError(w, http.StatusBadRequest, "passwords do not match")
		case errors.Is(err, service.ErrUsernameTaken):
			writeError(w, http.StatusConflict, "username already taken")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(authResponse{Token: token, User: user})
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	user, token, err := h.svc.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyCredentials):
			writeError(w, http.StatusBadRequest, "login and password required")
		case errors.Is(err, service.ErrInvalidCredentials):
			writeError(w, http.StatusUnauthorized, "invalid credentials")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResponse{Token: token, User: user})
}

func (h *AuthHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		claims, err := jwtpkg.ParseToken(strings.TrimPrefix(header, "Bearer "), h.secret)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		ctx := context.WithValue(r.Context(), userKey, AuthUser{
			ID:       claims.UserID,
			Username: claims.Username,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *AuthHandler) WSAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := jwtpkg.ParseToken(r.URL.Query().Get("token"), h.secret)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userKey, AuthUser{
			ID:       claims.UserID,
			Username: claims.Username,
		})
		next(w, r.WithContext(ctx))
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
