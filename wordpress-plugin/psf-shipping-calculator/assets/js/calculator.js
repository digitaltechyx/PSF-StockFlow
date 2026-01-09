/**
 * PSF Shipping Calculator JavaScript
 */

(function($) {
    'use strict';

    // Carrier logo mapping
    const carrierLogos = {
        'usps': '📮',
        'ups': '🚚',
        'fedex': '📦',
        'dhl': '✈️',
        'dhl_express': '✈️'
    };

    // Carrier display names
    const carrierNames = {
        'usps': 'USPS',
        'ups': 'UPS',
        'fedex': 'FedEx',
        'dhl': 'DHL',
        'dhl_express': 'DHL Express'
    };

    $(document).ready(function() {
        const $form = $('#psf-shipping-calc-form');
        const $submitBtn = $('#psf-calc-submit-btn');
        const $results = $('#psf-calc-results');
        const $errorDiv = $('#psf-calc-error');
        const $ratesWrapper = $('#psf-rates-table-wrapper');

        $form.on('submit', function(e) {
            e.preventDefault();
            calculateShipping();
        });

        function calculateShipping() {
            // Validate form
            if (!$form[0].checkValidity()) {
                $form[0].reportValidity();
                return;
            }

            // Get form data
            const formData = {
                fromAddress: {
                    name: $('#from-name').val(),
                    street1: $('#from-street1').val(),
                    street2: $('#from-street2').val() || '',
                    city: $('#from-city').val(),
                    state: $('#from-state').val(),
                    zip: $('#from-zip').val(),
                    country: $('#from-country').val(),
                    phone: $('#from-phone').val() || '',
                    email: ''
                },
                toAddress: {
                    name: $('#to-name').val(),
                    street1: $('#to-street1').val(),
                    street2: $('#to-street2').val() || '',
                    city: $('#to-city').val(),
                    state: $('#to-state').val(),
                    zip: $('#to-zip').val(),
                    country: $('#to-country').val(),
                    phone: $('#to-phone').val() || '',
                    email: ''
                },
                parcel: {
                    length: parseFloat($('#parcel-length').val()),
                    width: parseFloat($('#parcel-width').val()),
                    height: parseFloat($('#parcel-height').val()),
                    weight: parseFloat($('#parcel-weight').val()),
                    distanceUnit: 'in',
                    weightUnit: 'lb'
                }
            };

            // Show loading state
            setLoadingState(true);
            $errorDiv.hide();
            $results.hide();

            // Make API call
            $.ajax({
                url: psfShippingCalc.apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(formData),
                success: function(response) {
                    setLoadingState(false);
                    if (response.rates && response.rates.length > 0) {
                        displayRates(response.rates);
                    } else {
                        showError('No shipping rates available for this shipment.');
                    }
                },
                error: function(xhr) {
                    setLoadingState(false);
                    let errorMessage = 'Failed to get shipping rates. Please try again.';
                    
                    if (xhr.responseJSON) {
                        errorMessage = xhr.responseJSON.error || errorMessage;
                        if (xhr.responseJSON.details) {
                            errorMessage += ': ' + xhr.responseJSON.details;
                        }
                    }
                    
                    showError(errorMessage);
                }
            });
        }

        function setLoadingState(loading) {
            if (loading) {
                $submitBtn.prop('disabled', true);
                $submitBtn.find('.psf-btn-text').hide();
                $submitBtn.find('.psf-btn-loader').show();
            } else {
                $submitBtn.prop('disabled', false);
                $submitBtn.find('.psf-btn-text').show();
                $submitBtn.find('.psf-btn-loader').hide();
            }
        }

        function showError(message) {
            $errorDiv.text(message).show();
            $results.show();
        }

        function displayRates(rates) {
            // Sort rates by price (lowest first)
            rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
            
            // Find best rate (lowest price)
            const bestRate = rates[0];
            const bestPrice = parseFloat(bestRate.amount);

            // Build table HTML
            let tableHTML = '<table class="psf-rates-table">';
            tableHTML += '<thead><tr>';
            tableHTML += '<th>Carrier</th>';
            tableHTML += '<th>Service</th>';
            tableHTML += '<th>Price</th>';
            tableHTML += '<th>Delivery Time</th>';
            tableHTML += '</tr></thead>';
            tableHTML += '<tbody>';

            rates.forEach(function(rate) {
                const isBestRate = parseFloat(rate.amount) === bestPrice;
                const rowClass = isBestRate ? 'psf-best-rate' : '';
                
                const carrier = rate.provider.toLowerCase();
                const carrierLogo = carrierLogos[carrier] || '📦';
                const carrierName = carrierNames[carrier] || rate.provider;
                const serviceName = rate.servicelevel?.name || 'Standard';
                const price = parseFloat(rate.amount).toFixed(2);
                const currency = rate.currency || 'USD';
                const deliveryDays = rate.estimated_days ? rate.estimated_days : 'N/A';

                tableHTML += '<tr class="' + rowClass + '">';
                tableHTML += '<td><div class="psf-carrier-logo">';
                tableHTML += '<span class="psf-carrier-icon">' + carrierLogo + '</span>';
                tableHTML += '<span class="psf-carrier-name">' + carrierName + '</span>';
                if (isBestRate) {
                    tableHTML += '<span class="psf-best-rate-badge">Best Rate</span>';
                }
                tableHTML += '</div></td>';
                tableHTML += '<td><span class="psf-service-name">' + escapeHtml(serviceName) + '</span></td>';
                tableHTML += '<td><span class="psf-rate-price">$' + price + '</span>';
                tableHTML += '<span class="psf-rate-currency">' + currency + '</span></td>';
                tableHTML += '<td>';
                if (deliveryDays !== 'N/A') {
                    tableHTML += '<span class="psf-delivery-days">' + deliveryDays + '</span>';
                } else {
                    tableHTML += '<span style="color: #999;">N/A</span>';
                }
                tableHTML += '</td>';
                tableHTML += '</tr>';
            });

            tableHTML += '</tbody></table>';
            
            $ratesWrapper.html(tableHTML);
            $results.show();
            
            // Scroll to results
            $('html, body').animate({
                scrollTop: $results.offset().top - 100
            }, 500);
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, function(m) { return map[m]; });
        }
    });

})(jQuery);
