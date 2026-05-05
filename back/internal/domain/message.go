package domain

import "time"

type Sender string

const (
	SenderMe   Sender = "me"
	SenderThem Sender = "them"
)

type Message struct {
	ID        int64     `json:"id"`
	From      Sender    `json:"from"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"time"`
}