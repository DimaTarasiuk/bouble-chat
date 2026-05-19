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

	
	repo := repository.NewMessageRepository()
	svc := service.NewMessageService(repo)
	hub := ws.NewHub()
	go hub.Run()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
			AllowedOrigins: []string{"http://localhost:*"}, // порт vite
    		AllowedMethods: []string{"GET", "POST"},
   			AllowedHeaders: []string{"Content-Type"},
		},
	))

	h := handler.New(svc, hub)

	r.Get("/api/messages", h.GetAll)
	r.Post("/api/messages", h.Create)
	r.Get("/ws", hub.ServeWS)

	http.ListenAndServe(":"+os.Getenv("APP_PORT"), r)
	fmt.Printf("Server started \n")
	
}