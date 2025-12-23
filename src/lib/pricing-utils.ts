import type { UserPricing, ServiceType, ProductType, PackageType, QuantityRange } from "@/types";

/**
 * Determine which package type should be used based on service and quantity
 */
function getPackageForQuantity(service: ServiceType, quantity: number): PackageType | null {
  if (service === "FBA/WFS/TFS") {
    if (quantity >= 1001) return "Premium";
    if (quantity >= 501 && quantity <= 1000) return "Small Business";
    if (quantity >= 50 && quantity <= 500) return "Standard";
    if (quantity < 50) return "Starter";
  } else if (service === "FBM") {
    if (quantity >= 101) return "Premium";
    if (quantity >= 50 && quantity < 101) return "Small Business";
    if (quantity >= 25 && quantity < 50) return "Standard";
    if (quantity < 25) return "Starter";
  }
  return null;
}

/**
 * Calculate prep unit price based on pricing rules, service, product type, and quantity
 * @param pricingRules - Array of user pricing rules
 * @param service - Service type (FBA/WFS/TFS or FBM)
 * @param productType - Product type (Standard, Large, Custom)
 * @param totalUnits - Total number of units
 * @returns Object with rate and packOf, or null if no matching pricing found
 */
export function calculatePrepUnitPrice(
  pricingRules: UserPricing[],
  service: ServiceType,
  productType: ProductType,
  totalUnits: number
): { rate: number; packOf: number } | null {
  if (!pricingRules || pricingRules.length === 0) {
    return null;
  }

  // Determine which package should be used based on quantity
  const expectedPackage = getPackageForQuantity(service, totalUnits);
  
  // Find matching pricing rules - filter by service, productType, quantityRange, and package
  const matchingRules = pricingRules.filter(
    (rule) => {
      const matchesService = rule.service === service;
      const matchesProductType = rule.productType === productType;
      const matchesQuantityRange = isQuantityInRange(totalUnits, rule.quantityRange);
      const matchesPackage = expectedPackage ? rule.package === expectedPackage : true;
      
      return matchesService && matchesProductType && matchesQuantityRange && matchesPackage;
    }
  );

  if (matchingRules.length === 0) {
    // Fallback: try without package filter in case of data inconsistency
    const fallbackRules = pricingRules.filter(
      (rule) =>
        rule.service === service &&
        rule.productType === productType &&
        isQuantityInRange(totalUnits, rule.quantityRange)
    );
    
    if (fallbackRules.length === 0) {
      return null;
    }
    
    // Sort by updatedAt to get the most recent pricing
    const sortedRules = fallbackRules.sort((a, b) => {
      const aUpdated = typeof a.updatedAt === 'string' 
        ? new Date(a.updatedAt).getTime() 
        : (a.updatedAt as any)?.seconds 
          ? (a.updatedAt as any).seconds * 1000 
          : 0;
      const bUpdated = typeof b.updatedAt === 'string' 
        ? new Date(b.updatedAt).getTime() 
        : (b.updatedAt as any)?.seconds 
          ? (b.updatedAt as any).seconds * 1000 
          : 0;
      return bUpdated - aUpdated;
    });
    
    const latestRule = sortedRules[0];
    if (!latestRule) {
      return null;
    }
    
    return {
      rate: latestRule.rate || 0,
      packOf: latestRule.packOf || 0,
    };
  }

  // Sort by updatedAt to get the most recent pricing
  const sortedRules = matchingRules.sort((a, b) => {
    const aUpdated = typeof a.updatedAt === 'string' 
      ? new Date(a.updatedAt).getTime() 
      : (a.updatedAt as any)?.seconds 
        ? (a.updatedAt as any).seconds * 1000 
        : 0;
    const bUpdated = typeof b.updatedAt === 'string' 
      ? new Date(b.updatedAt).getTime() 
      : (b.updatedAt as any)?.seconds 
        ? (b.updatedAt as any).seconds * 1000 
        : 0;
    return bUpdated - aUpdated;
  });

  // Use the most recent pricing rule
  const latestRule = sortedRules[0];

  if (!latestRule) {
    return null;
  }

  // Calculate the rate with packOf pricing
  // The rate already includes the base unit price
  // packOf is an additional charge per pack
  const rate = latestRule.rate || 0;
  const packOf = latestRule.packOf || 0;

  return {
    rate,
    packOf,
  };
}

/**
 * Check if quantity falls within a quantity range
 */
function isQuantityInRange(quantity: number, range: string): boolean {
  // Handle FBA/WFS/TFS ranges
  if (range === "1001+") {
    return quantity >= 1001;
  } else if (range === "501-1000") {
    return quantity >= 501 && quantity <= 1000;
  } else if (range === "50-500") {
    return quantity >= 50 && quantity <= 500;
  } else if (range === "<50") {
    return quantity < 50;
  }
  // Handle FBM ranges
  else if (range === "101+") {
    return quantity >= 101;
  } else if (range === "50+") {
    return quantity >= 50 && quantity < 101;
  } else if (range === "25+") {
    return quantity >= 25 && quantity < 50;
  } else if (range === "<25") {
    return quantity < 25;
  }
  // Custom range - always match (admin will handle manually)
  else if (range === "Custom") {
    return true;
  }
  return false;
}

