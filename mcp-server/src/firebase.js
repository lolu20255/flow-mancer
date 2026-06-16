import admin from 'firebase-admin'

let app = null

// Initialize the Firebase Admin SDK once. Credentials come from either:
//  - FIREBASE_SERVICE_ACCOUNT: the full service-account JSON as a string, or
//  - GOOGLE_APPLICATION_CREDENTIALS: a path to a service-account JSON file
//    (Application Default Credentials).
export function initFirebase() {
  if (app) return app

  const projectId = process.env.FIREBASE_PROJECT_ID || undefined
  let credential

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let parsed
    try {
      parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON')
    }
    credential = admin.credential.cert(parsed)
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault()
  } else {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT (JSON string) ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (path to a service-account file).'
    )
  }

  app = admin.initializeApp({ credential, projectId })
  return app
}

export function getDb() {
  initFirebase()
  return admin.firestore()
}

export const FieldValue = admin.firestore.FieldValue
