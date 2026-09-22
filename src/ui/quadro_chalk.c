/**
 * =========================================================================
 * BRACK Quadro Chalk Engine (src/ui/quadro_chalk.c)
 * 100% C-Rendered Scratch-Style Puzzle Blocks + Teleport Signal Pills
 * Supports Vertical Chain Snapping + Tactile Reporter Pills
 * =========================================================================
 */

#include "quadro_chalk.h"
#include "brack_dsp.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

static quadro_board_t g_board = {0};
static uint32_t s_framebuffer[1920 * 1080];
static char s_string_pool[65536];

W_EXPORT char* quadro_chalk_get_string_pool(void) {
    return s_string_pool;
}

static const uint32_t s_link_colors[3] = {
    0xFF48dbfb, /* AUDIO: Bright Cyan */
    0xFFff9f43, /* MIDI: Warm Amber */
    0xFF1dd1a1  /* VAL: Vibrant Lime */
};

/* =========================================================================
 * Fast Drawing & Text Primitives (Pure C / No Libc)
 * ========================================================================= */

static inline uint32_t qc_prng(uint32_t *seed) {
    uint32_t x = *seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *seed = x;
    return x;
}

static inline uint32_t qc_blend(uint32_t src, uint32_t dst) {
    uint32_t sa = (src >> 24) & 0xFF;
    if (sa == 0) return dst;
    if (sa >= 250) return src;

    uint32_t inv_sa = 255 - sa;
    uint32_t sr = src & 0xFF, sg = (src >> 8) & 0xFF, sb = (src >> 16) & 0xFF;
    uint32_t dr = dst & 0xFF, dg = (dst >> 8) & 0xFF, db = (dst >> 16) & 0xFF;

    uint32_t r = (sr * sa + dr * inv_sa) / 255;
    uint32_t g = (sg * sa + dg * inv_sa) / 255;
    uint32_t b = (sb * sa + db * inv_sa) / 255;

    return 0xFF000000 | (b << 16) | (g << 8) | r;
}

static void qc_put_pixel(int x, int y, uint32_t color) {
    if (x < 0 || x >= g_board.view_w || y < 0 || y >= g_board.view_h) return;
    s_framebuffer[y * g_board.view_w + x] = qc_blend(color, s_framebuffer[y * g_board.view_w + x]);
}

static void qc_fill_rect(int x0, int y0, int w, int h, uint32_t color) {
    int x1 = x0 + w;
    int y1 = y0 + h;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > g_board.view_w) x1 = g_board.view_w;
    if (y1 > g_board.view_h) y1 = g_board.view_h;

    for (int y = y0; y < y1; y++) {
        uint32_t *row = &s_framebuffer[y * g_board.view_w + x0];
        int count = x1 - x0;
        for (int x = 0; x < count; x++) {
            row[x] = qc_blend(color, row[x]);
        }
    }
}

static void qc_draw_circle_filled(int cx, int cy, int radius, uint32_t color) {
    int r2 = radius * radius;
    int y0 = cy - radius; if (y0 < 0) y0 = 0;
    int y1 = cy + radius; if (y1 >= g_board.view_h) y1 = g_board.view_h - 1;

    for (int y = y0; y <= y1; y++) {
        int dy = y - cy;
        int dx_limit = w_isqrt(r2 - dy * dy);
        int x0 = cx - dx_limit; if (x0 < 0) x0 = 0;
        int x1 = cx + dx_limit; if (x1 >= g_board.view_w) x1 = g_board.view_w - 1;

        uint32_t *row = &s_framebuffer[y * g_board.view_w];
        for (int x = x0; x <= x1; x++) {
            row[x] = qc_blend(color, row[x]);
        }
    }
}

static void qc_draw_line(int x0, int y0, int x1, int y1, int thickness, uint32_t color) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int steps = w_isqrt(dx * dx + dy * dy);
    if (steps <= 0) return;

    int rad = thickness / 2;
    for (int i = 0; i <= steps; i++) {
        int x = x0 + (dx * i) / steps;
        int y = y0 + (dy * i) / steps;
        qc_draw_circle_filled(x, y, rad, color);
    }
}

/* 8x8 Bitmap Monospace Font Renderer */
static void qc_draw_char(int x0, int y0, char c, uint32_t color, int scale) {
    if (c < 32 || c > 126) c = ' ';
    int glyph_idx = c - 32;
    const uint8_t *bitmap = g_chalk_font8x8[glyph_idx];

    for (int row = 0; row < 8; row++) {
        uint8_t bits = bitmap[row];
        for (int col = 0; col < 8; col++) {
            if (bits & (1 << (7 - col))) {
                if (scale <= 1) {
                    qc_put_pixel(x0 + col, y0 + row, color);
                } else {
                    qc_fill_rect(x0 + col * scale, y0 + row * scale, scale, scale, color);
                }
            }
        }
    }
}

