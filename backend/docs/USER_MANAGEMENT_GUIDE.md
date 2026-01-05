# Admin Dashboard User Management - Implementation Guide

## Overview

This implementation adds PostgreSQL/Supabase support to the Go backend with proper GORM models for managing admin users and user profiles. The dashboard now includes API endpoints to retrieve and display data from the `admin_users` and `profiles` tables.

## Key Features

✅ **GORM Models with Proper Tags**
- Full struct definitions with `gorm` and `json` tags
- UUID support for Supabase compatibility
- Proper column name mappings
- Nullable fields using pointers

✅ **Schema and Table Name Configuration**
- TableName() methods ensure correct `public.schema_name` format
- Automatic `search_path=public` configuration
- Works seamlessly with Supabase PostgreSQL

✅ **Debug Mode & SQL Logging**
- GORM logger configured to show all SQL queries
- Detailed logging in services for troubleshooting
- Color-coded console output
- Query execution time tracking

✅ **RLS (Row Level Security) Bypass**
- Automatic RLS bypass when using Service Role Key
- Session replication role set to 'replica'
- Clear warnings when RLS bypass is not configured

## Configuration

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Required: PostgreSQL connection string
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?search_path=public

# Recommended: Service role key for RLS bypass
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Create admin_users Table

```sql
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
```

## API Endpoints

- `GET /admin/api/admin-users` - Get all admin users
- `GET /admin/api/profiles` - Get all user profiles

See full documentation for details on usage and debugging.
