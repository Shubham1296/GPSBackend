# User Roles and Organizations Migration Guide

## Overview

This update adds user roles (admin/ordinary) and organization support to the system. All existing users will be preserved and upgraded to admin role.

## Features Added

### 1. User Roles
- **Admin**: Full system access, can manage users and data
- **Ordinary**: Regular user access

### 2. Organizations
- Users are associated with organizations
- Default organization created for existing users
- Future support for multiple organizations

## Migration Steps

### Step 1: Stop the Application

Stop your running Docker containers:
```bash
docker-compose down
```

### Step 2: Run the Migration Script

**Option A: Using Docker (Recommended)**
```bash
# From the receiver directory
docker-compose up -d postgres

# Wait a few seconds for PostgreSQL to start, then run:
docker-compose run --rm backend python migrate_add_roles_orgs.py
```

**Option B: Direct Python Execution**
```bash
# Set environment variables (adjust if needed)
export DB_HOST=localhost
export DB_NAME=stream
export DB_USER=postgres
export DB_PASS=postgres
export DB_PORT=5432

# Run migration
cd backend
python migrate_add_roles_orgs.py
```

### Step 3: Restart the Application

```bash
docker-compose up -d
```

## What the Migration Does

1. ✅ Creates `organizations` table
2. ✅ Adds `role` column to `users` table (enum: 'admin' or 'ordinary')
3. ✅ Adds `organization_id` column to `users` table
4. ✅ Creates "Default Organization"
5. ✅ **Assigns all existing users to admin role** in default organization
6. ✅ Updates database schema without data loss

## After Migration

### Existing Users
- ✅ All existing users will still work
- ✅ All existing users are now admins
- ✅ All existing users are in "Default Organization"
- ✅ Login process unchanged
- ✅ No password resets needed

### Creating New Users

When creating new users through the UI:
1. Click "Create User" in the sidebar
2. Enter email and password
3. **Select role**: Admin or Ordinary User
4. User will be created in the Default Organization

### API Changes

#### Register Endpoint (POST /register)
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "ordinary"  // Optional: "admin" or "ordinary" (defaults to "ordinary")
}
```

**Response:**
```json
{
  "message": "ok",
  "role": "ordinary",
  "organization_id": "uuid-here"
}
```

#### Login Endpoint (POST /login)
**Response now includes:**
```json
{
  "token": "jwt-token-here",
  "role": "admin",
  "organization_id": "uuid-here"
}
```

### JWT Token Changes

The JWT token now includes:
- `sub`: User email
- `role`: User role (admin/ordinary)
- `organization_id`: User's organization ID
- `exp`: Expiration time

## Verification

After migration, verify users:
```sql
-- Connect to your database
SELECT email, role, organization_id FROM users;
```

You should see all users with:
- `role`: admin
- `organization_id`: UUID of Default Organization

## Database Schema

### Organizations Table
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Users Table (Updated)
```sql
CREATE TABLE users (
    email VARCHAR PRIMARY KEY,
    password_hash VARCHAR NOT NULL,
    role userrole NOT NULL DEFAULT 'ordinary',  -- enum: 'admin', 'ordinary'
    organization_id UUID REFERENCES organizations(id)
);
```

## Rollback (If Needed)

⚠️ **Only if migration fails and you need to rollback:**

```sql
-- Remove new columns (this will NOT affect existing users)
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;

-- Drop organizations table
DROP TABLE IF EXISTS organizations;

-- Drop enum type
DROP TYPE IF EXISTS userrole;
```

## Troubleshooting

### Issue: Migration script fails with "column already exists"
**Solution**: The columns might already exist. This is safe to ignore - the script uses `IF NOT EXISTS` clauses.

### Issue: Cannot connect to database
**Solution**:
1. Ensure PostgreSQL is running: `docker-compose ps`
2. Check environment variables are correct
3. Verify database connection string

### Issue: Existing users cannot login after migration
**Solution**:
1. Check migration completed successfully
2. Verify users table has role and organization_id columns:
   ```sql
   \d users
   ```
3. Ensure all users have an organization_id

## Future Enhancements

- Multi-organization support
- Organization management UI
- Role-based access control (RBAC) for specific features
- Custom roles beyond admin/ordinary
- Organization-specific data isolation

## Support

If you encounter issues:
1. Check migration logs carefully
2. Verify database schema matches expected structure
3. Test with a new user creation
4. Ensure all Docker containers are running

## Summary

✅ **Safe migration** - All existing users preserved
✅ **No downtime** - Quick migration process
✅ **Backward compatible** - Existing logins still work
✅ **Enhanced security** - Role-based access control ready
✅ **Scalable** - Organization support for multi-tenancy
