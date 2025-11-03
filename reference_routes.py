# reference_routes.py
from flask import Blueprint, render_template

# Create the blueprint
reference_bp = Blueprint('reference_bp', __name__, template_folder='templates')

# ===== ROUTES =====

@reference_bp.route('/reference')
def reference_page():
    """
    Reference Data dashboard page.
    Displays card-based entry points for Ships, Charterers, Clients, and Ports.
    """
    return render_template('reference.html')