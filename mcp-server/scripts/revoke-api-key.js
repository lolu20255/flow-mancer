#!/usr/bin/env node
// Revoke a Flowmancer API key by its keyId.
//   node scripts/revoke-api-key.js --keyId <id>
import { getDb } from '../src/firebase.js'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i]
  }
  return out
}

async function main() {
  const { keyId } = parseArgs(process.argv.slice(2))
  if (!keyId) throw new Error('Provide --keyId')
  const db = getDb()
  const ref = db.collection('apiKeys').doc(keyId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`No API key with id ${keyId}`)
  await ref.update({ revoked: true })
  console.log(`Revoked API key ${keyId}`)
  process.exit(0)
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1) })
