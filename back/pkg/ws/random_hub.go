package ws

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// RandomHub keeps one socket per anonymous guest. When a guest disconnects and
// does not come back within the grace period (e.g. a page reload), onGone is
// called so the guest can be removed from the queue and its session ended.
type RandomHub struct {
	upgrader websocket.Upgrader
	grace    time.Duration
	onGone   func(guestID string)

	mu      sync.Mutex
	clients map[string]*Client
	timers  map[string]*time.Timer
}

func NewRandomHub(checkOrigin func(r *http.Request) bool, grace time.Duration, onGone func(guestID string)) *RandomHub {
	return &RandomHub{
		upgrader: websocket.Upgrader{
			CheckOrigin:  checkOrigin,
			Subprotocols: []string{AuthSubprotocol},
		},
		grace:   grace,
		onGone:  onGone,
		clients: make(map[string]*Client),
		timers:  make(map[string]*time.Timer),
	}
}

func (h *RandomHub) Serve(w http.ResponseWriter, r *http.Request, guestID string) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Random upgrade failed: %v", err)
		return
	}

	client := &Client{
		conn:    conn,
		send:    make(chan []byte, 64),
		guestID: guestID,
	}
	client.release = func() { h.remove(client) }

	h.mu.Lock()
	if old, ok := h.clients[guestID]; ok {
		close(old.send)
	}
	h.clients[guestID] = client
	if t, ok := h.timers[guestID]; ok {
		t.Stop()
		delete(h.timers, guestID)
	}
	h.mu.Unlock()

	go client.readPump()
	go client.writePump()
}

func (h *RandomHub) remove(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[client.guestID] != client {
		return
	}
	delete(h.clients, client.guestID)
	close(client.send)
	h.startTimerLocked(client.guestID)
}

func (h *RandomHub) startTimerLocked(guestID string) {
	if _, ok := h.timers[guestID]; ok {
		return
	}
	h.timers[guestID] = time.AfterFunc(h.grace, func() {
		h.mu.Lock()
		delete(h.timers, guestID)
		_, back := h.clients[guestID]
		h.mu.Unlock()
		if !back && h.onGone != nil {
			h.onGone(guestID)
		}
	})
}

// ExpectReconnect starts the grace timer for a guest that is not connected,
// e.g. the peer of a session restored after a server restart.
func (h *RandomHub) ExpectReconnect(guestID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[guestID]; ok {
		return
	}
	h.startTimerLocked(guestID)
}

func (h *RandomHub) Send(guestID string, payload []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	client, ok := h.clients[guestID]
	if !ok {
		return
	}
	select {
	case client.send <- payload:
	default:
		delete(h.clients, guestID)
		close(client.send)
		h.startTimerLocked(guestID)
	}
}

func (h *RandomHub) IsConnected(guestID string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	_, ok := h.clients[guestID]
	return ok
}

func (h *RandomHub) ConnectedIDs() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	ids := make([]string, 0, len(h.clients))
	for id := range h.clients {
		ids = append(ids, id)
	}
	return ids
}
