from flask import Flask, request, render_template, redirect, url_for, session, jsonify
from functools import wraps
from sqlalchemy import create_engine, text
from passlib.hash import pbkdf2_sha256
from utils import get_db_connection, login_required

# ----------------------------------------------------
# ⚙️ Flask App Setup
# ----------------------------------------------------
app = Flask(__name__)
app.secret_key = 'super-secret-key'  # TODO: Move to .env for production

# 🔧 Allow session cookies over HTTP (for Codespaces)
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

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

# 🔗 Blueprint: Case Details
from case import case_bp
app.register_blueprint(case_bp)

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
# 📚 Counterparties (Global Company List)
# ----------------------------------------------------

@app.route('/counterparties')
@login_required
def counterparties_page():
    """Display list of all counterparties."""
    try:
        with get_db_connection() as conn:
            result = conn.execute(text("""
                SELECT 
                    CounterpartyID,
                    CompanyNumber,
                    ShortName,
                    FullName,
                    Address,
                    Country,
                    TaxNumber,
                    CreditDays,
                    RebillRate,
                    DemRate1,
                    DemStep1,
                    DemRate2,
                    DemStep2,
                    AccountingContact,
                    AccountingEmail,
                    AccountingPhone,
                    OperationsContact,
                    OperationsEmail,
                    OperationsPhone,
                    OtherContact,
                    OtherEmail,
                    OtherPhone,
                    BillingEmail,
                    IsCharterer,
                    IsClient,
                    IsOwner,
                    IsReceiver,
                    IsShipper,
                    IsOperator,
                    IsAgent,
                    IsSurveyor,
                    IsBroker,
                    IsBunkerSupplier,
                    IsPortAuthority,
                    Blacklisted,
                    Sanctioned,
                    RiskNotes,
                    Notes
                FROM dbo.Counterparties
                WHERE IsActive = 1
                ORDER BY ShortName;
            """))

            raw_rows = result.fetchall()
            rows = [dict(r._mapping) for r in raw_rows]

            # ⭐ Fix Decimal → JSON issue
            from decimal import Decimal
            import json, html

            for r in rows:
                for key, value in r.items():
                    if isinstance(value, Decimal):
                        r[key] = float(value)

                r["json"] = html.escape(json.dumps(r))

    except Exception as e:
        print("Counterparties fetch error:", e)
        rows = []

    return render_template('counterparties.html', counterparties=rows)


