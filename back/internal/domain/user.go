package domain

import "time"

const (
	RoleUser  = "user"
	RoleAdmin = "admin"
	RoleHead  = "head"
)

const (
	GenderMale   = "male"
	GenderFemale = "female"
	GenderOther  = "other"
)

type User struct {
	ID        int64      `json:"id"`
	Username  string     `json:"username"`
	Role      string     `json:"role"`
	FirstName string     `json:"first_name"`
	LastName  string     `json:"last_name"`
	BirthDate *string    `json:"birth_date"`
	Gender    string     `json:"gender"`
	LastSeen  *time.Time `json:"last_seen"`
	PassHash  string     `json:"-"`
	CreatedAt time.Time  `json:"created_at"`
}

func IsStaff(role string) bool {
	return role == RoleAdmin || role == RoleHead
}

func ValidGender(g string) bool {
	switch g {
	case "", GenderMale, GenderFemale, GenderOther:
		return true
	default:
		return false
	}
}
