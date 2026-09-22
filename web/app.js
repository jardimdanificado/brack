/**
 * =========================================================================
 * BRACK Modular Rack & Scratch DSP Studio (web/app.js)
 * Live 48kHz Audio Engine, Modular Patch Canvas, and In-Place Scratch Editor
 * =========================================================================
 */

import { registerSynthBlocks } from './synth_blocks.js';
import { RackEngine } from './rack_engine.js';
import { RackCanvas } from './rack_canvas.js';
import { ProjectsManager } from './projects_manager.js';
import { MODULE_CATALOG } from './modules_catalog.js';

let audioCtx = null;
let scriptNode = null;
let isPlaying = false;
let rackEngine = null;
let rackCanvas = null;
let projectsManager = null;
let scratchWorkspace = null;
let currentEditingModule = null;

const BLOCK_SIZE = 128;

/* =========================================================================
 * Toast Feedback Notification Helper
 * ========================================================================= */
let toastTimer = null;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'warn') toast.classList.add('toast-warn');
    else if (type === 'error') toast.classList.add('toast-error');

    toast.classList.add('show');
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/* =========================================================================
 * Real-Time Audio Synthesis Processing Loop
 * ========================================================================= */
let dummySource = null;

async function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        const bufferSize = 512;
        scriptNode = audioCtx.createScriptProcessor(bufferSize, 1, 2);

        // Dummy silent source connected to input to keep ScriptProcessor clock ticking continuously
        try {
            dummySource = audioCtx.createConstantSource ? audioCtx.createConstantSource() : audioCtx.createBufferSource();
            if (dummySource.offset) dummySource.offset.value = 0;
            dummySource.connect(scriptNode);
            if (dummySource.start) dummySource.start();
        } catch (e) {
            console.warn('Silent dummy source fallback:', e);
        }

        scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            for (let offset = 0; offset < bufferSize; offset += BLOCK_SIZE) {
                if (rackEngine && isPlaying) {
                    rackEngine.processBlock(outL, outR, offset, BLOCK_SIZE);
                } else {
                    for (let s = 0; s < BLOCK_SIZE; s++) {
                        outL[offset + s] = 0;
                        outR[offset + s] = 0;
                    }
                }
            }
        };

        scriptNode.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/* =========================================================================
 * UI Sync Helpers: Select Dropdown & Projects Manager Modal
 * ========================================================================= */
function updateProjectSelect() {
    const select = document.getElementById('project-select');
    if (!select || !projectsManager) return;

    const all = projectsManager.getAllProjects();
    const activeId = projectsManager.getActiveProjectId();

    select.innerHTML = '';

    const examplesGroup = document.createElement('optgroup');
    examplesGroup.label = 'Patches de Exemplo';

    const userGroup = document.createElement('optgroup');
    userGroup.label = 'Meus Patches';

    let hasUserProjects = false;

    for (const proj of all) {
        const opt = document.createElement('option');
        opt.value = proj.id;
        opt.textContent = proj.name;
        if (proj.id === activeId) opt.selected = true;

        if (proj.isExample) {
            examplesGroup.appendChild(opt);
        } else {
            userGroup.appendChild(opt);
            hasUserProjects = true;
        }
    }

    select.appendChild(examplesGroup);
    if (hasUserProjects) {
        select.appendChild(userGroup);
    }
}