static void qc_draw_text(int x, int y, const char *str, uint32_t color, int scale) {
    if (!str) return;
    int cur_x = x;
    int step = 8 * scale;
    while (*str) {
        qc_draw_char(cur_x, y, *str, color, scale);
        cur_x += step;
        str++;
    }
}

static void qc_draw_text_clipped(int x, int y, const char *str, uint32_t color, int scale, int max_x) {
    if (!str) return;
    int cur_x = x;
    int step = 8 * scale;
    while (*str) {
        if (cur_x + 8 * scale > max_x) break;
        qc_draw_char(cur_x, y, *str, color, scale);
        cur_x += step;
        str++;
    }
}

/* Rounded Pill Badge Drawing */
static void qc_draw_pill(int x, int y, int w, int h, uint32_t bg_color, uint32_t border_color, const char *label, uint32_t text_color) {
    int rad = h / 2;
    // Solid fill
    qc_fill_rect(x + rad, y, w - 2 * rad, h, bg_color);
    qc_draw_circle_filled(x + rad, y + rad, rad, bg_color);
    qc_draw_circle_filled(x + w - rad, y + rad, rad, bg_color);

    // Border
    if (border_color != 0) {
        qc_fill_rect(x + rad, y, w - 2 * rad, 1, border_color);
        qc_fill_rect(x + rad, y + h - 1, w - 2 * rad, 1, border_color);
    }

    if (label) {
        int label_len = 0;
        while (label[label_len]) label_len++;
        int text_x = x + (w - label_len * 8) / 2;
        int text_y = y + (h - 8) / 2;
        qc_draw_text_clipped(text_x, text_y, label, text_color, 1, x + w - 4);
    }
}

/* Camera Transform Functions */
static inline int to_screen_x(float wx) { return (int)(wx * g_board.zoom + g_board.cam_x); }
static inline int to_screen_y(float wy) { return (int)(wy * g_board.zoom + g_board.cam_y); }
static inline float to_world_x(float sx) { return (sx - g_board.cam_x) / g_board.zoom; }
static inline float to_world_y(float sy) { return (sy - g_board.cam_y) / g_board.zoom; }

/* =========================================================================
 * Scratch Block Geometry & Node Lifecycle
 * ========================================================================= */

static void update_node_bounds(chalk_module_node_t *n) {
    n->w = 230.0f;
    float header_h = 24.0f;
    float scope_h = 28.0f;
    float sockets_h = (n->socket_count > 0) ? (n->socket_count * 22.0f + 6.0f) : 10.0f;
    float sliders_h = (n->slider_count > 0) ? (n->slider_count * 24.0f + 6.0f) : 6.0f;
    float pills_h = (n->pill_count > 0) ? 26.0f : 10.0f;

    n->h = header_h + scope_h + sockets_h + sliders_h + pills_h;
}

W_EXPORT void quadro_chalk_init(int32_t width, int32_t height) {
    g_board.view_w = width;
    g_board.view_h = height;
    g_board.cam_x = 0;
    g_board.cam_y = 0;
    g_board.zoom = 1.0f;
    g_board.node_count = 0;
    g_board.link_count = 0;
    g_board.drag_mode = 0;
    g_board.active_node_id = -1;
    g_board.active_slider_id = -1;
    g_board.active_socket_id = -1;
    g_board.wire_src_node = -1;
    g_board.snap_target_parent = -1;
    g_board.chalk_seed = 0x12345678;
    g_board.anim_frame = 0;
}

W_EXPORT uint32_t* quadro_chalk_get_framebuffer(void) { return s_framebuffer; }
W_EXPORT void quadro_chalk_resize(int32_t width, int32_t height) { g_board.view_w = width; g_board.view_h = height; }
W_EXPORT void quadro_chalk_set_camera(float cam_x, float cam_y, float zoom) { g_board.cam_x = cam_x; g_board.cam_y = cam_y; g_board.zoom = zoom; }
W_EXPORT float quadro_chalk_get_cam_x(void) { return g_board.cam_x; }
W_EXPORT float quadro_chalk_get_cam_y(void) { return g_board.cam_y; }
W_EXPORT float quadro_chalk_get_zoom(void) { return g_board.zoom; }

W_EXPORT void quadro_chalk_set_selected_node(int32_t node_id) {
    for (int i = 0; i < g_board.node_count; i++) {
        g_board.nodes[i].is_selected = (g_board.nodes[i].id == node_id) ? 1 : 0;
    }
}

W_EXPORT int32_t quadro_chalk_get_selected_node(void) {
    for (int i = 0; i < g_board.node_count; i++) {
        if (g_board.nodes[i].is_selected) return g_board.nodes[i].id;
    }
    return -1;
}

