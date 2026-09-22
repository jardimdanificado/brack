/**
 * =========================================================================
 * BRACK Modular Audio Core (src/brack.c)
 * Universal Eurorack DSP Engine in Pure C (Freestanding / No Libc)
 * =========================================================================
 */

#include "brack.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

static brack_engine_t g_engine = {0};

/* =========================================================================
 * Memory Management (Bump Allocator over WASM Linear Heap)
 * ========================================================================= */

static uint8_t *g_heap_top = 0;

static void* brack_alloc(uint32_t size) {
    if (!g_heap_top) {
#if defined(__wasm__)
        extern uint8_t __heap_base;
        g_heap_top = &__heap_base;
#else
        static uint8_t s_fallback_heap[8 * 1024 * 1024];
        g_heap_top = s_fallback_heap;
#endif
    }
    // 16-byte alignment
    uintptr_t cur = ((uintptr_t)g_heap_top + 15) & ~15;
    g_heap_top = (uint8_t*)(cur + size);

#if defined(__wasm__)
    uint32_t cur_mem_bytes = __builtin_wasm_memory_size(0) * 65536;
    if ((uintptr_t)g_heap_top > cur_mem_bytes) {
        uint32_t need_pages = (((uintptr_t)g_heap_top - cur_mem_bytes) + 65535) / 65536;
        __builtin_wasm_memory_grow(0, need_pages);
    }
#endif
    return (void*)cur;
}

static void brack_zero_memory(void *dst, uint32_t size) {
    uint8_t *p = (uint8_t*)dst;
    for (uint32_t i = 0; i < size; i++) p[i] = 0;
}

/* =========================================================================
 * Topological Sort & Graph Order Resolver
 * ========================================================================= */

static void brack_update_graph(void) {
    uint8_t visited[BRACK_MAX_MODULES] = {0};
    uint8_t in_degree[BRACK_MAX_MODULES] = {0};
    
    // Count dependencies (in-degree from active cables)
    for (uint32_t c = 0; c < g_engine.cable_count; c++) {
        brack_cable_t *cable = &g_engine.cables[c];
        if (cable->active && cable->dst_module < BRACK_MAX_MODULES) {
            in_degree[cable->dst_module]++;
        }
    }
    
    g_engine.exec_count = 0;
    
    // Queue modules with 0 dependencies first (e.g. Master Clock, Sequencer, LFO, VCO)
    for (uint32_t i = 0; i < BRACK_MAX_MODULES; i++) {
        if (g_engine.modules[i].active && in_degree[i] == 0) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
        }
    }
    
    // Process remaining modules
    for (uint32_t head = 0; head < g_engine.exec_count; head++) {
        uint16_t curr = g_engine.exec_order[head];
        for (uint32_t c = 0; c < g_engine.cable_count; c++) {
            brack_cable_t *cable = &g_engine.cables[c];
            if (cable->active && cable->src_module == curr) {
                uint16_t dst = cable->dst_module;
                if (!visited[dst] && g_engine.modules[dst].active) {
                    if (in_degree[dst] > 0) in_degree[dst]--;
                    if (in_degree[dst] == 0) {
                        g_engine.exec_order[g_engine.exec_count++] = dst;
                        visited[dst] = 1;
                    }
                }
            }
        }
    }
    
    // Any remaining active modules with circular feedback loops
    for (uint32_t i = 0; i < BRACK_MAX_MODULES; i++) {
        if (g_engine.modules[i].active && !visited[i]) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
        }
    }
}

/* =========================================================================
 * Built-In DSP Modules Implementation
 * ========================================================================= */

