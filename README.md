<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="Vibe Board Logo" />
</p>

<h1 align="center">Vibe Board</h1>

<p align="center">
  <strong>A beautiful, open-source kanban board with Firebase backend and AI-ready architecture.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vue-3.5-42b883?style=flat-square&logo=vuedotjs" alt="Vue 3" />
  <img src="https://img.shields.io/badge/tailwind-4.2-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/firebase-12-FFCA28?style=flat-square&logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/pinia-3-ffd859?style=flat-square" alt="Pinia" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" />
</p>

---

## What is Vibe Board?

Vibe Board is an in-house Trello alternative built for teams and individuals who want full control over their task management. It features a polished dark/light theme, real-time sync via Firebase, image attachments, project grouping, and a foundation designed for future AI integrations.

### Features

- **Kanban boards** -- Create multiple boards with custom emoji icons
- **Custom columns** -- Add, rename, reorder, and color-code columns (15 colors)
- **Cards** -- Create, edit, drag-and-drop between columns, add descriptions and labels
- **Image attachments** -- Upload images to cards via Firebase Storage with lightbox preview
- **Projects** -- Group cards across boards by project with color-coded badges
- **Dark / Light theme** -- Toggle between a deep "Dark Forge" theme and a warm pastel light mode
- **Authentication** -- Google sign-in and email/password via Firebase Auth
- **Real-time sync** -- All data syncs instantly via Firestore `onSnapshot` listeners
- **User-scoped data** -- Each user only sees their own boards and projects
- **Audit trail** -- Cards track created by, created at, last updated, and updated by
- **Responsive** -- Works on desktop and tablet

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API + `<script setup>`) |
| Styling | Tailwind CSS v4 |
| State | Pinia |
| Routing | Vue Router 4 |
| Backend | Firebase (Firestore + Storage + Auth) |
| Build | Vite |
| Drag & Drop | Native HTML5 API (zero dependencies) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Firebase](https://console.firebase.google.com/) project

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/vibe-board.git
cd vibe-board
npm install
```

### 2. Set up Firebase

#### Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** and follow the wizard
3. Once created, click the **Web** icon (`</>`) to register a web app
4. Copy the `firebaseConfig` object it gives you

#### Enable services

In your Firebase project, enable these three services:

**Firestore Database**

1. Go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (you can lock it down later)
4. Select a region close to your users

**Storage**

1. Go to **Build > Storage**
2. Click **Get started**
3. Choose **Start in test mode**

**Authentication**

1. Go to **Build > Authentication > Sign-in method**
2. Enable **Email/Password**
3. Enable **Google** (select a support email when prompted)

#### Create Firestore indexes

Vibe Board uses composite queries that require indexes. The easiest way:

1. Start the app and open the browser console
2. You'll see errors with direct links to create the required indexes
3. Click each link and hit **Create index** in Firebase Console

Or create them manually in **Firestore > Indexes**:

| Collection | Fields |
|-----------|--------|
| `boards` | `userId` (Asc) + `createdAt` (Asc) |
| `projects` | `userId` (Asc) + `createdAt` (Asc) |

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your Firebase config values in `.env`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

You can find all these values in **Firebase Console > Project Settings > Your apps > Web app**.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in.

---

## Project Structure

```
src/
├── components/
│   ├── AddColumnButton.vue    # "Add column" inline form
│   ├── CardModal.vue          # Card editor with images, labels, projects, metadata
│   ├── EditBoardModal.vue     # Board name/emoji editor
│   ├── KanbanCard.vue         # Card component with cover image + project badge
│   ├── KanbanColumn.vue       # Column with color picker, drag-and-drop cards
│   ├── ProjectModal.vue       # Create/edit project modal
│   └── ThemeToggle.vue        # Dark/light theme switch
├── stores/
│   ├── auth.js                # Firebase Auth (Google + email/password)
│   ├── board.js               # Boards, columns, cards CRUD + image uploads
│   ├── projects.js            # Projects CRUD
│   └── theme.js               # Theme persistence
├── views/
│   ├── Board.vue              # Kanban board view
│   ├── Dashboard.vue          # Home: projects list + boards grid
│   └── Login.vue              # Auth page (login/register)
├── App.vue                    # Root component with auth gating
├── firebase.js                # Firebase initialization
├── main.js                    # App entry, router, auth guard
└── style.css                  # Tailwind + theme variables + animations
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## Securing for Production

The setup instructions use **test mode** (open access). Before going to production, update your rules:

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read, update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    match /projects/{projectId} {
      allow read, update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /boards/{boardId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Roadmap

- [ ] AI-powered task suggestions and auto-categorization
- [ ] Board sharing and team collaboration
- [ ] Due dates and calendar view
- [ ] Activity feed / changelog
- [ ] Keyboard shortcuts
- [ ] Mobile app (PWA)
- [ ] Integrations (GitHub, Slack, Linear)

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

[MIT](LICENSE)

---

<p align="center">
  Built with Vue, Tailwind, Firebase, and good vibes.
</p>
