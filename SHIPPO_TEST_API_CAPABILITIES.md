# Shippo Test API Capabilities & Limitations

Complete guide on what you CAN and CANNOT do with Shippo's test API.

---

## ✅ What You CAN Do with Shippo Test API

### 1. **Get Shipping Rates** ✅
- **Yes, you can get rates in test mode**
- Rates are returned from Shippo API
- Some rates may be placeholders/mock data
- Rates may not exactly match live production rates
- **Good for**: Testing your rate retrieval flow, UI display, rate selection logic

### 2. **Create Shipments** ✅
- **Yes, you can create shipments in test mode**
- Shipment objects are created successfully
- All shipment data is stored
- **Good for**: Testing shipment creation flow, address validation, parcel details

### 3. **Purchase Test Labels** ✅
- **Yes, you can purchase labels in test mode**
- Labels are generated and returned
- Labels are marked with **"VOID"** or **"Sample Do Not Use"**
- **Labels cannot be used for actual shipping** - they're for testing only
- **No charges** are made to your credit card in test mode
- **Good for**: Testing the complete purchase flow, label generation, PDF download

### 4. **Download Label PDFs** ✅
- **Yes, you can download label PDFs in test mode**
- PDFs are generated and available for download
- PDFs will show "VOID" or "Sample" markings
- **Good for**: Testing label download functionality, PDF display, storage

### 5. **Get Tracking Numbers** ✅
- **Yes, tracking numbers are generated in test mode**
- Tracking numbers are returned with test labels
- **Good for**: Testing tracking number retrieval, storing tracking info

### 6. **Test Address Validation** ✅
- **Yes, address validation works in test mode**
- **Recommended**: Use real, verifiable addresses during testing
- **Good for**: Testing address validation, error handling

### 7. **Test API Integration** ✅
- **Yes, all API endpoints work in test mode**
- You can test the complete integration flow
- Error handling can be tested
- **Good for**: End-to-end testing of your integration

---

## ❌ What You CANNOT Do with Shippo Test API

### 1. **Use Labels for Real Shipping** ❌
- **Test labels are VOID and cannot be used**
- Labels are marked "Sample Do Not Use"
- **You cannot ship packages with test labels**

### 2. **Get Real-Time Tracking Updates** ❌
- **Tracking numbers are generated but don't update**
- Tracking information does not change in test mode
- Tracking status remains static
- **Good for**: Testing tracking number display, but not real tracking updates

### 3. **Batch Label Processing** ❌
- **Not supported in test mode**
- Cannot process multiple labels at once
- **Good for**: Single label testing only

### 4. **Manifesting** ❌
- **Not supported in test mode**
- Cannot create manifests for carriers
- **Good for**: Single label operations only

### 5. **Get Exact Live Rates** ⚠️
- **Rates may be placeholders or estimates**
- Rates may not match production rates exactly
- Some carriers may not return rates in test mode
- **Good for**: Testing flow, but not for accurate pricing

### 6. **Test All Carriers** ⚠️
- **Some carriers have limitations**:
  - **FedEx**: Does not support test mode - requires separate test account through FedEx account manager
  - **USPS**: Works with Shippo Postage in test mode
  - **UPS**: May require test account setup
- **Good for**: Testing with USPS (Shippo Postage), but not all carriers

---

## 🎯 What This Means for Your Integration

### ✅ You CAN Test:

1. **Complete Purchase Flow**:
   - ✅ User fills form → Gets rates → Selects rate → Pays via Stripe
   - ✅ Payment succeeds → Label purchase triggered
   - ✅ Label generated and available for download

2. **All Your Features**:
   - ✅ Rate retrieval and display
   - ✅ Rate selection UI
   - ✅ Payment integration (Stripe)
   - ✅ Label purchase after payment
   - ✅ Label PDF download
   - ✅ Tracking number storage
   - ✅ Error handling

3. **End-to-End Integration**:
   - ✅ Complete user journey
   - ✅ Database updates
   - ✅ File storage (label PDFs)
   - ✅ UI/UX flow

### ⚠️ Limitations to Be Aware Of:

1. **Rates May Not Be Accurate**:
   - Test rates might differ from production
   - Use for flow testing, not pricing decisions

2. **Tracking Won't Update**:
   - Tracking numbers are static in test mode
   - You can test displaying tracking numbers
   - But tracking status won't change