W_EXPORT int32_t quadro_chalk_add_node(int32_t slot_id, const char *name, const char *category, uint32_t color, float x, float y, float w, float h) {
    if (g_board.node_count >= MAX_CHALK_NODES) return -1;
    int idx = g_board.node_count++;
    chalk_module_node_t *n = &g_board.nodes[idx];
    n->id = idx;
    n->slot_id = slot_id;
    n->accent_color = (color != 0) ? color : 0xFF48dbfb;
    n->x = x;
    n->y = y;
    n->stack_parent = -1;
    n->stack_child = -1;
    n->socket_count = 0;
    n->pill_count = 0;
    n->slider_count = 0;
    n->active = 1;
    n->is_selected = 0;

    int c = 0;
    while (name && name[c] && c < 19) { n->name[c] = name[c]; c++; }
    n->name[c] = 0;

    c = 0;
    while (category && category[c] && c < 11) { n->category[c] = category[c]; c++; }
    n->category[c] = 0;

    update_node_bounds(n);
    return idx;
}

W_EXPORT void quadro_chalk_add_socket(int32_t node_id, const char *name, uint8_t type) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (n->socket_count < MAX_CHALK_SOCKETS) {
            int s = n->socket_count++;
            chalk_socket_t *sock = &n->sockets[s];
            sock->type = type;
            sock->connected_src_node = -1;
            sock->connected_src_out = -1;
            sock->connected_label[0] = 0;
            int c = 0;
            while (name && name[c] && c < 13) { sock->name[c] = name[c]; c++; }
            sock->name[c] = 0;
            update_node_bounds(n);
        }
    }
}

W_EXPORT void quadro_chalk_add_pill(int32_t node_id, const char *name, uint8_t type, uint32_t color) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (n->pill_count < MAX_OUTPUT_PILLS) {
            int p = n->pill_count++;
            chalk_output_pill_t *pill = &n->pills[p];
            pill->type = type;
            pill->color = (color != 0) ? color : s_link_colors[type % 3];
            int c = 0;
            while (name && name[c] && c < 13) { pill->name[c] = name[c]; c++; }
            pill->name[c] = 0;
            update_node_bounds(n);
        }
    }
}

W_EXPORT int32_t quadro_chalk_add_slider(int32_t node_id, int32_t param_id, const char *name, const char *unit, float def_v, float min_v, float max_v) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (n->slider_count < MAX_CHALK_SLIDERS) {
            int s_idx = n->slider_count++;
            chalk_slider_entry_t *s = &n->sliders[s_idx];
            s->param_id = param_id;
            s->min_val = min_v;
            s->max_val = max_v;
            s->value = (max_v > min_v) ? (def_v - min_v) / (max_v - min_v) : 0.5f;

            int c = 0;
            while (name && name[c] && c < 11) { s->name[c] = name[c]; c++; }
            s->name[c] = 0;

            c = 0;
            while (unit && unit[c] && c < 11) { s->val_str[c] = unit[c]; c++; }
            s->val_str[c] = 0;

            update_node_bounds(n);
            return s_idx;
        }
    }
    return -1;
}

W_EXPORT void quadro_chalk_update_slider_str(int32_t node_id, int32_t slider_idx, const char *str) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (slider_idx >= 0 && slider_idx < n->slider_count) {
            int c = 0;
            while (str && str[c] && c < 11) { n->sliders[slider_idx].val_str[c] = str[c]; c++; }
            n->sliders[slider_idx].val_str[c] = 0;
        }
    }
}

/* Connect / Disconnect Sockets */
W_EXPORT int32_t quadro_chalk_connect_socket(int32_t src_node, int32_t src_out_idx, int32_t dst_node, int32_t dst_socket_idx) {
    if (src_node >= 0 && src_node < g_board.node_count && dst_node >= 0 && dst_node < g_board.node_count) {
        chalk_module_node_t *dst = &g_board.nodes[dst_node];
        chalk_module_node_t *src = &g_board.nodes[src_node];
        if (dst_socket_idx >= 0 && dst_socket_idx < dst->socket_count) {
            chalk_socket_t *sock = &dst->sockets[dst_socket_idx];
            sock->connected_src_node = src_node;
            sock->connected_src_out = src_out_idx;

            // Generate label e.g. "VCO:OUT"
            int c = 0;
            while (src->name[c] && c < 8) { sock->connected_label[c] = src->name[c]; c++; }
            sock->connected_label[c++] = ':';
            if (src_out_idx >= 0 && src_out_idx < src->pill_count) {
                int p = 0;
                while (src->pills[src_out_idx].name[p] && c < 17) { sock->connected_label[c++] = src->pills[src_out_idx].name[p++]; }
            }
            sock->connected_label[c] = 0;
            return 0;
        }
    }
    return -1;
}

W_EXPORT void quadro_chalk_disconnect_socket(int32_t dst_node, int32_t socket_idx) {
    if (dst_node >= 0 && dst_node < g_board.node_count) {
        chalk_module_node_t *dst = &g_board.nodes[dst_node];
        if (socket_idx >= 0 && socket_idx < dst->socket_count) {
            dst->sockets[socket_idx].connected_src_node = -1;
            dst->sockets[socket_idx].connected_src_out = -1;
            dst->sockets[socket_idx].connected_label[0] = 0;
        }
    }
}

