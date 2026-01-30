// Admin Custom Indexes Management
// Handles creating and managing multiple custom indexes with phases and content

let currentIndex = null;
let currentPhase = null;
let allIndexes = [];

// Load all indexes on page load
document.addEventListener('DOMContentLoaded', () => {
  loadIndexes();
});

// ==================== INDEX MANAGEMENT ====================

async function loadIndexes() {
  try {
    const response = await fetch('/api/admin/custom-indexes');
    const data = await response.json();

    if (data.success) {
      allIndexes = data.indexes;
      renderIndexes(data.indexes);
    } else {
      showError('Failed to load indexes');
    }
  } catch (error) {
    console.error('Error loading indexes:', error);
    showError('Error loading indexes: ' + error.message);
  }
}

function renderIndexes(indexes) {
  const grid = document.getElementById('indexesGrid');

  if (indexes.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <p style="font-size: 3rem; margin-bottom: 1rem;">📋</p>
        <p style="font-size: 1.25rem; color: rgba(255,255,255,0.7);">No indexes yet. Create your first one!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = indexes.map(index => `
    <div class="index-card ${!index.enabled ? 'disabled' : ''} ${index.is_system ? 'system' : ''}"
         onclick="showPhasesModal(${index.id})">
      <div class="index-header">
        <div>
          <span class="index-icon">${index.icon}</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="icon-btn" onclick="event.stopPropagation(); editIndex(${index.id})" title="Edit">
            ✏️
          </button>
          ${!index.is_system ? `
            <button class="icon-btn" onclick="event.stopPropagation(); deleteIndex(${index.id})" title="Delete" style="background: rgba(239, 68, 68, 0.2);">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>

      <div class="index-title">${index.title}</div>
      <div style="color: rgba(255,255,255,0.7); font-size: 0.875rem; margin-bottom: 1rem;">
        ${index.description || 'No description'}
      </div>

      <div class="index-meta">
        ${index.is_system ? '<span class="badge system">System</span>' : ''}
        <span class="badge ${index.enabled ? 'enabled' : 'disabled'}">
          ${index.enabled ? 'Enabled' : 'Disabled'}
        </span>
        ${index.nav_visible ? '<span class="badge enabled">In Nav</span>' : ''}
        <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #8b5cf6;">
          Order: ${index.display_order}
        </span>
      </div>
    </div>
  `).join('');
}

function showCreateIndexModal() {
  document.getElementById('modalTitle').textContent = 'Create New Index';
  document.getElementById('indexForm').reset();
  document.getElementById('indexId').value = '';
  document.getElementById('indexModal').classList.add('active');
}

function editIndex(id) {
  const index = allIndexes.find(i => i.id === id);
  if (!index) return;

  document.getElementById('modalTitle').textContent = 'Edit Index';
  document.getElementById('indexId').value = index.id;
  document.getElementById('indexName').value = index.name;
  document.getElementById('indexSlug').value = index.slug;
  document.getElementById('indexTitle').value = index.title;
  document.getElementById('indexDescription').value = index.description || '';
  document.getElementById('indexIcon').value = index.icon;
  document.getElementById('indexOrder').value = index.display_order;
  document.getElementById('indexEnabled').checked = index.enabled === 1;
  document.getElementById('indexNavVisible').checked = index.nav_visible === 1;

  document.getElementById('indexModal').classList.add('active');
}

function closeIndexModal() {
  document.getElementById('indexModal').classList.remove('active');
}

document.getElementById('indexForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('indexId').value;
  const data = {
    name: document.getElementById('indexName').value,
    slug: document.getElementById('indexSlug').value,
    title: document.getElementById('indexTitle').value,
    description: document.getElementById('indexDescription').value,
    icon: document.getElementById('indexIcon').value || '📖',
    display_order: parseInt(document.getElementById('indexOrder').value),
    enabled: document.getElementById('indexEnabled').checked ? 1 : 0,
    nav_visible: document.getElementById('indexNavVisible').checked ? 1 : 0
  };

  try {
    const url = id ? `/api/admin/custom-indexes/${id}` : '/api/admin/custom-indexes';
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(id ? 'Index updated successfully!' : 'Index created successfully!');
      closeIndexModal();
      loadIndexes();
    } else {
      showError(result.error || 'Failed to save index');
    }
  } catch (error) {
    console.error('Error saving index:', error);
    showError('Error saving index: ' + error.message);
  }
});

async function deleteIndex(id) {
  const index = allIndexes.find(i => i.id === id);
  if (!index) return;

  if (index.is_system) {
    showError('Cannot delete system index');
    return;
  }

  if (!confirm(`Are you sure you want to delete "${index.title}"? This will also delete all its phases and content.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/custom-indexes/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showSuccess('Index deleted successfully!');
      loadIndexes();
    } else {
      showError(result.error || 'Failed to delete index');
    }
  } catch (error) {
    console.error('Error deleting index:', error);
    showError('Error deleting index: ' + error.message);
  }
}

