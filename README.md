# Yogasana Sports Championship Portal

A full-stack web application designed for state-level sports administrations to manage athlete registrations, documentation scrutinization, and district-level nominations for the Telangana State Inter-District Yogasana Sports Championship.

---

## 📌 Features

- **Role-Based Access Control (RBAC):**
  - **District Secretaries:** Register athletes and view rosters strictly within their assigned district.
  - **State Admins:** Full visibility across all 33 districts with authority to review, verify, or request clarification on athlete submissions.
- **Dynamic Nomination Dashboard:** Real-time metrics overview (Total Nominated, Verified, Pending Review, Clarifications Needed).
- **Client-Side Filtering & Search:** Instant search by chest number/name and category/status filtering.
- **Secure Authentication:** JWT-based session handling using HTTP-only cookies.
- **Document Management:** Identity and age proof verification workflows.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript, Font Awesome
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (via Mongoose ODM)
- **Authentication & Security:** JSON Web Tokens (JWT), `bcryptjs`, `cookie-parser`

---

## 📁 Project Structure

```text
yogasana-portal/
├── models/
│   ├── Athlete.js          # Athlete schema (details, category, events, status)
│   └── User.js             # User schema with roles ('admin', 'secretary')
├── routes/
│   ├── athletes.js         # API routes for nomination and listing
│   └── auth.js             # Login and authentication endpoints
├── middleware/
│   └── auth.js             # JWT verification and route protection
├── static/
│   ├── css/
│   │   ├── input.css       # Tailwind entry point
│   │   ├── output.css      # Compiled Tailwind styles
│   │   └── custom.css      # Custom UI overrides
│   └── js/
│       └── main.js         # Shared client scripts
├── templates/
│   ├── dashboard.html      # Secretary & admin main dashboard
│   ├── nominate.html       # Athlete registration form
│   ├── login.html          # Authentication portal
│   └── index.html          # Public landing page
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── package.json
└── server.js               # Application entry point
