/**
 * =========================================================================
 * BRACK Scriptable Module Templates Catalog (web/modules_catalog.js)
 * Every module is an editable JS script with dynamic inputs, outputs, DSP & UI
 * =========================================================================
 */

export const MODULE_CATALOG = {
    clock: {
        name: "CLOCK",
        category: "GENERATOR",
        color: 0xFFfeca57,
        code: `// --- SCRIPTABLE CLOCK ---
export default {
    params: [
        { id: 0, name: "BPM", min: 40, max: 240, default: 120, unit: "BPM" },
        { id: 1, name: "PW",  min: 0.1, max: 0.9, default: 0.5, unit: "%" }
    ],

    outputs: [
        { type: "VAL",   name: "GATE" },
        { type: "AUDIO", name: "PULSE" }
    ],

    init(sampleRate) {
        this.phase = 0.0;
        this.gate = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        const bpm = this.params[0] || 120;
        const pw  = this.params[1] || 0.5;
        const freq = (bpm / 60.0) * 2.0;
        const dt = freq / sampleRate;

        const outAudio = outputs.audio(1);

        for (let s = 0; s < outAudio.length; s++) {
            this.phase = (this.phase + dt) % 1.0;
            this.gate = (this.phase < pw) ? 1.0 : 0.0;
            outAudio[s] = this.gate;
        }

        outputs.val(0, this.gate);
    }
};`
    },

    seq: {
        name: "SEQ",
        category: "CONTROL",
        color: 0xFF1dd1a1,
        code: `// --- SCRIPTABLE 8-STEP SEQ ---
export default {
    params: [
        { id: 0, name: "Root", min: -2, max: 2, default: 0, unit: "oct" }
    ],

    outputs: [
        { type: "VAL",   name: "PITCH" },
        { type: "VAL",   name: "GATE" }
    ],

    init(sampleRate) {
        this.step = 0;
        this.lastClock = 0.0;
        this.notes = [0, 3, 7, 10, 12, 10, 7, 3];
        this.voct = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        let clockTrigger = false;

        for (const link of inputs) {
            if (link.type === 'val' && link.val > 0.5 && this.lastClock <= 0.5) {
                clockTrigger = true;
            }
            if (link.type === 'val') this.lastClock = link.val;
        }

        if (clockTrigger) {
            this.step = (this.step + 1) % this.notes.length;
            this.voct = (this.notes[this.step] / 12.0) + (this.params[0] || 0);
        }

        outputs.val(0, this.voct);
        outputs.val(1, this.lastClock > 0.5 ? 1.0 : 0.0);
    }
};`
    },

    vco: {
        name: "VCO",
        category: "GENERATOR",
        color: 0xFF48dbfb,
        code: `// --- SCRIPTABLE VCO ---
export default {
    params: [
        { id: 0, name: "BaseFreq", min: 20, max: 800, default: 130.81, unit: "Hz" },
        { id: 1, name: "Wave",     min: 0,  max: 3,   default: 0,      unit: "sel" },
        { id: 2, name: "PW",       min: 0.05, max: 0.95, default: 0.5, unit: "%" },
        { id: 3, name: "FM Depth", min: 0,  max: 1,   default: 0,      unit: "%" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT" }
    ],

    init(sampleRate) {
        this.phase = 0.0;
        this.currentVoct = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        let voctMod = 0.0;
        let fmAudio = null;

        // Inspect all dynamic input links
        for (const link of inputs) {
            if (link.type === 'midi' && link.events) {
                for (const ev of link.events) {
                    if (ev.status === 0x90 && ev.velocity > 0) {
                        this.currentVoct = (ev.note - 60) / 12.0;
                    }
                }
            } else if (link.type === 'val') {
                voctMod += link.val;
            } else if (link.type === 'audio') {
                fmAudio = link.audio;
            }
        }

        const baseFreq = this.params[0] || 130.81;
        const waveSel  = this.params[1] || 0;
        const pw       = this.params[2] || 0.5;
        const fmDepth  = this.params[3] || 0;

        const targetFreq = dsp.voctToFreq(this.currentVoct + voctMod, baseFreq);
        const out = outputs.audio(0);

        for (let s = 0; s < out.length; s++) {
            let freq = targetFreq;
            if (fmAudio) freq += fmAudio[s] * fmDepth * 1000.0;
            freq = dsp.clamp(freq, 1.0, sampleRate * 0.48);
            const dt = freq / sampleRate;

            let sample = 0;
            if (waveSel < 0.5) {
                sample = dsp.sawPolyblep(this.phase, dt);
            } else if (waveSel < 1.5) {
                sample = dsp.sqrPolyblep(this.phase, pw, dt);
            } else if (waveSel < 2.5) {
                sample = 2.0 * Math.abs(2.0 * this.phase - 1.0) - 1.0; // Triangle
            } else {
                sample = Math.sin(this.phase * 2.0 * Math.PI); // Sine
            }

            out[s] = sample;
            this.phase = (this.phase + dt) % 1.0;
        }
    }
};`
    },

    vcf: {
        name: "VCF",
        category: "FILTER",
        color: 0xFFff9f43,
        code: `// --- SCRIPTABLE 24dB LADDER VCF ---
export default {
    params: [
        { id: 0, name: "Cutoff",    min: 30, max: 12000, default: 800, unit: "Hz" },
        { id: 1, name: "Resonance", min: 0,  max: 0.98,  default: 0.7, unit: "%" },
        { id: 2, name: "Drive",     min: 1,  max: 4,     default: 1.5, unit: "x" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT" }
    ],

    init(sampleRate) {
        this.moogState = new Float32Array(4);
    },

    process(inputs, outputs, sampleRate, dsp) {
        let cvMod = 0.0;
        for (const link of inputs) {
            if (link.type === 'val') {
                cvMod += link.val;
            }
        }

        const baseCutoff = this.params[0] || 800;
        const resonance  = this.params[1] || 0.7;
        const drive      = this.params[2] || 1.5;

        const cutoff = dsp.clamp(baseCutoff * Math.pow(2.0, cvMod), 20, sampleRate * 0.45);
        const out = outputs.audio(0);

        for (let s = 0; s < out.length; s++) {
            // Sum all incoming audio links
            let inSample = 0.0;
            for (const link of inputs) {
                if (link.type === 'audio' && link.audio) {
                    inSample += link.audio[s];
                }
            }

            out[s] = dsp.moogStep(this.moogState, inSample, cutoff, resonance, drive, sampleRate);
        }
    }
};`
    },

    adsr: {
        name: "ADSR",
        category: "MODULATOR",
        color: 0xFFa29bfe,
        code: `// --- SCRIPTABLE ADSR ENVELOPE ---
export default {
    params: [
        { id: 0, name: "Attack",  min: 0.001, max: 2.0, default: 0.01, unit: "s" },
        { id: 1, name: "Decay",   min: 0.001, max: 2.0, default: 0.20, unit: "s" },
        { id: 2, name: "Sustain", min: 0.0,   max: 1.0, default: 0.25, unit: "%" },
        { id: 3, name: "Release", min: 0.001, max: 4.0, default: 0.20, unit: "s" }
    ],

    outputs: [
        { type: "VAL",   name: "ENV" },
        { type: "AUDIO", name: "CV" }
    ],

    init(sampleRate) {
        this.level = 0.0;
        this.stage = 0; // 0=IDLE, 1=ATTACK, 2=DECAY, 3=SUSTAIN, 4=RELEASE
        this.lastGate = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        let gate = 0.0;

        for (const link of inputs) {
            if (link.type === 'midi' && link.events) {
                for (const ev of link.events) {
                    if (ev.status === 0x90 && ev.velocity > 0) gate = 1.0;
                    else if (ev.status === 0x80 || (ev.status === 0x90 && ev.velocity === 0)) gate = 0.0;
                }
            } else if (link.type === 'val' && link.val > 0.1) {
                gate = 1.0;
            }
        }

        const aRate = 1.0 / (Math.max(0.001, this.params[0] || 0.01) * sampleRate);
        const dRate = 1.0 / (Math.max(0.001, this.params[1] || 0.20) * sampleRate);
        const sLvl  = dsp.clamp(this.params[2] !== undefined ? this.params[2] : 0.25, 0, 1);
        const rRate = 1.0 / (Math.max(0.001, this.params[3] || 0.20) * sampleRate);

        if (gate > 0.5 && this.lastGate <= 0.5) this.stage = 1; // Attack
        else if (gate <= 0.5 && this.lastGate > 0.5) this.stage = 4; // Release
        this.lastGate = gate;

        const outAudio = outputs.audio(1);

        for (let s = 0; s < outAudio.length; s++) {
            if (this.stage === 1) { // Attack
                this.level += aRate * (1.2 - this.level);
                if (this.level >= 1.0) { this.level = 1.0; this.stage = 2; }
            } else if (this.stage === 2) { // Decay
                this.level -= dRate * (this.level - sLvl);
                if (this.level <= sLvl + 0.001) { this.level = sLvl; this.stage = 3; }
            } else if (this.stage === 3) { // Sustain
                this.level = sLvl;
            } else if (this.stage === 4) { // Release
                this.level -= rRate * this.level;
                if (this.level <= 0.0001) { this.level = 0.0; this.stage = 0; }
            } else {
                this.level = 0.0;
            }

            outAudio[s] = this.level;
        }

        outputs.val(0, this.level);
    }
};`
    },

    vca: {
        name: "VCA",
        category: "AMP",
        color: 0xFFff6b6b,
        code: `// --- SCRIPTABLE DUAL VCA ---
export default {
    params: [
        { id: 0, name: "Initial Gain", min: 0, max: 1, default: 0, unit: "%" },
        { id: 1, name: "Exponential",  min: 0, max: 1, default: 1, unit: "bin" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT" }
    ],

    init(sampleRate) {},

    process(inputs, outputs, sampleRate, dsp) {
        let cvGain = 0.0;
        let hasCv = false;

        for (const link of inputs) {
            if (link.type === 'val') {
                cvGain += link.val;
                hasCv = true;
            }
        }

        const initGain = this.params[0] || 0;
        const isExp    = (this.params[1] !== undefined ? this.params[1] : 1) > 0.5;

        let totalGain = initGain + (hasCv ? cvGain : 1.0);
        totalGain = dsp.clamp(totalGain, 0.0, 2.0);
        if (isExp && totalGain > 0.0001) {
            totalGain = totalGain * totalGain * totalGain;
        }

        const out = outputs.audio(0);

        for (let s = 0; s < out.length; s++) {
            let inSample = 0.0;
            for (const link of inputs) {
                if (link.type === 'audio' && link.audio) {
                    inSample += link.audio[s];
                }
            }
            out[s] = inSample * totalGain;
        }
    }
};`
    },

    bytebeat: {
        name: "BYTEBEAT",
        category: "MATH",
        color: 0xFFe056fd,
        code: `// --- SCRIPTABLE 8-BIT BYTEBEAT GENERATOR ---
export default {
    params: [
        { id: 0, name: "Speed", min: 1000, max: 32000, default: 8000, unit: "Hz" },
        { id: 1, name: "Formula", min: 0, max: 3, default: 0, unit: "sel" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT" }
    ],

    init(sampleRate) {
        this.t = 0;
        this.phase = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        const speed = this.params[0] || 8000;
        const formula = Math.floor(this.params[1] || 0);
        const dt = speed / sampleRate;
        const out = outputs.audio(0);

        for (let s = 0; s < out.length; s++) {
            this.phase += dt;
            if (this.phase >= 1.0) {
                this.phase -= 1.0;
                this.t = (this.t + 1) >>> 0;
            }

            const t = this.t;
            let val = 0;

            if (formula === 0) {
                // Classic: t * ((t>>12|t>>8)&63&t>>4)
                val = (t * ((t >> 12 | t >> 8) & 63 & t >> 4)) & 255;
            } else if (formula === 1) {
                // Melody: (t>>7|t|t>>6)*10+4*(t&t>>13|t>>6)
                val = ((t >> 7 | t | t >> 6) * 10 + 4 * (t & (t >> 13) | t >> 6)) & 255;
            } else if (formula === 2) {
                // Acid Arp: (t*(t>>5|t>>8))>>(t>>16)
                val = ((t * (t >> 5 | t >> 8)) >> (t >> 16)) & 255;
            } else {
                // Noise Rhythms: ((t*5&t>>7)|(t*3&t>>10))
                val = ((t * 5 & t >> 7) | (t * 3 & t >> 10)) & 255;
            }

            out[s] = (val / 127.5) - 1.0;
        }
    }
};`
    },

    delay: {
        name: "DELAY",
        category: "EFFECT",
        color: 0xFF1dd1a1,
        code: `// --- SCRIPTABLE TAPE DELAY ---
export default {
    params: [
        { id: 0, name: "Time",     min: 0.02, max: 1.5, default: 0.25, unit: "s" },
        { id: 1, name: "Feedback", min: 0.0,  max: 0.95, default: 0.50, unit: "%" },
        { id: 2, name: "Damp",     min: 0.0,  max: 0.90, default: 0.40, unit: "%" },
        { id: 3, name: "Mix",      min: 0.0,  max: 1.0,  default: 0.35, unit: "%" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT" }
    ],

    init(sampleRate) {
        this.maxSamples = Math.floor(sampleRate * 2.0);
        this.buffer = new Float32Array(this.maxSamples);
        this.head = 0;
        this.lpf = 0.0;
    },

    process(inputs, outputs, sampleRate, dsp) {
        const time = dsp.clamp(this.params[0] || 0.25, 0.005, 1.9);
        const fb   = dsp.clamp(this.params[1] || 0.50, 0, 0.95);
        const damp = dsp.clamp(this.params[2] || 0.40, 0, 0.9);
        const mix  = dsp.clamp(this.params[3] || 0.35, 0, 1.0);

        const delaySamples = time * sampleRate;
        const out = outputs.audio(0);

        for (let s = 0; s < out.length; s++) {
            let inSample = 0.0;
            for (const link of inputs) {
                if (link.type === 'audio' && link.audio) inSample += link.audio[s];
            }

            let rPos = this.head - delaySamples;
            if (rPos < 0) rPos += this.maxSamples;
            const rIdx1 = Math.floor(rPos) % this.maxSamples;
            const rIdx2 = (rIdx1 + 1) % this.maxSamples;
            const frac = rPos - Math.floor(rPos);

            const delayed = dsp.lerp(this.buffer[rIdx1], this.buffer[rIdx2], frac);
            this.lpf = delayed * (1.0 - damp) + this.lpf * damp;

            this.buffer[this.head] = inSample + dsp.tanh(this.lpf * fb);
            this.head = (this.head + 1) % this.maxSamples;

            out[s] = dsp.lerp(inSample, delayed, mix);
        }
    }
};`
    },

    out: {
        name: "OUT",
        category: "OUTPUT",
        color: 0xFFf5f6fa,
        code: `// --- SCRIPTABLE MASTER OUTPUT ---
export default {
    params: [
        { id: 0, name: "Master Vol", min: 0, max: 1.5, default: 0.85, unit: "%" }
    ],

    outputs: [
        { type: "AUDIO", name: "OUT L" },
        { type: "AUDIO", name: "OUT R" }
    ],

    init(sampleRate) {},

    process(inputs, outputs, sampleRate, dsp) {
        const vol = this.params[0] !== undefined ? this.params[0] : 0.85;
        const outL = outputs.audio(0);
        const outR = outputs.audio(1);

        for (let s = 0; s < outL.length; s++) {
            let sum = 0.0;
            for (const link of inputs) {
                if (link.type === 'audio' && link.audio) {
                    sum += link.audio[s];
                }
            }

            const saturated = dsp.tanh(sum * vol);
            outL[s] = saturated;
            outR[s] = saturated;
        }
    }
};`
    }
};
