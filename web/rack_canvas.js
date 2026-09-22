/**
 * =========================================================================
 * BRACK Modular Rack UI & Interactive Patch Cord Canvas (web/rack_canvas.js)
 * Eurorack-Style Faceplates, Rotatable Knobs & Realistic Sagging Patch Cords
 * =========================================================================
 */

export class RackCanvas {
    constructor(containerEl, rackEngine, options = {}) {
        this.container = containerEl;
        this.engine = rackEngine;
        this.onEditModule = options.onEditModule || (() => {});
        this.onModuleChange = options.onModuleChange || (() => {});

        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;

        // Interaction state
        this.draggedModule = null;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedKnob = null;
        this.knobStartY = 0;
        this.knobStartVal = 0;

        // Cable dragging state
        this.cableDrag = null; // { fromModuleId, fromPort, isOutput, startX, startY, currentX, currentY, color }

        this.initDOM();
        this.attachEvents();
        this.render();
    }

    initDOM() {
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.background = 'var(--bg-chassis, #060a0e)';
        this.container.style.userSelect = 'none';

        // World Container that gets panned/zoomed
        this.world = document.createElement('div');
        this.world.className = 'rack-world';
        this.world.style.position = 'absolute';
        this.world.style.transformOrigin = '0 0';
        this.world.style.width = '5000px';
        this.world.style.height = '3000px';
        // Y2K Cyberdeck grid + aluminum mounting rails background
        this.world.style.backgroundImage = `
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.4) 100%)
        `;
        this.world.style.backgroundSize = '32px 32px, 32px 32px, 100% 100%';

        // Modules layer (underneath cables)
        this.modulesContainer = document.createElement('div');
        this.modulesContainer.className = 'rack-modules-layer';
        this.modulesContainer.style.position = 'absolute';
        this.modulesContainer.style.top = '0';
        this.modulesContainer.style.left = '0';
        this.modulesContainer.style.zIndex = '5';
        this.world.appendChild(this.modulesContainer);

        // SVG layer for patch cables (rendered on top of modules)
        this.svgCables = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgCables.setAttribute('class', 'rack-cables-layer');
        this.svgCables.style.position = 'absolute';
        this.svgCables.style.top = '0';
        this.svgCables.style.left = '0';
        this.svgCables.style.width = '100%';
        this.svgCables.style.height = '100%';
        this.svgCables.style.zIndex = '30';
        this.svgCables.style.pointerEvents = 'none';

        // SVG Filter Definitions for Neon Glowing Cables
        this.svgCables.innerHTML = `
            <defs>
                <filter id="neon-glow-audio" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
        `;

        this.world.appendChild(this.svgCables);
        this.container.appendChild(this.world);
    }

    updateTransform() {
        this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }

    screenToWorld(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        const x = (clientX - rect.left - this.panX) / this.zoom;
        const y = (clientY - rect.top - this.panY) / this.zoom;
        return { x, y };
    }

    getJackPosition(moduleId, portName, isOutput) {
        const modEl = this.modulesContainer.querySelector(`[data-module-id="${moduleId}"]`);
        if (!modEl) return { x: 0, y: 0 };

        const jackEl = modEl.querySelector(`[data-port="${portName}"][data-is-out="${isOutput}"]`);
        if (!jackEl) {
            const mod = this.engine.getModule(moduleId);
            return { x: mod ? mod.x + 50 : 0, y: mod ? mod.y + 50 : 0 };
        }

        const mod = this.engine.getModule(moduleId);
        const jackRect = jackEl.getBoundingClientRect();
        const modRect = modEl.getBoundingClientRect();

        const relX = (jackRect.left + jackRect.width / 2 - modRect.left) / this.zoom;
        const relY = (jackRect.top + jackRect.height / 2 - modRect.top) / this.zoom;

        return { x: mod.x + relX, y: mod.y + relY };
    }

    render() {
        this.renderModules();
        this.renderCables();
    }

    renderModules() {
        this.modulesContainer.innerHTML = '';

        for (const mod of this.engine.modules) {
            const card = document.createElement('div');
            card.className = 'rack-module';
            card.dataset.moduleId = mod.id;
            card.style.position = 'absolute';
            card.style.left = `${mod.x}px`;
            card.style.top = `${mod.y}px`;
            card.style.width = `${mod.width}px`;
            card.style.minHeight = `${mod.height}px`;
            // Exact Y2K Titanium / Brushed Chrome Chassis like Header
            card.style.background = 'var(--metal-faceplate)';
            card.style.border = '1px solid var(--metal-border, #485460)';
            card.style.borderTop = '1px solid var(--header-border-top, rgba(255, 255, 255, 0.45))';
            card.style.borderBottom = '2px solid var(--header-border-bottom, #080c10)';
            card.style.borderRadius = '6px';
            card.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.8)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.zIndex = '5';

            // Top screw rail with crosshead screws
            const screwHeader = document.createElement('div');
            screwHeader.style.height = '14px';
            screwHeader.style.background = 'var(--screw-rail)';
            screwHeader.style.borderTopLeftRadius = '5px';
            screwHeader.style.borderTopRightRadius = '5px';
            screwHeader.style.borderBottom = '1px solid var(--header-border-bottom, #080c10)';
            screwHeader.style.display = 'flex';
            screwHeader.style.justifyContent = 'space-between';
            screwHeader.style.alignItems = 'center';
            screwHeader.style.padding = '0 8px';
            screwHeader.innerHTML = `
                <div style="width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffffff 0%, #b2bec3 40%, #636e72 70%, #2d3436 100%); border: 1px solid #141c22; box-shadow: inset 0 1px 1px #ffffff, 0 1px 2px rgba(0,0,0,0.8); position: relative;">
                    <div style="position: absolute; top: 3.5px; left: 1.5px; width: 5px; height: 1px; background: #141c22;"></div>
                    <div style="position: absolute; top: 1.5px; left: 3.5px; width: 1px; height: 5px; background: #141c22;"></div>
                </div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffffff 0%, #b2bec3 40%, #636e72 70%, #2d3436 100%); border: 1px solid #141c22; box-shadow: inset 0 1px 1px #ffffff, 0 1px 2px rgba(0,0,0,0.8); position: relative;">
                    <div style="position: absolute; top: 3.5px; left: 1.5px; width: 5px; height: 1px; background: #141c22;"></div>
                    <div style="position: absolute; top: 1.5px; left: 3.5px; width: 1px; height: 5px; background: #141c22;"></div>
                </div>
            `;
            card.appendChild(screwHeader);

            // Module Title Header (Drag Handle)
            const header = document.createElement('div');
            header.className = 'module-header';
            header.style.padding = '6px 8px';
            header.style.background = 'var(--bg-header)';
            header.style.borderTop = '1px solid var(--header-border-top, rgba(255, 255, 255, 0.45))';
            header.style.borderBottom = '2px solid var(--header-border-bottom, #080c10)';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.cursor = 'grab';
            header.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.35)';

