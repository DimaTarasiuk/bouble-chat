package service

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"chat.com/internal/domain"
	"chat.com/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func TestValidateHiddenCode(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		confirm string
		err     error
	}{
		{"ok 4", "1234", "1234", nil},
		{"ok 8", "12345678", "12345678", nil},
		{"trim", " 1234 ", "1234", nil},
		{"empty", "", "", ErrCodeRequired},
		{"short", "123", "123", ErrInvalidCode},
		{"long", "123456789", "123456789", ErrInvalidCode},
		{"letters", "12ab", "12ab", ErrInvalidCode},
		{"mismatch", "1234", "1235", ErrCodeMismatch},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateHiddenCode(tt.code, tt.confirm)
			if !errors.Is(err, tt.err) {
				t.Fatalf("validateHiddenCode() = %v, want %v", err, tt.err)
			}
		})
	}
}

func TestHideAndUnlock(t *testing.T) {
	users := newFakeUsers(domain.User{ID: 1, Username: "me"}, domain.User{ID: 2, Username: "peer"})
	convs := newFakeConvs()
	conv := mustCreatePair(t, convs, 1, 2)
	svc := NewConversationService(users, convs, fakeMsgs{})
	ctx := context.Background()

	if err := svc.Hide(ctx, 1, conv.ID, "", ""); !errors.Is(err, ErrCodeRequired) {
		t.Fatalf("first hide without code: %v", err)
	}
	if err := svc.Hide(ctx, 1, conv.ID, "12", "12"); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("short code: %v", err)
	}
	if err := svc.Hide(ctx, 1, conv.ID, "1234", "9999"); !errors.Is(err, ErrCodeMismatch) {
		t.Fatalf("mismatch: %v", err)
	}
	if err := svc.Hide(ctx, 9, conv.ID, "1234", "1234"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger: %v", err)
	}
	if err := svc.Hide(ctx, 1, conv.ID, "1234", "1234"); err != nil {
		t.Fatalf("hide: %v", err)
	}
	if users.code[1] != "1234" {
		t.Fatalf("plain code = %q", users.code[1])
	}
	if bcrypt.CompareHashAndPassword([]byte(users.hash[1]), []byte("1234")) != nil {
		t.Fatal("stored hash does not match code")
	}

	visible, err := convs.ListForUser(ctx, 1)
	if err != nil || len(visible) != 0 {
		t.Fatalf("visible after hide: %v len=%d", err, len(visible))
	}
	hidden, err := convs.ListHiddenForUser(ctx, 1)
	if err != nil || len(hidden) != 1 || hidden[0].ID != conv.ID {
		t.Fatalf("hidden list: %+v err=%v", hidden, err)
	}

	peerVisible, err := convs.ListForUser(ctx, 2)
	if err != nil || len(peerVisible) != 1 {
		t.Fatalf("peer still sees chat: %v len=%d", err, len(peerVisible))
	}

	wrong, err := svc.Unlock(ctx, 1, "0000")
	if err != nil || wrong.OK {
		t.Fatalf("wrong unlock: %+v err=%v", wrong, err)
	}
	none, err := svc.Unlock(ctx, 2, "1234")
	if err != nil || none.OK {
		t.Fatalf("user without code: %+v err=%v", none, err)
	}
	ok, err := svc.Unlock(ctx, 1, "1234")
	if err != nil || !ok.OK || len(ok.Chats) != 1 {
		t.Fatalf("unlock: %+v err=%v", ok, err)
	}

	if err := svc.Hide(ctx, 1, conv.ID, "9999", "9999"); err != nil {
		t.Fatalf("second hide: %v", err)
	}
	if users.code[1] != "1234" {
		t.Fatalf("code overwritten: %q", users.code[1])
	}

	again, err := svc.FindOrCreate(ctx, 1, "peer")
	if err != nil || !again.Hidden || again.ID != conv.ID {
		t.Fatalf("reopen hidden: %+v err=%v", again, err)
	}
	visible, err = convs.ListForUser(ctx, 1)
	if err != nil || len(visible) != 0 {
		t.Fatalf("hidden chat leaked into the visible list: %v len=%d", err, len(visible))
	}
}

