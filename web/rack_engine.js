/**
 * =========================================================================
 * BRACK Rack Audio & Modular Graph Engine (web/rack_engine.js)
 * Multi-Module Real-Time Execution, Topological Cable Routing & 48kHz DSP
 * =========================================================================
 */

import { BlocklySynthEngine } from './blockly_dsp_compiler.js';
import { MODULE_CATALOG } from './modules_catalog.js';
import { dspHelpers as dsp } from './synth_registry.js';

export class RackEngine {
    constructor(sampleRate = 48000) {
        this.sampleRate = sampleRate;
        this.modules = [];
        this.cables = [];
        this.moduleOutputCache = new Map();
        this.masterOutBuffers = { left: new Float32Array(128), right: new Float32Array(128) };
        this.nextModuleId = 1;
        this.nextCableId = 1;
    }

    /**
     * Instantiates a new module in the rack
     */
    addModule(type, x = 100, y = 100, customName = null, customXml = null) {
        const spec = MODULE_CATALOG.find(m => m.type === type) || MODULE_CATALOG.find(m => m.type === 'custom');
        const id = `mod_${this.nextModuleId++}`;
        const name = customName || (spec ? spec.name : 'Módulo');
        const xml = customXml || (spec ? spec.getXml() : '');

        // Copy default params
        const params = spec ? spec.params.map(p => ({ ...p })) : [];
        const inputs = spec ? spec.inputs.map(i => ({ ...i })) : [];
        const outputs = spec ? spec.outputs.map(o => ({ ...o })) : [];

        const modInstance = {
            id,
            type,
            name,
            x,
            y,
            width: spec ? (spec.width || 190) : 190,
            height: spec ? (spec.height || 250) : 250,
            color: spec ? (spec.color || '#059669') : '#059669',
            isTerminal: !!(spec && spec.isTerminal),
            inputs,
            outputs,
            params,
            xml,
            engine: new BlocklySynthEngine(this.sampleRate)
        };

        this.modules.push(modInstance);
        this.syncModuleWithXml(modInstance, xml);
        return modInstance;
    }

    /**
     * Synchronize a module instance with XML (re-parse interface & compile)
     */
    syncModuleWithXml(moduleInstance, xmlText) {
        if (!moduleInstance) return;
        moduleInstance.xml = xmlText;

        if (typeof Blockly !== 'undefined' && xmlText) {
            try {
                // Safe XML to DOM parsing
                let tempDom = null;
                if (Blockly.utils && Blockly.utils.xml && typeof Blockly.utils.xml.textToDom === 'function') {
                    tempDom = Blockly.utils.xml.textToDom(xmlText);
                } else if (Blockly.Xml && typeof Blockly.Xml.textToDom === 'function') {
                    tempDom = Blockly.Xml.textToDom(xmlText);
                } else {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(xmlText, 'text/xml');
                    tempDom = doc.documentElement;
                }

                if (moduleInstance.workspace) {
                    try { moduleInstance.workspace.dispose(); } catch (e) {}
                }

                moduleInstance.workspace = new Blockly.Workspace();
                Blockly.Xml.domToWorkspace(tempDom, moduleInstance.workspace);

                const iface = BlocklySynthEngine.extractInterface(moduleInstance.workspace);
                if (iface.name) moduleInstance.name = iface.name;
                if (iface.width) moduleInstance.width = iface.width;
                if (iface.height) moduleInstance.height = iface.height;
                if (iface.color) moduleInstance.color = iface.color;
                if (iface.category) moduleInstance.category = iface.category;
                moduleInstance.visors = iface.visors || [];
                moduleInstance.decorations = iface.decorations || [];

                moduleInstance.inputs = iface.inputs;
                moduleInstance.outputs = iface.outputs;

                // Preserve existing param values
                const oldParamValues = new Map(moduleInstance.params.map(p => [p.name, p.value]));
                moduleInstance.params = iface.params.map(p => {
                    const existingVal = oldParamValues.get(p.name);
                    return {
                        ...p,
                        value: existingVal !== undefined ? existingVal : p.default
                    };
                });

                moduleInstance.engine.setWorkspace(moduleInstance.workspace);
            } catch (err) {
                console.warn('Error parsing module XML for interface sync:', err);
            }
        }
    }

    removeModule(moduleId) {
        const mod = this.getModule(moduleId);
        if (mod && mod.workspace) {
            try { mod.workspace.dispose(); } catch (e) {}
        }
        this.modules = this.modules.filter(m => m.id !== moduleId);
        // Remove all cables attached to this module
        this.cables = this.cables.filter(c => c.fromModuleId !== moduleId && c.toModuleId !== moduleId);
        this.moduleOutputCache.delete(moduleId);
    }

