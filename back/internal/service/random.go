package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

var anonIDRe = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

var (
	ErrInvalidPrefs    = errors.New("invalid prefs")
	ErrNoActiveSession = errors.New("no active session")
)

const randomHistoryLimit = 200

type RandomService struct {
	repo repository.RandomRepo
}

func NewRandomService(repo repository.RandomRepo) *RandomService {
	return &RandomService{repo: repo}
}

func validGender(g string) bool {
	return g == "male" || g == "female"
}

func validAge(a int) bool {
	return a >= domain.RandomMinAge && a <= domain.RandomMaxAge
}

func validatePrefs(p domain.RandomPrefs) error {
	if !validGender(p.Gender) || !domain.ValidAgeBand(p.AgeMin, p.AgeMax) {
		return ErrInvalidPrefs
	}
	if p.SeekGender != domain.SeekAny && !validGender(p.SeekGender) {
		return ErrInvalidPrefs
	}
	if !validAge(p.SeekAgeMin) || !validAge(p.SeekAgeMax) || p.SeekAgeMin > p.SeekAgeMax {
		return ErrInvalidPrefs
	}
	return nil
}

func sessionFromPeer(sessionID int64, peer domain.RandomGuest, at time.Time) domain.RandomSession {
	return domain.RandomSession{
		ID:         sessionID,
		PeerID:     peer.ID,
		PeerGender: peer.Gender,
		PeerAge:    domain.FormatAgeBand(peer.AgeMin, peer.AgeMax),
		Status:     domain.RandomSessionActive,
		CreatedAt:  at,
	}
}

func normalizeAnonID(raw string) (string, error) {
	id := strings.TrimSpace(raw)
	if id == "" {
		return newAnonID(), nil
	}
	if !anonIDRe.MatchString(id) {
		return "", ErrInvalidPrefs
	}
	return strings.ToLower(id), nil
}

func newAnonID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *RandomService) Start(ctx context.Context, prefs domain.RandomPrefs, anonID string) (domain.RandomGuest, error) {
	if err := validatePrefs(prefs); err != nil {
		return domain.RandomGuest{}, err
	}
	id, err := normalizeAnonID(anonID)
	if err != nil {
		return domain.RandomGuest{}, err
	}
	return s.repo.CreateGuest(ctx, prefs, id)
}

type MatchResult struct {
	Mine domain.RandomSession
	Peer domain.RandomSession
}

func (s *RandomService) Search(ctx context.Context, guestID string) (*MatchResult, error) {
	guest, err := s.repo.GetGuest(ctx, guestID)
	if err != nil {
		return nil, err
	}
	peer, sessionID, err := s.repo.Enqueue(ctx, guest)
	if err != nil || peer == nil {
		return nil, err
	}
	now := time.Now().UTC()
	return &MatchResult{
		Mine: sessionFromPeer(sessionID, *peer, now),
		Peer: sessionFromPeer(sessionID, guest, now),
	}, nil
}

func (s *RandomService) Cancel(ctx context.Context, guestID string) error {
	return s.repo.Dequeue(ctx, guestID)
}

func (s *RandomService) Leave(ctx context.Context, guestID string) (domain.RandomSession, error) {
	if err := s.repo.Dequeue(ctx, guestID); err != nil {
		return domain.RandomSession{}, err
	}
	sess, err := s.repo.EndActiveSession(ctx, guestID)
	if errors.Is(err, repository.ErrNotFound) {
		return domain.RandomSession{}, ErrNoActiveSession
	}
	return sess, err
}

func (s *RandomService) ActiveSession(ctx context.Context, guestID string) (domain.RandomSession, error) {
	sess, err := s.repo.ActiveSession(ctx, guestID)
	if errors.Is(err, repository.ErrNotFound) {
		return domain.RandomSession{}, ErrNoActiveSession
	}
	return sess, err
}

func (s *RandomService) History(ctx context.Context, guestID string) (domain.RandomSession, []domain.RandomMessage, error) {
	sess, err := s.ActiveSession(ctx, guestID)
	if err != nil {
		return domain.RandomSession{}, nil, err
	}
	messages, err := s.repo.ListMessages(ctx, sess.ID, randomHistoryLimit)
	if err != nil {
		return domain.RandomSession{}, nil, err
	}
	for i := range messages {
		messages[i].Mine = messages[i].FromGuest == guestID
	}
	return sess, messages, nil
}

func (s *RandomService) Send(ctx context.Context, guestID, text string, replyToID *int64) (domain.RandomMessage, string, error) {
	text, err := validateText(text)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	sess, err := s.ActiveSession(ctx, guestID)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	if replyToID != nil {
		reply, replySessionID, err := s.repo.GetMessage(ctx, *replyToID)
		if err != nil {
			return domain.RandomMessage{}, "", err
		}
		if replySessionID != sess.ID {
			return domain.RandomMessage{}, "", ErrForbidden
		}
		if reply.FromGuest == guestID {
			return domain.RandomMessage{}, "", ErrForbidden
		}
	}
	m, err := s.repo.CreateMessage(ctx, sess.ID, guestID, text, replyToID)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	m.Mine = true
	return m, sess.PeerID, nil
}

func (s *RandomService) PruneQueue(ctx context.Context, connected []string, queuedBefore time.Time) error {
	return s.repo.PruneQueue(ctx, connected, queuedBefore)
}
