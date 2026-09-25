package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	jwtpkg "chat.com/pkg/jwt"
)

type contextKey string

const userKey contextKey = "authUser"

type AuthUser struct {
	ID       int64
	Username string
	Role     string
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

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	me, err := h.svc.Me(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	token, err := jwtpkg.GenerateToken(me.ID, me.Username, me.Role, h.secret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, User: me})
}

type setRoleRequest struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

func (h *AuthHandler) SetRole(w http.ResponseWriter, r *http.Request) {
	actor, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	actorUser, err := h.svc.Me(r.Context(), actor.ID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req setRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	user, err := h.svc.SetRole(r.Context(), actorUser.Role, req.Username, req.Role)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, service.ErrInvalidRole):
			writeError(w, http.StatusBadRequest, "invalid role")
		case errors.Is(err, service.ErrCannotChangeHead):
			writeError(w, http.StatusForbidden, "cannot change head role")
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusNotFound, "user not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, user)
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

		role := claims.Role
		if role == "" {
			role = domain.RoleUser
		}

		ctx := context.WithValue(r.Context(), userKey, AuthUser{
			ID:       claims.UserID,
			Username: claims.Username,
			Role:     role,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *AuthHandler) RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if _, ok := allowed[user.Role]; !ok {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (h *AuthHandler) WSAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := jwtpkg.ParseToken(r.URL.Query().Get("token"), h.secret)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		role := claims.Role
		if role == "" {
			role = domain.RoleUser
		}

		ctx := context.WithValue(r.Context(), userKey, AuthUser{
			ID:       claims.UserID,
			Username: claims.Username,
			Role:     role,
		})
		next(w, r.WithContext(ctx))
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
