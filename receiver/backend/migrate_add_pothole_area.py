#!/usr/bin/env python3
"""
Comprehensive migration script for database schema updates.

This script runs automatically on server startup and is idempotent (safe to run multiple times).
Includes:
- porthole_area_percentage column for frames
- User roles and organizations support
- Enum type fixes
"""

import asyncio
import os
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


async def run_migration(engine=None):
    """
    Run all database migrations.
    Idempotent - safe to run multiple times.
    """
    should_close_engine = False
    if engine is None:
        engine = create_async_engine(DATABASE_URL, echo=False)
        should_close_engine = True

    SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as session:
        try:
            # ============================================================
            # Migration 1: Add porthole_area_percentage column
            # ============================================================
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'frames' AND column_name = 'porthole_area_percentage';
            """))
            column_exists = result.fetchone() is not None

            if not column_exists:
                print("🚀 Migration 1: Adding porthole_area_percentage column...")
                await session.execute(text("""
                    ALTER TABLE frames
                    ADD COLUMN porthole_area_percentage FLOAT NOT NULL DEFAULT 0.0;
                """))
                await session.commit()
                print("✅ Migration 1 completed")
            else:
                print("ℹ️  Migration 1: porthole_area_percentage column already exists, skipping...")

            # ============================================================
            # Migration 2: Create userrole enum with lowercase values
            # ============================================================
            result = await session.execute(text("""
                SELECT 1 FROM pg_type WHERE typname = 'userrole';
            """))
            enum_exists = result.fetchone() is not None

            if enum_exists:
                # Check if enum has correct values (lowercase)
                result = await session.execute(text("""
                    SELECT enumlabel FROM pg_enum
                    WHERE enumtypid = 'userrole'::regtype
                    ORDER BY enumsortorder;
                """))
                enum_values = [row[0] for row in result.fetchall()]

                # If enum has uppercase values, recreate it
                if 'ADMIN' in enum_values or 'ORDINARY' in enum_values:
                    print("🚀 Migration 2: Fixing userrole enum values (uppercase -> lowercase)...")

                    # Check if role column exists before dropping
                    result = await session.execute(text("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = 'users' AND column_name = 'role';
                    """))
                    role_column_exists = result.fetchone() is not None

                    # Drop and recreate enum with correct values
                    await session.execute(text("DROP TYPE userrole CASCADE;"))
                    await session.execute(text("CREATE TYPE userrole AS ENUM ('admin', 'ordinary');"))

                    # Re-add role column if it existed
                    if role_column_exists:
                        await session.execute(text("""
                            ALTER TABLE users
                            ADD COLUMN role userrole NOT NULL DEFAULT 'ordinary';
                        """))

                    await session.commit()
                    print("✅ Migration 2 completed: userrole enum fixed")
                else:
                    print("ℹ️  Migration 2: userrole enum already has correct values, skipping...")
            else:
                print("🚀 Migration 2: Creating userrole enum...")
                await session.execute(text("CREATE TYPE userrole AS ENUM ('admin', 'ordinary');"))
                await session.commit()
                print("✅ Migration 2 completed")

            # ============================================================
            # Migration 3: Create organizations table
            # ============================================================
            result = await session.execute(text("""
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'organizations';
            """))
            org_table_exists = result.fetchone() is not None

            if not org_table_exists:
                print("🚀 Migration 3: Creating organizations table...")
                await session.execute(text("""
                    CREATE TABLE organizations (
                        id UUID PRIMARY KEY,
                        name VARCHAR NOT NULL UNIQUE,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                    );
                """))
                await session.commit()
                print("✅ Migration 3 completed")
            else:
                print("ℹ️  Migration 3: organizations table already exists, skipping...")

            # ============================================================
            # Migration 4: Create default organization
            # ============================================================
            result = await session.execute(text("""
                SELECT id FROM organizations WHERE name = 'Default Organization';
            """))
            default_org = result.fetchone()

            if not default_org:
                print("🚀 Migration 4: Creating default organization...")
                await session.execute(text("""
                    INSERT INTO organizations (id, name)
                    VALUES (gen_random_uuid(), 'Default Organization');
                """))
                await session.commit()
                print("✅ Migration 4 completed")
            else:
                print("ℹ️  Migration 4: Default organization already exists, skipping...")

            # ============================================================
            # Migration 5: Add role column to users table
            # ============================================================
            result = await session.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'role';
            """))
            role_column_exists = result.fetchone() is not None

            if not role_column_exists:
                print("🚀 Migration 5: Adding role column to users table...")
                await session.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN role userrole NOT NULL DEFAULT 'ordinary';
                """))
                await session.commit()
                print("✅ Migration 5 completed")
            else:
                print("ℹ️  Migration 5: role column already exists, skipping...")

            # ============================================================
            # Migration 6: Add organization_id column to users table
            # ============================================================
            result = await session.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'organization_id';
            """))
            org_id_column_exists = result.fetchone() is not None

            if not org_id_column_exists:
                print("🚀 Migration 6: Adding organization_id column to users table...")
                await session.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN organization_id UUID REFERENCES organizations(id);
                """))
                await session.commit()
                print("✅ Migration 6 completed")
            else:
                print("ℹ️  Migration 6: organization_id column already exists, skipping...")

            # ============================================================
            # Migration 7: Assign existing users to default organization
            # ============================================================
            result = await session.execute(text("""
                SELECT COUNT(*) FROM users WHERE organization_id IS NULL;
            """))
            users_without_org = result.scalar()

            if users_without_org > 0:
                print(f"🚀 Migration 7: Assigning {users_without_org} users to default organization...")
                await session.execute(text("""
                    UPDATE users
                    SET organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization')
                    WHERE organization_id IS NULL;
                """))
                await session.commit()
                print("✅ Migration 7 completed")
            else:
                print("ℹ️  Migration 7: All users already have organization, skipping...")

            # ============================================================
            # Migration 8: Set table ownership
            # ============================================================
            print("🚀 Migration 8: Setting table ownership to stream_user...")
            await session.execute(text("ALTER TABLE IF EXISTS frames OWNER TO stream_user;"))
            await session.execute(text("ALTER TABLE IF EXISTS users OWNER TO stream_user;"))
            await session.execute(text("ALTER TABLE IF EXISTS organizations OWNER TO stream_user;"))
            await session.commit()
            print("✅ Migration 8 completed")

            print("\n🎉 All migrations completed successfully!")
            return True

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await session.rollback()
            return False

        finally:
            if should_close_engine:
                await engine.dispose()


