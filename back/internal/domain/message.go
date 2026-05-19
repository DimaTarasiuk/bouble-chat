package domain

import "time"

type Message struct {
	ID        int64     `json:"id"`
	From      string    `json:"from"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"time"`
}