# AudioScope — Audio Visual Analyzer

A polished, responsive, browser-based audio analysis interface with synchronized playback, spectrogram, and waveform.

## Features
- Load an audio file using the file picker or drag and drop.
- Native audio decoding and playback controls.
- Play/pause, ±5 second skip, seek bar, and volume control.
- Click the spectrogram or waveform to jump to that time in the audio.
- Spectrogram palette options and logarithmic/linear frequency scale.
- Responsive layout for desktop and mobile.
- Local processing: audio is not sent to a server.
- Keyboard shortcuts: Space to play/pause, Left/Right arrows to skip 5 seconds.

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser.
3. Choose an audio file.

For the most consistent browser behavior, you can also serve the folder with a local static server, e.g. from the folder run `python -m http.server 8000`, then visit `http://localhost:8000`.

## Files
- `index.html` — page structure and controls
- `style.css` — visual styling and responsive layout
- `script.js` — file loading, decoding, spectrogram/waveform drawing, synchronized seeking

## Notes
- Supported formats depend on the browser's built-in decoder.
- Long recordings and high-resolution spectrograms may take a short time to render.
- The spectrogram uses a 2048-sample FFT with a 512-sample hop and displays frequency energy over time.
