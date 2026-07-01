package jwt

import (
	"go/token"
	"time"

	"github.com/golang-jwt/jwt/v5"
)


type Claims struct{
	UserID int64 			`json:"user_id"`
	jwt.RegisteredClaims
}

func generateToken(userID int64, secret string) (string, error){

	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 *time.Hour)),
			IssuedAt: jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString([]byte(secret))
}