@app.route('/counterparties/add', methods=['POST'])
@login_required
def add_counterparty():
    """Insert a new counterparty into SQL with an auto-generated short unique code."""
    import random
    import string

    # ---------------------------------------------
    # HELPERS
    # ---------------------------------------------

    # Short random 6-char code (A-Z + digits)
    def generate_short_code(length=6):
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

    # Clean text fields
    def clean(value):
        if not value:
            return None
        v = value.strip()
        return v if v not in ("", "None") else None

    # Convert numeric fields safely
    def num(v):
        if v is None or v == "":
            return None
        try:
            return float(v)
        except ValueError:
            return None

    # Checkbox → BIT
    def bit(name):
        return 1 if request.form.get(name) else 0

    # ---------------------------------------------
    # Generate system identifier
    # ---------------------------------------------
    company_number = generate_short_code()

    # ---------------------------------------------
    # Build parameters
    # ---------------------------------------------
    params = {
        "CompanyNumber": company_number,

        # Identity
        "ShortName": clean(request.form.get("ShortName")),
        "FullName": clean(request.form.get("FullName")),
        "Address": clean(request.form.get("Address")),
        "Country": clean(request.form.get("Country")),
        "TaxNumber": clean(request.form.get("TaxNumber")),

        # Commercial
        "CreditDays": num(request.form.get("CreditDays")),
        "RebillRate": num(request.form.get("RebillRate")),

        "DemRate1": num(request.form.get("DemRate1")),
        "DemStep1": num(request.form.get("DemStep1")),
        "DemRate2": num(request.form.get("DemRate2")),
        "DemStep2": num(request.form.get("DemStep2")),

        # Contacts
        "AccountingContact": clean(request.form.get("AccountingContact")),
        "AccountingEmail": clean(request.form.get("AccountingEmail")),
        "AccountingPhone": clean(request.form.get("AccountingPhone")),

        "OperationsContact": clean(request.form.get("OperationsContact")),
        "OperationsEmail": clean(request.form.get("OperationsEmail")),
        "OperationsPhone": clean(request.form.get("OperationsPhone")),

        "OtherContact": clean(request.form.get("OtherContact")),
        "OtherEmail": clean(request.form.get("OtherEmail")),
        "OtherPhone": clean(request.form.get("OtherPhone")),

        "BillingEmail": clean(request.form.get("BillingEmail")),

        # Roles (BIT fields)
        "IsCharterer": bit("IsCharterer"),
        "IsClient": bit("IsClient"),
        "IsOwner": bit("IsOwner"),
        "IsReceiver": bit("IsReceiver"),
        "IsShipper": bit("IsShipper"),
        "IsOperator": bit("IsOperator"),
        "IsAgent": bit("IsAgent"),
        "IsSurveyor": bit("IsSurveyor"),
        "IsBroker": bit("IsBroker"),
        "IsBunkerSupplier": bit("IsBunkerSupplier"),
        "IsPortAuthority": bit("IsPortAuthority"),

        # Risk flags
        "Blacklisted": bit("Blacklisted"),
        "Sanctioned": bit("Sanctioned"),
        "RiskNotes": clean(request.form.get("RiskNotes")),

        # General notes
        "Notes": clean(request.form.get("Notes")),

        # Audit
        "UpdatedBy": session.get("username"),
    }

    # ---------------------------------------------
    # SQL Insert
    # ---------------------------------------------
    sql = text("""
        INSERT INTO dbo.Counterparties (
            CompanyNumber,
            ShortName, FullName, Address, Country, TaxNumber,
            CreditDays, RebillRate,
            DemRate1, DemStep1, DemRate2, DemStep2,
            AccountingContact, AccountingEmail, AccountingPhone,
            OperationsContact, OperationsEmail, OperationsPhone,
            OtherContact, OtherEmail, OtherPhone,
            BillingEmail,
            IsCharterer, IsClient, IsOwner, IsReceiver, IsShipper, IsOperator,
            IsAgent, IsSurveyor, IsBroker, IsBunkerSupplier, IsPortAuthority,
            Blacklisted, Sanctioned, RiskNotes,
            Notes,
            UpdatedBy
        )
        VALUES (
            :CompanyNumber,
            :ShortName, :FullName, :Address, :Country, :TaxNumber,
            :CreditDays, :RebillRate,
            :DemRate1, :DemStep1, :DemRate2, :DemStep2,
            :AccountingContact, :AccountingEmail, :AccountingPhone,
            :OperationsContact, :OperationsEmail, :OperationsPhone,
            :OtherContact, :OtherEmail, :OtherPhone,
            :BillingEmail,
            :IsCharterer, :IsClient, :IsOwner, :IsReceiver, :IsShipper, :IsOperator,
            :IsAgent, :IsSurveyor, :IsBroker, :IsBunkerSupplier, :IsPortAuthority,
            :Blacklisted, :Sanctioned, :RiskNotes,
            :Notes,
            :UpdatedBy
        )
    """)

    # ---------------------------------------------
    # Execute Insert
    # ---------------------------------------------
    try:
        with get_db_connection() as conn:
            conn.execute(sql, params)
            conn.commit()
            print(f"✅ Counterparty added: {company_number}")
    except Exception as e:
        print("❌ Add counterparty error:", e)

    return redirect(url_for('counterparties_page'))

