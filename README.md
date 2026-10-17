# Love-me ❤️

Mobile-first love-question page with anonymous temporary Firebase accounts, creator-selected questions, shareable links, a creator dashboard, optional recipient details, and local browser caching.

## Firebase setup (shared All-in project)

1. In Firebase Console → Authentication → Sign-in method, enable **Anonymous** sign-in. No visible login screen is used.
2. In Authentication → Settings → Authorized domains, ensure `mainakgarai007.github.io` is listed.
3. Publish the combined rules in `firestore.rules` to Firebase Console → Firestore Database → Rules. Do not replace these with rules for only one app if other apps use the same project.
4. **Enable automatic deletion after seven days:** in Firestore → TTL policies, create a TTL policy for collection group `campaigns` using field `expiresAt`; create another TTL policy for collection group `events` using field `expiresAt`. This is a Firebase Console setting and is not activated merely by publishing this repository. TTL deletion is asynchronous, so rules also block expired links immediately.
5. Keep GitHub Pages enabled and this repository public if you want people to open shared links.
6. Test by creating a link, opening it on another browser/device, answering, and checking the dashboard.

## How it works

- Creator enters their own name, the special person's name, and chooses exactly one question: `Do You Like Me?` or `Do You Love Me?`.
- Firebase Anonymous Authentication creates a temporary account in the background; no login form is shown. Keep the same browser data to retain access to the creator dashboard.
- A local browser copy of campaign metadata and response events is cached in localStorage. Clearing browser/app data can remove this local copy.
- Campaign links are blocked by Firestore rules after seven days. Actual cloud document removal requires the two TTL policies above; each event has its own expiry field so events are removed too.
- The first-page track is `bg-music-h-not-l.mp3`. After Yes, that track stops and the existing `Love me.mp4` plays with its audio enabled. If that video has no audio track, add a separate love-music audio file and wire it in the page.
- The No button moves away playfully; the recipient should still be able to leave the page or decline.

## Data paths

- Love-me: `campaigns/{campaignId}` and `campaigns/{campaignId}/events/{eventId}`
- Shared starter: `users/{uid}/apps/{appId}/data/{docId}`

## Privacy notes

- Anyone who receives the share URL can open the recipient page.
- The optional name/contact are visible to the link creator if submitted; don't enter sensitive information.
- Local browser storage is not a secure vault and is removed if browser data is cleared.
- Firebase Spark quotas apply. Never put service-account keys or Admin SDK credentials in client-side code.