// --- 1. VCO (PolyBLEP Oscillator) ---
static void dsp_vco(brack_module_t *mod, uint32_t n, float sr) {
    float *out_mix  = mod->out_buffers[0];
    float *out_saw  = mod->out_buffers[1];
    float *out_sqr  = mod->out_buffers[2];
    float *out_tri  = mod->out_buffers[3];
    float *out_sin  = mod->out_buffers[4];

    float *in_voct  = mod->in_buffers[0];
    float *in_pwm   = mod->in_buffers[1];
    float *in_fm    = mod->in_buffers[2];
    float *in_sync  = mod->in_buffers[3];

    float octave    = mod->params[0]; // -3..+3
    float semi      = mod->params[1]; // -12..+12
    float fine      = mod->params[2]; // -1..+1
    float base_freq = mod->params[3]; // e.g. 261.63 (C4) or 440 (A4)
    float base_pw   = mod->params[4]; // 0.05..0.95
    float fm_depth  = mod->params[5]; // 0..1
    float wave_sel  = mod->params[6]; // 0=Saw, 1=Sqr, 2=Tri, 3=Sin

    if (base_freq <= 0.0f) base_freq = 261.625565f;
    if (base_pw <= 0.0f) base_pw = 0.5f;

    float phase = mod->state_f[0];
    float last_sync = mod->state_f[1];
    float tri_integrator = mod->state_f[2];

    float pitch_offset = octave + (semi / 12.0f) + (fine / 1200.0f);

    for (uint32_t i = 0; i < n; i++) {
        // Frequency calculation with V/Oct and Linear FM
        float voct = pitch_offset + in_voct[i];
        float freq = b_voct_to_freq(voct, base_freq);
        if (in_fm[i] != 0.0f) {
            freq += in_fm[i] * fm_depth * 1000.0f;
        }
        freq = b_clamp(freq, 0.5f, sr * 0.49f);

        float dt = freq / sr;

        // Hard Sync
        if (in_sync[i] > 0.5f && last_sync <= 0.5f) {
            phase = 0.0f;
        }
        last_sync = in_sync[i];

        // Waveform: Saw (Bandlimited PolyBLEP)
        float saw = 2.0f * phase - 1.0f;
        saw -= b_polyblep(phase, dt);

        // Pulse / Square with PWM
        float pw = b_clamp(base_pw + in_pwm[i] * 0.45f, 0.02f, 0.98f);
        float sqr = (phase < pw) ? 1.0f : -1.0f;
        sqr += b_polyblep(phase, dt);
        float phase_pw = phase - pw;
        if (phase_pw < 0.0f) phase_pw += 1.0f;
        sqr -= b_polyblep(phase_pw, dt);

        // Sine (High precision normalized polynomial)
        float sine = b_sin_norm(phase);

        // Triangle (Bandlimited via integrated square)
        tri_integrator += (sqr * 4.0f * dt) - (tri_integrator * 0.001f);
        float tri = b_clamp(tri_integrator, -1.0f, 1.0f);

        out_saw[i] = saw;
        out_sqr[i] = sqr;
        out_tri[i] = tri;
        out_sin[i] = sine;

        // Main mix output based on wave selector
        if (wave_sel < 0.5f) out_mix[i] = saw;
        else if (wave_sel < 1.5f) out_mix[i] = sqr;
        else if (wave_sel < 2.5f) out_mix[i] = tri;
        else out_mix[i] = sine;

        // Advance phase
        phase += dt;
        if (phase >= 1.0f) phase -= 1.0f;
    }

    mod->state_f[0] = phase;
    mod->state_f[1] = last_sync;
    mod->state_f[2] = tri_integrator;
}

// --- 2. VCF (Moog 24dB Ladder + 12dB State Variable Filter) ---
static void dsp_vcf(brack_module_t *mod, uint32_t n, float sr) {
    float *out_lp   = mod->out_buffers[0];
    float *out_hp   = mod->out_buffers[1];
    float *out_bp   = mod->out_buffers[2];
    float *out_moog = mod->out_buffers[3];

    float *in_audio = mod->in_buffers[0];
    float *in_cv    = mod->in_buffers[1];
    float *in_res_cv= mod->in_buffers[2];

    float base_cutoff = mod->params[0]; // 20..20000 Hz
    float resonance   = mod->params[1]; // 0.0..0.98
    float drive       = mod->params[2]; // 1.0..10.0
    float mode        = mod->params[3]; // 0=Ladder 24dB, 1=SVF

    if (base_cutoff <= 0.0f) base_cutoff = 1000.0f;
    if (drive <= 0.0f) drive = 1.0f;

    // Moog 4-pole states
    float s0 = mod->state_f[0];
    float s1 = mod->state_f[1];
    float s2 = mod->state_f[2];
    float s3 = mod->state_f[3];

    // SVF states
    float svf_s0 = mod->state_f[4];
    float svf_s1 = mod->state_f[5];

    for (uint32_t i = 0; i < n; i++) {
        // Cutoff modulated by CV (1V/Oct)
        float cutoff = base_cutoff * b_exp2(in_cv[i]);
        cutoff = b_clamp(cutoff, 10.0f, sr * 0.45f);

        float res = b_clamp(resonance + in_res_cv[i] * 0.5f, 0.0f, 0.99f);

        float input = in_audio[i] * drive;

        // 1. Moog 4-Pole Ladder Model with Non-Linear Tanh Feedback
        float f = (cutoff * BRACK_PI) / sr;
        float k = 4.0f * res;
        
        // Feedback with analog saturation
        float feedback = b_tanh(s3 * k);
        float u = input - feedback;

        s0 += f * (b_tanh(u) - b_tanh(s0));
        s1 += f * (b_tanh(s0) - b_tanh(s1));
        s2 += f * (b_tanh(s1) - b_tanh(s2));
        s3 += f * (b_tanh(s2) - b_tanh(s3));

        float ladder_lp = s3;

        // 2. Chamberlin State Variable Filter (SVF) for LP/HP/BP
        float svf_f = 2.0f * b_sin_norm(f * 0.5f);
        float svf_q = 1.0f - res * 0.95f;

        float svf_hp = input - svf_s0 - svf_q * svf_s1;
        float svf_bp = svf_s1 + svf_f * svf_hp;
        float svf_lp = svf_s0 + svf_f * svf_bp;

        svf_s0 = svf_lp;
        svf_s1 = svf_bp;

        out_lp[i]   = svf_lp;
        out_hp[i]   = svf_hp;
        out_bp[i]   = svf_bp;
        out_moog[i] = ladder_lp;
    }

    mod->state_f[0] = s0;
    mod->state_f[1] = s1;
    mod->state_f[2] = s2;
    mod->state_f[3] = s3;
    mod->state_f[4] = svf_s0;
    mod->state_f[5] = svf_s1;
}

