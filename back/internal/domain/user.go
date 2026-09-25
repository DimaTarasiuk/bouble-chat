package domain

import "time"

const (
	RoleUser  = "user"
	RoleAdmin = "admin"
	RoleHead  = "head"
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	PassHash  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

func IsStaff(role string) bool {
	return role == RoleAdmin || role == RoleHead
}