/* Stacking / Snap Chaining */
W_EXPORT void quadro_chalk_stack_attach(int32_t parent_id, int32_t child_id) {
    if (parent_id >= 0 && parent_id < g_board.node_count && child_id >= 0 && child_id < g_board.node_count && parent_id != child_id) {
        chalk_module_node_t *p = &g_board.nodes[parent_id];
        chalk_module_node_t *c = &g_board.nodes[child_id];
        
        p->stack_child = child_id;
        c->stack_parent = parent_id;
        c->x = p->x;
        c->y = p->y + p->h + 2.0f;

        // Recursively reposition child's subtree
        int cur = child_id;
        while (g_board.nodes[cur].stack_child >= 0) {
            int next = g_board.nodes[cur].stack_child;
            g_board.nodes[next].x = g_board.nodes[cur].x;
            g_board.nodes[next].y = g_board.nodes[cur].y + g_board.nodes[cur].h + 2.0f;
            cur = next;
        }
    }
}

W_EXPORT void quadro_chalk_stack_detach(int32_t child_id) {
    if (child_id >= 0 && child_id < g_board.node_count) {
        chalk_module_node_t *c = &g_board.nodes[child_id];
        if (c->stack_parent >= 0) {
            g_board.nodes[c->stack_parent].stack_child = -1;
            c->stack_parent = -1;
        }
    }
}

/* Extract Active Graph Matrix Links for DSP Engine */
W_EXPORT int32_t quadro_chalk_get_active_links(int32_t *out_src, int32_t *out_src_out, int32_t *out_dst, int32_t *out_dst_socket, int32_t *out_type) {
    int count = 0;
    for (int i = 0; i < g_board.node_count; i++) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (!n->active) continue;

        // 1. Stacked Audio Flow (Parent Out -> Child In Socket 0)
        if (n->stack_child >= 0) {
            if (out_src) out_src[count] = i;
            if (out_src_out) out_src_out[count] = 0;
            if (out_dst) out_dst[count] = n->stack_child;
            if (out_dst_socket) out_dst_socket[count] = 0;
            if (out_type) out_type[count] = CHALK_LINK_AUDIO;
            count++;
        }

        // 2. Teleport Socket Links (Connected Reporter Pills)
        for (int s = 0; s < n->socket_count; s++) {
            if (n->sockets[s].connected_src_node >= 0) {
                if (out_src) out_src[count] = n->sockets[s].connected_src_node;
                if (out_src_out) out_src_out[count] = n->sockets[s].connected_src_out;
                if (out_dst) out_dst[count] = i;
                if (out_dst_socket) out_dst_socket[count] = s;
                if (out_type) out_type[count] = n->sockets[s].type;
                count++;
            }
        }
    }
    return count;
}

W_EXPORT void quadro_chalk_clear(void) {
    for (int i = 0; i < g_board.node_count; i++) {
        g_board.nodes[i].stack_parent = -1;
        g_board.nodes[i].stack_child = -1;
        for (int s = 0; s < g_board.nodes[i].socket_count; s++) {
            g_board.nodes[i].sockets[s].connected_src_node = -1;
            g_board.nodes[i].sockets[s].connected_src_out = -1;
            g_board.nodes[i].sockets[s].connected_label[0] = 0;
        }
    }
}

W_EXPORT void quadro_chalk_feed_scope(int32_t node_id, const float *samples, uint32_t count) {
    if (node_id >= 0 && node_id < g_board.node_count && samples) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        uint32_t c = count > 48 ? 48 : count;
        for (uint32_t i = 0; i < c; i++) n->scope_data[i] = samples[i];
    }
}

W_EXPORT void quadro_chalk_set_node_code(int32_t node_id, const char *code_text) {}

/* =========================================================================
 * Mouse & Gesture Handling
 * ========================================================================= */

