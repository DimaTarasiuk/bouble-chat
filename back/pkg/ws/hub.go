package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type envelope struct {
	conversationID int64
	payload        []byte
}

type Client struct {
	hub            *Hub
	conn           *websocket.Conn
	send           chan []byte
	conversationID int64
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan envelope
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan envelope, 100),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) BroadcastTo(conversationID int64, message []byte) {
	h.broadcast <- envelope{conversationID: conversationID, payload: message}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("Client registered. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client unregistered. Total clients: %d", len(h.clients))
			}

		case msg := <-h.broadcast:
			for client := range h.clients {
				if client.conversationID != msg.conversationID {
					continue
				}
				select {
				case client.send <- msg.payload:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
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

func (h *Hub) ServeConversation(w http.ResponseWriter, r *http.Request, conversationID int64) {
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
	}

	h.register <- client
	go client.readPump()
	go client.writePump()
}