// --- 3. VCA (Voltage Controlled Amplifier) ---
static void dsp_vca(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    float *out_audio = mod->out_buffers[0];
    float *in_audio  = mod->in_buffers[0];
    float *in_cv     = mod->in_buffers[1];

    float init_gain = mod->params[0]; // 0.0..1.0
    float is_exp    = mod->params[1]; // 0=Lin, 1=Exp

    for (uint32_t i = 0; i < n; i++) {
        float gain = init_gain + in_cv[i];
        gain = b_clamp(gain, 0.0f, 2.0f);

        if (is_exp > 0.5f && gain > 0.0001f) {
            // Exponential taper
            gain = gain * gain * gain;
        }

        out_audio[i] = in_audio[i] * gain;
    }
}

// --- 4. ADSR (Analog Exponential Envelope Generator) ---
enum { ADSR_IDLE = 0, ADSR_ATTACK, ADSR_DECAY, ADSR_SUSTAIN, ADSR_RELEASE };

static void dsp_adsr(brack_module_t *mod, uint32_t n, float sr) {
    float *out_env = mod->out_buffers[0];
    float *out_inv = mod->out_buffers[1];
    float *in_gate = mod->in_buffers[0];
    float *in_retrig = mod->in_buffers[1];

    float attack_time  = b_clamp(mod->params[0], 0.001f, 10.0f);
    float decay_time   = b_clamp(mod->params[1], 0.001f, 10.0f);
    float sustain_lvl  = b_clamp(mod->params[2], 0.0f, 1.0f);
    float release_time = b_clamp(mod->params[3], 0.001f, 10.0f);

    int32_t stage = mod->state_i[0];
    float level   = mod->state_f[0];
    float last_gate = mod->state_f[1];

    // Analog curve rate factors
    float a_rate = 1.0f / (attack_time * sr);
    float d_rate = 1.0f / (decay_time * sr);
    float r_rate = 1.0f / (release_time * sr);

    for (uint32_t i = 0; i < n; i++) {
        float gate = in_gate[i];

        // Gate onset trigger
        if (gate > 0.5f && last_gate <= 0.5f) {
            stage = ADSR_ATTACK;
        } else if (gate <= 0.5f && last_gate > 0.5f) {
            stage = ADSR_RELEASE;
        }
        
        // Retrigger input
        if (in_retrig[i] > 0.5f && mod->state_f[2] <= 0.5f) {
            stage = ADSR_ATTACK;
        }
        last_gate = gate;
        mod->state_f[2] = in_retrig[i];

        switch (stage) {
            case ADSR_ATTACK:
                level += a_rate * (1.2f - level); // Analog curved asymptotic rise
                if (level >= 1.0f) {
                    level = 1.0f;
                    stage = ADSR_DECAY;
                }
                break;
            case ADSR_DECAY:
                level -= d_rate * (level - sustain_lvl);
                if (level <= sustain_lvl + 0.001f) {
                    level = sustain_lvl;
                    stage = ADSR_SUSTAIN;
                }
                break;
            case ADSR_SUSTAIN:
                level = sustain_lvl;
                break;
            case ADSR_RELEASE:
                level -= r_rate * level;
                if (level <= 0.0001f) {
                    level = 0.0f;
                    stage = ADSR_IDLE;
                }
                break;
            default:
                level = 0.0f;
                break;
        }

        out_env[i] = level;
        out_inv[i] = 1.0f - level;
    }

    mod->state_i[0] = stage;
    mod->state_f[0] = level;
    mod->state_f[1] = last_gate;
}

// --- 5. LFO (Low Frequency Oscillator) ---
static void dsp_lfo(brack_module_t *mod, uint32_t n, float sr) {
    float *out_sin = mod->out_buffers[0];
    float *out_tri = mod->out_buffers[1];
    float *out_saw = mod->out_buffers[2];
    float *out_sqr = mod->out_buffers[3];

    float *in_reset = mod->in_buffers[0];
    float *in_cv    = mod->in_buffers[1];

    float rate = b_clamp(mod->params[0], 0.01f, 100.0f); // Hz
    float unipolar = mod->params[1]; // 0=Bipolar [-1..1], 1=Unipolar [0..1]

    float phase = mod->state_f[0];
    float last_reset = mod->state_f[1];

    for (uint32_t i = 0; i < n; i++) {
        if (in_reset[i] > 0.5f && last_reset <= 0.5f) {
            phase = 0.0f;
        }
        last_reset = in_reset[i];

        float eff_rate = rate * b_exp2(in_cv[i]);
        eff_rate = b_clamp(eff_rate, 0.001f, 200.0f);

        float s = b_sin_norm(phase);
        float t = 2.0f * (phase < 0.5f ? (2.0f * phase) : (2.0f - 2.0f * phase)) - 1.0f;
        float w = 2.0f * phase - 1.0f;
        float q = (phase < 0.5f) ? 1.0f : -1.0f;

        if (unipolar > 0.5f) {
            s = 0.5f + 0.5f * s;
            t = 0.5f + 0.5f * t;
            w = 0.5f + 0.5f * w;
            q = (q > 0.0f) ? 1.0f : 0.0f;
        }

        out_sin[i] = s;
        out_tri[i] = t;
        out_saw[i] = w;
        out_sqr[i] = q;

        phase += eff_rate / sr;
        if (phase >= 1.0f) phase -= 1.0f;
    }

    mod->state_f[0] = phase;
    mod->state_f[1] = last_reset;
}

