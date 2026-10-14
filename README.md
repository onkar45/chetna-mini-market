# Chetna Mini Market — Retail Rate Manager

A modern, responsive, full-stack retail rate management mobile application designed for shopkeepers and customers of **Chetna Mini Market** ("Your Store, Your Rates").

- **Mobile Frontend**: React Native, Expo SDK 57, Expo Router, Axios, `i18next` & `react-i18next`, `expo-image-picker`, Expo SecureStore.
- **Languages Supported**: Full internationalization with **Marathi (मराठी - Devanagari)** and **English (en)**, plus instant switching and local persistence.
- **Product Photos**: Camera capture, photo gallery selection, image preview, retake, remove, and persistent cloud object storage via Cloudinary (with local static fallback).
- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0 ORM, Alembic Migrations, Pydantic v2, PyJWT, bcrypt, Cloudinary SDK.
- **Database**: PostgreSQL (Docker / Local Native / Hosted Neon Serverless).

---

## 1. Prerequisites

- **Python**: 3.10+ (Tested on Python 3.13)
- **Node.js**: v20+ with npm
- **Database**: PostgreSQL 14+ (or Docker)

---

## 2. PostgreSQL Setup (Linux)

You can run PostgreSQL locally using Docker or native PostgreSQL.

### Option A: Using Docker (Fastest)
```bash
docker run -d \
  --name chetna-postgres \
  -e POSTGRES_DB=retail_rate_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### Option B: Native PostgreSQL on Ubuntu / Debian
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database and user:
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE retail_rate_db OWNER postgres;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE retail_rate_db TO postgres;"
```

---

## 3. Backend Setup

### A. Environment Configuration
From the workspace root:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` to configure your database connection string, secret keys, and Cloudinary storage:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/retail_rate_db
SECRET_KEY=dev_secret_jwt_key_chetna_retail_rate_manager_2026_super_secure
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=AdminSecurePassword123!
ENVIRONMENT=development
ALLOWED_ORIGINS=*

# Cloudinary Object Storage (For production persistent photos)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_FOLDER=chetna_products
```

> **Note**: If Cloudinary credentials are not configured in local development, the backend automatically uses a local static storage fallback in `backend/static/uploads/`, served directly by FastAPI.

### B. Activate Virtual Environment
```bash
cd /home/lenovo/Chetna-Rate-App/backend
source .venv/bin/activate
pip install -r requirements.txt
```

### C. Run Database Migrations (Alembic)
To apply all database migrations non-destructively:
```bash
cd /home/lenovo/Chetna-Rate-App/backend
source .venv/bin/activate
alembic upgrade head
```

Migrations:
1. `9106c37702d1`: Initial users and products tables.
2. `1059e95c7abf`: Adds `image_url` and `image_public_id` columns to `products`.

### D. Seed Initial Admin Account
```bash
cd /home/lenovo/Chetna-Rate-App/backend
source .venv/bin/activate
python seed_admin.py
```

---

## 4. Cloud Image Storage Guide (Cloudinary)

For persistent cloud storage on Render:
1. **Create Account**: Register a free account at [Cloudinary](https://cloudinary.com/).
2. **Dashboard**: Navigate to the Cloudinary Dashboard Console.
3. **Copy Credentials**: Copy your:
   - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
   - **API Key** (`CLOUDINARY_API_KEY`)
   - **API Secret** (`CLOUDINARY_API_SECRET`)
4. **Environment Variables**:
   - For local development: add them to `backend/.env`.
   - For production deployment on Render: set them as Secret Environment Variables in the Render Dashboard service settings.
5. **Security**: Credentials remain strictly on the backend. Mobile clients only receive secure image URLs and public IDs.

---

## 5. Marathi Language & Internationalization (i18n)

The app features full bilingual support:
- **Languages**: Marathi (`mr` - Devanagari) and English (`en`).
- **Translation Files**:
  - `mobile/locales/mr.json`
  - `mobile/locales/en.json`
- **Language Selector**: Header and Login screens feature a dedicated toggle (`[मराठी] [English]`) with instantaneous state updates.
- **Persistence**: User language preference is stored via `storage.js` (`SecureStore` on mobile, `localStorage` on web) and restored automatically on startup.
- **Formatters**: Prices formatted in Indian Rupees (₹), and dates formatted according to the active locale (`mr-IN` / `en-IN`).
- **Search**: Supports Marathi Devanagari and English queries seamlessly. User-entered item names (e.g., “तांदूळ” or “Basmati Rice”) are preserved without artificial translations.

---

## 6. Product Photo Workflow

- **Capture**: Admin taps "Take Photo" (opens camera) or "Choose from Gallery".
- **Permissions**: Requests permissions on-demand with translated explanatory prompts.
- **Editing & Preview**: Crops photo to 1:1 square ratio, compresses with quality 0.8, and shows instant preview.
- **Retake & Remove**: Admin can retake a new picture or remove the selected photo.
- **Upload Endpoint**: `POST /products/upload-image` (Admin only, validates MIME type: JPEG/PNG/WEBP, validates size <= 5MB).
- **Cleanup**: When an image is replaced or a product is deleted, the old cloud asset is safely deleted.

---

## 7. Running Tests & Starting Server

### A. Run Automated Backend Tests (42 Passing Tests)
```bash
cd /home/lenovo/Chetna-Rate-App
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests -v
```

Tests verify:
- Admin photo upload & storage validation
- Rejection of unauthorized users (401) and regular users (403)
- Rejection of invalid MIME types and oversized files (> 5MB)
- Product creation, update, photo replacement, and photo removal
- Role-based permissions, search, pagination, and negative rate rejection

### B. Start the FastAPI Server
```bash
cd /home/lenovo/Chetna-Rate-App/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health`

### C. Start Mobile Expo App
```bash
cd /home/lenovo/Chetna-Rate-App/mobile
npx expo start
```
- Press **`w`** for Web preview.
- Press **`a`** for Android Emulator.
- Scan QR code with Expo Go on a physical Android device.

---

## 8. Deployment to Render + Neon PostgreSQL

1. **Database**: Create database on Neon and set `DATABASE_URL` with `sslmode=require`.
2. **Backend**: Deploy FastAPI on Render Web Service.
   - Build Command: `pip install -r requirements.txt && alembic upgrade head`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set environment variables: `DATABASE_URL`, `SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. **Mobile**: Set `EXPO_PUBLIC_API_URL` to your Render service URL (e.g. `https://chetna-retail-rate-manager.onrender.com`).