// ==================== PHASE MANAGEMENT ====================

async function showPhasesModal(indexId) {
  currentIndex = allIndexes.find(i => i.id === indexId);
  if (!currentIndex) return;

  document.getElementById('phasesModalTitle').textContent = `Manage Phases: ${currentIndex.title}`;
  document.getElementById('phasesModal').classList.add('active');

  await loadPhases(indexId);
}

function closePhasesModal() {
  document.getElementById('phasesModal').classList.remove('active');
  currentIndex = null;
}

async function loadPhases(indexId) {
  try {
    const response = await fetch(`/api/admin/custom-indexes/${indexId}/phases`);
    const data = await response.json();

    if (data.success) {
      renderPhases(data.phases);
    } else {
      showError('Failed to load phases');
    }
  } catch (error) {
    console.error('Error loading phases:', error);
    showError('Error loading phases: ' + error.message);
  }
}

function renderPhases(phases) {
  const container = document.getElementById('phasesContainer');

  if (phases.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.7);">
        <p>No phases yet. Add your first phase!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = phases.map(phase => `
    <div class="phase-item ${!phase.enabled ? 'disabled' : ''}">
      <div class="phase-info">
        <div class="phase-title">
          ${phase.phase_order}. ${phase.title}
          ${!phase.enabled ? '<span class="badge disabled" style="margin-left: 0.5rem;">Disabled</span>' : ''}
        </div>
        <div class="phase-subtitle">${phase.subtitle || 'No subtitle'}</div>
        <small style="color: rgba(255,255,255,0.5);">Slug: /${currentIndex.slug}/${phase.slug}</small>
      </div>
      <div class="phase-actions">
        <button class="icon-btn" onclick="editPhaseContent(${phase.id})" title="Edit Content">
          📝
        </button>
        <button class="icon-btn" onclick="editPhase(${phase.id})" title="Edit Phase">
          ✏️
        </button>
        <button class="icon-btn" onclick="deletePhase(${phase.id})" title="Delete Phase" style="background: rgba(239, 68, 68, 0.2);">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function showCreatePhaseModal() {
  if (!currentIndex) return;

  document.getElementById('phaseModalTitle').textContent = 'Create New Phase';
  document.getElementById('phaseForm').reset();
  document.getElementById('phaseId').value = '';
  document.getElementById('phaseIndexId').value = currentIndex.id;
  document.getElementById('phaseModal').classList.add('active');
}

async function editPhase(id) {
  try {
    const response = await fetch(`/api/admin/custom-indexes/${currentIndex.id}/phases`);
    const data = await response.json();

    if (data.success) {
      const phase = data.phases.find(p => p.id === id);
      if (!phase) return;

      document.getElementById('phaseModalTitle').textContent = 'Edit Phase';
      document.getElementById('phaseId').value = phase.id;
      document.getElementById('phaseIndexId').value = phase.index_id;
      document.getElementById('phaseSlug').value = phase.slug;
      document.getElementById('phaseOrder').value = phase.phase_order;
      document.getElementById('phaseTitle').value = phase.title;
      document.getElementById('phaseSubtitle').value = phase.subtitle || '';
      document.getElementById('phasePreview').value = phase.preview_text || '';
      document.getElementById('phaseEnabled').checked = phase.enabled === 1;

      document.getElementById('phaseModal').classList.add('active');
    }
  } catch (error) {
    console.error('Error loading phase:', error);
    showError('Error loading phase: ' + error.message);
  }
}

function closePhaseModal() {
  document.getElementById('phaseModal').classList.remove('active');
}

document.getElementById('phaseForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('phaseId').value;
  const indexId = document.getElementById('phaseIndexId').value;
  const data = {
    phase_order: parseInt(document.getElementById('phaseOrder').value),
    slug: document.getElementById('phaseSlug').value,
    title: document.getElementById('phaseTitle').value,
    subtitle: document.getElementById('phaseSubtitle').value,
    preview_text: document.getElementById('phasePreview').value,
    enabled: document.getElementById('phaseEnabled').checked ? 1 : 0
  };

  try {
    const url = id ? `/api/admin/custom-phases/${id}` : `/api/admin/custom-indexes/${indexId}/phases`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(id ? 'Phase updated successfully!' : 'Phase created successfully!');
      closePhaseModal();
      loadPhases(indexId);
    } else {
      showError(result.error || 'Failed to save phase');
    }
  } catch (error) {
    console.error('Error saving phase:', error);
    showError('Error saving phase: ' + error.message);
  }
});

async function deletePhase(id) {
  if (!confirm('Are you sure you want to delete this phase? This will also delete all its content.')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/custom-phases/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showSuccess('Phase deleted successfully!');
      loadPhases(currentIndex.id);
    } else {
      showError(result.error || 'Failed to delete phase');
    }
  } catch (error) {
    console.error('Error deleting phase:', error);
    showError('Error deleting phase: ' + error.message);
  }
}

// ==================== CONTENT MANAGEMENT ====================

async function editPhaseContent(phaseId) {
  try {
    const response = await fetch(`/api/admin/custom-indexes/${currentIndex.id}/phases`);
    const data = await response.json();

    if (data.success) {
      currentPhase = data.phases.find(p => p.id === phaseId);
      if (!currentPhase) return;

      document.getElementById('contentModalTitle').textContent = 'Edit Phase Content';
      document.getElementById('contentPhaseTitle').textContent = `${currentPhase.title} - Add modules and content blocks`;
      document.getElementById('contentModal').classList.add('active');

      await loadPhaseContent(phaseId);
    }
  } catch (error) {
    console.error('Error loading phase content:', error);
    showError('Error loading phase content: ' + error.message);
  }
}

function closeContentModal() {
  document.getElementById('contentModal').classList.remove('active');
  currentPhase = null;
}

async function loadPhaseContent(phaseId) {
  try {
    const response = await fetch(`/api/admin/custom-phases/${phaseId}/content`);
    const data = await response.json();

    if (data.success) {
      renderPhaseContent(data.content);
    } else {
      showError('Failed to load phase content');
    }
  } catch (error) {
    console.error('Error loading phase content:', error);
    showError('Error loading phase content: ' + error.message);
  }
}

function renderPhaseContent(content) {
  const container = document.getElementById('contentBlocksContainer');

  if (content.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.7);">
        <p>No content blocks yet. Add your first one!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = content.map(block => `
    <div class="content-block">
      <div>
        <span class="module-type">${block.module_type}</span>
        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem;">
          Order: ${block.content_order}
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="icon-btn" onclick='editContentBlock(${JSON.stringify(block).replace(/'/g, "&apos;")})' title="Edit">
          ✏️
        </button>
        <button class="icon-btn" onclick="deleteContentBlock(${block.id})" title="Delete" style="background: rgba(239, 68, 68, 0.2);">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function showAddContentModal() {
  if (!currentPhase) return;

  document.getElementById('addContentModalTitle').textContent = 'Add Content Block';
  document.getElementById('contentForm').reset();
  document.getElementById('contentId').value = '';
  document.getElementById('contentPhaseId').value = currentPhase.id;
  document.getElementById('addContentModal').classList.add('active');
}