func TestUnhideDismissAndReopen(t *testing.T) {
	users := newFakeUsers(domain.User{ID: 1, Username: "me"}, domain.User{ID: 2, Username: "peer"})
	convs := newFakeConvs()
	conv := mustCreatePair(t, convs, 1, 2)
	svc := NewConversationService(users, convs, fakeMsgs{})
	ctx := context.Background()

	if err := svc.Hide(ctx, 1, conv.ID, "1234", "1234"); err != nil {
		t.Fatalf("hide: %v", err)
	}
	notice, err := svc.MessageNotice(ctx, 1, conv.ID)
	if err != nil || notice != "hidden" {
		t.Fatalf("notice hidden = %q err=%v", notice, err)
	}
	if err := svc.Unhide(ctx, 1, conv.ID); err != nil {
		t.Fatalf("unhide: %v", err)
	}
	visible, err := convs.ListForUser(ctx, 1)
	if err != nil || len(visible) != 1 {
		t.Fatalf("after unhide: %v len=%d", err, len(visible))
	}
	notice, err = svc.MessageNotice(ctx, 1, conv.ID)
	if err != nil || notice != "chat" {
		t.Fatalf("notice chat = %q err=%v", notice, err)
	}

	if err := svc.Hide(ctx, 1, conv.ID, "", ""); err != nil {
		t.Fatalf("hide again: %v", err)
	}
	if err := svc.Dismiss(ctx, 1, conv.ID); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	visible, _ = convs.ListForUser(ctx, 1)
	hidden, _ := convs.ListHiddenForUser(ctx, 1)
	if len(visible) != 0 || len(hidden) != 0 {
		t.Fatalf("dismissed still listed visible=%d hidden=%d", len(visible), len(hidden))
	}
	notice, err = svc.MessageNotice(ctx, 1, conv.ID)
	if err != nil || notice != "none" {
		t.Fatalf("notice none = %q err=%v", notice, err)
	}

	reopened, err := svc.FindOrCreate(ctx, 1, "peer")
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if reopened.ID != conv.ID || !reopened.Dismissed {
		t.Fatalf("reopen = %+v, want same id still dismissed", reopened)
	}
	visible, err = convs.ListForUser(ctx, 1)
	if err != nil || len(visible) != 0 {
		t.Fatalf("dismissed chat returned to the list: %+v err=%v", visible, err)
	}
}

func TestDismissThenSendStartsFreshHistory(t *testing.T) {
	users := newFakeUsers(domain.User{ID: 1, Username: "me"}, domain.User{ID: 2, Username: "peer"})
	convs := newFakeConvs()
	conv := mustCreatePair(t, convs, 1, 2)
	msgs := &memMsgs{}
	convs.maxID = msgs.maxID
	svc := NewConversationService(users, convs, msgs)
	ctx := context.Background()

	if _, _, err := svc.Send(ctx, 2, "peer", conv.ID, "старе", nil); err != nil {
		t.Fatalf("peer send: %v", err)
	}
	if _, _, err := svc.Send(ctx, 1, "me", conv.ID, "теж старе", nil); err != nil {
		t.Fatalf("own send: %v", err)
	}
	if err := svc.Dismiss(ctx, 1, conv.ID); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	got, err := svc.Messages(ctx, 1, conv.ID, nil, 50)
	if err != nil || len(got) != 0 {
		t.Fatalf("history after dismiss: %+v err=%v", got, err)
	}
	peerView, err := svc.Messages(ctx, 2, conv.ID, nil, 50)
	if err != nil || len(peerView) != 2 {
		t.Fatalf("peer still sees history: %+v err=%v", peerView, err)
	}

	fresh, _, err := svc.Send(ctx, 1, "me", conv.ID, "наново", nil)
	if err != nil {
		t.Fatalf("restart send: %v", err)
	}
	got, err = svc.Messages(ctx, 1, conv.ID, nil, 50)
	if err != nil || len(got) != 1 || got[0].ID != fresh.ID || got[0].Text != "наново" {
		t.Fatalf("fresh history: %+v err=%v", got, err)
	}
	peerView, err = svc.Messages(ctx, 2, conv.ID, nil, 50)
	if err != nil || len(peerView) != 3 {
		t.Fatalf("peer continued thread: %+v err=%v", peerView, err)
	}
	_, dismissed, err := convs.InboxState(ctx, conv.ID, 1)
	if err != nil || dismissed {
		t.Fatalf("dismissed after new message: %v err=%v", dismissed, err)
	}
}

type fakeUsers struct {
	byID map[int64]domain.User
	code map[int64]string
	hash map[int64]string
}

