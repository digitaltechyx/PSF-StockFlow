<?php
/**
 * Shipping Calculator Form Template
 */
?>

<div class="psf-shipping-calculator-wrapper">
    <?php if ($atts['show_title'] === 'yes'): ?>
        <h2 class="psf-calc-title"><?php echo esc_html($atts['title']); ?></h2>
    <?php endif; ?>
    
    <div class="psf-calc-container">
        <form id="psf-shipping-calc-form" class="psf-calc-form">
            <!-- Origin Address Section -->
            <div class="psf-calc-section">
                <h3 class="psf-section-title">From Address</h3>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="from-name">Name *</label>
                        <input type="text" id="from-name" name="fromName" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="from-phone">Phone</label>
                        <input type="tel" id="from-phone" name="fromPhone">
                    </div>
                </div>
                <div class="psf-form-group">
                    <label for="from-street1">Street Address *</label>
                    <input type="text" id="from-street1" name="fromStreet1" required>
                </div>
                <div class="psf-form-group">
                    <label for="from-street2">Street Address 2</label>
                    <input type="text" id="from-street2" name="fromStreet2">
                </div>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="from-city">City *</label>
                        <input type="text" id="from-city" name="fromCity" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="from-state">State *</label>
                        <input type="text" id="from-state" name="fromState" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="from-zip">ZIP Code *</label>
                        <input type="text" id="from-zip" name="fromZip" required>
                    </div>
                </div>
                <div class="psf-form-group">
                    <label for="from-country">Country *</label>
                    <select id="from-country" name="fromCountry" required>
                        <option value="US" selected>United States</option>
                        <option value="CA">Canada</option>
                        <option value="MX">Mexico</option>
                    </select>
                </div>
            </div>

            <!-- Destination Address Section -->
            <div class="psf-calc-section">
                <h3 class="psf-section-title">To Address</h3>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="to-name">Name *</label>
                        <input type="text" id="to-name" name="toName" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="to-phone">Phone</label>
                        <input type="tel" id="to-phone" name="toPhone">
                    </div>
                </div>
                <div class="psf-form-group">
                    <label for="to-street1">Street Address *</label>
                    <input type="text" id="to-street1" name="toStreet1" required>
                </div>
                <div class="psf-form-group">
                    <label for="to-street2">Street Address 2</label>
                    <input type="text" id="to-street2" name="toStreet2">
                </div>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="to-city">City *</label>
                        <input type="text" id="to-city" name="toCity" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="to-state">State *</label>
                        <input type="text" id="to-state" name="toState" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="to-zip">ZIP Code *</label>
                        <input type="text" id="to-zip" name="toZip" required>
                    </div>
                </div>
                <div class="psf-form-group">
                    <label for="to-country">Country *</label>
                    <select id="to-country" name="toCountry" required>
                        <option value="US" selected>United States</option>
                        <option value="CA">Canada</option>
                        <option value="MX">Mexico</option>
                    </select>
                </div>
            </div>

            <!-- Package Details Section -->
            <div class="psf-calc-section">
                <h3 class="psf-section-title">Package Details</h3>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="parcel-length">Length (inches) *</label>
                        <input type="number" id="parcel-length" name="parcelLength" step="0.01" min="0.01" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="parcel-width">Width (inches) *</label>
                        <input type="number" id="parcel-width" name="parcelWidth" step="0.01" min="0.01" required>
                    </div>
                    <div class="psf-form-group">
                        <label for="parcel-height">Height (inches) *</label>
                        <input type="number" id="parcel-height" name="parcelHeight" step="0.01" min="0.01" required>
                    </div>
                </div>
                <div class="psf-form-row">
                    <div class="psf-form-group">
                        <label for="parcel-weight">Weight (lbs) *</label>
                        <input type="number" id="parcel-weight" name="parcelWeight" step="0.01" min="0.01" required>
                    </div>
                </div>
            </div>

            <!-- Submit Button -->
            <div class="psf-calc-submit">
                <button type="submit" id="psf-calc-submit-btn" class="psf-calc-btn">
                    <span class="psf-btn-text">Get Shipping Rates</span>
                    <span class="psf-btn-loader" style="display: none;">
                        <span class="psf-spinner"></span> Calculating...
                    </span>
                </button>
            </div>
        </form>

        <!-- Results Section -->
        <div id="psf-calc-results" class="psf-calc-results" style="display: none;">
            <h3 class="psf-results-title">Available Shipping Rates</h3>
            <div id="psf-calc-error" class="psf-calc-error" style="display: none;"></div>
            <div id="psf-rates-table-wrapper" class="psf-rates-table-wrapper"></div>
        </div>
    </div>
</div>
