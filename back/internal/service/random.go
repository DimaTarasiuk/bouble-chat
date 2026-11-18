package service

import (
	"context"
	"errors"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
)

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

func (s *RandomService) Start(ctx context.Context, prefs domain.RandomPrefs) (domain.RandomGuest, error) {
	if err := validatePrefs(prefs); err != nil {
		return domain.RandomGuest{}, err
	}
	return s.repo.CreateGuest(ctx, prefs)
}

type MatchResult struct {
	Mine domain.RandomSession
	Peer domain.RandomSession
}

// Search returns nil when the guest is left waiting in the queue.
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

// Leave takes the guest out of the queue and ends its active session.
// It returns the ended session, or ErrNoActiveSession if there was none.
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

// Send stores a message and returns it as seen by the sender, plus the peer ID.
func (s *RandomService) Send(ctx context.Context, guestID, text string) (domain.RandomMessage, string, error) {
	text, err := validateText(text)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	sess, err := s.ActiveSession(ctx, guestID)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	m, err := s.repo.CreateMessage(ctx, sess.ID, guestID, text)
	if err != nil {
		return domain.RandomMessage{}, "", err
	}
	m.Mine = true
	return m, sess.PeerID, nil
}

func (s *RandomService) PruneQueue(ctx context.Context, connected []string, queuedBefore time.Time) error {
	return s.repo.PruneQueue(ctx, connected, queuedBefore)
}
