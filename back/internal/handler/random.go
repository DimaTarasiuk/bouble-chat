package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	jwtpkg "chat.com/pkg/jwt"
	"chat.com/pkg/ws"
)

const guestKey contextKey = "randomGuest"

func GuestFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(guestKey).(string)
	return id, ok
}

type RandomHandler struct {
	svc    *service.RandomService
	hub    *ws.RandomHub
	secret string
}

func NewRandom(svc *service.RandomService, hub *ws.RandomHub, secret string) *RandomHandler {
	return &RandomHandler{svc: svc, hub: hub, secret: secret}
}

func (h *RandomHandler) notify(guestID string, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	h.hub.Send(guestID, data)
}

func (h *RandomHandler) notifyPeerLeft(sess domain.RandomSession) {
	h.notify(sess.PeerID, map[string]any{"type": "peer_left", "session_id": sess.ID})
}

type randomStartRequest struct {
	domain.RandomPrefs
	AnonID string `json:"anon_id"`
}

type randomStartResponse struct {
	Token  string             `json:"token"`
	AnonID string             `json:"anon_id"`
	Prefs  domain.RandomPrefs `json:"prefs"`
}

func (h *RandomHandler) Start(w http.ResponseWriter, r *http.Request) {
	var req randomStartRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	guest, err := h.svc.Start(r.Context(), req.RandomPrefs, req.AnonID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPrefs) {
			writeError(w, http.StatusBadRequest, "invalid prefs")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	token, err := jwtpkg.GenerateGuestToken(guest.ID, h.secret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusCreated, randomStartResponse{
		Token:  token,
		AnonID: guest.AnonID,
		Prefs:  guest.RandomPrefs,
	})
}

type randomSearchResponse struct {
	Status  string                `json:"status"`
	Session *domain.RandomSession `json:"session,omitempty"`
}

func (h *RandomHandler) Search(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())
	if !h.hub.IsConnected(guestID) {
		writeError(w, http.StatusConflict, "socket required")
		return
	}

	match, err := h.svc.Search(r.Context(), guestID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if match == nil {
		writeJSON(w, http.StatusOK, randomSearchResponse{Status: "waiting"})
		return
	}

	h.notify(match.Mine.PeerID, map[string]any{"type": "matched", "session": match.Peer})
	writeJSON(w, http.StatusOK, randomSearchResponse{Status: "matched", Session: &match.Mine})
}

func (h *RandomHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())
	if err := h.svc.Cancel(r.Context(), guestID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *RandomHandler) Skip(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())
	sess, err := h.svc.Leave(r.Context(), guestID)
	switch {
	case err == nil:
		h.notifyPeerLeft(sess)
	case !errors.Is(err, service.ErrNoActiveSession):
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type randomHistoryResponse struct {
	Session  domain.RandomSession   `json:"session"`
	Messages []domain.RandomMessage `json:"messages"`
}

func (h *RandomHandler) Messages(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())
	sess, messages, err := h.svc.History(r.Context(), guestID)
	if err != nil {
		if errors.Is(err, service.ErrNoActiveSession) {
			writeError(w, http.StatusNotFound, "no active session")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, randomHistoryResponse{Session: sess, Messages: messages})
}

type randomSendRequest struct {
	Text    string `json:"text"`
	ReplyTo *int64 `json:"reply_to"`
}

func (h *RandomHandler) Send(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())

	var req randomSendRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	message, peerID, err := h.svc.Send(r.Context(), guestID, req.Text, req.ReplyTo)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "text required")
		case errors.Is(err, service.ErrTextTooLong):
			writeError(w, http.StatusBadRequest, "text too long")
		case errors.Is(err, service.ErrNoActiveSession):
			writeError(w, http.StatusConflict, "no active session")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusBadRequest, "reply target not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	peerView := message
	peerView.Mine = false
	h.notify(peerID, map[string]any{"type": "message", "message": peerView})
	writeJSON(w, http.StatusCreated, message)
}

func (h *RandomHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	guestID, _ := GuestFromContext(r.Context())

	if sess, err := h.svc.ActiveSession(r.Context(), guestID); err == nil {
		h.hub.ExpectReconnect(sess.PeerID)
	}
	h.hub.Serve(w, r, guestID)
}

// GuestGone is called by the hub once a guest's socket stays closed past the
// grace period.
func (h *RandomHandler) GuestGone(guestID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sess, err := h.svc.Leave(ctx, guestID)
	switch {
	case err == nil:
		h.notifyPeerLeft(sess)
	case !errors.Is(err, service.ErrNoActiveSession):
		log.Printf("random leave %s: %v", guestID, err)
	}
}

func (h *RandomHandler) guestID(token string) (string, bool) {
	claims, err := jwtpkg.ParseGuestToken(token, h.secret)
	if err != nil {
		return "", false
	}
	return claims.GuestID, true
}

func (h *RandomHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		id, ok := h.guestID(strings.TrimPrefix(header, "Bearer "))
		if !strings.HasPrefix(header, "Bearer ") || !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), guestKey, id)))
	})
}

func (h *RandomHandler) WSAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := h.guestID(ws.TokenFromRequest(r))
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), guestKey, id)))
	}
}
