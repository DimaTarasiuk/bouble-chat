package jwt

import (
	"github.com/golang-jwt/jwt/v5"
)


type Claims struct{
	UserID int64 			`json:"user_id"`
	jwt.RegisteredClaims
}

func generateToken(userID int64, secret string) (string, error){
	//todo create claims with ID and exp
	//todo create token with claims
	//todo signature

}