    getModule(moduleId) {
        return this.modules.find(m => m.id === moduleId) || null;
    }

    /**
     * Connects a patch cable from an output jack to an input jack
     */
    connectCable(fromModuleId, fromPort, toModuleId, toPort, color = null) {
        // Prevent duplicate connection to same target port
        this.disconnectCableAtPort(toModuleId, toPort);

        // Auto color based on port type or random bright palette
        const fromMod = this.getModule(fromModuleId);
        const fromPortObj = fromMod ? fromMod.outputs.find(o => o.name === fromPort) : null;
        let cableColor = color;
        if (!cableColor) {
            if (fromPortObj && fromPortObj.type === 'AUDIO') cableColor = '#22c55e'; // Green
            else if (fromPortObj && fromPortObj.type === 'GATE') cableColor = '#f59e0b'; // Amber
            else cableColor = '#06b6d4'; // Cyan/CV
        }

        const cable = {
            id: `cable_${this.nextCableId++}`,
            fromModuleId,
            fromPort,
            toModuleId,
            toPort,
            color: cableColor
        };

        this.cables.push(cable);
        return cable;
    }

    disconnectCable(cableId) {
        this.cables = this.cables.filter(c => c.id !== cableId);
    }

    disconnectCableAtPort(moduleId, portName) {
        this.cables = this.cables.filter(c => !(c.toModuleId === moduleId && c.toPort === portName));
    }

    setModuleKnob(moduleId, knobName, value) {
        const mod = this.getModule(moduleId);
        if (!mod) return;
        const p = mod.params.find(pr => pr.name === knobName);
        if (p) {
            p.value = Number(value);
        }
    }

    /**
     * Compute topological ordering for modules according to cable connections
     */
    getExecutionOrder() {
        const order = [];
        const visited = new Set();
        const visiting = new Set();

        const adj = new Map();
        for (const mod of this.modules) {
            adj.set(mod.id, []);
        }
        for (const cable of this.cables) {
            if (adj.has(cable.fromModuleId)) {
                adj.get(cable.fromModuleId).push(cable.toModuleId);
            }
        }

        const dfs = (modId) => {
            if (visiting.has(modId)) return; // Feedback loop handled gracefully
            if (visited.has(modId)) return;
            visiting.add(modId);

            const neighbors = adj.get(modId) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor);
            }

