from sqlalchemy import create_engine
from flask import session, redirect, url_for
from functools import wraps
import os

# 🔌 SQLAlchemy Engine
conn_str = os.getenv(
    "DB_CONNECTION_STRING",
    "mssql+pyodbc://Deepblueadmin:Atlantic!Beaufort6633@deepbluedb.database.windows.net,1433/DeepBlueDB?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=yes"
)
engine = create_engine(conn_str, pool_pre_ping=True, pool_recycle=3600)

# 🗄 Database Connection
def get_db_connection():
    try:
        return engine.connect()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise

# 🔐 Login Required Decorator
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper