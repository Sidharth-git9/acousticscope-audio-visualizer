# AcousticScope

AcousticScope is a browser-based audio visualizer and analyzer with synchronized playback, spectrogram, waveform, folder playlist navigation, deletion controls, and audio-property estimates.

**Design and Develeopment by Sidharth Subrahmanya H and Shanmukharaja M.**

## Run locally

Use a local web server (for example, `python -m http.server 8000`) and open `http://localhost:8000`. Folder access and PWA installation require a secure context: HTTPS or localhost.

## Install as a web app

Deploy the complete folder to a static HTTPS host. Open it in Chrome or Edge and choose **Install app**. If the install prompt is not available, use the browser's menu and select **Install AcousticScope** or **Install page as app**. The app manifest and service worker are included.

## Folder access and deletion

Use **Choose audio folder**. On browsers supporting the File System Access API, grant read/write permission to enable permanent deletion. The standard folder input fallback can load files and navigate the session playlist but cannot permanently delete files from disk.

## Audio properties

Peak frequency and SNR are estimates. SNR uses short-time RMS comparison and is not a calibrated noise measurement.

## Spectrogram controls

FFT size, hop (in samples), window function (Hann, Hamming, Blackman, Blackman-Harris, Triangular, Rectangular), dB floor and dB ceiling are adjustable. Levels are shown in dBFS (a full-scale sine reads 0 dB). A frequency axis (log or linear) with grid lines is drawn at the left, and hovering shows the time, frequency and level under the cursor. Changing the dB range, palette or scale only re-colours the cached result; changing FFT size, hop or window recomputes it. For very long files at most 2400 evenly spaced frames are computed (the effective hop is shown next to the controls).

## License
The LICENSE file is the standard Apache 2.0 text, unmodified. Put it in the root of your GitHub repository with no file extension.

The copyright notice belongs in the files rather than in the LICENSE text. Apache’s own guidance is to leave the license text as it is and attach the short notice to each source file. For script.js, add this as the first comment, above your existing header line:


 * Copyright 2026 Sidharth Subrahmanya H, Shanmukharaja M, Veena Mayya, Gururaja K V
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

## Credits

Design and Developement by Sidharth Subrahmanya H and Shanmukharaja M.
