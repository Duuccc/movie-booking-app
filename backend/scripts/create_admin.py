"""
Create an admin, or promote and reset the password of an existing user.
Unlike seed.py this never deletes anything, so it is safe on a real database.

    docker compose exec backend python -m scripts.create_admin you@example.com "Your Name"
"""
import getpass
import sys

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models import User, UserRole

import os


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: python -m scripts.create_admin <email> "<name>"')
    email, name = sys.argv[1], sys.argv[2]

    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Password (min 8 characters): ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.role = UserRole.ADMIN
            user.password_hash = hash_password(password)
        else:
            db.add(User(name=name, email=email, password_hash=hash_password(password), role=UserRole.ADMIN))
        db.commit()
        print(f"{email} is now an admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()