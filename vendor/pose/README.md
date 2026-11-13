# vendor/pose

The pose model and library for the camera rep counter on the Finisher (js/camera.js).
Not in the service worker's install list: the app fetches these four files into the
`crease-pose-v1` cache only when Dad turns "Count reps with the camera" on.

Library: MediaPipe Tasks Vision, `@mediapipe/tasks-vision` **0.10.35** (Apache-2.0), pinned.
Model: Pose Landmarker lite, float16, version 1 (Apache-2.0).

Why 0.10.35 and not 1.x: from 1.0 the library sends usage metrics to Google
(`odml.pa.googleapis.com/v1/log`, every 60 s and on close; see the "Privacy Notice" in the
package README). Crease makes no network calls, so the last version without it is used.
tests.mjs checks the bundle has no such endpoint.

| File | Bytes | sha256 |
|---|---:|---|
| vision_bundle.mjs | 136993 | 55d7ab624fbb70dcc5adc4ae6d7ea9cfcb569139d3dbfbf2b1deafcb966bc0fe |
| vision_wasm_internal.js | 322044 | e7fd9858e8e8f221d9b96eddc11f8e077f263e0b7bbd79d3cbe882b134274f8c |
| vision_wasm_internal.wasm | 11153617 | 6a5c64584c2ab61c763b6e204afbdbc7ce1caf7f5216187322bca8df94f646bc |
| pose_landmarker_lite.task | 5777746 | 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a |

Total 17390400 bytes (about 17.4 MB).

## Sources

- npm tarball: https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.35.tgz
  sha1 `ae1ff52d68550e0a4dd971ac6f67ef9aad7f946f`, matching the registry's `dist.shasum` for 0.10.35.
  Files copied unchanged from `package/vision_bundle.mjs` and `package/wasm/`.
  The SIMD build only: every iPhone that runs Crease supports WebAssembly SIMD. On a device
  without it the library asks for `vision_wasm_nosimd_internal.*`, which isn't here, so the
  camera turns itself off and Done works as before.
- Model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
  (identical to `.../float16/latest/...`; md5 matches the bucket's `x-goog-hash`).

Downloaded 13 November 2026.