// --- 6. Step Sequencer (8/16-Step CV & Gate) ---
static void dsp_seq(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    float *out_cv   = mod->out_buffers[0];
    float *out_gate = mod->out_buffers[1];

    float *in_clock = mod->in_buffers[0];
    float *in_reset = mod->in_buffers[1];

    int32_t step = mod->state_i[0];
    float last_clk = mod->state_f[0];
    float last_rst = mod->state_f[1];

    uint32_t length = (uint32_t)mod->params[16];
    if (length == 0 || length > 16) length = 8;

    for (uint32_t i = 0; i < n; i++) {
        // Reset
        if (in_reset[i] > 0.5f && last_rst <= 0.5f) {
            step = 0;
        }
        last_rst = in_reset[i];

        // Clock pulse edge
        if (in_clock[i] > 0.5f && last_clk <= 0.5f) {
            step = (step + 1) % length;
        }
        last_clk = in_clock[i];

        float note_cv = mod->params[step]; // Step 0..15 Voltages
        float gate_en = mod->params[8 + (step % 8)]; // Step Gate on/off

        out_cv[i] = note_cv;
        out_gate[i] = (in_clock[i] > 0.5f && gate_en > 0.5f) ? 1.0f : 0.0f;
    }

    mod->state_i[0] = step;
    mod->state_f[0] = last_clk;
    mod->state_f[1] = last_rst;
}

// --- 7. Noise Generator & Sample & Hold ---
static void dsp_noise_sh(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    float *out_white = mod->out_buffers[0];
    float *out_pink  = mod->out_buffers[1];
    float *out_sh    = mod->out_buffers[2];

    float *in_sig    = mod->in_buffers[0];
    float *in_trig   = mod->in_buffers[1];

    uint32_t seed = (uint32_t)mod->state_i[0];
    if (seed == 0) seed = 0x12345678;

    float held_value = mod->state_f[0];
    float last_trig  = mod->state_f[1];
    float b0 = mod->state_f[2], b1 = mod->state_f[3], b2 = mod->state_f[4];

    for (uint32_t i = 0; i < n; i++) {
        float white = b_noise_white(&seed);

        // Pink noise approximation filter (Paul Kellet's filter)
        b0 = 0.99765f * b0 + white * 0.0990460f;
        b1 = 0.96300f * b1 + white * 0.2965164f;
        b2 = 0.57000f * b2 + white * 1.0526913f;
        float pink = (b0 + b1 + b2 + white * 0.1848f) * 0.25f;

        // Sample & Hold trigger
        if (in_trig[i] > 0.5f && last_trig <= 0.5f) {
            held_value = (in_sig[i] != 0.0f) ? in_sig[i] : white;
        }
        last_trig = in_trig[i];

        out_white[i] = white;
        out_pink[i]  = pink;
        out_sh[i]    = held_value;
    }

    mod->state_i[0] = (int32_t)seed;
    mod->state_f[0] = held_value;
    mod->state_f[1] = last_trig;
    mod->state_f[2] = b0;
    mod->state_f[3] = b1;
    mod->state_f[4] = b2;
}

// --- 8. Tape / BBD Delay Line ---
#define BRACK_MAX_DELAY_SAMPLES 96000 // 2 seconds @ 48kHz

