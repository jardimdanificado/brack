/**
 * =========================================================================
 * BRACK Modular Synth Engine (web/app.js)
 * Fullscreen Canvas, Clean Typography, 48kHz Real-Time DSP,
 * and Persistent Project / Example Management
 * =========================================================================
 */

import { registerSynthBlocks } from './synth_blocks.js';
import { BlocklySynthEngine } from './blockly_dsp_compiler.js';
import { ProjectsManager } from './projects_manager.js';

let audioCtx = null;
let scriptNode = null;
let isPlaying = false;
let synthEngine = null;
let workspace = null;
let projectsManager = null;

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

async function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        const bufferSize = 512;
        scriptNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);

        scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            for (let offset = 0; offset < bufferSize; offset += BLOCK_SIZE) {
                if (synthEngine && isPlaying) {
                    synthEngine.processBlock(outL, outR, offset, BLOCK_SIZE);
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
    examplesGroup.label = 'Exemplos Prontos';

    const userGroup = document.createElement('optgroup');
    userGroup.label = 'Meus Projetos';

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
                Nenhum projeto ou exemplo encontrado para "<b>${filterQuery}</b>".
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
        nameSpan.className = 'project-name';
        nameSpan.textContent = proj.name;

        const badge = document.createElement('span');
        badge.className = `badge ${proj.isExample ? 'badge-example' : 'badge-user'}`;
        badge.textContent = proj.isExample ? 'Exemplo' : 'Projeto';

        titleRow.appendChild(nameSpan);
        titleRow.appendChild(badge);

        if (isActive) {
            const activeBadge = document.createElement('span');
            activeBadge.className = 'badge badge-active';
            activeBadge.textContent = 'Ativo';
            titleRow.appendChild(activeBadge);
        }

        const desc = document.createElement('div');
        desc.className = 'project-desc';
        desc.textContent = proj.description || (proj.isExample ? 'Preset original de fábrica' : 'Projeto salvo pelo usuário');

        const dateEl = document.createElement('div');
        dateEl.className = 'project-date';
        const dateStr = proj.updatedAt ? new Date(proj.updatedAt).toLocaleString('pt-BR') : 'Original';
        dateEl.textContent = `Atualizado: ${dateStr}`;

        info.appendChild(titleRow);
        info.appendChild(desc);
        info.appendChild(dateEl);

        const actions = document.createElement('div');
        actions.className = 'project-actions';

        // Load Button
        const btnLoad = document.createElement('button');
        btnLoad.className = 'btn-sm btn-primary';
        btnLoad.textContent = 'Abrir';
        btnLoad.title = 'Carregar este projeto na área de trabalho';
        btnLoad.addEventListener('click', () => {
            projectsManager.loadProject(proj.id);
            updateProjectSelect();
            renderModalProjectsList(filterQuery);
            closeProjectsModal();
            showToast(`Projeto aberto: ${proj.name}`);
        });

        // Duplicate Button
        const btnDup = document.createElement('button');
        btnDup.className = 'btn-sm';
        btnDup.textContent = 'Duplicar';
        btnDup.title = 'Criar uma cópia deste projeto';
        btnDup.addEventListener('click', () => {
            const copy = projectsManager.duplicateProject(proj.id);
            if (copy) {
                updateProjectSelect();
                renderModalProjectsList(filterQuery);
                showToast(`Cópia criada: ${copy.name}`);
            }
        });

        // Export Button
        const btnExport = document.createElement('button');
        btnExport.className = 'btn-sm';
        btnExport.textContent = 'Exportar';
        btnExport.title = 'Baixar arquivo .json';
        btnExport.addEventListener('click', () => {
            projectsManager.exportProjectJson(proj.id);
            showToast(`Exportando: ${proj.name}`);
        });

        actions.appendChild(btnLoad);
        actions.appendChild(btnDup);
        actions.appendChild(btnExport);

        // Rename & Delete for user projects
        if (!proj.isExample) {
            const btnRename = document.createElement('button');
            btnRename.className = 'btn-sm';
            btnRename.textContent = 'Renomear';
            btnRename.addEventListener('click', () => {
                const newName = prompt('Novo nome para o projeto:', proj.name);
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
                if (confirm(`Tem certeza que deseja excluir o projeto "${proj.name}"?`)) {
                    projectsManager.deleteProject(proj.id);
                    updateProjectSelect();
                    renderModalProjectsList(filterQuery);
                    showToast(`Projeto excluído: ${proj.name}`, 'warn');
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
 * Application Initialization
 * ========================================================================= */

window.addEventListener('DOMContentLoaded', () => {
    // 1. Register Synth Blocks
    registerSynthBlocks(Blockly);

    // 2. Lock Flyout Scale to Fixed Crisp Size (Blocks in selection palette never scale with canvas zoom)
    const FIXED_FLYOUT_SCALE = 0.85;

    if (Blockly.Flyout) {
        Blockly.Flyout.prototype.getFlyoutScale = function() {
            return FIXED_FLYOUT_SCALE;
        };
    }

    if (Blockly.VerticalFlyout) {
        Blockly.VerticalFlyout.prototype.getFlyoutScale = function() {
            return FIXED_FLYOUT_SCALE;
        };

        Blockly.VerticalFlyout.prototype.layout_ = function(a, b) {
            this.workspace_.scale = FIXED_FLYOUT_SCALE;
            let c = this.MARGIN;
            const d = this.RTL ? c : c + this.tabWidth_;
            for (let h = 0, k; (k = a[h]); h++) {
                if ("block" === k.type) {
                    const e = k.block;
                    if (!e) continue;
                    const f = e.getDescendants(false);
                    for (let m = 0, n; (n = f[m]); m++) n.isInFlyout = true;
                    const svgRoot = e.getSvgRoot();
                    const l = e.getHeightWidth();
                    const g = e.outputConnection ? d - this.tabWidth_ : d;
                    e.moveBy(g, c);
                    const rect = this.createRect_(e, this.RTL ? g - l.width : g, c, l, h);
                    this.addBlockListeners_(svgRoot, e, rect);
                    c += l.height + b[h];
                } else if ("button" === k.type) {
                    const e = k.button;
                    this.initFlyoutButton_(e, d, c);
                    c += e.height + b[h];
                }
            }
        };
    }

    if (Blockly.HorizontalFlyout) {
        Blockly.HorizontalFlyout.prototype.getFlyoutScale = function() {
            return FIXED_FLYOUT_SCALE;
        };
    }

    // 3. Define Clean Dark Theme for Blockly
    const scratchTheme = Blockly.Theme.defineTheme('scratchTheme', {
        base: Blockly.Themes.Classic,
        blockStyles: {
            hat_blocks: {
                colourPrimary: "#FFAB19",
                colourSecondary: "#E69900",
                colourTertiary: "#CC8800"
            }
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

    // 4. Inject Blockly Workspace (Fullscreen)
    workspace = Blockly.inject('blockly-div', {
        toolbox: document.getElementById('toolbox'),
        grid: {
            spacing: 25,
            length: 3,
            colour: '#1c2823',
            snap: true
        },
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.85,
            maxScale: 2.0,
            minScale: 0.4,
            scaleSpeed: 1.1
        },
        trashcan: true,
        theme: scratchTheme
    });

    // 4. Handle Fullscreen Responsive Canvas Resizing
    window.addEventListener('resize', () => {
        if (workspace) {
            Blockly.svgResize(workspace);
        }
    });
    setTimeout(() => {
        if (workspace) Blockly.svgResize(workspace);
    }, 100);

    // 5. Initialize Real-Time DSP Engine
    synthEngine = new BlocklySynthEngine(48000);
    synthEngine.setWorkspace(workspace);

    // 6. Initialize Projects & Examples Manager
    projectsManager = new ProjectsManager(workspace, synthEngine);

    // Load active or default preset
    const initialProjId = projectsManager.getActiveProjectId();
    projectsManager.loadProject(initialProjId);
    updateProjectSelect();

    // Re-compile audio graph on block changes
    workspace.addChangeListener((e) => {
        if (e.isUiEvent) return;
        synthEngine.compile();
    });

    // 7. Header Controls (Unified Play / Stop Toggle)
    const btnPlayToggle = document.getElementById('btn-play-toggle');

    async function togglePlayback() {
        if (!isPlaying) {
            await startAudio();
            isPlaying = true;
            if (btnPlayToggle) {
                btnPlayToggle.classList.add('playing');
                btnPlayToggle.title = 'Parar Síntese';
            }
        } else {
            isPlaying = false;
            if (btnPlayToggle) {
                btnPlayToggle.classList.remove('playing');
                btnPlayToggle.title = 'Iniciar Síntese';
            }
        }
    }

    if (btnPlayToggle) {
        btnPlayToggle.addEventListener('click', togglePlayback);
    }

    // 7.5 Toolbox Toggle Controller (Header Bar Toggle & Shortcut)
    let isToolboxVisible = true;
    const blocklyDiv = document.getElementById('blockly-div');
    const btnToggleToolbox = document.getElementById('btn-toggle-toolbox');

    function toggleToolbox(forceState) {
        if (forceState !== undefined) {
            isToolboxVisible = forceState;
        } else {
            isToolboxVisible = !isToolboxVisible;
        }

        if (blocklyDiv) {
            if (isToolboxVisible) {
                blocklyDiv.classList.remove('toolbox-hidden');
            } else {
                blocklyDiv.classList.add('toolbox-hidden');
                try {
                    if (workspace && workspace.getFlyout()) {
                        workspace.getFlyout().hide();
                    }
                    if (workspace && workspace.getToolbox() && typeof workspace.getToolbox().clearSelection === 'function') {
                        workspace.getToolbox().clearSelection();
                    }
                } catch (err) {}
            }
        }

        if (btnToggleToolbox) {
            if (isToolboxVisible) {
                btnToggleToolbox.classList.add('btn-primary');
                btnToggleToolbox.classList.remove('btn-warn');
                btnToggleToolbox.title = 'Ocultar Barra Lateral de Blocos (B)';
            } else {
                btnToggleToolbox.classList.remove('btn-primary');
                btnToggleToolbox.classList.add('btn-warn');
                btnToggleToolbox.title = 'Mostrar Barra Lateral de Blocos (B)';
            }
        }

        if (workspace) {
            Blockly.svgResize(workspace);
        }
    }

    if (btnToggleToolbox) {
        btnToggleToolbox.addEventListener('click', () => toggleToolbox());
    }

    // 8. Project Toolbar Event Handlers
    const projectSelect = document.getElementById('project-select');
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnSaveAsProject = document.getElementById('btn-save-as-project');
    const btnNewProject = document.getElementById('btn-new-project');
    const btnManageProjects = document.getElementById('btn-manage-projects');
    const btnExportProject = document.getElementById('btn-export-project');
    const btnImportProject = document.getElementById('btn-import-project');
    const fileInputProject = document.getElementById('file-input-project');
    const btnClearWorkspace = document.getElementById('btn-clear-workspace');

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
            const name = prompt(`Você está editando um exemplo de fábrica.\nDigite o nome para salvar sua cópia personalizada:`, `${current.name} (Minha Cópia)`);
            if (name && name.trim()) {
                const saved = projectsManager.saveAsNewProject(name.trim());
                updateProjectSelect();
                showToast(`Salvo como novo projeto: ${saved.name}`);
            }
        } else {
            const saved = projectsManager.saveCurrentProject();
            updateProjectSelect();
            showToast(`Projeto salvo: ${saved ? saved.name : ''}`);
        }
    });

    btnSaveAsProject.addEventListener('click', () => {
        const currentId = projectsManager.getActiveProjectId();
        const current = projectsManager.getProject(currentId);
        const defaultName = current ? `${current.name} (Cópia)` : 'Novo Patch';

        const name = prompt('Nome para o novo projeto:', defaultName);
        if (name && name.trim()) {
            const saved = projectsManager.saveAsNewProject(name.trim());
            updateProjectSelect();
            showToast(`Projeto salvo: ${saved.name}`);
        }
    });

    btnNewProject.addEventListener('click', () => {
        if (confirm('Deseja criar um novo projeto em branco?')) {
            workspace.clear();
            const newProj = projectsManager.saveAsNewProject('Novo Projeto ' + (projectsManager.getAllProjects().length + 1));
            updateProjectSelect();
            synthEngine.compile();
            showToast(`Novo projeto criado: ${newProj.name}`);
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
                showToast(`Projeto importado: ${imported.name}`);
            } catch (err) {
                alert('Erro ao importar arquivo: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    btnClearWorkspace.addEventListener('click', () => {
        if (confirm('Limpar todos os blocos da área de trabalho?')) {
            workspace.clear();
            synthEngine.compile();
            showToast('Área de trabalho limpa', 'warn');
        }
    });

    // 9. Modal Event Handlers
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
        const name = prompt('Nome para o novo projeto:', 'Novo Patch');
        if (name && name.trim()) {
            workspace.clear();
            const p = projectsManager.saveAsNewProject(name.trim());
            updateProjectSelect();
            renderModalProjectsList('');
            synthEngine.compile();
            closeProjectsModal();
            showToast(`Projeto criado: ${p.name}`);
        }
    });

    document.getElementById('btn-modal-import-proj').addEventListener('click', () => {
        fileInputProject.value = '';
        fileInputProject.click();
    });

    document.getElementById('btn-modal-reset-examples').addEventListener('click', () => {
        if (confirm('Deseja restaurar todos os 6 exemplos originais de fábrica? (Seus projetos pessoais não serão apagados)')) {
            projectsManager.resetFactoryExamples();
            updateProjectSelect();
            renderModalProjectsList('');
            showToast('Exemplos de fábrica restaurados!');
        }
    });

    // Keyboard Event Listener for `event_whenkeypressed` & Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            toggleToolbox();
            return;
        }
        if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            togglePlayback();
            return;
        }
        if (synthEngine) synthEngine.onKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (synthEngine) synthEngine.onKeyUp(e.code);
    });

    // 10. Live Oscilloscope Display Render Loop
    function renderLiveOscilloscopes() {
        if (workspace && synthEngine) {
            const scopeBlocks = workspace.getAllBlocks(false).filter(b => b.type === 'synth_scope');

            for (const block of scopeBlocks) {
                const fieldImg = block.getField('SCOPE_IMG');
                if (!fieldImg) continue;
                const fieldSvgRoot = fieldImg.getSvgRoot();
                if (!fieldSvgRoot) continue;
                const parentGroup = fieldSvgRoot.parentNode;
                if (!parentGroup) continue;

                fieldSvgRoot.style.display = 'none';

                let posX = 16;
                let posY = 64;
                try {
                    const bbox = fieldSvgRoot.getBBox ? fieldSvgRoot.getBBox() : null;
                    if (bbox && bbox.y > 10) {
                        posX = bbox.x;
                        posY = bbox.y;
                    }
                } catch (e) {
                    // getBBox fallback
                }

                let scopeGroup = parentGroup.querySelector('.blockly-scope-display');
                if (!scopeGroup) {
                    scopeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    scopeGroup.setAttribute('class', 'blockly-scope-display');
                    scopeGroup.setAttribute('transform', `translate(${posX}, ${posY})`);

                    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    bgRect.setAttribute('x', '0');
                    bgRect.setAttribute('y', '0');
                    bgRect.setAttribute('width', '180');
                    bgRect.setAttribute('height', '60');
                    bgRect.setAttribute('rx', '4');
                    bgRect.setAttribute('fill', '#060a08');
                    bgRect.setAttribute('stroke', '#1f3329');
                    bgRect.setAttribute('stroke-width', '1.5');

                    const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    centerLine.setAttribute('x1', '0');
                    centerLine.setAttribute('y1', '30');
                    centerLine.setAttribute('x2', '180');
                    centerLine.setAttribute('y2', '30');
                    centerLine.setAttribute('stroke', '#121f18');
                    centerLine.setAttribute('stroke-dasharray', '3,3');

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('class', 'scope-waveform');
                    path.setAttribute('d', 'M 0 30 L 180 30');
                    path.setAttribute('stroke', '#55efc4');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke-linecap', 'round');
                    path.setAttribute('stroke-linejoin', 'round');

                    scopeGroup.appendChild(bgRect);
                    scopeGroup.appendChild(centerLine);
                    scopeGroup.appendChild(path);
                    parentGroup.appendChild(scopeGroup);
                } else {
                    scopeGroup.setAttribute('transform', `translate(${posX}, ${posY})`);
                }

                const state = synthEngine.blockStates.get(block.id);
                const pathEl = scopeGroup.querySelector('.scope-waveform');
                if (!pathEl) continue;

                if (isPlaying && state && state.history) {
                    const hist = state.history;
                    const head = state.histHead;
                    const len = 512;

                    let start = (head - 256 + len) % len;
                    for (let i = 0; i < 96; i++) {
                        const idx1 = (head - 256 + i + len) % len;
                        const idx2 = (idx1 + 1) % len;
                        if (hist[idx1] <= 0 && hist[idx2] > 0) {
                            start = idx2;
                            break;
                        }
                    }

                    const width = 180;
                    const midY = 30;
                    const samplesToShow = 256;
                    const points = [];

                    for (let x = 0; x < width; x += 2) {
                        const idx = (start + Math.floor(x * (samplesToShow / width))) % len;
                        const smp = Math.max(-1.1, Math.min(1.1, hist[idx] || 0));
                        const y = midY - smp * (midY - 4);
                        points.push(`${x},${y.toFixed(1)}`);
                    }

                    pathEl.setAttribute('d', 'M ' + points.join(' L '));
                } else {
                    pathEl.setAttribute('d', 'M 0 30 L 180 30');
                }
            }
        }
        requestAnimationFrame(renderLiveOscilloscopes);
    }

    renderLiveOscilloscopes();
});
