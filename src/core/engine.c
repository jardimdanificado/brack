/**
 * =========================================================================
 * BRACK Microkernel Engine (src/core/engine.c)
 * Pure Modular Audio Host & Patch Matrix (Zero Sound Generators)
 * =========================================================================
 */

#include "brack_core.h"
#include "brack_dsp.h"

static brack_core_engine_t g_engine = {0};

/* =========================================================================
 * Memory Management
 * ========================================================================= */

static void brack_zero(void *ptr, uint32_t size) {
    uint8_t *p = (uint8_t*)ptr;
    for (uint32_t i = 0; i < size; i++) p[i] = 0;
}

/* =========================================================================
 * Graph Topology & Feedback Detector
 * ========================================================================= */

static void brack_update_routing(void) {
    uint8_t in_degree[BRACK_MAX_SLOTS] = {0};
    uint8_t visited[BRACK_MAX_SLOTS] = {0};

    // Reset cable feedback flags
    for (uint32_t c = 0; c < g_engine.cable_count; c++) {
        brack_cable_t *cable = &g_engine.cables[c];
        if (cable->active) {
            cable->is_feedback = 0;
            // Self-loop is immediate feedback
            if (cable->src_slot == cable->dst_slot) {
                cable->is_feedback = 1;
            } else if (cable->dst_slot < BRACK_MAX_SLOTS) {
                in_degree[cable->dst_slot]++;
            }
        }
    }

    g_engine.exec_count = 0;

    // 1. Slots with zero dependencies execute first
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active && in_degree[i] == 0) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
        }
    }

    // 2. Resolve downstream dependencies
    for (uint32_t h = 0; h < g_engine.exec_count; h++) {
        uint16_t curr = g_engine.exec_order[h];
        for (uint32_t c = 0; c < g_engine.cable_count; c++) {
            brack_cable_t *cable = &g_engine.cables[c];
            if (cable->active && cable->src_slot == curr) {
                uint16_t dst = cable->dst_slot;
                if (!visited[dst] && g_engine.slots[dst].active) {
                    if (in_degree[dst] > 0) in_degree[dst]--;
                    if (in_degree[dst] == 0) {
                        g_engine.exec_order[g_engine.exec_count++] = dst;
                        visited[dst] = 1;
                    }
                }
            }
        }
    }

    // 3. Mark cycles / remaining slots as feedback connections
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active && !visited[i]) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
            // Mark incoming cables to this cyclic slot as feedback
            for (uint32_t c = 0; c < g_engine.cable_count; c++) {
                if (g_engine.cables[c].active && g_engine.cables[c].dst_slot == i) {
                    g_engine.cables[c].is_feedback = 1;
                }
            }
        }
    }
}

/* =========================================================================
 * Host Public API
 * ========================================================================= */

B_EXPORT void brack_core_init(float sample_rate) {
    brack_zero(&g_engine, sizeof(brack_core_engine_t));
    g_engine.transport.sample_rate = (sample_rate > 0.0f) ? sample_rate : 48000.0f;
    g_engine.transport.bpm = 120.0f;
    g_engine.transport.playing = 1;
}

B_EXPORT void brack_core_set_sample_rate(float sr) {
    if (sr > 0.0f) g_engine.transport.sample_rate = sr;
}

B_EXPORT void brack_core_set_bpm(float bpm) {
    if (bpm > 10.0f && bpm < 400.0f) g_engine.transport.bpm = bpm;
}

B_EXPORT float brack_core_get_bpm(void) {
    return g_engine.transport.bpm;
}

B_EXPORT void brack_core_set_playing(uint32_t playing) {
    g_engine.transport.playing = playing ? 1 : 0;
}

B_EXPORT int32_t brack_slot_create(uint32_t in_ports, uint32_t out_ports) {
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (!g_engine.slots[i].active) {
            brack_slot_t *slot = &g_engine.slots[i];
            brack_zero(slot, sizeof(brack_slot_t));
            slot->active = 1;
            slot->in_port_count = (in_ports > BRACK_MAX_PORTS) ? BRACK_MAX_PORTS : in_ports;
            slot->out_port_count = (out_ports > BRACK_MAX_PORTS) ? BRACK_MAX_PORTS : out_ports;
            
            g_engine.slot_count++;
            brack_update_routing();
            return (int32_t)i;
        }
    }
    return -1;
}

B_EXPORT void brack_slot_destroy(int32_t slot_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS && g_engine.slots[slot_id].active) {
        g_engine.slots[slot_id].active = 0;
        // Remove connected cables
        for (uint32_t c = 0; c < g_engine.cable_count; c++) {
            if (g_engine.cables[c].src_slot == slot_id || g_engine.cables[c].dst_slot == slot_id) {
                g_engine.cables[c].active = 0;
            }
        }
        g_engine.slot_count--;
        brack_update_routing();
    }
}

B_EXPORT float* brack_slot_get_in_ptr(int32_t slot_id, uint32_t port_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS && port_id < BRACK_MAX_PORTS) {
        return g_engine.slots[slot_id].in_buffers[port_id];
    }
    return 0;
}

B_EXPORT float* brack_slot_get_out_ptr(int32_t slot_id, uint32_t port_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS && port_id < BRACK_MAX_PORTS) {
        return g_engine.slots[slot_id].out_buffers[port_id];
    }
    return 0;
}

