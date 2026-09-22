#include "brack_core.h"
#include "brack_dsp.h"

enum { ADSR_IDLE = 0, ADSR_ATTACK, ADSR_DECAY, ADSR_SUSTAIN, ADSR_RELEASE };

typedef struct {
    float sample_rate;
    int32_t stage;
    float level;
    float last_gate;
    float params[4];
} adsr_state_t;

static adsr_state_t g_adsr = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"ADSR\","
        "\"category\":\"MOD\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Attack\",\"min\":0.001,\"max\":5.0,\"default\":0.01},"
            "{\"id\":1,\"name\":\"Decay\",\"min\":0.001,\"max\":5.0,\"default\":0.20},"
            "{\"id\":2,\"name\":\"Sustain\",\"min\":0,\"max\":1.0,\"default\":0.40},"
            "{\"id\":3,\"name\":\"Release\",\"min\":0.001,\"max\":10.0,\"default\":0.30}"
        "],"
        "\"outputs\":["
            "{\"type\":\"VAL\",\"name\":\"ENV\"},"
            "{\"type\":\"AUDIO\",\"name\":\"CV\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_adsr.sample_rate = sample_rate;
    g_adsr.stage = ADSR_IDLE;
    g_adsr.level = 0.0f;
    g_adsr.last_gate = 0.0f;
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

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float gate_signal = 0.0f;

    // Check MIDI Note On/Off or Gate VAL
    for (uint32_t i = 0; i < in_count; i++) {
        const brack_in_link_t *lnk = &in_links[i];
        if (lnk->type == BRACK_LINK_MIDI && lnk->midi_events) {
            for (uint32_t m = 0; m < lnk->midi_count; m++) {
                uint8_t st = lnk->midi_events[m].status & 0xF0;
                uint8_t vel = lnk->midi_events[m].data2;
                if (st == 0x90 && vel > 0) gate_signal = 1.0f;
                else if (st == 0x80 || (st == 0x90 && vel == 0)) gate_signal = 0.0f;
            }
        } else if (lnk->type == BRACK_LINK_VAL) {
            if (lnk->val > 0.1f) gate_signal = 1.0f;
        }
    }

    float attack_time  = b_clamp(g_adsr.params[0], 0.001f, 10.0f);
    float decay_time   = b_clamp(g_adsr.params[1], 0.001f, 10.0f);
    float sustain_lvl  = b_clamp(g_adsr.params[2], 0.0f, 1.0f);
    float release_time = b_clamp(g_adsr.params[3], 0.001f, 10.0f);
    float sr           = g_adsr.sample_rate;

    float a_rate = 1.0f / (attack_time * sr);
    float d_rate = 1.0f / (decay_time * sr);
    float r_rate = 1.0f / (release_time * sr);

    int32_t stage   = g_adsr.stage;
    float level     = g_adsr.level;
    float last_gate = g_adsr.last_gate;

    if (gate_signal > 0.5f && last_gate <= 0.5f) {
        stage = ADSR_ATTACK;
    } else if (gate_signal <= 0.5f && last_gate > 0.5f) {
        stage = ADSR_RELEASE;
    }
    last_gate = gate_signal;

    float *out_audio_buf = out_links[1].audio;

    for (uint32_t s = 0; s < num_samples; s++) {
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

        if (out_audio_buf) out_audio_buf[s] = level;
    }

    g_adsr.stage = stage;
    g_adsr.level = level;
    g_adsr.last_gate = last_gate;

    // Output 0: VAL CV
    out_links[0].type = BRACK_LINK_VAL;
    out_links[0].val = level;

    // Output 1: AUDIO rate envelope
    out_links[1].type = BRACK_LINK_AUDIO;

    if (out_count) *out_count = 2;
}

