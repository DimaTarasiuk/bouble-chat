package domain

import "time"

type ReplyPreview struct {
	ID   int64  `json:"id"`
	From string `json:"from"`
	Text string `json:"text"`
}

type Message struct {
	ID        int64         `json:"id"`
	UserID    *int64        `json:"user_id"`
	From      string        `json:"from"`
	Text      string        `json:"text"`
	CreatedAt time.Time     `json:"time"`
	ReplyTo   *ReplyPreview `json:"reply_to,omitempty"`
}