func newFakeUsers(users ...domain.User) *fakeUsers {
	f := &fakeUsers{
		byID: map[int64]domain.User{},
		code: map[int64]string{},
		hash: map[int64]string{},
	}
	for _, u := range users {
		f.byID[u.ID] = u
	}
	return f
}

func (f *fakeUsers) Create(context.Context, string, string, string) (domain.User, error) {
	return domain.User{}, repository.ErrNotFound
}
func (f *fakeUsers) GetByID(_ context.Context, id int64) (domain.User, error) {
	u, ok := f.byID[id]
	if !ok {
		return domain.User{}, repository.ErrNotFound
	}
	return u, nil
}
func (f *fakeUsers) GetByUsername(_ context.Context, username string) (domain.User, error) {
	for _, u := range f.byID {
		if u.Username == username {
			return u, nil
		}
	}
	return domain.User{}, repository.ErrNotFound
}
func (f *fakeUsers) Search(context.Context, string, int64, int) ([]domain.User, error) {
	return nil, nil
}
func (f *fakeUsers) ListAll(context.Context) ([]domain.User, error) { return nil, nil }
func (f *fakeUsers) UpdateRole(context.Context, string, string) (domain.User, error) {
	return domain.User{}, repository.ErrNotFound
}
func (f *fakeUsers) UpdateProfile(context.Context, int64, repository.ProfileUpdate) (domain.User, error) {
	return domain.User{}, repository.ErrNotFound
}
func (f *fakeUsers) TouchLastSeen(context.Context, int64) error { return nil }
func (f *fakeUsers) GetAuthState(context.Context, int64) (domain.AuthState, error) {
	return domain.AuthState{}, repository.ErrNotFound
}
func (f *fakeUsers) HiddenCode(_ context.Context, userID int64) (string, string, error) {
	if _, ok := f.byID[userID]; !ok {
		return "", "", repository.ErrNotFound
	}
	return f.code[userID], f.hash[userID], nil
}
func (f *fakeUsers) SetHiddenCode(_ context.Context, userID int64, code, hash string) (bool, error) {
	if _, ok := f.byID[userID]; !ok {
		return false, repository.ErrNotFound
	}
	if f.hash[userID] != "" {
		return false, nil
	}
	f.code[userID] = code
	f.hash[userID] = hash
	return true, nil
}

type storedConv struct {
	domain.Conversation
	a int64
	b int64
}

type fakeConvs struct {
	items     map[int64]storedConv
	hidden    map[string]bool
	dismissed map[string]bool
	floor     map[string]int64
	maxID     func(conversationID int64) int64
	next      int64
}

func newFakeConvs() *fakeConvs {
	return &fakeConvs{
		items:     map[int64]storedConv{},
		hidden:    map[string]bool{},
		dismissed: map[string]bool{},
		floor:     map[string]int64{},
		next:      1,
	}
}

