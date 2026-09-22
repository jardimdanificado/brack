/**
 * =========================================================================
 * BRACK Microkernel Engine (src/core/engine.c)
 * Pure Modular Audio Host & Dynamic Multi-Link Matrix
 * Handles 3 Link Types: AUDIO, MIDI, VAL
 * =========================================================================
 */

#include "brack_core.h"
#include "brack_dsp.h"

static brack_core_engine_t g_engine = {0};

/* =========================================================================
 * Memory Primitives (Freestanding / No Libc)
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

    // Reset feedback flags
    for (uint32_t c = 0; c < g_engine.link_count; c++) {
        brack_link_t *link = &g_engine.links[c];
        if (link->active) {
            link->is_feedback = 0;
            if (link->src_slot == link->dst_slot) {
                link->is_feedback = 1;
            } else if (link->dst_slot < BRACK_MAX_SLOTS) {
                in_degree[link->dst_slot]++;
            }
        }
    }

    g_engine.exec_count = 0;

    // 1. Slots with zero incoming dependencies run first
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active && in_degree[i] == 0) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
        }
    }

    // 2. Resolve downstream dependencies
    for (uint32_t h = 0; h < g_engine.exec_count; h++) {
        uint16_t curr = g_engine.exec_order[h];
        for (uint32_t c = 0; c < g_engine.link_count; c++) {
            brack_link_t *link = &g_engine.links[c];
            if (link->active && link->src_slot == curr) {
                uint16_t dst = link->dst_slot;
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

    // 3. Mark remaining cycles as feedback connections
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active && !visited[i]) {
            g_engine.exec_order[g_engine.exec_count++] = (uint16_t)i;
            visited[i] = 1;
            for (uint32_t c = 0; c < g_engine.link_count; c++) {
                if (g_engine.links[c].active && g_engine.links[c].dst_slot == i) {
                    g_engine.links[c].is_feedback = 1;
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

B_EXPORT int32_t brack_slot_create(void) {
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (!g_engine.slots[i].active) {
            brack_slot_t *slot = &g_engine.slots[i];
            brack_zero(slot, sizeof(brack_slot_t));
            slot->active = 1;
            slot->out_count = 1;
            
            // Setup default out links pointers
            for (int o = 0; o < BRACK_MAX_OUT_LINKS; o++) {
                slot->out_links[o].type = BRACK_LINK_AUDIO;
                slot->out_links[o].audio = slot->out_audio[o];
                slot->out_links[o].midi_events = slot->out_midi[o];
                slot->out_links[o].midi_count = 0;
                slot->out_links[o].val = 0.0f;
            }

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
        for (uint32_t c = 0; c < g_engine.link_count; c++) {
            if (g_engine.links[c].src_slot == slot_id || g_engine.links[c].dst_slot == slot_id) {
                g_engine.links[c].active = 0;
            }
        }
        g_engine.slot_count--;
        brack_update_routing();
    }
}

B_EXPORT void* brack_slot_get_in_links_ptr(int32_t slot_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS) {
        return &g_engine.slots[slot_id].in_links[0];
    }
    return 0;
}

B_EXPORT uint32_t brack_slot_get_in_links_count(int32_t slot_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS) {
        return g_engine.slots[slot_id].in_link_count;
    }
    return 0;
}

B_EXPORT void* brack_slot_get_out_links_ptr(int32_t slot_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS) {
        return &g_engine.slots[slot_id].out_links[0];
    }
    return 0;
}

B_EXPORT int32_t brack_link_connect(uint16_t src_slot, uint8_t src_out_idx, uint16_t dst_slot, uint8_t link_type, float gain) {
    if (src_slot >= BRACK_MAX_SLOTS || dst_slot >= BRACK_MAX_SLOTS) return -1;
    if (src_out_idx >= BRACK_MAX_OUT_LINKS) return -1;

    for (uint32_t c = 0; c < BRACK_MAX_LINKS; c++) {
        if (!g_engine.links[c].active) {
            brack_link_t *link = &g_engine.links[c];
            link->src_slot = src_slot;
            link->src_out_idx = src_out_idx;
            link->dst_slot = dst_slot;
            link->type = link_type;
            link->gain = (gain > 0.0f) ? gain : 1.0f;
            link->active = 1;

            if (c >= g_engine.link_count) {
                g_engine.link_count = c + 1;
            }
            brack_update_routing();
            return (int32_t)c;
        }
    }
    return -1;
}

B_EXPORT void brack_link_disconnect(int32_t link_id) {
    if (link_id >= 0 && link_id < BRACK_MAX_LINKS) {
        g_engine.links[link_id].active = 0;
        brack_update_routing();
    }
}

B_EXPORT void brack_link_disconnect_pair(uint16_t src_slot, uint16_t dst_slot) {
    for (uint32_t c = 0; c < g_engine.link_count; c++) {
        if (g_engine.links[c].src_slot == src_slot && g_engine.links[c].dst_slot == dst_slot) {
            g_engine.links[c].active = 0;
        }
    }
    brack_update_routing();
}

B_EXPORT void brack_link_clear(void) {
    for (uint32_t c = 0; c < BRACK_MAX_LINKS; c++) {
        g_engine.links[c].active = 0;
    }
    g_engine.link_count = 0;
    brack_update_routing();
}

/* =========================================================================
 * Real-Time Audio Block Routing & Execution
 * ========================================================================= */

