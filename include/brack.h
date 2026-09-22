#ifndef BRACK_H
#define BRACK_H

/**
 * =========================================================================
 * BRACK Modular Audio Core (include/brack.h)
 * Complete Freestanding C DSP Math, Eurorack Modular Graph & WASM ABI
 * Zero Libc, Zero External Dependencies, Real-Time Audio Engine.
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>

#define B_EXPORT __attribute__((visibility("default")))

#define BRACK_BLOCK_SIZE     128   /* Audio block size (WebAudio standard) */
#define BRACK_MAX_MODULES    64    /* Max modules active in rack */
#define BRACK_MAX_PORTS      16    /* Max I/O ports per module */
#define BRACK_MAX_PARAMS     32    /* Max adjustable parameters per module */
#define BRACK_MAX_CABLES     256   /* Max patch cables in rack */
#define BRACK_SCOPE_BUFFER   512   /* Samples retained for oscilloscope UI */

#define BRACK_PI             3.14159265358979323846f
#define BRACK_TWO_PI         6.28318530717958647692f
#define BRACK_HALF_PI        1.57079632679489661923f

/* =========================================================================
 * Signal & Port Types
 * ========================================================================= */
enum {
    BRACK_PORT_AUDIO = 0, /* Bipolar Audio [-1.0 .. 1.0] */
    BRACK_PORT_CV    = 1, /* Control Voltage (e.g. 1V/Oct [-5.0 .. 5.0]) */
    BRACK_PORT_GATE  = 2, /* Gate/Trigger Pulse [0.0 = Low, 1.0 = High] */
};

/* Built-in Module Types */
enum {
    BRACK_MOD_NONE      = 0,
    BRACK_MOD_VCO       = 1,  /* PolyBLEP Multi-Wave Oscillator with FM & Hard Sync */
    BRACK_MOD_VCF       = 2,  /* 4-Pole 24dB Moog Ladder & 12dB State Variable Filter */
    BRACK_MOD_VCA       = 3,  /* Linear / Exponential Voltage Controlled Amplifier */
    BRACK_MOD_ADSR      = 4,  /* Analog Exponential Attack-Decay-Sustain-Release Envelope */
    BRACK_MOD_LFO       = 5,  /* Low Frequency Oscillator (Multi-Wave, Reset, Rate) */
    BRACK_MOD_SEQ       = 6,  /* 8/16-Step CV & Gate Sequencer with Clock divider */
    BRACK_MOD_NOISE_SH  = 7,  /* White/Pink Noise Generator & Sample & Hold */
    BRACK_MOD_DELAY     = 8,  /* BBD Tape / Analog Style Delay with Feedback & Damp */
    BRACK_MOD_REVERB    = 9,  /* Schroeder / Freeverb Algorithmic Space Diffuser */
    BRACK_MOD_MIXER     = 10, /* 4-Channel Stereo / CV Mixer with Pan & Mute */
    BRACK_MOD_CLOCK     = 11, /* Master BPM Clock with Swing & Gate division */
    BRACK_MOD_OUT       = 12, /* Master Output Stage with Soft Clipper & Stereo Limiter */
    BRACK_MOD_CUSTOM    = 100 /* User-defined external WASM module */
};

/* =========================================================================
 * Freestanding Fast DSP Math (Zero Libc / No math.h)
 * ========================================================================= */

/** Fast absolute value */
static inline float b_abs(float x) {
    union { float f; uint32_t u; } val;
    val.f = x;
    val.u &= 0x7FFFFFFF;
    return val.f;
}

/** Fast clamp */
static inline float b_clamp(float x, float min, float max) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

/** Fast linear interpolation */
static inline float b_lerp(float a, float b, float t) {
    return a + t * (b - a);
}

