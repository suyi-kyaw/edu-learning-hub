// Smooth scroll helper for story lesson navigation links
document.addEventListener("click", (e) => {
  const link = e.target.closest('.lesson-navigation a[href^="#"]');
  if (link) {
    const targetId = link.getAttribute('href');
    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      e.preventDefault();
      const rect = targetEl.getBoundingClientRect();
      const stickyOffset = window.innerWidth <= 768 ? 120 : 135;
      const targetScroll = window.pageYOffset + rect.top - stickyOffset;
      window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }
});
