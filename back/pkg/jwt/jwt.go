package jwt

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	guestTokenType = "guest"
	guestTokenTTL  = 12 * time.Hour
)

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Type     string `json:"typ,omitempty"`
	jwt.RegisteredClaims
}

type GuestClaims struct {
	GuestID string `json:"guest_id"`
	Type    string `json:"typ"`
	jwt.RegisteredClaims
}

func GenerateToken(userID int64, username, role, secret string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenString, secret string) (*Claims, error) {
	claims := &Claims{}
	if err := parse(tokenString, secret, claims); err != nil {
		return nil, err
	}
	if claims.Type != "" {
		return nil, fmt.Errorf("unexpected token type")
	}
	return claims, nil
}

func GenerateGuestToken(guestID, secret string) (string, error) {
	claims := GuestClaims{
		GuestID: guestID,
		Type:    guestTokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(guestTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseGuestToken(tokenString, secret string) (*GuestClaims, error) {
	claims := &GuestClaims{}
	if err := parse(tokenString, secret, claims); err != nil {
		return nil, err
	}
	if claims.Type != guestTokenType || claims.GuestID == "" {
		return nil, fmt.Errorf("unexpected token type")
	}
	return claims, nil
}

func parse(tokenString, secret string, claims jwt.Claims) error {
	if tokenString == "" {
		return fmt.Errorf("empty token")
	}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	return err
}
