# photo_blog

A personal photo blog styled as a retro desktop OS. The UI is a windowed desktop environment (think early macOS / Windows XP era, Frutiger Aero aesthetic) with draggable windows, a menu bar, desktop icons, and a status bar. Under the hood it's a Django REST API + React frontend backed by Cloudflare R2 for image storage.

---

## Architecture overview

```
photo_blog/
├── backend/
│   └── photo_blog/         # Django project
│       ├── blog/           # Main app (models, views, pipeline, auth)
│       └── photo_blog/     # Django settings & root URL config
└── frontend/
    └── photo_blog/         # Vite + React + TypeScript
        └── src/
            ├── api/        # Fetch-based API client
            ├── components/ # UI components
            ├── contexts/   # React contexts (auth, loading)
            ├── hooks/      # Custom hooks (window manager, photos, selection)
            ├── types/      # Shared TypeScript types
            └── utils/      # Helpers (position, EXIF, blurhash, context menu)
```

The frontend and backend are completely decoupled — CORS + session cookies bridge them in development.

---

## Backend

**Stack:** Django 6 · Django REST Framework · SQLite (dev) / PostgreSQL (prod) · Cloudflare R2 (image storage) · Pillow · boto3

### Models

| Model | Key fields |
|---|---|
| `Category` | UUID pk, `name`, `slug`, `icon`, `sort_order` |
| `Photo` | UUID pk, `title`, `description`, `slug`, `width/height`, `taken_at`, EXIF fields, `original_key`, `thumbnail_key`, `blurhash`, `is_trashed`, `trashed_at` |

### API endpoints

**Public** (no auth required):

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/photos/` | Paginated photo list (24/page). Accepts `?category=<slug>` and `?page=N` |
| GET | `/api/v1/photos/<slug>/` | Photo detail including `original_url` |
| GET | `/api/v1/categories/` | All categories with `photo_count` |

**Admin only** (`is_staff` required):

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/photos/upload/` | Upload a photo (multipart: `file`, `title`, `description`, `category`) |
| GET | `/api/v1/photos/trash/list/` | List soft-deleted photos |
| POST | `/api/v1/photos/trash/` | Move photos to trash (`{"ids": [...]}`) |
| POST | `/api/v1/photos/trash/restore/` | Restore from trash |
| POST | `/api/v1/photos/trash/purge/` | Permanently delete specific photos + R2 objects |
| POST | `/api/v1/photos/trash/empty/` | Empty all trash |

**Auth:**

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login/` | Session login (`{"username": ..., "password": ...}`) |
| POST | `/api/v1/auth/logout/` | Session logout |
| GET | `/api/v1/auth/user/` | Current user (401 if unauthenticated) |

### Image processing pipeline

On every upload (`blog/pipeline.py`):

1. Validate image with Pillow (catches corrupt files before any writes)
2. Upload original to R2 at `photos/originals/{uuid}.{ext}`
3. Generate a 600px-height WebP thumbnail, upload to `photos/thumbnails/{uuid}.webp`
4. Extract EXIF metadata (camera, lens, aperture, ISO, shutter speed, taken_at)
5. Encode a 4×3 blurhash for client-side loading placeholders
6. Rollback (delete R2 objects) on any failure

### Authentication

Session-based auth via Django's built-in `SessionAuthentication`. The login view is `@csrf_exempt` and calls `get_token(request)` to seed the CSRF cookie in the same response, so subsequent admin requests can include the `X-CSRFToken` header.

**Important:** The frontend origin and backend origin must share the same hostname (`localhost`) for `SameSite=Lax` session cookies to be sent cross-origin. If you see 401s after login, check that `VITE_API_BASE_URL` uses `localhost` (not `127.0.0.1`).

### Backend environment variables

Create `backend/photo_blog/.env`:

```env
SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Use sqlite:///./db.sqlite3 for local dev
DATABASE_URL=postgresql://user:pass@localhost:5432/photoblog

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Cloudflare R2
R2_BASE_URL=https://<account-hash>.r2.dev
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=photoblog-bucket
```

---

## Frontend

**Stack:** React 19 · TypeScript 5.9 · Vite 7 · framer-motion · blurhash

### Core concepts

The entire app is a **windowed desktop metaphor**. There is no client-side router. Everything is rendered on a single canvas managed by `useWindowManager`.

#### Window manager (`hooks/useWindowManager.ts`)

Central state for all open windows. Each window is a `WindowState`:

```ts
interface WindowState {
  id: string;
  title: string;
  windowType: WindowContentType;   // 'grid' | 'detail' | 'static' | 'login' | 'upload' | 'trash'
  payload: WindowPayload;          // type-discriminated content data
  position: Position;
  size: Size;
  isMaximized: boolean;
  isMinimized: boolean;
  zIndex: number;
}
```

`App.tsx` holds the window manager and delegates to `openGridWindow`, `openDetailWindow`, `openLoginWindow`, etc. Each of those checks for an existing window of that type before opening a second one (single-instance pattern for login/upload/trash).

#### Content rendering

`App.tsx#renderWindowContent(win)` switches on `win.windowType` and renders the appropriate content component inside the `<Window>` frame.

