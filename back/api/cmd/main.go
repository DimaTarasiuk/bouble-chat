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

	msgRepo := repository.NewMessageRepository()
	userRepo := repository.NewUserRepository()
	convRepo := repository.NewConversationRepository()
	authSvc := service.NewAuthService(userRepo, secret)
	chatSvc := service.NewConversationService(userRepo, convRepo, msgRepo)
	hub := ws.NewHub()
	go hub.Run()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	authH := handler.NewAuth(authSvc, secret)
	chatH := handler.NewConversation(chatSvc, hub)

	r.Post("/api/register", authH.Register)
	r.Post("/api/login", authH.Login)
	r.Get("/ws", authH.WSAuth(chatH.ServeWS))

	r.Group(func(r chi.Router) {
		r.Use(authH.Middleware)
		r.Get("/api/users", chatH.SearchUsers)
		r.Get("/api/conversations", chatH.List)
		r.Post("/api/conversations", chatH.Create)
		r.Get("/api/conversations/{id}/messages", chatH.GetMessages)
		r.Post("/api/conversations/{id}/messages", chatH.SendMessage)
	})

	http.ListenAndServe(":"+os.Getenv("APP_PORT"), r)
	fmt.Printf("Server started \n")
	
}