#!/usr/bin/env node
// Deploy firestore.rules to the live project via the Firebase Rules REST API,
// authenticating with the Admin SDK service account (which has publish rights).
// Usage: node scripts/deploy-rules.js [path/to/firestore.rules]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'vibe-board-3b2cf'
const RULES_FILE = process.argv[2] || path.resolve(HERE, '../../firestore.rules')
const API = 'https://firebaserules.googleapis.com/v1'

async function main() {
  const source = fs.readFileSync(RULES_FILE, 'utf8')
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT,
  })
  const { access_token: token } = await admin.app().options.credential.getAccessToken()

  const ruleset = await post(`${API}/projects/${PROJECT}/rulesets`, token, {
    source: { files: [{ name: 'firestore.rules', content: source }] },
  })
  console.log(`Created ruleset: ${ruleset.name}`)

  const release = await patch(`${API}/projects/${PROJECT}/releases/cloud.firestore`, token, {
    release: {
      name: `projects/${PROJECT}/releases/cloud.firestore`,
      rulesetName: ruleset.name,
    },
  })
  console.log(`Released: ${release.name} -> ${release.rulesetName}`)
  process.exit(0)
}

async function post(url, token, body) {
  return request('POST', url, token, body)
}

async function patch(url, token, body) {
  return request('PATCH', url, token, body)
}

async function request(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`)
  return JSON.parse(text)
}

main().catch((err) => { console.error('Deploy failed:', err.message); process.exit(1) })
