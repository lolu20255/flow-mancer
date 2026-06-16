#!/usr/bin/env node
// Generate a Flowmancer API key for a user and store its hash in Firestore.
//
// Usage:
//   node scripts/create-api-key.js --uid <firebaseUid> [--name "My agent"] [--scopes read,write]
//   node scripts/create-api-key.js --email user@example.com [--name "My agent"] [--read-only]
//
// The plaintext key is printed ONCE. Only its SHA-256 hash is stored.
import crypto from 'node:crypto'
import { getDb, FieldValue } from '../src/firebase.js'
import { hashKey } from '../src/board-service.js'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--read-only') { out.scopes = 'read'; continue }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[++i] }
  }
  return out
}

async function resolveUid({ uid, email }) {
  if (uid) return uid
  if (!email) throw new Error('Provide --uid or --email')
  const db = getDb()
  const snap = await db.collection('users').where('email', '==', email.trim().toLowerCase()).limit(1).get()
  if (snap.empty) throw new Error(`No user found with email ${email}`)
  return snap.docs[0].data().uid || snap.docs[0].id
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const uid = await resolveUid(args)
  const scopes = (args.scopes || 'read,write').split(',').map(s => s.trim()).filter(Boolean)
  const name = args.name || 'AI agent'

  const rawKey = `fmk_live_${crypto.randomBytes(24).toString('hex')}`
  const db = getDb()
  const docRef = await db.collection('apiKeys').add({
    hash: hashKey(rawKey),
    uid,
    name,
    scopes,
    revoked: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  console.log('\nAPI key created. Copy it now, it will not be shown again:\n')
  console.log(`  ${rawKey}\n`)
  console.log(`  keyId:  ${docRef.id}`)
  console.log(`  uid:    ${uid}`)
  console.log(`  scopes: ${scopes.join(', ')}\n`)
  process.exit(0)
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1) })
