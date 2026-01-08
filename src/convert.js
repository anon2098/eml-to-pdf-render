#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import fse from 'fs-extra';
import { simpleParser } from 'mailparser';
import { chromium } from 'playwright';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { buildHtml } from './buildHtml.js';

console.log('convert.js loaded');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node src/convert.js <file.eml|directory> [output-directory]');
    process.exit(1);
  }
  console.log('Input:', inputPath);

  const outputOverride = process.argv[3];
  const stat = await fse.stat(inputPath);

  if (stat.isDirectory()) {
    // Batch mode - reuse browser for all conversions
    const emlFiles = await findEmlFiles(inputPath);
    console.log(`Found ${emlFiles.length} EML files`);
    const outputDir = outputOverride || path.join(inputPath, 'output');
    await fse.ensureDir(outputDir);

    // Launch browser once for batch, restart every 50 emails to prevent accumulation
    console.log('Launching browser...');
    let browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath()
    });

    try {
      for (let i = 0; i < emlFiles.length; i++) {
        const emlFile = emlFiles[i];
        
        // Restart browser every 50 emails to prevent memory accumulation
        if (i > 0 && i % 50 === 0) {
          console.log('Restarting browser to free memory...');
          await browser.close();
          browser = await chromium.launch({
            headless: true,
            executablePath: chromium.executablePath()
          });
        }
        
        try {
          await convertSingle(emlFile, outputDir, browser);
          console.log(`✓ ${path.basename(emlFile)}`);
        } catch (err) {
          console.error(`✗ Failed: ${path.basename(emlFile)}`, err.message);
        }
      }
    } finally {
      await browser.close();
      console.log('Browser closed');
    }
  } else {
    // Single file mode - launch browser for single conversion
    const mail = await parseEml(inputPath);
    const outputPath = resolveOutputPath(inputPath, mail, outputOverride);
    const browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath()
    });
    try {
      await convertSingle(inputPath, outputPath, browser);
    } finally {
      await browser.close();
    }
  }
}

async function convertSingle(emlPath, outputPathOrDir, browser) {
  const mail = await parseEml(emlPath);
  const outputPath = typeof outputPathOrDir === 'string' && outputPathOrDir.endsWith('.pdf')
    ? outputPathOrDir
    : resolveOutputPath(emlPath, mail, outputPathOrDir);

  console.log(`Converting ${emlPath} -> ${outputPath}`);
  await fse.ensureDir(path.dirname(outputPath));

  const { html, inlineCids } = buildHtml(mail);

  // Render HTML with headless Chromium to preserve email CSS/layout
  const bodyPdf = await renderHtmlToPdf(html, browser);

  // Merge PDF attachments after body
  const mergedPdf = await appendPdfAttachments(bodyPdf, mail.attachments || []);

  fs.writeFileSync(outputPath, mergedPdf);
  console.log(`Saved PDF to ${outputPath}`);
}

async function renderHtmlToPdf(html, browser) {
  // Reuse browser instance, create new page for each conversion
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    return pdf;
  } finally {
    await page.close(); // Always close page to free memory
  }
}

async function appendPdfAttachments(bodyPdfBytes, attachments) {
  const bodyDoc = await PDFLibDocument.load(bodyPdfBytes);
  let modified = false;

  for (const att of attachments) {
    if (att.contentType === 'application/pdf' && att.content) {
      try {
        const attDoc = await PDFLibDocument.load(att.content);
        const pages = await bodyDoc.copyPages(attDoc, attDoc.getPageIndices());
        pages.forEach(p => bodyDoc.addPage(p));
        modified = true;
      } catch (err) {
        console.error('Failed to merge PDF attachment', att.filename || '', err);
      }
    }
  }

  return modified ? await bodyDoc.save() : bodyPdfBytes;
}

function resolveOutputPath(emlPath, mail, outputOverrideOrDir) {
  const stats = outputOverrideOrDir ? null : null; // placeholder to keep logic simple
  const hasOverride = Boolean(outputOverrideOrDir);
  // If override looks like a directory, use it; otherwise treat as explicit path
  if (hasOverride) {
    const overrideStat = fse.existsSync(outputOverrideOrDir) ? fse.statSync(outputOverrideOrDir) : null;
    if (overrideStat && overrideStat.isDirectory()) {
      return defaultOutputPath(emlPath, mail, outputOverrideOrDir);
    }
    // If no extension provided, still treat as directory
    if (!path.extname(outputOverrideOrDir)) {
      return defaultOutputPath(emlPath, mail, outputOverrideOrDir);
    }
    return outputOverrideOrDir;
  }
  return defaultOutputPath(emlPath, mail, null);
}

function defaultOutputPath(emlPath, mail, outputDir) {
  const dir = outputDir || path.join(path.dirname(emlPath), 'output');
  const ts = formatBrisbaneStamp(mail.date);
  const { sender, receiver } = extractParties(mail);
  return path.join(dir, `${ts}_${sender}_to_${receiver}.pdf`);
}

function formatBrisbaneStamp(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const yyyy = parts.year || '0000';
  const mm = parts.month || '00';
  const dd = parts.day || '00';
  const hh = parts.hour || '00';
  const min = parts.minute || '00';
  return `${yyyy}_${mm}_${dd}_${hh}_${min}`;
}

function extractParties(mail) {
  const sender = mail?.from?.value?.[0];
  const receiver = mail?.to?.value?.[0];
  const senderName = sender?.name || (sender?.address ? sender.address.split('@')[0] : 'unknown_sender');
  const receiverName = receiver?.name || (receiver?.address ? receiver.address.split('@')[0] : 'unknown_receiver');
  return {
    sender: sanitize(senderName),
    receiver: sanitize(receiverName)
  };
}

function sanitize(str = '') {
  return String(str).trim().replace(/[^a-z0-9._-]/gi, '_') || 'unknown';
}

async function findEmlFiles(root) {
  const results = [];
  const entries = await fse.readdir(root);
  for (const entry of entries) {
    const full = path.join(root, entry);
    const st = await fse.stat(full);
    if (st.isDirectory()) {
      const nested = await findEmlFiles(full);
      results.push(...nested);
    } else if (path.extname(entry).toLowerCase() === '.eml') {
      results.push(full);
    }
  }
  return results;
}

async function parseEml(emlPath) {
  const content = await fse.readFile(emlPath);
  return simpleParser(content);
}

// Always run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