            visiting.delete(modId);
            visited.add(modId);
            order.push(modId);
        };

        for (const mod of this.modules) {
            if (!visited.has(mod.id)) {
                dfs(mod.id);
            }
        }

        order.reverse();
        return order.map(id => this.getModule(id)).filter(Boolean);
    }

    /**
     * Real-time audio loop: process all modules in topological order and route signals
     */
    processBlock(outL, outR, offset = 0, blockSize = 128) {
        const execOrder = this.getExecutionOrder();

        // 1. Process each module
        for (const mod of execOrder) {
            const inputSignals = new Map();
            const knobValues = new Map();

            // Collect Knob values
            for (const p of mod.params) {
                knobValues.set(p.name, p.value !== undefined ? p.value : p.default);
            }

            // Collect Inputs from incoming cables
            const incomingCables = this.cables.filter(c => c.toModuleId === mod.id);
            for (const cable of incomingCables) {
                const sourceOutputs = this.moduleOutputCache.get(cable.fromModuleId);
                if (sourceOutputs && sourceOutputs.has(cable.fromPort)) {
                    const srcSig = sourceOutputs.get(cable.fromPort);
                    if (inputSignals.has(cable.toPort)) {
                        // Mix multiple signals connected to same input
                        const existing = inputSignals.get(cable.toPort);
                        const mixedBuf = new Float32Array(blockSize);
                        for (let s = 0; s < blockSize; s++) {
                            const eSmp = existing.audio ? existing.audio[s] : existing.val;
                            const nSmp = srcSig.audio ? srcSig.audio[s] : srcSig.val;
                            mixedBuf[s] = eSmp + nSmp;
                        }
                        inputSignals.set(cable.toPort, { type: 'AUDIO', val: mixedBuf[0], audio: mixedBuf });
                    } else {
                        inputSignals.set(cable.toPort, srcSig);
                    }
                }
            }

            // Execute this module's DSP
            const outputs = mod.engine.processModule(inputSignals, knobValues, blockSize);
            this.moduleOutputCache.set(mod.id, outputs);
        }

        // 2. Locate terminal Master Out module or fallback to the last audio module
        const masterMod = this.modules.find(m => m.type === 'master_out' || m.isTerminal);
        if (masterMod) {
            const masterInputs = this.cables.filter(c => c.toModuleId === masterMod.id);
            let leftSig = null;
            let rightSig = null;

            for (const cable of masterInputs) {
                const srcOutputs = this.moduleOutputCache.get(cable.fromModuleId);
                if (srcOutputs && srcOutputs.has(cable.fromPort)) {
                    const sig = srcOutputs.get(cable.fromPort);
                    if (cable.toPort.toLowerCase().includes('left') || cable.toPort === 'Left') {
                        leftSig = sig;
                    } else if (cable.toPort.toLowerCase().includes('right') || cable.toPort === 'Right') {
                        rightSig = sig;
                    } else if (!leftSig) {
                        leftSig = sig;
                    }
                }
            }

            if (!rightSig) rightSig = leftSig;

            const masterVolParam = masterMod.params.find(p => p.name === 'Master Vol');
            const vol = (masterVolParam && masterVolParam.value !== undefined) ? masterVolParam.value : 0.85;

            for (let s = 0; s < blockSize; s++) {
                const sL = leftSig ? (leftSig.audio ? leftSig.audio[s] : (leftSig.val !== undefined ? leftSig.val : 0)) : 0;
                const sR = rightSig ? (rightSig.audio ? rightSig.audio[s] : (rightSig.val !== undefined ? rightSig.val : 0)) : 0;
                const outLVal = dsp.tanh(sL * vol);
                const outRVal = dsp.tanh(sR * vol);

                outL[offset + s] = outLVal;
                outR[offset + s] = outRVal;

                this.masterOutBuffers.left[s] = outLVal;
                this.masterOutBuffers.right[s] = outRVal;
            }
        } else {
            // Silence if no master out module present
            for (let s = 0; s < blockSize; s++) {
                outL[offset + s] = 0;
                outR[offset + s] = 0;
                this.masterOutBuffers.left[s] = 0;
                this.masterOutBuffers.right[s] = 0;
            }
        }
    }

    /**
     * Clear all modules and cables
     */
    clear() {
        for (const mod of this.modules) {
            if (mod.workspace) {
                try { mod.workspace.dispose(); } catch (e) {}
            }
        }
        this.modules = [];
        this.cables = [];
        this.moduleOutputCache.clear();
    }

    /**
     * Export rack setup to JSON
     */
    toJSON() {
        return {
            version: 3,
            timestamp: Date.now(),
            modules: this.modules.map(m => ({
                id: m.id,
                type: m.type,
                name: m.name,
                x: m.x,
                y: m.y,
                width: m.width,
                height: m.height,
                color: m.color,
                isTerminal: m.isTerminal,
                inputs: m.inputs,
                outputs: m.outputs,
                params: m.params,
                xml: m.xml
            })),
            cables: this.cables.map(c => ({
                id: c.id,
                fromModuleId: c.fromModuleId,
                fromPort: c.fromPort,
                toModuleId: c.toModuleId,
                toPort: c.toPort,
                color: c.color
            }))
        };
    }

    /**
     * Load rack setup from JSON
     */
    fromJSON(data) {
        this.clear();
        if (!data || !data.modules) return;

        let maxModId = 1;
        for (const m of data.modules) {
            const modInstance = {
                id: m.id,
                type: m.type,
                name: m.name,
                x: m.x || 100,
                y: m.y || 100,
                width: m.width || 190,
                height: m.height || 250,
                color: m.color || '#059669',
                isTerminal: !!m.isTerminal,
                inputs: m.inputs || [],
                outputs: m.outputs || [],
                params: m.params || [],
                xml: m.xml || '',
                engine: new BlocklySynthEngine(this.sampleRate)
            };
            this.modules.push(modInstance);
            this.syncModuleWithXml(modInstance, m.xml);

            const numId = parseInt(m.id.replace('mod_', ''), 10);
            if (!isNaN(numId) && numId >= maxModId) maxModId = numId + 1;
        }
        this.nextModuleId = maxModId;

        if (Array.isArray(data.cables)) {
            let maxCableId = 1;
            for (const c of data.cables) {
                this.cables.push({
                    id: c.id,
                    fromModuleId: c.fromModuleId,
                    fromPort: c.fromPort,
                    toModuleId: c.toModuleId,
                    toPort: c.toPort,
                    color: c.color || '#22c55e'
                });
                const cNum = parseInt(c.id.replace('cable_', ''), 10);
                if (!isNaN(cNum) && cNum >= maxCableId) maxCableId = cNum + 1;
            }
            this.nextCableId = maxCableId;
        }
    }
}
