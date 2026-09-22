#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float params[2];
} vca_state_t;

static vca_state_t g_vca = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"VCA\","
        "\"category\":\"AMP\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Initial Gain\",\"min\":0,\"max\":1,\"default\":0},"
            "{\"id\":1,\"name\":\"Exponential\",\"min\":0,\"max\":1,\"default\":1}"
        "],"
        "\"outputs\":["
            "{\"type\":\"AUDIO\",\"name\":\"OUT\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    (void)sample_rate;
    g_vca.params[0] = 0.0f;
    g_vca.params[1] = 1.0f; // Exp
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 2) g_vca.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 2) ? g_vca.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float cv_gain = 0.0f;
    int has_cv = 0;
    const float *cv_audio = 0;

    for (uint32_t i = 0; i < in_count; i++) {
        if (in_links[i].type == BRACK_LINK_VAL) {
            cv_gain += in_links[i].val;
            has_cv = 1;
        }
    }

    float init_gain = g_vca.params[0];
    float is_exp    = g_vca.params[1];

    float total_gain = init_gain + (has_cv ? cv_gain : 1.0f);
    total_gain = b_clamp(total_gain, 0.0f, 2.0f);
    if (is_exp > 0.5f && total_gain > 0.0001f) {
        total_gain = total_gain * total_gain * total_gain;
    }

    float *out_buf = out_links[0].audio;
    out_links[0].type = BRACK_LINK_AUDIO;
    if (out_count) *out_count = 1;

    for (uint32_t s = 0; s < num_samples; s++) {
        float in_samp = 0.0f;
        for (uint32_t i = 0; i < in_count; i++) {
            if (in_links[i].type == BRACK_LINK_AUDIO && in_links[i].audio) {
                in_samp += in_links[i].audio[s];
            }
        }
        if (out_buf) out_buf[s] = in_samp * total_gain;
    }
}