/** 4-Point Hermite cubic interpolation for delay lines and wavetables */
static inline float b_hermite(float y0, float y1, float y2, float y3, float frac) {
    float c0 = y1;
    float c1 = 0.5f * (y2 - y0);
    float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
    float c3 = 1.5f * (y1 - y2) + 0.5f * (y3 - y0);
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

/** High precision polynomial sine approximation in range [-PI, PI] */
static inline float b_sin_poly(float x) {
    const float B = 4.0f / BRACK_PI;
    const float C = -4.0f / (BRACK_PI * BRACK_PI);
    const float P = 0.225f;
    float y = B * x + C * x * b_abs(x);
    return P * (y * b_abs(y) - y) + y;
}

/** Normalized Sine where phase is [0.0 .. 1.0] */
static inline float b_sin_norm(float phase) {
    float x = (phase - 0.5f) * BRACK_TWO_PI;
    return b_sin_poly(x);
}

/** Fast base-2 exponential approximation (2^x) via IEEE-754 bitcast */
static inline float b_exp2(float x) {
    if (x < -126.0f) return 0.0f;
    if (x > 126.0f) x = 126.0f;
    int32_t i = (int32_t)x;
    float f = x - (float)i;
    float p = 1.0f + f * (0.693017f + f * (0.241404f + f * 0.052032f));
    union { int32_t i; float f; } u;
    u.i = (i + 127) << 23;
    return p * u.f;
}

/** Fast 1V/Octave to Frequency conversion (f = base_freq * 2^voct) */
static inline float b_voct_to_freq(float voct, float base_freq) {
    return base_freq * b_exp2(voct);
}

/** Fast dB to linear amplitude (gain = 10^(db/20) = 2^(db * 0.1660964)) */
static inline float b_db_to_linear(float db) {
    return b_exp2(db * 0.16609640474f);
}

/** Fast analog saturation / soft-clipper (Pade approximant of tanh) */
static inline float b_tanh(float x) {
    if (x < -3.0f) return -1.0f;
    if (x > 3.0f) return 1.0f;
    float x2 = x * x;
    return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}

/** PolyBLEP anti-aliasing residual for bandlimited waveforms */
static inline float b_polyblep(float t, float dt) {
    if (t < dt) {
        t /= dt;
        return t + t - t * t - 1.0f;
    } else if (t > 1.0f - dt) {
        t = (t - 1.0f) / dt;
        return t * t + t + t + 1.0f;
    }
    return 0.0f;
}

/** XorShift32 fast pseudo-random number generator for white noise [-1.0 .. 1.0] */
static inline float b_noise_white(uint32_t *seed) {
    uint32_t x = *seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *seed = x;
    return ((float)(int32_t)x) * (1.0f / 2147483648.0f);
}

/* =========================================================================
 * Core Modular Data Structures
 * ========================================================================= */

typedef struct {
    uint16_t src_module;
    uint8_t  src_port;
    uint16_t dst_module;
    uint8_t  dst_port;
    float    gain;      /* Cable attenuator (default: 1.0) */
    uint8_t  active;
} brack_cable_t;

typedef struct {
    uint32_t type;
    uint32_t active;
    char     name[24];
    
    // Parameters (Knobs, Switches, Sliders)
    float    params[BRACK_MAX_PARAMS];
    
    // Internal audio/CV buffer storage (128 samples per port)
    float    in_buffers[BRACK_MAX_PORTS][BRACK_BLOCK_SIZE];
    float    out_buffers[BRACK_MAX_PORTS][BRACK_BLOCK_SIZE];
    
    // DSP state variables
    float    state_f[16];   // Filter states, phase, envelope level, etc.
    int32_t  state_i[8];    // Step index, retrigger state, RNG seed, etc.
    
    // Large memory buffer pointer (for Delay, Reverb)
    float   *memory;
    uint32_t memory_size;
    uint32_t memory_head;
} brack_module_t;

typedef struct {
    float           sample_rate;
    uint32_t        block_size;
    uint32_t        total_samples_rendered;
    
    brack_module_t  modules[BRACK_MAX_MODULES];
    uint32_t        module_count;
    
    brack_cable_t   cables[BRACK_MAX_CABLES];
    uint32_t        cable_count;
    
    // Execution graph topological sort order
    uint16_t        exec_order[BRACK_MAX_MODULES];
    uint32_t        exec_count;
    
    // Master oscilloscope ring buffer for visualizer
    float           scope_buffer_l[BRACK_SCOPE_BUFFER];
    float           scope_buffer_r[BRACK_SCOPE_BUFFER];
    uint32_t        scope_head;
    
    // Master BPM Clock state
    float           bpm;
    float           clock_phase;
} brack_engine_t;

/* =========================================================================
 * Engine Public C / WASM ABI Exports
 * ========================================================================= */

B_EXPORT void     brack_init(float sample_rate);
B_EXPORT void     brack_set_sample_rate(float sample_rate);
B_EXPORT void     brack_set_bpm(float bpm);
B_EXPORT float    brack_get_bpm(void);

// Module lifecycle
B_EXPORT int32_t  brack_module_create(uint32_t type);
B_EXPORT void     brack_module_destroy(int32_t module_id);
B_EXPORT void     brack_module_set_param(int32_t module_id, uint32_t param_id, float value);
B_EXPORT float    brack_module_get_param(int32_t module_id, uint32_t param_id);
B_EXPORT void     brack_module_reset(int32_t module_id);
B_EXPORT const char* brack_module_get_descriptor(uint32_t type);

// Patch cables
B_EXPORT int32_t  brack_patch_connect(uint16_t src_mod, uint8_t src_port, uint16_t dst_mod, uint8_t dst_port, float gain);
B_EXPORT void     brack_patch_disconnect(int32_t cable_id);
B_EXPORT void     brack_patch_clear(void);

// Audio rendering loop
B_EXPORT void     brack_render_block(float *out_l, float *out_r, uint32_t num_samples);

// UI helpers
B_EXPORT const float* brack_get_scope_left(void);
B_EXPORT const float* brack_get_scope_right(void);
B_EXPORT uint32_t     brack_get_scope_size(void);

#endif /* BRACK_H */