W_EXPORT void quadro_chalk_mouse_down(float screen_x, float screen_y, int32_t button) {
    g_board.mouse_screen_x = screen_x;
    g_board.mouse_screen_y = screen_y;

    if (button == 2 || button == 1) { // Pan
        g_board.drag_mode = 4;
        return;
    }

    float wx = to_world_x(screen_x);
    float wy = to_world_y(screen_y);

    // 1. Check Output Reporter Pills (Start Teleport Pill Drag)
    for (int i = 0; i < g_board.node_count; i++) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (n->pill_count > 0) {
            float pill_y = n->y + n->h - 24.0f;
            float pill_spacing = (n->w - 16.0f) / (float)n->pill_count;
            for (int p = 0; p < n->pill_count; p++) {
                float px = n->x + 8.0f + p * pill_spacing;
                float pw = pill_spacing - 4.0f;
                if (wx >= px && wx <= px + pw && wy >= pill_y && wy <= pill_y + 18.0f) {
                    g_board.drag_mode = 2; // Drag Pill
                    g_board.wire_src_node = i;
                    g_board.wire_src_out_idx = p;
                    g_board.wire_type = n->pills[p].type;
                    return;
                }
            }
        }
    }

    // 2. Check Node Clicks (Sockets Disconnect, Sliders, Block Drag)
    for (int i = g_board.node_count - 1; i >= 0; i--) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (wx >= n->x && wx <= n->x + n->w && wy >= n->y && wy <= n->y + n->h) {
            quadro_chalk_set_selected_node(i);

            // Sockets Disconnect Click (x)
            float cur_y = n->y + 24.0f + 28.0f;
            for (int s = 0; s < n->socket_count; s++) {
                float sy = cur_y + s * 22.0f;
                if (n->sockets[s].connected_src_node >= 0) {
                    // Clicked on (x) area at right edge of socket
                    if (wy >= sy && wy <= sy + 18.0f && wx >= n->x + n->w - 24.0f && wx <= n->x + n->w - 6.0f) {
                        quadro_chalk_disconnect_socket(i, s);
                        return;
                    }
                }
            }

            // Sliders Click & Drag
            float sliders_start_y = cur_y + (n->socket_count * 22.0f + 6.0f);
            for (int s = 0; s < n->slider_count; s++) {
                float sy = sliders_start_y + s * 24.0f;
                if (wy >= sy && wy <= sy + 20.0f) {
                    g_board.drag_mode = 3; // Slider Drag
                    g_board.active_node_id = i;
                    g_board.active_slider_id = s;
                    float track_w = n->w - 20.0f;
                    float rel_x = (wx - (n->x + 10.0f)) / track_w;
                    n->sliders[s].value = b_clamp(rel_x, 0.0f, 1.0f);
                    return;
                }
            }

            // Move Block (and detach if dragging away from parent)
            g_board.drag_mode = 1;
            g_board.active_node_id = i;
            g_board.drag_off_x = wx - n->x;
            g_board.drag_off_y = wy - n->y;
            return;
        }
    }

    g_board.drag_mode = 4; // Pan
}

W_EXPORT int32_t quadro_chalk_mouse_move(float screen_x, float screen_y, int32_t *out_slot, int32_t *out_param, float *out_val) {
    float dx = screen_x - g_board.mouse_screen_x;
    float dy = screen_y - g_board.mouse_screen_y;
    g_board.mouse_screen_x = screen_x;
    g_board.mouse_screen_y = screen_y;

    float wx = to_world_x(screen_x);
    float wy = to_world_y(screen_y);

    if (g_board.drag_mode == 1 && g_board.active_node_id >= 0) {
        chalk_module_node_t *n = &g_board.nodes[g_board.active_node_id];
        float new_x = wx - g_board.drag_off_x;
        float new_y = wy - g_board.drag_off_y;
        float delta_x = new_x - n->x;
        float delta_y = new_y - n->y;

        // If moving detached significantly, break stack parent link
        if (n->stack_parent >= 0) {
            chalk_module_node_t *p = &g_board.nodes[n->stack_parent];
            float expected_y = p->y + p->h + 2.0f;
            if (b_abs(new_x - p->x) > 20.0f || b_abs(new_y - expected_y) > 20.0f) {
                quadro_chalk_stack_detach(g_board.active_node_id);
            }
        }

        n->x = new_x;
        n->y = new_y;

        // Move all stacked children underneath
        int cur = n->stack_child;
        while (cur >= 0) {
            g_board.nodes[cur].x += delta_x;
            g_board.nodes[cur].y += delta_y;
            cur = g_board.nodes[cur].stack_child;
        }

        // Check potential snap target parent
        g_board.snap_target_parent = -1;
        for (int i = 0; i < g_board.node_count; i++) {
            if (i == g_board.active_node_id) continue;
            chalk_module_node_t *candidate = &g_board.nodes[i];
            if (candidate->stack_child == -1) { // Can accept a child
                float snap_y = candidate->y + candidate->h;
                if (b_abs(n->x - candidate->x) < 36.0f && b_abs(n->y - snap_y) < 28.0f) {
                    g_board.snap_target_parent = i;
                    break;
                }
            }
        }
        return 0;
    } else if (g_board.drag_mode == 3 && g_board.active_node_id >= 0) {
        chalk_module_node_t *n = &g_board.nodes[g_board.active_node_id];
        chalk_slider_entry_t *s = &n->sliders[g_board.active_slider_id];
        float track_w = n->w - 20.0f;
        float rel_x = (wx - (n->x + 10.0f)) / track_w;
        s->value = b_clamp(rel_x, 0.0f, 1.0f);

        if (out_slot)  *out_slot  = n->slot_id;
        if (out_param) *out_param = s->param_id;
        if (out_val)   *out_val   = s->min_val + s->value * (s->max_val - s->min_val);
        return 1;
    } else if (g_board.drag_mode == 4) {
        g_board.cam_x += dx;
        g_board.cam_y += dy;
        return 0;
    }
    return 0;
}

