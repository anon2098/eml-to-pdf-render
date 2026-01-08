## eml-render-pdf

Render EML emails to PDF exactly as they appear by letting Chromium do the HTML/CSS layout, while keeping inline images and appending PDF attachments.

### Why this approach
- Uses the email’s original HTML/CSS: no regex stripping, minimal overrides.
- Inline CID/data images are rewritten to data URLs so Chromium can render them.
- PDF attachments are appended after the rendered email body (like the old tool).

### Requirements
- Node 18+

### Install
```bash
cd "eml to pdf-render"
npm install
```

### Usage
```bash
node src/convert.js /path/to/email.eml /path/to/output.pdf
```
- If `output.pdf` is omitted, it writes to `./output/<email-name>.pdf`.

### Notes
- Relies on Playwright’s headless Chromium to keep layout fidelity.
- Minimal CSS is injected only to reduce default margins and ensure images scale down; the email’s own styles stay in place.
- CID images in attachments are converted to data URLs and rendered inline.
- PDF attachments are merged after the body PDF; other attachment types are ignored.

