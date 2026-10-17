# AudioScope

AudioScope is a browser-based audio visualizer and analyzer with synchronized playback, spectrogram, waveform, folder playlist navigation, deletion controls, and audio-property estimates.

**Created by Sidharth Subrahmanya H.**

## Run locally

Use a local web server (for example, `python -m http.server 8000`) and open `http://localhost:8000`. Folder access and PWA installation require a secure context: HTTPS or localhost.

## Install as a web app

Deploy the complete folder to a static HTTPS host. Open it in Chrome or Edge and choose **Install app**. If the install prompt is not available, use the browser's menu and select **Install AudioScope** or **Install page as app**. The app manifest and service worker are included.

## Folder access and deletion

Use **Choose audio folder**. On browsers supporting the File System Access API, grant read/write permission to enable permanent deletion. The standard folder input fallback can load files and navigate the session playlist but cannot permanently delete files from disk.

## Audio properties

Peak frequency and SNR are estimates. SNR uses short-time RMS comparison and is not a calibrated noise measurement.
