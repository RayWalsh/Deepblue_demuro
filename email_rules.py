# ============================================================
# 📧 Email Rules Blueprint (for Outlook Tagging Automation)
# ============================================================

from flask import Blueprint, render_template, request, redirect, url_for, flash, Response, session
import os, requests, re, time
from datetime import datetime
from dotenv import load_dotenv
from functools import wraps

# ------------------------------------------------------------
# ⚙️ BLUEPRINT SETUP
# ------------------------------------------------------------
email_rules_bp = Blueprint('email_rules', __name__, template_folder='templates')
load_dotenv()

# ------------------------------------------------------------
# 🔒 REQUIRE LOGIN FOR ALL EMAIL ROUTES
# ------------------------------------------------------------
@email_rules_bp.before_request
def require_login():
    if 'username' not in session:
        return redirect(url_for('login'))

# ------------------------------------------------------------
# 🧪 TEST: Verify .env loading
# ------------------------------------------------------------
@email_rules_bp.route("/test_env")
def test_env():
    tenant = os.getenv("TENANT_ID")
    client = os.getenv("CLIENT_ID")
    secret = os.getenv("CLIENT_SECRET")
    mailbox = os.getenv("MAILBOX")
    return {
        "TENANT_ID": tenant,
        "CLIENT_ID": client,
        "CLIENT_SECRET": "***hidden***" if secret else None,
        "MAILBOX": mailbox
    }

TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
MAILBOX = os.getenv("MAILBOX")

# ------------------------------------------------------------
# 🔐 AUTHENTICATION (Microsoft Graph)
# ------------------------------------------------------------
def get_graph_token():
    """Authenticate using client credentials and return Graph access token."""
    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default"
    }
    resp = requests.post(token_url, data=token_data)
    resp.raise_for_status()
    return resp.json()["access_token"]

# ------------------------------------------------------------
# 📅 DATE VARIANTS GENERATOR
# ------------------------------------------------------------
def generate_date_variants(cp_date_str):
    """Return 40+ permutations including '11 APR'25' style."""
    try:
        cp_date = datetime.strptime(cp_date_str.strip(), "%d%b%y")
    except ValueError:
        try:
            cp_date = datetime.strptime(cp_date_str.strip(), "%d%b%Y")
        except ValueError:
            flash(f"⚠️ Invalid CP date format: {cp_date_str}")
            return []

    day = cp_date.day
    month = cp_date.strftime("%b")
    month_full = cp_date.strftime("%B")
    month_upper = cp_date.strftime("%b").upper()
    year_full = cp_date.strftime("%Y")
    year_short = cp_date.strftime("%y")

    if 4 <= day <= 20 or 24 <= day <= 30:
        suffix = "th"
    else:
        suffix = ["st", "nd", "rd"][day % 10 - 1]
    day_ordinal = f"{day}{suffix}"

    variants = [
        f"{day:02d}/{cp_date.month:02d}/{year_full}",
        f"{day:02d}/{cp_date.month:02d}/{year_short}",
        f"{day:02d}.{cp_date.month:02d}.{year_full}",
        f"{day:02d}.{cp_date.month:02d}.{year_short}",
        f"{day:02d}-{cp_date.month:02d}-{year_full}",
        f"{day:02d}-{cp_date.month:02d}-{year_short}",
        f"{day}/{cp_date.month}/{year_short}",
        f"{year_full}-{cp_date.month:02d}-{day:02d}",
        f"{year_full}/{cp_date.month:02d}/{day:02d}",
        f"{year_full}.{cp_date.month:02d}.{day:02d}",
        f"{cp_date.month:02d}/{day:02d}/{year_full}",
        f"{cp_date.month}/{day}/{year_short}",
        f"{cp_date.month:02d}-{day:02d}-{year_full}",
        f"{day:02d}-{month}-{year_short}",
        f"{day:02d}-{month_upper}-{year_full}",
        f"{day:02d}-{month_upper}-{year_short}",
        f"{day:02d}-{month}-{year_full}",
        f"{day:02d} {month_upper}'{year_short}",
        f"{day} {month} {year_short}",
        f"{day} {month} {year_full}",
        f"{day_ordinal} {month} {year_short}",
        f"{day_ordinal} {month} {year_full}",
        f"{day}{month}{year_short}",
        f"{day} {month_full} {year_short}",
        f"{day} {month_full} {year_full}",
        f"{day_ordinal} {month_full} {year_short}",
        f"{day_ordinal} {month_full} {year_full}",
        f"{month_full} {day}, {year_full}",
        f"{month} {day}, {year_full}",
        f"{month} {day:02d}, {year_full}",
        f"the {day_ordinal} of {month_full} {year_full}",
        f"{day_ordinal} {month_full}, {year_full}",
        f"{cp_date.strftime('%A')}, {day} {month_full} {year_full}",
        f"{cp_date.strftime('%a')}, {day} {month} {year_full}",
    ]
    return list(dict.fromkeys(variants))

