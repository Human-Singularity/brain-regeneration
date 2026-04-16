/* donor-transparency.js
 * Fetches recent donor data from the Cloudflare Worker and renders
 * it into the donation page transparency section.
 */
(function () {
	'use strict';

	var API_ENDPOINT = 'https://stripe-transparency.human-singularity.workers.dev/';

	var elLoading  = document.getElementById('donor-loading');
	var elError    = document.getElementById('donor-error');
	var elStats    = document.getElementById('donor-stats');
	var elListWrap = document.getElementById('donor-list-wrap');
	var elAllWrap  = document.getElementById('donor-all-wrap');

	if (!elLoading) return; // not on the donate page

	// ── Helpers ───────────────────────────────────────────────────────────────

	var CURRENCY_SYMBOLS = { eur: '€', usd: '$', gbp: '£', cad: 'CA$', aud: 'A$', chf: 'CHF\u00a0', sek: 'SEK\u00a0', nok: 'NOK\u00a0', dkk: 'DKK\u00a0' };

	function formatCurrency(amount, currency) {
		var code   = (currency || 'eur').toLowerCase();
		var symbol = CURRENCY_SYMBOLS[code] || currency.toUpperCase() + '\u00a0';
		var value  = parseFloat(amount).toFixed(2).replace(/\.00$/, '');
		return symbol + value;
	}

	function formatDate(iso) {
		return new Date(iso).toLocaleDateString('en-GB', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	function escHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g,  '&amp;')
			.replace(/</g,  '&lt;')
			.replace(/>/g,  '&gt;')
			.replace(/"/g,  '&quot;')
			.replace(/'/g,  '&#39;');
	}

	function buildRow(donor) {
		return '<tr>' +
			'<td>' + escHtml(donor.name) + '</td>' +
			'<td class="text-end donor-amount">' + escHtml(formatCurrency(donor.amount_paid, donor.currency)) + '</td>' +
			'<td class="text-end donor-date">'   + escHtml(formatDate(donor.charge_date))                     + '</td>' +
			'</tr>';
	}

	// ── Fetch & render ────────────────────────────────────────────────────────

	fetch(API_ENDPOINT)
		.then(function (res) {
			if (!res.ok) throw new Error('HTTP ' + res.status);
			return res.json();
		})
		.then(function (data) {
			elLoading.style.display = 'none';

			var year = data.current_year;

			// Stats banner
			var currencies    = year.currencies || [];
			var primaryCurr   = currencies.length === 1 ? currencies[0] : 'eur';
			var totalFormatted = currencies.length > 1
				? year.total_amount.toFixed(2) + ' (multiple currencies)'
				: formatCurrency(year.total_amount, primaryCurr);

			document.getElementById('stat-total-amount').textContent = totalFormatted;
			document.getElementById('stat-total-count').textContent  = year.total_donations;
			document.getElementById('stat-year').textContent         = year.year;
			elStats.style.display = '';

			// Goal progress bar (€500 / year)
			var GOAL = 500;
			var elGoal = document.getElementById('donor-goal');
			if (elGoal) {
				var pct = Math.min(Math.round((year.total_amount / GOAL) * 100), 100);
				document.getElementById('goal-pct').textContent  = pct;
				document.getElementById('goal-fill').style.width = pct + '%';
				elGoal.style.display = '';
			}

			// Recent donors table
			if (data.recent && data.recent.length > 0) {
				document.getElementById('donor-recent-body').innerHTML = data.recent.map(buildRow).join('');
				elListWrap.style.display = '';
			}

			// All donations this year (expandable)
			if (year.donations && year.donations.length > 0) {
				document.getElementById('donor-all-body').innerHTML = year.donations.map(buildRow).join('');
				// Only show the expandable section if there are more than the recent list
				if (year.donations.length > (data.recent ? data.recent.length : 0)) {
					elAllWrap.style.display = '';
				}
			}
		})
		.catch(function () {
			elLoading.style.display = 'none';
			elError.style.display   = '';
		});
}());
