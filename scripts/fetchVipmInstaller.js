#!/usr/bin/env node
'use strict';

/**
 * Downloads the JKI VIPM Windows installer into the docker/windows build context
 * so the Windows image can COPY it instead of fetching it inside the container
 * (Windows build containers frequently cannot resolve DNS).
 *
 * Skips the download when a non-trivial installer is already present. Override
 * the source with the VIPM_SETUP_URL environment variable.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const DEFAULT_URL = 'https://packages.jki.net/vipm/preview/vipm-setup-latest-preview.exe';
const MIN_BYTES = 1_000_000; // A real installer is tens of MB; guard against stubs.

const url = process.env.VIPM_SETUP_URL || DEFAULT_URL;
const target = path.join(__dirname, '..', 'docker', 'windows', 'vipm-setup.exe');

function download(fromUrl, toFile, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(fromUrl, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const next = new URL(response.headers.location, fromUrl).toString();
        resolve(download(next, toFile, redirectsLeft - 1));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`Unexpected status ${status} for ${fromUrl}`));
        return;
      }
      const tempFile = `${toFile}.download`;
      const out = fs.createWriteStream(tempFile);
      response.pipe(out);
      out.on('finish', () => out.close(() => {
        fs.renameSync(tempFile, toFile);
        resolve();
      }));
      out.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function main() {
  if (fs.existsSync(target) && fs.statSync(target).size >= MIN_BYTES) {
    console.log(`VIPM installer already present: ${target}`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  console.log(`Downloading VIPM installer from ${url}`);
  await download(url, target);
  console.log(`Saved VIPM installer (${fs.statSync(target).size} bytes) to ${target}`);
}

main().catch((error) => {
  console.error(`Failed to download VIPM installer: ${error.message}`);
  process.exit(1);
});
