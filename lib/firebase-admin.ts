import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let db: Firestore | null = null

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}

export function getDb(): Firestore {
  if (db) return db
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        // Vercel stores newlines as \n literals in env vars
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    })
  }
  db = getFirestore()
  return db
}
