package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"chat.com/internal/domain"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
)

type MessageHandler struct{
	svc service.Service
	hub *ws.Hub
}

func New(s service.Service, hub *ws.Hub) *MessageHandler{
	return &MessageHandler{svc: s, hub: hub}
}

func (h *MessageHandler)GetAll(w http.ResponseWriter, r *http.Request){
	messages, err := h.svc.GetAll(r.Context())
	if err != nil{
		log.Printf("error in GetAll Handler %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

type createMessageRequest struct{
	From domain.Sender `json:"from"`
	Text string 		`json:"text"`
}

func (h *MessageHandler) Create(w http.ResponseWriter, r *http.Request) {
	
	var req createMessageRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	
	message, err := h.svc.Create(r.Context(), req.From, req.Text)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
	

	data, _ := json.Marshal(message)
	h.hub.Broadcast(data)
}