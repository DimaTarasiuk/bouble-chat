package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	jwtpkg "chat.com/pkg/jwt"
	"chat.com/pkg/ws"
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
	hub    *ws.Hub
}

func NewAuth(svc *service.AuthService, secret string, hub *ws.Hub) *AuthHandler {
	return &AuthHandler{svc: svc, secret: secret, hub: hub}
}

type registerRequest struct {
	Username        string `json:"username"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
	Gender          string `json:"gender"`
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

	user, token, err := h.svc.Register(r.Context(), req.Username, req.Password, req.PasswordConfirm, req.Gender)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyCredentials):
			writeError(w, http.StatusBadRequest, "login and password required")
		case errors.Is(err, service.ErrPasswordsMismatch):
			writeError(w, http.StatusBadRequest, "passwords do not match")
		case errors.Is(err, service.ErrGenderRequired):
			writeError(w, http.StatusBadRequest, "gender required")
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
		case errors.Is(err, service.ErrBanned):
			writeError(w, http.StatusForbidden, "banned")
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

type updateProfileRequest struct {
	Username  string  `json:"username"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	BirthDate *string `json:"birth_date"`
	Gender    string  `json:"gender"`
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	updated, token, err := h.svc.UpdateProfile(r.Context(), user.ID, service.ProfileInput{
		Username:  req.Username,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		BirthDate: req.BirthDate,
		Gender:    req.Gender,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyCredentials):
			writeError(w, http.StatusBadRequest, "login and password required")
		case errors.Is(err, service.ErrUsernameTaken):
			writeError(w, http.StatusConflict, "username already taken")
		case errors.Is(err, service.ErrInvalidProfile):
			writeError(w, http.StatusBadRequest, "invalid profile")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, User: updated})
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

type adminUserResponse struct {
	ID        int64      `json:"id"`
	Username  string     `json:"username"`
	Role      string     `json:"role"`
	Gender    string     `json:"gender"`
	Online    bool       `json:"online"`
	Banned    bool       `json:"banned"`
	LastSeen  *time.Time `json:"last_seen"`
	CreatedAt time.Time  `json:"created_at"`
}

func (h *AuthHandler) ListAllUsers(w http.ResponseWriter, r *http.Request) {
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

	users, err := h.svc.ListAllUsers(r.Context(), actorUser.Role)
	if err != nil {
		if errors.Is(err, service.ErrForbidden) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	onlineSet := map[string]struct{}{}
	if h.hub != nil {
		for _, name := range h.hub.OnlineUsers() {
			onlineSet[name] = struct{}{}
		}
	}

	out := make([]adminUserResponse, 0, len(users))
	for _, u := range users {
		_, online := onlineSet[u.Username]
		out = append(out, adminUserResponse{
			ID:        u.ID,
			Username:  u.Username,
			Role:      u.Role,
			Gender:    u.Gender,
			Online:    online,
			Banned:    u.BannedAt != nil,
			LastSeen:  u.LastSeen,
			CreatedAt: u.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *AuthHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		authUser, status, msg := h.authenticate(r.Context(), strings.TrimPrefix(header, "Bearer "))
		if status != 0 {
			writeError(w, status, msg)
			return
		}

		ctx := context.WithValue(r.Context(), userKey, authUser)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// authenticate returns a non-zero HTTP status and error message when the token is rejected.
func (h *AuthHandler) authenticate(ctx context.Context, token string) (AuthUser, int, string) {
	claims, err := jwtpkg.ParseToken(token, h.secret)
	if err != nil {
		return AuthUser{}, http.StatusUnauthorized, "unauthorized"
	}

	var issuedAt time.Time
	if claims.IssuedAt != nil {
		issuedAt = claims.IssuedAt.Time
	}

	state, err := h.svc.Authorize(ctx, claims.UserID, issuedAt)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrBanned):
			return AuthUser{}, http.StatusForbidden, "banned"
		case errors.Is(err, service.ErrSessionRevoked):
			return AuthUser{}, http.StatusUnauthorized, "session revoked"
		case errors.Is(err, repository.ErrNotFound):
			return AuthUser{}, http.StatusUnauthorized, "unauthorized"
		default:
			return AuthUser{}, http.StatusInternalServerError, "internal server error"
		}
	}

	return AuthUser{
		ID:       claims.UserID,
		Username: state.Username,
		Role:     state.Role,
	}, 0, ""
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
		authUser, status, msg := h.authenticate(r.Context(), r.URL.Query().Get("token"))
		if status != 0 {
			http.Error(w, msg, status)
			return
		}

		ctx := context.WithValue(r.Context(), userKey, authUser)
		next(w, r.WithContext(ctx))
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