W_EXPORT int32_t quadro_chalk_mouse_up(float screen_x, float screen_y, int32_t *out_src_slot, int32_t *out_src_out_idx, int32_t *out_dst_slot, int32_t *out_link_type) {
    int connected = 0;
    float wx = to_world_x(screen_x);
    float wy = to_world_y(screen_y);

    // 1. Snapping Block to Stack
    if (g_board.drag_mode == 1 && g_board.active_node_id >= 0) {
        if (g_board.snap_target_parent >= 0) {
            quadro_chalk_stack_attach(g_board.snap_target_parent, g_board.active_node_id);
            g_board.snap_target_parent = -1;
        }
    }

    // 2. Dropping Teleport Pill into a Compatible Socket
    if (g_board.drag_mode == 2 && g_board.wire_src_node >= 0) {
        for (int i = 0; i < g_board.node_count; i++) {
            chalk_module_node_t *n = &g_board.nodes[i];
            if (wx >= n->x && wx <= n->x + n->w && wy >= n->y && wy <= n->y + n->h) {
                // Find matching socket under cursor
                float cur_y = n->y + 24.0f + 28.0f;
                for (int s = 0; s < n->socket_count; s++) {
                    float sy = cur_y + s * 22.0f;
                    if (wy >= sy && wy <= sy + 20.0f) {
                        quadro_chalk_connect_socket(g_board.wire_src_node, g_board.wire_src_out_idx, i, s);
                        connected = 1;
                        break;
                    }
                }
                break;
            }
        }
    }

    g_board.drag_mode = 0;
    g_board.active_node_id = -1;
    g_board.wire_src_node = -1;
    g_board.snap_target_parent = -1;
    return connected;
}

/* =========================================================================
 * Full Frame Rendering Pass (Scratch Puzzle Blocks + Teleport Signal Pills)
 * ========================================================================= */