async def migrate():
    """Standalone migration runner for manual execution"""
    print("=" * 70)
    print("DATABASE MIGRATIONS: Comprehensive Schema Updates")
    print("=" * 70)

    result = await run_migration()

    if result:
        # Get some stats
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        async with SessionLocal() as session:
            # Frame stats
            result = await session.execute(text("SELECT COUNT(*) FROM frames;"))
            frame_count = result.scalar()

            result = await session.execute(text("""
                SELECT COUNT(*) FROM frames WHERE porthole_area_percentage > 0;
            """))
            frames_with_area = result.scalar()

            # User stats
            result = await session.execute(text("SELECT COUNT(*) FROM users;"))
            user_count = result.scalar()

            result = await session.execute(text("""
                SELECT role, COUNT(*) FROM users GROUP BY role;
            """))
            role_counts = result.fetchall()

            # Organization stats
            result = await session.execute(text("SELECT COUNT(*) FROM organizations;"))
            org_count = result.scalar()

            print("\n📊 Current Database Status:")
            print(f"\n  Frames:")
            print(f"   - Total frames: {frame_count}")
            print(f"   - Frames with pothole area data: {frames_with_area}")
            print(f"   - Frames with 0.0 (default): {frame_count - frames_with_area}")

            print(f"\n  Users:")
            print(f"   - Total users: {user_count}")
            for role, count in role_counts:
                print(f"   - {role}: {count}")

            print(f"\n  Organizations:")
            print(f"   - Total organizations: {org_count}")

        await engine.dispose()
        print("\n🎉 All migrations completed successfully!")
    else:
        print("\n⚠️  Migration encountered issues")


if __name__ == "__main__":
    print("=" * 70)
    print("DATABASE MIGRATIONS: Comprehensive Schema Updates")
    print("=" * 70)
    asyncio.run(migrate())
