/**
 * Test Module - Verifies module loader system works
 */

window.init_test_module = function(containerId, config = {}) {
  console.log(`✅ Test module initialized!`);
  console.log(`Container ID: ${containerId}`);
  console.log(`Config:`, config);

  const container = document.getElementById(containerId);

  // Update content with config
  const contentEl = container.querySelector('#test-content');
  contentEl.innerHTML = `
    <p style="color: var(--success);">✅ Module successfully initialized!</p>
    <p style="font-size: 0.9rem; color: var(--text-secondary);">
      Container: <code>${containerId}</code>
    </p>
    <p style="font-size: 0.9rem; color: var(--text-secondary);">
      Config: <code>${JSON.stringify(config)}</code>
    </p>
  `;

  // Add button click handler
  const button = container.querySelector('#test-button');
  const output = container.querySelector('#test-output');
  let clickCount = 0;

  button.addEventListener('click', () => {
    clickCount++;
    output.textContent = `Button clicked ${clickCount} time(s)! 🎉`;
    output.style.color = 'var(--success)';
  });

  // Test config value if provided
  if (config.test_message) {
    output.textContent = `Config message: "${config.test_message}"`;
    output.style.color = 'var(--primary)';
  }
};