W_EXPORT void quadro_chalk_render(void) {
    int w = g_board.view_w;
    int h = g_board.view_h;
    g_board.anim_frame++;
    uint32_t seed = 0x5a1b3c7d + g_board.anim_frame;

    // 1. Dark Blackboard Background with chalk dust
    for (int y = 0; y < h; y++) {
        uint32_t *row = &s_framebuffer[y * w];
        for (int x = 0; x < w; x++) {
            uint32_t dust = (qc_prng(&seed) & 0x07);
            uint8_t r = 0x12 + dust;
            uint8_t g = 0x18 + dust;
            uint8_t b = 0x15 + dust;
            row[x] = 0xFF000000 | (b << 16) | (g << 8) | r;
        }
    }

    // Grid dots on blackboard
    int grid_size = (int)(40.0f * g_board.zoom);
    if (grid_size >= 16) {
        int off_x = ((int)g_board.cam_x % grid_size + grid_size) % grid_size;
        int off_y = ((int)g_board.cam_y % grid_size + grid_size) % grid_size;
        for (int y = off_y; y < h; y += grid_size) {
            for (int x = off_x; x < w; x += grid_size) {
                s_framebuffer[y * w + x] = qc_blend(0x20ffffff, s_framebuffer[y * w + x]);
            }
        }
    }

    // 2. Draw Stack Snap Indicator
    if (g_board.drag_mode == 1 && g_board.snap_target_parent >= 0) {
        chalk_module_node_t *p = &g_board.nodes[g_board.snap_target_parent];
        int sx = to_screen_x(p->x);
        int sy = to_screen_y(p->y + p->h);
        int sw = (int)(p->w * g_board.zoom);
        qc_fill_rect(sx, sy - 1, sw, 4, 0xFFfeca57);
    }

    // 3. Render Scratch Puzzle Blocks
    for (int i = 0; i < g_board.node_count; i++) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (!n->active) continue;

        int sx = to_screen_x(n->x);
        int sy = to_screen_y(n->y);
        int sw = (int)(n->w * g_board.zoom);
        int sh = (int)(n->h * g_board.zoom);

        // Block Drop Shadow
        qc_fill_rect(sx + 4, sy + 5, sw, sh, 0x55000000);

        // Outer Puzzle Shell (Category Accent)
        uint32_t shell_color = n->accent_color;
        uint32_t body_color = 0xFF141c18; // Dark tactical slate inside

        // Interlocking Top Notch (Inlet tab bump)
        int tab_x = sx + (int)(24.0f * g_board.zoom);
        int tab_w = (int)(44.0f * g_board.zoom);
        int tab_h = (int)(5.0f * g_board.zoom);

        // Draw Block Body
        qc_fill_rect(sx, sy, sw, sh, body_color);

        // Top Border with Scratch Puzzle Notch
        qc_fill_rect(sx, sy, tab_x - sx, 2, shell_color);
        qc_fill_rect(tab_x, sy - tab_h, tab_w, tab_h + 2, shell_color);
        qc_fill_rect(tab_x + tab_w, sy, (sx + sw) - (tab_x + tab_w), 2, shell_color);

        // Side and Bottom Borders
        qc_fill_rect(sx, sy, 2, sh, shell_color);
        qc_fill_rect(sx + sw - 2, sy, 2, sh, shell_color);
        
        // Bottom Border with Scratch Puzzle Tab
        qc_fill_rect(sx, sy + sh - 2, tab_x - sx, 2, shell_color);
        qc_fill_rect(tab_x, sy + sh - 2, tab_w, tab_h + 2, shell_color);
        qc_fill_rect(tab_x + tab_w, sy + sh - 2, (sx + sw) - (tab_x + tab_w), 2, shell_color);

        // Header Banner
        int header_h = (int)(22.0f * g_board.zoom);
        qc_fill_rect(sx + 2, sy + 2, sw - 4, header_h, 0xFF1b2621);
        qc_fill_rect(sx + 2, sy + 2, (int)(4.0f * g_board.zoom), header_h, shell_color);

        // Title: "[#0] VCO"
        char title_buf[32];
        title_buf[0] = '[';
        title_buf[1] = '#';
        title_buf[2] = '0' + (n->id % 10);
        title_buf[3] = ']';
        title_buf[4] = ' ';
        int tc = 0;
        while (n->name[tc] && tc < 14) { title_buf[5 + tc] = n->name[tc]; tc++; }
        title_buf[5 + tc] = 0;

        qc_draw_text_clipped(sx + (int)(8.0f * g_board.zoom), sy + (int)(6.0f * g_board.zoom), title_buf, shell_color, 1, sx + sw - (int)(60.0f * g_board.zoom));
        qc_draw_text_clipped(sx + sw - (int)(55.0f * g_board.zoom), sy + (int)(6.0f * g_board.zoom), n->category, 0xFF8395a7, 1, sx + sw - (int)(4.0f * g_board.zoom));

        int cur_y = sy + header_h + (int)(4.0f * g_board.zoom);

        // Mini Oscilloscope / LED Waveform
        int sc_x = sx + (int)(8.0f * g_board.zoom);
        int sc_y = cur_y;
        int sc_w = sw - (int)(16.0f * g_board.zoom);
        int sc_h = (int)(24.0f * g_board.zoom);

        qc_fill_rect(sc_x, sc_y, sc_w, sc_h, 0xFF080c0a);
        qc_fill_rect(sc_x, sc_y + sc_h / 2, sc_w, 1, 0x22ffffff);

        int prev_px = sc_x;
        int prev_py = sc_y + sc_h / 2;
        for (int s = 0; s < 48 && s < sc_w; s++) {
            int px = sc_x + (s * sc_w) / 48;
            float val = n->scope_data[s];
            int py = sc_y + sc_h / 2 - (int)(val * (sc_h / 2 - 2));
            if (py < sc_y + 1) py = sc_y + 1;
            if (py >= sc_y + sc_h - 1) py = sc_y + sc_h - 2;

            qc_draw_line(prev_px, prev_py, px, py, 2, shell_color);
            prev_px = px;
            prev_py = py;
        }

        cur_y += sc_h + (int)(6.0f * g_board.zoom);

        // Scratch Input Sockets (Notches)
        for (int s = 0; s < n->socket_count; s++) {
            chalk_socket_t *sock = &n->sockets[s];
            int sock_x = sx + (int)(8.0f * g_board.zoom);
            int sock_w = sw - (int)(16.0f * g_board.zoom);
            int sock_h = (int)(18.0f * g_board.zoom);
            uint32_t type_col = s_link_colors[sock->type % 3];

            // Inset slot background
            qc_fill_rect(sock_x, cur_y, sock_w, sock_h, 0xFF0a100d);
            qc_fill_rect(sock_x, cur_y, (int)(3.0f * g_board.zoom), sock_h, type_col);

            // Socket Name
            qc_draw_text_clipped(sock_x + (int)(6.0f * g_board.zoom), cur_y + (int)(4.0f * g_board.zoom), sock->name, 0xFFdcdde1, 1, sock_x + (int)(75.0f * g_board.zoom));

            // Snapped Pill or Drop Target
            int slot_pill_x = sock_x + (int)(80.0f * g_board.zoom);
            int slot_pill_w = sock_w - (int)(84.0f * g_board.zoom);

            if (sock->connected_src_node >= 0) {
                // Connected Snapped Pill
                qc_draw_pill(slot_pill_x, cur_y + 1, slot_pill_w, sock_h - 2, 0x44000000 | (type_col & 0x00FFFFFF), type_col, sock->connected_label, type_col);
                qc_draw_text(slot_pill_x + slot_pill_w - (int)(10.0f * g_board.zoom), cur_y + (int)(4.0f * g_board.zoom), "x", 0xFFff6b6b, 1);
            } else {
                // Empty Socket Drop Target
                qc_fill_rect(slot_pill_x, cur_y + 2, slot_pill_w, sock_h - 4, 0x18ffffff);
                qc_draw_text(slot_pill_x + (int)(4.0f * g_board.zoom), cur_y + (int)(4.0f * g_board.zoom), "( drop )", 0xFF576574, 1);
            }

            cur_y += sock_h + (int)(4.0f * g_board.zoom);
        }

        // Sliders
        for (int s = 0; s < n->slider_count; s++) {
            chalk_slider_entry_t *slider = &n->sliders[s];
            int sl_x = sx + (int)(8.0f * g_board.zoom);
            int sl_w = sw - (int)(16.0f * g_board.zoom);
            int sl_h = (int)(20.0f * g_board.zoom);

            qc_draw_text_clipped(sl_x, cur_y, slider->name, 0xFFc8d6e5, 1, sl_x + (int)(65.0f * g_board.zoom));
            qc_draw_text_clipped(sl_x + sl_w - (int)(55.0f * g_board.zoom), cur_y, slider->val_str, 0xFFfeca57, 1, sl_x + sl_w);

            int track_y = cur_y + (int)(12.0f * g_board.zoom);
            int track_w = sl_w;
            qc_fill_rect(sl_x, track_y, track_w, (int)(4.0f * g_board.zoom), 0xFF1e272e);

            int fill_w = (int)(slider->value * track_w);
            qc_fill_rect(sl_x, track_y, fill_w, (int)(4.0f * g_board.zoom), shell_color);
            qc_draw_circle_filled(sl_x + fill_w, track_y + (int)(2.0f * g_board.zoom), (int)(4.0f * g_board.zoom), 0xFFffffff);

            cur_y += sl_h + (int)(4.0f * g_board.zoom);
        }

        // Output Reporter Pills (At bottom of block)
        if (n->pill_count > 0) {
            float pill_spacing = (n->w - 16.0f) / (float)n->pill_count;
            for (int p = 0; p < n->pill_count; p++) {
                chalk_output_pill_t *pill = &n->pills[p];
                int px = sx + (int)((8.0f + p * pill_spacing) * g_board.zoom);
                int pw = (int)((pill_spacing - 4.0f) * g_board.zoom);
                int py = sy + sh - (int)(22.0f * g_board.zoom);
                int ph = (int)(16.0f * g_board.zoom);

                qc_draw_pill(px, py, pw, ph, 0x33000000 | (pill->color & 0x00FFFFFF), pill->color, pill->name, pill->color);
            }
        }
    }

    // 4. Dragging Teleport Pill (Follows cursor with subtle tether line)
    if (g_board.drag_mode == 2 && g_board.wire_src_node >= 0) {
        chalk_module_node_t *src_n = &g_board.nodes[g_board.wire_src_node];
        uint32_t pcol = s_link_colors[g_board.wire_type % 3];

        int src_sx = to_screen_x(src_n->x + src_n->w / 2.0f);
        int src_sy = to_screen_y(src_n->y + src_n->h);
        int mx = (int)g_board.mouse_screen_x;
        int my = (int)g_board.mouse_screen_y;

        // Soft dashed tether
        qc_draw_line(src_sx, src_sy, mx, my, 2, 0x44ffffff);

        // Floating Pill under cursor
        char pill_label[32];
        int c = 0;
        while (src_n->name[c] && c < 8) { pill_label[c] = src_n->name[c]; c++; }
        pill_label[c++] = ':';
        if (g_board.wire_src_out_idx >= 0 && g_board.wire_src_out_idx < src_n->pill_count) {
            int p = 0;
            while (src_n->pills[g_board.wire_src_out_idx].name[p] && c < 18) {
                pill_label[c++] = src_n->pills[g_board.wire_src_out_idx].name[p++];
            }
        }
        pill_label[c] = 0;

        qc_draw_pill(mx - 40, my - 10, 80, 20, 0xEE1e272e, pcol, pill_label, pcol);
        qc_draw_circle_filled(mx, my, 4, 0xFFffffff);
    }
}

