/* subscribe.js — unified handler for every subscription form on the site.
 *
 * One POST→redirect flow and one br_subscriber_profile persistence, shared by
 * three form shapes:
 *   • form[data-inline-subscribe]  — contextual condition / research-area widgets
 *   • #subscribe-form              — full subscribe page (rich validation + spinner)
 *   • #homepage-subscribe-form     — homepage digest selector
 *
 * Each form carries data-api / data-thank-you / data-error. A server redirect
 * (opaqueredirect) or a 2xx is treated as success — client-side validation
 * already guards the payload, and the redirect target can't be read cross-origin.
 */
(function () {
	'use strict';

	var PROFILE_KEY = 'br_subscriber_profile';

	// ── Restore saved profile across every subscribe form on the page ─────────
	var savedProfile = localStorage.getItem(PROFILE_KEY);
	if (savedProfile) {
		document.querySelectorAll('select[name="profile"]').forEach(function (sel) {
			sel.value = savedProfile;
		});
	}

	function persistProfile(form) {
		var profileField = form.querySelector('select[name="profile"]');
		if (profileField && profileField.value) {
			localStorage.setItem(PROFILE_KEY, profileField.value);
		}
	}

	// ── Shared submit ─────────────────────────────────────────────────────────
	// POST the form, persist the profile, and route on the result. By default an
	// HTTP error or network failure redirects to data-error; callers can pass
	// hooks.onHttpError / hooks.onNetworkError to stay on-page instead.
	function submitForm(form, hooks) {
		hooks = hooks || {};
		persistProfile(form);
		var thankYouUrl = form.dataset.thankYou;
		var errorUrl    = form.dataset.error;

		fetch(form.dataset.api, {
			method: 'POST',
			body: new FormData(form),
			redirect: 'manual'
		})
		.then(function (response) {
			if (response.type === 'opaqueredirect' || response.ok) {
				window.location.href = thankYouUrl;
			} else {
				console.error('[subscribe] API returned HTTP', response.status, response.statusText);
				if (hooks.onHttpError) hooks.onHttpError(response);
				else window.location.href = errorUrl;
			}
		})
		.catch(function (err) {
			console.error('[subscribe] Network error:', err);
			if (hooks.onNetworkError) hooks.onNetworkError(err);
			else window.location.href = errorUrl;
		});
	}

	// ── 1. Contextual inline forms ────────────────────────────────────────────
	document.querySelectorAll('form[data-inline-subscribe]').forEach(function (form) {
		var submitBtn = form.querySelector('[type="submit"]');

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			if (!form.checkValidity()) {
				form.querySelectorAll(':invalid').forEach(function (el) { el.classList.add('is-invalid'); });
				return;
			}
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.textContent = 'Subscribing…';
			}
			submitForm(form);
		});

		form.querySelectorAll('input, select').forEach(function (el) {
			el.addEventListener('input', function () { el.classList.remove('is-invalid'); });
		});
	});

	// ── 2. Full subscribe page form ───────────────────────────────────────────
	var pageForm = document.getElementById('subscribe-form');
	if (pageForm) initSubscribePage(pageForm);

	function initSubscribePage(form) {
		var submitBtn = document.getElementById('subscribe-btn');
		var btnLabel  = document.getElementById('subscribe-btn-label');
		var spinner   = document.getElementById('subscribe-spinner');
		var formAlert = document.getElementById('form-alert');
		var listError = document.getElementById('list-error');

		function setLoading(on) {
			submitBtn.disabled = on;
			btnLabel.textContent = on ? 'Submitting…' : 'Subscribe';
			spinner.style.display = on ? 'inline-block' : 'none';
		}
		function showAlert(message) { formAlert.textContent = message; formAlert.style.display = 'block'; }
		function hideAlert() { formAlert.style.display = 'none'; }
		function atLeastOneList() { return form.querySelectorAll('input[name="list"]:checked').length > 0; }

		function validateForm() {
			var valid = true;
			form.querySelectorAll('[required]').forEach(function (field) {
				if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
				else { field.classList.remove('is-invalid'); }
			});
			var emailField = form.querySelector('#email');
			if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
				emailField.classList.add('is-invalid'); valid = false;
			}
			if (!atLeastOneList()) { listError.style.display = 'block'; valid = false; }
			else { listError.style.display = 'none'; }
			return valid;
		}

		// Real-time field feedback
		form.querySelectorAll('[required]').forEach(function (field) {
			field.addEventListener('blur', function () {
				if (!field.value.trim()) field.classList.add('is-invalid');
				else field.classList.remove('is-invalid');
			});
			field.addEventListener('input', function () {
				if (field.classList.contains('is-invalid') && field.value.trim()) field.classList.remove('is-invalid');
			});
		});

		form.querySelectorAll('input[name="list"]').forEach(function (cb) {
			cb.addEventListener('change', function () {
				cb.closest('.subscribe-list-item').classList.toggle('is-selected', cb.checked);
				if (atLeastOneList()) listError.style.display = 'none';
			});
		});

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			hideAlert();
			if (!validateForm()) return;
			setLoading(true);
			submitForm(form, {
				onNetworkError: function () {
					showAlert('Unable to submit the form. Please check your connection and try again.');
					setLoading(false);
				}
			});
		});
	}

	// ── 3. Homepage digest selector ───────────────────────────────────────────
	var homeForm = document.getElementById('homepage-subscribe-form');
	if (homeForm) initHomepage(homeForm);

	function initHomepage(form) {
		var btn = document.getElementById('homepage-subscribe-btn');
		var alert = document.getElementById('homepage-form-alert');

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			alert.style.display = 'none';

			var valid = true;
			form.querySelectorAll('[required]').forEach(function (field) {
				if (!field.value.trim()) valid = false;
			});
			if (!valid) {
				alert.textContent = 'Please fill in all required fields.';
				alert.style.display = 'block';
				return;
			}

			btn.disabled = true;
			btn.textContent = 'Submitting…';
			submitForm(form, {
				onNetworkError: function () {
					alert.textContent = 'Unable to submit. Please check your connection and try again.';
					alert.style.display = 'block';
					btn.disabled = false;
					btn.textContent = 'Subscribe';
				}
			});
		});
	}
})();
