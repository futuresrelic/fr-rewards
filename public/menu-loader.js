// Menu Loader - Handles hamburger menu functionality
(function() {
  'use strict';

  // Store the deferred install prompt
  let deferredPrompt = null;

  // Capture the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA install prompt captured');
  });

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
      menuContainer.innerHTML = enabledItems.map(item => {
        const isPWAInstall = item.url === '/manifest.json' || item.label === 'Download App';
        return `
          <a href="${item.url}" class="menu-item" ${isPWAInstall ? 'data-pwa-install="true"' : ''}>
            <span class="icon">${item.icon || '📄'}</span>
            <span class="label">${item.label}</span>
          </a>
        `;
      }).join('');

      // Setup PWA install handler after rendering
      setupPWAInstallHandler();

    } catch (error) {
      console.error('Failed to load menu:', error);
      // Fallback to default menu if API fails
      renderDefaultMenu();
    }
  }

  // Handle PWA install button clicks
  function setupPWAInstallHandler() {
    const pwaInstallButtons = document.querySelectorAll('[data-pwa-install="true"]');

    pwaInstallButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!deferredPrompt) {
          alert('App is already installed or not available for installation on this device.');
          return;
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        // Clear the prompt as it can only be used once
        deferredPrompt = null;
      });
    });
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

    menuContainer.innerHTML = defaultItems.map(item => {
      const isPWAInstall = item.url === '/manifest.json' || item.label === 'Download App';
      return `
        <a href="${item.url}" class="menu-item" ${isPWAInstall ? 'data-pwa-install="true"' : ''}>
          <span class="icon">${item.icon}</span>
          <span class="label">${item.label}</span>
        </a>
      `;
    }).join('');

    // Setup PWA install handler after rendering
    setupPWAInstallHandler();
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
