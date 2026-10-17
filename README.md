# Love-me ❤️

Mobile-first love-question page with shareable links, optional recipient details, a creator dashboard, and visitor history.

## Shared Firebase setup

This repository is configured to use the existing **All-in** Firebase project (`all-in-a5f3b`) and web app `common-backend`.

1. In `firebase-config.js`, replace `YOUR_FIREBASE_API_KEY` with the Web API key from Firebase Console → Project settings → General → Your apps → common-backend.
2. Firebase Console → Authentication → Sign-in method: enable **Google**.
3. Authentication → Settings → Authorized domains: ensure `mainakgarai007.github.io` is listed.
4. Review `firestore.rules`. It merges the shared starter's user-data rules with Love-me campaign/event rules. Publish these combined rules in Firebase Console → Firestore Database → Rules. Do not replace them with only one app's rules, or the other app may stop working.
5. GitHub Pages must be enabled for the public Love-me share page to work. The repository is currently public; do not make it private if you want public links to work.
6. Test creator sign-in, create a link, then open the generated link in a separate browser/private window and check the response/dashboard.

## Data paths
- Love-me: `campaigns/{campaignId}` and `campaigns/{campaignId}/events/{eventId}`
- Shared starter: `users/{uid}/apps/{appId}/data/{docId}`

The `appId` separates paths for organization, not as a security boundary between client apps using the same Firebase project. Use separate Firebase projects or server-mediated authorization if stronger app-to-app isolation is needed.

## Privacy and safety
- The share URL is public to anyone who has it.
- The creator dashboard requires Google sign-in and rules limit campaign history to the campaign owner.
- Recipient name and contact are optional; only submit details the recipient is comfortable sharing.
- Never put service-account keys or Admin SDK credentials in client-side code.
- Firebase Spark quotas apply.
