package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"chat.com/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrCodeRequired = errors.New("code required")
	ErrInvalidCode  = errors.New("invalid code")
	ErrCodeMismatch = errors.New("code mismatch")
)

var hiddenCodePattern = regexp.MustCompile(`^\d{4,8}$`)

var hiddenCodeDummy []byte

func init() {
	hash, err := bcrypt.GenerateFromPassword([]byte("hidden-code-dummy"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	hiddenCodeDummy = hash
}

func validateHiddenCode(code, confirm string) error {
	code = strings.TrimSpace(code)
	confirm = strings.TrimSpace(confirm)
	if code == "" {
		return ErrCodeRequired
	}
	if !hiddenCodePattern.MatchString(code) {
		return ErrInvalidCode
	}
	if code != confirm {
		return ErrCodeMismatch
	}
	return nil
}

type UnlockResult struct {
	OK    bool
	Chats []domain.Conversation
}

func (s *ConversationService) Hide(ctx context.Context, userID, convID int64, code, confirm string) error {
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return err
	}
	_, hash, err := s.users.HiddenCode(ctx, userID)
	if err != nil {
		return err
	}
	if hash == "" {
		if err := validateHiddenCode(code, confirm); err != nil {
			return err
		}
		code = strings.TrimSpace(code)
		sum, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		saved, err := s.users.SetHiddenCode(ctx, userID, code, string(sum))
		if err != nil {
			return err
		}
		if !saved {
			_, hash, err = s.users.HiddenCode(ctx, userID)
			if err != nil {
				return err
			}
			if hash == "" {
				return ErrCodeRequired
			}
		}
	}
	return s.convs.HideForUser(ctx, convID, userID)
}

func (s *ConversationService) Unhide(ctx context.Context, userID, convID int64) error {
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return err
	}
	return s.convs.UnhideForUser(ctx, convID, userID)
}

func (s *ConversationService) Dismiss(ctx context.Context, userID, convID int64) error {
	if _, err := s.Get(ctx, userID, convID); err != nil {
		return err
	}
	if err := s.convs.BumpHistoryFloor(ctx, convID, userID); err != nil {
		return err
	}
	return s.convs.DismissForUser(ctx, convID, userID)
}

func (s *ConversationService) Unlock(ctx context.Context, userID int64, code string) (UnlockResult, error) {
	_, hash, err := s.users.HiddenCode(ctx, userID)
	if err != nil {
		return UnlockResult{}, err
	}
	compare := hash
	if compare == "" {
		compare = string(hiddenCodeDummy)
	}
	match := bcrypt.CompareHashAndPassword([]byte(compare), []byte(strings.TrimSpace(code))) == nil
	if hash == "" || !match {
		return UnlockResult{OK: false, Chats: []domain.Conversation{}}, nil
	}
	list, err := s.convs.ListHiddenForUser(ctx, userID)
	if err != nil {
		return UnlockResult{}, err
	}
	if list == nil {
		list = []domain.Conversation{}
	}
	return UnlockResult{OK: true, Chats: list}, nil
}

func (s *ConversationService) MessageNotice(ctx context.Context, peerID, convID int64) (string, error) {
	hidden, dismissed, err := s.convs.InboxState(ctx, convID, peerID)
	if err != nil {
		return "", err
	}
	if dismissed {
		return "none", nil
	}
	if hidden {
		return "hidden", nil
	}
	return "chat", nil
}