/* Public GFX Drawing API */
W_EXPORT void quadro_chalk_draw_rect(int32_t x, int32_t y, int32_t w, int32_t h, uint32_t color) { qc_fill_rect(x, y, w, h, color); }
W_EXPORT void quadro_chalk_draw_line(int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t thickness, uint32_t color) { qc_draw_line(x0, y0, x1, y1, thickness, color); }
W_EXPORT void quadro_chalk_draw_circle(int32_t cx, int32_t cy, int32_t radius, uint32_t color, int32_t filled) { if (filled) qc_draw_circle_filled(cx, cy, radius, color); }
W_EXPORT void quadro_chalk_draw_text_cmd(int32_t x, int32_t y, const char *str, uint32_t color, int32_t scale) { qc_draw_text(x, y, str, color, scale); }
W_EXPORT void quadro_chalk_draw_pixel(int32_t x, int32_t y, uint32_t color) { qc_put_pixel(x, y, color); }
W_EXPORT int32_t quadro_chalk_get_node_rect(int32_t node_id, int32_t *out_x, int32_t *out_y, int32_t *out_w, int32_t *out_h) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (out_x) *out_x = to_screen_x(n->x);
        if (out_y) *out_y = to_screen_y(n->y);
        if (out_w) *out_w = (int)(n->w * g_board.zoom);
        if (out_h) *out_h = (int)(n->h * g_board.zoom);
        return 0;
    }
    return -1;
}

