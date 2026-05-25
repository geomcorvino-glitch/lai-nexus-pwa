// L.A.I. STUDIO NEXUS — Logica Applicativa PWA v3.1.0

// Stato globale in memoria
let state = {
  nexusUrl: (localStorage.getItem('lai_nexus_url') && localStorage.getItem('lai_nexus_url') !== 'null') ? localStorage.getItem('lai_nexus_url') : 'https://lai-nexus-v31.geom-corvino.workers.dev',
  nodeUrl: (localStorage.getItem('lai_node_url') && localStorage.getItem('lai_node_url') !== 'null') ? localStorage.getItem('lai_node_url') : 'http://127.0.0.1:5000',
  jwtToken: localStorage.getItem('lai_jwt_token') || null,
  tenantId: localStorage.getItem('lai_tenant_id') || null,
  ruolo: localStorage.getItem('lai_ruolo') || null,
  apiKey: localStorage.getItem('lai_api_key') || null,
  activeTab: 'dashboard'
};

// Inizializzazione al caricamento
document.addEventListener('DOMContentLoaded', () => {
  // Inizializza i campi di input nelle Impostazioni con i valori correnti
  const nexusInput = document.getElementById('setting-nexus-url');
  const nodeInput = document.getElementById('setting-node-url');
  const apiKeyInput = document.getElementById('setting-api-key');
  if (nexusInput) nexusInput.value = state.nexusUrl;
  if (nodeInput) nodeInput.value = state.nodeUrl;
  if (apiKeyInput) apiKeyInput.value = state.apiKey || '';

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
    
    // Gestione hash iniziale
    const hash = window.location.hash.substring(1);
    if (hash && ['dashboard', 'tasks', 'ai', 'settings', 'pratiche', 'clienti', 'scadenze'].includes(hash)) {
      showSection(hash);
    }
  }, 1200);

  // Esegui i controlli iniziali e avvia il polling
  checkNodeStatus();
  checkNexusStatus();
  renderDashboard();
  
  // Polling periodico
  setInterval(checkNodeStatus, 10000);  // Ogni 10 secondi per il nodo locale
  setInterval(checkNexusStatus, 30000); // Ogni 30 secondi per il Cloudflare Worker
});

// Ascolta cambiamenti hash
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if (hash && ['dashboard', 'tasks', 'ai', 'settings', 'pratiche', 'clienti', 'scadenze'].includes(hash)) {
    showSection(hash);
  }
});

