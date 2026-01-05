package models

import (
	"time"

	"github.com/google/uuid"
)

// AdminUser represents the admin_users table in Supabase
// This table stores administrator accounts for the admin dashboard
type AdminUser struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;column:id" json:"id"`
	Email     string     `gorm:"type:text;not null;unique;column:email" json:"email"`
	Username  *string    `gorm:"type:text;unique;column:username" json:"username,omitempty"`
	FullName  *string    `gorm:"type:text;column:full_name" json:"full_name,omitempty"`
	Role      string     `gorm:"type:text;default:'admin';column:role" json:"role"`
	Active    bool       `gorm:"type:boolean;default:true;column:active" json:"active"`
	CreatedAt time.Time  `gorm:"type:timestamptz;default:now();column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"type:timestamptz;default:now();column:updated_at" json:"updated_at"`
	LastLogin *time.Time `gorm:"type:timestamptz;column:last_login" json:"last_login,omitempty"`
}

// TableName specifies the table name for GORM
// This ensures GORM queries the correct table in the public schema
func (AdminUser) TableName() string {
	return "public.admin_users"
}

// Profile represents the profiles table in Supabase
// This table stores user profiles linked to auth.users
type Profile struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primary_key;column:id" json:"id"`
	Email               string     `gorm:"type:text;not null;unique;column:email" json:"email"`
	PhoneNumber         string     `gorm:"type:text;not null;column:phone_number" json:"phone_number"`
	FullName            *string    `gorm:"type:text;column:full_name" json:"full_name,omitempty"`
	Nickname            *string    `gorm:"type:text;column:nickname" json:"nickname,omitempty"`
	StockAccountNumber  *string    `gorm:"type:text;column:stock_account_number" json:"stock_account_number,omitempty"`
	AvatarURL           *string    `gorm:"type:text;column:avatar_url" json:"avatar_url,omitempty"`
	ZaloID              *string    `gorm:"type:text;unique;column:zalo_id" json:"zalo_id,omitempty"`
	Birthday            *string    `gorm:"type:text;column:birthday" json:"birthday,omitempty"`
	Gender              *string    `gorm:"type:text;column:gender" json:"gender,omitempty"`
	Membership          string     `gorm:"type:text;default:'free';column:membership" json:"membership"`
	MembershipExpiresAt *time.Time `gorm:"type:timestamptz;column:membership_expires_at" json:"membership_expires_at,omitempty"`
	TCBSAPIKey          *string    `gorm:"type:text;column:tcbs_api_key" json:"tcbs_api_key,omitempty"`
	TCBSConnectedAt     *time.Time `gorm:"type:timestamptz;column:tcbs_connected_at" json:"tcbs_connected_at,omitempty"`
	CreatedAt           time.Time  `gorm:"type:timestamptz;default:now();column:created_at" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"type:timestamptz;default:now();column:updated_at" json:"updated_at"`
}

// TableName specifies the table name for GORM
// This ensures GORM queries the correct table in the public schema
func (Profile) TableName() string {
	return "public.profiles"
}
