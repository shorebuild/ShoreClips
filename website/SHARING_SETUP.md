# ShoreClips public clip sharing setup

Public clip sharing uses Cloudflare Pages Functions and an R2 bucket. Uploads are opt-in: clips remain local until the user clicks **Share** in the desktop app.

## 1. Deploy the website from the `website` directory

The Pages project must use `website` as its build/output directory and deploy the `website/functions` folder as Pages Functions. If the Pages project currently points at the repository root, change its root/output directory to `website` before enabling this feature.

## 2. Create and bind an R2 bucket

1. In the Cloudflare dashboard, create an R2 bucket for ShoreClips shared videos.
2. Open the Pages project settings, then Functions / R2 bucket bindings.
3. Add a binding named exactly `CLIPS_BUCKET` pointing to the new bucket.
4. Redeploy the Pages project after adding the binding.

## 3. Configure upload authorization

1. Generate a strong random token using a password manager or secrets manager. Do not post it in public issues or chat.
2. In the Pages project's environment variables/secrets, add a **secret** named `SHARE_UPLOAD_TOKEN` with that token as its value.
3. Redeploy the Pages project.
4. In ShoreClips, open Settings → Public clip sharing. Set the website URL to `https://shoreclips.pages.dev` (or your actual Pages custom domain) and paste the same token into the token field, then save.

The desktop app sends the token only with an explicit clip upload. Do not share the token. Anyone with a shared clip URL can watch that clip, so only share clips you are comfortable making public to link-holders.

## 4. Test

- Upload a short MP4 using the **Share** action in the Clips page.
- The app should copy a unique URL such as `https://shoreclips.pages.dev/c/<id>`.
- Open that URL in a private browser window or on another device. The clip should load without signing in.
- Verify that scrubbing/seeking works. The API supports byte-range video playback.

## Limits and operating notes

- Maximum upload size is 150 MB per clip.
- The API only accepts MP4 files; older WebM/MOV clips need to be exported to MP4 first.
- Each upload creates a new public object in R2. Deleting the local clip does not delete the shared copy. R2 objects must be deleted from the bucket or a future deletion feature must be added.
- Set R2 lifecycle rules or quotas in Cloudflare if you need automatic cleanup and predictable storage costs.
- Do not expose the upload token. It is a shared upload credential, not an end-user identity system.
