package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
)

type ConversationHandler struct {
	svc *service.ConversationService
	hub *ws.Hub
}

func NewConversation(svc *service.ConversationService, hub *ws.Hub) *ConversationHandler {
	return &ConversationHandler{svc: svc, hub: hub}
}

func (h *ConversationHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	users, err := h.svc.SearchUsers(r.Context(), r.URL.Query().Get("q"), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *ConversationHandler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.svc.List(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type createConversationRequest struct {
	Username string `json:"username"`
}

func (h *ConversationHandler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	conv, err := h.svc.FindOrCreate(r.Context(), user.ID, req.Username)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrCannotChatSelf):
			writeError(w, http.StatusBadRequest, "cannot chat with yourself")
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusNotFound, "user not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, conv)
}

func (h *ConversationHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	messages, err := h.svc.Messages(r.Context(), user.ID, convID)
	if err != nil {
		if errors.Is(err, service.ErrForbidden) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, messages)
}

func (h *ConversationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	if err := h.svc.MarkRead(r.Context(), user.ID, convID); err != nil {
		if errors.Is(err, service.ErrForbidden) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type sendMessageRequest struct {
	Text    string `json:"text"`
	ReplyTo *int64 `json:"reply_to"`
}

func (h *ConversationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	message, err := h.svc.Send(r.Context(), user.ID, user.Username, convID, req.Text, req.ReplyTo)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "text required")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusBadRequest, "reply target not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	if data, err := json.Marshal(message); err == nil {
		h.hub.BroadcastTo(convID, data)
	}

	if conv, err := h.svc.Get(r.Context(), user.ID, convID); err == nil {
		if notify, err := json.Marshal(map[string]any{
			"type":            "chat_message",
			"conversation_id": convID,
			"from":            message.From,
			"id":              message.ID,
		}); err == nil {
			h.hub.NotifyUser(conv.Peer, notify)
		}
	}

	_ = h.svc.MarkRead(r.Context(), user.ID, convID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
}

func (h *ConversationHandler) EditMessage(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	msgID, err := strconv.ParseInt(chi.URLParam(r, "msgId"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}

	message, err := h.svc.EditMessage(r.Context(), user.ID, user.Username, convID, msgID, req.Text)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "text required")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, service.ErrEditExpired):
			writeError(w, http.StatusForbidden, "edit window expired")
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusNotFound, "not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	if data, err := json.Marshal(message); err == nil {
		h.hub.BroadcastTo(convID, data)
	}

	writeJSON(w, http.StatusOK, message)
}

func (h *ConversationHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	convID, err := strconv.ParseInt(r.URL.Query().Get("conversation_id"), 10, 64)
	if err != nil || convID <= 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if _, err := h.svc.Get(r.Context(), user.ID, convID); err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	h.hub.ServeConversation(w, r, convID, user.Username)
}

func (h *ConversationHandler) ServePresence(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	h.hub.ServePresence(w, r, user.Username)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
