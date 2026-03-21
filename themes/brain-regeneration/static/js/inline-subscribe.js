/* inline-subscribe.js — Direct API submission for contextual subscribe widgets
 * Handles all forms with [data-inline-subscribe] on research area and
 * clinical trial pages. Submits via fetch, then redirects on result.
 */
(function () {
	'use strict';

	document.querySelectorAll('form[data-inline-subscribe]').forEach(function (form) {
		var apiEndpoint = form.dataset.api;
		var thankYouUrl = form.dataset.thankYou;
		var errorUrl    = form.dataset.error;
		var submitBtn   = form.querySelector('[type="submit"]');

		form.addEventListener('submit', function (e) {
			e.preventDefault();

			// Basic HTML5 validation
			if (!form.checkValidity()) {
				form.querySelectorAll(':invalid').forEach(function (el) {
					el.classList.add('is-invalid');
				});
				return;
			}

			// Loading state
			submitBtn.disabled = true;
			var originalLabel = submitBtn.textContent;
			submitBtn.textContent = 'Subscribing…';

			fetch(apiEndpoint, {
				method: 'POST',
				body: new FormData(form),
				redirect: 'follow'
			})
			.then(function (response) {
				if (response.redirected) {
					window.location.href = response.url.indexOf('/error') !== -1
						? errorUrl
						: thankYouUrl;
				} else if (response.ok) {
					window.location.href = thankYouUrl;
				} else {
					window.location.href = errorUrl;
				}
			})
			.catch(function () {
				window.location.href = errorUrl;
			});
		});

		// Clear invalid state on input
		form.querySelectorAll('input, select').forEach(function (el) {
			el.addEventListener('input', function () {
				el.classList.remove('is-invalid');
			});
		});
	});
})();
