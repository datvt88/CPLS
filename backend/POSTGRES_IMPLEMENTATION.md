# GORM PostgreSQL Implementation Summary

## What Was Implemented

This implementation converts the Go backend from MongoDB to PostgreSQL (Supabase) with proper GORM models for admin dashboard user management.

### Problem Addressed

✅ Admin dashboard displays but user management shows "No users found"  
✅ Backend needed to connect to PostgreSQL (Supabase) with proper GORM models  
✅ Need proper struct tags, table name configuration, and schema handling  
✅ Need RLS (Row Level Security) bypass for admin access  
✅ Need debug mode to see SQL queries in terminal  

### Solution Overview

1. **GORM Integration** - Added PostgreSQL driver and GORM ORM
2. **Proper Models** - Created AdminUser and Profile structs with correct tags
3. **Service Layer** - Implemented user service with detailed logging
4. **API Endpoints** - Added REST endpoints for user management
5. **RLS Bypass** - Configured automatic RLS bypass with service role key
6. **Debug Logging** - Enabled SQL query logging for troubleshooting
7. **Documentation** - Created comprehensive setup and usage guides

## Files Created

### Core Implementation
```
backend/
├── models/user.go              # AdminUser & Profile structs with GORM tags
├── config/postgres.go          # PostgreSQL connection with GORM
├── services/user_service.go    # User data access layer with logging
├── controllers/admin_controller.go  # Updated with API endpoints
├── main.go                     # Updated to use PostgreSQL
└── templates/users.html        # User management UI
```

### Database
```
supabase/migrations/
└── 20260105_create_admin_users.sql  # Admin users table migration
```

### Documentation
```
backend/
├── SUPABASE_SETUP.md           # Quick setup guide (5 minutes)
├── docs/USER_MANAGEMENT_GUIDE.md  # Detailed implementation guide
└── .env.example                # Updated with PostgreSQL config
```

## Key Features

### 1. Proper GORM Models

```go
type AdminUser struct {
    ID        uuid.UUID  `gorm:"type:uuid;primary_key;column:id" json:"id"`
    Email     string     `gorm:"type:text;not null;unique;column:email" json:"email"`
    Username  string     `gorm:"type:text;unique;column:username" json:"username,omitempty"`
    // ... more fields
}

func (AdminUser) TableName() string {
    return "public.admin_users"  // Ensures correct schema.table
}
```

**Features:**
- ✅ UUID support for Supabase
- ✅ Explicit column mappings with `gorm:"column:..."`
- ✅ JSON tags for API responses
- ✅ Nullable fields using pointers
- ✅ TableName() for schema.table specification

### 2. PostgreSQL Configuration

```go
// Automatic search_path configuration
db.Exec("SET search_path TO public")

// RLS bypass for admin access
if serviceRoleKey != "" {
    db.Exec("SET session_replication_role = 'replica'")
}
```

**Features:**
- ✅ Connection pooling configured
- ✅ Automatic schema path setting
- ✅ RLS bypass when service role key is present
- ✅ Debug logging enabled by default

### 3. Debug Mode

```go
logger.Config{
    LogLevel: logger.Info,  // Shows all SQL queries
    Colorful: true,         // Colored output
}
```

**Console Output:**
```
[2024-01-05 10:30:00]  [3.45ms]  SELECT * FROM "public"."admin_users"
[2 rows affected or returned]
```

### 4. Service Layer with Logging

```go
func (s *UserService) GetAdminUsers() ([]models.AdminUser, error) {
    log.Println("=== GetAdminUsers: Starting query ===")
    
    var adminUsers []models.AdminUser
    db := config.GetDB()
    result := db.Find(&adminUsers)
    
    log.Printf("✓ GetAdminUsers: Found %d admin users", result.RowsAffected)
    return adminUsers, nil
}
```

**Features:**
- ✅ Detailed logging at every step
- ✅ Error handling with context
- ✅ Row counts and data details
- ✅ Pagination support
- ✅ Helpful debug messages

### 5. REST API Endpoints

**GET /admin/api/admin-users**
```json
{
  "success": true,
  "data": [...],
  "total": 10,
  "page": 1,
  "page_size": 50
}
```

**GET /admin/api/profiles**
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "page_size": 50
}
```

Both endpoints support pagination via query parameters.

### 6. User Management UI

**GET /admin/users** - Beautiful dashboard with:
- ✅ Tabbed interface (Admin Users / Profiles)
- ✅ Statistics cards
- ✅ Sortable tables
- ✅ Real-time data loading
- ✅ Error handling
- ✅ Responsive design

## Quick Start

### 1. Set Environment Variables

```bash
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?search_path=public
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Create Admin Users Table

Run the SQL in `supabase/migrations/20260105_create_admin_users.sql`

### 3. Run the Server

```bash
cd backend
go run main.go
```

