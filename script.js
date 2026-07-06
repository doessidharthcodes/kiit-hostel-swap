/* =========================================================
   KIIT HOSTEL SWAP PORTAL — MODULAR SCRIPT
   Firebase v12 Modular SDK (CDN imports, no bundler).
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// =========================================================
// 0. FIREBASE INITIALIZATION (ONCE GLOBALLY)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyA-x8SdS_6unDPQRikDCKFDbB5hxjuBB0M",
  authDomain: "kiit-hostel-swap.firebaseapp.com",
  projectId: "kiit-hostel-swap",
  storageBucket: "kiit-hostel-swap.firebasestorage.app",
  messagingSenderId: "702498974463",
  appId: "1:702498974463:web:1c9dc4eaad84e08146baca",
  measurementId: "G-05HEZS7PYT"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();



const HOSTELS = [
  'KP2',
  'KP4',
  'KP5',
  'KP6',
  'KP6A',
  'KP6B',
  'KP7A',
  'KP7B',
  'KP7C',
  'KP7D',
  'KP7E',
  'KP7F',
  'KP8',
  'KP9',
  'KP10',
  'KP10A',
  'KP10B',
  'KP12',
  'KP14',
  'KP15',
  'KP16',
  'KP25A',
  'KP25B',
  'KP25C',
  'KP25D',
  'KP25E',
  'QC1',
  'QC2',
  'QC4',
  'QC5A',
  'QC14',
  'QC18',
  'QC25'
];

// State variables
let currentUser = null;
let currentUserProfile = null;        // profiles/{uid}        (public)
let currentUserPrivateProfile = null; // private_profiles/{uid} (private)
let authMode = "register"; // "register" or "login"
let activeListeners = [];  // holds unsubscribe fns for onSnapshot listeners

// =========================================================
// 1. DOM ELEMENTS
// =========================================================
const authPanel = document.getElementById("authPanel");
const verificationPanel = document.getElementById("verificationPanel");
const profilePanel = document.getElementById("profilePanel");

const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const tabLoginBtn = document.getElementById("tabLoginBtn");
const authForm = document.getElementById("authForm");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const googleSignInBtn = document.getElementById("googleSignInBtn");

const verificationEmailDisplay = document.getElementById("verificationEmailDisplay");
const checkVerificationBtn = document.getElementById("checkVerificationBtn");
const resendVerificationBtn = document.getElementById("resendVerificationBtn");
const verificationSignOutBtn = document.getElementById("verificationSignOutBtn");

const userEmailSpan = document.getElementById("userEmailSpan");
const signOutBtn = document.getElementById("signOutBtn");
const swapForm = document.getElementById("swapForm");
const submitBtn = document.getElementById("submitBtn");
const deleteBtn = document.getElementById("deleteBtn");

const requestsSection = document.getElementById("requestsSection");
const incomingRequestsList = document.getElementById("incomingRequestsList");
const outgoingRequestsList = document.getElementById("outgoingRequestsList");

const resultsSection = document.getElementById("results-section");
const resultsHeader = document.getElementById("resultsHeader");
const resultsSubtitle = document.getElementById("resultsSubtitle");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");

// =========================================================
// 2. HELPERS: TOASTS, FIELD ERRORS, ERROR MESSAGES
// =========================================================
let toastTimeout = null;
function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast is-visible' + (type ? ` toast--${type}` : '');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3200);
}

function clearFieldErrors(formElement) {
  formElement.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('has-error');
    const errorEl = field.querySelector('.field__error');
    if (errorEl) errorEl.textContent = '';
    const input = field.querySelector('input, select');
    if (input) input.removeAttribute('aria-invalid');
  });
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const fieldWrapper = field.closest('.field');
  if (fieldWrapper) fieldWrapper.classList.add('has-error');
  const errorEl = document.getElementById('err-' + fieldId);
  if (errorEl) errorEl.textContent = message;
  field.setAttribute('aria-invalid', 'true');
}

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Phone number must be exactly 10 digits, numeric only, and start with 6-9
// (standard Indian mobile number format).
function isValidPhoneNumber(value) {
  return /^[6-9][0-9]{9}$/.test(value);
}

// Centralized, human-readable messages for Firebase Auth errors.
function getAuthErrorMessage(err) {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing sign-in.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Please allow popups and try again.";
    case "auth/cancelled-popup-request":
      return ""; // benign — another popup request superseded this one
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/requires-recent-login":
      return "Please sign out and sign in again before doing this for security verification.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

// Centralized, human-readable messages for Firestore errors.
function getFirestoreErrorMessage(err) {
  switch (err.code) {
    case "permission-denied":
      return "You don't have permission to do that. Please check Firestore security rules.";
    case "unavailable":
      return "Network error. Please check your connection and try again.";
    case "not-found":
      return "The requested data could not be found.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

// =========================================================
// 3. UI STATE SCREEN MANAGER
// =========================================================
function updateUIScreens() {
  // 1. Not signed in
  if (!currentUser) {
    authPanel.hidden = false;
    verificationPanel.hidden = true;
    profilePanel.hidden = true;
    resultsSection.style.display = 'none';
    cleanupActiveListeners();
    return;
  }

  // 2. Signed in but email not verified (Google accounts are pre-verified)
  if (!currentUser.emailVerified) {
    authPanel.hidden = true;
    verificationPanel.hidden = false;
    profilePanel.hidden = true;
    resultsSection.style.display = 'none';
    verificationEmailDisplay.textContent = currentUser.email;
    cleanupActiveListeners();
    return;
  }

  // 3. Authenticated & verified -> show profile
  authPanel.hidden = true;
  verificationPanel.hidden = true;
  profilePanel.hidden = false;
  resultsSection.style.display = 'block';
  userEmailSpan.textContent = `Signed in as: ${currentUser.email}`;
}

function cleanupActiveListeners() {
  activeListeners.forEach((unsubscribe) => unsubscribe());
  activeListeners = [];
}

// =========================================================
// 4. POPULATE HOSTEL DROPDOWNS
// =========================================================
function populateHostelDropdowns() {
  const currentSelect = document.getElementById('currentHostel');
  const desiredSelect = document.getElementById('desiredHostel');
  if (!currentSelect || !desiredSelect) return;

  const placeholder = (text) => {
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = text;
    return opt;
  };

  currentSelect.innerHTML = '';
  desiredSelect.innerHTML = '';
  currentSelect.appendChild(placeholder('Select current hostel'));
  desiredSelect.appendChild(placeholder('Select desired hostel'));

  HOSTELS.forEach((hostel) => {
    const opt1 = document.createElement('option');
    opt1.value = hostel;
    opt1.textContent = hostel;
    currentSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = hostel;
    opt2.textContent = hostel;
    desiredSelect.appendChild(opt2);
  });
}

// =========================================================
// 5. AUTHENTICATION HANDLERS
// =========================================================
function setupAuthToggles() {
  if (!tabRegisterBtn || !tabLoginBtn) return;
  tabRegisterBtn.addEventListener("click", () => {
    authMode = "register";
    tabRegisterBtn.className = "btn btn--primary auth-tab-btn";
    tabLoginBtn.className = "btn btn--ghost auth-tab-btn";
    authSubmitBtn.querySelector(".btn__label").textContent = "Register Account";
    clearFieldErrors(authForm);
  });

  tabLoginBtn.addEventListener("click", () => {
    authMode = "login";
    tabLoginBtn.className = "btn btn--primary auth-tab-btn";
    tabRegisterBtn.className = "btn btn--ghost auth-tab-btn";
    authSubmitBtn.querySelector(".btn__label").textContent = "Sign In";
    clearFieldErrors(authForm);
  });
}

function setupAuthFormSubmit() {
  if (!authForm) return;
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(authForm);

    const emailVal = authEmail.value.trim();
    const passwordVal = authPassword.value;

    let hasErrors = false;
    if (!emailVal) {
      showFieldError("authEmail", "Please enter your email.");
      hasErrors = true;
    } else if (!isValidEmail(emailVal)) {
      showFieldError("authEmail", "Please enter a valid email address.");
      hasErrors = true;
    }

    if (!passwordVal) {
      showFieldError("authPassword", "Please enter a password.");
      hasErrors = true;
    } else if (passwordVal.length < 6) {
      showFieldError("authPassword", "Password must be at least 6 characters.");
      hasErrors = true;
    }

    if (hasErrors) {
      showToast("Please correct the errors before submitting.", "error");
      return;
    }

    authSubmitBtn.classList.add("is-loading");
    authSubmitBtn.disabled = true;

    try {
      if (authMode === "register") {
        const userCredential = await createUserWithEmailAndPassword(auth, emailVal, passwordVal);
        await sendEmailVerification(userCredential.user);
        showToast("Registration successful! Verification email sent.", "success");
      } else {
        await signInWithEmailAndPassword(auth, emailVal, passwordVal);
        showToast("Signed in successfully!", "success");
      }
    } catch (err) {
      console.error(err);
      showToast(getAuthErrorMessage(err), "error");
    } finally {
      authSubmitBtn.classList.remove("is-loading");
      authSubmitBtn.disabled = false;
    }
  });

  // Clear errors as the user types
  authForm.querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", () => {
      const fieldWrapper = el.closest('.field');
      if (fieldWrapper) fieldWrapper.classList.remove('has-error');
      const errEl = document.getElementById("err-" + el.id);
      if (errEl) errEl.textContent = '';
    });
  });
}

function setupGoogleSignIn() {
  if (!googleSignInBtn) return;
  googleSignInBtn.addEventListener("click", async () => {
    googleSignInBtn.classList.add("is-loading");
    googleSignInBtn.disabled = true;

    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Signed in with Google!", "success");
    } catch (err) {
      // Ignore benign "another popup superseded this one" case
      if (err.code !== "auth/cancelled-popup-request") {
        console.error(err);
        const msg = getAuthErrorMessage(err);
        if (msg) showToast(msg, "error");
      }
    } finally {
      googleSignInBtn.classList.remove("is-loading");
      googleSignInBtn.disabled = false;
    }
  });
}

function setupVerificationHandlers() {
  if (!checkVerificationBtn || !resendVerificationBtn || !verificationSignOutBtn || !signOutBtn) return;

  checkVerificationBtn.addEventListener("click", async () => {
    checkVerificationBtn.classList.add("is-loading");
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        showToast("Email verified successfully!", "success");
        currentUser = auth.currentUser;
        updateUIScreens();
        await loadUserProfile();
      } else {
        showToast("Email is still not verified. Please check your spam folder or resend.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast(getAuthErrorMessage(err), "error");
    } finally {
      checkVerificationBtn.classList.remove("is-loading");
    }
  });

  resendVerificationBtn.addEventListener("click", async () => {
    resendVerificationBtn.classList.add("is-loading");
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Verification email resent successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast(getAuthErrorMessage(err), "error");
    } finally {
      resendVerificationBtn.classList.remove("is-loading");
    }
  });

  const doSignOut = async () => {
    try {
      await signOut(auth);
      showToast("Signed out successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast(getAuthErrorMessage(err), "error");
    }
  };

  verificationSignOutBtn.addEventListener("click", doSignOut);
  signOutBtn.addEventListener("click", doSignOut);
}

// =========================================================
// 6. PROFILE DATA HANDLERS
// =========================================================
async function loadUserProfile() {
  if (!currentUser) return;

  try {
    const publicRef = doc(db, "profiles", currentUser.uid);
    const privateRef = doc(db, "private_profiles", currentUser.uid);

    const [publicSnap, privateSnap] = await Promise.all([
      getDoc(publicRef),
      getDoc(privateRef)
    ]);

    if (publicSnap.exists() && privateSnap.exists()) {
      currentUserProfile = publicSnap.data();
      currentUserPrivateProfile = privateSnap.data();

      // Pre-fill form fields — existing profile, don't ask again
      swapForm.fullName.value = currentUserProfile.fullName || "";
      swapForm.rollNumber.value = currentUserPrivateProfile.rollNumber || "";
      swapForm.gender.value = currentUserProfile.gender || "";
      swapForm.branch.value = currentUserProfile.branch || "";
      swapForm.yearField.value = currentUserProfile.year || "";
      swapForm.currentHostel.value = currentUserProfile.currentHostel || "";
      swapForm.desiredHostel.value = currentUserProfile.desiredHostel || "";
      swapForm.phoneNumber.value = currentUserPrivateProfile.phoneNumber || "";
      if (swapForm.roomNumber) {
        swapForm.roomNumber.value = currentUserPrivateProfile.roomNumber || "";
      }

      deleteBtn.style.display = "inline-flex";
      submitBtn.querySelector(".btn__label").textContent = "Update Profile";

      fetchMatches();
      subscribeToRequests();
      requestsSection.style.display = "block";
    } else {
      // First-time setup — nothing saved yet
      currentUserProfile = null;
      currentUserPrivateProfile = null;

      swapForm.fullName.value = currentUser.displayName || "";
      swapForm.rollNumber.value = "";
      swapForm.gender.value = "";
      swapForm.branch.value = "";
      swapForm.yearField.value = "";
      swapForm.currentHostel.value = "";
      swapForm.desiredHostel.value = "";
      swapForm.phoneNumber.value = "";
      if (swapForm.roomNumber) swapForm.roomNumber.value = "";

      deleteBtn.style.display = "none";
      submitBtn.querySelector(".btn__label").textContent = "Save Profile";
      requestsSection.style.display = "none";

      resultsHeader.hidden = true;
      resultsGrid.hidden = true;
      emptyState.hidden = true;
    }
  } catch (err) {
    console.error(err);
    showToast("Error loading profile: " + getFirestoreErrorMessage(err), "error");
  }
}

function setupProfileSubmit() {
  if (!swapForm) return;
  swapForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(swapForm);

    if (!currentUser) {
      showToast("You must be signed in to save a profile.", "error");
      return;
    }

    const data = {
      fullName: swapForm.fullName.value.trim(),
      rollNumber: swapForm.rollNumber.value.trim(),
      gender: swapForm.gender.value,
      branch: swapForm.branch.value,
      year: swapForm.yearField.value,
      currentHostel: swapForm.currentHostel.value,
      desiredHostel: swapForm.desiredHostel.value,
      roomNumber: swapForm.roomNumber ? swapForm.roomNumber.value.trim() : "",
      phoneNumber: swapForm.phoneNumber.value.trim()
    };

    // Validation
    const errors = {};
    if (!data.fullName) errors.fullName = "Please enter your name.";
    if (!data.rollNumber) errors.rollNumber = "Please enter your roll number.";
    if (!data.gender) errors.gender = "Please select your gender.";
    if (!data.branch) errors.branch = "Please select your branch.";
    if (!data.year) errors.yearField = "Please select your academic year.";
    if (!data.currentHostel) errors.currentHostel = "Please select your current hostel.";
    if (!data.desiredHostel) {
      errors.desiredHostel = "Please select your desired hostel.";
    } else if (data.desiredHostel === data.currentHostel) {
      errors.desiredHostel = "Desired hostel must be different from current hostel.";
    }
    if (!data.phoneNumber) {
      errors.phoneNumber = "Please enter your phone number.";
    } else if (!isValidPhoneNumber(data.phoneNumber)) {
      errors.phoneNumber = "Enter a valid 10-digit phone number starting with 6-9.";
    }

    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, msg]) => showFieldError(field, msg));
      showToast("Please fix the highlighted fields.", "error");
      const firstErr = document.getElementById(Object.keys(errors)[0]);
      if (firstErr) firstErr.focus();
      return;
    }

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    try {
      const publicRef = doc(db, "profiles", currentUser.uid);
      const privateRef = doc(db, "private_profiles", currentUser.uid);

      const publicDoc = {
        fullName: data.fullName,
        currentHostel: data.currentHostel,
        desiredHostel: data.desiredHostel,
        branch: data.branch,
        year: data.year,
        gender: data.gender,
        updatedAt: serverTimestamp()
      };

      const privateDoc = {
        rollNumber: data.rollNumber,
        email: currentUser.email, // taken from the authenticated session, never re-asked
        roomNumber: data.roomNumber,
        phoneNumber: data.phoneNumber,
        updatedAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(publicRef, publicDoc),
        setDoc(privateRef, privateDoc)
      ]);

      showToast("Your swap profile has been saved!", "success");
      await loadUserProfile();
    } catch (err) {
      console.error(err);
      showToast("Failed to save profile: " + getFirestoreErrorMessage(err), "error");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });

  // Clear error on input
  swapForm.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', () => {
      const wrapper = el.closest('.field');
      if (wrapper) wrapper.classList.remove('has-error');
      const errEl = document.getElementById('err-' + el.id);
      if (errEl) errEl.textContent = '';
      el.removeAttribute('aria-invalid');
    });
  });
}

function setupProfileDelete() {
  if (!deleteBtn) return;
  deleteBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to permanently delete your swap profile and user account? This cannot be undone.")) return;

    deleteBtn.classList.add("is-loading");
    deleteBtn.disabled = true;

    try {
      const uid = currentUser.uid;

      await Promise.all([
        deleteDoc(doc(db, "profiles", uid)),
        deleteDoc(doc(db, "private_profiles", uid))
      ]);

      await deleteUser(auth.currentUser);

      showToast("Your profile and account have been deleted.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete account: " + getAuthErrorMessage(err), "error");
    } finally {
      deleteBtn.classList.remove("is-loading");
      deleteBtn.disabled = false;
    }
  });
}

// =========================================================
// 7. HOSTEL SWAP MATCHING
// Rule: my.currentHostel == their.desiredHostel
//       AND my.desiredHostel == their.currentHostel
//       (excluding myself)
// =========================================================
async function fetchMatches() {
  if (!currentUserProfile) {
    resultsHeader.hidden = true;
    resultsGrid.hidden = true;
    emptyState.hidden = false;
    return;
  }

  try {
    const q = query(
      collection(db, "profiles"),
      where("currentHostel", "==", currentUserProfile.desiredHostel),
      where("desiredHostel", "==", currentUserProfile.currentHostel)
    );

    const snap = await getDocs(q);
    const matches = [];

    snap.forEach((docSnap) => {
      if (docSnap.id !== currentUser.uid) {
        matches.push({ uid: docSnap.id, ...docSnap.data() });
      }
    });

    renderResultsList(matches);
  } catch (err) {
    console.error(err);
    showToast("Error retrieving matches: " + getFirestoreErrorMessage(err), "error");
  }
}

function renderResultsList(matches) {
  resultsGrid.innerHTML = '';

  if (matches.length === 0) {
    resultsHeader.hidden = true;
    resultsGrid.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  resultsGrid.hidden = false;
  resultsHeader.hidden = false;
  resultsSubtitle.textContent =
    `${matches.length} student${matches.length > 1 ? 's' : ''} want${matches.length > 1 ? '' : 's'} to swap ` +
    `${currentUserProfile.desiredHostel} → ${currentUserProfile.currentHostel}`;

  matches.forEach((match, index) => {
    const card = document.createElement('article');
    card.className = 'match-card';
    card.style.animationDelay = `${index * 90}ms`;

    // Privacy: never render match.email / match.phoneNumber / match.rollNumber /
    // match.roomNumber here — "profiles" documents never contain them anyway,
    // and only public fields (name, branch, year, hostels) are shown pre-approval.
    card.innerHTML = `
      <div class="match-card__top">
        <div class="match-card__avatar" aria-hidden="true">${getInitials(match.fullName)}</div>
        <div>
          <p class="match-card__name">${match.fullName}</p>
        </div>
      </div>

      <div class="match-card__swap">
        <span class="match-card__hostel">${match.currentHostel}</span>
        <span class="match-card__arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="match-card__hostel">${match.desiredHostel}</span>
      </div>

      <div class="match-card__meta">
        <span><strong>${match.branch}</strong>Branch</span>
        <span><strong>${match.year}</strong>Year</span>
      </div>

      <button type="button" class="btn btn--outline btn--block match-contact-btn" id="reqBtn-${match.uid}">Request Contact</button>
    `;

    const requestBtn = card.querySelector(`#reqBtn-${match.uid}`);
    requestBtn.addEventListener('click', () => sendContactRequest(match.uid, match, requestBtn));

    resultsGrid.appendChild(card);
  });
}

// =========================================================
// 8. CONTACT REQUEST OPERATIONS
// Collection: contactRequests
// Privacy: request documents only ever store PUBLIC profile
// fields (name, branch, year, hostels). Email/phone are only
// ever written into a request once the recipient explicitly
// approves and chooses to share them — never before.
// =========================================================
async function sendContactRequest(matchId, matchProfile, requestBtn) {
  if (!currentUser || !currentUserProfile) return;

  requestBtn.disabled = true;
  requestBtn.textContent = "Sending...";

  try {
    const dupCheck = query(
      collection(db, "contactRequests"),
      where("fromUid", "==", currentUser.uid),
      where("toUid", "==", matchId)
    );
    const checkSnap = await getDocs(dupCheck);

    if (!checkSnap.empty) {
      showToast("You have already sent a contact request to this student.", "error");
      requestBtn.textContent = "Request Sent";
      return;
    }

    await addDoc(collection(db, "contactRequests"), {
      fromUid: currentUser.uid,
      toUid: matchId,
      status: "pending",
      createdAt: serverTimestamp(),
      senderName: currentUserProfile.fullName,
      senderCurrentHostel: currentUserProfile.currentHostel,
      senderDesiredHostel: currentUserProfile.desiredHostel,
      senderBranch: currentUserProfile.branch,
      senderYear: currentUserProfile.year,
      recipientName: matchProfile.fullName,
      recipientCurrentHostel: matchProfile.currentHostel,
      recipientDesiredHostel: matchProfile.desiredHostel,
      recipientBranch: matchProfile.branch,
      recipientYear: matchProfile.year
    });

    showToast("Contact request sent successfully!", "success");
    requestBtn.textContent = "Request Sent ✓";
  } catch (err) {
    console.error(err);
    showToast("Failed to send contact request: " + getFirestoreErrorMessage(err), "error");
    requestBtn.disabled = false;
    requestBtn.textContent = "Request Contact";
  }
}

function subscribeToRequests() {
  cleanupActiveListeners();
  if (!currentUser) return;

  const incomingQuery = query(collection(db, "contactRequests"), where("toUid", "==", currentUser.uid));
  const outgoingQuery = query(collection(db, "contactRequests"), where("fromUid", "==", currentUser.uid));

  let incomingRequests = [];
  let outgoingRequests = [];

  const handleIncoming = onSnapshot(
    incomingQuery,
    (snap) => {
      incomingRequests = [];
      snap.forEach((docSnap) => incomingRequests.push({ id: docSnap.id, ...docSnap.data() }));
      renderRequestsLists(incomingRequests, outgoingRequests);
    },
    (err) => {
      console.error(err);
      showToast("Error loading incoming requests: " + getFirestoreErrorMessage(err), "error");
    }
  );

  const handleOutgoing = onSnapshot(
    outgoingQuery,
    (snap) => {
      outgoingRequests = [];
      snap.forEach((docSnap) => outgoingRequests.push({ id: docSnap.id, ...docSnap.data() }));
      renderRequestsLists(incomingRequests, outgoingRequests);
    },
    (err) => {
      console.error(err);
      showToast("Error loading outgoing requests: " + getFirestoreErrorMessage(err), "error");
    }
  );

  activeListeners.push(handleIncoming, handleOutgoing);
}

function renderRequestsLists(incoming, outgoing) {
  // INCOMING REQUESTS
  incomingRequestsList.innerHTML = '';
  if (incoming.length === 0) {
    incomingRequestsList.innerHTML = `<p style="font-size: 0.9rem; font-style: italic; color: var(--color-text-faint);">No incoming requests yet.</p>`;
  } else {
    incoming.forEach((req) => {
      const reqCard = document.createElement('div');
      reqCard.className = 'request-card';
      const isApproved = req.status === 'approved';

      let actionsHTML = '';
      if (!isApproved) {
        actionsHTML = `
          <div class="request-card__actions">
            <div class="request-card__checkboxes">
              <label class="request-card__checkbox-label">
                <input type="checkbox" id="shareEmail-${req.id}" checked /> Share Email
              </label>
              <label class="request-card__checkbox-label">
                <input type="checkbox" id="sharePhone-${req.id}" checked /> Share Phone Number
              </label>
            </div>
            <div class="request-card__buttons">
              <button type="button" class="btn btn--primary btn-approve-${req.id}">Approve</button>
              <button type="button" class="btn btn--danger btn-decline-${req.id}">Decline</button>
            </div>
          </div>
        `;
      } else {
        actionsHTML = `
          <div class="request-card__shared-info">
            <p style="margin:0 0 6px 0; font-weight:600; color:var(--color-success);">Approved ✓</p>
            <p style="margin:0; font-size:0.85rem;">You shared your contact details with ${req.senderName}.</p>
          </div>
        `;
      }

      reqCard.innerHTML = `
        <div class="request-card__header">
          <div>
            <p class="request-card__title">${req.senderName} (${req.senderBranch}, ${req.senderYear})</p>
            <p class="request-card__subtitle">Wants to swap: ${req.senderCurrentHostel} → ${req.senderDesiredHostel}</p>
          </div>
          <span class="request-card__status ${isApproved ? 'request-card__status--approved' : ''}">${req.status}</span>
        </div>
        ${actionsHTML}
      `;

      if (!isApproved) {
        reqCard.querySelector(`.btn-approve-${req.id}`).addEventListener("click", () => approveRequest(req));
        reqCard.querySelector(`.btn-decline-${req.id}`).addEventListener("click", () => declineRequest(req.id));
      }

      incomingRequestsList.appendChild(reqCard);
    });
  }

  // OUTGOING REQUESTS
  outgoingRequestsList.innerHTML = '';
  if (outgoing.length === 0) {
    outgoingRequestsList.innerHTML = `<p style="font-size: 0.9rem; font-style: italic; color: var(--color-text-faint);">No sent requests yet.</p>`;
  } else {
    outgoing.forEach((req) => {
      const reqCard = document.createElement('div');
      reqCard.className = 'request-card';
      const isApproved = req.status === 'approved';

      let detailsHTML = '';
      if (isApproved) {
        detailsHTML = `
          <div class="request-card__shared-info">
            <p style="margin:0 0 6px 0; font-weight:600; color:var(--color-success);">Recipient Shared Contact Details:</p>
            <div class="request-card__info-item">
              <strong>Email</strong> <span>${req.recipientSharedEmail || 'Not Shared'}</span>
            </div>
            <div class="request-card__info-item">
              <strong>Phone</strong> <span>${req.recipientSharedPhone || 'Not Shared'}</span>
            </div>
          </div>
        `;
      } else {
        detailsHTML = `
          <button type="button" class="btn btn--outline btn--block btn-cancel-${req.id}" style="padding: 8px; font-size: 0.82rem;">Cancel Request</button>
        `;
      }

      reqCard.innerHTML = `
        <div class="request-card__header">
          <div>
            <p class="request-card__title">Sent to ${req.recipientName} (${req.recipientBranch}, ${req.recipientYear})</p>
            <p class="request-card__subtitle">Swap match: ${req.recipientCurrentHostel} → ${req.recipientDesiredHostel}</p>
          </div>
          <span class="request-card__status ${isApproved ? 'request-card__status--approved' : ''}">${req.status}</span>
        </div>
        ${detailsHTML}
      `;

      if (!isApproved) {
        reqCard.querySelector(`.btn-cancel-${req.id}`).addEventListener("click", () => declineRequest(req.id));
      }

      outgoingRequestsList.appendChild(reqCard);
    });
  }
}

async function approveRequest(req) {
  const shareEmailCheck = document.getElementById(`shareEmail-${req.id}`);
  const sharePhoneCheck = document.getElementById(`sharePhone-${req.id}`);

  const shareEmail = shareEmailCheck ? shareEmailCheck.checked : false;
  const sharePhone = sharePhoneCheck ? sharePhoneCheck.checked : false;

  try {
    const docRef = doc(db, "contactRequests", req.id);
    await updateDoc(docRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
      recipientSharedEmail: shareEmail ? (currentUserPrivateProfile.email || currentUser.email) : "Not Shared",
      recipientSharedPhone: sharePhone ? (currentUserPrivateProfile.phoneNumber || "Not Provided") : "Not Shared"
    });
    showToast("Contact request approved!", "success");
  } catch (err) {
    console.error(err);
    showToast("Approval failed: " + getFirestoreErrorMessage(err), "error");
  }
}

async function declineRequest(reqId) {
  if (!confirm("Are you sure you want to cancel or decline this request?")) return;
  try {
    await deleteDoc(doc(db, "contactRequests", reqId));
    showToast("Request removed.", "success");
  } catch (err) {
    console.error(err);
    showToast("Operation failed: " + getFirestoreErrorMessage(err), "error");
  }
}

// =========================================================
// 9. NAVBAR UX (hamburger, theme, scroll shadow, footer year)
// =========================================================
function setupHamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

function setupThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  if (!toggle) return;

  const applyTheme = (theme) => {
    root.classList.toggle('dark', theme === 'dark');
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  };

  let saved = null;
  try { saved = localStorage.getItem('khs-theme'); } catch (e) { /* storage unavailable */ }

  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  }

  toggle.addEventListener('click', () => {
    const isDark = root.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('khs-theme', next); } catch (e) { /* ignore */ }
  });
}

function setupNavbarScrollEffect() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 8 ? 'var(--shadow-sm)' : 'none';
  }, { passive: true });
}

function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// =========================================================
// 10. SYSTEM INIT (runs once — no duplicate listeners)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  populateHostelDropdowns();
  setupHamburgerMenu();
  setupThemeToggle();
  setFooterYear();
  setupNavbarScrollEffect();

  setupAuthToggles();
  setupAuthFormSubmit();
  setupGoogleSignIn();
  setupVerificationHandlers();
  setupProfileSubmit();
  setupProfileDelete();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateUIScreens();
    if (user && user.emailVerified) {
      await loadUserProfile();
    }
  });
});