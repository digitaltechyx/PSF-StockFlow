import admin from 'firebase-admin';

// Lazy initialization to avoid build-time errors
let adminDbInstance: admin.firestore.Firestore | null = null;
let adminFieldValueInstance: typeof admin.firestore.FieldValue | null = null;

function initializeAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase admin credentials are not set. Please configure FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  if (!adminDbInstance) {
    adminDbInstance = admin.firestore();
    adminFieldValueInstance = admin.firestore.FieldValue;
  }
}

export function getAdminDb(): admin.firestore.Firestore {
  if (!adminDbInstance) {
    initializeAdmin();
  }
  return adminDbInstance!;
}

export function getAdminFieldValue(): typeof admin.firestore.FieldValue {
  if (!adminFieldValueInstance) {
    initializeAdmin();
  }
  return adminFieldValueInstance!;
}

// Export getters for lazy initialization (only called when API routes run)
// Use getAdminDb() and getAdminFieldValue() in API routes instead of direct exports
export { getAdminDb as adminDb, getAdminFieldValue as adminFieldValue };