static void dsp_delay(brack_module_t *mod, uint32_t n, float sr) {
    if (!mod->memory) {
        mod->memory_size = BRACK_MAX_DELAY_SAMPLES;
        mod->memory = (float*)brack_alloc(mod->memory_size * sizeof(float));
        brack_zero_memory(mod->memory, mod->memory_size * sizeof(float));
        mod->memory_head = 0;
    }

    float *out_l = mod->out_buffers[0];
    float *out_r = mod->out_buffers[1];
    float *in_l  = mod->in_buffers[0];
    float *in_cv = mod->in_buffers[1];

    float delay_time = b_clamp(mod->params[0], 0.01f, 1.8f);
    float feedback   = b_clamp(mod->params[1], 0.0f, 0.95f);
    float damp       = b_clamp(mod->params[2], 0.0f, 0.9f);
    float mix        = b_clamp(mod->params[3], 0.0f, 1.0f);

    float lpf_state = mod->state_f[0];
    uint32_t head = mod->memory_head;
    float *buf = mod->memory;

    for (uint32_t i = 0; i < n; i++) {
        float eff_time = delay_time + in_cv[i] * 0.2f;
        eff_time = b_clamp(eff_time, 0.005f, 1.9f);
        float delay_samples = eff_time * sr;

        // Read fractional delay with linear interpolation
        float r_pos = (float)head - delay_samples;
        if (r_pos < 0.0f) r_pos += (float)mod->memory_size;
        int32_t r_idx = (int32_t)r_pos;
        float frac = r_pos - (float)r_idx;

        int32_t idx1 = r_idx % mod->memory_size;
        int32_t idx2 = (idx1 + 1) % mod->memory_size;
        float delayed = b_lerp(buf[idx1], buf[idx2], frac);

        // Lowpass damping in feedback path for analog warmth
        lpf_state = delayed * (1.0f - damp) + lpf_state * damp;
        
        // Analog soft saturation on tape head
        float to_write = in_l[i] + b_tanh(lpf_state * feedback);
        buf[head] = to_write;

        head = (head + 1) % mod->memory_size;

        float wet = delayed;
        float dry = in_l[i];
        out_l[i] = b_lerp(dry, wet, mix);
        out_r[i] = out_l[i];
    }

    mod->memory_head = head;
    mod->state_f[0] = lpf_state;
}

// --- 9. Freeverb Algorithmic Space Diffuser ---
static void dsp_reverb(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    // Simple 4 Comb + 2 Allpass Schroeder diffuser
    #define COMB_SIZE 4096
    if (!mod->memory) {
        mod->memory_size = COMB_SIZE * 4;
        mod->memory = (float*)brack_alloc(mod->memory_size * sizeof(float));
        brack_zero_memory(mod->memory, mod->memory_size * sizeof(float));
    }

    float *out_l = mod->out_buffers[0];
    float *out_r = mod->out_buffers[1];
    float *in_l  = mod->in_buffers[0];

    float room_size = b_clamp(mod->params[0], 0.1f, 0.98f);
    float damp      = b_clamp(mod->params[1], 0.0f, 0.8f);
    float mix       = b_clamp(mod->params[2], 0.0f, 1.0f);

    uint32_t h = mod->memory_head;
    float *buf = mod->memory;

    for (uint32_t i = 0; i < n; i++) {
        float in_samp = in_l[i];
        float out_comb = 0.0f;

        // 4 Parallel Combs
        const uint32_t comb_lengths[4] = { 1116, 1188, 1277, 1356 };
        for (int c = 0; c < 4; c++) {
            uint32_t len = comb_lengths[c];
            uint32_t r = (h + COMB_SIZE - len) % COMB_SIZE + c * COMB_SIZE;
            uint32_t w = h % COMB_SIZE + c * COMB_SIZE;
            float delayed = buf[r];
            buf[w] = in_samp + delayed * room_size * (1.0f - damp);
            out_comb += delayed;
        }

        h = (h + 1) % COMB_SIZE;

        float wet = out_comb * 0.25f;
        out_l[i] = b_lerp(in_samp, wet, mix);
        out_r[i] = out_l[i];
    }
    mod->memory_head = h;
}

// --- 10. Mixer (4-Channel Audio/CV Mixer) ---
static void dsp_mixer(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    float *out_l = mod->out_buffers[0];
    float *out_r = mod->out_buffers[1];

    for (uint32_t i = 0; i < n; i++) {
        float sum_l = 0.0f;
        float sum_r = 0.0f;

        for (int ch = 0; ch < 4; ch++) {
            float in_val = mod->in_buffers[ch * 2][i];
            float cv_val = mod->in_buffers[ch * 2 + 1][i];
            float vol = b_clamp(mod->params[ch] + cv_val, 0.0f, 2.0f);
            float pan = b_clamp(mod->params[ch + 4], -1.0f, 1.0f); // -1=Left, +1=Right

            float gain_l = 0.5f * (1.0f - pan);
            float gain_r = 0.5f * (1.0f + pan);

            sum_l += in_val * vol * gain_l;
            sum_r += in_val * vol * gain_r;
        }

        out_l[i] = sum_l;
        out_r[i] = sum_r;
    }
}

