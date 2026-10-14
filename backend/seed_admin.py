#!/usr/bin/env python3
"""Secure and repeatable Admin seed script for Chetna Mini Market Retail Rate Manager."""

import argparse
import getpass
import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User


def seed_admin(username: str, password: str, update_existing: bool = False) -> None:
    """Seed or update the system administrator account safely."""
    if not username or not username.strip():
        print("Error: Admin username cannot be empty.", file=sys.stderr)
        sys.exit(1)

    if not password or len(password.strip()) < 6:
        print("Error: Admin password must be at least 6 characters.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == username.strip()).first()
        if existing_user:
            if existing_user.role == "admin":
                if update_existing:
                    existing_user.hashed_password = hash_password(password.strip())
                    existing_user.is_active = True
                    db.commit()
                    print(f"Success: Password for Admin '{username}' has been updated.")
                else:
                    print(f"Notice: Admin user '{username}' already exists. Use --update to reset password.")
            else:
                print(
                    f"Conflict: User '{username}' exists with role '{existing_user.role}'. "
                    "Cannot overwrite non-admin user via seed script.",
                    file=sys.stderr
                )
                sys.exit(1)
            return

        # Create new admin user
        admin = User(
            username=username.strip(),
            hashed_password=hash_password(password.strip()),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Success: Admin account '{username}' (ID: {admin.id}) created successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding admin account: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed initial Administrator account")
    parser.add_argument("--username", "-u", type=str, default=None, help="Admin username")
    parser.add_argument("--password", "-p", type=str, default=None, help="Admin password")
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update password if admin already exists"
    )
    args = parser.parse_args()

    # Priority: Command-line args -> Environment Variables -> Settings Defaults -> Interactive prompt
    username = (
        args.username
        or os.getenv("ADMIN_USERNAME")
        or settings.INITIAL_ADMIN_USERNAME
    )
    password = (
        args.password
        or os.getenv("ADMIN_PASSWORD")
        or settings.INITIAL_ADMIN_PASSWORD
    )

    if not username:
        username = input("Enter Admin username: ").strip()

    if not password:
        password = getpass.getpass("Enter Admin password: ").strip()

    seed_admin(username=username, password=password, update_existing=args.update)


if __name__ == "__main__":
    main()
