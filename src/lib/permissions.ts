import type { UserProfile, UserRole, UserFeature } from "@/types";

/**
 * Full list of client features (for legacy backward compat and reference).
 */
const CLIENT_FEATURE_LIST: UserFeature[] = [
  "view_dashboard", "view_inventory", "shipped_orders", "create_shipment",
  "buy_labels", "upload_labels", "request_product_returns", "track_shipment",
  "view_invoices", "my_pricing", "restock_summary", "modification_logs",
  "delete_logs", "disposed_inventory", "client_documents", "integrations",
];

/**
 * Default features for newly created client users (restricted set).
 * Admin can grant more via Roles & Permissions.
 */
const DEFAULT_CLIENT_FEATURES_FOR_NEW_USERS: UserFeature[] = [
  "view_inventory",      // Add Inventory
  "create_shipment",    // Create Shipment
  "shipped_orders",     // Shipped Orders
  "my_pricing",         // Pricing
  "view_invoices",     // Invoices
  "restock_summary",   // Restock Summary
  "modification_logs", // Modification Logs
  "delete_logs",       // Deleted Logs access
];

export function getDefaultFeaturesForRole(role: UserRole): UserFeature[] {
  if (role === "user") {
    return [...DEFAULT_CLIENT_FEATURES_FOR_NEW_USERS];
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
  
  const normalizeRole = (r: any): UserRole | null => {
    const s = String(r || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (s === "admin") return "admin";
    if (s === "sub_admin" || s === "subadmin") return "sub_admin";
    if (s === "commission_agent" || s === "commissionagent") return "commission_agent";
    if (s === "user") return "user";
    return null;
  };

  // If roles array exists, use it
  if (userProfile.roles && Array.isArray(userProfile.roles)) {
    return userProfile.roles.map(normalizeRole).filter(Boolean) as UserRole[];
  }
  
  // Fallback to legacy single role
  if (userProfile.role) {
    const n = normalizeRole(userProfile.role);
    return n ? [n] : [];
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
 * Check if user has a specific feature.
 * For clients (role "user") with a non-empty features array, ONLY those features are granted.
 */
export function hasFeature(userProfile: UserProfile | null | undefined, feature: UserFeature): boolean {
  if (!userProfile) return false;

  // Admin always has all features
  if (hasRole(userProfile, "admin")) {
    return true;
  }

  const features = userProfile.features;
  const hasExplicitFeatures = Array.isArray(features) && features.length > 0;

  // Client (role "user"): strict — only grant what is in their features array or the default 8 if no array
  if (hasRole(userProfile, "user")) {
    if (hasExplicitFeatures) {
      return features.includes(feature);
    }
    return DEFAULT_CLIENT_FEATURES_FOR_NEW_USERS.includes(feature);
  }

  // admin_dashboard is only for admin/sub_admin; don't grant to others unless in their list
  if (feature === "admin_dashboard") {
    return hasExplicitFeatures && features.includes("admin_dashboard");
  }

  // Sub admins and others: only if explicitly in features array
  if (hasExplicitFeatures) {
    return features.includes(feature);
  }

  return false;
}

/**
 * Check if user has any of the specified features
 */
export function hasAnyFeature(userProfile: UserProfile | null | undefined, ...requestedFeatures: UserFeature[]): boolean {
  if (!userProfile) return false;

  if (hasRole(userProfile, "admin")) return true;

  const userFeatures = userProfile.features;
  const hasExplicitFeatures = Array.isArray(userFeatures) && userFeatures.length > 0;

  if (hasRole(userProfile, "user")) {
    if (hasExplicitFeatures) {
      return requestedFeatures.some((f) => userFeatures.includes(f));
    }
    return requestedFeatures.some((f) => DEFAULT_CLIENT_FEATURES_FOR_NEW_USERS.includes(f));
  }

  if (hasExplicitFeatures) {
    return requestedFeatures.some((f) => userFeatures.includes(f));
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

