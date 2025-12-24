// Load and update navigation based on config
(async function() {
  try {
    const response = await fetch(`${window.location.origin}/api/config/navigation`);
    const data = await response.json();

    if (data.success) {
      const navConfig = data.config;

      // Hide/show navigation tabs
      const navTabs = document.querySelectorAll('.nav-tabs a');

      navTabs.forEach(link => {
        const href = link.getAttribute('href');

        if (href === 'index.html' && navConfig.show_claims === false) {
          link.style.display = 'none';
        }
        if (href === 'packs.html' && navConfig.show_unpack === false) {
          link.style.display = 'none';
        }
        if (href === 'story.html' && navConfig.show_story === false) {
          link.style.display = 'none';
        }
      });
    }
  } catch (error) {
    console.error('Error loading navigation config:', error);
    // On error, show all tabs (failsafe)
  }
})();