### 4. Access the Dashboard

1. Login: http://localhost:8080/admin/login
2. Dashboard: http://localhost:8080/admin/dashboard
3. User Management: http://localhost:8080/admin/users

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Service role key for RLS bypass |
| `ADMIN_USERNAME` | No | Admin login username (default: admin) |
| `ADMIN_PASSWORD` | No | Admin login password (default: admin123) |
| `SESSION_SECRET` | Yes | Session encryption key |
| `PORT` | No | Server port (default: 8080) |

### Database Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?search_path=public
```

**Important:** Always add `?search_path=public` at the end!

## API Reference

### Admin Users Endpoints

#### GET /admin/api/admin-users

Get all admin users with optional pagination.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `page_size` (optional) - Items per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "admin@example.com",
      "username": "admin",
      "full_name": "Admin User",
      "role": "super_admin",
      "active": true,
      "created_at": "2024-01-05T00:00:00Z",
      "updated_at": "2024-01-05T00:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 50
}
```

### User Profiles Endpoints

#### GET /admin/api/profiles

Get all user profiles with optional pagination.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `page_size` (optional) - Items per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "phone_number": "+84912345678",
      "full_name": "User Name",
      "nickname": "username",
      "membership": "premium",
      "created_at": "2024-01-05T00:00:00Z",
      "updated_at": "2024-01-05T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 50
}
```

## Debugging Guide

### Check SQL Queries

When running the server, watch for SQL queries in the console:

```bash
=== GetAdminUsers: Starting query ===

[2024-01-05 10:30:00]  [3.45ms]  SELECT * FROM "public"."admin_users"
[2 rows affected or returned]

✓ GetAdminUsers: Found 2 admin users
  [1] ID: xxx, Email: admin@cpls.com, Username: admin
```

### Common Issues

#### "No users found"

**Cause:** RLS blocking access  
**Solution:** Set `SUPABASE_SERVICE_ROLE_KEY` and restart

#### "Table not found"

**Cause:** Table doesn't exist or wrong schema  
**Solution:** Run migration SQL and verify `search_path=public` in URL

#### "Connection failed"

**Cause:** Invalid DATABASE_URL  
**Solution:** Verify format and credentials

### Log Levels

The implementation uses three types of logs:

1. **✓** - Success messages
2. **❌** - Error messages  
3. **⚠** - Warning messages

## Testing

### Manual Testing

```bash
# Test admin users endpoint
curl http://localhost:8080/admin/api/admin-users

# Test profiles endpoint
curl http://localhost:8080/admin/api/profiles

# Test with pagination
curl "http://localhost:8080/admin/api/admin-users?page=1&page_size=10"
```

### Check Database

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('admin_users', 'profiles');

-- Check data
SELECT COUNT(*) FROM public.admin_users;
SELECT COUNT(*) FROM public.profiles;
```

## Migration from MongoDB

The implementation keeps MongoDB support for backward compatibility:

```go
// PostgreSQL (new - primary)
if err := config.ConnectPostgres(); err != nil {
    log.Fatalf("Failed to connect to PostgreSQL: %v", err)
}

// MongoDB (old - commented out but available)
// if err := config.ConnectMongoDB(); err != nil {
//     log.Printf("Warning: Failed to connect to MongoDB: %v", err)
// }
```

To fully migrate:
1. Migrate all data from MongoDB to PostgreSQL
2. Test thoroughly
3. Remove MongoDB connection code
4. Remove MongoDB dependencies

## Next Steps

### Recommended Enhancements

1. **Authentication** - Implement proper admin authentication with database
2. **CRUD Operations** - Add Create, Update, Delete endpoints
3. **Search & Filter** - Add search and filtering capabilities
4. **Role-Based Access** - Implement proper RBAC
5. **Audit Logging** - Track all admin actions
6. **Password Hashing** - Use bcrypt for passwords
7. **API Keys** - Generate API keys for admin users

### Production Checklist

- [ ] Set strong SESSION_SECRET
- [ ] Use environment-specific credentials
- [ ] Enable HTTPS (Cloud Run does this automatically)
- [ ] Set up proper admin authentication
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Test RLS policies
- [ ] Review security best practices

## Support & Resources

### Documentation
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Quick setup guide
- [docs/USER_MANAGEMENT_GUIDE.md](./docs/USER_MANAGEMENT_GUIDE.md) - Detailed guide

### External Resources
- [GORM Documentation](https://gorm.io/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Gin Framework](https://gin-gonic.com/docs/)

### Troubleshooting

If you encounter issues:

1. Check terminal logs for SQL queries and errors
2. Verify environment variables are set correctly
3. Test database connection with psql
4. Ensure tables exist and have data
5. Verify RLS bypass is enabled in logs
6. Check Supabase dashboard for RLS policies

## License

This implementation follows the license of the CPLS project.
