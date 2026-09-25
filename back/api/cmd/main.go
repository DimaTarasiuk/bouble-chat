package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/handler"
	"chat.com/internal/repository"
	"chat.com/internal/service"
	"chat.com/pkg/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	msgRepo := repository.NewMessageRepository()
	defer msgRepo.Close()
	userRepo := repository.NewUserRepository()
	defer userRepo.Close()
	convRepo := repository.NewConversationRepository()
	defer convRepo.Close()
	adminRepo := repository.NewAdminRepository()
	defer adminRepo.Close()

	authSvc := service.NewAuthService(userRepo, secret)
	chatSvc := service.NewConversationService(userRepo, convRepo, msgRepo)
	adminSvc := service.NewAdminService(userRepo, adminRepo)

	allowedOrigins := []string{"http://localhost:*"}
	for origin := range strings.SplitSeq(os.Getenv("FRONTEND_URL"), ",") {
		if origin = strings.TrimSpace(strings.TrimSuffix(origin, "/")); origin != "" {
			allowedOrigins = append(allowedOrigins, origin)
		}
	}

	hub := ws.NewHub(originChecker(allowedOrigins), func(userID int64) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = authSvc.TouchLastSeen(ctx, userID)
	})
	go hub.Run(ctx)
	go recordOnlineSnapshots(ctx, adminSvc, hub)

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))
	r.Use(handler.LimitBody)

	authH := handler.NewAuth(authSvc, secret, hub)
	chatH := handler.NewConversation(chatSvc, hub)
	adminH := handler.NewAdmin(adminSvc, hub)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.With(rateLimitByIP(10, time.Minute)).Post("/api/login", authH.Login)
	r.With(rateLimitByIP(5, time.Hour)).Post("/api/register", authH.Register)
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
		r.Post("/api/conversations/{id}/read", chatH.MarkRead)
		r.Patch("/api/conversations/{id}/messages/{msgId}", chatH.EditMessage)
		r.Get("/api/announcements/pending", adminH.PendingAnnouncements)
		r.Post("/api/announcements/{id}/ack", adminH.AckAnnouncement)
		r.With(rateLimitByUser(5, 10*time.Minute)).Post("/api/feedback", adminH.CreateFeedback)

		r.Route("/api/admin", func(r chi.Router) {
			r.Use(authH.RequireRoles(domain.RoleHead))
			r.Get("/users", authH.ListAllUsers)
			r.Post("/users/role", authH.SetRole)
			r.Get("/users/{username}", adminH.UserCard)
			r.Post("/users/{username}/ban", adminH.Ban)
			r.Post("/users/{username}/unban", adminH.Unban)
			r.Post("/users/{username}/kick", adminH.Kick)
			r.Get("/stats", adminH.Stats)
			r.Get("/announcements", adminH.ListAnnouncements)
			r.Post("/announcements", adminH.CreateAnnouncement)
			r.Get("/feedback", adminH.ListFeedback)
			r.Get("/feedback/unread", adminH.UnreadFeedback)
			r.Post("/feedback/read", adminH.MarkFeedbackRead)
		})
	})

	serveFrontend(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "7979"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("Server listening on port %s", port)
		serverErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serverErr:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server error: %v", err)
		}
	case <-ctx.Done():
		log.Print("Shutting down...")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}

func rateLimitByIP(requests int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.Limit(requests, window,
		httprate.WithKeyFuncs(httprate.KeyByRealIP),
		httprate.WithLimitHandler(tooManyRequests),
	)
}

func rateLimitByUser(requests int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.Limit(requests, window,
		httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
			if u, ok := handler.UserFromContext(r.Context()); ok {
				return "user:" + strconv.FormatInt(u.ID, 10), nil
			}
			return httprate.KeyByRealIP(r)
		}),
		httprate.WithLimitHandler(tooManyRequests),
	)
}

func tooManyRequests(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)
	_, _ = w.Write([]byte(`{"error":"too many requests"}`))
}

func originChecker(allowed []string) func(r *http.Request) bool {
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		if strings.EqualFold(u.Host, r.Host) {
			return true
		}
		for _, pattern := range allowed {
			if matchOrigin(pattern, origin) {
				return true
			}
		}
		return false
	}
}

func matchOrigin(pattern, origin string) bool {
	prefix, suffix, wildcard := strings.Cut(pattern, "*")
	if !wildcard {
		return strings.EqualFold(pattern, origin)
	}
	return len(origin) >= len(prefix)+len(suffix) &&
		strings.HasPrefix(origin, prefix) &&
		strings.HasSuffix(origin, suffix)
}

func recordOnlineSnapshots(ctx context.Context, svc *service.AdminService, hub *ws.Hub) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			snapCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			if err := svc.RecordOnline(snapCtx, len(hub.OnlineUserIDs())); err != nil {
				log.Printf("online snapshot failed: %v", err)
			}
			cancel()
		}
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
