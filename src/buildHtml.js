import { Buffer } from 'node:buffer';

/**
 * Build an HTML document string from the parsed mail.
 * Rewrites cid/data images to data URLs and inlines minimal CSS to let Chromium render faithfully.
 * @param {import('mailparser').ParsedMail} mail
 * @returns {{ html: string, inlineCids: Set<string> }}
 */
export function buildHtml(mail) {
  const inlineCids = new Set();
  const attachments = mail.attachments || [];

  // Map cid -> data URL for images
  const cidMap = new Map();
  for (const att of attachments) {
    if (att.contentId && att.contentType?.startsWith('image/')) {
      const dataUrl = bufferToDataUrl(att.content, att.contentType);
      const cleanCid = att.contentId.replace(/[<>]/g, '');
      cidMap.set(cleanCid, dataUrl);
      inlineCids.add(cleanCid);
    }
  }

  // Replace cid references
  let html = mail.html || mail.textAsHtml || mail.text || '';
  html = html.replace(/src=["']cid:([^"']+)["']/gi, (m, cid) => {
    const cleanCid = cid.replace(/[<>]/g, '');
    const dataUrl = cidMap.get(cleanCid);
    return dataUrl ? `src="${dataUrl}"` : m;
  });
  
  // Strip Microsoft Word @page rules and WordSection divs that cause page breaks
  html = html.replace(/@page\s+\w+\s*\{[^}]*\}/gi, '');
  html = html.replace(/div\.WordSection\d+\s*\{[^}]*\}/gi, '');
  html = html.replace(/<div\s+class=["']?WordSection\d+["']?/gi, '<div');

  // Basic header info (From, To, Subject, Date)
  const headerHtml = `
    <div class="email-header">
      <div class="hdr-meta">
        <div><strong>From:</strong> ${escapeHtml(mail.from?.text || 'Unknown')}</div>
        <div><strong>To:</strong> ${escapeHtml(mail.to?.text || 'Unknown')}</div>
        ${mail.subject ? `<div><strong>Subject:</strong> ${escapeHtml(mail.subject)}</div>` : ''}
        ${mail.date ? `<div><strong>Date:</strong> ${escapeHtml(formatDisplayDate(mail.date))}</div>` : ''}
      </div>
    </div>
  `;

  // Build attachment list (bullets), skipping inline image CIDs already rendered
  const attachmentItems = attachments
    .filter(att => att.filename)
    .filter(att => {
      if (!att.contentId) return true;
      const cleanCid = att.contentId.replace(/[<>]/g, '');
      return !inlineCids.has(cleanCid);
    })
    .map(att => `<li>${escapeHtml(att.filename || 'attachment')}</li>`);

  const attachmentsHtml = attachmentItems.length
    ? `<div class="attachments"><div class="hdr-attachments">Attachments</div><ul>${attachmentItems.join('')}</ul></div>`
    : '';

  // Basic wrapper HTML; keep user styles intact, add a small reset and scale down default margins.
  const doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0.5in; }
    /* Override Microsoft Word page sections */
    div[class*="WordSection"] { 
      page: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* Basic page-break prevention for blockquotes only */
    blockquote {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 100%;
    }
    body { 
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.4 !important;
    }
    p { 
      margin-top: 0 !important;
      margin-bottom: 4pt !important;
    }
    img { 
      max-width: 100% !important; 
      height: auto !important;
      max-height: 150px !important;
    }
    .email-header { 
      margin-bottom: 8pt !important;
      padding-bottom: 4pt !important;
      border-bottom: 1px solid #ccc;
    }
  </style>
</head>
<body>
${headerHtml}
${html}
${attachmentsHtml}
</body>
</html>`;

  return { html: doc, inlineCids };
}

function bufferToDataUrl(buf, mime) {
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function formatDisplayDate(date) {
  const d = new Date(date);
  return d.toString();
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