B_EXPORT int32_t brack_cable_connect(uint16_t src_slot, uint8_t src_port, uint16_t dst_slot, uint8_t dst_port, float gain) {
    if (src_slot >= BRACK_MAX_SLOTS || dst_slot >= BRACK_MAX_SLOTS) return -1;
    if (src_port >= BRACK_MAX_PORTS || dst_port >= BRACK_MAX_PORTS) return -1;

    for (uint32_t c = 0; c < BRACK_MAX_CABLES; c++) {
        if (!g_engine.cables[c].active) {
            brack_cable_t *cable = &g_engine.cables[c];
            cable->src_slot = src_slot;
            cable->src_port = src_port;
            cable->dst_slot = dst_slot;
            cable->dst_port = dst_port;
            cable->gain = (gain > 0.0f) ? gain : 1.0f;
            cable->channels = 1;
            cable->active = 1;

            if (c >= g_engine.cable_count) {
                g_engine.cable_count = c + 1;
            }
            brack_update_routing();
            return (int32_t)c;
        }
    }
    return -1;
}

B_EXPORT void brack_cable_disconnect(int32_t cable_id) {
    if (cable_id >= 0 && cable_id < BRACK_MAX_CABLES) {
        g_engine.cables[cable_id].active = 0;
        brack_update_routing();
    }
}

B_EXPORT void brack_cable_clear(void) {
    for (uint32_t c = 0; c < BRACK_MAX_CABLES; c++) {
        g_engine.cables[c].active = 0;
    }
    g_engine.cable_count = 0;
    brack_update_routing();
}

/**
 * Prepares the audio block:
 * 1. Clears all slot input buffers.
 * 2. Transmits cable signals to inputs with auto-summing.
 * 3. Handles cyclic feedback signals using previous block outputs.
 */
B_EXPORT void brack_core_prepare_block(uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;

    // 1. Zero all input buffers
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active) {
            brack_zero(g_engine.slots[i].in_buffers, sizeof(g_engine.slots[i].in_buffers));
        }
    }

    // 2. Transfer signals through active cables
    for (uint32_t c = 0; c < g_engine.cable_count; c++) {
        brack_cable_t *cable = &g_engine.cables[c];
        if (!cable->active) continue;

        brack_slot_t *src_slot = &g_engine.slots[cable->src_slot];
        brack_slot_t *dst_slot = &g_engine.slots[cable->dst_slot];

        if (!src_slot->active || !dst_slot->active) continue;

        float *src_buf = cable->is_feedback ?
                         src_slot->prev_out_buffers[cable->src_port] :
                         src_slot->out_buffers[cable->src_port];

        float *dst_buf = dst_slot->in_buffers[cable->dst_port];
        float gain = cable->gain;

        for (uint32_t s = 0; s < n; s++) {
            dst_buf[s] += src_buf[s] * gain;
        }
    }
}

/**
 * Finishes the block after all modules processed:
 * 1. Double-buffers outputs for feedback loops in the next cycle.
 * 2. Updates transport sample clock and oscilloscope visualizer.
 */
B_EXPORT void brack_core_finish_block(uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;

    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active) {
            for (uint32_t p = 0; p < g_engine.slots[i].out_port_count; p++) {
                for (uint32_t s = 0; s < n; s++) {
                    g_engine.slots[i].prev_out_buffers[p][s] = g_engine.slots[i].out_buffers[p][s];
                }
            }
        }
    }

    // Advance transport clock
    g_engine.transport.total_samples += n;
    g_engine.transport.sample_time += (double)n / (double)g_engine.transport.sample_rate;
    g_engine.midi_count = 0; // Clear MIDI queue for next frame
}

B_EXPORT void brack_core_get_master_out(float *out_l, float *out_r, uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;
    
    // Default: copy master_out_l / r and record to scope
    for (uint32_t s = 0; s < n; s++) {
        float l = g_engine.master_out_l[s];
        float r = g_engine.master_out_r[s];

        if (out_l) out_l[s] = l;
        if (out_r) out_r[s] = r;

        uint32_t sh = g_engine.scope_head;
        g_engine.scope_buffer_l[sh] = l;
        g_engine.scope_buffer_r[sh] = r;
        g_engine.scope_head = (sh + 1) % BRACK_SCOPE_BUFFER;
    }
}

B_EXPORT const float* brack_core_get_scope_l(void) {
    return g_engine.scope_buffer_l;
}

B_EXPORT const float* brack_core_get_scope_r(void) {
    return g_engine.scope_buffer_r;
}

B_EXPORT uint32_t brack_core_get_scope_size(void) {
    return BRACK_SCOPE_BUFFER;
}

B_EXPORT void brack_core_push_midi(uint8_t status, uint8_t data1, uint8_t data2, uint8_t channel, uint32_t offset) {
    if (g_engine.midi_count < BRACK_MAX_MIDI_EVENTS) {
        brack_midi_event_t *ev = &g_engine.midi_queue[g_engine.midi_count++];
        ev->status = status;
        ev->data1 = data1;
        ev->data2 = data2;
        ev->channel = channel;
        ev->frame_offset = offset;
    }
}