function renderModalProjectsList(filterQuery = '') {
    const listContainer = document.getElementById('modal-projects-list');
    if (!listContainer || !projectsManager) return;

    const all = projectsManager.getAllProjects();
    const activeId = projectsManager.getActiveProjectId();
    const query = filterQuery.trim().toLowerCase();

    listContainer.innerHTML = '';

    const filtered = all.filter(p => {
        if (!query) return true;
        return p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-dim); padding: 40px 10px;">
                Nenhum patch encontrado para "<b>${filterQuery}</b>".
            </div>
        `;
        return;
    }

    for (const proj of filtered) {
        const isActive = proj.id === activeId;
        const card = document.createElement('div');
        card.className = `project-card ${isActive ? 'active' : ''}`;

        const info = document.createElement('div');
        info.className = 'project-info';

        const titleRow = document.createElement('div');
        titleRow.className = 'project-title-row';

        const nameSpan = document.createElement('span');
        nameSpan.style.fontSize = '13px';
        nameSpan.style.fontWeight = '700';
        nameSpan.style.color = '#ffffff';
        nameSpan.textContent = proj.name;

        const badge = document.createElement('span');
        badge.className = `badge ${proj.isExample ? 'badge-example' : 'badge-user'}`;
        badge.textContent = proj.isExample ? 'Exemplo' : 'Patch';

        titleRow.appendChild(nameSpan);
        titleRow.appendChild(badge);

        if (isActive) {
            const activeBadge = document.createElement('span');
            activeBadge.className = 'badge badge-active';
            activeBadge.textContent = 'Ativo';
            titleRow.appendChild(activeBadge);
        }

        const desc = document.createElement('div');
        desc.style.fontSize = '11px';
        desc.style.color = 'var(--text-dim)';
        desc.style.lineHeight = '1.3';
        desc.textContent = proj.description || (proj.isExample ? 'Preset modular original' : 'Patch criado pelo usuário');

        info.appendChild(titleRow);
        info.appendChild(desc);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '5px';

        const btnLoad = document.createElement('button');
        btnLoad.className = 'btn-sm btn-primary';
        btnLoad.textContent = 'Abrir';
        btnLoad.addEventListener('click', () => {
            projectsManager.loadProject(proj.id);
            updateProjectSelect();
            renderModalProjectsList(filterQuery);
            closeProjectsModal();
            showToast(`Patch carregado: ${proj.name}`);
        });

        const btnDup = document.createElement('button');
        btnDup.className = 'btn-sm';
        btnDup.textContent = 'Duplicar';
        btnDup.addEventListener('click', () => {
            const copy = projectsManager.duplicateProject(proj.id);
            if (copy) {
                updateProjectSelect();
                renderModalProjectsList(filterQuery);
                showToast(`Cópia criada: ${copy.name}`);
            }
        });

        const btnExport = document.createElement('button');
        btnExport.className = 'btn-sm';
        btnExport.textContent = 'Exportar';
        btnExport.addEventListener('click', () => {
            projectsManager.exportProjectJson(proj.id);
            showToast(`Exportando: ${proj.name}`);
        });

        actions.appendChild(btnLoad);
        actions.appendChild(btnDup);
        actions.appendChild(btnExport);

        if (!proj.isExample) {
            const btnRename = document.createElement('button');
            btnRename.className = 'btn-sm';
            btnRename.textContent = 'Renomear';
            btnRename.addEventListener('click', () => {
                const newName = prompt('Novo nome para o patch:', proj.name);
                if (newName && newName.trim() && newName !== proj.name) {
                    projectsManager.renameProject(proj.id, newName.trim());
                    updateProjectSelect();
                    renderModalProjectsList(filterQuery);
                    showToast(`Renomeado para: ${newName.trim()}`);
                }
            });

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-danger';
            btnDel.textContent = 'Excluir';
            btnDel.addEventListener('click', () => {
                if (confirm(`Tem certeza que deseja excluir o patch "${proj.name}"?`)) {
                    projectsManager.deleteProject(proj.id);
                    updateProjectSelect();
                    renderModalProjectsList(filterQuery);
                    showToast(`Patch excluído: ${proj.name}`, 'warn');
                }
            });

            actions.appendChild(btnRename);
            actions.appendChild(btnDel);
        }

        card.appendChild(info);
        card.appendChild(actions);
        listContainer.appendChild(card);
    }
}

function openProjectsModal() {
    const modal = document.getElementById('projects-modal');
    const searchInput = document.getElementById('modal-search-input');
    if (!modal) return;
    if (searchInput) searchInput.value = '';
    renderModalProjectsList('');
    modal.style.display = 'flex';
}

function closeProjectsModal() {
    const modal = document.getElementById('projects-modal');
    if (modal) modal.style.display = 'none';
}

/* =========================================================================
 * Add Module Modal Helper
 * ========================================================================= */
function renderAddModuleModal() {
    const grid = document.getElementById('modules-catalog-grid');
    if (!grid) return;

    grid.innerHTML = '';

    for (const spec of MODULE_CATALOG) {
        const card = document.createElement('div');
        card.className = 'module-pick-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <b style="color: ${spec.color || '#55efc4'}; font-size: 13px;">${spec.name}</b>
                <span class="badge" style="background: rgba(255,255,255,0.1); font-size: 8px;">${spec.category}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-dim);">
                In: ${spec.inputs.map(i => i.name).join(', ') || 'Nenhum'} | Out: ${spec.outputs.map(o => o.name).join(', ') || 'Nenhum'}
            </div>
            <div style="font-size: 10px; color: #8395a7;">
                Knobs: ${spec.params.map(p => p.name).join(', ') || 'Nenhum'}
            </div>
        `;

        card.addEventListener('click', () => {
            const worldCenter = rackCanvas.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
            const newMod = rackEngine.addModule(spec.type, worldCenter.x - 95, worldCenter.y - 125);
            rackCanvas.render();
            closeAddModuleModal();
            showToast(`Módulo adicionado: ${newMod.name}`);
        });

        grid.appendChild(card);
    }
}

