# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run locally:**
```bash
python app.py
# Starts on http://0.0.0.0:5000 with debug=True
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Production server (gunicorn):**
```bash
gunicorn app:app
```

There is no test suite in this repository.

## Architecture

This is a Flask web application for Deep Blue Shipping — a laytime and demurrage case management portal. It uses Azure SQL (MSSQL via SQLAlchemy + pyodbc) as its database and Azure Blob Storage for case documents.

### Entry Point & Blueprint Pattern

`app.py` is the application entry point. It creates the Flask app, defines the SQLAlchemy engine, handles auth routes, and registers all blueprints. Each feature module is a separate Blueprint file:

| File | Blueprint | Purpose |
|---|---|---|
| `ledger.py` | `ledger_bp` | Case ledger list view + API |
| `case.py` | `case_bp` | Case detail page + case dashboard |
| `email_rules.py` | `email_rules_bp` | Email tagging/rule management |
| `settings_bp.py` | `settings_bp` | Ledger column configuration (ColumnMeta) |
| `reference_routes.py` | `reference_bp` | Reference data (vessels, ports, etc.) |
| `cp_parser.py` | `cp_parser_bp` | Charterparty PDF OCR via Azure Document Intelligence |
| `case_documents.py` | `case_documents_bp` | Case file upload/download via Azure Blob Storage |
| `templates.py` | `templates_bp` | Email template CRUD |
| `timebars.py` | `timebars_bp` | Timebar notice deadlines + reminder todos |

### Circular Import Pattern

Blueprints avoid circular imports by deferring imports inside inner functions:

```python
@blueprint.route("/api/something")
def some_route():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        with get_db_connection() as conn:
            ...
    return inner()
```

`case.py` and a few others use `from utils import get_db_connection, login_required` instead (both `utils.py` and `app.py` define these — they are equivalent).

### Database

- Azure SQL via SQLAlchemy `text()` queries (no ORM models).
- `get_db_connection()` returns a SQLAlchemy connection context manager.
- Row results use `row._mapping` to access columns by name.
- `dbo.ColumnMeta` is the single source of truth for which `Cases` columns are editable and how they display in the UI.

### Key Database Tables

- `dbo.Cases` — core case records (laytime/demurrage cases)
- `dbo.ColumnMeta` — metadata for Cases columns (display name, editability, field type)
- `dbo.CaseNotices` — timebar notices linked to cases (stores snapshot of days/offsets at time of assignment)
- `dbo.CaseTodos` — action items, including `TIMEBAR_REMINDER` and `MISSING_VOYAGE_END_DATE` types
- `dbo.NoticeTypes` — configurable notice type definitions (e.g. "Demurrage Notice" = 90 days)
- `dbo.TemplateAssignments` — maps template assignments to an org + assignment key
- `dbo.Templates` — email templates with `{{token}}` placeholders
- `dbo.Counterparties` — company/counterparty directory
- `dbo.UsersSecure` — users with pbkdf2_sha256 hashed passwords
- `dbo.OrgSettings` — org-level defaults (e.g. `DefaultReminderOffsets`)

### Timebars Module

`timebars.py` contains the core timebar logic. The central function is `recalc_case_timebars(conn, case_id, org_id)` which:
1. Fetches `VoyageEndDate` from `dbo.Cases`
2. If missing, dismisses open reminder todos and clears expiry dates
3. For each enabled `CaseNotice`, calculates `ExpiryDate = VoyageEndDate + TimebarDaysSnapshot`
4. Upserts `TIMEBAR_REMINDER` todos for each offset before expiry (keyed by `MetaKey = "TIMEBAR:{case_notice_id}:OFFSET:{n}"`)
5. Template resolution: uses `TemplateAssignments` first, falls back to `NoticeTypes.TemplateID`

`recalc_case_timebars` is called from `app.py` when `VoyageEndDate` is updated via `PATCH /update-case/<id>`.

### Frontend

- Jinja2 templates in `templates/`, extending `base.html`
- Vanilla JS in `static/js/` — no build step, no bundler
- Each JS file corresponds to a page or modal (e.g. `case-timebars.js`, `ledger.js`)
- The UI uses a sidebar + topbar layout with dark/light mode support

### Authentication

Session-based auth. `login_required` decorator redirects to `/login` if `session['username']` is absent. Both `session['username']` and `session['user_id']` are set on login — `user_id` is required by timebar todo completion.

### Environment Variables

| Variable | Purpose |
|---|---|
| `DB_CONNECTION_STRING` | Azure SQL connection string (falls back to hardcoded dev string) |
| `AZURE_DI_ENDPOINT` | Azure Document Intelligence endpoint (CP parser) |
| `AZURE_DI_KEY` | Azure Document Intelligence key |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage (case documents) |

### Deployment

Pushing to `main` triggers GitHub Actions (`.github/workflows/azure-deploy.yml`) which deploys to Azure App Service (`deepblue-portal`).
