package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Stock represents a stock/company information
type Stock struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Code        string             `bson:"code" json:"code"`                 // Stock code (e.g., "HPG")
	CompanyName string             `bson:"companyName" json:"companyName"`   // Company name
	Exchange    string             `bson:"exchange" json:"exchange"`         // HOSE, HNX, UPCOM
	Type        string             `bson:"type" json:"type"`                 // stock, bond, etc.
	Status      string             `bson:"status" json:"status"`             // listed, delisted, etc.
	CreatedAt   primitive.DateTime `bson:"createdAt" json:"createdAt"`
	UpdatedAt   primitive.DateTime `bson:"updatedAt" json:"updatedAt"`
}