function editContentBlock(block) {
  document.getElementById('addContentModalTitle').textContent = 'Edit Content Block';
  document.getElementById('contentId').value = block.id;
  document.getElementById('contentPhaseId').value = block.phase_id;
  document.getElementById('moduleType').value = block.module_type;
  document.getElementById('moduleConfig').value = JSON.stringify(block.module_config, null, 2);
  document.getElementById('contentOrder').value = block.content_order;
  document.getElementById('addContentModal').classList.add('active');
}

function closeAddContentModal() {
  document.getElementById('addContentModal').classList.remove('active');
}

document.getElementById('contentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('contentId').value;
  const phaseId = document.getElementById('contentPhaseId').value;

  // Validate JSON
  let config;
  try {
    config = JSON.parse(document.getElementById('moduleConfig').value);
  } catch (error) {
    showError('Invalid JSON configuration: ' + error.message);
    return;
  }

  const data = {
    content_order: parseInt(document.getElementById('contentOrder').value),
    module_type: document.getElementById('moduleType').value,
    module_config: config
  };

  try {
    const url = id ? `/api/admin/custom-phase-content/${id}` : `/api/admin/custom-phases/${phaseId}/content`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(id ? 'Content block updated!' : 'Content block added!');
      closeAddContentModal();
      loadPhaseContent(phaseId);
    } else {
      showError(result.error || 'Failed to save content block');
    }
  } catch (error) {
    console.error('Error saving content block:', error);
    showError('Error saving content block: ' + error.message);
  }
});

async function deleteContentBlock(id) {
  if (!confirm('Are you sure you want to delete this content block?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/custom-phase-content/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showSuccess('Content block deleted!');
      loadPhaseContent(currentPhase.id);
    } else {
      showError(result.error || 'Failed to delete content block');
    }
  } catch (error) {
    console.error('Error deleting content block:', error);
    showError('Error deleting content block: ' + error.message);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function showSuccess(message) {
  alert('✅ ' + message);
}

function showError(message) {
  alert('❌ ' + message);
}
