package domain

import "time"

type User struct{
	ID			int64		`json:"id"`
	Username	string		`json:"username"`
	PassHash	string		`json:"-"`
	CreatedAt	time.Time 	`json:"created_at"`
}