function openAddModuleModal() {
    const modal = document.getElementById('add-module-modal');
    if (modal) {
        renderAddModuleModal();
        modal.style.display = 'flex';
    }
}

function closeAddModuleModal() {
    const modal = document.getElementById('add-module-modal');
    if (modal) modal.style.display = 'none';
}

/* =========================================================================
 * Scratch Module Editor In-Place Drawer Controller
 * ========================================================================= */
function openScratchEditor(moduleInstance) {
    if (!moduleInstance) return;
    currentEditingModule = moduleInstance;

    const drawer = document.getElementById('scratch-drawer');
    const titleEl = document.getElementById('drawer-module-title');

    if (titleEl) {
        titleEl.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
            <span>Editando Código Scratch: <b style="color: #ffffff;">${moduleInstance.name}</b></span>
        `;
    }

    if (drawer) {
        drawer.classList.add('open');
    }

    // Load module's XML into scratchWorkspace
    if (scratchWorkspace) {
        scratchWorkspace.clear();
        if (moduleInstance.xml) {
            try {
                let dom = null;
                if (Blockly.utils && Blockly.utils.xml && typeof Blockly.utils.xml.textToDom === 'function') {
                    dom = Blockly.utils.xml.textToDom(moduleInstance.xml);
                } else if (Blockly.Xml && typeof Blockly.Xml.textToDom === 'function') {
                    dom = Blockly.Xml.textToDom(moduleInstance.xml);
                } else {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(moduleInstance.xml, 'text/xml');
                    dom = doc.documentElement;
                }
                Blockly.Xml.domToWorkspace(dom, scratchWorkspace);
                for (const b of scratchWorkspace.getAllBlocks(false)) {
                    if (typeof b.setDisabledReason === 'function') {
                        b.setDisabledReason(false, 'ORPHANED_BLOCK');
                    }
                }
            } catch (err) {
                console.warn('Error loading module XML into Scratch workspace:', err);
            }
        }
        setTimeout(() => Blockly.svgResize(scratchWorkspace), 50);
    }
}

function closeScratchEditor() {
    const drawer = document.getElementById('scratch-drawer');
    if (drawer) drawer.classList.remove('open');
    currentEditingModule = null;
}

/* =========================================================================
 * Application Initialization
 * ========================================================================= */
window.addEventListener('DOMContentLoaded', () => {
    // 1. Register All Synth & Module IO Blocks
    registerSynthBlocks(Blockly);
    if (Blockly.Events && typeof Blockly.Events.disableOrphans === 'function') {
        Blockly.Events.disableOrphans = function() {};
    }

    // 2. Initialize Rack Engine & Rack Canvas
    const rackContainer = document.getElementById('rack-container');
    rackEngine = new RackEngine(48000);

    rackCanvas = new RackCanvas(rackContainer, rackEngine, {
        onEditModule: (mod) => openScratchEditor(mod),
        onModuleChange: () => {
            // Re-render rack cables & sync if needed
        }
    });

    // 3. Initialize Blockly Scratch Editor Workspace inside Drawer
    const scratchTheme = Blockly.Theme.defineTheme('scratchDarkTheme', {
        base: Blockly.Themes.Classic,
        blockStyles: {
            hat_blocks: { colourPrimary: "#FFAB19", colourSecondary: "#E69900", colourTertiary: "#CC8800" }
        },
        componentStyles: {
            workspaceBackgroundColour: '#0c100e',
            toolboxBackgroundColour: '#141c18',
            toolboxForegroundColour: '#dcdde1',
            flyoutBackgroundColour: '#111714',
            flyoutOpacity: 0.96,
            scrollbarColour: '#283731',
            scrollbarOpacity: 0.6,
            insertionMarkerColour: '#55efc4',
            insertionMarkerOpacity: 0.85
        }
    });

    scratchWorkspace = Blockly.inject('blockly-div', {
        toolbox: document.getElementById('toolbox'),
        grid: { spacing: 25, length: 3, colour: '#1c2823', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2.0, minScale: 0.4, scaleSpeed: 1.1 },
        trashcan: true,
        theme: scratchTheme
    });

    // Sincronização em tempo real: qualquer mudança no Scratch atualiza a caixa e o DSP do módulo no Rack
    scratchWorkspace.addChangeListener((e) => {
        if (e.isUiEvent || !currentEditingModule) return;
        if (scratchWorkspace.isDragging && scratchWorkspace.isDragging()) return;

        const xmlDom = Blockly.Xml.workspaceToDom(scratchWorkspace);
        let xmlText = '';
        if (Blockly.utils && Blockly.utils.xml && typeof Blockly.utils.xml.domToText === 'function') {
            xmlText = Blockly.utils.xml.domToText(xmlDom);
        } else if (Blockly.Xml && typeof Blockly.Xml.domToText === 'function') {
            xmlText = Blockly.Xml.domToText(xmlDom);
        } else {
            const serializer = new XMLSerializer();
            xmlText = serializer.serializeToString(xmlDom);
        }

        // Update module instance XML & re-extract ports & knobs
        rackEngine.syncModuleWithXml(currentEditingModule, xmlText);
        rackCanvas.render();
    });

    // 4. Initialize Projects Manager
    projectsManager = new ProjectsManager(rackEngine, rackCanvas);

    // Load active preset (e.g. Acid 303 Lab)
    const initialProjId = projectsManager.getActiveProjectId();
    projectsManager.loadProject(initialProjId);
    updateProjectSelect();

    // 5. Header Action Buttons
    const btnPlayToggle = document.getElementById('btn-play-toggle');
    async function togglePlayback() {
        if (!isPlaying) {
            isPlaying = true;
            await startAudio();
            if (btnPlayToggle) {
                btnPlayToggle.classList.add('playing');
                btnPlayToggle.title = 'Parar Síntese (Espaço)';
            }
        } else {
            isPlaying = false;
            if (btnPlayToggle) {
                btnPlayToggle.classList.remove('playing');
                btnPlayToggle.title = 'Iniciar Síntese (Espaço)';
            }
        }
    }

    if (btnPlayToggle) btnPlayToggle.addEventListener('click', togglePlayback);

    document.getElementById('btn-add-module').addEventListener('click', openAddModuleModal);
    document.getElementById('btn-close-add-modal').addEventListener('click', closeAddModuleModal);
    document.getElementById('btn-cancel-add-modal').addEventListener('click', closeAddModuleModal);

    document.getElementById('btn-close-drawer').addEventListener('click', closeScratchEditor);

    // Project Toolbar Event Handlers
    const projectSelect = document.getElementById('project-select');
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnSaveAsProject = document.getElementById('btn-save-as-project');
    const btnNewProject = document.getElementById('btn-new-project');
    const btnManageProjects = document.getElementById('btn-manage-projects');
    const btnExportProject = document.getElementById('btn-export-project');
    const btnImportProject = document.getElementById('btn-import-project');
    const fileInputProject = document.getElementById('file-input-project');
    const btnClearRack = document.getElementById('btn-clear-rack');

    projectSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        const loaded = projectsManager.loadProject(id);
        if (loaded) {
            const proj = projectsManager.getProject(id);
            showToast(`Carregado: ${proj ? proj.name : id}`);
        }
    });

    btnSaveProject.addEventListener('click', () => {
        const currentId = projectsManager.getActiveProjectId();
        const current = projectsManager.getProject(currentId);

        if (current && current.isExample) {
            const name = prompt(`Você está editando um patch de exemplo.\nDigite o nome para salvar sua cópia personalizada:`, `${current.name} (Minha Cópia)`);
            if (name && name.trim()) {
                const saved = projectsManager.saveAsNewProject(name.trim());
                updateProjectSelect();
                showToast(`Salvo como novo patch: ${saved.name}`);
            }
        } else {
            const saved = projectsManager.saveCurrentProject();
            updateProjectSelect();
            showToast(`Patch salvo: ${saved ? saved.name : ''}`);
        }
    });

    btnSaveAsProject.addEventListener('click', () => {
        const currentId = projectsManager.getActiveProjectId();
        const current = projectsManager.getProject(currentId);
        const defaultName = current ? `${current.name} (Cópia)` : 'Novo Patch';

        const name = prompt('Nome para o novo patch:', defaultName);
        if (name && name.trim()) {
            const saved = projectsManager.saveAsNewProject(name.trim());
            updateProjectSelect();
            showToast(`Patch salvo: ${saved.name}`);
        }
    });

    btnNewProject.addEventListener('click', () => {
        if (confirm('Deseja criar um rack novo em branco?')) {
            rackEngine.clear();
            rackEngine.addModule('master_out', 600, 100, 'Master Output');
            rackCanvas.render();
            const newProj = projectsManager.saveAsNewProject('Novo Patch ' + (projectsManager.getAllProjects().length + 1));
            updateProjectSelect();
            showToast(`Novo rack criado: ${newProj.name}`);
        }
    });

    btnManageProjects.addEventListener('click', openProjectsModal);

    btnExportProject.addEventListener('click', () => {
        const activeId = projectsManager.getActiveProjectId();
        const proj = projectsManager.getProject(activeId);
        projectsManager.exportProjectJson(activeId);
        showToast(`Exportando: ${proj ? proj.name : 'patch'}`);
    });

    btnImportProject.addEventListener('click', () => {
        fileInputProject.value = '';
        fileInputProject.click();
    });

    fileInputProject.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported = projectsManager.importProjectJson(evt.target.result);
                updateProjectSelect();
                showToast(`Patch importado: ${imported.name}`);
            } catch (err) {
                alert('Erro ao importar arquivo: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    btnClearRack.addEventListener('click', () => {
        if (confirm('Limpar todos os módulos do rack?')) {
            rackEngine.clear();
            rackCanvas.render();
            showToast('Rack limpo', 'warn');
        }
    });

    // Modal Event Handlers
    document.getElementById('btn-modal-close').addEventListener('click', closeProjectsModal);
    document.getElementById('btn-modal-done').addEventListener('click', closeProjectsModal);

    const modalOverlay = document.getElementById('projects-modal');
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeProjectsModal();
    });

    document.getElementById('modal-search-input').addEventListener('input', (e) => {
        renderModalProjectsList(e.target.value);
    });

    document.getElementById('btn-modal-new-proj').addEventListener('click', () => {
        const name = prompt('Nome para o novo patch:', 'Novo Patch');
        if (name && name.trim()) {
            rackEngine.clear();
            rackEngine.addModule('master_out', 600, 100, 'Master Output');
            rackCanvas.render();
            const p = projectsManager.saveAsNewProject(name.trim());
            updateProjectSelect();
            renderModalProjectsList('');
            closeProjectsModal();
            showToast(`Patch criado: ${p.name}`);
        }
    });

    document.getElementById('btn-modal-import-proj').addEventListener('click', () => {
        fileInputProject.value = '';
        fileInputProject.click();
    });

    document.getElementById('btn-modal-reset-examples').addEventListener('click', () => {
        if (confirm('Deseja restaurar todos os patches originais de fábrica?')) {
            projectsManager.resetFactoryExamples();
            updateProjectSelect();
            renderModalProjectsList('');
            showToast('Exemplos de fábrica restaurados!');
        }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            togglePlayback();
            return;
        }
        if (e.code === 'Escape') {
            closeScratchEditor();
            closeAddModuleModal();
            closeProjectsModal();
            return;
        }
    });
});
