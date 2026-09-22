#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float sample_rate;
    float phase;
    float last_sync;
    float tri_integrator;
    float current_voct;
    float params[8];
} vco_state_t;

static vco_state_t g_vco = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"VCO\","
        "\"category\":\"GEN\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Octave\",\"min\":-3,\"max\":3,\"default\":0},"
            "{\"id\":1,\"name\":\"Semi\",\"min\":-12,\"max\":12,\"default\":0},"
            "{\"id\":2,\"name\":\"Fine\",\"min\":-1,\"max\":1,\"default\":0},"
            "{\"id\":3,\"name\":\"BaseFreq\",\"min\":20,\"max\":2000,\"default\":130.81},"
            "{\"id\":4,\"name\":\"PW\",\"min\":0.05,\"max\":0.95,\"default\":0.5},"
            "{\"id\":5,\"name\":\"FM Depth\",\"min\":0,\"max\":1,\"default\":0},"
            "{\"id\":6,\"name\":\"Wave\",\"min\":0,\"max\":3,\"default\":0}"
        "],"
        "\"outputs\":["
            "{\"type\":\"AUDIO\",\"name\":\"OUT\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_vco.sample_rate = sample_rate;
    g_vco.phase = 0.0f;
    g_vco.last_sync = 0.0f;
    g_vco.tri_integrator = 0.0f;
    g_vco.current_voct = 0.0f;
    g_vco.params[3] = 130.81f; // Base C3
    g_vco.params[4] = 0.5f;    // 50% PW
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 8) g_vco.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 8) ? g_vco.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float voct_val = 0.0f;
    const float *in_fm_audio = 0;
    
    // Inspect dynamic incoming links
    for (uint32_t i = 0; i < in_count; i++) {
        const brack_in_link_t *lnk = &in_links[i];
        if (lnk->type == BRACK_LINK_MIDI && lnk->midi_events) {
            for (uint32_t m = 0; m < lnk->midi_count; m++) {
                const brack_midi_event_t *ev = &lnk->midi_events[m];
                if ((ev->status & 0xF0) == 0x90 && ev->data2 > 0) { // Note on
                    // MIDI Note 60 = C4 = 0.0V
                    g_vco.current_voct = ((float)ev->data1 - 60.0f) / 12.0f;
                }
            }
        } else if (lnk->type == BRACK_LINK_VAL) {
            voct_val += lnk->val;
        } else if (lnk->type == BRACK_LINK_AUDIO) {
            in_fm_audio = lnk->audio;
        }
    }

    float pitch_offset = g_vco.params[0] + (g_vco.params[1] / 12.0f) + (g_vco.params[2] / 1200.0f);
    float base_freq    = g_vco.params[3] > 0.0f ? g_vco.params[3] : 130.81f;
    float base_pw      = g_vco.params[4];
    float fm_depth     = g_vco.params[5];
    float wave_sel     = g_vco.params[6];

    float total_voct = pitch_offset + g_vco.current_voct + voct_val;
    float target_freq = b_voct_to_freq(total_voct, base_freq);

    float phase = g_vco.phase;
    float tri_integrator = g_vco.tri_integrator;
    float sr = g_vco.sample_rate;

    float *out_buf = out_links[0].audio;
    out_links[0].type = BRACK_LINK_AUDIO;
    if (out_count) *out_count = 1;

    for (uint32_t s = 0; s < num_samples; s++) {
        float freq = target_freq;
        if (in_fm_audio) freq += in_fm_audio[s] * fm_depth * 1000.0f;
        freq = b_clamp(freq, 0.5f, sr * 0.49f);
        float dt = freq / sr;

        // Saw PolyBLEP
        float saw = 2.0f * phase - 1.0f;
        saw -= b_polyblep(phase, dt);

        // Square PolyBLEP
        float pw = b_clamp(base_pw, 0.02f, 0.98f);
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

        if (out_buf) {
            if (wave_sel < 0.5f) out_buf[s] = saw;
            else if (wave_sel < 1.5f) out_buf[s] = sqr;
            else if (wave_sel < 2.5f) out_buf[s] = tri;
            else out_buf[s] = sin;
        }

        phase += dt;
        if (phase >= 1.0f) phase -= 1.0f;
    }

    g_vco.phase = phase;
    g_vco.tri_integrator = tri_integrator;
}

