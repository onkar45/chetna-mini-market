#!/usr/bin/env python3
"""Seed demo Admin and Regular User accounts for easy testing."""

import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


def seed_demo_users():
    db = SessionLocal()
    try:
        # 1. Admin account
        admin = db.query(User).filter_by(username="admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=hash_password("AdminSecurePassword123!"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            print("Created Admin account: 'admin' (password: AdminSecurePassword123!)")
        else:
            admin.hashed_password = hash_password("AdminSecurePassword123!")
            admin.is_active = True
            print("Updated Admin account: 'admin' (password: AdminSecurePassword123!)")

        # 2. Regular User account
        user = db.query(User).filter_by(username="user").first()
        if not user:
            user = User(
                username="user",
                hashed_password=hash_password("UserSecurePassword123!"),
                role="user",
                is_active=True,
            )
            db.add(user)
            print("Created Regular User account: 'user' (password: UserSecurePassword123!)")
        else:
            user.hashed_password = hash_password("UserSecurePassword123!")
            user.is_active = True
            print("Updated Regular User account: 'user' (password: UserSecurePassword123!)")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_users()
