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
	if !decodeJSON(w, r, &req) {
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

	q := r.URL.Query()
	var beforeID *int64
	if raw := q.Get("before"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "bad request")
			return
		}
		beforeID = &id
	}
	limit := 0
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			writeError(w, http.StatusBadRequest, "bad request")
			return
		}
		limit = n
	}

	messages, err := h.svc.Messages(r.Context(), user.ID, convID, beforeID, limit)
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
	if !decodeJSON(w, r, &req) {
		return
	}

	message, conv, err := h.svc.Send(r.Context(), user.ID, user.Username, convID, req.Text, req.ReplyTo)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "text required")
		case errors.Is(err, service.ErrTextTooLong):
			writeError(w, http.StatusBadRequest, "text too long")
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

	notice, noticeErr := h.svc.MessageNotice(r.Context(), conv.PeerID, convID)
	if noticeErr == nil && notice != "none" {
		payload := map[string]any{
			"type":            "chat_message",
			"conversation_id": convID,
			"from":            message.From,
			"id":              message.ID,
		}
		if notice == "hidden" {
			payload = map[string]any{
				"type":            "hidden_chat_message",
				"conversation_id": convID,
				"id":              message.ID,
			}
		}
		if notify, err := json.Marshal(payload); err == nil {
			h.hub.NotifyUser(conv.PeerID, notify)
		}
	}

	writeJSON(w, http.StatusCreated, message)
}

type hideConversationRequest struct {
	Code        string `json:"code"`
	CodeConfirm string `json:"code_confirm"`
}

func (h *ConversationHandler) Hide(w http.ResponseWriter, r *http.Request) {
	user, convID, ok := h.memberConversation(w, r)
	if !ok {
		return
	}
	var req hideConversationRequest
	if !decodeOptionalJSON(w, r, &req) {
		return
	}
	err := h.svc.Hide(r.Context(), user.ID, convID, req.Code, req.CodeConfirm)
	if err != nil {
		writeConversationErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ConversationHandler) Unhide(w http.ResponseWriter, r *http.Request) {
	user, convID, ok := h.memberConversation(w, r)
	if !ok {
		return
	}
	if err := h.svc.Unhide(r.Context(), user.ID, convID); err != nil {
		writeConversationErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ConversationHandler) Dismiss(w http.ResponseWriter, r *http.Request) {
	user, convID, ok := h.memberConversation(w, r)
	if !ok {
		return
	}
	if err := h.svc.Dismiss(r.Context(), user.ID, convID); err != nil {
		writeConversationErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type unlockHiddenRequest struct {
	Code string `json:"code"`
}

func (h *ConversationHandler) Unlock(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req unlockHiddenRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	result, err := h.svc.Unlock(r.Context(), user.ID, req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    result.OK,
		"chats": result.Chats,
	})
}

func (h *ConversationHandler) memberConversation(w http.ResponseWriter, r *http.Request) (AuthUser, int64, bool) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return AuthUser{}, 0, false
	}
	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return AuthUser{}, 0, false
	}
	return user, convID, true
}

func writeConversationErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrCodeRequired):
		writeError(w, http.StatusConflict, "code_required")
	case errors.Is(err, service.ErrInvalidCode):
		writeError(w, http.StatusBadRequest, "invalid code")
	case errors.Is(err, service.ErrCodeMismatch):
		writeError(w, http.StatusBadRequest, "code mismatch")
	case errors.Is(err, service.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
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
	if !decodeJSON(w, r, &req) {
		return
	}

	message, err := h.svc.EditMessage(r.Context(), user.ID, convID, msgID, req.Text)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "text required")
		case errors.Is(err, service.ErrTextTooLong):
			writeError(w, http.StatusBadRequest, "text too long")
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

	h.hub.ServeConversation(w, r, convID, user.ID, user.Username)
}

func (h *ConversationHandler) ServePresence(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	h.hub.ServePresence(w, r, user.ID, user.Username)
}
