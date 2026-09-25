package domain

import "time"

type Announcement struct {
	ID        int64     `json:"id"`
	Text      string    `json:"text"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type PeriodCounts struct {
	Today int `json:"today"`
	Week  int `json:"week"`
	Month int `json:"month"`
}

type TopUser struct {
	Username string `json:"username"`
	Messages int    `json:"messages"`
}

type OnlinePoint struct {
	At    time.Time `json:"at"`
	Count int       `json:"count"`
}

type Stats struct {
	TotalUsers    int           `json:"total_users"`
	OnlineNow     int           `json:"online_now"`
	DAU           int           `json:"dau"`
	Registrations PeriodCounts  `json:"registrations"`
	Messages      PeriodCounts  `json:"messages"`
	TopUsers      []TopUser     `json:"top_users"`
	OnlineSeries  []OnlinePoint `json:"online_series"`
}

type UserCard struct {
	User
	Online        bool `json:"online"`
	ChatsCount    int  `json:"chats_count"`
	MessagesCount int  `json:"messages_count"`
}