func mustCreatePair(t *testing.T, convs *fakeConvs, a, b int64) domain.Conversation {
	t.Helper()
	c, err := convs.Create(context.Background(), a, b, "peer", "male")
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func flagKey(convID, userID int64) string {
	return strconv.FormatInt(convID, 10) + ":" + strconv.FormatInt(userID, 10)
}

func (f *fakeConvs) FindPair(_ context.Context, userA, userB int64) (domain.Conversation, error) {
	for _, item := range f.items {
		if (item.a == userA && item.b == userB) || (item.a == userB && item.b == userA) {
			return item.Conversation, nil
		}
	}
	return domain.Conversation{}, repository.ErrNotFound
}

func (f *fakeConvs) Create(_ context.Context, initiatorID, recipientID int64, peer, peerGender string) (domain.Conversation, error) {
	c := domain.Conversation{
		ID:         f.next,
		PeerID:     recipientID,
		Peer:       peer,
		PeerGender: peerGender,
		CreatedAt:  time.Unix(f.next, 0).UTC(),
	}
	f.next++
	f.items[c.ID] = storedConv{Conversation: c, a: initiatorID, b: recipientID}
	return c, nil
}

func (f *fakeConvs) ListForUser(_ context.Context, userID int64) ([]domain.Conversation, error) {
	return f.list(userID, false), nil
}

func (f *fakeConvs) ListHiddenForUser(_ context.Context, userID int64) ([]domain.Conversation, error) {
	return f.list(userID, true), nil
}

func (f *fakeConvs) list(userID int64, hiddenOnly bool) []domain.Conversation {
	out := make([]domain.Conversation, 0)
	for _, item := range f.items {
		if item.a != userID && item.b != userID {
			continue
		}
		key := flagKey(item.ID, userID)
		if f.dismissed[key] {
			continue
		}
		if f.hidden[key] != hiddenOnly {
			continue
		}
		out = append(out, item.Conversation)
	}
	return out
}

func (f *fakeConvs) GetByID(_ context.Context, id, userID int64) (domain.Conversation, error) {
	item, ok := f.items[id]
	if !ok || (item.a != userID && item.b != userID) {
		return domain.Conversation{}, repository.ErrNotFound
	}
	return item.Conversation, nil
}

func (f *fakeConvs) MarkRead(context.Context, int64, int64) error { return nil }

func (f *fakeConvs) HideForUser(_ context.Context, conversationID, userID int64) error {
	f.hidden[flagKey(conversationID, userID)] = true
	delete(f.dismissed, flagKey(conversationID, userID))
	return nil
}

func (f *fakeConvs) UnhideForUser(_ context.Context, conversationID, userID int64) error {
	delete(f.hidden, flagKey(conversationID, userID))
	return nil
}

func (f *fakeConvs) DismissForUser(_ context.Context, conversationID, userID int64) error {
	f.dismissed[flagKey(conversationID, userID)] = true
	delete(f.hidden, flagKey(conversationID, userID))
	return nil
}

func (f *fakeConvs) ClearDismissed(_ context.Context, conversationID, userID int64) error {
	delete(f.dismissed, flagKey(conversationID, userID))
	return nil
}

func (f *fakeConvs) InboxState(_ context.Context, conversationID, userID int64) (bool, bool, error) {
	key := flagKey(conversationID, userID)
	return f.hidden[key], f.dismissed[key], nil
}

func (f *fakeConvs) HistoryFloor(_ context.Context, conversationID, userID int64) (int64, error) {
	return f.floor[flagKey(conversationID, userID)], nil
}

func (f *fakeConvs) BumpHistoryFloor(_ context.Context, conversationID, userID int64) error {
	var maxID int64
	if f.maxID != nil {
		maxID = f.maxID(conversationID)
	}
	f.floor[flagKey(conversationID, userID)] = maxID
	return nil
}

type fakeMsgs struct{}

func (fakeMsgs) ListPage(context.Context, int64, *int64, int64, int) ([]domain.Message, error) {
	return nil, nil
}
func (fakeMsgs) GetByID(context.Context, int64) (domain.Message, int64, error) {
	return domain.Message{}, 0, repository.ErrNotFound
}
func (fakeMsgs) Create(context.Context, int64, int64, string, string, *int64) (domain.Message, error) {
	return domain.Message{}, nil
}
func (fakeMsgs) UpdateText(context.Context, int64, string) (domain.Message, error) {
	return domain.Message{}, nil
}

type storedMsg struct {
	domain.Message
	convID int64
}

type memMsgs struct {
	next  int64
	items []storedMsg
}

func (m *memMsgs) maxID(conversationID int64) int64 {
	var maxID int64
	for _, item := range m.items {
		if item.convID == conversationID && item.ID > maxID {
			maxID = item.ID
		}
	}
	return maxID
}

func (m *memMsgs) ListPage(_ context.Context, conversationID int64, beforeID *int64, afterID int64, limit int) ([]domain.Message, error) {
	out := make([]domain.Message, 0)
	for i := len(m.items) - 1; i >= 0 && len(out) < limit; i-- {
		item := m.items[i]
		if item.convID != conversationID || item.ID <= afterID {
			continue
		}
		if beforeID != nil && item.ID >= *beforeID {
			continue
		}
		out = append(out, item.Message)
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}

func (m *memMsgs) GetByID(_ context.Context, id int64) (domain.Message, int64, error) {
	for _, item := range m.items {
		if item.ID == id {
			return item.Message, item.convID, nil
		}
	}
	return domain.Message{}, 0, repository.ErrNotFound
}

func (m *memMsgs) Create(_ context.Context, conversationID, userID int64, username, text string, _ *int64) (domain.Message, error) {
	m.next++
	id := userID
	msg := domain.Message{ID: m.next, UserID: &id, From: username, Text: text, CreatedAt: time.Unix(m.next, 0).UTC()}
	m.items = append(m.items, storedMsg{Message: msg, convID: conversationID})
	return msg, nil
}

func (m *memMsgs) UpdateText(context.Context, int64, string) (domain.Message, error) {
	return domain.Message{}, nil
}
