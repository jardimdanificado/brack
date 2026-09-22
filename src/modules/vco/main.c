#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float sample_rate;
    float phase;
    float last_sync;
    float tri_integrator;
    float params[8];
} vco_state_t;

static vco_state_t g_vco = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"VCO-PolyBLEP\","
        "\"hp\":10,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Octave\",\"min\":-3,\"max\":3,\"default\":0},"
            "{\"id\":1,\"name\":\"Semi\",\"min\":-12,\"max\":12,\"default\":0},"
            "{\"id\":2,\"name\":\"Fine\",\"min\":-1,\"max\":1,\"default\":0},"
            "{\"id\":3,\"name\":\"BaseFreq\",\"min\":20,\"max\":2000,\"default\":130.81},"
            "{\"id\":4,\"name\":\"PW\",\"min\":0.05,\"max\":0.95,\"default\":0.5},"
            "{\"id\":5,\"name\":\"FM Depth\",\"min\":0,\"max\":1,\"default\":0},"
            "{\"id\":6,\"name\":\"Wave\",\"min\":0,\"max\":3,\"default\":0}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"V/OCT\",\"type\":\"cv\"},"
            "{\"id\":1,\"name\":\"PWM\",\"type\":\"cv\"},"
            "{\"id\":2,\"name\":\"FM\",\"type\":\"cv\"},"
            "{\"id\":3,\"name\":\"SYNC\",\"type\":\"gate\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"OUT\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"SAW\",\"type\":\"audio\"},"
            "{\"id\":2,\"name\":\"SQR\",\"type\":\"audio\"},"
            "{\"id\":3,\"name\":\"TRI\",\"type\":\"audio\"},"
            "{\"id\":4,\"name\":\"SIN\",\"type\":\"audio\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_vco.sample_rate = sample_rate;
    g_vco.phase = 0.0f;
    g_vco.last_sync = 0.0f;
    g_vco.tri_integrator = 0.0f;
    g_vco.params[3] = 130.81f; // Base C3
    g_vco.params[4] = 0.5f;    // 50% PW
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 8) g_vco.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 8) ? g_vco.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_voct = inputs[0];
    const float *in_pwm  = inputs[1];
    const float *in_fm   = inputs[2];
    const float *in_sync = inputs[3];

    float *out_mix = outputs[0];
    float *out_saw = outputs[1];
    float *out_sqr = outputs[2];
    float *out_tri = outputs[3];
    float *out_sin = outputs[4];

    float pitch_offset = g_vco.params[0] + (g_vco.params[1] / 12.0f) + (g_vco.params[2] / 1200.0f);
    float base_freq    = g_vco.params[3] > 0.0f ? g_vco.params[3] : 130.81f;
    float base_pw      = g_vco.params[4];
    float fm_depth     = g_vco.params[5];
    float wave_sel     = g_vco.params[6];

    float phase = g_vco.phase;
    float last_sync = g_vco.last_sync;
    float tri_integrator = g_vco.tri_integrator;
    float sr = g_vco.sample_rate;

    for (uint32_t i = 0; i < n; i++) {
        float voct = pitch_offset + (in_voct ? in_voct[i] : 0.0f);
        float freq = b_voct_to_freq(voct, base_freq);
        if (in_fm) freq += in_fm[i] * fm_depth * 1000.0f;
        freq = b_clamp(freq, 0.5f, sr * 0.49f);

        float dt = freq / sr;

        if (in_sync && in_sync[i] > 0.5f && last_sync <= 0.5f) {
            phase = 0.0f;
        }
        if (in_sync) last_sync = in_sync[i];

        // Saw PolyBLEP
        float saw = 2.0f * phase - 1.0f;
        saw -= b_polyblep(phase, dt);

        // Square / Pulse PolyBLEP with PWM
        float pw = b_clamp(base_pw + (in_pwm ? in_pwm[i] * 0.45f : 0.0f), 0.02f, 0.98f);
        float sqr = (phase < pw) ? 1.0f : -1.0f;
        sqr += b_polyblep(phase, dt);
        float phase_pw = phase - pw;
        if (phase_pw < 0.0f) phase_pw += 1.0f;
        sqr -= b_polyblep(phase_pw, dt);

        // Sine
        float sin = b_sin_norm(phase);

        // Triangle
        tri_integrator += (sqr * 4.0f * dt) - (tri_integrator * 0.001f);
        float tri = b_clamp(tri_integrator, -1.0f, 1.0f);

        if (out_saw) out_saw[i] = saw;
        if (out_sqr) out_sqr[i] = sqr;
        if (out_tri) out_tri[i] = tri;
        if (out_sin) out_sin[i] = sin;

        if (out_mix) {
            if (wave_sel < 0.5f) out_mix[i] = saw;
            else if (wave_sel < 1.5f) out_mix[i] = sqr;
            else if (wave_sel < 2.5f) out_mix[i] = tri;
            else out_mix[i] = sin;
        }

        phase += dt;
        if (phase >= 1.0f) phase -= 1.0f;
    }

    g_vco.phase = phase;
    g_vco.last_sync = last_sync;
    g_vco.tri_integrator = tri_integrator;
}
