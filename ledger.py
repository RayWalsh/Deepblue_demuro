# ==============================================
# 📘 ledger.py — Ledger Blueprint for Deep Blue Portal
# ==============================================
from flask import Blueprint, render_template, jsonify, request
from sqlalchemy import text
from sqlalchemy import inspect

# Create the Blueprint
ledger_bp = Blueprint('ledger_bp', __name__)

# -------------------------------
# 🌐 Page Route — /ledger
# -------------------------------
@ledger_bp.route('/ledger')
def ledger_page():
    from app import login_required

    @login_required
    def inner():
        return render_template('ledger.html')

    return inner()

# -------------------------------
# 🧾 API Route — /api/ledger
# -------------------------------
@ledger_bp.route('/api/ledger', methods=['GET'])
def get_ledger():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:

                # 1️⃣ Fetch rows
                result = conn.execute(text("""
                    SELECT * FROM dbo.Cases
                    ORDER BY CPDate DESC
                """))
                rows = [dict(row._mapping) for row in result.fetchall()]

                # 2️⃣ Fetch column definitions WITH metadata
                col_result = conn.execute(text("""
                    SELECT
                        c.COLUMN_NAME       AS name,
                        COALESCE(m.DisplayName, c.COLUMN_NAME) AS display,
                        c.DATA_TYPE         AS type,
                        m.FieldType         AS fieldType
                    FROM INFORMATION_SCHEMA.COLUMNS c
                    LEFT JOIN dbo.ColumnMeta m
                        ON m.ColumnName = c.COLUMN_NAME
                    WHERE c.TABLE_NAME = 'Cases'
                    ORDER BY c.ORDINAL_POSITION
                """))

                columns = [dict(row._mapping) for row in col_result.fetchall()]

            return jsonify({
                "columns": columns,
                "rows": rows
            }), 200

        except Exception as e:
            print("❌ Error fetching ledger data:", e)
            return jsonify({"error": str(e)}), 500

    return inner()

