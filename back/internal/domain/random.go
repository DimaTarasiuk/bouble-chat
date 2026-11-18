package domain

import "time"

const (
	SeekAny             = "any"
	RandomSessionActive = "active"
	RandomSessionEnded  = "ended"
	RandomMinAge        = 18
	RandomMaxAge        = 99
)

type RandomPrefs struct {
	Gender     string `json:"gender"`
	Age        int    `json:"age"`
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
	PeerAge    int       `json:"peer_age"`
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
