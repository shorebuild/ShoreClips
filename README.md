# ShoreClips

ShoreClips is an Electron desktop instant-replay app and its official static website in one repository.

## Run locally (development only)
Requires Node.js LTS. Run `npm install`, then `npm start`. End-user downloads should be native installers from Releases/Actions, not this source project.

## Build a native installer without running commands locally
1. Open **Actions → Build ShoreClips installers → Run workflow**.
2. Download the `ShoreClips-macOS` artifact for `.dmg`/`.zip`, or the `ShoreClips-Windows` artifact for Windows.
3. Install and test it on the target machine.

The workflow creates artifacts; it does not sign or notarize macOS builds. macOS Gatekeeper may warn because no Apple Developer signing identity is configured.

## Official website
The `website/` folder is the Cloudflare Pages output directory. It is static; no framework build command is required. The current download is a developer preview source ZIP, not a signed installer. Upload a built installer to a stable release/download URL before advertising it as a final installer.

## Current scope / honest status
- Electron interface, source chooser, replay controls, persistent settings and local clip library.
- Replay capture is based on Chromium desktop capture and MediaRecorder; the pipeline still needs real-world testing for duration, encoding continuity and playback.
- Microphone recording can be requested when enabled. System/game audio capture is not provided by this build on macOS Monterey.
- Sign-in, cloud upload/sharing, timeline editing, auto-updates and notarized production builds are not implemented.
