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
    outputs: [{ name: "GATE", type: "VAL" }, { name: "PULSE", type: "AUDIO" }],
    params: { bpm: [120, 40, 240, 'BPM'], pw: [0.5, 0.1, 0.9, '%'] },

    init() { this.phase = 0; this.gate = 0; },

    process(inp, out) {
        const dt = (this.params.bpm / 60 * 2) / 48000;
        out.audio('PULSE', s => {
            this.phase = (this.phase + dt) % 1;
            this.gate = (this.phase < this.params.pw) ? 1 : 0;
            return this.gate;
        });
        out.val('GATE', this.gate);
    }
};`
    },

    seq: {
        name: "SEQ",
        category: "CONTROL",
        color: 0xFF1dd1a1,
        code: `// --- SCRIPTABLE 8-STEP SEQ ---
export default {
    inputs: [{ name: "CLK", type: "VAL" }],
    outputs: [{ name: "PITCH", type: "VAL" }, { name: "GATE", type: "VAL" }],
    params: { root: [0, -2, 2, 'oct'] },

    init() {
        this.step = 0;
        this.last = 0;
        this.notes = [0, 3, 7, 10, 12, 10, 7, 3];
        this.voct = 0;
    },

    process(inp, out) {
        const clk = inp.getVal('CLK');
        if (clk > 0.5 && this.last <= 0.5) {
            this.step = (this.step + 1) % this.notes.length;
            this.voct = (this.notes[this.step] / 12) + this.params.root;
        }
        this.last = clk;
        out.val('PITCH', this.voct);
        out.val('GATE', this.last > 0.5 ? 1 : 0);
    },

    draw(gfx) {
        const y = gfx.height - 18;
        for (let i = 0; i < 8; i++) {
            gfx.drawCircle(22 + i * 18, y, (this.step === i) ? 4 : 3, (this.step === i) ? 0xFF1dd1a1 : 0xFF283832, true);
        }
    }
};`
    },

    vco: {
        name: "VCO",
        category: "GENERATOR",
        color: 0xFF48dbfb,
        code: `// --- SCRIPTABLE VCO ---
export default {
    inputs: [{ name: "FM", type: "VAL" }],
    outputs: [{ name: "OUT", type: "AUDIO" }],
    params: { freq: [130.81, 20, 800, 'Hz'], wave: [0, 0, 3], pw: [0.5, 0.05, 0.95] },

    init() { this.phase = 0; },

    process(inp, out, dsp) {
        const fm = inp.getVal('FM', 0);
        const f = inp.has('FM') ? dsp.voct(fm, this.params.freq) : this.params.freq;
        const dt = f / 48000;
        const w = this.params.wave;

        out.audio('OUT', s => {
            let smp = (w < 0.5) ? dsp.saw(this.phase, dt) :
                      (w < 1.5) ? dsp.sqr(this.phase, this.params.pw, dt) :
                      (w < 2.5) ? dsp.tri(this.phase) : dsp.sin(this.phase);
            this.phase = (this.phase + dt) % 1;
            return smp;
        });
    }
};`
    },

    vcf: {
        name: "VCF",
        category: "FILTER",
        color: 0xFFff9f43,
        code: `// --- SCRIPTABLE 24dB LADDER VCF ---
export default {
    inputs: [{ name: "IN", type: "AUDIO" }, { name: "CUTOFF", type: "VAL" }],
    outputs: [{ name: "LP", type: "AUDIO" }],
    params: { cutoff: [800, 30, 12000, 'Hz'], res: [0.7, 0, 0.95], drive: [1.2, 1, 4] },

    init() { this.moog = [0, 0, 0, 0]; },

    process(inp, out, dsp) {
        const inAudio = inp.getAudio('IN');
        const cv = inp.getVal('CUTOFF', 0);
        const fc = dsp.clamp(this.params.cutoff * (inp.has('CUTOFF') ? Math.pow(2, cv) : 1), 20, 20000);

        out.audio('LP', s => dsp.moog(this.moog, inAudio[s], fc, this.params.res, this.params.drive));
    }
};`
    },

    adsr: {
        name: "ADSR",
        category: "MODULATOR",
        color: 0xFFa29bfe,
        code: `// --- SCRIPTABLE ADSR ---
