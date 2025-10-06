// Migration script to add status field to existing users
// Run this in Firebase Console or as a Cloud Function

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './src/lib/firebase';

export async function migrateUserStatus() {
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const updatePromises = [];
    
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      
      // Only update users that don't have a status field
      if (!userData.status) {
        const userRef = doc(db, 'users', userDoc.id);
        updatePromises.push(
          updateDoc(userRef, {
            status: 'approved', // Set existing users as approved
            createdAt: userData.createdAt || new Date(),
          })
        );
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`Updated ${updatePromises.length} users with status field`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Uncomment to run migration
// migrateUserStatus();

