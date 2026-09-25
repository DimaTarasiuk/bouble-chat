package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"slices"
	"sort"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = pongWait * 9 / 10
	maxMessageSize = 4096

	// AuthSubprotocol is the Sec-WebSocket-Protocol value that must precede the token.
	AuthSubprotocol = "bearer"
)

type envelope struct {
	conversationID int64
	payload        []byte
}

type userEnvelope struct {
	userID  int64
	payload []byte
}

type Client struct {
	hub            *Hub
	conn           *websocket.Conn
	send           chan []byte
	conversationID int64 // 0 = presence-only
	userID         int64
	username       string
}

type onlineSnapshot struct {
	ids   []int64
	names []string
}

type Hub struct {
	upgrader    websocket.Upgrader
	clients     map[*Client]bool
	online      map[int64]int
	names       map[int64]string
	broadcast   chan envelope
	notifyUser  chan userEnvelope
	kickUser    chan userEnvelope
	presenceAll chan []byte
	onlineReq   chan chan onlineSnapshot
	register    chan *Client
	unregister  chan *Client
	onOffline   func(userID int64)
}

func NewHub(checkOrigin func(r *http.Request) bool, onOffline func(userID int64)) *Hub {
	return &Hub{
		upgrader: websocket.Upgrader{
			CheckOrigin:  checkOrigin,
			Subprotocols: []string{AuthSubprotocol},
		},
		clients:     make(map[*Client]bool),
		online:      make(map[int64]int),
		names:       make(map[int64]string),
		broadcast:   make(chan envelope, 100),
		notifyUser:  make(chan userEnvelope, 100),
		kickUser:    make(chan userEnvelope, 16),
		presenceAll: make(chan []byte, 16),
		onlineReq:   make(chan chan onlineSnapshot, 16),
		register:    make(chan *Client, 64),
		unregister:  make(chan *Client, 64),
		onOffline:   onOffline,
	}
}

// TokenFromRequest extracts the token sent as `Sec-WebSocket-Protocol: bearer, <token>`.
func TokenFromRequest(r *http.Request) string {
	protocols := websocket.Subprotocols(r)
	for i := 0; i+1 < len(protocols); i++ {
		if protocols[i] == AuthSubprotocol {
			return protocols[i+1]
		}
	}
	return ""
}

func (h *Hub) KickUser(userID int64, reason string) {
	payload, err := json.Marshal(map[string]any{
		"type":   "force_logout",
		"reason": reason,
	})
	if err != nil {
		return
	}
	h.kickUser <- userEnvelope{userID: userID, payload: payload}
}

func (h *Hub) BroadcastPresence(payload []byte) {
	h.presenceAll <- payload
}

func (h *Hub) BroadcastTo(conversationID int64, message []byte) {
	h.broadcast <- envelope{conversationID: conversationID, payload: message}
}

func (h *Hub) NotifyUser(userID int64, message []byte) {
	h.notifyUser <- userEnvelope{userID: userID, payload: message}
}

func (h *Hub) snapshot() onlineSnapshot {
	resp := make(chan onlineSnapshot, 1)
	h.onlineReq <- resp
	return <-resp
}

func (h *Hub) OnlineUsers() []string {
	return h.snapshot().names
}

func (h *Hub) OnlineUserIDs() []int64 {
	return h.snapshot().ids
}

func (h *Hub) IsOnline(userID int64) bool {
	return slices.Contains(h.OnlineUserIDs(), userID)
}

func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			for client := range h.clients {
				delete(h.clients, client)
				close(client.send)
			}
			return

		case client := <-h.register:
			h.clients[client] = true
			wasOffline := h.online[client.userID] == 0
			h.online[client.userID]++
			h.names[client.userID] = client.username
			log.Printf("Client registered (%s). Total clients: %d", client.username, len(h.clients))
			if wasOffline {
				h.fanoutPresence(client.username, true)
			}
			if client.conversationID == 0 {
				h.sendSnapshot(client)
			}

		case client := <-h.unregister:
			h.removeClient(client)

		case msg := <-h.broadcast:
			h.deliver(msg.payload, func(c *Client) bool {
				return c.conversationID == msg.conversationID
			})

		case msg := <-h.notifyUser:
			h.deliver(msg.payload, func(c *Client) bool {
				return c.conversationID == 0 && c.userID == msg.userID
			})

		case msg := <-h.kickUser:
			var targets []*Client
			for client := range h.clients {
				if client.userID == msg.userID {
					targets = append(targets, client)
				}
			}
			for _, client := range targets {
				select {
				case client.send <- msg.payload:
				default:
				}
				h.removeClient(client)
			}

		case payload := <-h.presenceAll:
			h.deliver(payload, func(c *Client) bool { return c.conversationID == 0 })

		case resp := <-h.onlineReq:
			resp <- h.onlineList()
		}
	}
}

func (h *Hub) deliver(payload []byte, match func(*Client) bool) {
	var stale []*Client
	for client := range h.clients {
		if !match(client) {
			continue
		}
		select {
		case client.send <- payload:
		default:
			stale = append(stale, client)
		}
	}
	for _, client := range stale {
		h.removeClient(client)
	}
}

func (h *Hub) removeClient(client *Client) {
	if _, ok := h.clients[client]; !ok {
		return
	}
	delete(h.clients, client)
	close(client.send)

	h.online[client.userID]--
	if h.online[client.userID] > 0 {
		log.Printf("Client unregistered (%s). Total clients: %d", client.username, len(h.clients))
		return
	}
	delete(h.online, client.userID)
	name := h.names[client.userID]
	delete(h.names, client.userID)
	log.Printf("Client unregistered (%s). Total clients: %d", client.username, len(h.clients))

	h.fanoutPresence(name, false)
	if h.onOffline != nil {
		userID := client.userID
		go h.onOffline(userID)
	}
}

func (h *Hub) onlineList() onlineSnapshot {
	s := onlineSnapshot{
		ids:   make([]int64, 0, len(h.online)),
		names: make([]string, 0, len(h.online)),
	}
	for id := range h.online {
		s.ids = append(s.ids, id)
		s.names = append(s.names, h.names[id])
	}
	sort.Strings(s.names)
	return s
}

func (h *Hub) sendSnapshot(client *Client) {
	list := h.onlineList().names
	payload, err := json.Marshal(map[string]any{
		"type":         "presence_snapshot",
		"online":       list,
		"online_count": len(list),
	})
	if err != nil {
		return
	}
	select {
	case client.send <- payload:
	default:
	}
}

func (h *Hub) fanoutPresence(username string, online bool) {
	payload, err := json.Marshal(map[string]any{
		"type":         "presence",
		"user":         username,
		"online":       online,
		"online_count": len(h.online),
		"last_seen":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}
	h.deliver(payload, func(c *Client) bool { return c.conversationID == 0 })
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) serve(w http.ResponseWriter, r *http.Request, conversationID, userID int64, username string) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:            h,
		conn:           conn,
		send:           make(chan []byte, 256),
		conversationID: conversationID,
		userID:         userID,
		username:       username,
	}

	h.register <- client
	go client.readPump()
	go client.writePump()
}

func (h *Hub) ServeConversation(w http.ResponseWriter, r *http.Request, conversationID, userID int64, username string) {
	h.serve(w, r, conversationID, userID, username)
}

func (h *Hub) ServePresence(w http.ResponseWriter, r *http.Request, userID int64, username string) {
	h.serve(w, r, 0, userID, username)
}