// --- 11. Master Clock Generator ---
static void dsp_clock(brack_module_t *mod, uint32_t n, float sr) {
    float *out_16th = mod->out_buffers[0];
    float *out_8th  = mod->out_buffers[1];
    float *out_4th  = mod->out_buffers[2];
    float *out_rst  = mod->out_buffers[3];

    float bpm = b_clamp(mod->params[0], 20.0f, 300.0f);
    if (bpm <= 0.0f) bpm = 120.0f;

    float phase = mod->state_f[0];
    int32_t tick_count = mod->state_i[0];

    // 16th note frequency = (BPM / 60) * 4
    float freq_16th = (bpm / 60.0f) * 4.0f;
    float dt = freq_16th / sr;

    for (uint32_t i = 0; i < n; i++) {
        // Pulse width = 50%
        float gate = (phase < 0.5f) ? 1.0f : 0.0f;
        out_16th[i] = gate;
        out_8th[i]  = ((tick_count % 2 == 0) && gate > 0.5f) ? 1.0f : 0.0f;
        out_4th[i]  = ((tick_count % 4 == 0) && gate > 0.5f) ? 1.0f : 0.0f;
        out_rst[i]  = (tick_count == 0 && phase < 0.2f) ? 1.0f : 0.0f;

        phase += dt;
        if (phase >= 1.0f) {
            phase -= 1.0f;
            tick_count = (tick_count + 1) % 16;
        }
    }

    mod->state_f[0] = phase;
    mod->state_i[0] = tick_count;
}

// --- 12. Master Out Stage (Soft Clipper & Limiter) ---
static void dsp_out(brack_module_t *mod, uint32_t n, float sr) {
    (void)sr;
    float *in_l = mod->in_buffers[0];
    float *in_r = mod->in_buffers[1];
    float *out_l = mod->out_buffers[0];
    float *out_r = mod->out_buffers[1];

    float master_vol = b_clamp(mod->params[0], 0.0f, 2.0f);
    if (master_vol == 0.0f && mod->params[0] == 0.0f) master_vol = 1.0f;

    for (uint32_t i = 0; i < n; i++) {
        float l = in_l[i] * master_vol;
        float r = in_r[i] * master_vol;

        // Analog tube-like soft-clipping protection
        l = b_tanh(l);
        r = b_tanh(r);

        out_l[i] = l;
        out_r[i] = r;

        // Record into oscilloscope ring buffer
        uint32_t sh = g_engine.scope_head;
        g_engine.scope_buffer_l[sh] = l;
        g_engine.scope_buffer_r[sh] = r;
        g_engine.scope_head = (sh + 1) % BRACK_SCOPE_BUFFER;
    }
}

/* =========================================================================
 * Module Dispatcher
 * ========================================================================= */

static void brack_process_module(brack_module_t *mod, uint32_t n, float sr) {
    switch (mod->type) {
        case BRACK_MOD_VCO:      dsp_vco(mod, n, sr); break;
        case BRACK_MOD_VCF:      dsp_vcf(mod, n, sr); break;
        case BRACK_MOD_VCA:      dsp_vca(mod, n, sr); break;
        case BRACK_MOD_ADSR:     dsp_adsr(mod, n, sr); break;
        case BRACK_MOD_LFO:      dsp_lfo(mod, n, sr); break;
        case BRACK_MOD_SEQ:      dsp_seq(mod, n, sr); break;
        case BRACK_MOD_NOISE_SH: dsp_noise_sh(mod, n, sr); break;
        case BRACK_MOD_DELAY:    dsp_delay(mod, n, sr); break;
        case BRACK_MOD_REVERB:   dsp_reverb(mod, n, sr); break;
        case BRACK_MOD_MIXER:    dsp_mixer(mod, n, sr); break;
        case BRACK_MOD_CLOCK:    dsp_clock(mod, n, sr); break;
        case BRACK_MOD_OUT:      dsp_out(mod, n, sr); break;
        default: break;
    }
}

/* =========================================================================
 * Engine Public API Implementation
 * ========================================================================= */

B_EXPORT void brack_init(float sample_rate) {
    brack_zero_memory(&g_engine, sizeof(brack_engine_t));
    g_engine.sample_rate = (sample_rate > 0.0f) ? sample_rate : 48000.0f;
    g_engine.block_size = BRACK_BLOCK_SIZE;
    g_engine.bpm = 120.0f;
}

B_EXPORT void brack_set_sample_rate(float sr) {
    if (sr > 0.0f) g_engine.sample_rate = sr;
}

B_EXPORT void brack_set_bpm(float bpm) {
    if (bpm > 10.0f && bpm < 400.0f) g_engine.bpm = bpm;
}

B_EXPORT float brack_get_bpm(void) {
    return g_engine.bpm;
}

