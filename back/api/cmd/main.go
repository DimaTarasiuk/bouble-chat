package main

import (
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"chat.com/internal/handler"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func init() {
	if err := godotenv.Load(); err != nil {
		log.Print("No .env file found")
	}
}

func main() {
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
	allowedOrigins := []string{"http://localhost:*"}
	for origin := range strings.SplitSeq(os.Getenv("FRONTEND_URL"), ",") {
		if origin = strings.TrimSpace(strings.TrimSuffix(origin, "/")); origin != "" {
			allowedOrigins = append(allowedOrigins, origin)
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	authH := handler.NewAuth(authSvc, secret)
	chatH := handler.NewConversation(chatSvc, hub)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.Post("/api/register", authH.Register)
	r.Post("/api/login", authH.Login)
	r.Get("/ws", authH.WSAuth(chatH.ServeWS))
	r.Get("/ws/presence", authH.WSAuth(chatH.ServePresence))

	r.Group(func(r chi.Router) {
		r.Use(authH.Middleware)
		r.Get("/api/me", authH.Me)
		r.Patch("/api/me", authH.UpdateProfile)
		r.Get("/api/users", chatH.SearchUsers)
		r.Get("/api/conversations", chatH.List)
		r.Post("/api/conversations", chatH.Create)
		r.Get("/api/conversations/{id}/messages", chatH.GetMessages)
		r.Post("/api/conversations/{id}/messages", chatH.SendMessage)
		r.Patch("/api/conversations/{id}/messages/{msgId}", chatH.EditMessage)

		r.Post("/api/admin/users/role", authH.SetRole)
	})

	serveFrontend(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "7979"
	}

	log.Printf("Server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}

func serveFrontend(r *chi.Mux) {
	publicDir := os.Getenv("STATIC_DIR")
	if publicDir == "" {
		publicDir = "./public"
	}

	indexPath := filepath.Join(publicDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		log.Printf("Frontend files not found in %s; API-only mode", publicDir)
		return
	}

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		if strings.HasPrefix(req.URL.Path, "/api/") || strings.HasPrefix(req.URL.Path, "/ws") {
			http.NotFound(w, req)
			return
		}

		cleanPath := strings.TrimPrefix(path.Clean(req.URL.Path), "/")
		filePath := filepath.Join(publicDir, filepath.FromSlash(cleanPath))
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, req, filePath)
			return
		}

		http.ServeFile(w, req, indexPath)
	})
}
