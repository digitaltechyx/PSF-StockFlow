import type { UserProfile, UserRole, UserFeature } from "@/types";

/**
 * Get default features for a role when user is first created
 */
export function getDefaultFeaturesForRole(role: UserRole): UserFeature[] {
  if (role === "user") {
    // Clients get all features by default
    return [
      "buy_labels",
      "upload_labels",
      "track_shipment",
      "view_invoices",
      "restock_summary",
      "delete_logs",
      "modification_logs",
      "disposed_inventory",
    ];
  } else if (role === "commission_agent") {
    // Commission agents get affiliate dashboard by default
    return ["affiliate_dashboard"];
  } else if (role === "sub_admin") {
    // Sub admins get no features by default - admin must explicitly grant them
    return [];
  }
  // Admin has all features (handled in hasFeature function)
  return [];
}

/**
 * Get all roles for a user (supports both legacy single role and new multiple roles)
 */
export function getUserRoles(userProfile: UserProfile | null | undefined): UserRole[] {
  if (!userProfile) return [];
  
  // If roles array exists, use it
  if (userProfile.roles && Array.isArray(userProfile.roles)) {
    return userProfile.roles;
  }
  
  // Fallback to legacy single role
  if (userProfile.role) {
    return [userProfile.role];
  }
  
  return [];
}

/**
 * Check if user has a specific role
 */
export function hasRole(userProfile: UserProfile | null | undefined, role: UserRole): boolean {
  const roles = getUserRoles(userProfile);
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userProfile: UserProfile | null | undefined, ...roles: UserRole[]): boolean {
  const userRoles = getUserRoles(userProfile);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userProfile: UserProfile | null | undefined, ...roles: UserRole[]): boolean {
  const userRoles = getUserRoles(userProfile);
  return roles.every(role => userRoles.includes(role));
}

/**
 * Check if user has a specific feature
 */
export function hasFeature(userProfile: UserProfile | null | undefined, feature: UserFeature): boolean {
  if (!userProfile) return false;
  
  // Admin always has all features
  if (hasRole(userProfile, "admin")) {
    return true;
  }
  
  // Sub admins must have features explicitly granted (no automatic access)
  // Check if feature is granted
  if (userProfile.features && Array.isArray(userProfile.features)) {
    return userProfile.features.includes(feature);
  }
  
  return false;
}

/**
 * Check if user has any of the specified features
 */
export function hasAnyFeature(userProfile: UserProfile | null | undefined, ...features: UserFeature[]): boolean {
  if (!userProfile) return false;
  
  // Admin always has all features
  if (hasRole(userProfile, "admin")) {
    return true;
  }
  
  // Sub admins must have features explicitly granted (no automatic access)
  if (userProfile.features && Array.isArray(userProfile.features)) {
    return features.some(feature => userProfile.features!.includes(feature));
  }
  
  return false;
}

/**
 * Get primary role for display purposes (first role in array, or legacy role)
 */
export function getPrimaryRole(userProfile: UserProfile | null | undefined): UserRole | null {
  const roles = getUserRoles(userProfile);
  return roles.length > 0 ? roles[0] : null;
}


