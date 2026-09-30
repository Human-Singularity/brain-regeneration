/* Press timeline: toggle newest-first / oldest-first. No-ops unless #press-timeline exists. */
(function () {
	var timeline = document.getElementById('press-timeline');
	var toggle = document.getElementById('press-order');
	if (!timeline || !toggle) return;

	var KEY = 'br_press_order';
	toggle.hidden = false;
	var buttons = toggle.querySelectorAll('button[data-order]');
	var current = 'newest';

	function reverseChildren(parent, selector) {
		var nodes = Array.prototype.slice.call(parent.children).filter(function (el) { return el.matches(selector); });
		nodes.reverse().forEach(function (el) { parent.appendChild(el); });
	}

	function apply(order) {
		if (order === current) return;
		current = order;
		reverseChildren(timeline, '.press-year');
		timeline.querySelectorAll('.press-year').forEach(function (year) {
			reverseChildren(year, '.press-item, .press-milestone');
		});
		buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.order === order)); });
		try { localStorage.setItem(KEY, order); } catch (e) {}
	}

	buttons.forEach(function (b) {
		b.addEventListener('click', function () { apply(b.dataset.order); });
	});

	try {
		if (localStorage.getItem(KEY) === 'oldest') apply('oldest');
	} catch (e) {}
})();
