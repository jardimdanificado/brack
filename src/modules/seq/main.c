#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    int32_t step;
    float last_clock;
    float params[10]; // 0..7 = Step notes in semitones (-12..+12)
} seq_state_t;

static seq_state_t g_seq = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"SEQ\","
        "\"category\":\"CTRL\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Step 1\",\"min\":-12,\"max\":12,\"default\":0},"
            "{\"id\":1,\"name\":\"Step 2\",\"min\":-12,\"max\":12,\"default\":3},"
            "{\"id\":2,\"name\":\"Step 3\",\"min\":-12,\"max\":12,\"default\":7},"
            "{\"id\":3,\"name\":\"Step 4\",\"min\":-12,\"max\":12,\"default\":10},"
            "{\"id\":4,\"name\":\"Step 5\",\"min\":-12,\"max\":12,\"default\":12},"
            "{\"id\":5,\"name\":\"Step 6\",\"min\":-12,\"max\":12,\"default\":10},"
            "{\"id\":6,\"name\":\"Step 7\",\"min\":-12,\"max\":12,\"default\":7},"
            "{\"id\":7,\"name\":\"Step 8\",\"min\":-12,\"max\":12,\"default\":3}"
        "],"
        "\"outputs\":["
            "{\"type\":\"MIDI\",\"name\":\"MIDI\"},"
            "{\"type\":\"VAL\",\"name\":\"PITCH\"},"
            "{\"type\":\"VAL\",\"name\":\"GATE\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    (void)sample_rate;
    g_seq.step = 0;
    g_seq.last_clock = 0.0f;
    g_seq.params[0] = 0.0f;
    g_seq.params[1] = 3.0f;
    g_seq.params[2] = 7.0f;
    g_seq.params[3] = 10.0f;
    g_seq.params[4] = 12.0f;
    g_seq.params[5] = 10.0f;
    g_seq.params[6] = 7.0f;
    g_seq.params[7] = 3.0f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 8) g_seq.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 8) ? g_seq.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float clk_signal = 0.0f;
    int clock_trigger = 0;

    for (uint32_t i = 0; i < in_count; i++) {
        const brack_in_link_t *lnk = &in_links[i];
        if (lnk->type == BRACK_LINK_VAL) {
            clk_signal = lnk->val;
            if (clk_signal > 0.5f && g_seq.last_clock <= 0.5f) {
                clock_trigger = 1;
            }
        }
    }
    g_seq.last_clock = clk_signal;

    if (clock_trigger) {
        g_seq.step = (g_seq.step + 1) % 8;
    }

    int cur_step = g_seq.step;
    float semi = g_seq.params[cur_step];
    uint8_t midi_note = (uint8_t)(60 + (int)semi); // C4 + semitones
    float pitch_voct = semi / 12.0f;

    // Output 0: MIDI events
    out_links[0].type = BRACK_LINK_MIDI;
    if (clock_trigger && out_links[0].midi_events) {
        brack_midi_event_t *ev = &out_links[0].midi_events[0];
        ev->status = 0x90; // Note On
        ev->data1 = midi_note;
        ev->data2 = 100; // Velocity
        ev->channel = 0;
        ev->frame_offset = 0;
        out_links[0].midi_count = 1;
    } else {
        out_links[0].midi_count = 0;
    }

    // Output 1: Pitch VAL
    out_links[1].type = BRACK_LINK_VAL;
    out_links[1].val = pitch_voct;

    // Output 2: Gate VAL
    out_links[2].type = BRACK_LINK_VAL;
    out_links[2].val = (clk_signal > 0.5f) ? 1.0f : 0.0f;

    if (out_count) *out_count = 3;
}