3. **Labels Are VOID**:
   - Cannot use test labels for real shipping
   - Good for testing download/storage functionality

4. **Some Carriers Limited**:
   - FedEx requires special test account
   - Focus on USPS (Shippo Postage) for testing

---

## 📋 Testing Checklist with Test API

### Phase 1: Basic Integration Testing ✅
- [ ] Get shipping rates (test mode)
- [ ] Display rates in UI
- [ ] Select a rate
- [ ] Create payment intent (Stripe)
- [ ] Complete payment flow
- [ ] Purchase label after payment (test mode)
- [ ] Download label PDF (VOID label)
- [ ] Store label in database
- [ ] Display tracking number

### Phase 2: Error Handling Testing ✅
- [ ] Test invalid addresses
- [ ] Test payment failures
- [ ] Test API errors
- [ ] Test network failures
- [ ] Test validation errors

### Phase 3: UI/UX Testing ✅
- [ ] Test form validation
- [ ] Test loading states
- [ ] Test success messages
- [ ] Test error messages
- [ ] Test responsive design

### Phase 4: Production Testing (Live API) ⚠️
- [ ] Test with live API for accurate rates
- [ ] Test with real label purchase (small amount)
- [ ] Test real tracking updates
- [ ] Verify label can be used for shipping

---

## 🚀 Recommended Testing Strategy

### Step 1: Development Testing (Test API)
1. **Use Shippo Test API** for all development
2. **Test complete flow** with test labels
3. **Verify all features work** correctly
4. **Test error handling** thoroughly
5. **No charges** - safe to test extensively

### Step 2: Staging Testing (Test API)
1. **Deploy to staging** environment
2. **Use test API keys** in staging
3. **Test with real users** (internal team)
4. **Verify end-to-end flow**
5. **Test all edge cases**

### Step 3: Production Testing (Live API - Small Scale)
1. **Switch to live API** for final testing
2. **Test with 1-2 real labels** (small amounts)
3. **Verify rates are accurate**
4. **Test real tracking updates**
5. **Verify labels work for shipping**

### Step 4: Production Launch (Live API)
1. **Use live API** in production
2. **Monitor closely** for first few days
3. **Watch for errors** or issues
4. **Collect user feedback**

---

## 💡 Key Takeaways

### ✅ YES - You Can Test Everything with Test API:
- Complete purchase flow
- Rate retrieval
- Label purchase
- Label download
- Tracking number generation
- Error handling
- UI/UX flow

### ⚠️ BUT - Be Aware of Limitations:
- Labels are VOID (cannot ship)
- Rates may not be exact
- Tracking won't update
- Some carriers limited
- Batch/manifest features unavailable

### 🎯 Best Practice:
1. **Use test API** for development and staging
2. **Test thoroughly** with test API (no cost)
3. **Switch to live API** for final testing and production
4. **Test with small amounts** when using live API

---

## 🔄 Test API vs Live API Comparison

| Feature | Test API | Live API |
|---------|----------|----------|
| Get Rates | ✅ Yes (may be estimates) | ✅ Yes (accurate) |
| Create Shipment | ✅ Yes | ✅ Yes |
| Purchase Label | ✅ Yes (VOID label) | ✅ Yes (real label) |
| Download PDF | ✅ Yes (marked VOID) | ✅ Yes (usable) |
| Tracking Number | ✅ Yes (static) | ✅ Yes (updates) |
| Charges | ❌ No charges | ✅ Real charges |
| Use for Shipping | ❌ No (VOID) | ✅ Yes |
| Batch Processing | ❌ No | ✅ Yes |
| Manifesting | ❌ No | ✅ Yes |
| All Carriers | ⚠️ Limited | ✅ Yes |

---

## ✅ Conclusion

**YES, you can test almost everything with Shippo's test API!**

You can:
- ✅ Test the complete integration flow
- ✅ Test rate retrieval and display
- ✅ Test label purchase (VOID labels)
- ✅ Test label download
- ✅ Test tracking number generation
- ✅ Test all your features

You just need to remember:
- ⚠️ Labels are VOID (for testing only)
- ⚠️ Rates may not be exact
- ⚠️ Tracking won't update
- ⚠️ Switch to live API for production

**Recommendation**: Use test API for development and staging, then switch to live API for production with small test purchases first.

---

**Last Updated**: [Current Date]

