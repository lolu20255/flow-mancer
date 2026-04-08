# Flowmancer — Project Context for Claude

## Overview

Flowmancer (formerly Vibe Board) is an open-source kanban board app. It's a Trello alternative built for personal/team task management with plans for future AI integrations.

- **Repo**: github.com/lolu20255/flow-mancer
- **Live**: https://flow-mancer.vercel.app
- **Owner**: Mario Diaz (@lolu20255)

## Rules
- Never run any git commands

## Tech Stack

- **Framework**: Vue 3 (Composition API + `<script setup>`)
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`
- **State**: Pinia
- **Routing**: Vue Router 4
- **Backend**: Firebase (Firestore + Storage + Auth)
- **Build**: Vite
- **Hosting**: Vercel
- **Drag & Drop**: Native HTML5 API (no library)

## Architecture

### Firebase Config
- Project ID: `vibe-board-3b2cf`
- Config stored in `.env` (gitignored), loaded via `import.meta.env.VITE_*`
- `.env.example` has placeholder values for new contributors
- Vercel env vars configured for production builds

### Firestore Structure
- `boards` collection: each doc has `{ name, emoji, columns: [...], userId, createdBy, createdAt, updatedAt }`
- `projects` collection: each doc has `{ name, color, emoji, userId, createdAt }`
- Columns and cards are nested arrays within board documents (not subcollections)
- Cards have: `{ id, title, description, labels, images, projectId, createdBy, updatedBy, createdAt, updatedAt }`
- Both collections use composite indexes: `userId` (Asc) + `createdAt` (Asc)
- All data is scoped per user via `where('userId', '==', uid)` queries

### Authentication
- Google sign-in + email/password via Firebase Auth
- Auth store in `src/stores/auth.js` with `onAuthStateChanged` listener
- Route guard in `main.js` — waits for auth to resolve before first navigation
- Protected routes have `meta: { auth: true }`, login has `meta: { guest: true }`

### Theme System
- Dark ("Dark Forge") and light ("Pastel") themes
- Implemented by overriding Tailwind CSS custom properties via `:root[data-theme="light"]`
- Theme choice persisted to localStorage (`flowmancer-theme` key)
- 350ms smooth transitions on theme switch
- Important: never use hardcoded `text-white` or `hover:text-white` — use `text-forge-50` which adapts to both themes

### Key Design Decisions
- **Fonts**: Fraunces (display/serif) + Outfit (body/sans-serif) via Google Fonts
- **Colors**: Custom `forge-*` palette (dark) with pastel overrides in light mode. Accent: `ember` (#f97316)
- **Grain overlay**: SVG noise texture on `body::before` at low opacity
- **Animations**: `fade-in-up`, `fade-in`, `scale-in` keyframes with staggered delays

## File Structure

```
src/
├── components/
│   ├── AddColumnButton.vue    # Inline column creation with color picker
│   ├── CardModal.vue          # Full card editor (title, desc, labels, project, images, metadata)
│   ├── EditBoardModal.vue     # Board name/emoji editor
│   ├── KanbanCard.vue         # Card display with cover image + project badge
│   ├── KanbanColumn.vue       # Column with color picker, inline card creation, drag-and-drop
│   ├── ProjectModal.vue       # Create/edit project
│   └── ThemeToggle.vue        # Dark/light toggle switch
├── stores/
│   ├── auth.js                # Firebase Auth
│   ├── board.js               # Boards/columns/cards CRUD + image upload/delete
│   ├── projects.js            # Projects CRUD
│   └── theme.js               # Theme persistence
├── views/
│   ├── Board.vue              # Kanban board with columns
│   ├── Dashboard.vue          # Projects section + boards grid + user menu
│   └── Login.vue              # Split-layout auth page
├── App.vue                    # Root: auth gating, store init/cleanup
├── firebase.js                # Firebase app init (db, storage, auth exports)
├── main.js                    # Router, Pinia, auth guard, app mount
└── style.css                  # Tailwind import, theme vars, light overrides, animations
```

## Scripts

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Common Patterns

- All Firestore mutations are optimistic (update local state first, then persist)
- `persistColumns()` helper writes the entire columns array + sets `updatedAt`
- Card updates auto-stamp `updatedAt` and `updatedBy` with current user info
- Color pickers use click-outside detection via `pointerdown` document listener
- Modals use `<Teleport to="body">` to avoid z-index issues
- Image uploads go to Firebase Storage at path `boards/{boardId}/{cardId}/{timestamp}_{filename}`

## Future Plans

- AI-powered task suggestions and auto-categorization
- Board sharing and team collaboration
- Due dates and calendar view
- Activity feed / changelog
- Keyboard shortcuts
- PWA support
- Integrations (GitHub, Slack, Linear)
