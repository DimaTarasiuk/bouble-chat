package service

import (
	"testing"

	"chat.com/internal/domain"
)

func TestValidatePrefs(t *testing.T) {
	valid := domain.RandomPrefs{Gender: "male", Age: 25, SeekGender: "female", SeekAgeMin: 20, SeekAgeMax: 30}

	tests := []struct {
		name   string
		mutate func(*domain.RandomPrefs)
		ok     bool
	}{
		{"valid", func(*domain.RandomPrefs) {}, true},
		{"seek any", func(p *domain.RandomPrefs) { p.SeekGender = "any" }, true},
		{"equal range", func(p *domain.RandomPrefs) { p.SeekAgeMin, p.SeekAgeMax = 25, 25 }, true},
		{"own gender any", func(p *domain.RandomPrefs) { p.Gender = "any" }, false},
		{"own gender empty", func(p *domain.RandomPrefs) { p.Gender = "" }, false},
		{"bad seek gender", func(p *domain.RandomPrefs) { p.SeekGender = "other" }, false},
		{"underage", func(p *domain.RandomPrefs) { p.Age = 17 }, false},
		{"too old", func(p *domain.RandomPrefs) { p.Age = 100 }, false},
		{"seek min underage", func(p *domain.RandomPrefs) { p.SeekAgeMin = 16 }, false},
		{"inverted range", func(p *domain.RandomPrefs) { p.SeekAgeMin, p.SeekAgeMax = 30, 20 }, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := valid
			tt.mutate(&p)
			err := validatePrefs(p)
			if (err == nil) != tt.ok {
				t.Fatalf("validatePrefs(%+v) error = %v, want ok=%v", p, err, tt.ok)
			}
		})
	}
}
