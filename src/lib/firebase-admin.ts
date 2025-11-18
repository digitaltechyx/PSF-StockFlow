// Only import firebase-admin on the server side
let admin: typeof import('firebase-admin') | null = null;

// Lazy initialization to avoid build-time errors
let adminDbInstance: any = null;
let adminFieldValueInstance: any = null;

function getAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK can only be used on the server side');
  }
  
  if (!admin) {
    // Dynamic import to ensure it's only loaded on the server
    admin = require('firebase-admin');
  }
  
  return admin;
}

function initializeAdmin() {
  const adminModule = getAdmin();
  
  if (!adminModule.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase admin credentials are not set. Please configure FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.'
      );
    }

    adminModule.initializeApp({
      credential: adminModule.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  if (!adminDbInstance) {
    adminDbInstance = adminModule.firestore();
    adminFieldValueInstance = adminModule.firestore.FieldValue;
  }
}

export function getAdminDb() {
  if (!adminDbInstance) {
    initializeAdmin();
  }
  return adminDbInstance;
}

export function getAdminFieldValue() {
  if (!adminFieldValueInstance) {
    initializeAdmin();
  }
  return adminFieldValueInstance;
}

// Export getters for lazy initialization (only called when API routes run)
// Use getAdminDb() and getAdminFieldValue() in API routes instead of direct exports
export { getAdminDb as adminDb, getAdminFieldValue as adminFieldValue };

