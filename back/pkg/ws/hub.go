package ws

import (
	"net/http"

	"github.com/gorilla/websocket"

)


type Client struct{
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

type Hub struct{
	clients   map[*Client]bool
	broadcast chan []byte
}

func (h *Hub)Broadcast(message[]byte){
	h.broadcast <- message
}

func NewHub() *Hub{
	return &Hub{
		clients: make(map[*Client]bool),
		broadcast: make(chan []byte),
	}
}

func (h *Hub)Run(){
	for message := range h.broadcast {
		for client := range h.clients {
			select {
			case client.send <- message:
			default:
    			close(client.send)
   				delete(h.clients, client)
			}
		}
	}
}

func (c *Client)readPump(){
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		c.hub.broadcast <- message
	}
}

func (c *Client) writePump(){
	for message := range c.send{
		c.conn.WriteMessage(websocket.TextMessage, message)
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)
	if err!= nil{
		return
	}

	client := &Client{
		hub: h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.clients[client] = true

	go client.readPump()
	go client.writePump()

}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}