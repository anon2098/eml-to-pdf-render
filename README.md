# EML to PDF Render

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm version](https://img.shields.io/npm/v/eml-to-pdf-render.svg)](https://www.npmjs.com/package/eml-to-pdf-render)

Convert EML email files to PDF with pixel-perfect rendering using headless Chromium. Preserves the original email layout, inline images, and appends PDF attachments.

## ✨ Features

- **Accurate Rendering** - Uses Playwright's headless Chromium to render emails exactly as they appear
- **Inline Images** - CID-referenced images are converted to data URLs and rendered inline
- **PDF Attachments** - PDF attachments are automatically appended after the email body
- **Batch Processing** - Process entire directories of EML files efficiently
- **Smart Naming** - Output files are named with timestamp, sender, and recipient info
- **Timezone Support** - Timestamps use Australia/Brisbane timezone by default

## 📋 Requirements

- Node.js 18 or higher
- npm

## 🚀 Installation

### Option 1: Install globally from npm

```bash
npm install -g @anon2098/eml-to-pdf-render
```

### Option 2: Install globally from GitHub

```bash
npm install -g github:anon2098/eml-to-pdf-render
```

### Option 3: Clone and install locally

```bash
git clone https://github.com/anon2098/eml-to-pdf-render.git
cd eml-to-pdf-render
npm install
npm link  # Makes 'eml-to-pdf' command available globally
```

After installation, Playwright will automatically download a compatible Chromium browser.

## 📖 Usage

### Command Line (after global install)

```bash
# Convert single file
eml-to-pdf /path/to/email.eml

# Convert to specific output
eml-to-pdf /path/to/email.eml /path/to/output.pdf

# Batch convert directory
eml-to-pdf /path/to/emails/

# Batch convert to specific output directory
eml-to-pdf /path/to/emails/ /path/to/output/
```

### Using Node directly

```bash
node src/convert.js /path/to/email.eml
```

### Output Naming

When no output path is specified, files are saved to an `output/` directory with the format:
```
YYYY_MM_DD_HH_MM_SenderName_to_ReceiverName.pdf
```

## 🔧 How It Works

1. **Parse EML** - Uses `mailparser` to extract email content, headers, and attachments
2. **Build HTML** - Constructs a complete HTML document with email headers and body
3. **Inline Images** - Converts CID-referenced images to base64 data URLs
4. **Render PDF** - Uses Playwright/Chromium to render the HTML to PDF
5. **Merge Attachments** - Appends any PDF attachments using `pdf-lib`

## 📦 Dependencies

- [playwright](https://playwright.dev/) - Headless browser automation
- [mailparser](https://nodemailer.com/extras/mailparser/) - Email parsing
- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation
- [fs-extra](https://github.com/jprichardson/node-fs-extra) - Enhanced file system methods

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