            const titleLeft = document.createElement('div');
            titleLeft.style.display = 'flex';
            titleLeft.style.alignItems = 'center';
            titleLeft.style.gap = '6px';

            // Glowing LED indicator dot
            const ledDot = document.createElement('div');
            ledDot.style.width = '7px';
            ledDot.style.height = '7px';
            ledDot.style.borderRadius = '50%';
            ledDot.style.background = mod.color || 'var(--neon-accent, #00f2fe)';
            ledDot.style.boxShadow = `0 0 8px ${mod.color || 'var(--neon-accent, #00f2fe)'}, inset 0 1px 1px #ffffff`;
            ledDot.style.border = '1px solid rgba(255,255,255,0.6)';
            titleLeft.appendChild(ledDot);

            // Chrome Metallic Text with Cyan Glow (Like Header H1)
            const titleSpan = document.createElement('span');
            titleSpan.textContent = mod.name.toUpperCase();
            titleSpan.title = 'Duplo clique para abrir editor Scratch';
            titleSpan.style.fontFamily = "'Orbitron', sans-serif";
            titleSpan.style.fontWeight = '900';
            titleSpan.style.fontSize = '11px';
            titleSpan.style.letterSpacing = '1.2px';
            titleSpan.style.background = 'var(--title-gradient)';
            titleSpan.style.webkitBackgroundClip = 'text';
            titleSpan.style.webkitTextFillColor = 'transparent';
            titleSpan.style.filter = 'drop-shadow(0 0 6px var(--neon-accent, #00f2fe))';
            titleLeft.appendChild(titleSpan);

            header.appendChild(titleLeft);

            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '4px';

