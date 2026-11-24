#!/usr/bin/env node
// Generate `fork-config.json` — settings of THIS FORK that the packaged app reads
// at runtime, from build-time secrets (same reasoning as gen-oauth-config.mjs:
// there is no bundler, so an environment variable set in CI never reaches the
// user's machine unless it is written into a packed file).
//
//   reportWebhook — the Discord webhook the "Something wrong?" bubble posts to
//                   (renderer/fork-report). From FORK_DISCORD_WEBHOOK.
//
// The file is gitignored: a webhook URL lets anyone who reads it post in that
// channel, so it never goes into the public repository. It does ship inside the
// app, which is unavoidable for a client that posts without an account; if it is
// ever abused, delete the webhook in Discord and set a new secret.
//
// Without the variable the file is written empty and the bubble stays hidden:
// a missing webhook never fails a build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out  = path.join(root, 'fork-config.json');

let existing = {};
try { existing = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { /* first run */ }

const hook = (process.env.FORK_DISCORD_WEBHOOK || existing.reportWebhook || '').trim();
const valid = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(hook);
if (hook && !valid) console.warn('[fork-config] WARNING — FORK_DISCORD_WEBHOOK is not a Discord webhook URL; the report bubble stays hidden.');
if (!hook) console.warn('[fork-config] no FORK_DISCORD_WEBHOOK — the report bubble stays hidden in this build.');

fs.writeFileSync(out, JSON.stringify({ reportWebhook: valid ? hook : '' }, null, 2) + '\n');
console.log(`[fork-config] wrote ${path.relative(root, out)} — report webhook: ${valid ? 'set' : 'MISSING'}`);
