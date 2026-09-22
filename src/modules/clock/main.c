#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float sample_rate;
    float phase;
    int32_t tick_count;
    float params[2]; // 0 = BPM
} clock_state_t;

static clock_state_t g_clock = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"CLOCK\","
        "\"category\":\"CTRL\","
        "\"params\":["
            "{\"id\":0,\"name\":\"BPM\",\"min\":30,\"max\":250,\"default\":120}"
        "],"
        "\"outputs\":["
            "{\"type\":\"VAL\",\"name\":\"CLK\"},"
            "{\"type\":\"MIDI\",\"name\":\"TICK\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_clock.sample_rate = sample_rate;
    g_clock.phase = 0.0f;
    g_clock.tick_count = 0;
    g_clock.params[0] = 120.0f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 2) g_clock.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 2) ? g_clock.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    (void)in_links;
    (void)in_count;

    float bpm = b_clamp(g_clock.params[0], 20.0f, 300.0f);
    float sr  = g_clock.sample_rate;

    float freq_16th = (bpm / 60.0f) * 4.0f;
    float dt = freq_16th / sr;

    float phase = g_clock.phase;
    int32_t tick_count = g_clock.tick_count;
    int tick_triggered = 0;

    for (uint32_t i = 0; i < num_samples; i++) {
        phase += dt;
        if (phase >= 1.0f) {
            phase -= 1.0f;
            tick_count = (tick_count + 1) % 16;
            tick_triggered = 1;
        }
    }

    g_clock.phase = phase;
    g_clock.tick_count = tick_count;

    // Output 0: VAL gate — 50% duty cycle (HIGH first half of 16th-note period)
    // phase < 0.5 gives ~56.8ms gate per note @ 132 BPM, enough for ADSR to complete attack+decay
    out_links[0].type = BRACK_LINK_VAL;
    out_links[0].val = (phase < 0.5f) ? 1.0f : 0.0f;

    // Output 1: MIDI Clock
    out_links[1].type = BRACK_LINK_MIDI;
    if (tick_triggered && out_links[1].midi_events) {
        brack_midi_event_t *ev = &out_links[1].midi_events[0];
        ev->status = 0xF8; // MIDI Timing Clock
        ev->data1 = 0;
        ev->data2 = 0;
        ev->channel = 0;
        ev->frame_offset = 0;
        out_links[1].midi_count = 1;
    } else {
        out_links[1].midi_count = 0;
    }

    if (out_count) *out_count = 2;
}

