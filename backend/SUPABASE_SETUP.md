# Supabase Admin Dashboard Integration - Quick Setup Guide

This guide helps you set up the PostgreSQL/Supabase integration for the Go backend admin dashboard.

## Problem Solved

✅ Admin dashboard displays but user management shows "No users found"  
✅ Need to connect Go backend to PostgreSQL (Supabase) instead of MongoDB  
✅ Need proper GORM models with correct struct tags and table names  
✅ Need RLS bypass for admin access  
✅ Need debug logging to see actual SQL queries  

## Quick Setup (5 Minutes)

### 1. Get Supabase Credentials

#### Database URL
1. Go to your Supabase project
2. Click **Settings** → **Database**
3. Scroll to **Connection string** → **URI**
4. Copy the connection string (should look like):
   ```
   postgresql://postgres.[password]@db.[project-ref].supabase.co:5432/postgres
   ```
5. **Important**: Add `?search_path=public` at the end:
   ```
   postgresql://postgres.[password]@db.[project-ref].supabase.co:5432/postgres?search_path=public
   ```

#### Service Role Key (for RLS bypass)
1. Go to **Settings** → **API**
2. Find **Project API keys**
3. Copy the `service_role` key ⚠️ (This is secret!)

### 2. Set Environment Variables

Create or update your `.env` file:

```bash
# Required
DATABASE_URL=postgresql://postgres.[password]@db.[project-ref].supabase.co:5432/postgres?search_path=public

# Recommended (for RLS bypass)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Admin credentials (for login)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Session secret
SESSION_SECRET=your-random-secret-key
```

### 3. Create Admin Users Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Add sample data for testing
INSERT INTO public.admin_users (email, username, full_name, role) VALUES
  ('admin@cpls.com', 'admin', 'System Administrator', 'super_admin'),
  ('manager@cpls.com', 'manager', 'Dashboard Manager', 'admin');
```

Or run the migration file:
```bash
# The migration file is at: supabase/migrations/20260105_create_admin_users.sql
# Copy the SQL and run it in Supabase SQL Editor
```

### 4. Install Dependencies

```bash
cd backend
go mod download
```

### 5. Run the Server

```bash
cd backend
go run main.go
```

You should see:
```
✓ Connected to PostgreSQL (Supabase)
✓ GORM Debug mode enabled - SQL queries will be logged
✓ RLS bypass enabled (session_replication_role = replica)
🚀 Server starting on port 8080
```

### 6. Test the API

Open another terminal:

```bash
# Test admin users endpoint
curl http://localhost:8080/admin/api/admin-users

# Test profiles endpoint  
curl http://localhost:8080/admin/api/profiles
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "email": "admin@cpls.com",
      "username": "admin",
      "full_name": "System Administrator",
      "role": "super_admin",
      "active": true
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 50
}
```

## Files Created

### Core Implementation
- `models/user.go` - AdminUser and Profile structs with GORM tags
- `config/postgres.go` - PostgreSQL connection with GORM
- `services/user_service.go` - User data access layer
- `controllers/admin_controller.go` - API endpoints (updated)
- `main.go` - PostgreSQL initialization (updated)

### Documentation
- `docs/USER_MANAGEMENT_GUIDE.md` - Detailed implementation guide
- `backend/SUPABASE_SETUP.md` - This quick setup guide
- `supabase/migrations/20260105_create_admin_users.sql` - Database migration

### Configuration
- `.env.example` - Updated with PostgreSQL variables

## API Endpoints

### GET /admin/api/admin-users
Get all admin users (with optional pagination)

**Query Parameters:**
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 50, max: 100)

**Example:**
```bash
curl "http://localhost:8080/admin/api/admin-users?page=1&page_size=20"
```

### GET /admin/api/profiles
Get all user profiles (with optional pagination)

**Query Parameters:**
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 50, max: 100)

**Example:**
```bash
curl "http://localhost:8080/admin/api/profiles?page=1&page_size=20"
```

## Debugging

### Check SQL Queries in Terminal

When you run the server, you'll see all SQL queries logged:

```bash
=== GetAdminUsers: Starting query ===

[2024-01-05 10:30:00]  [3.45ms]  SELECT * FROM "public"."admin_users"
[2 rows affected or returned]

✓ GetAdminUsers: Found 2 admin users
  [1] ID: xxx, Email: admin@cpls.com, Username: admin, Role: super_admin, Active: true
  [2] ID: yyy, Email: manager@cpls.com, Username: manager, Role: admin, Active: true
```

### Common Issues

#### Issue: "No users found" even with data in database

**Cause:** RLS (Row Level Security) is blocking access

**Solution:**
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`
2. Restart the server
3. Look for: `✓ RLS bypass enabled` in logs
4. If not present, check your service role key is correct

#### Issue: "failed to connect to PostgreSQL"

**Cause:** Invalid DATABASE_URL

**Solution:**
1. Check DATABASE_URL format includes `?search_path=public`
2. Verify password and project-ref are correct
3. Test connection with psql:
   ```bash
   psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
   ```

#### Issue: Table not found

**Cause:** admin_users table doesn't exist

**Solution:**
1. Run the SQL migration in Supabase SQL Editor
2. Verify table exists:
   ```sql
   SELECT * FROM public.admin_users;
   ```

## Key Features Explained

### 1. GORM Models with Proper Tags

```go
type AdminUser struct {
    ID    uuid.UUID `gorm:"type:uuid;primary_key;column:id" json:"id"`
    Email string    `gorm:"type:text;not null;unique;column:email" json:"email"`
    // ...
}
```

- `gorm:"column:..."` - Maps to database column
- `json:"..."` - JSON response field name
- `uuid.UUID` - Proper UUID type support

### 2. Table Name Configuration

```go
func (AdminUser) TableName() string {
    return "public.admin_users"
}
```

Ensures GORM queries the correct table in the public schema.

### 3. RLS Bypass

```go
db.Exec("SET session_replication_role = 'replica'")
```

When using service_role key, this bypasses all RLS policies, allowing the backend to read all data.

### 4. Debug Logging

```go
logger.Config{
    LogLevel: logger.Info,  // Shows all SQL queries
}
```

All SQL queries are logged to help debug issues.

## Next Steps

1. ✅ Basic setup complete
2. 🔄 Update dashboard HTML to display users
3. 🔄 Add CRUD operations (Create, Update, Delete)
4. 🔄 Add search and filtering
5. 🔄 Implement proper authentication with database

## Support

For detailed documentation, see:
- `docs/USER_MANAGEMENT_GUIDE.md` - Complete implementation guide
- [GORM Documentation](https://gorm.io/docs/)
- [Supabase Documentation](https://supabase.com/docs)

## Testing Checklist

- [ ] Database URL is set correctly
- [ ] Service role key is set
- [ ] admin_users table exists with data
- [ ] profiles table exists with data
- [ ] Server starts without errors
- [ ] See "✓ RLS bypass enabled" in logs
- [ ] SQL queries are logged in terminal
- [ ] API returns data successfully
