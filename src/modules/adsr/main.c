#include "brack_core.h"
#include "brack_dsp.h"

enum { ADSR_IDLE = 0, ADSR_ATTACK, ADSR_DECAY, ADSR_SUSTAIN, ADSR_RELEASE };

typedef struct {
    float sample_rate;
    int32_t stage;
    float level;
    float last_gate;
    float last_retrig;
    float params[4];
} adsr_state_t;

static adsr_state_t g_adsr = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"ADSR-EG\","
        "\"hp\":8,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Attack\",\"min\":0.001,\"max\":5.0,\"default\":0.01},"
            "{\"id\":1,\"name\":\"Decay\",\"min\":0.001,\"max\":5.0,\"default\":0.20},"
            "{\"id\":2,\"name\":\"Sustain\",\"min\":0,\"max\":1.0,\"default\":0.40},"
            "{\"id\":3,\"name\":\"Release\",\"min\":0.001,\"max\":10.0,\"default\":0.30}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"GATE\",\"type\":\"gate\"},"
            "{\"id\":1,\"name\":\"RETRIG\",\"type\":\"gate\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"ENV\",\"type\":\"cv\"},"
            "{\"id\":1,\"name\":\"INV\",\"type\":\"cv\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_adsr.sample_rate = sample_rate;
    g_adsr.stage = ADSR_IDLE;
    g_adsr.level = 0.0f;
    g_adsr.last_gate = 0.0f;
    g_adsr.last_retrig = 0.0f;
    g_adsr.params[0] = 0.01f;
    g_adsr.params[1] = 0.20f;
    g_adsr.params[2] = 0.40f;
    g_adsr.params[3] = 0.30f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 4) g_adsr.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 4) ? g_adsr.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_gate   = inputs[0];
    const float *in_retrig = inputs[1];

    float *out_env = outputs[0];
    float *out_inv = outputs[1];

    float attack_time  = b_clamp(g_adsr.params[0], 0.001f, 10.0f);
    float decay_time   = b_clamp(g_adsr.params[1], 0.001f, 10.0f);
    float sustain_lvl  = b_clamp(g_adsr.params[2], 0.0f, 1.0f);
    float release_time = b_clamp(g_adsr.params[3], 0.001f, 10.0f);
    float sr           = g_adsr.sample_rate;

    float a_rate = 1.0f / (attack_time * sr);
    float d_rate = 1.0f / (decay_time * sr);
    float r_rate = 1.0f / (release_time * sr);

    int32_t stage    = g_adsr.stage;
    float level      = g_adsr.level;
    float last_gate  = g_adsr.last_gate;
    float last_retrig= g_adsr.last_retrig;

    for (uint32_t i = 0; i < n; i++) {
        float gate = in_gate ? in_gate[i] : 0.0f;
        float retrig = in_retrig ? in_retrig[i] : 0.0f;

        if (gate > 0.5f && last_gate <= 0.5f) {
            stage = ADSR_ATTACK;
        } else if (gate <= 0.5f && last_gate > 0.5f) {
            stage = ADSR_RELEASE;
        }

        if (retrig > 0.5f && last_retrig <= 0.5f) {
            stage = ADSR_ATTACK;
        }
        last_gate = gate;
        last_retrig = retrig;

        switch (stage) {
            case ADSR_ATTACK:
                level += a_rate * (1.2f - level);
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

        if (out_env) out_env[i] = level;
        if (out_inv) out_inv[i] = 1.0f - level;
    }

    g_adsr.stage = stage;
    g_adsr.level = level;
    g_adsr.last_gate = last_gate;
    g_adsr.last_retrig = last_retrig;
}
