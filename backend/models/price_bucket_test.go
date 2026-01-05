package models

import (
	"testing"
)

func TestGenerateBucketID(t *testing.T) {
	tests := []struct {
		code     string
		year     int
		expected string
	}{
		{"HPG", 2024, "HPG_2024"},
		{"VNM", 2023, "VNM_2023"},
		{"FPT", 2022, "FPT_2022"},
	}

	for _, tt := range tests {
		result := GenerateBucketID(tt.code, tt.year)
		if result != tt.expected {
			t.Errorf("GenerateBucketID(%s, %d) = %s; want %s",
				tt.code, tt.year, result, tt.expected)
		}
	}
}

func TestGetYearFromDate(t *testing.T) {
	tests := []struct {
		dateStr  string
		expected int
		hasError bool
	}{
		{"2024-01-15", 2024, false},
		{"2023-12-31", 2023, false},
		{"2022-06-15", 2022, false},
		{"invalid-date", 0, true},
		{"2024/01/15", 0, true}, // Wrong format
	}

	for _, tt := range tests {
		result, err := GetYearFromDate(tt.dateStr)
		
		if tt.hasError {
			if err == nil {
				t.Errorf("GetYearFromDate(%s) expected error but got none", tt.dateStr)
			}
		} else {
			if err != nil {
				t.Errorf("GetYearFromDate(%s) unexpected error: %v", tt.dateStr, err)
			}
			if result != tt.expected {
				t.Errorf("GetYearFromDate(%s) = %d; want %d", tt.dateStr, result, tt.expected)
			}
		}
	}
}

func TestCandleDataStructure(t *testing.T) {
	candle := CandleData{
		D: "2024-01-15",
		O: 27.5,
		H: 28.0,
		L: 27.2,
		C: 27.9,
		V: 1500000,
	}

	if candle.D != "2024-01-15" {
		t.Errorf("CandleData.D = %s; want 2024-01-15", candle.D)
	}
	if candle.O != 27.5 {
		t.Errorf("CandleData.O = %f; want 27.5", candle.O)
	}
	if candle.V != 1500000 {
		t.Errorf("CandleData.V = %d; want 1500000", candle.V)
	}
}

func TestPriceBucketStructure(t *testing.T) {
	bucket := PriceBucket{
		ID:   "HPG_2024",
		Code: "HPG",
		Year: 2024,
		History: []CandleData{
			{D: "2024-01-15", O: 27.5, H: 28.0, L: 27.2, C: 27.9, V: 1500000},
			{D: "2024-01-16", O: 27.9, H: 28.5, L: 27.8, C: 28.3, V: 1800000},
		},
	}

	if bucket.ID != "HPG_2024" {
		t.Errorf("PriceBucket.ID = %s; want HPG_2024", bucket.ID)
	}
	if bucket.Code != "HPG" {
		t.Errorf("PriceBucket.Code = %s; want HPG", bucket.Code)
	}
	if bucket.Year != 2024 {
		t.Errorf("PriceBucket.Year = %d; want 2024", bucket.Year)
	}
	if len(bucket.History) != 2 {
		t.Errorf("PriceBucket.History length = %d; want 2", len(bucket.History))
	}
}