            // Scratch Code Edit Button (Aqua / Metallic Glass like Header Buttons)
            const btnCode = document.createElement('button');
            btnCode.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;
            btnCode.title = 'Editar Código Scratch deste módulo';
            btnCode.style.background = 'linear-gradient(180deg, var(--neon-accent, #00f2fe) 0%, #0984e3 52%, var(--neon-secondary, #00cec9) 100%)';
            btnCode.style.border = '1px solid rgba(255,255,255,0.6)';
            btnCode.style.borderBottom = '1px solid #0652dd';
            btnCode.style.padding = '2px 5px';
            btnCode.style.borderRadius = '3px';
            btnCode.style.cursor = 'pointer';
            btnCode.style.color = '#ffffff';
            btnCode.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8), 0 0 8px var(--neon-accent, #00f2fe)';
            btnCode.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onEditModule(mod);
            });
            btnGroup.appendChild(btnCode);

            // Close / Delete Button (except Master Out)
            if (!mod.isTerminal) {
                const btnDel = document.createElement('button');
                btnDel.innerHTML = '✕';
                btnDel.title = 'Excluir módulo';
                btnDel.style.background = 'linear-gradient(180deg, #ff7675 0%, #d63031 48%, #c0392b 52%, #e74c3c 100%)';
                btnDel.style.border = '1px solid #ffaaaa';
                btnDel.style.borderBottom = '1px solid #801010';
                btnDel.style.padding = '2px 5px';
                btnDel.style.borderRadius = '3px';
                btnDel.style.fontSize = '9px';
                btnDel.style.color = '#ffffff';
                btnDel.style.cursor = 'pointer';
                btnDel.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.7), 0 0 8px rgba(255, 56, 56, 0.4)';
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Excluir módulo "${mod.name}"?`)) {
                        this.engine.removeModule(mod.id);
                        this.render();
                        this.onModuleChange();
                    }
                });
                btnGroup.appendChild(btnDel);
            }

            header.appendChild(btnGroup);
            card.appendChild(header);

            // Double click header or body opens Scratch editor
            card.addEventListener('dblclick', (e) => {
                if (e.target.tagName !== 'BUTTON' && !e.target.closest('.rack-knob') && !e.target.closest('.rack-jack')) {
                    this.onEditModule(mod);
                }
            });

            // Module Body (Subpanel background with high-contrast bevel)
            const body = document.createElement('div');
            body.style.flex = '1';
            body.style.margin = '4px 6px 6px 6px';
            body.style.padding = '8px 6px';
            body.style.background = 'var(--metal-subpanel)';
            body.style.border = '1px solid var(--subpanel-border, #283743)';
            body.style.borderTop = '1px solid var(--header-border-top, #3d4f5c)';
            body.style.borderBottom = '1px solid var(--header-border-bottom, #080c10)';
            body.style.borderRadius = '4px';
            body.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.08)';
            body.style.display = 'flex';
            body.style.gap = '6px';
            body.style.justifyContent = 'space-between';

            // Left Column: Inputs
            const inputsCol = document.createElement('div');
            inputsCol.style.display = 'flex';
            inputsCol.style.flexDirection = 'column';
            inputsCol.style.gap = '8px';
            inputsCol.style.minWidth = '42px';

            for (const inp of mod.inputs) {
                inputsCol.appendChild(this.createJackElement(mod.id, inp.name, inp.type, false));
            }
            body.appendChild(inputsCol);

            // Center Column: Controls (Knobs, Sliders, ADSR Curve, XY Pad, WaveDraw, Switches)
            const knobsCol = document.createElement('div');
            knobsCol.style.flex = '1';
            knobsCol.style.display = 'flex';
            knobsCol.style.flexDirection = 'column';
            knobsCol.style.alignItems = 'center';
            knobsCol.style.gap = '8px';

            // Check if module is an ADSR envelope to render visual curve
            const isAdsr = mod.type === 'adsr' || mod.params.some(p => p.name.toLowerCase() === 'attack') && mod.params.some(p => p.name.toLowerCase() === 'release');
            if (isAdsr) {
                knobsCol.appendChild(this.createAdsrCurveElement(mod.id, mod));
            }

            // Check if multiple sliders should be arranged horizontally (like Graphic EQ)
            const allSliders = mod.params.length > 1 && mod.params.every(p => p.type === 'SLIDER');
            if (allSliders) {
                const sliderRow = document.createElement('div');
                sliderRow.style.display = 'flex';
                sliderRow.style.gap = '6px';
                sliderRow.style.alignItems = 'flex-end';
                for (const param of mod.params) {
                    sliderRow.appendChild(this.createSliderElement(mod.id, param));
                }
                knobsCol.appendChild(sliderRow);
            } else {
                for (const param of mod.params) {
                    if (param.type === 'SLIDER') {
                        knobsCol.appendChild(this.createSliderElement(mod.id, param));
                    } else if (param.type === 'SWITCH') {
                        knobsCol.appendChild(this.createSwitchElement(mod.id, param));
                    } else if (param.type === 'XY_PAD') {
                        knobsCol.appendChild(this.createXyPadElement(mod.id, param));
                    } else if (param.type === 'WAVE_DRAW') {
                        knobsCol.appendChild(this.createWaveDrawElement(mod.id, param));
                    } else {
                        knobsCol.appendChild(this.createKnobElement(mod.id, param));
                    }
                }
            }
            body.appendChild(knobsCol);

            // Right Column: Outputs
            const outputsCol = document.createElement('div');
            outputsCol.style.display = 'flex';
            outputsCol.style.flexDirection = 'column';
            outputsCol.style.alignItems = 'flex-end';
            outputsCol.style.gap = '8px';
            outputsCol.style.minWidth = '42px';

            for (const out of mod.outputs) {
                outputsCol.appendChild(this.createJackElement(mod.id, out.name, out.type, true));
            }
            body.appendChild(outputsCol);

            card.appendChild(body);

            // Bottom screw rail with crosshead screws
            const screwFooter = document.createElement('div');
            screwFooter.style.height = '14px';
            screwFooter.style.background = 'var(--screw-rail)';
            screwFooter.style.borderBottomLeftRadius = '5px';
            screwFooter.style.borderBottomRightRadius = '5px';
            screwFooter.style.borderTop = '1px solid var(--subpanel-border, #283743)';
            screwFooter.style.display = 'flex';
            screwFooter.style.justifyContent = 'space-between';
            screwFooter.style.alignItems = 'center';
            screwFooter.style.padding = '0 8px';
            screwFooter.innerHTML = `
                <div style="width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffffff 0%, #b2bec3 40%, #636e72 70%, #2d3436 100%); border: 1px solid #141c22; box-shadow: inset 0 1px 1px #ffffff, 0 1px 2px rgba(0,0,0,0.8); position: relative;">
                    <div style="position: absolute; top: 3.5px; left: 1.5px; width: 5px; height: 1px; background: #141c22;"></div>
                    <div style="position: absolute; top: 1.5px; left: 3.5px; width: 1px; height: 5px; background: #141c22;"></div>
                </div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffffff 0%, #b2bec3 40%, #636e72 70%, #2d3436 100%); border: 1px solid #141c22; box-shadow: inset 0 1px 1px #ffffff, 0 1px 2px rgba(0,0,0,0.8); position: relative;">
                    <div style="position: absolute; top: 3.5px; left: 1.5px; width: 5px; height: 1px; background: #141c22;"></div>
                    <div style="position: absolute; top: 1.5px; left: 3.5px; width: 1px; height: 5px; background: #141c22;"></div>
                </div>
            `;
            card.appendChild(screwFooter);

            // Module drag start listener
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.target.tagName === 'BUTTON') return;
                this.draggedModule = mod;
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                this.dragOffset = { x: worldPos.x - mod.x, y: worldPos.y - mod.y };
                card.style.zIndex = '10';
                e.preventDefault();
            });

            this.modulesContainer.appendChild(card);
        }
    }

    createJackElement(moduleId, portName, type, isOutput) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-jack-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = isOutput ? 'flex-end' : 'flex-start';
        wrap.style.gap = '2px';

        const label = document.createElement('span');
        label.textContent = portName;
        label.style.fontSize = '9px';
        label.style.fontFamily = "'Share Tech Mono', monospace";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-dim, #a4b0be)';
        label.style.whiteSpace = 'nowrap';
        label.style.maxWidth = '55px';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.letterSpacing = '0.5px';

        const portColor = this.getPortColor(type);

        const jack = document.createElement('div');
        jack.className = 'rack-jack';
        jack.dataset.port = portName;
        jack.dataset.isOut = isOutput ? 'true' : 'false';
        jack.dataset.type = type || 'AUDIO';
        jack.dataset.moduleId = moduleId;

        jack.style.width = '24px';
        jack.style.height = '24px';
        jack.style.borderRadius = '50%';
        // 3D Machined Chrome Washer Ring
        jack.style.background = 'radial-gradient(circle at 35% 30%, #a4b0be 0%, #57606f 50%, #2f3542 100%)';
        jack.style.border = `2px solid ${portColor}`;
        jack.style.boxShadow = `0 2px 5px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.7), 0 0 6px ${portColor}55`;
        jack.style.display = 'flex';
        jack.style.alignItems = 'center';
        jack.style.justifyContent = 'center';
        jack.style.cursor = 'crosshair';
        jack.title = `${isOutput ? 'Saída' : 'Entrada'}: ${portName} (${type})`;

        const hole = document.createElement('div');
        hole.style.width = '10px';
        hole.style.height = '10px';
        hole.style.borderRadius = '50%';
        hole.style.background = 'var(--bg-chassis, #060a0e)';
        hole.style.border = '1px solid #1e272e';
        hole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.95)';
        jack.appendChild(hole);

        // Check if connected to draw a glowing plug indicator
        const isConnected = isOutput
            ? this.engine.cables.some(c => c.fromModuleId === moduleId && c.fromPort === portName)
            : this.engine.cables.some(c => c.toModuleId === moduleId && c.toPort === portName);

        if (isConnected) {
            hole.style.background = `radial-gradient(circle at 40% 40%, #ffffff 0%, ${portColor} 60%, #000000 100%)`;
            hole.style.boxShadow = `0 0 10px ${portColor}, inset 0 0 4px #ffffff`;
        }

        jack.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button === 0) {
                // Left click: start patch cable drag
                const pos = this.getJackPosition(moduleId, portName, isOutput);
                this.cableDrag = {
                    fromModuleId: moduleId,
                    fromPort: portName,
                    isOutput: isOutput,
                    startX: pos.x,
                    startY: pos.y,
                    currentX: pos.x,
                    currentY: pos.y,
                    color: portColor
                };
            } else if (e.button === 2) {
                // Right click: disconnect cable at this port
                e.preventDefault();
                if (isOutput) {
                    this.engine.cables = this.engine.cables.filter(c => !(c.fromModuleId === moduleId && c.fromPort === portName));
                } else {
                    this.engine.disconnectCableAtPort(moduleId, portName);
                }
                this.render();
                this.onModuleChange();
            }
        });

        jack.addEventListener('contextmenu', (e) => e.preventDefault());

        wrap.appendChild(label);
        wrap.appendChild(jack);
        return wrap;
    }

    createKnobElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-knob-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '3px';

        const label = document.createElement('span');
        label.textContent = param.name.toUpperCase();
        label.style.fontSize = '9px';
        label.style.fontFamily = "'Chakra Petch', 'Rajdhani', sans-serif";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-main, #dfe4ea)';
        label.style.letterSpacing = '0.5px';

        // High-Legibility Retro Cyber LCD readout
        const valDisplay = document.createElement('span');
        valDisplay.textContent = this.formatKnobValue(param.value !== undefined ? param.value : param.default, param.unit, param.name);
        valDisplay.style.fontSize = '9.5px';
        valDisplay.style.fontWeight = '800';
        valDisplay.style.color = 'var(--lcd-text, #00ff88)';
        valDisplay.style.fontFamily = "'Share Tech Mono', monospace";
        valDisplay.style.background = 'var(--lcd-bg, #020d09)';
        valDisplay.style.border = '1px solid var(--lcd-border, rgba(0, 255, 136, 0.45))';
        valDisplay.style.padding = '1px 5px';
        valDisplay.style.borderRadius = '3px';
        valDisplay.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.8), 0 0 6px var(--lcd-shadow, rgba(0, 255, 136, 0.3))';
        valDisplay.style.textShadow = '0 0 5px var(--lcd-text, #00ff88)';
        valDisplay.style.minWidth = '44px';
        valDisplay.style.textAlign = 'center';

        // 3D Lathe-turned metallic rotary dial
        const knob = document.createElement('div');
        knob.className = 'rack-knob';
        knob.style.width = '36px';
        knob.style.height = '36px';
        knob.style.borderRadius = '50%';
        knob.style.background = 'radial-gradient(circle at 35% 30%, #4a5763 0%, #2c363e 48%, #161e24 85%, #0f1418 100%)';
        knob.style.border = '2px solid #576574';
        knob.style.boxShadow = '0 4px 10px rgba(0,0,0,0.75), inset 0 1px 2px rgba(255,255,255,0.45), 0 0 0 1px #151d23';
        knob.style.position = 'relative';
        knob.style.cursor = 'ns-resize';

        // Center glossy dome ring
        const dome = document.createElement('div');
        dome.style.position = 'absolute';
        dome.style.top = '3px';
        dome.style.left = '3px';
        dome.style.right = '3px';
        dome.style.bottom = '3px';
        dome.style.borderRadius = '50%';
        dome.style.background = 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2) 0%, transparent 60%)';
        dome.style.pointerEvents = 'none';
        knob.appendChild(dome);

        // High-visibility neon laser pointer
        const indicator = document.createElement('div');
        indicator.style.position = 'absolute';
        indicator.style.top = '2.5px';
        indicator.style.left = 'calc(50% - 1.5px)';
        indicator.style.width = '3px';
        indicator.style.height = '10px';
        indicator.style.background = 'var(--neon-accent, #00f2fe)';
        indicator.style.boxShadow = '0 0 8px var(--neon-accent, #00f2fe), 0 0 2px #ffffff';
        indicator.style.borderRadius = '2px';
        indicator.style.transformOrigin = 'center 15px';

        const min = param.min !== undefined ? param.min : 0;
        const max = param.max !== undefined ? param.max : 1;
        const curVal = param.value !== undefined ? param.value : param.default;
        const norm = (curVal - min) / (max - min || 1);
        const deg = -135 + norm * 270;
        indicator.style.transform = `rotate(${deg}deg)`;

        knob.appendChild(indicator);

        // Knob drag logic
        knob.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.draggedKnob = {
                moduleId,
                param,
                min,
                max,
                knobEl: knob,
                indicatorEl: indicator,
                valDisplayEl: valDisplay
            };
            this.knobStartY = e.clientY;
            this.knobStartVal = param.value !== undefined ? param.value : param.default;
        });

        // Double click reset to default
        knob.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            param.value = param.default;
            this.engine.setModuleKnob(moduleId, param.name, param.default);
            valDisplay.textContent = this.formatKnobValue(param.default, param.unit, param.name);
            const defNorm = (param.default - min) / (max - min || 1);
            indicator.style.transform = `rotate(${-135 + defNorm * 270}deg)`;
            this.onModuleChange();
        });

        wrap.appendChild(label);
        wrap.appendChild(knob);
        wrap.appendChild(valDisplay);
        return wrap;
    }

    createSliderElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-slider-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '3px';

        const label = document.createElement('span');
        label.textContent = param.name.toUpperCase();
        label.style.fontSize = '8.5px';
        label.style.fontFamily = "'Chakra Petch', 'Rajdhani', sans-serif";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-main, #dfe4ea)';

        // Track container
        const track = document.createElement('div');
        track.className = 'rack-slider-track';
        track.style.width = '10px';
        track.style.height = '64px';
        track.style.borderRadius = '5px';
        track.style.position = 'relative';
        track.style.cursor = 'ns-resize';

        const min = param.min !== undefined ? param.min : 0;
        const max = param.max !== undefined ? param.max : 1;
        const curVal = param.value !== undefined ? param.value : param.default;
        const norm = (curVal - min) / (max - min || 1);

        // Fader Thumb
        const thumb = document.createElement('div');
        thumb.className = 'rack-slider-thumb';
        thumb.style.position = 'absolute';
        thumb.style.left = '-7px';
        thumb.style.width = '24px';
        thumb.style.height = '12px';
        thumb.style.borderRadius = '3px';
        thumb.style.bottom = `${norm * 52}px`;
        thumb.style.display = 'flex';
        thumb.style.alignItems = 'center';
        thumb.style.justifyContent = 'center';
        thumb.innerHTML = `<div style="width: 14px; height: 2px; background: var(--neon-accent, #00f2fe); box-shadow: 0 0 4px var(--neon-accent, #00f2fe);"></div>`;
        track.appendChild(thumb);

        // LCD readout
        const valDisplay = document.createElement('span');
        valDisplay.textContent = this.formatKnobValue(curVal, param.unit, param.name);
        valDisplay.style.fontSize = '9px';
        valDisplay.style.fontWeight = '800';
        valDisplay.style.color = 'var(--lcd-text, #00ff88)';
        valDisplay.style.fontFamily = "'Share Tech Mono', monospace";
        valDisplay.style.background = 'var(--lcd-bg, #020d09)';
        valDisplay.style.border = '1px solid var(--lcd-border, rgba(0, 255, 136, 0.45))';
        valDisplay.style.padding = '1px 3px';
        valDisplay.style.borderRadius = '2px';
        valDisplay.style.minWidth = '38px';
        valDisplay.style.textAlign = 'center';

        const onSliderDrag = (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.draggedSlider = {
                moduleId,
                param,
                min,
                max,
                trackEl: track,
                thumbEl: thumb,
                valDisplayEl: valDisplay
            };
            this.sliderStartY = e.clientY;
            this.sliderStartVal = param.value !== undefined ? param.value : param.default;
        };

        track.addEventListener('mousedown', onSliderDrag);
        thumb.addEventListener('mousedown', onSliderDrag);

        wrap.appendChild(label);
        wrap.appendChild(track);
        wrap.appendChild(valDisplay);
        return wrap;
    }

    createSwitchElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-switch-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '3px';

        const label = document.createElement('span');
        label.textContent = param.name.toUpperCase();
        label.style.fontSize = '8.5px';
        label.style.fontFamily = "'Chakra Petch', 'Rajdhani', sans-serif";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-main, #dfe4ea)';

        const isAct = (param.value !== undefined ? param.value : param.default) > 0.5;

        const sw = document.createElement('div');
        sw.className = 'rack-toggle-switch';
        sw.style.width = '32px';
        sw.style.height = '18px';
        sw.style.background = isAct ? 'linear-gradient(180deg, #10ac84 0%, #006266 100%)' : 'linear-gradient(180deg, #2d3436 0%, #1e272e 100%)';
        sw.style.border = isAct ? '1px solid var(--neon-secondary, #00ff88)' : '1px solid #485460';
        sw.style.boxShadow = isAct ? '0 0 8px var(--neon-secondary, #00ff88)' : 'inset 0 1px 3px rgba(0,0,0,0.8)';

        const lever = document.createElement('div');
        lever.className = 'rack-toggle-lever';
        lever.style.width = '14px';
        lever.style.height = '14px';
        lever.style.top = '1px';
        lever.style.left = isAct ? '15px' : '1px';
        sw.appendChild(lever);

        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            const newVal = (param.value > 0.5) ? 0 : 1;
            param.value = newVal;
            this.engine.setModuleKnob(moduleId, param.name, newVal);
            this.render();
            this.onModuleChange();
        });

        const stateLabel = document.createElement('span');
        stateLabel.textContent = isAct ? 'ON' : 'OFF';
        stateLabel.style.fontSize = '9px';
        stateLabel.style.fontWeight = '800';
        stateLabel.style.color = isAct ? 'var(--neon-secondary, #00ff88)' : 'var(--text-dim, #8395a7)';
        stateLabel.style.fontFamily = "'Share Tech Mono', monospace";

        wrap.appendChild(label);
        wrap.appendChild(sw);
        wrap.appendChild(stateLabel);
        return wrap;
    }

    createXyPadElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-xy-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '3px';

        const label = document.createElement('span');
        label.textContent = (param.name || 'XY PAD').toUpperCase();
        label.style.fontSize = '9px';
        label.style.fontFamily = "'Chakra Petch', 'Rajdhani', sans-serif";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-main, #dfe4ea)';

        const canvas = document.createElement('canvas');
        canvas.className = 'rack-interactive-canvas';
        canvas.width = 90;
        canvas.height = 70;
        canvas.style.width = '90px';
        canvas.style.height = '70px';

        let curX = param.valX !== undefined ? param.valX : 0.5;
        let curY = param.valY !== undefined ? param.valY : 0.5;

        const drawPad = () => {
            const ctx = canvas.getContext('2d');
            const bg = this.getThemeColor('--lcd-bg', '#020d09');
            const neonAcc = this.getThemeColor('--neon-accent', '#00f2fe');
            const neonSec = this.getThemeColor('--neon-secondary', '#00ff88');

            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 90, 70);

            // Grid
            ctx.strokeStyle = neonSec + '33';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(45, 0); ctx.lineTo(45, 70);
            ctx.moveTo(0, 35); ctx.lineTo(90, 35);
            ctx.stroke();

            // Puck
            const px = curX * 90;
            const py = (1 - curY) * 70;
            ctx.fillStyle = neonAcc;
            ctx.shadowColor = neonAcc;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        };

        drawPad();

        const updateXyFromEvent = (e) => {
            const rect = canvas.getBoundingClientRect();
            curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            curY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
            param.valX = curX;
            param.valY = curY;
            this.engine.setModuleKnob(moduleId, `${param.name}_X`, curX);
            this.engine.setModuleKnob(moduleId, `${param.name}_Y`, curY);
            drawPad();
            this.onModuleChange();
        };

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.draggedXyPad = { moduleId, param, updateFn: updateXyFromEvent };
            updateXyFromEvent(e);
        });

        wrap.appendChild(label);
        wrap.appendChild(canvas);
        return wrap;
    }

    createWaveDrawElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-wavedraw-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '3px';

        const label = document.createElement('span');
        label.textContent = (param.name || 'WAVE DRAW').toUpperCase();
        label.style.fontSize = '9px';
        label.style.fontFamily = "'Chakra Petch', 'Rajdhani', sans-serif";
        label.style.fontWeight = '700';
        label.style.color = 'var(--text-main, #dfe4ea)';

        const canvas = document.createElement('canvas');
        canvas.className = 'rack-interactive-canvas';
        canvas.width = 110;
        canvas.height = 60;
        canvas.style.width = '110px';
        canvas.style.height = '60px';

        if (!param.waveTable) {
            param.waveTable = new Float32Array(128);
            for (let i = 0; i < 128; i++) param.waveTable[i] = Math.sin(i / 128 * 2 * Math.PI);
        }

        const drawWave = () => {
            const ctx = canvas.getContext('2d');
            const bg = this.getThemeColor('--lcd-bg', '#020d09');
            const neonSec = this.getThemeColor('--neon-secondary', '#00ff88');

            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 110, 60);

            // Center zero axis
            ctx.strokeStyle = neonSec + '33';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 30); ctx.lineTo(110, 30);
            ctx.stroke();

            // Waveform spline
            ctx.strokeStyle = neonSec;
            ctx.lineWidth = 2;
            ctx.shadowColor = neonSec;
            ctx.shadowBlur = 6;
            ctx.beginPath();

            for (let i = 0; i < 128; i++) {
                const x = (i / 127) * 110;
                const y = 30 - param.waveTable[i] * 26;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        };

        drawWave();

        const updateWaveFromEvent = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = Math.max(0, Math.min(109, e.clientX - rect.left));
            const mouseY = Math.max(0, Math.min(59, e.clientY - rect.top));

            const idx = Math.floor((mouseX / 110) * 128);
            const val = Math.max(-1, Math.min(1, (30 - mouseY) / 26));

            param.waveTable[idx] = val;
            if (idx > 0 && Math.abs(param.waveTable[idx - 1] - val) > 0.2) {
                param.waveTable[idx - 1] = (param.waveTable[idx - 1] + val) * 0.5;
            }
            if (idx < 127 && Math.abs(param.waveTable[idx + 1] - val) > 0.2) {
                param.waveTable[idx + 1] = (param.waveTable[idx + 1] + val) * 0.5;
            }

            this.engine.setModuleKnob(moduleId, param.name, param.waveTable);
            drawWave();
            this.onModuleChange();
        };

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.drawingWave = { updateFn: updateWaveFromEvent };
            updateWaveFromEvent(e);
        });

        wrap.appendChild(label);
        wrap.appendChild(canvas);
        return wrap;
    }

    createAdsrCurveElement(moduleId, mod) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-adsr-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '2px';
        wrap.style.marginBottom = '4px';

        const canvas = document.createElement('canvas');
        canvas.className = 'rack-interactive-canvas';
        canvas.width = 100;
        canvas.height = 45;
        canvas.style.width = '100px';
        canvas.style.height = '45px';

        const drawCurve = () => {
            const ctx = canvas.getContext('2d');
            const bg = this.getThemeColor('--lcd-bg', '#020d09');
            const neonSec = this.getThemeColor('--neon-secondary', '#00ff88');

            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 100, 45);

            const getVal = (name, def) => {
                const p = mod.params.find(x => x.name.toLowerCase() === name.toLowerCase());
                return p && p.value !== undefined ? p.value : def;
            };

            const a = Math.max(0.01, getVal('Attack', 0.05));
            const d = Math.max(0.01, getVal('Decay', 0.2));
            const s = Math.max(0.0, Math.min(1.0, getVal('Sustain', 0.5)));
            const r = Math.max(0.01, getVal('Release', 0.2));

            const total = a + d + 0.3 + r;
            const xA = (a / total) * 90 + 5;
            const xD = xA + (d / total) * 90;
            const xS = xD + (0.3 / total) * 90;
            const xR = 95;

            const yTop = 8;
            const ySus = 40 - s * 32;
            const yBot = 40;

            // Envelope Fill
            ctx.fillStyle = neonSec + '26';
            ctx.beginPath();
            ctx.moveTo(5, yBot);
            ctx.lineTo(xA, yTop);
            ctx.lineTo(xD, ySus);
            ctx.lineTo(xS, ySus);
            ctx.lineTo(xR, yBot);
            ctx.closePath();
            ctx.fill();

            // Outline
            ctx.strokeStyle = neonSec;
            ctx.lineWidth = 2;
            ctx.shadowColor = neonSec;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(5, yBot);
            ctx.lineTo(xA, yTop);
            ctx.lineTo(xD, ySus);
            ctx.lineTo(xS, ySus);
            ctx.lineTo(xR, yBot);
            ctx.stroke();
            ctx.shadowBlur = 0;
        };

        drawCurve();
        wrap.appendChild(canvas);
        return wrap;
    }

    formatKnobValue(val, unit, name = '') {
        if (typeof val !== 'number') return '0';
        let str = '';
        const nLower = (name || '').toLowerCase();

        if (nLower.includes('bpm')) {
            return `${Math.round(val)} BPM`;
        }
        if (nLower.includes('freq') || nLower.includes('cutoff')) {
            if (val >= 1000) return `${(val / 1000).toFixed(1)}k Hz`;
            return `${Math.round(val)} Hz`;
        }
        if (nLower.includes('time') || nLower.includes('attack') || nLower.includes('decay') || nLower.includes('release')) {
            if (val < 1.0) return `${Math.round(val * 1000)} ms`;
            return `${val.toFixed(2)} s`;
        }
        if (nLower.includes('gain') || nLower.includes('vol') || nLower.includes('mix') || nLower.includes('res') || nLower.includes('pw') || nLower.includes('feedback')) {
            return `${Math.round(val * 100)}%`;
        }

        if (Math.abs(val) >= 1000) str = (val / 1000).toFixed(1) + 'k';
        else if (Math.abs(val) >= 10) str = val.toFixed(0);
        else if (Math.abs(val) >= 1) str = val.toFixed(1);
        else str = val.toFixed(2);
        return unit ? `${str} ${unit}` : str;
    }

    getThemeColor(varName, fallback = '') {
        try {
            const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            return val || fallback;
        } catch (e) {
            return fallback;
        }
    }

    getPortColor(type) {
        switch (type) {
            case 'AUDIO': return this.getThemeColor('--cable-audio', '#00ff88');
            case 'GATE': return this.getThemeColor('--cable-gate', '#fed330');
            case 'VAL': default: return this.getThemeColor('--cable-cv', '#00f2fe');
        }
    }

    renderCables() {
        // Keep <defs> filter preserved
        const defs = this.svgCables.querySelector('defs');
        const defsHtml = defs ? defs.outerHTML : '';
        this.svgCables.innerHTML = defsHtml;

        // 1. Render all connected cables
        for (const cable of this.engine.cables) {
            const start = this.getJackPosition(cable.fromModuleId, cable.fromPort, true);
            const end = this.getJackPosition(cable.toModuleId, cable.toPort, false);
            const fromMod = this.engine.getModule(cable.fromModuleId);
            const outPort = fromMod?.outputs?.find(o => o.name === cable.fromPort);
            const portType = cable.type || outPort?.type || 'AUDIO';
            const cableColor = this.getPortColor(portType);

            const pathD = this.computeCablePath(start.x, start.y, end.x, end.y);
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', pathD);
            pathEl.setAttribute('stroke', cableColor);
            pathEl.setAttribute('stroke-width', '4.5');
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke-linecap', 'round');
            pathEl.setAttribute('stroke-linejoin', 'round');
            pathEl.style.opacity = '0.94';
            // Neon glowing drop shadow
            pathEl.style.filter = `drop-shadow(0 0 6px ${cableColor}) drop-shadow(0 6px 12px rgba(0,0,0,0.85))`;
            pathEl.style.pointerEvents = 'stroke';
            pathEl.style.cursor = 'pointer';

            // Delete cable on click
            pathEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.engine.disconnectCable(cable.id);
                this.render();
                this.onModuleChange();
            });

            // Highlight on hover
            pathEl.addEventListener('mouseenter', () => {
                pathEl.setAttribute('stroke-width', '6.5');
                pathEl.style.opacity = '1.0';
                pathEl.style.filter = `drop-shadow(0 0 12px ${cableColor}) drop-shadow(0 8px 16px rgba(0,0,0,0.9))`;
            });
            pathEl.addEventListener('mouseleave', () => {
                pathEl.setAttribute('stroke-width', '4.5');
                pathEl.style.opacity = '0.94';
                pathEl.style.filter = `drop-shadow(0 0 6px ${cableColor}) drop-shadow(0 6px 12px rgba(0,0,0,0.85))`;
            });

            this.svgCables.appendChild(pathEl);

            // Plug cap start - Machined Chrome Plug
            const plugStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            plugStart.setAttribute('cx', start.x);
            plugStart.setAttribute('cy', start.y);
            plugStart.setAttribute('r', '6.5');
            plugStart.setAttribute('fill', '#1a252f');
            plugStart.setAttribute('stroke', cableColor);
            plugStart.setAttribute('stroke-width', '2.5');
            plugStart.style.filter = `drop-shadow(0 0 6px ${cableColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.9))`;
            plugStart.style.pointerEvents = 'none';
            this.svgCables.appendChild(plugStart);

            // Plug cap end - Machined Chrome Plug
            const plugEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            plugEnd.setAttribute('cx', end.x);
            plugEnd.setAttribute('cy', end.y);
            plugEnd.setAttribute('r', '6.5');
            plugEnd.setAttribute('fill', '#1a252f');
            plugEnd.setAttribute('stroke', cableColor);
            plugEnd.setAttribute('stroke-width', '2.5');
            plugEnd.style.filter = `drop-shadow(0 0 6px ${cableColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.9))`;
            plugEnd.style.pointerEvents = 'none';
            this.svgCables.appendChild(plugEnd);
        }

        // 2. Render live dragged cable
        if (this.cableDrag) {
            const startX = this.cableDrag.startX;
            const startY = this.cableDrag.startY;
            const endX = this.cableDrag.currentX;
            const endY = this.cableDrag.currentY;
            const dragColor = this.cableDrag.color || '#fed330';

            const pathD = this.computeCablePath(startX, startY, endX, endY);
            const dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            dragPath.setAttribute('d', pathD);
            dragPath.setAttribute('stroke', dragColor);
            dragPath.setAttribute('stroke-width', '4');
            dragPath.setAttribute('fill', 'none');
            dragPath.setAttribute('stroke-linecap', 'round');
            dragPath.style.opacity = '0.9';
            dragPath.style.filter = `drop-shadow(0 0 10px ${dragColor}) drop-shadow(0 4px 8px rgba(0,0,0,0.7))`;
            this.svgCables.appendChild(dragPath);
        }
    }

    computeCablePath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Realistic gravity sag
        const sag = Math.max(30, dist * 0.45);

        const cp1x = x1 + dx * 0.25;
        const cp1y = y1 + sag;
        const cp2x = x2 - dx * 0.25;
        const cp2y = y2 + sag;

        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    attachEvents() {
        // Global mouse move
        window.addEventListener('mousemove', (e) => {
            // Dragging Module
            if (this.draggedModule) {
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                this.draggedModule.x = Math.max(0, Math.round((worldPos.x - this.dragOffset.x) / 10) * 10);
                this.draggedModule.y = Math.max(0, Math.round((worldPos.y - this.dragOffset.y) / 10) * 10);

                const card = this.modulesContainer.querySelector(`[data-module-id="${this.draggedModule.id}"]`);
                if (card) {
                    card.style.left = `${this.draggedModule.x}px`;
                    card.style.top = `${this.draggedModule.y}px`;
                }
                this.renderCables();
                return;
            }

            // Dragging Knob
            if (this.draggedKnob) {
                const deltaY = this.knobStartY - e.clientY;
                const range = this.draggedKnob.max - this.draggedKnob.min;
                const step = range / 150;
                let newVal = this.knobStartVal + deltaY * step;
                newVal = Math.max(this.draggedKnob.min, Math.min(this.draggedKnob.max, newVal));

                this.draggedKnob.param.value = newVal;
                this.engine.setModuleKnob(this.draggedKnob.moduleId, this.draggedKnob.param.name, newVal);

                const norm = (newVal - this.draggedKnob.min) / (range || 1);
                const deg = -135 + norm * 270;
                this.draggedKnob.indicatorEl.style.transform = `rotate(${deg}deg)`;
                this.draggedKnob.valDisplayEl.textContent = this.formatKnobValue(newVal, this.draggedKnob.param.unit, this.draggedKnob.param.name);
                return;
            }

            // Dragging Slider
            if (this.draggedSlider) {
                const deltaY = this.sliderStartY - e.clientY;
                const range = this.draggedSlider.max - this.draggedSlider.min;
                const step = range / 52;
                let newVal = this.sliderStartVal + deltaY * step;
                newVal = Math.max(this.draggedSlider.min, Math.min(this.draggedSlider.max, newVal));

                this.draggedSlider.param.value = newVal;
                this.engine.setModuleKnob(this.draggedSlider.moduleId, this.draggedSlider.param.name, newVal);

                const norm = (newVal - this.draggedSlider.min) / (range || 1);
                this.draggedSlider.thumbEl.style.bottom = `${norm * 52}px`;
                this.draggedSlider.valDisplayEl.textContent = this.formatKnobValue(newVal, this.draggedSlider.param.unit, this.draggedSlider.param.name);
                return;
            }

            // Dragging XY Pad
            if (this.draggedXyPad) {
                this.draggedXyPad.updateFn(e);
                return;
            }

            // Drawing Custom Wave
            if (this.drawingWave) {
                this.drawingWave.updateFn(e);
                return;
            }

            // Dragging Patch Cable
            if (this.cableDrag) {
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                this.cableDrag.currentX = worldPos.x;
                this.cableDrag.currentY = worldPos.y;
                this.renderCables();
                return;
            }

            // Panning Canvas (Middle mouse button)
            if (e.buttons === 4) {
                this.panX += e.movementX;
                this.panY += e.movementY;
                this.updateTransform();
            }
        });

        // Global mouse up
        window.addEventListener('mouseup', (e) => {
            if (this.draggedModule) {
                const card = this.modulesContainer.querySelector(`[data-module-id="${this.draggedModule.id}"]`);
                if (card) card.style.zIndex = '5';
                this.draggedModule = null;
                this.onModuleChange();
            }

            if (this.draggedKnob) {
                this.draggedKnob = null;
                this.onModuleChange();
            }

            if (this.draggedSlider) {
                this.draggedSlider = null;
                this.onModuleChange();
            }

            if (this.draggedXyPad) {
                this.draggedXyPad = null;
                this.onModuleChange();
            }

            if (this.drawingWave) {
                this.drawingWave = null;
                this.onModuleChange();
            }

            if (this.cableDrag) {
                // Find element under cursor
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const targetJack = el ? el.closest('.rack-jack') : null;

                if (targetJack) {
                    const targetModId = targetJack.dataset.moduleId;
                    const targetPort = targetJack.dataset.port;
                    const targetIsOut = targetJack.dataset.isOut === 'true';

                    // Connect if valid (from out to in, or in to out)
                    if (targetModId !== this.cableDrag.fromModuleId || targetPort !== this.cableDrag.fromPort) {
                        if (this.cableDrag.isOutput && !targetIsOut) {
                            this.engine.connectCable(this.cableDrag.fromModuleId, this.cableDrag.fromPort, targetModId, targetPort, this.cableDrag.color);
                        } else if (!this.cableDrag.isOutput && targetIsOut) {
                            this.engine.connectCable(targetModId, targetPort, this.cableDrag.fromModuleId, this.cableDrag.fromPort, this.cableDrag.color);
                        }
                    }
                }

                this.cableDrag = null;
                this.render();
                this.onModuleChange();
            }
        });

        // Canvas Zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.08 : 0.92;
            const newZoom = Math.max(0.4, Math.min(2.0, this.zoom * delta));

            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
            this.zoom = newZoom;

            this.updateTransform();
        }, { passive: false });
    }
}
