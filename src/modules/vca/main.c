#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float params[2];
} vca_state_t;

static vca_state_t g_vca = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"VCA-Dual\","
        "\"hp\":6,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Initial Gain\",\"min\":0,\"max\":1,\"default\":0},"
            "{\"id\":1,\"name\":\"Exponential\",\"min\":0,\"max\":1,\"default\":1}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"IN\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"CV\",\"type\":\"cv\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"OUT\",\"type\":\"audio\"}"
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

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_audio = inputs[0];
    const float *in_cv    = inputs[1];
    float *out_audio      = outputs[0];

    float init_gain = g_vca.params[0];
    float is_exp    = g_vca.params[1];

    if (!out_audio) return;

    for (uint32_t i = 0; i < n; i++) {
        float gain = init_gain + (in_cv ? in_cv[i] : 1.0f);
        gain = b_clamp(gain, 0.0f, 2.0f);

        if (is_exp > 0.5f && gain > 0.0001f) {
            gain = gain * gain * gain;
        }

        out_audio[i] = (in_audio ? in_audio[i] : 0.0f) * gain;
    }
}
