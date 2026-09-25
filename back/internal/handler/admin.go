package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strconv"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	svc *service.AdminService
	hub *ws.Hub
}

func NewAdmin(svc *service.AdminService, hub *ws.Hub) *AdminHandler {
	return &AdminHandler{svc: svc, hub: hub}
}

func (h *AdminHandler) isOnline(username string) bool {
	if h.hub == nil {
		return false
	}
	return slices.Contains(h.hub.OnlineUsers(), username)
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
	username := chi.URLParam(r, "username")
	card, err := h.svc.UserCard(r.Context(), username, h.isOnline(username))
	if err != nil {
		writeModerationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, card)
}

type banRequest struct {
	Reason string `json:"reason"`
}

func (h *AdminHandler) Ban(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	var req banRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	user, err := h.svc.Ban(r.Context(), actor.ID, chi.URLParam(r, "username"), req.Reason)
	if err != nil {
		writeModerationError(w, err)
		return
	}
	if h.hub != nil {
		h.hub.KickUser(user.Username, "banned")
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
		h.hub.KickUser(user.Username, "kicked")
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	var online []string
	if h.hub != nil {
		online = h.hub.OnlineUsers()
	}
	stats, err := h.svc.Stats(r.Context(), online)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

type announcementRequest struct {
	Text string `json:"text"`
}

func (h *AdminHandler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFromContext(r.Context())
	var req announcementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.LastID <= 0 {
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
	for _, name := range readers {
		h.hub.NotifyUser(name, payload)
	}
}
