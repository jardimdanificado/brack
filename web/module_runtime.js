/**
 * =========================================================================
 * BRACK Module Script Runtime & Sandbox (web/module_runtime.js)
 * Executes user module scripts with safe isolation, hot-reloading & DSP helpers
 * =========================================================================
 */

import { dsp } from './dsp_toolkit.js';

export class ScriptableModule {
    constructor(id, codeString, sampleRate) {
        this.id = id;
        this.sampleRate = sampleRate || 48000;
        this.state = {};
        this.params = [];
        this.paramDefs = [];
        this.outputDefs = [];
        this.code = codeString;
        this.error = null;
        this.compiledModule = null;

        // Pre-allocated Audio & MIDI Output buffers
        this.audioOutputs = [];
        for (let o = 0; o < 8; o++) {
            this.audioOutputs.push(new Float32Array(128));
        }
        this.midiOutputs = [];
        for (let o = 0; o < 8; o++) {
            this.midiOutputs.push([]);
        }
        this.valOutputs = new Float32Array(8);

        this.outputsHelper = {
            audio: (idx) => this.audioOutputs[idx || 0],
            midi: (idx, event) => {
                if (event) this.midiOutputs[idx || 0].push(event);
                return this.midiOutputs[idx || 0];
            },
            val: (idx, value) => {
                this.valOutputs[idx || 0] = value;
            }
        };

        this.compile(codeString);
    }

    compile(codeString) {
        try {
            let cleanCode = codeString.trim();
            if (/export\s+default\s+/.test(cleanCode)) {
                cleanCode = cleanCode.replace(/export\s+default\s+/, 'return ');
            } else if (/module\.exports\s*=\s*/.test(cleanCode)) {
                cleanCode = cleanCode.replace(/module\.exports\s*=\s*/, 'return ');
            } else if (!cleanCode.startsWith('return')) {
                cleanCode = 'return ' + cleanCode;
            }

            const factory = new Function('dsp', cleanCode);
            const modObj = factory(dsp);

            if (!modObj || typeof modObj.process !== 'function') {
                throw new Error('Module must return an object with a process(inputs, outputs, sampleRate, dsp) function');
            }

            this.compiledModule = modObj;
            this.code = codeString;
            this.paramDefs = modObj.params || [];
            this.outputDefs = modObj.outputs || [{ type: 'AUDIO', name: 'OUT' }];

            // Initialize param defaults if not set
            this.paramDefs.forEach((p, idx) => {
                if (this.params[idx] === undefined) {
                    this.params[idx] = p.default !== undefined ? p.default : 0.0;
                }
            });

            // Initialize module state
            if (typeof modObj.init === 'function') {
                modObj.init.call(this.state, this.sampleRate);
            }

            this.error = null;
            return { success: true };
        } catch (err) {
            this.error = err.message;
            console.warn(`[Module ${this.id} Compile Error]:`, err);
            return { success: false, error: err.message };
        }
    }

    setParam(paramId, value) {
        this.params[paramId] = value;
    }

    getParam(paramId) {
        return this.params[paramId] !== undefined ? this.params[paramId] : 0.0;
    }

    process(inputs, numSamples) {
        if (!this.compiledModule || this.error) {
            // Fill outputs with silence
            for (let o = 0; o < this.audioOutputs.length; o++) {
                this.audioOutputs[o].fill(0);
                this.midiOutputs[o].length = 0;
                this.valOutputs[o] = 0;
            }
            return;
        }

        // Reset out buffers
        for (let o = 0; o < this.audioOutputs.length; o++) {
            this.audioOutputs[o].fill(0);
            this.midiOutputs[o].length = 0;
        }

        try {
            this.state.params = this.params;
            this.compiledModule.params = this.params;
            this.compiledModule.process.call(
                this.state,
                inputs,
                this.outputsHelper,
                this.sampleRate,
                dsp
            );
        } catch (err) {
            this.error = err.message;
            console.error(`[Module ${this.id} Runtime Error]:`, err);
        }
    }
}
