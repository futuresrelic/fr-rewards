// Menu Loader - Handles hamburger menu functionality
(function() {
  'use strict';

  // Load menu items from API and render them
  async function loadMenu() {
    try {
      const response = await fetch('/api/config/menu');
      const menuItems = await response.json();

      const menuContainer = document.getElementById('menuItems');
      if (!menuContainer) return;

      // Sort by order and filter enabled items
      const enabledItems = menuItems
        .filter(item => item.enabled)
        .sort((a, b) => a.order - b.order);

      // Render menu items
      menuContainer.innerHTML = enabledItems.map(item => `
        <a href="${item.url}" class="menu-item">
          <span class="icon">${item.icon || '📄'}</span>
          <span class="label">${item.label}</span>
        </a>
      `).join('');

    } catch (error) {
      console.error('Failed to load menu:', error);
      // Fallback to default menu if API fails
      renderDefaultMenu();
    }
  }

  // Render default menu items if API fails
  function renderDefaultMenu() {
    const menuContainer = document.getElementById('menuItems');
    if (!menuContainer) return;

    const defaultItems = [
      { label: 'Claims', url: '/index.html', icon: '🎁' },
      { label: 'Story', url: '/story.html', icon: '📖' },
      { label: 'User Guide', url: '/user-guide.html', icon: '📚' },
      { label: 'Download App', url: '/manifest.json', icon: '📱' },
      { label: 'About', url: '/about.html', icon: 'ℹ️' }
    ];

    menuContainer.innerHTML = defaultItems.map(item => `
      <a href="${item.url}" class="menu-item">
        <span class="icon">${item.icon}</span>
        <span class="label">${item.label}</span>
      </a>
    `).join('');
  }

  // Setup menu toggle functionality
  function setupMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const appMenu = document.getElementById('appMenu');
    const menuOverlay = document.getElementById('menuOverlay');

    if (!menuToggle || !appMenu || !menuOverlay) return;

    // Toggle menu open/close
    function toggleMenu() {
      menuToggle.classList.toggle('active');
      appMenu.classList.toggle('open');
      menuOverlay.classList.toggle('active');

      // Prevent body scroll when menu is open
      if (appMenu.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    // Close menu
    function closeMenu() {
      menuToggle.classList.remove('active');
      appMenu.classList.remove('open');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Event listeners
    menuToggle.addEventListener('click', toggleMenu);
    menuOverlay.addEventListener('click', closeMenu);

    // Close menu when clicking a menu item
    appMenu.addEventListener('click', (e) => {
      if (e.target.classList.contains('menu-item')) {
        closeMenu();
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && appMenu.classList.contains('open')) {
        closeMenu();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadMenu();
      setupMenuToggle();
    });
  } else {
    loadMenu();
    setupMenuToggle();
  }
})();
