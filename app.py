from flask import Flask, request, render_template, redirect, url_for, session, jsonify
from functools import wraps
from sqlalchemy import create_engine, text
from passlib.hash import pbkdf2_sha256

# ----------------------------------------------------
# ⚙️ Flask App Setup
# ----------------------------------------------------
app = Flask(__name__)
app.secret_key = 'super-secret-key'  # TODO: Move to .env for production

# 🔧 Allow session cookies over HTTP (for Codespaces)
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'None'

# ----------------------------------------------------
# 🔗 Blueprint: Email Rules
# ----------------------------------------------------
from email_rules import email_rules_bp
app.register_blueprint(email_rules_bp, url_prefix="/email")

# ----------------------------------------------------
# 🔗 Blueprint: Ledger
# ----------------------------------------------------
from ledger import ledger_bp
app.register_blueprint(ledger_bp)

# ----------------------------------------------------
# 🔗 Blueprint: Ledger Settings
# ----------------------------------------------------
from settings_bp import settings_bp
app.register_blueprint(settings_bp)

# ----------------------------------------------------
# 🔗 Blueprint: Reference Data
# ----------------------------------------------------
from reference_routes import reference_bp
app.register_blueprint(reference_bp)

# ----------------------------------------------------
# 🧪 Debug Session Route
# ----------------------------------------------------
@app.route('/debug_session')
def debug_session():
    from flask import request
    info = {
        "session_contents": dict(session),
        "cookies_received": dict(request.cookies),
        "session_cookie_name": app.config.get("SESSION_COOKIE_NAME", "session")
    }
    return info

# ----------------------------------------------------
# 🗄 SQLAlchemy Connection (Azure SQL)
# ----------------------------------------------------
import os

# Pull from environment variable if available (Azure)
conn_str = os.getenv(
    "DB_CONNECTION_STRING",
    "mssql+pyodbc://Deepblueadmin:Atlantic!Beaufort6633@deepbluedb.database.windows.net,1433/DeepBlueDB?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=yes"
)

print(f"🔌 Using database connection string source: {'ENV' if 'DB_CONNECTION_STRING' in os.environ else 'LOCAL'}")

engine = create_engine(conn_str, pool_pre_ping=True, pool_recycle=3600)

def get_db_connection():
    try:
        conn = engine.connect()
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise

# ----------------------------------------------------
# 🔐 Authentication Decorator
# ----------------------------------------------------
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper

# ----------------------------------------------------
# 👤 Inject User Context (for topbar / header)
# ----------------------------------------------------
@app.context_processor
def inject_user():
    if 'username' in session:
        try:
            with get_db_connection() as conn:
                result = conn.execute(
                    text("SELECT Username, Email, CompanyName, Role FROM dbo.UsersSecure WHERE Username = :u"),
                    {"u": session['username']}
                )
                row = result.fetchone()
                if row:
                    name = row[0]
                    initials = "".join([w[0].upper() for w in name.split() if w])
                    return dict(user={
                        "name": name,
                        "email": row[1],
                        "company_name": row[2] or "Deep Blue",
                        "role": row[3],
                        "initials": initials or name[:2].upper()
                    })
        except Exception as e:
            print("User context fetch error:", e)
    return dict(user=None)

# ----------------------------------------------------
# 🏠 Routes
# ----------------------------------------------------
@app.route('/')
def root():
    return redirect(url_for('home'))

@app.route('/home')
@login_required
def home():
    return render_template('index.html')

@app.route('/logout')
@login_required
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

# ----------------------------------------------------
# 🔑 Auth: Register / Login / Forgot Password
# ----------------------------------------------------
REGISTRATION_SECRET = "SHINC"

@app.route('/register', methods=['POST'])
def register():
    error, success = None, None
    secret_key = request.form.get('secret_key', '').strip()
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip()
    password = request.form.get('password', '')

    if secret_key != REGISTRATION_SECRET:
        error = "Invalid secret key."
    elif not username or not email or not password:
        error = "All fields are required."
    else:
        try:
            hashed_pw = pbkdf2_sha256.hash(password)
            with get_db_connection() as conn:
                result = conn.execute(
                    text("SELECT 1 FROM dbo.UsersSecure WHERE Username = :u"),
                    {"u": username}
                )
                if result.fetchone():
                    error = "Username already exists."
                else:
                    conn.execute(
                        text("""
                            INSERT INTO dbo.UsersSecure (Username, Email, HashedPassword, IsActive)
                            VALUES (:u, :e, :h, 1)
                        """),
                        {"u": username, "e": email, "h": hashed_pw}
                    )
                    conn.commit()
                    success = "Registration successful! You can now log in."
        except Exception as e:
            print("Registration error:", e)
            error = "Registration failed. Please try again."

    return render_template('login.html', error=error, success=success, db_status="")

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    db_status = "Checking connection..."
    db_ok = False

    try:
        with get_db_connection() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "✅ Connected to database"
        db_ok = True
    except Exception as e:
        print("DB connection error:", e)
        db_status = "❌ Database connection failed"

    if request.method == 'POST' and db_ok:
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        print("🧩 Login attempt:", username)

        try:
            with get_db_connection() as conn:
                result = conn.execute(
                    text("SELECT HashedPassword, IsActive FROM dbo.UsersSecure WHERE Username = :u"),
                    {"u": username}
                )
                row = result.fetchone()

            if not row:
                error = "Invalid username or password."
            else:
                hashed_pw, is_active = row[0], bool(row[1])
                if not is_active:
                    error = "Account is inactive."
                elif pbkdf2_sha256.verify(password, hashed_pw.strip()):
                    session['username'] = username
                    return redirect(url_for('home'))
                else:
                    error = "Invalid username or password."
        except Exception as e:
            print("Login logic error:", e)
            error = "Login failed due to a server error."

    return render_template('login.html', error=error, db_status=db_status)

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip()
    new_password = request.form.get('new_password', '')

    if not (username and email and new_password):
        return render_template('login.html', error="All fields are required for password reset.", db_status="")

    try:
        hashed_pw = pbkdf2_sha256.hash(new_password)
        with get_db_connection() as conn:
            result = conn.execute(
                text("SELECT 1 FROM dbo.UsersSecure WHERE Username = :u AND Email = :e"),
                {"u": username, "e": email}
            )
            if not result.fetchone():
                return render_template('login.html', error="Username and email do not match.", db_status="")

            conn.execute(
                text("UPDATE dbo.UsersSecure SET HashedPassword = :p WHERE Username = :u"),
                {"p": hashed_pw, "u": username}
            )
            conn.commit()
        return redirect(url_for('login'))
    except Exception as e:
        print("Password reset error:", e)
        return render_template('login.html', error="Failed to reset password.", db_status="")

# ----------------------------------------------------
# 🩺 Health Check
# ----------------------------------------------------
@app.route('/healthz')
def healthz():
    try:
        with get_db_connection() as conn:
            conn.execute(text("SELECT 1"))
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ----------------------------------------------------
# 🚀 Run
# ----------------------------------------------------
if __name__ == '__main__':
    # Local dev only
    app.run(host='0.0.0.0', port=5000, debug=True)