// Gestione della navigazione (Tab Switcher)
function showSection(sectionId) {
  state.activeTab = sectionId;
  
  // Gestione visibilità dei contenuti dei tab
  const tabs = ['dashboard', 'tasks', 'ai', 'settings', 'pratiche', 'clienti', 'scadenze'];
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

  // Renderizza i moduli relativi alla vista attiva
  if (sectionId === 'dashboard') renderDashboard();
  if (sectionId === 'pratiche') renderPratiche();
  if (sectionId === 'clienti') renderClienti();
  if (sectionId === 'scadenze') renderScadenze();
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

  // Sincronizza l'input nel DOM con lo stato in memoria se necessario
  const nodeInput = document.getElementById('setting-node-url');
  if (nodeInput && nodeInput.value !== state.nodeUrl) {
    nodeInput.value = state.nodeUrl;
  }

  try {
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

function saveApiKey() {
  const apiKeyInput = document.getElementById('setting-api-key');
  if (apiKeyInput) {
    state.apiKey = apiKeyInput.value.trim() || null;
    if (state.apiKey) {
      localStorage.setItem('lai_api_key', state.apiKey);
    } else {
      localStorage.removeItem('lai_api_key');
    }
  }
}

function saveNodeUrl() {
  const nodeInput = document.getElementById('setting-node-url');
  if (nodeInput) {
    const val = nodeInput.value.trim();
    state.nodeUrl = val || 'http://127.0.0.1:5000';
    localStorage.setItem('lai_node_url', state.nodeUrl);
    checkNodeStatus();
  }
}

function saveNexusUrl() {
  const nexusInput = document.getElementById('setting-nexus-url');
  if (nexusInput) {
    const val = nexusInput.value.trim();
    state.nexusUrl = val || 'https://lai-nexus-v31.geom-corvino.workers.dev';
    localStorage.setItem('lai_nexus_url', state.nexusUrl);
    checkNexusStatus();
  }
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
    let responseText = null;
    let modelUsed = '';
    let sourceMeta = '';
    let errorMessage = '';

    // 1. Se l'utente ha inserito una chiave API personale nelle impostazioni
    if (state.apiKey) {
      const isTechnical = /relazion|tecnic|catast|normativ|perizi|suap|urbanist|ediliz|struttur/i.test(promptText);
      
      if (state.apiKey.startsWith('AIzaSy')) {
        // Chiamata diretta a Google Gemini API
        const geminiModel = isTechnical ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${state.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
            })
          });
          if (resp.ok) {
            const result = await resp.json();
            responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
            modelUsed = geminiModel;
            sourceMeta = 'gemini_direct';
          } else {
            const errJson = await resp.json().catch(() => ({}));
            errorMessage = `Errore Google Gemini API: ${errJson.error?.message || resp.status}`;
          }
        } catch (eGem) {
          errorMessage = `Errore di connessione a Google Gemini: ${eGem.message}`;
        }
      } else {
        // Chiamata diretta a OpenRouter API
        const model = isTechnical ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini';
        try {
          const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.apiKey}`,
              'HTTP-Referer': 'https://laistudio.it',
              'X-Title': 'L.A.I. Studio NEXUS'
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: promptText }],
              max_tokens: 2048,
              temperature: 0.7
            })
          });
          if (resp.ok) {
            const result = await resp.json();
            responseText = result.choices?.[0]?.message?.content || null;
            modelUsed = result.model || model;
            sourceMeta = 'openrouter_direct';
          } else {
            const errJson = await resp.json().catch(() => ({}));
            errorMessage = `Errore OpenRouter API: ${errJson.error?.message || resp.status}`;
          }
        } catch (eOp) {
          errorMessage = `Errore di connessione a OpenRouter: ${eOp.message}`;
        }
      }
    }

    // 2. Se non abbiamo ancora una risposta (es. nessuna chiave inserita o la chiamata diretta ha fallito)
    if (!responseText) {
      let fallbackToLocal = false;
      
      // Tentiamo via Cloudflare Worker (se siamo loggati)
      if (state.jwtToken) {
        try {
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.jwtToken}`
          };
          if (state.apiKey) {
            headers['X-User-Api-Key'] = state.apiKey;
          }

          const resp = await fetch(`${state.nexusUrl}/ai/query`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ prompt: promptText })
          });
          
          if (resp.ok) {
            const data = await resp.json();
            responseText = data.response;
            modelUsed = data.model;
            sourceMeta = data.source || 'api';
          } else {
            try {
              const errData = await resp.json();
              errorMessage = errData.error || errorMessage || `Errore Cloud (${resp.status})`;
              if (errData.fallback === 'ollama' || resp.status === 503) {
                fallbackToLocal = true;
              }
            } catch (e2) {
              fallbackToLocal = true;
            }
          }
        } catch (eCloud) {
          fallbackToLocal = true;
        }
      } else {
        fallbackToLocal = true;
      }

      // 3. Se dobbiamo usare il nodo locale (Ollama locale)
      if (fallbackToLocal && !responseText) {
        try {
          const resp = await fetch(`${state.nodeUrl}/ai/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
          });
          if (resp.ok) {
            const data = await resp.json();
            responseText = data.response;
            modelUsed = data.model;
            sourceMeta = data.source || 'ollama_local';
          } else {
            const errData = await resp.json().catch(() => ({}));
            errorMessage = errData.error || errorMessage || `Errore nodo locale (${resp.status})`;
          }
        } catch (eLocal) {
          errorMessage = errorMessage || 'Impossibile connettersi al nodo locale (Ollama non attivo).';
        }
      }
    }

    loadingDiv.remove();

    if (responseText) {
      const modelBadgeText = document.getElementById('ai-model-text');
      if (modelBadgeText) modelBadgeText.textContent = modelUsed.toUpperCase();
      
      appendChatMessage('L.A.I. Assistant', responseText, 'ai', sourceMeta);
    } else {
      appendChatMessage('L.A.I. Assistant', errorMessage || 'Impossibile connettersi ai server AI. Inserisci la tua chiave API personale nelle Impostazioni o assicurati che il nodo locale sia attivo.', 'ai-error');
    }
  } catch (e) {
    if (loadingDiv) loadingDiv.remove();
    appendChatMessage('L.A.I. Assistant', 'Si è verificato un errore imprevisto durante l\'elaborazione.', 'ai-error');
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

// --- STATO E CONFIGURAZIONI GESTIONE PRATICHE ---
const CRM_DB = {
  get: (k) => JSON.parse(localStorage.getItem(k) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

let pratiche = CRM_DB.get('lai_pratiche');
let clienti  = CRM_DB.get('lai_clienti');
let editingId = null;

const PACCHETTI = [
  'P1 — Conformità Pre-Rogito',
  'P2 — Sanatoria Salva Casa',
  'P3 — DOCFA Variazione',
  'P4 — CILA',
  'P4 — SCIA Ordinaria',
  'P4 — SCIA Alternativa',
  'P5 — Due Diligence',
  'P6 — Perizia Tecnica',
  'P7 — Pratica Complessa',
];

const PREZZI_BASE = {
  'P1 — Conformità Pre-Rogito': 700,
  'P2 — Sanatoria Salva Casa': 1500,
  'P3 — DOCFA Variazione': 500,
  'P4 — CILA': 600,
  'P4 — SCIA Ordinaria': 950,
  'P4 — SCIA Alternativa': 1400,
  'P5 — Due Diligence': 900,
  'P6 — Perizia Tecnica': 800,
  'P7 — Pratica Complessa': 2500,
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function formatDate(d) {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

function badgeStato(s) {
  const map = {
    'In Lavorazione': 'lavorazione',
    'In Attesa Comune': 'attesa',
    'In Attesa Cliente': 'attesa',
    'Depositata': 'depositata',
    'Conclusa': 'conclusa',
  };
  return `<span class="badge badge-${map[s] || 'lavorazione'}">${s}</span>`;
}

function scadenzaCell(dateStr) {
  const d = daysLeft(dateStr);
  if (d === null) return '—';
  if (d < 0) return `<span class="scadenza-danger">Scaduta (${Math.abs(d)}gg fa)</span>`;
  if (d <= 7) return `<span class="scadenza-warning">⚠ ${formatDate(dateStr)} (${d}gg)</span>`;
  return formatDate(dateStr);
}

function suggestNumero() {
  const year = new Date().getFullYear();
  const count = pratiche.filter(p => p.numero?.startsWith(year)).length + 1;
  return `${year}-${String(count).padStart(3,'0')}`;
}

function renderDashboard() {
  const elDate = document.getElementById('current-date');
  if (elDate) {
    elDate.textContent = new Date().toLocaleDateString('it-IT', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  }

  const totale   = pratiche.length;
  const inCorso  = pratiche.filter(p => p.stato === 'In Lavorazione' || p.stato === 'In Attesa Comune' || p.stato === 'In Attesa Cliente').length;
  const concluse = pratiche.filter(p => p.stato === 'Conclusa').length;
  const scadenti = pratiche.filter(p => { const d = daysLeft(p.scadenza); return d !== null && d >= 0 && d <= 7 && p.stato !== 'Conclusa'; }).length;

  // Fatturato mese corrente
  const oggi = new Date();
  const meseCorrente = pratiche.filter(p => {
    if (p.stato !== 'Conclusa' || !p.data_chiusura) return false;
    const dc = new Date(p.data_chiusura);
    return dc.getMonth() === oggi.getMonth() && dc.getFullYear() === oggi.getFullYear();
  });
  const fatturatoMese = meseCorrente.reduce((s, p) => s + (Number(p.onorario) || 0), 0);

  const elTot = document.getElementById('stat-totale');
  const elCor = document.getElementById('stat-inCorso');
  const elCon = document.getElementById('stat-concluse');
  const elSca = document.getElementById('stat-scadenti');
  const elFat = document.getElementById('stat-fatturato');

  if (elTot) elTot.textContent   = totale;
  if (elCor) elCor.textContent  = inCorso;
  if (elCon) elCon.textContent = concluse;
  if (elSca) elSca.textContent = scadenti;
  if (elFat) elFat.textContent = '€' + fatturatoMese.toLocaleString('it-IT');

  const recent = [...pratiche].reverse().slice(0, 8);
  const elRecent = document.getElementById('recent-list');
  if (elRecent) elRecent.innerHTML = buildTable(recent, true);
}

function renderPratiche() {
  const tipo   = document.getElementById('filter-tipo')?.value || '';
  const stato  = document.getElementById('filter-stato')?.value || '';
  const search = (document.getElementById('search-pratiche')?.value || '').toLowerCase();

  let list = [...pratiche].reverse().filter(p => {
    if (tipo   && p.tipo   !== tipo)   return false;
    if (stato  && p.stato  !== stato)  return false;
    if (search && !p.cliente.toLowerCase().includes(search) && !p.numero.toLowerCase().includes(search)) return false;
    return true;
  });

  const elList = document.getElementById('pratiche-list');
  if (elList) elList.innerHTML = buildTable(list, false);
}

function buildTable(list, compact) {
  if (list.length === 0) {
    return `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
      <p>Nessuna pratica trovata</p>
      <small>Clicca "+ Nuova Pratica" per iniziare</small>
    </div>`;
  }

  const rows = list.map(p => `
    <tr onclick="openModal('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}</td>
      <td><span class="badge-tipo">${p.tipo}</span></td>
      ${!compact ? `<td>${p.comune || '—'}</td>` : ''}
      <td>${badgeStato(p.stato)}</td>
      <td>${scadenzaCell(p.scadenza)}</td>
      ${!compact ? `<td>${p.onorario ? '€' + Number(p.onorario).toLocaleString('it-IT') : '—'}</td>` : ''}
      <td onclick="event.stopPropagation()">
        <button class="btn-edit" onclick="openModal('${p.id}')">Modifica</button>
        <button class="btn-del" onclick="deletePratica('${p.id}')">✕</button>
      </td>
    </tr>`).join('');

  return `<table>
    <thead><tr>
      <th>N°</th><th>Cliente</th><th>Tipo</th>
      ${!compact ? '<th>Comune</th>' : ''}
      <th>Stato</th><th>Scadenza</th>
      ${!compact ? '<th>Onorario</th>' : ''}
      <th>Azioni</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openModal(id) {
  editingId = id || null;
  const p = id ? pratiche.find(x => x.id === id) : null;

  // Popola select pacchetti
  const selTipo = document.getElementById('f-tipo');
  if (selTipo) {
    selTipo.innerHTML = '<option value="">Seleziona pacchetto...</option>' +
      PACCHETTI.map(pk => `<option value="${pk}"${p?.tipo === pk ? ' selected' : ''}>${pk}</option>`).join('');
  }

  const elTitle = document.getElementById('modal-title');
  if (elTitle) elTitle.textContent = p ? 'Modifica Pratica' : 'Nuova Pratica';
  
  document.getElementById('f-id').value              = p?.id || '';
  document.getElementById('f-numero').value          = p?.numero || suggestNumero();
  document.getElementById('f-cliente').value         = p?.cliente || '';
  document.getElementById('f-oggetto').value         = p?.oggetto || '';
  document.getElementById('f-comune').value          = p?.comune || '';
  document.getElementById('f-particella').value      = p?.particella || '';
  document.getElementById('f-apertura').value        = p?.apertura || new Date().toISOString().slice(0,10);
  document.getElementById('f-scadenza').value        = p?.scadenza || '';
  document.getElementById('f-stato').value           = p?.stato || 'In Lavorazione';
  document.getElementById('f-onorario').value        = p?.onorario || (p?.tipo ? PREZZI_BASE[p.tipo] || '' : '');
  document.getElementById('f-acconto').value         = p?.acconto || '';
  document.getElementById('f-responsabile').value   = p?.responsabile || 'Raffaele';
  document.getElementById('f-esecutore').value       = p?.esecutore || 'Satellite';
  document.getElementById('f-referral').value        = p?.referral || '';
  document.getElementById('f-collaboratore').value   = p?.collaboratore || '';
  document.getElementById('f-note').value            = p?.note || '';

  // Auto-prezzo quando si seleziona pacchetto
  if (selTipo) {
    selTipo.onchange = () => {
      const prezzo = PREZZI_BASE[selTipo.value];
      if (prezzo && !document.getElementById('f-onorario').value) {
        document.getElementById('f-onorario').value = prezzo;
      }
    };
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function savePratica(e) {
  e.preventDefault();
  const isChiusa = document.getElementById('f-stato').value === 'Conclusa';
  const p = {
    id:           editingId || uid(),
    numero:       document.getElementById('f-numero').value.trim(),
    tipo:         document.getElementById('f-tipo').value,
    cliente:      document.getElementById('f-cliente').value.trim(),
    oggetto:      document.getElementById('f-oggetto').value.trim(),
    comune:       document.getElementById('f-comune').value.trim(),
    particella:   document.getElementById('f-particella').value.trim(),
    apertura:     document.getElementById('f-apertura').value,
    scadenza:     document.getElementById('f-scadenza').value,
    stato:        document.getElementById('f-stato').value,
    onorario:     document.getElementById('f-onorario').value,
    acconto:      document.getElementById('f-acconto').value,
    responsabile: document.getElementById('f-responsabile').value,
    esecutore:    document.getElementById('f-esecutore').value,
    referral:     document.getElementById('f-referral').value.trim(),
    collaboratore:document.getElementById('f-collaboratore').value.trim(),
    note:         document.getElementById('f-note').value.trim(),
    data_chiusura: isChiusa ? (pratiche.find(x=>x.id===editingId)?.data_chiusura || new Date().toISOString().slice(0,10)) : '',
  };

  if (editingId) {
    const idx = pratiche.findIndex(x => x.id === editingId);
    if (idx > -1) pratiche[idx] = p;
  } else {
    pratiche.push(p);
  }

  CRM_DB.set('lai_pratiche', pratiche);
  closeModal();
  renderDashboard();
  renderPratiche();
}

function deletePratica(id) {
  if (!confirm('Eliminare questa pratica?')) return;
  pratiche = pratiche.filter(p => p.id !== id);
  CRM_DB.set('lai_pratiche', pratiche);
  renderDashboard();
  renderPratiche();
  if (state.activeTab === 'pratiche') renderPratiche();
  if (state.activeTab === 'scadenze') renderScadenze();
}

function renderClienti() {
  const elList = document.getElementById('clienti-list');
  if (!elList) return;

  if (clienti.length === 0) {
    elList.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      <p>Nessun cliente inserito</p></div>`;
    return;
  }

  const rows = clienti.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.cf || '—'}</td>
      <td>${c.tel || '—'}</td>
      <td>${c.email || '—'}</td>
      <td>${c.indirizzo || '—'}</td>
      <td>
        <button class="btn-edit" onclick="openClienteModal('${c.id}')">Modifica</button>
        <button class="btn-del" onclick="deleteCliente('${c.id}')">✕</button>
      </td>
    </tr>`).join('');

  elList.innerHTML = `<table>
    <thead><tr><th>Nome</th><th>CF/P.IVA</th><th>Telefono</th><th>Email</th><th>Indirizzo</th><th>Azioni</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openClienteModal(id) {
  const c = id ? clienti.find(x => x.id === id) : null;
  document.getElementById('c-id').value        = c?.id || '';
  document.getElementById('c-nome').value      = c?.nome || '';
  document.getElementById('c-cf').value        = c?.cf || '';
  document.getElementById('c-tel').value       = c?.tel || '';
  document.getElementById('c-email').value     = c?.email || '';
  document.getElementById('c-indirizzo').value = c?.indirizzo || '';
  document.getElementById('c-note').value      = c?.note || '';
  document.getElementById('modal-cliente').classList.add('open');
}

function closeClienteModal() {
  document.getElementById('modal-cliente').classList.remove('open');
}

function saveCliente(e) {
  e.preventDefault();
  const existingId = document.getElementById('c-id').value;
  const c = {
    id:        existingId || uid(),
    nome:      document.getElementById('c-nome').value.trim(),
    cf:        document.getElementById('c-cf').value.trim(),
    tel:       document.getElementById('c-tel').value.trim(),
    email:     document.getElementById('c-email').value.trim(),
    indirizzo: document.getElementById('c-indirizzo').value.trim(),
    note:      document.getElementById('c-note').value.trim(),
  };

  if (existingId) {
    const idx = clienti.findIndex(x => x.id === existingId);
    if (idx > -1) clienti[idx] = c;
  } else {
    clienti.push(c);
  }

  CRM_DB.set('lai_clienti', clienti);
  closeClienteModal();
  renderClienti();
}

function deleteCliente(id) {
  if (!confirm('Eliminare questo cliente?')) return;
  clienti = clienti.filter(c => c.id !== id);
  CRM_DB.set('lai_clienti', clienti);
  renderClienti();
}

function renderScadenze() {
  const upcoming = pratiche
    .filter(p => p.scadenza && p.stato !== 'Conclusa')
    .sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza));

  const elList = document.getElementById('scadenze-list');
  if (!elList) return;

  if (upcoming.length === 0) {
    elList.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
      <p>Nessuna scadenza imminente</p></div>`;
    return;
  }

  const rows = upcoming.map(p => {
    const d = daysLeft(p.scadenza);
    let urgency = '';
    if (d < 0) urgency = `<span class="scadenza-danger">Scaduta!</span>`;
    else if (d <= 3) urgency = `<span class="scadenza-danger">${d} giorni</span>`;
    else if (d <= 7) urgency = `<span class="scadenza-warning">${d} giorni</span>`;
    else urgency = `${d} giorni`;

    return `<tr onclick="openModal('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}</td>
      <td><span class="badge-tipo">${p.tipo}</span></td>
      <td>${formatDate(p.scadenza)}</td>
      <td>${urgency}</td>
      <td>${badgeStato(p.stato)}</td>
    </tr>`;
  }).join('');

  elList.innerHTML = `<table>
    <thead><tr><th>N°</th><th>Cliente</th><th>Tipo</th><th>Scadenza</th><th>Mancano</th><th>Stato</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
