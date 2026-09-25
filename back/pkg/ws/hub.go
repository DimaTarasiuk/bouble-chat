package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type envelope struct {
	conversationID int64
	payload        []byte
}

type userEnvelope struct {
	username string
	payload  []byte
}

type Client struct {
	hub            *Hub
	conn           *websocket.Conn
	send           chan []byte
	conversationID int64 // 0 = presence-only
	username       string
}

type Hub struct {
	clients    map[*Client]bool
	online     map[string]int
	broadcast  chan envelope
	notifyUser chan userEnvelope
	onlineReq  chan chan []string
	register   chan *Client
	unregister chan *Client
	onOffline  func(username string)
}

func NewHub(onOffline func(username string)) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		online:     make(map[string]int),
		broadcast:  make(chan envelope, 100),
		notifyUser: make(chan userEnvelope, 100),
		onlineReq:  make(chan chan []string, 16),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		onOffline:  onOffline,
	}
}

func (h *Hub) BroadcastTo(conversationID int64, message []byte) {
	h.broadcast <- envelope{conversationID: conversationID, payload: message}
}

func (h *Hub) NotifyUser(username string, message []byte) {
	if username == "" {
		return
	}
	h.notifyUser <- userEnvelope{username: username, payload: message}
}

func (h *Hub) OnlineUsers() []string {
	resp := make(chan []string, 1)
	h.onlineReq <- resp
	return <-resp
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			wasOffline := h.online[client.username] == 0
			h.online[client.username]++
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
			var stale []*Client
			for client := range h.clients {
				if client.conversationID != msg.conversationID {
					continue
				}
				select {
				case client.send <- msg.payload:
				default:
					stale = append(stale, client)
				}
			}
			for _, client := range stale {
				h.removeClient(client)
			}

		case msg := <-h.notifyUser:
			var stale []*Client
			for client := range h.clients {
				if client.conversationID != 0 || client.username != msg.username {
					continue
				}
				select {
				case client.send <- msg.payload:
				default:
					stale = append(stale, client)
				}
			}
			for _, client := range stale {
				h.removeClient(client)
			}

		case resp := <-h.onlineReq:
			resp <- h.onlineList()
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	if _, ok := h.clients[client]; !ok {
		return
	}
	delete(h.clients, client)
	close(client.send)

	h.online[client.username]--
	wentOffline := false
	if h.online[client.username] <= 0 {
		delete(h.online, client.username)
		wentOffline = true
	}
	log.Printf("Client unregistered (%s). Total clients: %d", client.username, len(h.clients))
	if wentOffline {
		h.fanoutPresence(client.username, false)
		if h.onOffline != nil {
			username := client.username
			go h.onOffline(username)
		}
	}
}

func (h *Hub) onlineList() []string {
	list := make([]string, 0, len(h.online))
	for user, n := range h.online {
		if n > 0 {
			list = append(list, user)
		}
	}
	sort.Strings(list)
	return list
}

func (h *Hub) sendSnapshot(client *Client) {
	list := h.onlineList()
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
	list := h.onlineList()
	payload, err := json.Marshal(map[string]any{
		"type":         "presence",
		"user":         username,
		"online":       online,
		"online_count": len(list),
		"last_seen":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}
	var stale []*Client
	for client := range h.clients {
		if client.conversationID != 0 {
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

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			break
		}
	}
}

func (h *Hub) serve(w http.ResponseWriter, r *http.Request, conversationID int64, username string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:            h,
		conn:           conn,
		send:           make(chan []byte, 256),
		conversationID: conversationID,
		username:       username,
	}

	h.register <- client
	go client.readPump()
	go client.writePump()
}

func (h *Hub) ServeConversation(w http.ResponseWriter, r *http.Request, conversationID int64, username string) {
	h.serve(w, r, conversationID, username)
}

func (h *Hub) ServePresence(w http.ResponseWriter, r *http.Request, username string) {
	h.serve(w, r, 0, username)
}
