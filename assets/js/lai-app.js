// L.A.I. STUDIO NEXUS — Logica Applicativa PWA v3.1.0

// Stato globale in memoria
let state = {
  nexusUrl: localStorage.getItem('lai_nexus_url') || 'https://lai-nexus-v31.geom-corvino.workers.dev',
  nodeUrl: localStorage.getItem('lai_node_url') || 'http://127.0.0.1:5000',
  jwtToken: localStorage.getItem('lai_jwt_token') || null,
  tenantId: localStorage.getItem('lai_tenant_id') || null,
  ruolo: localStorage.getItem('lai_ruolo') || null,
  activeTab: 'dashboard'
};

// Inizializzazione al caricamento
document.addEventListener('DOMContentLoaded', () => {
  // Inizializza i campi di input nelle Impostazioni con i valori correnti
  const nexusInput = document.getElementById('setting-nexus-url');
  const nodeInput = document.getElementById('setting-node-url');
  if (nexusInput) nexusInput.value = state.nexusUrl;
  if (nodeInput) nodeInput.value = state.nodeUrl;

  // Aggiorna l'interfaccia di autenticazione
  updateAuthUI();

  // Avvia il caricamento iniziale e nascondi il loader con effetto premium
  setTimeout(() => {
    const loader = document.getElementById('loader');
    const app = document.getElementById('app');
    if (loader) loader.classList.add('hidden');
    if (app) {
      app.style.display = 'block';
      app.classList.add('animate-fade-in');
    }
  }, 1200);

  // Esegui i controlli iniziali e avvia il polling
  checkNodeStatus();
  checkNexusStatus();
  
  // Polling periodico
  setInterval(checkNodeStatus, 10000);  // Ogni 10 secondi per il nodo locale
  setInterval(checkNexusStatus, 30000); // Ogni 30 secondi per il Cloudflare Worker
});

// Gestione della navigazione (Tab Switcher)
function showSection(sectionId) {
  state.activeTab = sectionId;
  
  // Gestione visibilità dei contenuti dei tab
  const tabs = ['dashboard', 'tasks', 'ai', 'settings'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) {
      if (t === sectionId) {
        el.style.display = 'block';
        el.classList.add('animate-fade-in');
      } else {
        el.style.display = 'none';
      }
    }
  });

  // Aggiorna lo stato attivo nel menu bottom
  const navItems = document.querySelectorAll('.nav-bottom .nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    // Trova l'elemento cliccato basandosi sulla funzione onclick
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${sectionId}'`)) {
      item.classList.add('active');
    }
  });
}

