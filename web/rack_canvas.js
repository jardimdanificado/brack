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

        this.adsrCanvases = new Map();

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
        this.container.style.background = '#0c100e';
        this.container.style.userSelect = 'none';

        // World Container that gets panned/zoomed
        this.world = document.createElement('div');
        this.world.className = 'rack-world';
        this.world.style.position = 'absolute';
        this.world.style.transformOrigin = '0 0';
        this.world.style.width = '5000px';
        this.world.style.height = '3000px';

        // Grid canvas
        this.gridCanvas = document.createElement('canvas');
        this.gridCanvas.style.position = 'absolute';
        this.gridCanvas.style.top = '0';
        this.gridCanvas.style.left = '0';
        this.gridCanvas.style.width = '100%';
        this.gridCanvas.style.height = '100%';
        this.gridCanvas.style.pointerEvents = 'none';
        this.gridCanvas.style.zIndex = '1';
        this.container.appendChild(this.gridCanvas);

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
        this.adsrCanvases.clear();

        for (const mod of this.engine.modules) {
            const card = document.createElement('div');
            card.className = 'rack-module';
            card.dataset.moduleId = mod.id;
            card.style.position = 'absolute';
            card.style.left = `${mod.x}px`;
            card.style.top = `${mod.y}px`;
            card.style.width = `${mod.width}px`;
            card.style.minHeight = `${mod.height}px`;
            card.style.background = 'linear-gradient(180deg, #18221e 0%, #121916 100%)';
            card.style.border = '2px solid #283731';
            card.style.borderRadius = '8px';
            card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.zIndex = '5';

            // Top screw rail
            const screwHeader = document.createElement('div');
            screwHeader.style.height = '14px';
            screwHeader.style.background = '#0e1411';
            screwHeader.style.borderTopLeftRadius = '6px';
            screwHeader.style.borderTopRightRadius = '6px';
            screwHeader.style.display = 'flex';
            screwHeader.style.justifyContent = 'space-between';
            screwHeader.style.alignItems = 'center';
            screwHeader.style.padding = '0 8px';
            screwHeader.innerHTML = `
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #33443d; border: 1px solid #1a2420;"></div>
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #33443d; border: 1px solid #1a2420;"></div>
            `;
            card.appendChild(screwHeader);

            // Module Title Header (Drag Handle)
            const header = document.createElement('div');
            header.className = 'module-header';
            header.style.padding = '6px 10px';
            header.style.background = mod.color || '#059669';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.cursor = 'grab';
            header.style.color = '#ffffff';
            header.style.fontWeight = '900';
            header.style.fontSize = '12px';
            header.style.letterSpacing = '0.5px';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = mod.name;
            titleSpan.title = 'Duplo clique para abrir editor Scratch';
            header.appendChild(titleSpan);

            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '4px';

            // Scratch Code Edit Button
            const btnCode = document.createElement('button');
            btnCode.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;
            btnCode.title = 'Editar Código Scratch deste módulo';
            btnCode.style.background = 'rgba(0,0,0,0.3)';
            btnCode.style.border = '1px solid rgba(255,255,255,0.3)';
            btnCode.style.padding = '2px 5px';
            btnCode.style.borderRadius = '3px';
            btnCode.style.cursor = 'pointer';
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
                btnDel.style.background = 'rgba(239, 68, 68, 0.4)';
                btnDel.style.border = '1px solid rgba(255,255,255,0.3)';
                btnDel.style.padding = '2px 5px';
                btnDel.style.borderRadius = '3px';
                btnDel.style.fontSize = '10px';
                btnDel.style.cursor = 'pointer';
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

            // Module Body (Knobs and Jacks)
            const body = document.createElement('div');
            body.style.flex = '1';
            body.style.padding = '10px 8px';
            body.style.display = 'flex';
            body.style.gap = '8px';
            body.style.justifyContent = 'space-between';

            // Left Column: Inputs
            const inputsCol = document.createElement('div');
            inputsCol.style.display = 'flex';
            inputsCol.style.flexDirection = 'column';
            inputsCol.style.gap = '10px';
            inputsCol.style.minWidth = '45px';

            for (const inp of mod.inputs) {
                inputsCol.appendChild(this.createJackElement(mod.id, inp.name, inp.type, false));
            }
            body.appendChild(inputsCol);

            // Center Column: Knobs
            const knobsCol = document.createElement('div');
            knobsCol.style.flex = '1';
            knobsCol.style.display = 'flex';
            knobsCol.style.flexDirection = 'column';
            knobsCol.style.alignItems = 'center';
            knobsCol.style.gap = '10px';

            const isAdsr = mod.type === 'adsr' || (mod.params.some(p => p.name.toLowerCase() === 'attack') && mod.params.some(p => p.name.toLowerCase() === 'release'));
            if (isAdsr) {
                knobsCol.appendChild(this.createAdsrCurveElement(mod.id, mod));
            }

            for (const param of mod.params) {
                knobsCol.appendChild(this.createKnobElement(mod.id, param));
            }
            body.appendChild(knobsCol);

            // Right Column: Outputs
            const outputsCol = document.createElement('div');
            outputsCol.style.display = 'flex';
            outputsCol.style.flexDirection = 'column';
            outputsCol.style.alignItems = 'flex-end';
            outputsCol.style.gap = '10px';
            outputsCol.style.minWidth = '45px';

            for (const out of mod.outputs) {
                outputsCol.appendChild(this.createJackElement(mod.id, out.name, out.type, true));
            }
            body.appendChild(outputsCol);

            card.appendChild(body);

            // Bottom screw rail
            const screwFooter = document.createElement('div');
            screwFooter.style.height = '14px';
            screwFooter.style.background = '#0e1411';
            screwFooter.style.borderBottomLeftRadius = '6px';
            screwFooter.style.borderBottomRightRadius = '6px';
            screwFooter.style.display = 'flex';
            screwFooter.style.justifyContent = 'space-between';
            screwFooter.style.alignItems = 'center';
            screwFooter.style.padding = '0 8px';
            screwFooter.innerHTML = `
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #33443d; border: 1px solid #1a2420;"></div>
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #33443d; border: 1px solid #1a2420;"></div>
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
        label.style.fontWeight = '700';
        label.style.color = '#a0afab';
        label.style.whiteSpace = 'nowrap';
        label.style.maxWidth = '60px';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';

        const jack = document.createElement('div');
        jack.className = 'rack-jack';
        jack.dataset.port = portName;
        jack.dataset.isOut = isOutput ? 'true' : 'false';
        jack.dataset.type = type || 'AUDIO';
        jack.dataset.moduleId = moduleId;

        jack.style.width = '24px';
        jack.style.height = '24px';
        jack.style.borderRadius = '50%';
        jack.style.background = '#0a0e0c';
        jack.style.border = `3px solid ${this.getPortColor(type)}`;
        jack.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5)';
        jack.style.display = 'flex';
        jack.style.alignItems = 'center';
        jack.style.justifyContent = 'center';
        jack.style.cursor = 'crosshair';
        jack.title = `${isOutput ? 'Saída' : 'Entrada'}: ${portName} (${type})`;

        const hole = document.createElement('div');
        hole.style.width = '10px';
        hole.style.height = '10px';
        hole.style.borderRadius = '50%';
        hole.style.background = '#000000';
        hole.style.border = '1px solid rgba(255,255,255,0.2)';
        jack.appendChild(hole);

        // Check if connected to draw a plug ring
        const isConnected = isOutput
            ? this.engine.cables.some(c => c.fromModuleId === moduleId && c.fromPort === portName)
            : this.engine.cables.some(c => c.toModuleId === moduleId && c.toPort === portName);

        if (isConnected) {
            hole.style.background = this.getPortColor(type);
            hole.style.boxShadow = `0 0 6px ${this.getPortColor(type)}`;
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
                    color: this.getPortColor(type)
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

    createAdsrCurveElement(moduleId, mod) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-adsr-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '2px';
        wrap.style.marginBottom = '4px';

        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 44;
        canvas.style.width = '100px';
        canvas.style.height = '44px';
        canvas.style.background = '#09110d';
        canvas.style.border = '1px solid #283731';
        canvas.style.borderRadius = '4px';

        const drawCurve = () => {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#09110d';
            ctx.fillRect(0, 0, 100, 44);

            const getVal = (name, def) => {
                const p = mod.params.find(x => x.name.toLowerCase() === name.toLowerCase());
                return p && p.value !== undefined ? p.value : def;
            };

            const a = Math.max(0.01, getVal('Attack', 0.05));
            const d = Math.max(0.01, getVal('Decay', 0.2));
            const s = Math.max(0.0, Math.min(1.0, getVal('Sustain', 0.5)));
            const r = Math.max(0.01, getVal('Release', 0.2));

            const total = a + d + 0.3 + r;
            const xA = (a / total) * 88 + 6;
            const xD = xA + (d / total) * 88;
            const xS = xD + (0.3 / total) * 88;
            const xR = 94;

            const yTop = 6;
            const ySus = 38 - s * 30;
            const yBot = 38;

            // Zero axis
            ctx.strokeStyle = 'rgba(85, 239, 196, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(6, yBot); ctx.lineTo(94, yBot);
            ctx.stroke();

            // Fill
            ctx.fillStyle = 'rgba(85, 239, 196, 0.15)';
            ctx.beginPath();
            ctx.moveTo(6, yBot);
            ctx.lineTo(xA, yTop);
            ctx.lineTo(xD, ySus);
            ctx.lineTo(xS, ySus);
            ctx.lineTo(xR, yBot);
            ctx.closePath();
            ctx.fill();

            // Stroke
            ctx.strokeStyle = '#55efc4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(6, yBot);
            ctx.lineTo(xA, yTop);
            ctx.lineTo(xD, ySus);
            ctx.lineTo(xS, ySus);
            ctx.lineTo(xR, yBot);
            ctx.stroke();
        };

        this.adsrCanvases.set(moduleId, drawCurve);
        drawCurve();
        wrap.appendChild(canvas);
        return wrap;
    }

    createKnobElement(moduleId, param) {
        const wrap = document.createElement('div');
        wrap.className = 'rack-knob-wrap';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '2px';

        const label = document.createElement('span');
        label.textContent = param.name;
        label.style.fontSize = '9px';
        label.style.fontWeight = '700';
        label.style.color = '#c8d6e5';

        const valDisplay = document.createElement('span');
        valDisplay.textContent = this.formatKnobValue(param.value !== undefined ? param.value : param.default, param.unit);
        valDisplay.style.fontSize = '10.5px';
        valDisplay.style.fontWeight = '700';
        valDisplay.style.color = '#55efc4';
        valDisplay.style.fontFamily = 'monospace';

        const knob = document.createElement('div');
        knob.className = 'rack-knob';
        knob.style.width = '36px';
        knob.style.height = '36px';
        knob.style.borderRadius = '50%';
        knob.style.background = 'radial-gradient(circle at 35% 35%, #2f3e37, #131c17)';
        knob.style.border = '2px solid #3b5247';
        knob.style.boxShadow = '0 3px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)';
        knob.style.position = 'relative';
        knob.style.cursor = 'ns-resize';

        // Indicator line
        const indicator = document.createElement('div');
        indicator.style.position = 'absolute';
        indicator.style.top = '3px';
        indicator.style.left = 'calc(50% - 1.5px)';
        indicator.style.width = '3px';
        indicator.style.height = '10px';
        indicator.style.background = '#55efc4';
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
            valDisplay.textContent = this.formatKnobValue(param.default, param.unit);
            const defNorm = (param.default - min) / (max - min || 1);
            indicator.style.transform = `rotate(${-135 + defNorm * 270}deg)`;
            const drawAdsr = this.adsrCanvases.get(moduleId);
            if (drawAdsr) drawAdsr();
            this.onModuleChange();
        });

        wrap.appendChild(label);
        wrap.appendChild(knob);
        wrap.appendChild(valDisplay);
        return wrap;
    }

    formatKnobValue(val, unit) {
        if (typeof val !== 'number') return '0';
        let str = '';
        if (Math.abs(val) >= 1000) str = (val / 1000).toFixed(1) + 'k';
        else if (Math.abs(val) >= 10) str = val.toFixed(0);
        else if (Math.abs(val) >= 1) str = val.toFixed(1);
        else str = val.toFixed(2);
        return unit ? `${str}${unit}` : str;
    }

    getPortColor(type) {
        switch (type) {
            case 'AUDIO': return '#22c55e'; // Green
            case 'GATE': return '#f59e0b'; // Amber / Yellow
            case 'VAL': default: return '#06b6d4'; // Cyan
        }
    }

    renderCables() {
        this.svgCables.innerHTML = '';

        // 1. Render all connected cables
        for (const cable of this.engine.cables) {
            const start = this.getJackPosition(cable.fromModuleId, cable.fromPort, true);
            const end = this.getJackPosition(cable.toModuleId, cable.toPort, false);

            const pathD = this.computeCablePath(start.x, start.y, end.x, end.y);
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', pathD);
            pathEl.setAttribute('stroke', cable.color || '#22c55e');
            pathEl.setAttribute('stroke-width', '4.5');
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke-linecap', 'round');
            pathEl.setAttribute('stroke-linejoin', 'round');
            pathEl.style.opacity = '0.92';
            pathEl.style.filter = 'drop-shadow(0 6px 10px rgba(0,0,0,0.7))';
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
            });
            pathEl.addEventListener('mouseleave', () => {
                pathEl.setAttribute('stroke-width', '4.5');
                pathEl.style.opacity = '0.92';
            });

            this.svgCables.appendChild(pathEl);

            // Plug cap start
            const plugStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            plugStart.setAttribute('cx', start.x);
            plugStart.setAttribute('cy', start.y);
            plugStart.setAttribute('r', '6');
            plugStart.setAttribute('fill', '#141c18');
            plugStart.setAttribute('stroke', cable.color || '#22c55e');
            plugStart.setAttribute('stroke-width', '3');
            plugStart.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))';
            plugStart.style.pointerEvents = 'none';
            this.svgCables.appendChild(plugStart);

            // Plug cap end
            const plugEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            plugEnd.setAttribute('cx', end.x);
            plugEnd.setAttribute('cy', end.y);
            plugEnd.setAttribute('r', '6');
            plugEnd.setAttribute('fill', '#141c18');
            plugEnd.setAttribute('stroke', cable.color || '#22c55e');
            plugEnd.setAttribute('stroke-width', '3');
            plugEnd.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))';
            plugEnd.style.pointerEvents = 'none';
            this.svgCables.appendChild(plugEnd);
        }

        // 2. Render live dragged cable
        if (this.cableDrag) {
            const startX = this.cableDrag.startX;
            const startY = this.cableDrag.startY;
            const endX = this.cableDrag.currentX;
            const endY = this.cableDrag.currentY;

            const pathD = this.computeCablePath(startX, startY, endX, endY);
            const dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            dragPath.setAttribute('d', pathD);
            dragPath.setAttribute('stroke', this.cableDrag.color || '#f59e0b');
            dragPath.setAttribute('stroke-width', '4');
            dragPath.setAttribute('fill', 'none');
            dragPath.setAttribute('stroke-linecap', 'round');
            dragPath.style.opacity = '0.85';
            dragPath.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.7))';
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
                this.draggedKnob.valDisplayEl.textContent = this.formatKnobValue(newVal, this.draggedKnob.param.unit);

                const drawAdsr = this.adsrCanvases.get(this.draggedKnob.moduleId);
                if (drawAdsr) drawAdsr();
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
