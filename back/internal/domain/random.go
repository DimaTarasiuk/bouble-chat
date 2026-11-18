package domain

import (
	"fmt"
	"time"
)

const (
	SeekAny             = "any"
	RandomSessionActive = "active"
	RandomSessionEnded  = "ended"
	RandomMinAge        = 18
	RandomMaxAge        = 99
)

type RandomAgeBand struct {
	Min   int
	Max   int
	Label string
}

var RandomAgeBands = []RandomAgeBand{
	{Min: 18, Max: 22, Label: "18-22"},
	{Min: 23, Max: 28, Label: "23-28"},
	{Min: 28, Max: RandomMaxAge, Label: "28-30+"},
}

func FormatAgeBand(min, max int) string {
	for _, b := range RandomAgeBands {
		if b.Min == min && b.Max == max {
			return b.Label
		}
	}
	if min == max {
		return fmt.Sprintf("%d", min)
	}
	return fmt.Sprintf("%d-%d", min, max)
}

func ValidAgeBand(min, max int) bool {
	for _, b := range RandomAgeBands {
		if b.Min == min && b.Max == max {
			return true
		}
	}
	return false
}

type RandomPrefs struct {
	Gender     string `json:"gender"`
	AgeMin     int    `json:"age_min"`
	AgeMax     int    `json:"age_max"`
	SeekGender string `json:"seek_gender"`
	SeekAgeMin int    `json:"seek_age_min"`
	SeekAgeMax int    `json:"seek_age_max"`
}

type RandomGuest struct {
	ID     string `json:"-"`
	AnonID string `json:"anon_id"`
	RandomPrefs
	CreatedAt time.Time `json:"created_at"`
}

type RandomSession struct {
	ID         int64     `json:"id"`
	PeerGender string    `json:"peer_gender"`
	PeerAge    string    `json:"peer_age"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	PeerID     string    `json:"-"`
}

func GenderLabel(gender string) string {
	if gender == "female" {
		return "Вона"
	}
	return "Він"
}

type RandomMessage struct {
	ID         int64         `json:"id"`
	FromGender string        `json:"from_gender"`
	Mine       bool          `json:"mine"`
	Text       string        `json:"text"`
	CreatedAt  time.Time     `json:"time"`
	ReplyTo    *ReplyPreview `json:"reply_to,omitempty"`
	FromGuest  string        `json:"from_guest,omitempty"`
}

type RandomGuestBrief struct {
	ID     string `json:"id"`
	AnonID string `json:"anon_id"`
	Gender string `json:"gender"`
	Age    string `json:"age"`
}

type RandomSessionAdmin struct {
	ID             int64            `json:"id"`
	Status         string           `json:"status"`
	CreatedAt      time.Time        `json:"created_at"`
	EndedAt        *time.Time       `json:"ended_at,omitempty"`
	LastMessageAt  *time.Time       `json:"last_message_at,omitempty"`
	MessageCount   int              `json:"message_count"`
	LastText       string           `json:"last_text,omitempty"`
	GuestA         RandomGuestBrief `json:"guest_a"`
	GuestB         RandomGuestBrief `json:"guest_b"`
}