// Verifica dello stato del Nodo Locale
async function checkNodeStatus() {
  const nodeStatusBadge = document.getElementById('nodeStatus');
  const statusText = document.getElementById('statusText');
  const nodeInfoBox = document.getElementById('nodeInfo');
  
  // Elementi metriche dashboard
  const metricUptime = document.getElementById('metricUptime');
  const metricVersion = document.getElementById('metricVersion');
  const metricNodes = document.getElementById('metricNodes');

  try {
    const nodeUrl = document.getElementById('setting-node-url')?.value.trim() || state.nodeUrl;
    // Salva l'URL aggiornato se inserito
    if (nodeUrl !== state.nodeUrl) {
      state.nodeUrl = nodeUrl;
      localStorage.setItem('lai_node_url', nodeUrl);
    }

    const resp = await fetch(`${state.nodeUrl}/health`, { method: 'GET' });
    if (resp.ok) {
      const data = await resp.json();
      
      // Nodo Online
      if (nodeStatusBadge) {
        nodeStatusBadge.className = 'status-badge online';
        if (statusText) statusText.textContent = `NODO ATTIVO: ${data.node_id.toUpperCase()}`;
      }
      
      if (metricVersion) metricVersion.textContent = data.version || '3.1.0';
      if (metricNodes && (!state.jwtToken)) metricNodes.textContent = '1'; // Fallback se non siamo connessi al cloud

      // Uptime simulato dal timestamp o formattato
      if (metricUptime) {
        const uptimeStr = calculateUptime(data.timestamp);
        metricUptime.textContent = uptimeStr;
      }

      if (nodeInfoBox) {
        nodeInfoBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>ID Nodo:</span><span style="color:var(--lai-primary); font-weight:bold;">${data.node_id}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>Versione:</span><span>${data.version}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>Server Endpoint:</span><span>${state.nodeUrl}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Ultima Risposta:</span><span>${new Date().toLocaleTimeString()}</span>
          </div>
        `;
      }
    } else {
      throw new Error("Risposta non valida");
    }
  } catch (e) {
    // Nodo Offline
    if (nodeStatusBadge) {
      nodeStatusBadge.className = 'status-badge offline';
      if (statusText) statusText.textContent = 'NODO OFFLINE';
    }
    if (metricNodes && (!state.jwtToken)) metricNodes.textContent = '0';
    if (metricUptime) metricUptime.textContent = '--';
    
    if (nodeInfoBox) {
      nodeInfoBox.innerHTML = `
        <div style="color:var(--lai-error); text-align:center; padding: var(--space-xs) 0;">
          Impossibile connettersi al nodo locale.<br>
          Assicurati che <span style="font-family:var(--font-mono)">AVVIA_LAI.bat</span> sia in esecuzione su ${state.nodeUrl}.
        </div>
      `;
    }
  }
}

// Verifica dello stato del Nexus (Cloudflare Worker)
async function checkNexusStatus() {
  const metricNodes = document.getElementById('metricNodes');
  const metricTasks = document.getElementById('metricTasks');
  const auditPreview = document.getElementById('auditPreview');
  const tasksList = document.getElementById('tasks-list');

  // Aggiorna l'URL del Nexus dalle impostazioni se necessario
  const nexusUrl = document.getElementById('setting-nexus-url')?.value.trim() || state.nexusUrl;
  if (nexusUrl !== state.nexusUrl) {
    state.nexusUrl = nexusUrl;
    localStorage.setItem('lai_nexus_url', nexusUrl);
  }

  if (!state.jwtToken) {
    if (auditPreview) auditPreview.innerHTML = '<div style="color:var(--lai-text-muted);">Esegui il login in Impostazioni per visualizzare la catena di Audit.</div>';
    return;
  }

  try {
    // 1. Recupero stato Nodi dal Nexus
    const statusResp = await fetch(`${state.nexusUrl}/status`, {
      headers: { 'Authorization': `Bearer ${state.jwtToken}` }
    });
    if (statusResp.ok) {
      const data = await statusResp.json();
      const onlineNodes = data.nodes ? data.nodes.filter(n => n.status === 'online').length : 0;
      if (metricNodes) metricNodes.textContent = onlineNodes;
    }

    // 2. Recupero Audit Chain dal Nexus
    const auditResp = await fetch(`${state.nexusUrl}/audit/chain`, {
      headers: { 'Authorization': `Bearer ${state.jwtToken}` }
    });
    if (auditResp.ok) {
      const data = await auditResp.json();
      if (auditPreview) {
        if (!data.anchors || data.anchors.length === 0) {
          auditPreview.textContent = 'Nessun ancoraggio registrato.';
        } else {
          let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
          data.anchors.slice(0, 5).forEach(anchor => {
            const dateStr = new Date(anchor.anchored_at).toLocaleTimeString();
            html += `
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
                <span style="color:var(--lai-primary); font-family:var(--font-mono); font-size:10px;">${anchor.merkle_root.slice(0, 12)}...</span>
                <span style="color:var(--lai-text-secondary); font-size:10px;">${anchor.node_id}</span>
                <span style="color:var(--lai-text-muted); font-size:10px;">${dateStr}</span>
              </div>
            `;
          });
          html += '</div>';
          auditPreview.innerHTML = html;
        }
      }
    }

    // 3. Recupero Task pending dal Nexus (simulazione o fetch reale se implementato)
    const taskResp = await fetch(`${state.nexusUrl}/task/poll`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${state.jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (taskResp.ok) {
      const data = await taskResp.json();
      const count = data.tasks ? data.tasks.length : 0;
      if (metricTasks) metricTasks.textContent = count;
      
      if (tasksList) {
        if (count === 0) {
          tasksList.innerHTML = '<div style="text-align: center; color: var(--lai-text-secondary); padding: var(--space-lg) 0;">Nessun task attivo.</div>';
        } else {
          let html = '';
          data.tasks.forEach(task => {
            html += `
              <div class="card" style="padding:var(--space-sm) var(--space-md); margin-bottom:var(--space-xs); background:var(--lai-bg-elevated); border:1px solid var(--lai-border);">
                <div style="display:flex; justify-content:space-between; font-weight:600; font-size:13px; margin-bottom:2px;">
                  <span>${task.type.toUpperCase()}</span>
                  <span style="color:var(--lai-warning); font-family:var(--font-mono); font-size:11px;">${task.status}</span>
                </div>
                <div style="font-size:11px; color:var(--lai-text-secondary); font-family:var(--font-mono);">${task.task_id}</div>
              </div>
            `;
          });
          tasksList.innerHTML = html;
        }
      }
    }
  } catch (e) {
    console.warn("Errore durante l'interrogazione del Nexus:", e);
  }
}

// Azioni Rapide
function openHealth() {
  window.open(`${state.nodeUrl}/health`, '_blank');
}

function openCloudflare() {
  window.open('https://dash.cloudflare.com', '_blank');
}

function openFolder() {
  showNotification('Percorso di Sistema', 'La cartella principale è localizzata in C:\\LAI su questo computer.');
}

function runTest() {
  showNotification(
    'Esecuzione Test Suite', 
    'Per eseguire i test, apri una finestra PowerShell e digita:<br><span style="font-family:var(--font-mono); color:var(--lai-primary);">python C:\\LAI\\test_suite.py</span>'
  );
}

// Gestione autenticazione Cloud
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    showError(errorEl, 'Inserire email e password.');
    return;
  }

  btn.disabled = true;
  if (errorEl) errorEl.style.display = 'none';

  try {
    const nexusUrlInput = document.getElementById('setting-nexus-url')?.value.trim() || state.nexusUrl;
    state.nexusUrl = nexusUrlInput;
    localStorage.setItem('lai_nexus_url', nexusUrlInput);

    const resp = await fetch(`${state.nexusUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await resp.json();
    if (data.token) {
      state.jwtToken = data.token;
      state.tenantId = data.tenant_id;
      state.ruolo = data.ruolo || 'guest';
      
      localStorage.setItem('lai_jwt_token', data.token);
      localStorage.setItem('lai_tenant_id', data.tenant_id);
      localStorage.setItem('lai_ruolo', state.ruolo);
      
      updateAuthUI();
      checkNexusStatus();
      showNotification('Accesso Eseguito', `Benvenuto ${state.tenantId} (${state.ruolo})`);
    } else {
      showError(errorEl, data.error || 'Credenziali non valide.');
    }
  } catch (e) {
    showError(errorEl, 'Errore di connessione al Cloudflare Worker.');
  }
  btn.disabled = false;
}

function doLogout() {
  state.jwtToken = null;
  state.tenantId = null;
  state.ruolo = null;
  
  localStorage.removeItem('lai_jwt_token');
  localStorage.removeItem('lai_tenant_id');
  localStorage.removeItem('lai_ruolo');
  
  updateAuthUI();
  
  // Resetta i contatori
  const metricNodes = document.getElementById('metricNodes');
  const metricTasks = document.getElementById('metricTasks');
  const auditPreview = document.getElementById('auditPreview');
  
  if (metricNodes) metricNodes.textContent = '--';
  if (metricTasks) metricTasks.textContent = '--';
  if (auditPreview) auditPreview.innerHTML = '<div style="color:var(--lai-text-muted);">Esegui il login in Impostazioni per visualizzare la catena di Audit.</div>';
}

function updateAuthUI() {
  const authInfoBox = document.getElementById('auth-info-box');
  const loginForm = document.getElementById('settings-login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const userBadge = document.getElementById('user-badge');

  if (state.jwtToken) {
    if (authInfoBox) authInfoBox.innerHTML = `Autenticato come: <strong style="color:var(--lai-primary);">${state.tenantId}</strong> (${state.ruolo})`;
    if (loginForm) loginForm.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    
    // Cambia badge in alto a destra se necessario
    const header = document.querySelector('.app-header');
    if (header) {
      let badge = document.getElementById('user-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'user-badge';
        badge.style.fontSize = '12px';
        badge.style.color = 'var(--lai-text-secondary)';
        header.appendChild(badge);
      }
      badge.textContent = `${state.tenantId} (${state.ruolo})`;
    }
  } else {
    if (authInfoBox) authInfoBox.textContent = 'Non autenticato. Esegui il login per comunicare con il Nexus Cloud.';
    if (loginForm) loginForm.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    const badge = document.getElementById('user-badge');
    if (badge) badge.remove();
  }
}

// Gestione dei messaggi AI
async function sendAiMessage() {
  const input = document.getElementById('chat-input');
  const chatArea = document.getElementById('chat-area');
  const promptText = input?.value.trim();

  if (!promptText || !chatArea) return;

  // Visualizza messaggio utente
  appendChatMessage('User', promptText, 'user');
  input.value = '';

  // Visualizza placeholder caricamento
  const loadingDiv = appendChatMessage('L.A.I. Assistant', 'Elaborazione in corso...', 'ai-loading');

  try {
    let resp, data;
    
    // Se siamo loggati sul Nexus Cloud, usiamo il Cloud per le query, altrimenti andiamo direttamente su Ollama locale
    if (state.jwtToken) {
      resp = await fetch(`${state.nexusUrl}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.jwtToken}`
        },
        body: JSON.stringify({ prompt: promptText })
      });
    } else {
      resp = await fetch(`${state.nodeUrl}/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
    }

    if (resp.ok) {
      data = await resp.json();
      loadingDiv.remove();

      if (data.response) {
        const modelBadgeText = document.getElementById('ai-model-text');
        if (modelBadgeText) modelBadgeText.textContent = (data.model || 'AI Model').toUpperCase();
        
        appendChatMessage('L.A.I. Assistant', data.response, 'ai', data.source || 'api');
      } else {
        appendChatMessage('L.A.I. Assistant', data.error || 'Risposta non valida dal server.', 'ai-error');
      }
    } else {
      throw new Error("Server offline");
    }
  } catch (e) {
    loadingDiv.remove();
    appendChatMessage('L.A.I. Assistant', 'Impossibile connettersi ai server AI. Assicurati che il nodo locale (Ollama) sia attivo o che le credenziali cloud siano valide.', 'ai-error');
  }
}

function appendChatMessage(sender, text, type, meta = '') {
  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return null;

  const div = document.createElement('div');
  
  if (type === 'user') {
    div.style.background = 'var(--lai-primary)';
    div.style.color = 'var(--lai-bg-dark)';
    div.style.padding = 'var(--space-sm) var(--space-md)';
    div.style.borderRadius = 'var(--radius-md)';
    div.style.maxWidth = '85%';
    div.style.alignSelf = 'flex-end';
    div.style.boxShadow = 'var(--shadow-sm)';
    div.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px;">Tu</div>
      <div style="font-size: 13px; line-height: 1.5;">${text.replace(/\n/g, '<br>')}</div>
    `;
  } else if (type === 'ai-loading') {
    div.style.background = 'var(--lai-bg-elevated)';
    div.style.padding = 'var(--space-sm) var(--space-md)';
    div.style.borderRadius = 'var(--radius-md)';
    div.style.maxWidth = '85%';
    div.style.alignSelf = 'flex-start';
    div.style.borderLeft = '3px solid var(--lai-text-muted)';
    div.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px; color:var(--lai-text-secondary);">${sender}</div>
      <div style="font-size: 13px; line-height: 1.5; color:var(--lai-text-secondary); font-style:italic;">${text}</div>
    `;
  } else if (type === 'ai-error') {
    div.style.background = 'var(--lai-bg-elevated)';
    div.style.padding = 'var(--space-sm) var(--space-md)';
    div.style.borderRadius = 'var(--radius-md)';
    div.style.maxWidth = '85%';
    div.style.alignSelf = 'flex-start';
    div.style.borderLeft = '3px solid var(--lai-error)';
    div.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px; color:var(--lai-error);">${sender}</div>
      <div style="font-size: 13px; line-height: 1.5; color:var(--lai-error);">${text}</div>
    `;
  } else {
    // Risposta AI Standard
    const borderCol = meta === 'semantic_cache' || meta === 'exact_cache' ? 'var(--lai-info)' : 'var(--lai-primary)';
    const metaText = meta ? ` <span style="font-size:10px; color:var(--lai-text-muted); font-family:var(--font-mono);">(${meta})</span>` : '';
    
    div.style.background = 'var(--lai-bg-elevated)';
    div.style.padding = 'var(--space-sm) var(--space-md)';
    div.style.borderRadius = 'var(--radius-md)';
    div.style.maxWidth = '85%';
    div.style.alignSelf = 'flex-start';
    div.style.borderLeft = `3px solid ${borderCol}`;
    div.style.boxShadow = 'var(--shadow-sm)';
    div.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px;">${sender}${metaText}</div>
      <div style="font-size: 13px; line-height: 1.5; color: var(--lai-text-primary);">${text.replace(/\n/g, '<br>')}</div>
    `;
  }

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

// Creazione Task (Demo)
async function createNewTask() {
  if (!state.jwtToken) {
    showNotification('Impossibile creare task', 'Accedi prima al server Nexus cloud.');
    return;
  }
  
  const type = prompt("Inserisci il tipo di task (es. 'rag_index', 'audit_verify', 'catasto_fetch'):", "rag_index");
  if (!type) return;

  try {
    const resp = await fetch(`${state.nexusUrl}/task/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.jwtToken}`
      },
      body: JSON.stringify({
        type: type,
        payload: { source: 'pwa_client', timestamp: new Date().toISOString() }
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      showNotification('Task Creato', `Task ID: ${data.task_id}`);
      checkNexusStatus();
    } else {
      throw new Error("Errore durante la creazione");
    }
  } catch (e) {
    showNotification('Errore', 'Impossibile creare il task nel cloud.');
  }
}

// Helper: Calcolo Uptime
function calculateUptime(timestamp) {
  if (!timestamp) return '--';
  const start = new Date(timestamp);
  const now = new Date();
  const diffMs = now - start;
  
  if (diffMs < 0) return '0m';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`;
  }
  return `${diffMins}m`;
}

// Helper: Gestione Messaggi di Errore
function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
  element.classList.add('animate-fade-in');
}

// Helper: Mostra Notifiche/Modali Premium
function showNotification(title, message) {
  // Rimuovi eventuali notifiche aperte
  const oldNotification = document.getElementById('lai-notification');
  if (oldNotification) oldNotification.remove();

  const notification = document.createElement('div');
  notification.id = 'lai-notification';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.background = 'var(--lai-bg-card)';
  notification.style.border = '1px solid var(--lai-primary)';
  notification.style.borderRadius = 'var(--radius-md)';
  notification.style.padding = 'var(--space-md)';
  notification.style.boxShadow = 'var(--shadow-lg)';
  notification.style.zIndex = '10000';
  notification.style.maxWidth = '90%';
  notification.style.width = '360px';
  notification.style.animation = 'fadeIn 0.3s ease forwards';
  
  notification.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs); border-bottom:1px solid var(--lai-border); padding-bottom:var(--space-xs);">
      <strong style="color:var(--lai-primary); font-size:14px;">${title}</strong>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:var(--lai-text-secondary); cursor:pointer; font-size:16px;">&times;</button>
    </div>
    <div style="font-size:13px; line-height:1.4; color:var(--lai-text-primary);">${message}</div>
  `;
  
  document.body.appendChild(notification);
  
  // Autodistruzione dopo 6 secondi
  setTimeout(() => {
    if (document.getElementById('lai-notification') === notification) {
      notification.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, 6000);
}
