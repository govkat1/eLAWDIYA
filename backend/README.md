# eLAWDIYA Backend (FastAPI)

This folder contains the FastAPI backend for the eLAWDIYA project.

Quick start (macOS / Linux):

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Configure environment variables (create a `.env` file in project root):

```
DATABASE_URL=postgresql://user:password@localhost/elawdiya
SECRET_KEY=some-long-secret
```

3. Initialize the database (creates tables):

```bash
python -m backend.app.init_db
```

4. Run the server (development):

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API base path: `/api` (e.g. `http://localhost:8000/api/auth/login`)

Notes:
- The frontend Next.js app (in `app/`) should call the backend running on port 8000 (CORS allowed for `http://localhost:3000`).
- This is a minimal migration scaffold. You may want to add Alembic for migrations, better error handling, and tests.
