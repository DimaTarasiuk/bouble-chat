package handler

import (
	"encoding/json"
	"log"
	"net/http"

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
	From string		`json:"from"`
	Text string 	`json:"text"`
}

func (h *MessageHandler) Create(w http.ResponseWriter, r *http.Request) {
	
	var req createMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("JSON decode error: %v", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	log.Printf("Received message from %s: %s", req.From, req.Text)

	message, err := h.svc.Create(r.Context(), req.From, req.Text)
	if err != nil {
		log.Printf("Service error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("Message created with id: %v", message.ID) // якщо є ID

	// Broadcast
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Marshal error: %v", err)
	} else {
		log.Printf("Broadcasting message: %s", string(data))
		h.hub.Broadcast(data)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
}