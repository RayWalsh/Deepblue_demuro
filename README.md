# Deepblue_demuro
V3 of the Deep Blue laytime manager

# Deep Blue Portal (deepblue_demuro)

A unified Flask-based web application for **Deep Blue Shipping**, combining multiple operational tools under one modern interface.

---

## 🚀 Overview

The **Deep Blue Portal** brings together several key modules into a single web platform:

1. **Login & Authentication** – Secure login, session management, and logout.
2. **Dashboard** – A unified landing page for all tools.
3. **Email Tagging (Luberef Rule Manager)** – Categorize and manage incoming emails.
4. **Laytime & Demurrage Calculator** – Calculate demurrage automatically, with full case management.
5. **SOF Parser & Reporting (Future)** – Extract and analyze key time events from Statements of Facts (PDFs).

All modules share the same **DBS design language**:  
sidebar navigation, topbar user menu, dark/light modes, and modern, professional styling.

---

## 🧱 Project Structure
deepblue_demuro/
├── app.py
├── requirements.txt
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
├── templates/
│   ├── login.html
│   ├── index.html
│   └── email_rules.html
└── modules/
    ├── accounts/
    └── email_rules/

---

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/deepblueshipping/deepblue_demuro.git
   cd deepblue_demuro

   ## 🧩 Current Phase
Phase 1 – Base Flask setup (Login, Homepage, Email Tagging integration)