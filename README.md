## Campus Connect

Campus Connect is a Next.js application for students to discover peers, collaborate on projects, and chat through public channels or direct messages. The platform now sports an upgraded profile experience plus real-time and browser-level notifications so conversations never get missed.

### Key Features

- **Rich student profiles** – Gradient cards with skill and interest pills, quick DM and email actions, and prominent social links help surface talent at a glance.
- **Instant contact flows** – Every contact modal includes a Direct Message shortcut that deep links into `/chat?dm=<uid>` for one-click outreach.
- **Browser DM notifications** – When you enable notifications, direct messages trigger native alerts on desktop and mobile browsers in addition to in-app toasts.
- **Channel and DM chat** – Universal, branch, year, and private threads share the same polished UI with reactions, stickers, replies, and moderation safeguards.
- **Role-aware directory** – Search and filter students by name, branch, or skill with pagination and lightweight loading states.

### Tech Stack

- Next.js App Router with TypeScript
- Mantine UI for layout primitives and modals
- React Toastify for global notifications
- Firebase Auth plus custom API routes backed by MongoDB/Mongoose

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. Environment variables for Firebase, MongoDB, and any third-party APIs should be placed in `.env.local`.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Next.js dev server with hot reload. |
| `npm run build` | Creates an optimized production build. |
| `npm start` | Serves the production build. |
| `npm run lint` | Runs ESLint across the project. |

## Browser Notifications for DMs

1. Open the chat sidebar and click the bell icon beside **Direct Messages**.
2. Allow notifications in the browser prompt.
3. When the page is hidden or another conversation is active, new DM messages trigger native alerts plus the existing toast notification.

## Deployment

The project deploys cleanly on Vercel. Run `npm run build` locally before pushing to confirm there are no type or lint errors.

## Contributing

1. Fork and clone the repository.
2. Create a feature branch from `main`.
3. Run `npm run lint` and `npm run build` before opening a pull request.
4. Describe UI changes with screenshots or screen recordings when possible.