B_EXPORT void brack_core_prepare_block(uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;

    // 1. Reset incoming links count and output buffers for all slots
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active) {
            brack_slot_t *slot = &g_engine.slots[i];
            slot->in_link_count = 0;
            
            for (int o = 0; o < BRACK_MAX_OUT_LINKS; o++) {
                slot->out_links[o].type = slot->out_types[o];
                slot->out_links[o].audio = slot->out_audio[o];
                slot->out_links[o].midi_events = slot->out_midi[o];
                slot->out_links[o].midi_count = 0;
                slot->out_links[o].val = 0.0f;
                brack_zero(slot->out_audio[o], sizeof(float) * n);
                brack_zero(slot->out_midi[o], sizeof(brack_midi_event_t) * BRACK_MAX_MIDI_EVENTS);
            }
        }
    }

    // 2. Assemble incoming links for each destination slot
    for (uint32_t c = 0; c < g_engine.link_count; c++) {
        brack_link_t *link = &g_engine.links[c];
        if (!link->active) continue;

        brack_slot_t *src_slot = &g_engine.slots[link->src_slot];
        brack_slot_t *dst_slot = &g_engine.slots[link->dst_slot];
        if (!src_slot->active || !dst_slot->active) continue;

        if (dst_slot->in_link_count < BRACK_MAX_IN_LINKS) {
            brack_in_link_t *in = &dst_slot->in_links[dst_slot->in_link_count++];
            in->type = link->type;
            in->src_slot = link->src_slot;
            in->src_out_idx = link->src_out_idx;
            in->gain = link->gain;

            if (link->type == BRACK_LINK_AUDIO) {
                in->audio = link->is_feedback ?
                            src_slot->prev_out_audio[link->src_out_idx] :
                            src_slot->out_audio[link->src_out_idx];
                in->midi_events = 0;
                in->midi_count = 0;
                in->val = 0.0f;
            } else if (link->type == BRACK_LINK_MIDI) {
                in->audio = 0;
                in->midi_events = src_slot->out_midi[link->src_out_idx];
                in->midi_count = src_slot->out_midi_count[link->src_out_idx];
                in->val = 0.0f;
            } else if (link->type == BRACK_LINK_VAL) {
                in->audio = 0;
                in->midi_events = 0;
                in->midi_count = 0;
                in->val = link->is_feedback ?
                          (src_slot->prev_out_val[link->src_out_idx] * link->gain) :
                          (src_slot->out_val[link->src_out_idx] * link->gain);
            }
        }
    }
}

B_EXPORT void brack_core_route_slot_outputs(int32_t slot_id) {
    if (slot_id >= 0 && slot_id < BRACK_MAX_SLOTS && g_engine.slots[slot_id].active) {
        brack_slot_t *slot = &g_engine.slots[slot_id];
        // Propagate updated outputs to downstream slots within the same block
        for (uint32_t c = 0; c < g_engine.link_count; c++) {
            brack_link_t *link = &g_engine.links[c];
            if (link->active && !link->is_feedback && link->src_slot == slot_id) {
                brack_slot_t *dst = &g_engine.slots[link->dst_slot];
                for (uint32_t in_i = 0; in_i < dst->in_link_count; in_i++) {
                    if (dst->in_links[in_i].src_slot == slot_id && dst->in_links[in_i].src_out_idx == link->src_out_idx) {
                        if (link->type == BRACK_LINK_AUDIO) {
                            dst->in_links[in_i].audio = slot->out_audio[link->src_out_idx];
                        } else if (link->type == BRACK_LINK_MIDI) {
                            dst->in_links[in_i].midi_events = slot->out_midi[link->src_out_idx];
                            dst->in_links[in_i].midi_count = slot->out_midi_count[link->src_out_idx];
                        } else if (link->type == BRACK_LINK_VAL) {
                            dst->in_links[in_i].val = slot->out_val[link->src_out_idx] * link->gain;
                        }
                    }
                }
            }
        }
    }
}

B_EXPORT void brack_core_finish_block(uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;

    // 1. Double-buffer for feedback connections
    for (uint32_t i = 0; i < BRACK_MAX_SLOTS; i++) {
        if (g_engine.slots[i].active) {
            brack_slot_t *slot = &g_engine.slots[i];
            for (uint32_t o = 0; o < BRACK_MAX_OUT_LINKS; o++) {
                for (uint32_t s = 0; s < n; s++) {
                    slot->prev_out_audio[o][s] = slot->out_audio[o][s];
                }
                slot->prev_out_val[o] = slot->out_val[o];
            }
        }
    }

    // 2. Advance transport
    g_engine.transport.total_samples += n;
    g_engine.transport.sample_time += (double)n / (double)g_engine.transport.sample_rate;
    g_engine.midi_count = 0;
}

B_EXPORT void brack_core_get_master_out(float *out_l, float *out_r, uint32_t num_samples) {
    uint32_t n = (num_samples > 0 && num_samples <= BRACK_BLOCK_SIZE) ? num_samples : BRACK_BLOCK_SIZE;
    
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
