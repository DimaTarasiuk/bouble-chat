package domain

import "time"

type Conversation struct {
	ID        int64     `json:"id"`
	Peer      string    `json:"peer"`
	CreatedAt time.Time `json:"created_at"`
}