# ------------------------------------------------------------
# 📂 CATEGORIES
# ------------------------------------------------------------
def get_categories():
    """Fetch and sort categories by DBLF number."""
    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/outlook/masterCategories"
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    cats = resp.json().get("value", [])

    def extract_dblf(cat):
        match = re.search(r"DBLF(\d+)", cat.get("displayName", ""))
        return int(match.group(1)) if match else 999999

    cats.sort(key=extract_dblf, reverse=True)
    return cats

# ------------------------------------------------------------
# 🌍 ROUTES
# ------------------------------------------------------------
@email_rules_bp.route("/")
def index():
    """Display categories and show rule existence."""
    categories = get_categories()
    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}

    rules_url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/mailFolders/inbox/messageRules"
    rules_resp = requests.get(rules_url, headers=headers)
    rules_resp.raise_for_status()
    existing_rules = rules_resp.json().get("value", [])

    rule_names = {r["displayName"].lower() for r in existing_rules if r["displayName"].lower().startswith("auto-tag ")}
    for cat in categories:
        cat["rule_exists"] = f"auto-tag {cat['displayName']}".lower() in rule_names

    # ✅ Render dedicated page now
    return render_template("email_rules.html", categories=categories)

# ------------------------------------------------------------
# ➕ CREATE CATEGORY
# ------------------------------------------------------------
@email_rules_bp.route("/create", methods=["POST"])
def create_category():
    """Create new Outlook category."""
    ref = request.form["reference"].strip()
    ship = request.form["ship"].strip()
    cpdate = request.form["cpdate"].strip()
    color = request.form["color"].strip()
    category_name = f"{ref} - {ship} - {cpdate}"

    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    cats = get_categories()

    if any(c["displayName"].lower() == category_name.lower() for c in cats):
        flash(f"✅ Category already exists: {category_name}")
        return redirect(url_for("email_rules.index"))

    payload = {"displayName": category_name, "color": color}
    url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/outlook/masterCategories"
    resp = requests.post(url, headers=headers, json=payload)

    if resp.status_code == 201:
        flash(f"✅ Created new category: {category_name}")
    else:
        flash(f"⚠️ Failed to create category: {resp.text}")
    return redirect(url_for("email_rules.index"))

# ------------------------------------------------------------
# ⚙️ CREATE RULE
# ------------------------------------------------------------
@email_rules_bp.route("/create_rule/<category_name>")
def create_rule(category_name):
    """Create new Outlook inbox rule that tags matching emails."""
    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    parts = category_name.split(" - ")
    ref = parts[0].strip() if len(parts) > 0 else "UnknownRef"
    ship = parts[1].strip() if len(parts) > 1 else "UnknownShip"
    cpdate = parts[2].strip() if len(parts) > 2 else None
    if not cpdate:
        flash(f"⚠️ No CP date found in category: {category_name}")
        return redirect(url_for("email_rules.index"))

    date_variants = generate_date_variants(cpdate)
    if not date_variants:
        return redirect(url_for("email_rules.index"))

    rule_name = f"Auto-tag {ref} - {ship} - {cpdate}"

    rules_url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/mailFolders/inbox/messageRules"
    existing_rules = requests.get(rules_url, headers=headers).json().get("value", [])
    if any(rule["displayName"].lower() == rule_name.lower() for rule in existing_rules):
        flash(f"✅ Rule already exists for '{rule_name}'.")
        return redirect(url_for("email_rules.index"))

    payload = {
        "displayName": rule_name,
        "sequence": 1,
        "isEnabled": True,
        "conditions": {
            "subjectContains": [ship],
            "bodyOrSubjectContains": date_variants
        },
        "actions": {
            "assignCategories": [category_name]
        },
        "stopProcessingRules": False
    }

    resp = requests.post(rules_url, headers=headers, json=payload)
    if resp.status_code == 201:
        flash(f"✅ Rule created for '{category_name}'.")
    else:
        flash(f"⚠️ Failed to create rule: {resp.text}")
    return redirect(url_for("email_rules.index"))

@email_rules_bp.route("/update/<cat_id>", methods=["POST"])
def update_category(cat_id):
    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = request.form
    payload = {
        "displayName": f"{data['reference']} - {data['ship']} - {data['cpdate']}",
        "color": data['color']
    }
    resp = requests.patch(
        f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/outlook/masterCategories/{cat_id}",
        headers=headers,
        json=payload
    )
    if resp.status_code == 200:
        flash("✅ Category updated. Please re-run the rule to tag older emails.")
    else:
        flash(f"⚠️ Failed to update category: {resp.text}")
    return redirect(url_for("email_rules.index"))

