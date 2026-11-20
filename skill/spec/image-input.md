# `G.imageInput`: camera, uploaded photo or fallback image

A unified image source so downstream code (drawing, face detection) treats camera, user photo and default image identically: all resolve to one element, `handle.element`.

```js
const source = G.imageInput({
  mount: G.getElementById('stage'),   // required container
  allowCamera: true,                  // try the camera first
  allowUpload: true,                  // built-in upload button
  mirror: true,                       // CSS-flip the camera preview only
  defaultImageUrl: null,              // fallback URL/data URI; built-in placeholder if omitted
  showControls: true,
  controlsAutoHide: true,             // controls peek on start, fade when idle, return on pointer/touch
  controlsIdleMs: 4000,
  controlsPlacement: 'top-right',     // or 'bottom-right'
  onModeChange: (mode) => {},         // 'camera' | 'upload' | 'default'
  onStatus: (message) => {},          // string | null
  onReady: (el) => {},                // active element has usable pixels
});

source.element   // <video> (camera) or <img> (upload/default)
source.mode      // 'camera' | 'upload' | 'default'
source.width     // natural pixel size of the active element
source.height
source.mirrored  // true only in camera mode with mirror set
source.useCamera(); source.useUpload(file); source.useDefault();
source.revealControls();
source.destroy();                     // optional early teardown
```

- It tries the camera first; on denial or error it falls back to the default image immediately, so there is no dead end.
- Only one of the internal `<video>` / `<img>` is visible. Classes for restyling: `gii-video`, `gii-img`, `gii-status`, `gii-upload-btn`, `gii-camera-btn`, `gii-file-input`, `gii-controls`; `mount` carries `data-gii-mode`.
- Teardown (stopping camera tracks) is automatic on module unload. Do not add a UNINIT handler just for that.
- Never hand-roll `getUserMedia`, file upload or fallback logic.
- It knows nothing about faces. For detection, layer g-lib `loadFaceApi` / `tinyFaceOptions` on `source.element`: run **continuously** in `camera` mode, **once** in `upload` mode (static image), and **never** in `default` mode (use fixed anchors for your own fallback image).
- Modules using it need no `autoPlay` flag; `allowCamera` / `allowUpload` config keys tell the host the module owns its controls.
