/* subscribe-form.js — Subscription form handler
 * Submits to the API endpoint defined in the form's data-api attribute,
 * handles loading states, validation feedback, and redirects.
 */
(function () {
	'use strict';

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

		setLoading(true);

		fetch(apiEndpoint, {
			method: 'POST',
			body: new FormData(form),
			redirect: 'follow'
		})
		.then(function (response) {
			// The API redirects to /thank-you/ on success, /error/ on failure.
			// With redirect:'follow', response.redirected is true and
			// response.url carries the final destination URL.
			if (response.redirected) {
				var dest = response.url;
				if (dest.indexOf('/error') !== -1) {
					window.location.href = errorUrl;
				} else {
					window.location.href = thankYouUrl;
				}
			} else if (response.ok) {
				window.location.href = thankYouUrl;
			} else {
				window.location.href = errorUrl;
			}
		})
		.catch(function (err) {
			console.error('Subscription form error:', err);
			showAlert('Unable to submit the form. Please check your connection and try again.');
			setLoading(false);
		});
	});

})();