@app.route('/counterparties/update/<int:cp_id>', methods=['POST'])
@login_required
def update_counterparty(cp_id):
    """Update an existing counterparty in SQL."""

    # ---------------------------------------------
    # HELPERS (same as add route)
    # ---------------------------------------------
    def clean(value):
        if not value:
            return None
        v = value.strip()
        return v if v not in ("", "None") else None

    def num(v):
        if v is None or v == "":
            return None
        try:
            return float(v)
        except ValueError:
            return None

    def bit(name):
        return 1 if request.form.get(name) else 0

    # ---------------------------------------------
    # Build parameters
    # ---------------------------------------------
    params = {
        "CounterpartyID": cp_id,

        # Identity
        "ShortName": clean(request.form.get("ShortName")),
        "FullName": clean(request.form.get("FullName")),
        "Address": clean(request.form.get("Address")),
        "Country": clean(request.form.get("Country")),
        "TaxNumber": clean(request.form.get("TaxNumber")),

        # Commercial
        "CreditDays": num(request.form.get("CreditDays")),
        "RebillRate": num(request.form.get("RebillRate")),

        "DemRate1": num(request.form.get("DemRate1")),
        "DemStep1": num(request.form.get("DemStep1")),
        "DemRate2": num(request.form.get("DemRate2")),
        "DemStep2": num(request.form.get("DemStep2")),

        # Contacts
        "AccountingContact": clean(request.form.get("AccountingContact")),
        "AccountingEmail": clean(request.form.get("AccountingEmail")),
        "AccountingPhone": clean(request.form.get("AccountingPhone")),

        "OperationsContact": clean(request.form.get("OperationsContact")),
        "OperationsEmail": clean(request.form.get("OperationsEmail")),
        "OperationsPhone": clean(request.form.get("OperationsPhone")),

        "OtherContact": clean(request.form.get("OtherContact")),
        "OtherEmail": clean(request.form.get("OtherEmail")),
        "OtherPhone": clean(request.form.get("OtherPhone")),

        "BillingEmail": clean(request.form.get("BillingEmail")),

        # Roles
        "IsCharterer": bit("IsCharterer"),
        "IsClient": bit("IsClient"),
        "IsOwner": bit("IsOwner"),
        "IsReceiver": bit("IsReceiver"),
        "IsShipper": bit("IsShipper"),
        "IsOperator": bit("IsOperator"),
        "IsAgent": bit("IsAgent"),
        "IsSurveyor": bit("IsSurveyor"),
        "IsBroker": bit("IsBroker"),
        "IsBunkerSupplier": bit("IsBunkerSupplier"),
        "IsPortAuthority": bit("IsPortAuthority"),

        # Risk flags
        "Blacklisted": bit("Blacklisted"),
        "Sanctioned": bit("Sanctioned"),
        "RiskNotes": clean(request.form.get("RiskNotes")),

        # Notes
        "Notes": clean(request.form.get("Notes")),

        # Audit
        "UpdatedBy": session.get("username"),
    }

    # ---------------------------------------------
    # SQL UPDATE
    # ---------------------------------------------
    sql = text("""
        UPDATE dbo.Counterparties
        SET
            ShortName = :ShortName,
            FullName = :FullName,
            Address = :Address,
            Country = :Country,
            TaxNumber = :TaxNumber,

            CreditDays = :CreditDays,
            RebillRate = :RebillRate,
            DemRate1 = :DemRate1,
            DemStep1 = :DemStep1,
            DemRate2 = :DemRate2,
            DemStep2 = :DemStep2,

            AccountingContact = :AccountingContact,
            AccountingEmail = :AccountingEmail,
            AccountingPhone = :AccountingPhone,

            OperationsContact = :OperationsContact,
            OperationsEmail = :OperationsEmail,
            OperationsPhone = :OperationsPhone,

            OtherContact = :OtherContact,
            OtherEmail = :OtherEmail,
            OtherPhone = :OtherPhone,

            BillingEmail = :BillingEmail,

            IsCharterer = :IsCharterer,
            IsClient = :IsClient,
            IsOwner = :IsOwner,
            IsReceiver = :IsReceiver,
            IsShipper = :IsShipper,
            IsOperator = :IsOperator,
            IsAgent = :IsAgent,
            IsSurveyor = :IsSurveyor,
            IsBroker = :IsBroker,
            IsBunkerSupplier = :IsBunkerSupplier,
            IsPortAuthority = :IsPortAuthority,

            Blacklisted = :Blacklisted,
            Sanctioned = :Sanctioned,
            RiskNotes = :RiskNotes,

            Notes = :Notes,
            UpdatedBy = :UpdatedBy
        WHERE CounterpartyID = :CounterpartyID
    """)

    # ---------------------------------------------
    # Execute update
    # ---------------------------------------------
    try:
        with get_db_connection() as conn:
            conn.execute(sql, params)
            conn.commit()
            print(f"🔄 Updated Counterparty {cp_id}")
    except Exception as e:
        print("❌ Update counterparty error:", e)

    return redirect(url_for('counterparties_page'))

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