B_EXPORT int32_t brack_module_create(uint32_t type) {
    for (uint32_t i = 0; i < BRACK_MAX_MODULES; i++) {
        if (!g_engine.modules[i].active) {
            brack_module_t *mod = &g_engine.modules[i];
            brack_zero_memory(mod, sizeof(brack_module_t));
            mod->type = type;
            mod->active = 1;
            
            // Set defaults based on module type
            if (type == BRACK_MOD_VCO) {
                mod->params[3] = 130.81f; // C3
                mod->params[4] = 0.5f;   // 50% PW
            } else if (type == BRACK_MOD_VCF) {
                mod->params[0] = 1500.0f; // 1.5kHz Cutoff
                mod->params[1] = 0.5f;    // Resonance
                mod->params[2] = 1.0f;    // Drive
            } else if (type == BRACK_MOD_ADSR) {
                mod->params[0] = 0.01f;  // Attack
                mod->params[1] = 0.2f;   // Decay
                mod->params[2] = 0.4f;   // Sustain
                mod->params[3] = 0.3f;   // Release
            } else if (type == BRACK_MOD_VCA) {
                mod->params[0] = 0.0f;
                mod->params[1] = 1.0f;   // Exponential
            } else if (type == BRACK_MOD_LFO) {
                mod->params[0] = 2.0f;   // 2Hz
            } else if (type == BRACK_MOD_DELAY) {
                mod->params[0] = 0.35f;  // 350ms
                mod->params[1] = 0.45f;  // Feedback
                mod->params[2] = 0.3f;   // Damping
                mod->params[3] = 0.35f;  // Mix
            } else if (type == BRACK_MOD_CLOCK) {
                mod->params[0] = 125.0f; // 125 BPM
            } else if (type == BRACK_MOD_OUT) {
                mod->params[0] = 0.9f;   // Master Vol
            }

            g_engine.module_count++;
            brack_update_graph();
            return (int32_t)i;
        }
    }
    return -1;
}

B_EXPORT void brack_module_destroy(int32_t id) {
    if (id < 0 || id >= BRACK_MAX_MODULES) return;
    if (g_engine.modules[id].active) {
        g_engine.modules[id].active = 0;
        // Remove connected cables
        for (uint32_t c = 0; c < g_engine.cable_count; c++) {
            if (g_engine.cables[c].src_module == id || g_engine.cables[c].dst_module == id) {
                g_engine.cables[c].active = 0;
            }
        }
        g_engine.module_count--;
        brack_update_graph();
    }
}

B_EXPORT void brack_module_set_param(int32_t id, uint32_t param_id, float value) {
    if (id >= 0 && id < BRACK_MAX_MODULES && param_id < BRACK_MAX_PARAMS) {
        g_engine.modules[id].params[param_id] = value;
    }
}

B_EXPORT float brack_module_get_param(int32_t id, uint32_t param_id) {
    if (id >= 0 && id < BRACK_MAX_MODULES && param_id < BRACK_MAX_PARAMS) {
        return g_engine.modules[id].params[param_id];
    }
    return 0.0f;
}

B_EXPORT void brack_module_reset(int32_t id) {
    if (id >= 0 && id < BRACK_MAX_MODULES) {
        brack_zero_memory(g_engine.modules[id].state_f, sizeof(g_engine.modules[id].state_f));
        brack_zero_memory(g_engine.modules[id].state_i, sizeof(g_engine.modules[id].state_i));
    }
}

B_EXPORT int32_t brack_patch_connect(uint16_t src_mod, uint8_t src_port, uint16_t dst_mod, uint8_t dst_port, float gain) {
    if (src_mod >= BRACK_MAX_MODULES || dst_mod >= BRACK_MAX_MODULES) return -1;
    if (src_port >= BRACK_MAX_PORTS || dst_port >= BRACK_MAX_PORTS) return -1;

    // Find free cable slot or replace existing
    for (uint32_t c = 0; c < BRACK_MAX_CABLES; c++) {
        if (!g_engine.cables[c].active) {
            g_engine.cables[c].src_module = src_mod;
            g_engine.cables[c].src_port = src_port;
            g_engine.cables[c].dst_module = dst_mod;
            g_engine.cables[c].dst_port = dst_port;
            g_engine.cables[c].gain = (gain > 0.0f) ? gain : 1.0f;
            g_engine.cables[c].active = 1;
            
            if (c >= g_engine.cable_count) {
                g_engine.cable_count = c + 1;
            }
            brack_update_graph();
            return (int32_t)c;
        }
    }
    return -1;
}

B_EXPORT void brack_patch_disconnect(int32_t cable_id) {
    if (cable_id >= 0 && cable_id < BRACK_MAX_CABLES) {
        g_engine.cables[cable_id].active = 0;
        brack_update_graph();
    }
}

B_EXPORT void brack_patch_clear(void) {
    for (uint32_t c = 0; c < BRACK_MAX_CABLES; c++) {
        g_engine.cables[c].active = 0;
    }
    g_engine.cable_count = 0;
    brack_update_graph();
}

/**
 * Main Audio Render Loop (Called by AudioWorklet / Hardware DAC)
 */