# -------------------------------
# 💾 API Route — Update Ledger Item (ISO-only)
# -------------------------------
@ledger_bp.route('/api/update-ledger-item/<int:case_id>', methods=['PUT'])
def update_ledger_item(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            # 🧹 Clean up empty strings and numeric text
            for k, v in list(data.items()):
                if isinstance(v, str):
                    v_strip = v.strip()
                    if v_strip == "":
                        data[k] = None
                    else:
                        # detect numeric strings like "12", "12.5"
                        num_check = v_strip.replace(".", "", 1)
                        if num_check.isdigit():
                            try:
                                data[k] = float(v_strip) if "." in v_strip else int(v_strip)
                            except ValueError:
                                pass  # leave as string

            # 🔒 Exclude identity & protected fields
            protected_fields = ["CaseID", "DeepBlueRef"]
            update_fields = [key for key in data.keys() if key not in protected_fields]

            if not update_fields:
                return jsonify({"error": "No valid fields to update"}), 400

            set_clause = ", ".join([f"{key} = :{key}" for key in update_fields])
            sql = text(f"UPDATE dbo.Cases SET {set_clause} WHERE CaseID = :case_id")
            data["case_id"] = case_id

            with get_db_connection() as conn:
                conn.execute(sql, data)
                conn.commit()

            print(f"✅ Updated CaseID {case_id}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print(f"❌ Error updating ledger item {case_id}:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# -------------------------------
# 🗑 API Route — Delete Ledger Item
# -------------------------------
@ledger_bp.route('/api/delete-ledger-item/<int:case_id>', methods=['DELETE'])
def delete_ledger_item(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                conn.execute(text("DELETE FROM dbo.Cases WHERE CaseID = :case_id"), {"case_id": case_id})
                conn.commit()

            print(f"🗑 Deleted CaseID {case_id}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print(f"❌ Error deleting ledger item {case_id}:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# -------------------------------
# ➕ API Route — Add New Ledger Item (ISO-only)
# -------------------------------
@ledger_bp.route('/api/add-ledger-item', methods=['POST'])
def add_ledger_item():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            # 🔒 Remove protected/identity fields
            for field in ["CaseID"]:
                data.pop(field, None)

            # 🧹 Clean up empty strings and numeric text
            for k, v in list(data.items()):
                if isinstance(v, str):
                    v_strip = v.strip()
                    if v_strip == "":
                        data[k] = None
                    else:
                        # detect numeric strings
                        num_check = v_strip.replace(".", "", 1)
                        if num_check.isdigit():
                            try:
                                data[k] = float(v_strip) if "." in v_strip else int(v_strip)
                            except ValueError:
                                pass  # leave as string

            # ✅ Expect all date/time strings already in ISO ("YYYY-MM-DD HH:MM:SS")
            # SQL Server DATETIME2 can handle that directly.

            columns = ", ".join(data.keys())
            values = ", ".join([f":{k}" for k in data.keys()])
            sql = text(f"INSERT INTO dbo.Cases ({columns}) VALUES ({values})")

            with get_db_connection() as conn:
                conn.execute(sql, data)
                conn.commit()

            print(f"✅ Added new ledger item {data.get('DeepBlueRef', '')}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error adding ledger item:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# ==============================================
# ⚙️ ADVANCED SETTINGS API — Column Management
# ==============================================

# -------------------------------
# 📋 List SQL Columns
# -------------------------------
@ledger_bp.route("/api/columns", methods=["GET"])
def get_columns():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                inspector = inspect(conn)
                columns = []
                for col in inspector.get_columns("Cases", schema="dbo"):
                    columns.append({
                        "name": col["name"],
                        "type": str(col["type"])
                    })
            return jsonify({"columns": columns}), 200
        except Exception as e:
            print("❌ Error fetching columns:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# ➕ Add New Column
# -------------------------------
@ledger_bp.route("/api/add-column", methods=["POST"])
def add_column():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            col_name = data.get("name")
            col_type = data.get("type", "NVARCHAR(255)")

            if not col_name:
                return jsonify({"success": False, "error": "Column name required"}), 400

            # ⚠️ Protect key columns
            if col_name in ["CaseID", "DeepBlueRef"]:
                return jsonify({"success": False, "error": "Protected column cannot be added"}), 400

            sql = text(f"ALTER TABLE dbo.Cases ADD [{col_name}] {col_type}")
            with get_db_connection() as conn:
                conn.execute(sql)
                conn.commit()

            print(f"✅ Added column {col_name} ({col_type})")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error adding column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# 🗑 Delete Column
# -------------------------------
@ledger_bp.route("/api/delete-column/<string:col_name>", methods=["DELETE"])
def delete_column(col_name):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            if col_name in ["CaseID", "DeepBlueRef"]:
                return jsonify({"success": False, "error": "Protected column cannot be deleted"}), 400

            sql = text(f"ALTER TABLE dbo.Cases DROP COLUMN [{col_name}]")
            with get_db_connection() as conn:
                conn.execute(sql)
                conn.commit()

            print(f"🗑 Deleted column {col_name}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error deleting column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# 🔄 Reset Columns (optional)
# -------------------------------
@ledger_bp.route("/api/reset-columns", methods=["POST"])
def reset_columns():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            # Example: You could rebuild missing columns to your default schema here.
            # For now, this just confirms the route works.
            print("🔄 Reset columns called (placeholder)")
            return jsonify({"success": True, "message": "Reset executed"}), 200

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

@ledger_bp.route("/api/column-metadata/<string:column_name>", methods=["POST"])
def update_column_metadata(column_name):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        allowed_fields = {
            "DisplayName",
            "GroupName",
            "FieldType",
            "IsEditable",
            "IsVisible"
        }

        # 1️⃣ Keep only allowed fields
        updates = {k: v for k, v in data.items() if k in allowed_fields}

        if not updates:
            return jsonify({"success": False, "error": "No valid fields"}), 400

        # 2️⃣ 🔑 NORMALISE EMPTY STRINGS → NULL  ✅ ADD IT HERE
        for k, v in updates.items():
            if isinstance(v, str) and v.strip() == "":
                updates[k] = None

        # 3️⃣ Build SQL
        set_clause = ", ".join([f"{k} = :{k}" for k in updates])
        updates["ColumnName"] = column_name

        sql = text(f"""
            UPDATE dbo.ColumnMeta
            SET {set_clause}
            WHERE ColumnName = :ColumnName
        """)

        try:
            with get_db_connection() as conn:
                conn.execute(sql, updates)
                conn.commit()

            return jsonify({"success": True})
        except Exception as e:
            print("❌ Column meta update failed:", e)
            return jsonify({"success": False, "error": "DB update failed"}), 500

    return inner()

@ledger_bp.route("/api/column-choices/<string:column_name>", methods=["POST"])
def save_column_choices(column_name):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        data = request.get_json() or {}
        choices = data.get("choices", [])

        with get_db_connection() as conn:
            # 1️⃣ Remove existing choices for this column
            conn.execute(
                text("DELETE FROM ColumnChoices WHERE ColumnName = :col"),
                {"col": column_name}
            )

            # 2️⃣ Insert updated choices
            for idx, c in enumerate(choices, start=1):
                conn.execute(
                    text("""
                        INSERT INTO ColumnChoices
                        (ColumnName, ChoiceValue, IsActive, DisplayOrder)
                        VALUES (:col, :val, :active, :order)
                    """),
                    {
                        "col": column_name,
                        "val": c.get("Value"),              # from JS
                        "active": bool(c.get("IsActive")),
                        "order": idx
                    }
                )

            conn.commit()

        return jsonify({"success": True})

    return inner()

@ledger_bp.route("/api/column-groups", methods=["GET"])
def get_column_groups():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        with get_db_connection() as conn:
            res = conn.execute(text("""
                SELECT DISTINCT GroupName
                FROM dbo.ColumnMeta
                WHERE GroupName IS NOT NULL AND LTRIM(RTRIM(GroupName)) <> ''
                ORDER BY GroupName
            """))
            groups = [r[0] for r in res.fetchall()]
        return jsonify({"success": True, "groups": groups})

    return inner()