/**
 * news-single.js
 * Interactive behaviours for the news/single.html template:
 *   1. Reading progress bar
 *   2. Sticky TOC with IntersectionObserver active state
 *   3. Smooth-scroll on TOC click
 *   4. Copy button on code blocks
 *   5. Click-to-zoom lightbox (keyboard-accessible, focus-trapped)
 */
(function () {
	'use strict';

	/* ── 1. Reading progress ─────────────────────────────────── */
	var progressBar = document.querySelector('.progress__bar');
	if (progressBar) {
		var rafPending = false;
		function updateProgress() {
			var docHeight = document.documentElement.scrollHeight - window.innerHeight;
			if (docHeight > 0) {
				progressBar.style.width = ((window.scrollY / docHeight) * 100).toFixed(2) + '%';
			}
			rafPending = false;
		}
		window.addEventListener('scroll', function () {
			if (!rafPending) {
				rafPending = true;
				requestAnimationFrame(updateProgress);
			}
		}, { passive: true });
		updateProgress();
	}

	/* ── 2. Build TOC from article H2s ──────────────────────── */
	var tocList = document.getElementById('js-toc-list');
	var headings = document.querySelectorAll('.b-col h2[id]');

	if (tocList && headings.length) {
		headings.forEach(function (h, i) {
			var li = document.createElement('li');
			li.className = 'toc__item';
			li.dataset.target = h.id;
			li.setAttribute('tabindex', '0');
			li.setAttribute('role', 'button');
			li.setAttribute('aria-current', 'false');
			li.textContent = h.textContent.replace(/\s*#\s*$/, '');
			if (i === 0) { li.classList.add('toc__item--active'); li.setAttribute('aria-current', 'location'); }
			tocList.appendChild(li);
		});
	}

	/* ── 3. TOC: IntersectionObserver active state ───────────── */
	var tocItems = document.querySelectorAll('.toc__item');
	headings = document.querySelectorAll('.b-col h2[id]');

	if (tocItems.length && headings.length) {
		var activeHeadingId = null;
		var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		var observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					activeHeadingId = entry.target.id;
					updateTOC(activeHeadingId);
				}
			});
		}, { rootMargin: '-80px 0px -65% 0px' });

		headings.forEach(function (h) { observer.observe(h); });

		function updateTOC(id) {
			tocItems.forEach(function (item) {
				var isActive = item.dataset.target === id;
				item.classList.toggle('toc__item--active', isActive);
				item.setAttribute('aria-current', isActive ? 'location' : 'false');
			});
		}

		/* ── 3. Smooth scroll on TOC click ── */
		function scrollToHeading(target) {
			var nav = document.querySelector('.site-nav');
			var offset = (nav ? nav.offsetHeight : 56) + 8;
			var top = target.getBoundingClientRect().top + window.scrollY - offset;
			window.scrollTo({ top: top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
			/* Correct for layout shifts from images that load during scroll */
			if (document.readyState !== 'complete') {
				window.addEventListener('load', function () {
					var corrected = target.getBoundingClientRect().top + window.scrollY - offset;
					if (Math.abs(window.scrollY - corrected) > 4) {
						window.scrollTo({ top: corrected, behavior: 'auto' });
					}
				}, { once: true });
			}
		}

		tocItems.forEach(function (item) {
			item.addEventListener('click', function () {
				var targetId = item.dataset.target;
				var target = targetId ? document.getElementById(targetId) : null;
				if (target) { scrollToHeading(target); }
			});
			/* Keyboard: activate on Enter/Space */
			item.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					item.click();
				}
			});
		});
	}

	/* ── 4. Copy button on code blocks ───────────────────────── */
	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext) {
			return navigator.clipboard.writeText(text);
		}
		// Older browsers / non-https: copy through a temporary textarea.
		return new Promise(function (resolve, reject) {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			var ok = false;
			try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
			document.body.removeChild(ta);
			if (ok) { resolve(); } else { reject(new Error('copy failed')); }
		});
	}

	var copyStatus = null;
	function announce(message) {
		if (!copyStatus) {
			copyStatus = document.createElement('span');
			copyStatus.className = 'visually-hidden';
			copyStatus.setAttribute('role', 'status');
			document.body.appendChild(copyStatus);
		}
		copyStatus.textContent = '';
		setTimeout(function () { copyStatus.textContent = message; }, 50);
	}

	document.querySelectorAll('.b-col pre').forEach(function (pre) {
		// The button sits next to the <pre>, never inside it, so it is never part of the copied text.
		var block = pre.parentElement;
		if (!block.classList.contains('highlight')) {
			block = document.createElement('div');
			pre.parentNode.insertBefore(block, pre);
			block.appendChild(pre);
		}
		block.classList.add('code-block');

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'code-copy';
		btn.textContent = 'Copy';
		btn.setAttribute('aria-label', 'Copy code to clipboard');
		var resetTimer = null;

		btn.addEventListener('click', function () {
			var code = pre.querySelector('code') || pre;
			copyText(code.textContent.replace(/\n$/, '')).then(function () {
				btn.textContent = 'Copied';
				btn.classList.add('is-copied');
				announce('Code copied to clipboard');
			}, function () {
				btn.textContent = 'Copy failed';
				announce('Copy failed. Select the code and copy it manually.');
			});
			clearTimeout(resetTimer);
			resetTimer = setTimeout(function () {
				btn.textContent = 'Copy';
				btn.classList.remove('is-copied');
			}, 2000);
		});

		block.appendChild(btn);
	});

	/* ── 5. Lightbox ─────────────────────────────────────────── */
	var lightbox = document.getElementById('js-lightbox');
	if (!lightbox) { return; }

	var lbImg     = lightbox.querySelector('.js-lightbox-img');
	var lbCaption = lightbox.querySelector('.lightbox__caption');
	var lbClose   = lightbox.querySelector('.lightbox__close');
	var lastFocus = null;
	var prefersReducedMotion2 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function openLightbox(src, caption) {
		lastFocus = document.activeElement;
		lbImg.src = src;
		lbImg.alt = caption || '';
		if (lbCaption) { lbCaption.textContent = caption || ''; }
		lightbox.classList.add('open');
		lightbox.removeAttribute('aria-hidden');
		if (lbClose) { lbClose.focus(); }
		document.body.style.overflow = 'hidden';
	}

	function closeLightbox() {
		lightbox.classList.remove('open');
		lightbox.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = '';
		if (lastFocus) { lastFocus.focus(); }
	}

	/* Delegated click on .zoomable elements */
	document.addEventListener('click', function (e) {
		var zoomable = e.target.closest('.zoomable');
		var control  = e.target.closest('a, button');
		// A zoomable that is itself a button (body images) opens; other controls inside a zoomable don't.
		if (zoomable && (!control || control === zoomable)) {
			var src     = zoomable.dataset.lightboxSrc || (zoomable.querySelector('img') && zoomable.querySelector('img').src) || '';
			var caption = zoomable.dataset.lightboxCaption || (zoomable.querySelector('.caption__text') && zoomable.querySelector('.caption__text').textContent) || '';
			if (src) { openLightbox(src, caption); }
		}
	});

	/* Close on backdrop click */
	lightbox.addEventListener('click', function (e) {
		if (e.target === lightbox) { closeLightbox(); }
	});

	/* Close button */
	if (lbClose) {
		lbClose.addEventListener('click', closeLightbox);
	}

	/* Close on ESC; arrow keys navigate between figures */
	document.addEventListener('keydown', function (e) {
		if (!lightbox.classList.contains('open')) { return; }
		if (e.key === 'Escape') { closeLightbox(); }
	});

	/* Focus trap inside lightbox */
	lightbox.addEventListener('keydown', function (e) {
		if (e.key !== 'Tab') { return; }
		var focusable = Array.from(lightbox.querySelectorAll('button, [tabindex="0"]')).filter(function (el) {
			return !el.disabled && el.offsetParent !== null;
		});
		if (!focusable.length) { e.preventDefault(); return; }
		var first = focusable[0];
		var last  = focusable[focusable.length - 1];
		if (e.shiftKey) {
			if (document.activeElement === first) { e.preventDefault(); last.focus(); }
		} else {
			if (document.activeElement === last) { e.preventDefault(); first.focus(); }
		}
	});

	if (prefersReducedMotion2) {
		lightbox.style.transition = 'none';
	}
})();
