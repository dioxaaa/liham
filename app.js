import {
  addDoc,
  collection,
  db,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "./firebase.js";

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============ INTRO ANIMATION ============ */
  function playIntro() {
    const intro = $("#intro");
    const site = $("#site");
    let hasOpenedHomepage = false;

    const skip = () => {
      if (hasOpenedHomepage) return;
      hasOpenedHomepage = true;
      intro.classList.add("intro-hide");
      site.classList.remove("hidden");
      requestAnimationFrame(() => site.classList.add("site-reveal"));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skip();
      return;
    }
    // Duration of the handwriting animation + caption ~= 3.4s
    const introTimer = setTimeout(skip, 3400);
    // Allow anyone to tap/click through the intro
    intro.addEventListener("click", () => {
      clearTimeout(introTimer);
      skip();
    }, { once: true });
  }

  /* ============ LETTER STAGE ============ */
  const heroSection = $("#hero");
  const letterStage = $("#letter-stage");
  const letterForm = $("#letter-form");
  const quillButton = $("#quill-button");
  const letterClose = $("#letter-close");
  const sendToFutureBtn = $("#send-to-future");

  function openLetter() {
    letterStage.hidden = false;
    letterStage.querySelector(".letter-paper").style.animation = "none";
    // restart animation
    void letterStage.offsetWidth;
    letterStage.querySelector(".letter-paper").style.animation = "";
    $("#field-to").focus({ preventScroll: true });
  }

  function closeLetter() {
    letterStage.hidden = true;
  }

  quillButton.addEventListener("click", openLetter);
  letterClose.addEventListener("click", closeLetter);
  letterStage.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLetter();
  });

  /* ============ DELIVERY MODAL ============ */
  const deliveryModal = $("#delivery-modal");
  const deliveryForm = $("#delivery-form");
  const deliveryCancel = $("#delivery-cancel");
  const deliveryClose = $("#delivery-close");
  const emailInput = $("#field-email");
  const dateInput = $("#field-date");
  const timeInput = $("#field-time");
  const tzSelect = $("#field-timezone");
  const errorEmail = $("#error-email");
  const errorDate = $("#error-date");

  function populateTimezones() {
    const zones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [Intl.DateTimeFormat().resolvedOptions().timeZone];

    const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
    tzSelect.innerHTML = "";
    zones.forEach((zone) => {
      const opt = document.createElement("option");
      opt.value = zone;
      opt.textContent = zone.replace(/_/g, " ");
      if (zone === current) opt.selected = true;
      tzSelect.appendChild(opt);
    });
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function openDeliveryModal() {
    const to = $("#field-to").value.trim();
    const message = $("#field-message").value.trim();
    const from = $("#field-from").value.trim();

    if (!message) {
      $("#field-message").focus();
      $("#field-message").reportValidity?.();
      return;
    }

    if (!tzSelect.options.length) populateTimezones();
    dateInput.min = todayISO();
    deliveryModal.hidden = false;
    deliveryModal.setAttribute("aria-hidden", "false");
    emailInput.focus({ preventScroll: true });
  }

  function closeDeliveryModal() {
    deliveryModal.hidden = true;
    deliveryModal.setAttribute("aria-hidden", "true");
  }

  sendToFutureBtn.addEventListener("click", openDeliveryModal);
  deliveryCancel.addEventListener("click", closeDeliveryModal);
  deliveryClose.addEventListener("click", closeDeliveryModal);
  deliveryModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDeliveryModal();
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function zonedTimeToDate(dateString, timeString, timeZone) {
    const [year, month, day] = dateString.split("-").map(Number);
    const [hour, minute] = timeString.split(":").map(Number);
    const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(new Date(naiveUtc)).map((part) => [part.type, part.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    return new Date(naiveUtc - (asUtc - naiveUtc));
  }

  function validateDelivery() {
    let ok = true;
    errorEmail.hidden = true;
    errorDate.hidden = true;

    if (!EMAIL_RE.test(emailInput.value.trim())) {
      errorEmail.hidden = false;
      ok = false;
    }

    if (!dateInput.value || !timeInput.value) {
      errorDate.hidden = false;
      ok = false;
    } else {
      const chosen = zonedTimeToDate(dateInput.value, timeInput.value, tzSelect.value);
      if (chosen.getTime() <= Date.now()) {
        errorDate.hidden = false;
        ok = false;
      }
    }
    return ok;
  }

  /* ============ CONFIRMATION MODAL ============ */
  const confirmModal = $("#confirm-modal");
  const confirmDetail = $("#confirm-detail");
  const confirmClose = $("#confirm-close");

  function showConfirmation({ email, date, time, timezone }) {
    confirmDetail.textContent =
      `It will arrive at ${email} on ${date} around ${time} (${timezone}).`;
    closeDeliveryModal();
    confirmModal.hidden = false;
    confirmModal.setAttribute("aria-hidden", "false");
  }

  confirmClose.addEventListener("click", () => {
    confirmModal.hidden = true;
    confirmModal.setAttribute("aria-hidden", "true");
    closeDeliveryModal();
    closeLetter();
    letterForm.reset();
    deliveryForm.reset();
    $("#field-public").checked = false;
  });

  /* ============ SUBMIT ============ */
  deliveryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateDelivery()) return;

    const submitBtn = deliveryForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sealing…";

    const payload = {
      email: emailInput.value.trim(),
      to: $("#field-to").value.trim(),
      message: $("#field-message").value.trim(),
      from: $("#field-from").value.trim(),
      date: dateInput.value,
      time: timeInput.value,
      timezone: tzSelect.value,
      isPublic: $("#field-public").checked,
    };

    try {
      const scheduledAt = zonedTimeToDate(payload.date, payload.time, payload.timezone);
      if (scheduledAt.getTime() <= Date.now()) {
        errorDate.hidden = false;
        throw new Error("Delivery must be set in the future.");
      }

      await addDoc(collection(db, "letters"), {
        email: payload.email,
        to: payload.to,
        message: payload.message,
        from: payload.from,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        timezone: payload.timezone,
        status: "scheduled",
        isPublic: payload.isPublic,
        createdAt: serverTimestamp(),
      });

      showConfirmation(payload);
      loadPublicLetters(); // refresh in case this one is public
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong sealing your letter. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Seal the letter";
    }
  });

  /* ============ ANONYMOUS / PUBLIC LETTERS ============ */
  const scrollsGrid = $("#scrolls-grid");
  const scrollsEmpty = $("#scrolls-empty");
  const scrollModal = $("#scroll-modal");
  const scrollClose = $("#scroll-close");
  const scrollTitle = $("#scroll-title");
  const scrollMeta = $("#scroll-meta");

  async function loadPublicLetters() {
    try {
      const lettersSnapshot = await getDocs(query(
        collection(db, "letters"),
        where("isPublic", "==", true),
        where("status", "==", "sent"),
        orderBy("deliveredAt", "desc"),
        limit(60)
      ));
      const letters = lettersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          message: data.message,
          deliveredAt: data.deliveredAt?.toDate?.().toISOString() || null,
        };
      });

      $$(".scroll-item", scrollsGrid).forEach((el) => el.remove());

      if (!letters.length) {
        scrollsEmpty.hidden = false;
        return;
      }
      scrollsEmpty.hidden = true;

      letters.forEach((letter, i) => {
        const btn = document.createElement("button");
        btn.className = "scroll-item";
        btn.type = "button";
        btn.setAttribute("aria-label", "Unroll an anonymous letter");
        btn.innerHTML = `
          <span class="scroll-visual" aria-hidden="true"></span>
          <span class="scroll-caption">letter ${i + 1}</span>
        `;
        btn.addEventListener("click", () => openScroll(letter));
        scrollsGrid.appendChild(btn);
      });
    } catch (err) {
      console.error(err);
      // Fail quietly — the public wall is a nice-to-have, not core flow.
    }
  }

  function openScroll(letter) {
    scrollTitle.textContent = letter.message || "";
    const openedOn = letter.deliveredAt
      ? new Date(letter.deliveredAt).toLocaleDateString()
      : "";
    scrollMeta.textContent = openedOn ? `opened ${openedOn}` : "";
    scrollModal.hidden = false;
    scrollModal.setAttribute("aria-hidden", "false");
    scrollClose.focus();
  }

  scrollClose.addEventListener("click", () => {
    scrollModal.hidden = true;
    scrollModal.setAttribute("aria-hidden", "true");
  });
  scrollModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") scrollModal.hidden = true;
  });

  /* ============ INIT ============ */
  function initializeHomepage() {
    playIntro();
    populateTimezones();
    loadPublicLetters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeHomepage, { once: true });
  } else {
    initializeHomepage();
  }
})();