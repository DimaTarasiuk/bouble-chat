package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	svc    *service.AdminService
	random *service.RandomService
	hub    *ws.Hub
}

func NewAdmin(svc *service.AdminService, random *service.RandomService, hub *ws.Hub) *AdminHandler {
	return &AdminHandler{svc: svc, random: random, hub: hub}
}

func (h *AdminHandler) isOnline(userID int64) bool {
	return h.hub != nil && h.hub.IsOnline(userID)
}

func writeModerationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "user not found")
	case errors.Is(err, service.ErrCannotModerate):
		writeError(w, http.StatusForbidden, "cannot moderate this user")
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
}

func (h *AdminHandler) UserCard(w http.ResponseWriter, r *http.Request) {
	card, err := h.svc.UserCard(r.Context(), chi.URLParam(r, "username"))
	if err != nil {
		writeModerationError(w, err)
		return
	}
	card.Online = h.isOnline(card.ID)
	writeJSON(w, http.StatusOK, card)
}

type banRequest struct {
	Reason string `json:"reason"`
}

func (h *AdminHandler) Ban(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	var req banRequest
	if !decodeOptionalJSON(w, r, &req) {
		return
	}

	user, err := h.svc.Ban(r.Context(), actor.ID, chi.URLParam(r, "username"), req.Reason)
	if err != nil {
		writeModerationError(w, err)
		return
	}
	if h.hub != nil {
		h.hub.KickUser(user.ID, "banned")
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *AdminHandler) Unban(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	user, err := h.svc.Unban(r.Context(), actor.ID, chi.URLParam(r, "username"))
	if err != nil {
		writeModerationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *AdminHandler) Kick(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	user, err := h.svc.Kick(r.Context(), actor.ID, chi.URLParam(r, "username"))
	if err != nil {
		writeModerationError(w, err)
		return
	}
	if h.hub != nil {
		h.hub.KickUser(user.ID, "kicked")
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	var online []int64
	if h.hub != nil {
		online = h.hub.OnlineUserIDs()
	}
	stats, err := h.svc.Stats(r.Context(), online)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) Registrations(w http.ResponseWriter, r *http.Request) {
	regs, err := h.svc.RecentRegistrations(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, regs)
}

type announcementRequest struct {
	Text string `json:"text"`
}

func (h *AdminHandler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	var req announcementRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	a, err := h.svc.CreateAnnouncement(r.Context(), actor.ID, req.Text)
	if err != nil {
		if errors.Is(err, service.ErrAnnouncementInvalid) {
			writeError(w, http.StatusBadRequest, "invalid announcement")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	if h.hub != nil {
		if payload, err := json.Marshal(map[string]any{
			"type":         "announcement",
			"announcement": a,
		}); err == nil {
			h.hub.BroadcastPresence(payload)
		}
	}
	writeJSON(w, http.StatusCreated, a)
}

func (h *AdminHandler) ListAnnouncements(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListAnnouncements(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *AdminHandler) PendingAnnouncements(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	list, err := h.svc.PendingAnnouncements(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *AdminHandler) AckAnnouncement(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := h.svc.AckAnnouncement(r.Context(), user.ID, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type feedbackRequest struct {
	Text string `json:"text"`
}

func (h *AdminHandler) CreateFeedback(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	var req feedbackRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	f, err := h.svc.CreateFeedback(r.Context(), user.ID, req.Text)
	if err != nil {
		if errors.Is(err, service.ErrFeedbackInvalid) {
			writeError(w, http.StatusBadRequest, "invalid feedback")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	h.notifyFeedback(r.Context(), f)
	writeJSON(w, http.StatusCreated, f)
}

func (h *AdminHandler) ListFeedback(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListFeedback(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *AdminHandler) UnreadFeedback(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	n, err := h.svc.UnreadFeedbackCount(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"count": n})
}

type feedbackReadRequest struct {
	LastID int64 `json:"last_id"`
}

func (h *AdminHandler) MarkFeedbackRead(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	var req feedbackReadRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.LastID <= 0 {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := h.svc.MarkFeedbackRead(r.Context(), user.ID, req.LastID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) notifyFeedback(ctx context.Context, f domain.Feedback) {
	if h.hub == nil {
		return
	}
	readers, err := h.svc.FeedbackReaders(ctx)
	if err != nil {
		return
	}
	payload, err := json.Marshal(map[string]any{"type": "feedback", "feedback": f})
	if err != nil {
		return
	}
	for _, id := range readers {
		h.hub.NotifyUser(id, payload)
	}
}

func (h *AdminHandler) RandomSessions(w http.ResponseWriter, r *http.Request) {
	if h.random == nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "all"
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	beforeID, _ := strconv.ParseInt(r.URL.Query().Get("before_id"), 10, 64)
	list, err := h.random.ListSessionsAdmin(r.Context(), status, limit, beforeID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPrefs) {
			writeError(w, http.StatusBadRequest, "invalid status")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type randomSessionDetailResponse struct {
	Session  domain.RandomSessionAdmin `json:"session"`
	Messages []domain.RandomMessage    `json:"messages"`
}

func (h *AdminHandler) RandomSession(w http.ResponseWriter, r *http.Request) {
	if h.random == nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	sess, messages, err := h.random.GetSessionAdmin(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, randomSessionDetailResponse{Session: sess, Messages: messages})
}

func (h *AdminHandler) DeleteRandomSession(w http.ResponseWriter, r *http.Request) {
	if h.random == nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := h.random.DeleteEndedSession(r.Context(), id); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusNotFound, "not found")
		case errors.Is(err, repository.ErrConflict):
			writeError(w, http.StatusConflict, "session active")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AdminHandler) DeleteEndedRandomSessions(w http.ResponseWriter, r *http.Request) {
	if h.random == nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	n, err := h.random.DeleteAllEndedSessions(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "deleted": n})
}

func (h *AdminHandler) GetAppVersion(w http.ResponseWriter, r *http.Request) {
	v := h.svc.AppVersion()
	writeJSON(w, http.StatusOK, v)
}

type appVersionRequest struct {
	Build   int    `json:"build"`
	Version string `json:"version"`
	ApkURL  string `json:"apk_url"`
}

func (h *AdminHandler) SetAppVersion(w http.ResponseWriter, r *http.Request) {
	var req appVersionRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	v, err := h.svc.SetAppVersion(r.Context(), req.Build, req.Version, req.ApkURL)
	if err != nil {
		if errors.Is(err, service.ErrAppVersionInvalid) {
			writeError(w, http.StatusBadRequest, "invalid app version")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if h.hub != nil {
		if payload, err := json.Marshal(map[string]any{
			"type":     "app_update",
			"build":    v.Build,
			"version":  v.Version,
			"apk_url":  v.ApkURL,
		}); err == nil {
			h.hub.BroadcastPresence(payload)
		}
	}
	writeJSON(w, http.StatusOK, v)
}

// AppVersionAuth allows CI APP_VERSION_TOKEN or a head JWT.
func (h *AdminHandler) AppVersionAuth(auth *AuthHandler) func(http.Handler) http.Handler {
	token := strings.TrimSpace(os.Getenv("APP_VERSION_TOKEN"))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			raw := strings.TrimPrefix(header, "Bearer ")
			if token != "" && raw == token {
				next.ServeHTTP(w, r)
				return
			}
			if auth == nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			authUser, status, msg := auth.authenticate(r.Context(), raw)
			if status != 0 {
				writeError(w, status, msg)
				return
			}
			if authUser.Role != domain.RoleHead {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			ctx := context.WithValue(r.Context(), userKey, authUser)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