# ------------------------------------------------------------
# 🧹 DELETE CATEGORY + MATCHING RULE
# ------------------------------------------------------------
@email_rules_bp.route("/delete/<cat_id>")
def delete_category(cat_id):
    """Delete category and its auto-tag rule."""
    token = get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}

    cat_url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/outlook/masterCategories/{cat_id}"
    cat_resp = requests.get(cat_url, headers=headers)
    if cat_resp.status_code != 200:
        flash(f"⚠️ Could not fetch category: {cat_resp.text}")
        return redirect(url_for("email_rules.index"))

    category = cat_resp.json()
    category_name = category.get("displayName", "")

    del_resp = requests.delete(cat_url, headers=headers)
    if del_resp.status_code == 204:
        flash(f"🗑 Deleted category '{category_name}'.")
    else:
        flash(f"⚠️ Failed to delete category: {del_resp.text}")
        return redirect(url_for("email_rules.index"))

    expected_rule_name = f"auto-tag {category_name}".lower()
    rules_url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/mailFolders/inbox/messageRules"
    rules_resp = requests.get(rules_url, headers=headers)
    if rules_resp.status_code == 200:
        for rule in rules_resp.json().get("value", []):
            if rule["displayName"].lower() == expected_rule_name:
                rule_id = rule["id"]
                requests.delete(f"{rules_url}/{rule_id}", headers=headers)
                flash(f"🧹 Deleted matching rule '{rule['displayName']}'.")
                break
    return redirect(url_for("email_rules.index"))

# ------------------------------------------------------------
# 📨 RUN RULE RETROACTIVELY (SSE STREAM + DATE FILTER)
# ------------------------------------------------------------
@email_rules_bp.route("/run_rule/<category_name>", defaults={"days": 90})
@email_rules_bp.route("/run_rule/<category_name>/<int:days>")
def run_rule(category_name, days):
    """Apply the category to all matching messages in the inbox, streaming progress via SSE."""
    def generate():
        token = get_graph_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        yield f"data: Starting rule for {category_name} (last {days} days)\n\n"
        time.sleep(0.5)

        parts = category_name.split(" - ")
        ship = parts[1].strip() if len(parts) > 1 else ""
        cpdate = parts[2].strip() if len(parts) > 2 else ""

        date_variants = generate_date_variants(cpdate)
        if not date_variants:
            yield f"data: ⚠️ Invalid date format, stopping.\n\n"
            return

        yield f"data: Searching inbox messages (last {days} days) for '{ship}' + date variants...\n\n"

        from datetime import datetime, timedelta
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        base_url = (
            f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/mailFolders/inbox/messages"
            f"?$top=50&$select=id,subject,bodyPreview,receivedDateTime"
            f"&$filter=receivedDateTime ge {start_date}"
        )

        next_link = base_url
        all_messages = []
        max_total = 500

        while next_link and len(all_messages) < max_total:
            resp = requests.get(next_link, headers=headers)
            if resp.status_code != 200:
                yield f"data: ⚠️ Error fetching messages: {resp.text}\n\n"
                break

            data = resp.json()
            all_messages.extend(data.get("value", []))
            next_link = data.get("@odata.nextLink")
            yield f"data: Retrieved {len(all_messages)} messages so far...\n\n"
            time.sleep(0.2)

        if not all_messages:
            yield f"data: ⚠️ No messages found in last {days} days.\n\n"
            yield "data: DONE\n\n"
            return

        IGNORE_KEYWORDS = ["[report]", "[summary]", "[digest]", "automated notification"]
        filtered_messages = []

        for msg in all_messages:
            subject = msg.get("subject", "") or ""
            preview = msg.get("bodyPreview", "") or ""
            combined = (subject + " " + preview).lower()

            if any(ignore in subject.lower() for ignore in IGNORE_KEYWORDS):
                yield f"data: Skipping '{subject}' (ignored keyword)\n\n"
                continue

            if ship.lower() in combined and any(d.lower() in combined for d in date_variants):
                filtered_messages.append(msg)
                yield f"data: Match found in '{subject}'\n\n"

        yield f"data: ✅ Found {len(filtered_messages)} matching messages (ship + date).\n\n"

        for idx, msg in enumerate(filtered_messages, start=1):
            msg_id = msg["id"]
            patch_url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/messages/{msg_id}"
            patch_data = {"Categories": [category_name]}
            requests.patch(patch_url, headers=headers, json=patch_data)
            yield f"data: Tagged {idx}/{len(filtered_messages)} — {msg.get('subject', '')}\n\n"
            time.sleep(0.05)

        yield f"data: ✅ Completed — {len(filtered_messages)} messages updated.\n\n"
        yield "data: DONE\n\n"

    return Response(generate(), mimetype='text/event-stream')