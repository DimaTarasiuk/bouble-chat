package service

import (
	"testing"

	"chat.com/internal/domain"
)

func TestValidatePrefs(t *testing.T) {
	valid := domain.RandomPrefs{
		Gender: "male", AgeMin: 23, AgeMax: 28,
		SeekGender: "female", SeekAgeMin: 20, SeekAgeMax: 30,
	}

	tests := []struct {
		name   string
		mutate func(*domain.RandomPrefs)
		ok     bool
	}{
		{"valid 23-28", func(*domain.RandomPrefs) {}, true},
		{"valid 18-22", func(p *domain.RandomPrefs) { p.AgeMin, p.AgeMax = 18, 22 }, true},
		{"valid 28-30+", func(p *domain.RandomPrefs) { p.AgeMin, p.AgeMax = 28, domain.RandomMaxAge }, true},
		{"seek any", func(p *domain.RandomPrefs) { p.SeekGender = "any" }, true},
		{"equal seek range", func(p *domain.RandomPrefs) { p.SeekAgeMin, p.SeekAgeMax = 25, 25 }, true},
		{"own gender any", func(p *domain.RandomPrefs) { p.Gender = "any" }, false},
		{"own gender empty", func(p *domain.RandomPrefs) { p.Gender = "" }, false},
		{"bad seek gender", func(p *domain.RandomPrefs) { p.SeekGender = "other" }, false},
		{"free age not a band", func(p *domain.RandomPrefs) { p.AgeMin, p.AgeMax = 25, 25 }, false},
		{"wrong band bounds", func(p *domain.RandomPrefs) { p.AgeMin, p.AgeMax = 18, 28 }, false},
		{"seek min underage", func(p *domain.RandomPrefs) { p.SeekAgeMin = 16 }, false},
		{"inverted seek range", func(p *domain.RandomPrefs) { p.SeekAgeMin, p.SeekAgeMax = 30, 20 }, false},
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

func TestFormatAgeBand(t *testing.T) {
	if got := domain.FormatAgeBand(28, domain.RandomMaxAge); got != "28-30+" {
		t.Fatalf("FormatAgeBand(28, 99) = %q", got)
	}
	if got := domain.FormatAgeBand(18, 22); got != "18-22" {
		t.Fatalf("FormatAgeBand(18, 22) = %q", got)
	}
}
