/* labs-embed.js — "Research groups working on {condition}" block on condition and
 * research-area pages. Calls /labs/?subject_id={id}&ordering=-articles, shows the top
 * 5 with that subject's paper counts and links to the filtered directory. The block
 * stays hidden unless the API returns at least one group (e.g. Parkinson's has none).
 */
(function () {
	'use strict';

	var mount = document.getElementById('labs-embed');
	if (!mount || !window.BR || !BR.labs) return;

	var L = BR.labs, t = L.t, escHtml = BR.escHtml;
	var cfg = L.readConfig(mount);
	var subjectId = mount.getAttribute('data-subject-id') || '';
	var condition = mount.getAttribute('data-condition') || 'this condition';
	var SHOWN = 5;
	if (!/^\d+$/.test(subjectId)) return;

	var url = cfg.apiBase + '/labs/?subject_id=' + subjectId + '&ordering=-articles&format=json';

	L.getJson(url).then(function (data) {
		var count = data.count || 0, labs = (data.results || []).slice(0, SHOWN);
		if (!count || !labs.length) return; // nothing to show: stay hidden

		var lede = count > SHOWN
			? L.num(count) + ' groups have published on ' + condition + '. These ' + SHOWN + ' have the most papers.'
			: L.num(count) + ' ' + L.plural(count, 'group has', 'groups have') + ' published on ' + condition + '.';
		document.getElementById('labs-embed-lede').textContent = lede;
		document.getElementById('labs-embed-all').textContent = 'See all ' + L.num(count) + ' ' + L.plural(count, 'group', 'groups') + ' →';

		document.getElementById('labs-embed-list').innerHTML = labs.map(function (lab) {
			var s = (lab.subjects || []).filter(function (x) { return String(x.id) === subjectId; })[0] || {};
			var place = L.placeText(lab);
			return '<li class="labs-embed__row">' +
				'<div class="labs-embed__who"><a href="' + escHtml(L.labHref(cfg, lab)) + '">' + t(lab.name) + '</a>' + L.curatorBadge(cfg, lab) +
				(place ? '<span>' + t(place) + '</span>' : '') + '</div>' +
				'<div class="labs-embed__nums"><span><strong>' + L.num(s.articles) + '</strong> papers</span>' +
				'<span><strong>' + L.num(s.recent_articles) + '</strong> since 2022</span></div></li>';
		}).join('');
		mount.hidden = false;
	}).catch(function () { /* keep the block hidden */ });
})();
