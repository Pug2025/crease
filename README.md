# Crease

Off-ice training for young hockey goalies, as a web app you add to an iPhone's Home Screen.
A voice and a full-screen timer run each session, so the phone can stay on the floor.
It works offline and keeps all progress on the phone.

- `data/exercises.js`: every drill (words, cues, versions, how much). Edit freely.
- `data/sessions.js`: which drills make up each session.
- `data/copy.js`: every fixed line the app shows or says.
- `data/demos.js`: demo video links for the drill cards.

Run `node tests.mjs` after editing. `./deploy.sh "message"` records new voice lines, runs the tests and publishes.

Drawings are made with an image model from one style reference. Voice lines are recorded with OpenAI's speech API (`tools/make-voice.mjs`, the key passed in for the run only) and levelled to about -16 LUFS (`tools/loudness.mjs`).