B_EXPORT void brack_render_block(float *out_l, float *out_r, uint32_t num_samples) {
    uint32_t block_n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;
    float sr = g_engine.sample_rate;

    // 1. Zero all module input buffers
    for (uint32_t i = 0; i < BRACK_MAX_MODULES; i++) {
        if (g_engine.modules[i].active) {
            brack_zero_memory(g_engine.modules[i].in_buffers, sizeof(g_engine.modules[i].in_buffers));
        }
    }

    // 2. Execute modules in topological order & transfer cable signals
    for (uint32_t m = 0; m < g_engine.exec_count; m++) {
        uint16_t mod_id = g_engine.exec_order[m];
        brack_module_t *mod = &g_engine.modules[mod_id];
        if (!mod->active) continue;

        // Process module DSP block
        brack_process_module(mod, block_n, sr);

        // Feed outputs into connected destination inputs (Auto-Summing)
        for (uint32_t c = 0; c < g_engine.cable_count; c++) {
            brack_cable_t *cable = &g_engine.cables[c];
            if (cable->active && cable->src_module == mod_id) {
                brack_module_t *dst_mod = &g_engine.modules[cable->dst_module];
                if (dst_mod->active) {
                    float *src_buf = mod->out_buffers[cable->src_port];
                    float *dst_buf = dst_mod->in_buffers[cable->dst_port];
                    float gain = cable->gain;

                    for (uint32_t s = 0; s < block_n; s++) {
                        dst_buf[s] += src_buf[s] * gain;
                    }
                }
            }
        }
    }

    // 3. Find Master OUT module and route to host output
    int32_t master_id = -1;
    for (uint32_t i = 0; i < BRACK_MAX_MODULES; i++) {
        if (g_engine.modules[i].active && g_engine.modules[i].type == BRACK_MOD_OUT) {
            master_id = (int32_t)i;
            break;
        }
    }

    if (master_id >= 0) {
        float *m_l = g_engine.modules[master_id].out_buffers[0];
        float *m_r = g_engine.modules[master_id].out_buffers[1];
        for (uint32_t s = 0; s < block_n; s++) {
            out_l[s] = m_l[s];
            out_r[s] = m_r[s];
        }
    } else {
        // Silence if no OUT module
        for (uint32_t s = 0; s < block_n; s++) {
            out_l[s] = 0.0f;
            out_r[s] = 0.0f;
        }
    }

    g_engine.total_samples_rendered += block_n;
}

B_EXPORT const float* brack_get_scope_left(void) {
    return g_engine.scope_buffer_l;
}

B_EXPORT const float* brack_get_scope_right(void) {
    return g_engine.scope_buffer_r;
}

B_EXPORT uint32_t brack_get_scope_size(void) {
    return BRACK_SCOPE_BUFFER;
}

B_EXPORT const char* brack_module_get_descriptor(uint32_t type) {
    switch (type) {
        case BRACK_MOD_VCO:
            return "{\"name\":\"VCO-1\",\"hp\":10,\"inputs\":[\"V/OCT\",\"PWM\",\"FM\",\"SYNC\"],\"outputs\":[\"OUT\",\"SAW\",\"SQR\",\"TRI\",\"SIN\"]}";
        case BRACK_MOD_VCF:
            return "{\"name\":\"VCF-Ladder\",\"hp\":8,\"inputs\":[\"IN\",\"CV\",\"RES\",\"DRIVE\"],\"outputs\":[\"LP-SVF\",\"HP\",\"BP\",\"24dB-MOOG\"]}";
        case BRACK_MOD_VCA:
            return "{\"name\":\"VCA-Dual\",\"hp\":6,\"inputs\":[\"IN\",\"CV\"],\"outputs\":[\"OUT\"]}";
        case BRACK_MOD_ADSR:
            return "{\"name\":\"ADSR-EG\",\"hp\":8,\"inputs\":[\"GATE\",\"RETRIG\"],\"outputs\":[\"ENV\",\"INV\"]}";
        case BRACK_MOD_LFO:
            return "{\"name\":\"LFO-Multi\",\"hp\":6,\"inputs\":[\"RESET\",\"CV\"],\"outputs\":[\"SIN\",\"TRI\",\"SAW\",\"SQR\"]}";
        case BRACK_MOD_SEQ:
            return "{\"name\":\"SEQ-8\",\"hp\":12,\"inputs\":[\"CLK\",\"RST\"],\"outputs\":[\"CV\",\"GATE\"]}";
        case BRACK_MOD_DELAY:
            return "{\"name\":\"Tape-Delay\",\"hp\":10,\"inputs\":[\"IN\",\"TIME-CV\"],\"outputs\":[\"OUT-L\",\"OUT-R\"]}";
        case BRACK_MOD_REVERB:
            return "{\"name\":\"Reverb-Diff\",\"hp\":8,\"inputs\":[\"IN\"],\"outputs\":[\"OUT-L\",\"OUT-R\"]}";
        case BRACK_MOD_MIXER:
            return "{\"name\":\"Mixer-4\",\"hp\":8,\"inputs\":[\"IN1\",\"CV1\",\"IN2\",\"CV2\",\"IN3\",\"CV3\",\"IN4\",\"CV4\"],\"outputs\":[\"OUT-L\",\"OUT-R\"]}";
        case BRACK_MOD_CLOCK:
            return "{\"name\":\"Clock-BPM\",\"hp\":6,\"inputs\":[],\"outputs\":[\"1/16\",\"1/8\",\"1/4\",\"RST\"]}";
        case BRACK_MOD_OUT:
            return "{\"name\":\"Master-Out\",\"hp\":6,\"inputs\":[\"IN-L\",\"IN-R\"],\"outputs\":[\"MON-L\",\"MON-R\"]}";
        default:
            return "{}";
    }
}
