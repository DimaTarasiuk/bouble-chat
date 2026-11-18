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

// RandomAgeBand is an allowed own-age preset shown in the UI.
type RandomAgeBand struct {
	Min   int
	Max   int
	Label string
}

// RandomAgeBands are the only valid own-age ranges.
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
	ID string `json:"-"`
	RandomPrefs
	CreatedAt time.Time `json:"created_at"`
}

// RandomSession is always built from the point of view of one participant.
type RandomSession struct {
	ID         int64     `json:"id"`
	PeerGender string    `json:"peer_gender"`
	PeerAge    string    `json:"peer_age"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	PeerID     string    `json:"-"`
}

type RandomMessage struct {
	ID         int64     `json:"id"`
	FromGender string    `json:"from_gender"`
	Mine       bool      `json:"mine"`
	Text       string    `json:"text"`
	CreatedAt  time.Time `json:"time"`
	FromGuest  string    `json:"-"`
}