export default {
    inputs: [{ name: "GATE", type: "VAL" }],
    outputs: [{ name: "ENV", type: "VAL" }, { name: "CV", type: "AUDIO" }],
    params: { attack: [0.01, 0.001, 2, 's'], decay: [0.20, 0.001, 2, 's'], sustain: [0.25, 0, 1, '%'], release: [0.20, 0.001, 4, 's'] },

    init() { this.level = 0; this.stage = 0; this.lastGate = 0; },

    process(inp, out) {
        const gate = inp.getVal('GATE') > 0.1 ? 1 : 0;
        if (gate && !this.lastGate) this.stage = 1;
        if (!gate && this.lastGate) this.stage = 4;
        this.lastGate = gate;

        const aRate = 1 / (this.params.attack * 48000);
        const dRate = 1 / (this.params.decay * 48000);
        const rRate = 1 / (this.params.release * 48000);
        const sLvl  = this.params.sustain;

        out.audio('CV', s => {
            if (this.stage === 1) {
                this.level += aRate * (1.2 - this.level);
                if (this.level >= 1) { this.level = 1; this.stage = 2; }
            } else if (this.stage === 2) {
                this.level -= dRate * (this.level - sLvl);
                if (this.level <= sLvl + 0.001) { this.level = sLvl; this.stage = 3; }
            } else if (this.stage === 3) {
                this.level = sLvl;
            } else if (this.stage === 4) {
                this.level -= rRate * this.level;
                if (this.level <= 0.0001) { this.level = 0; this.stage = 0; }
            }
            return this.level;
        });

        out.val('ENV', this.level);
    }
};`
    },

    vca: {
        name: "VCA",
        category: "AMP",
        color: 0xFFff6b6b,
        code: `// --- SCRIPTABLE VCA ---
export default {
    inputs: [{ name: "IN", type: "AUDIO" }, { name: "GAIN", type: "VAL" }],
    outputs: [{ name: "OUT", type: "AUDIO" }],
    params: { gain: [0.0, 0, 1, '%'], exp: [1, 0, 1, 'bin'] },

    process(inp, out, dsp) {
        const inAudio = inp.getAudio('IN');
        let g = this.params.gain + (inp.has('GAIN') ? inp.getVal('GAIN') : 1.0);
        g = dsp.clamp(g, 0, 2);
        if (this.params.exp) g = g * g * g;
        out.audio('OUT', s => inAudio[s] * g);
    }
};`
    },

    bytebeat: {
        name: "BYTEBEAT",
        category: "MATH",
        color: 0xFFe056fd,
        code: `// --- SCRIPTABLE 8-BIT BYTEBEAT ---
export default {
    outputs: [{ name: "OUT", type: "AUDIO" }],
    params: { speed: [8000, 1000, 32000, 'Hz'], formula: [0, 0, 3] },

    init() { this.t = 0; this.phase = 0; },

    process(inp, out) {
        const dt = this.params.speed / 48000;
        const f = Math.floor(this.params.formula);

        out.audio('OUT', s => {
            this.phase += dt;
            if (this.phase >= 1) { this.phase -= 1; this.t++; }
            const t = this.t;
            let v = (f === 0) ? (t * ((t>>12|t>>8)&63&t>>4)) :
                    (f === 1) ? ((t>>7|t|t>>6)*10+4*(t&t>>13|t>>6)) :
                    (f === 2) ? ((t*(t>>5|t>>8))>>(t>>16)) : ((t*5&t>>7)|(t*3&t>>10));
            return ((v & 255) / 127.5) - 1.0;
        });
    }
};`
    },

    delay: {
        name: "DELAY",
        category: "EFFECT",
        color: 0xFF1dd1a1,
        code: `// --- SCRIPTABLE DELAY ---
export default {
    inputs: [{ name: "IN", type: "AUDIO" }],
    outputs: [{ name: "OUT", type: "AUDIO" }],
    params: { time: [0.25, 0.02, 1.5, 's'], fb: [0.50, 0, 0.95, '%'], mix: [0.35, 0, 1, '%'] },

    init() {
        this.buf = new Float32Array(96000);
        this.head = 0;
        this.lpf = 0;
    },

    process(inp, out, dsp) {
        const inAudio = inp.getAudio('IN');
        const delaySamples = Math.floor(this.params.time * 48000);
        const fb = this.params.fb;
        const mix = this.params.mix;

        out.audio('OUT', s => {
            let r = this.head - delaySamples;
            if (r < 0) r += 96000;
            const delayed = this.buf[r];
            this.lpf = delayed * 0.6 + this.lpf * 0.4;
            this.buf[this.head] = inAudio[s] + dsp.tanh(this.lpf * fb);
            this.head = (this.head + 1) % 96000;
            return dsp.lerp(inAudio[s], delayed, mix);
        });
    }
};`
    },

    out: {
        name: "OUT",
        category: "OUTPUT",
        color: 0xFFf5f6fa,
        code: `// --- SCRIPTABLE MASTER OUT ---
export default {
    inputs: [{ name: "IN", type: "AUDIO" }],
    outputs: [{ name: "OUT L", type: "AUDIO" }, { name: "OUT R", type: "AUDIO" }],
    params: { volume: [0.85, 0, 1.5, '%'] },

    process(inp, out, dsp) {
        const inAudio = inp.getAudio('IN');
        const vol = this.params.volume;
        out.audio(0, s => dsp.tanh(inAudio[s] * vol));
        out.audio(1, s => dsp.tanh(inAudio[s] * vol));
    }
};`
    }
};
