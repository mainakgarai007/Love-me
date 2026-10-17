# Love-me ❤️

A mobile-first love-question page with unique share links, optional recipient details, a creator-only dashboard, and per-event history.

## Firebase setup (required for real share links)

1. Open Firebase Console and select your existing project.
2. Add a **Web app** if you haven't already. Copy its web configuration into `firebase-config.js` (replace each `YOUR_...` placeholder).
3. In **Authentication → Sign-in method**, enable **Google**.
4. In **Authentication → Settings → Authorized domains**, add your GitHub Pages host: `mainakgarai007.github.io`.
5. In **Firestore Database → Rules**, publish the contents of `firestore.rules`.
6. Deploy the repo to GitHub Pages and open the site. Sign in with Google before creating a link.

## What the dashboard counts

- **Unique visitors**: distinct random browser IDs seen on this link (best effort, not a real-world identity).
- **Yes responses**: each recorded Yes tap.
- **No attempts**: detected attempts to touch, click, or approach the dodging No button. Pointer events can count more than once, and a button that dodges may make some attempts impossible to observe perfectly.
- **Repeat attempts**: activity from a browser ID that was already saved locally for this link.
- **Visitor history**: a chronological event list. Names/contact appear only if the recipient chooses to submit them.

## Privacy notes

- A public share link is public to anyone who has it; the campaign creator's history is readable only by the creator's signed-in Firebase account under the supplied rules.
- Recipient name and contact are optional. The page explains that the creator can see submitted details.
- Browser IDs are random and stored locally. Clearing browser storage, private browsing, or changing browsers/devices can make the same person look like a new visitor. This does not identify a physical phone.
- Do not collect or infer private profile details. This app does not scrape social accounts or silently collect phone numbers/location.
- This is a lightweight first version, not an abuse-proof voting system. A public link can be opened or submitted from different browsers, and client-side counters can be manipulated.

## Music and existing media

The page preserves `Reply me love.mp4`, `Love me.mp4`, and the existing `bg-music-h-not-l.mp3`. To use a different song after Yes, add a properly licensed audio file and update the audio source in `index.html`.