# 🚀 Run
# ----------------------------------------------------
if __name__ == '__main__':
    # Local dev only
    app.run(host='0.0.0.0', port=5000, debug=True)

@app.route('/update-case/<int:case_id>', methods=['POST'])
def update_case(case_id):
    print("🟡 update_case called")
    payload = request.get_json() or {}
    print(f"🟡 CaseID: {case_id}")
    print(f"🟡 Incoming payload: {payload}")

    # Validate column names to avoid SQL injection (allow only letters, numbers, underscore)
    import re
    valid_name = re.compile(r'^[A-Za-z0-9_]+$')

    # Keep only safe keys present in the payload
    updates = {k: v for k, v in payload.items() if isinstance(k, str) and valid_name.match(k)}
    if not updates:
        return jsonify(success=True, message="No valid changes to apply"), 200

    # Build parameterized UPDATE
    set_clause = ", ".join(f"[{k}] = :{k}" for k in updates.keys())
    sql = text(f"UPDATE Cases SET {set_clause} WHERE CaseID = :case_id")
    params = {**updates, "case_id": case_id}

    try:
        with get_db_connection() as conn:
            conn.execute(sql, params)
            conn.commit()
        return jsonify(success=True), 200
    except Exception as err:
        print(f"❌ Error updating case {case_id}:", err)
        try:
            with get_db_connection() as conn:
                conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, error=str(err)), 500
    
    @app.route('/api/account/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json() or {}

    current_pw = data.get("current_password", "")
    new_pw = data.get("new_password", "")
    confirm_pw = data.get("confirm_password", "")

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify(success=False, error="All fields are required."), 400

    if new_pw != confirm_pw:
        return jsonify(success=False, error="New passwords do not match."), 400

    if len(new_pw) < 12:
        return jsonify(success=False, error="Password must be at least 12 characters long."), 400

    username = session.get("username")
    if not username:
        return jsonify(success=False, error="Not authenticated."), 401

    try:
        with get_db_connection() as conn:
            result = conn.execute(
                text("SELECT HashedPassword FROM dbo.UsersSecure WHERE Username = :u"),
                {"u": username}
            )
            row = result.fetchone()

            if not row:
                return jsonify(success=False, error="User not found."), 404

            stored_hash = row[0]

            if not pbkdf2_sha256.verify(current_pw, stored_hash.strip()):
                return jsonify(success=False, error="Current password is incorrect."), 403

            new_hash = pbkdf2_sha256.hash(new_pw)

            conn.execute(
                text("""
                    UPDATE dbo.UsersSecure
                    SET HashedPassword = :h
                    WHERE Username = :u
                """),
                {"h": new_hash, "u": username}
            )
            conn.commit()

        return jsonify(success=True)

    except Exception as e:
        print("❌ Change password error:", e)
        return jsonify(success=False, error="Failed to update password."), 500