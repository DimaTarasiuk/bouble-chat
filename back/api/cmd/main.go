package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"chat.com/internal/handler"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func init(){
	if err := godotenv.Load(); err != nil {
		log.Print("No .env file found")
	}
	log.Printf(".env file loaded \n")
}

func main (){

	
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	repo := repository.NewMessageRepository()
	svc := service.NewMessageService(repo)
	userRepo := repository.NewUserRepository()
	authSvc := service.NewAuthService(userRepo, secret)
	hub := ws.NewHub()
	go hub.Run()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	h := handler.New(svc, hub)
	authH := handler.NewAuth(authSvc, secret)

	r.Post("/api/register", authH.Register)
	r.Post("/api/login", authH.Login)
	r.Get("/ws", authH.WSAuth(hub.ServeWS))

	r.Group(func(r chi.Router) {
		r.Use(authH.Middleware)
		r.Get("/api/messages", h.GetAll)
		r.Post("/api/messages", h.Create)
	})

	http.ListenAndServe(":"+os.Getenv("APP_PORT"), r)
	fmt.Printf("Server started \n")
	
}