#### Photo data (`hooks/usePhotos.ts`)

In-memory cache keyed by category slug (grid) and photo slug (detail). Avoids redundant fetches when navigating back and forth between windows. Call `invalidateAll()` after a trash or upload operation.

#### Selection (`hooks/useSelection.ts`)

Multi-select state for the photo grid. Supports:
- Single click toggle
- Shift-click range select (tracks last-clicked ref + ordered ID array)
- Select all / clear

Select mode is off by default — admins toggle it via the toolbar to avoid accidentally entering select mode when trying to open a photo.

#### API client (`api/client.ts`)

All API calls go through `fetchJSON` / `postJSON` helpers that attach credentials and the CSRF token from the cookie jar. Upload uses XHR directly for progress events.

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
```

### Styling

No CSS framework. The aesthetic is **skeumorphic flat 2.5D** (Frutiger Aero-inspired): warm beige/tan palette, subtle inner shadows, rounded corners, noise texture overlay. Styles are mostly inline (`React.CSSProperties`) with a small set of CSS variables for theming:

```css
--text-primary, --text-secondary
--window-bg, --window-border, --window-titlebar-bg
--accent
```

The active desktop scene (aquarium, forest, etc.) drives palette changes at runtime.

### Frontend environment variables

Create `frontend/photo_blog/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Local development

### Prerequisites

- Python 3.12+
- Node 20+
- A Cloudflare R2 bucket (or any S3-compatible store)

### Backend

```bash
cd backend/photo_blog

# Create and activate virtualenv
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt    # (or install from venv if already set up)

python manage.py migrate
python manage.py createsuperuser   # creates your admin account

# Optional: seed fake photos for UI development
python manage.py seed --count 15

python manage.py runserver
# API available at http://localhost:8000/
```

### Frontend

```bash
cd frontend/photo_blog
npm install
npm run dev
# App available at http://localhost:5173/
```

Log in via the desktop login window using the superuser credentials you created.

---

## Key decisions & tradeoffs

| Decision | Reasoning |
|---|---|
| Windowed desktop UI instead of a page-based SPA | It's a personal project — the OS metaphor is the point |
| Session auth over JWTs | Simpler for a solo admin; no token refresh complexity |
| Soft delete (trash) before purge | Matches OS trash can metaphor; prevents accidental permanent deletion |
| In-memory photo cache | No external state library needed; cache invalidation is simple (upload/trash) |
| Blurhash placeholders | Better loading UX than gray boxes; generated server-side so no client cost |
| R2 over S3 | Zero egress fees for public reads |

---

## Known limitations / future work

- **Window content scaling**: Content inside resized windows (especially PhotoDetail) uses viewport-relative units rather than window-relative ones. Continuous drag-resize causes some reflow. Tracked for future improvement.
- **Auth**: Current MVP is admin-only session auth. Planned: passwordless OTP (phone/email) for all users.
- **No test suite**: No automated tests exist yet.
- **Single `App.tsx`**: Window open/render logic is all in one large file. Candidate for splitting into separate window controller hooks as complexity grows.
