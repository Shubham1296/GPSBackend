#!/usr/bin/env python3
"""
Migration script to add user roles and organizations to existing database.
This script:
1. Creates organizations table
2. Adds role and organization_id columns to users table
3. Creates a default organization
4. Assigns all existing users to the default organization with 'admin' role

Run this script ONCE to migrate your database:
    python migrate_add_roles_orgs.py
"""

import asyncio
import os
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Database configuration
DB_HOST = os.getenv("DB_HOST", "postgres")
DB_NAME = os.getenv("DB_NAME", "stream")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")
DB_PORT = os.getenv("DB_PORT", "5432")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


async def migrate():
    """Run the migration"""
    engine = create_async_engine(DATABASE_URL, echo=True)
    SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as session:
        try:
            print("🚀 Starting migration...")

            # Step 1: Create user role enum type if it doesn't exist
            print("\n📝 Step 1: Creating user role enum type...")
            await session.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE userrole AS ENUM ('admin', 'ordinary');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            await session.commit()
            print("✅ User role enum created")

            # Step 2: Create organizations table
            print("\n📝 Step 2: Creating organizations table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS organizations (
                    id UUID PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """))
            await session.commit()
            print("✅ Organizations table created")

            # Step 3: Create default organization
            print("\n📝 Step 3: Creating default organization...")
            default_org_id = uuid.uuid4()
            result = await session.execute(text("""
                INSERT INTO organizations (id, name)
                VALUES (:id, 'Default Organization')
                ON CONFLICT (name) DO NOTHING
                RETURNING id;
            """), {"id": default_org_id})

            org_result = result.fetchone()
            if org_result:
                default_org_id = org_result[0]
                print(f"✅ Default organization created with ID: {default_org_id}")
            else:
                # Organization already exists, get its ID
                result = await session.execute(text("""
                    SELECT id FROM organizations WHERE name = 'Default Organization';
                """))
                default_org_id = result.fetchone()[0]
                print(f"✅ Default organization already exists with ID: {default_org_id}")

            await session.commit()

            # Step 4: Add role column to users table (with default)
            print("\n📝 Step 4: Adding role column to users table...")
            try:
                await session.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS role userrole NOT NULL DEFAULT 'ordinary';
                """))
                await session.commit()
                print("✅ Role column added")
            except Exception as e:
                print(f"⚠️  Role column might already exist: {e}")
                await session.rollback()

            # Step 5: Add organization_id column to users table
            print("\n📝 Step 5: Adding organization_id column to users table...")
            try:
                await session.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
                """))
                await session.commit()
                print("✅ Organization_id column added")
            except Exception as e:
                print(f"⚠️  Organization_id column might already exist: {e}")
                await session.rollback()

            # Step 6: Update existing users to have admin role and default organization
            print("\n📝 Step 6: Updating existing users...")
            result = await session.execute(text("""
                UPDATE users
                SET role = 'admin',
                    organization_id = :org_id
                WHERE organization_id IS NULL;
            """), {"org_id": default_org_id})
            await session.commit()

            rows_updated = result.rowcount
            print(f"✅ Updated {rows_updated} existing user(s) to admin role with default organization")

            # Step 7: Verify migration
            print("\n📝 Step 7: Verifying migration...")
            result = await session.execute(text("SELECT email, role, organization_id FROM users;"))
            users = result.fetchall()

            print(f"\n✅ Migration complete! Found {len(users)} user(s):")
            for user in users:
                print(f"   - {user[0]} | Role: {user[1]} | Org ID: {user[2]}")

            print("\n🎉 Migration successful! All existing users are now admins in the default organization.")

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            await session.rollback()
            raise

        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("=" * 70)
    print("DATABASE MIGRATION: Add User Roles and Organizations")
    print("=" * 70)
    asyncio.run(migrate())
