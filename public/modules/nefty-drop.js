window.init_nefty_drop = function(containerId, config = {}) {
  const container = document.getElementById(containerId);
  const embedContainer = container.querySelector('.nefty-drop-embed');
  
  const collection = config.collection || 'futuresrelic';
  const dropId = config.drop_id || '';
  const limit = config.limit || '1';
  
  if (!dropId) {
    embedContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No drop ID configured. Add drop_id to module config.</p>';
    return;
  }
  
  // Create NeftyBlocks drop embed
  const dropEmbed = document.createElement('neftyblocks-drops');
  dropEmbed.setAttribute('collection', collection);
  dropEmbed.setAttribute('limit', limit);
  
  const options = {
    ids: dropId.toString()
  };
  dropEmbed.setAttribute('options', JSON.stringify(options));
  
  embedContainer.appendChild(dropEmbed);
  
  console.log(`✅ NeftyBlocks Drop initialized: ${collection} - Drop #${dropId}`);
};
