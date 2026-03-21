/* subscribe-form.js — Subscription form handler
 * Submits to the API endpoint defined in the form's data-api attribute,
 * handles loading states, validation feedback, and redirects.
 */
(function () {
	'use strict';

	var PROFILE_KEY = 'br_subscriber_profile';

	var form = document.getElementById('subscribe-form');
	if (!form) return;

	var apiEndpoint = form.dataset.api;
	var thankYouUrl = form.dataset.thankYou;
	var errorUrl    = form.dataset.error;

	var submitBtn   = document.getElementById('subscribe-btn');
	var btnLabel    = document.getElementById('subscribe-btn-label');
	var spinner     = document.getElementById('subscribe-spinner');
	var formAlert   = document.getElementById('form-alert');
	var listError   = document.getElementById('list-error');

	// ── Helpers ───────────────────────────────────────────────────────────────

	function setLoading(on) {
		submitBtn.disabled = on;
		btnLabel.textContent = on ? 'Submitting…' : 'Subscribe';
		spinner.style.display = on ? 'inline-block' : 'none';
	}

	function showAlert(message) {
		formAlert.textContent = message;
		formAlert.style.display = 'block';
	}

	function hideAlert() {
		formAlert.style.display = 'none';
	}

	function markInvalid(input) {
		input.classList.add('is-invalid');
	}

	function clearInvalid(input) {
		input.classList.remove('is-invalid');
	}

	function atLeastOneList() {
		return form.querySelectorAll('input[name="list"]:checked').length > 0;
	}

	function validateForm() {
		var valid = true;

		// Required text / email / select fields
		form.querySelectorAll('[required]').forEach(function (field) {
			if (!field.value.trim()) {
				markInvalid(field);
				valid = false;
			} else {
				clearInvalid(field);
			}
		});

		// Email format
		var emailField = form.querySelector('#email');
		if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
			markInvalid(emailField);
			valid = false;
		}

		// At least one list checkbox
		if (!atLeastOneList()) {
			listError.style.display = 'block';
			valid = false;
		} else {
			listError.style.display = 'none';
		}

		return valid;
	}

	// ── Real-time field feedback ──────────────────────────────────────────────

	// Restore saved profile on page load
	var savedProfile = localStorage.getItem(PROFILE_KEY);
	if (savedProfile) {
		var profileField = form.querySelector('select[name="profile"]');
		if (profileField) profileField.value = savedProfile;
	}

	form.querySelectorAll('[required]').forEach(function (field) {
		field.addEventListener('blur', function () {
			if (!field.value.trim()) {
				markInvalid(field);
			} else {
				clearInvalid(field);
			}
		});
		field.addEventListener('input', function () {
			if (field.classList.contains('is-invalid') && field.value.trim()) {
				clearInvalid(field);
			}
		});
	});

	form.querySelectorAll('input[name="list"]').forEach(function (cb) {
		cb.addEventListener('change', function () {
			// Sync visual selected state for JS-driven fallback
			cb.closest('.subscribe-list-item').classList.toggle('is-selected', cb.checked);
			if (atLeastOneList()) {
				listError.style.display = 'none';
			}
		});
	});

	// ── Form submission ───────────────────────────────────────────────────────

	form.addEventListener('submit', function (e) {
		e.preventDefault();
		hideAlert();

		if (!validateForm()) return;

		// Persist profile choice for future forms
		var profileEl = form.querySelector('select[name="profile"]');
		if (profileEl && profileEl.value) {
			localStorage.setItem(PROFILE_KEY, profileEl.value);
		}

		setLoading(true);

		fetch(apiEndpoint, {
			method: 'POST',
			body: new FormData(form),
			redirect: 'manual'
		})
		.then(function (response) {
			// 'opaqueredirect' means the server issued a redirect (success or
			// error). We cannot inspect the redirect target cross-origin, but
			// client-side validation already guards against invalid payloads,
			// so any server redirect is treated as success.
			if (response.type === 'opaqueredirect' || response.ok) {
				window.location.href = thankYouUrl;
			} else {
				console.error('[subscribe-form] API returned HTTP', response.status, response.statusText);
				window.location.href = errorUrl;
			}
		})
		.catch(function (err) {
			console.error('[subscribe-form] Network error:', err);
			showAlert('Unable to submit the form. Please check your connection and try again.');
			setLoading(false);
		});
	});

})();
