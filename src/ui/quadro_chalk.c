/**
 * =========================================================================
 * BRACK Quadro Chalk Engine (src/ui/quadro_chalk.c)
 * 100% C-Rendered Node Graph: Clean UI Cards + Quadro Chalk Wires
 * Supports 3 Link Types: AUDIO (Cyan), MIDI (Amber), VAL (Lime)
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

/* =========================================================================
 * Crisp 8x8 Monospace ASCII Bitmap Text Renderer
 * ========================================================================= */

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

/* =========================================================================
 * Camera Transforms (World <-> Screen)
 * ========================================================================= */

static inline int to_screen_x(float wx) {
    return (int)(wx * g_board.zoom + g_board.cam_x);
}

static inline int to_screen_y(float wy) {
    return (int)(wy * g_board.zoom + g_board.cam_y);
}

static inline float to_world_x(float sx) {
    return (sx - g_board.cam_x) / g_board.zoom;
}

static inline float to_world_y(float sy) {
    return (sy - g_board.cam_y) / g_board.zoom;
}

/* =========================================================================
 * Quadro Chalk Brush Stroke Wire (Textured with Grain & Dust)
 * ========================================================================= */

static void qc_chalk_dab(int cx, int cy, int radius, uint32_t color, uint32_t *seed) {
    for (int dy = -radius; dy <= radius; dy++) {
        for (int dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
                uint32_t r = qc_prng(seed);
                if ((r & 0xFF) < 180) { // Chalk grain tooth
                    uint8_t a = 110 + ((r >> 8) & 0x8F);
                    uint32_t c = ((uint32_t)a << 24) | (color & 0x00FFFFFF);
                    qc_put_pixel(cx + dx, cy + dy, c);
                }
            }
        }
    }
}

static void qc_draw_chalk_wire(int x0, int y0, int x1, int y1, uint8_t link_type, uint32_t *seed, uint32_t tick) {
    uint32_t color = s_link_colors[link_type % 3];
    int dx = x1 - x0;
    int dy = y1 - y0;
    int abs_dy = dy < 0 ? -dy : dy;
    int dist_y = abs_dy / 2;
    if (dist_y < 50) dist_y = 50;

    int cx0 = x0;
    int cy0 = y0 + dist_y;
    int cx1 = x1;
    int cy1 = y1 - dist_y;

    // 1. Soft Drop Shadow
    int steps = 36;
    int prev_x = x0;
    int prev_y = y0 + 6;

    for (int i = 1; i <= steps; i++) {
        float t = (float)i / (float)steps;
        float it = 1.0f - t;
        float px = it*it*it * x0 + 3*it*it*t * cx0 + 3*it*t*t * cx1 + t*t*t * x1;
        float py = it*it*it * (y0 + 6) + 3*it*it*t * (cy0 + 6) + 3*it*t*t * (cy1 + 6) + t*t*t * (y1 + 6);
        qc_draw_line(prev_x, prev_y, (int)px, (int)py, 6, 0x60000000);
        prev_x = (int)px;
        prev_y = (int)py;
    }

    // 2. Main Chalk Stroke with Grain
    prev_x = x0;
    prev_y = y0;
    for (int i = 1; i <= steps; i++) {
        float t = (float)i / (float)steps;
        float it = 1.0f - t;
        float px = it*it*it * x0 + 3*it*it*t * cx0 + 3*it*t*t * cx1 + t*t*t * x1;
        float py = it*it*it * y0 + 3*it*it*t * cy0 + 3*it*t*t * cy1 + t*t*t * y1;

        qc_draw_line(prev_x, prev_y, (int)px, (int)py, 3, color);
        qc_chalk_dab((int)px, (int)py, 2, color, seed);

        // Falling chalk specks
        if ((qc_prng(seed) & 0x1F) == 0) {
            qc_put_pixel((int)px + (qc_prng(seed) % 5 - 2), (int)py + 4 + (qc_prng(seed) % 8), color);
        }

        prev_x = (int)px;
        prev_y = (int)py;
    }

    // 3. Traveling Signal Pulse Animation based on Link Type
    float speed = (link_type == CHALK_LINK_MIDI) ? 3.0f : 2.0f;
    float pulse_t = ((float)((uint32_t)(tick * speed) % 100)) / 100.0f;
    float it = 1.0f - pulse_t;
    float dot_x = it*it*it * x0 + 3*it*it*pulse_t * cx0 + 3*it*pulse_t*pulse_t * cx1 + pulse_t*pulse_t*pulse_t * x1;
    float dot_y = it*it*it * y0 + 3*it*it*pulse_t * cy0 + 3*it*pulse_t*pulse_t * cy1 + pulse_t*pulse_t*pulse_t * y1;
    
    int dot_rad = (link_type == CHALK_LINK_MIDI) ? 5 : 4;
    qc_draw_circle_filled((int)dot_x, (int)dot_y, dot_rad, 0xFFffffff);
}

/* =========================================================================
 * Quadro Chalk Public API
 * ========================================================================= */

W_EXPORT void quadro_chalk_init(int32_t width, int32_t height) {
    g_board.view_w = (width > 0 && width <= 1920) ? width : 1280;
    g_board.view_h = (height > 0 && height <= 1080) ? height : 720;
    g_board.cam_x = 0.0f;
    g_board.cam_y = 0.0f;
    g_board.zoom = 1.0f;
    g_board.node_count = 0;
    g_board.link_count = 0;
    g_board.drag_mode = 0;
    g_board.chalk_seed = 0x5a1b3c7d;
    g_board.anim_frame = 0;
}

W_EXPORT uint32_t* quadro_chalk_get_framebuffer(void) {
    return s_framebuffer;
}

W_EXPORT void quadro_chalk_resize(int32_t width, int32_t height) {
    if (width > 0 && width <= 1920) g_board.view_w = width;
    if (height > 0 && height <= 1080) g_board.view_h = height;
}

W_EXPORT void quadro_chalk_set_camera(float cam_x, float cam_y, float zoom) {
    g_board.cam_x = cam_x;
    g_board.cam_y = cam_y;
    if (zoom >= 0.3f && zoom <= 3.0f) g_board.zoom = zoom;
}

W_EXPORT float quadro_chalk_get_cam_x(void) {
    return g_board.cam_x;
}

W_EXPORT float quadro_chalk_get_cam_y(void) {
    return g_board.cam_y;
}

W_EXPORT float quadro_chalk_get_zoom(void) {
    return g_board.zoom;
}

static void update_node_bounds(chalk_module_node_t *n) {
    float inputs_h = (n->input_count > 0) ? (n->input_count * 18.0f + 6.0f) : 18.0f;
    float sliders_h = n->slider_count * 24.0f;
    float min_h = 24.0f + 32.0f + inputs_h + sliders_h + 20.0f;
    if (min_h < 120.0f) min_h = 120.0f;
    n->h = min_h;
    n->w = 200.0f;
}

W_EXPORT void quadro_chalk_set_node_code(int32_t node_id, const char *code_text) {
    if (node_id < 0 || node_id >= g_board.node_count) return;
    chalk_module_node_t *n = &g_board.nodes[node_id];
    n->code_line_count = 0;
    if (!code_text) return;

    int line = 0;
    int col = 0;
    const char *p = code_text;
    while (*p && line < MAX_CODE_LINES) {
        if (*p == '\n' || *p == '\r') {
            n->code_lines[line][col] = 0;
            line++;
            col = 0;
            if (*p == '\r' && *(p + 1) == '\n') p++;
        } else {
            if (col < MAX_LINE_CHARS - 1) {
                if (*p == '\t') {
                    if (col < MAX_LINE_CHARS - 2) {
                        n->code_lines[line][col++] = ' ';
                        n->code_lines[line][col++] = ' ';
                    }
                } else {
                    n->code_lines[line][col++] = *p;
                }
            }
        }
        p++;
    }
    if (col > 0 && line < MAX_CODE_LINES) {
        n->code_lines[line][col] = 0;
        line++;
    }
    n->code_line_count = line;
    update_node_bounds(n);
}

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
    n->w = (w >= 240.0f) ? w : 260.0f;
    n->h = (h >= 140.0f) ? h : 160.0f;
    n->input_count = 0;
    n->out_count = 0;
    n->slider_count = 0;
    n->code_line_count = 0;
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

W_EXPORT void quadro_chalk_add_node_output(int32_t node_id, uint8_t type, const char *out_name) {
    if (node_id >= 0 && node_id < g_board.node_count) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        if (n->out_count < MAX_OUTPUT_PINS) {
            int o = n->out_count++;
            n->out_types[o] = type;
            int c = 0;
            while (out_name && out_name[c] && c < 9) { n->out_names[o][c] = out_name[c]; c++; }
            n->out_names[o][c] = 0;
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

W_EXPORT int32_t quadro_chalk_connect(int32_t src_node, int32_t src_out_idx, int32_t dst_node, uint8_t link_type, float gain) {
    if (src_node >= g_board.node_count || dst_node >= g_board.node_count || src_node == dst_node) return -1;

    // Add Link
    if (g_board.link_count < MAX_CHALK_LINKS) {
        int l_idx = g_board.link_count++;
        chalk_module_link_t *l = &g_board.links[l_idx];
        l->src_node = src_node;
        l->src_out_idx = src_out_idx;
        l->dst_node = dst_node;
        l->link_type = link_type;
        l->color = s_link_colors[link_type % 3];
        l->active = 1;
    }

    // Add to Destination Inputs List
    chalk_module_node_t *dst_n = &g_board.nodes[dst_node];
    chalk_module_node_t *src_n = &g_board.nodes[src_node];

    if (dst_n->input_count < MAX_INPUT_SOURCES) {
        chalk_received_input_t *tag = &dst_n->inputs[dst_n->input_count++];
        tag->src_node = src_node;
        tag->src_out_idx = src_out_idx;
        tag->link_type = link_type;
        tag->gain = (gain > 0.0f) ? gain : 1.0f;
        int c = 0;
        while (src_n->name[c] && c < 15) { tag->src_name[c] = src_n->name[c]; c++; }
        tag->src_name[c] = 0;

        update_node_bounds(dst_n);
    }
    return 0;
}

W_EXPORT void quadro_chalk_disconnect(int32_t src_node, int32_t dst_node) {
    for (int i = 0; i < g_board.link_count; i++) {
        if (g_board.links[i].src_node == src_node && g_board.links[i].dst_node == dst_node) {
            g_board.links[i].active = 0;
        }
    }
}

W_EXPORT int32_t quadro_chalk_get_active_links(int32_t *out_src, int32_t *out_src_out, int32_t *out_dst, int32_t *out_type) {
    int count = 0;
    for (int i = 0; i < g_board.link_count; i++) {
        if (g_board.links[i].active) {
            if (out_src) out_src[count] = g_board.links[i].src_node;
            if (out_src_out) out_src_out[count] = g_board.links[i].src_out_idx;
            if (out_dst) out_dst[count] = g_board.links[i].dst_node;
            if (out_type) out_type[count] = g_board.links[i].link_type;
            count++;
        }
    }
    return count;
}

W_EXPORT void quadro_chalk_clear(void) {
    g_board.link_count = 0;
    for (int i = 0; i < g_board.node_count; i++) {
        g_board.nodes[i].input_count = 0;
        update_node_bounds(&g_board.nodes[i]);
    }
}

W_EXPORT void quadro_chalk_feed_scope(int32_t node_id, const float *samples, uint32_t count) {
    if (node_id >= 0 && node_id < g_board.node_count && samples) {
        chalk_module_node_t *n = &g_board.nodes[node_id];
        uint32_t c = count > 48 ? 48 : count;
        for (uint32_t i = 0; i < c; i++) n->scope_data[i] = samples[i];
    }
}

/* =========================================================================
 * Mouse & Gesture Handling in Pure C
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

    // 1. Check Output Pins at Bottom -> Drag new typed wire
    for (int i = 0; i < g_board.node_count; i++) {
        chalk_module_node_t *n = &g_board.nodes[i];
        int num_outs = (n->out_count > 0) ? n->out_count : 1;
        float spacing = n->w / (float)(num_outs + 1);

        for (int o = 0; o < num_outs; o++) {
            float out_x = n->x + spacing * (float)(o + 1);
            float out_y = n->y + n->h;
            float dx = wx - out_x;
            float dy = wy - out_y;
            if (dx * dx + dy * dy <= 16.0f * 16.0f) {
                g_board.drag_mode = 2; // Wire Drag
                g_board.wire_src_node = i;
                g_board.wire_src_out_idx = o;
                g_board.wire_type = (n->out_count > o) ? n->out_types[o] : CHALK_LINK_AUDIO;
                return;
            }
        }
    }

    // 2. Check Node Clicks (Inputs delete, Sliders, Body)
    for (int i = g_board.node_count - 1; i >= 0; i--) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (wx >= n->x && wx <= n->x + n->w && wy >= n->y && wy <= n->y + n->h) {

            // Select this module
            quadro_chalk_set_selected_node(i);

            // Check Delete (x) on input tags
            // Check Delete (x) on input tags
            float input_y = n->y + 24.0f + 30.0f;
            for (int in = 0; in < n->input_count; in++) {
                float iy = input_y + in * 18.0f;
                if (wy >= iy && wy <= iy + 16.0f && wx >= n->x + n->w - 24.0f && wx <= n->x + n->w - 6.0f) {
                    int src_id = n->inputs[in].src_node;
                    for (int k = in; k < n->input_count - 1; k++) n->inputs[k] = n->inputs[k + 1];
                    n->input_count--;
                    update_node_bounds(n);
                    quadro_chalk_disconnect(src_id, i);
                    return;
                }
            }

            // Check Sliders (located below inputs)
            float inputs_h = (n->input_count > 0) ? (n->input_count * 18.0f + 6.0f) : 18.0f;
            float slider_y = n->y + 24.0f + 30.0f + inputs_h;

            for (int s = 0; s < n->slider_count; s++) {
                float sy = slider_y + s * 24.0f;
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

            // Drag Node
            g_board.drag_mode = 1;
            g_board.active_node_id = i;
            g_board.drag_off_x = wx - n->x;
            g_board.drag_off_y = wy - n->y;
            return;
        }
    }

    // Clicked background -> Pan
    g_board.drag_mode = 4;
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
        n->x = wx - g_board.drag_off_x;
        n->y = wy - g_board.drag_off_y;
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

    if (g_board.drag_mode == 2 && g_board.wire_src_node >= 0) {
        for (int i = 0; i < g_board.node_count; i++) {
            if (i == g_board.wire_src_node) continue;
            chalk_module_node_t *n = &g_board.nodes[i];
            if (wx >= n->x && wx <= n->x + n->w && wy >= n->y && wy <= n->y + n->h) {
                quadro_chalk_connect(g_board.wire_src_node, g_board.wire_src_out_idx, i, g_board.wire_type, 1.0f);
                if (out_src_slot) *out_src_slot = g_board.nodes[g_board.wire_src_node].slot_id;
                if (out_src_out_idx) *out_src_out_idx = g_board.wire_src_out_idx;
                if (out_dst_slot) *out_dst_slot = n->slot_id;
                if (out_link_type) *out_link_type = g_board.wire_type;
                connected = 1;
                break;
            }
        }
    }

    g_board.drag_mode = 0;
    g_board.active_node_id = -1;
    g_board.wire_src_node = -1;
    return connected;
}

/* =========================================================================
 * Full Frame Rendering Pass in Pure C
 * ========================================================================= */

static uint32_t qc_get_syntax_color(const char *line) {
    while (*line == ' ') line++;
    if (line[0] == '/' && line[1] == '/') return 0xFF8395a7; // Chalk Dim Grey for comments
    if (line[0] == '*' || (line[0] == '/' && line[1] == '*')) return 0xFF8395a7;

    const char *p = line;
    while (*p) {
        if ((p[0] == 'i' && p[1] == 'n' && p[2] == 'p' && p[3] == 'u' && p[4] == 't') ||
            (p[0] == 'o' && p[1] == 'u' && p[2] == 't' && p[3] == 'p' && p[4] == 'u' && p[5] == 't')) {
            return 0xFF48dbfb; // Cyan for inputs/outputs
        }
        if (p[0] == 'd' && p[1] == 's' && p[2] == 'p' && p[3] == '.') {
            return 0xFF1dd1a1; // Lime green for DSP helper
        }
        if ((p[0] == 'r' && p[1] == 'e' && p[2] == 't' && p[3] == 'u' && p[4] == 'r' && p[5] == 'n') ||
            (p[0] == 'l' && p[1] == 'e' && p[2] == 't' && p[3] == ' ') ||
            (p[0] == 'c' && p[1] == 'o' && p[2] == 'n' && p[3] == 's' && p[4] == 't')) {
            return 0xFFfeca57; // Amber for JS keywords
        }
        p++;
    }
    return 0xFFe4e7eb; // Crisp white
}

W_EXPORT void quadro_chalk_render(void) {
    int w = g_board.view_w;
    int h = g_board.view_h;
    g_board.anim_frame++;
    uint32_t seed = 0x5a1b3c7d + g_board.anim_frame;

    // 1. Dark Slate Blackboard Background
    for (int y = 0; y < h; y++) {
        uint32_t *row = &s_framebuffer[y * w];
        for (int x = 0; x < w; x++) {
            uint32_t dust = (qc_prng(&seed) & 0x07);
            uint8_t r = 0x14 + dust;
            uint8_t g = 0x1c + dust;
            uint8_t b = 0x18 + dust;
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
                s_framebuffer[y * w + x] = qc_blend(0x25ffffff, s_framebuffer[y * w + x]);
            }
        }
    }

    // 2. Render Connected Chalk Wires (Chalk Brush Stroke Texture)
    for (int i = 0; i < g_board.link_count; i++) {
        chalk_module_link_t *l = &g_board.links[i];
        if (!l->active) continue;

        chalk_module_node_t *src_n = &g_board.nodes[l->src_node];
        chalk_module_node_t *dst_n = &g_board.nodes[l->dst_node];

        int num_outs = (src_n->out_count > 0) ? src_n->out_count : 1;
        float spacing = src_n->w / (float)(num_outs + 1);
        int x0 = to_screen_x(src_n->x + spacing * (float)(l->src_out_idx + 1));
        int y0 = to_screen_y(src_n->y + src_n->h);
        int x1 = to_screen_x(dst_n->x + dst_n->w / 2.0f);
        int y1 = to_screen_y(dst_n->y);

        qc_draw_chalk_wire(x0, y0, x1, y1, l->link_type, &seed, g_board.anim_frame);
    }

    // 3. Render Dragging Wire
    if (g_board.drag_mode == 2 && g_board.wire_src_node >= 0) {
        chalk_module_node_t *src_n = &g_board.nodes[g_board.wire_src_node];
        int num_outs = (src_n->out_count > 0) ? src_n->out_count : 1;
        float spacing = src_n->w / (float)(num_outs + 1);
        int x0 = to_screen_x(src_n->x + spacing * (float)(g_board.wire_src_out_idx + 1));
        int y0 = to_screen_y(src_n->y + src_n->h);
        qc_draw_chalk_wire(x0, y0, (int)g_board.mouse_screen_x, (int)g_board.mouse_screen_y, g_board.wire_type, &seed, g_board.anim_frame);
    }

    // 4. Render Live-Scriptable Code Text Boxes
    for (int i = 0; i < g_board.node_count; i++) {
        chalk_module_node_t *n = &g_board.nodes[i];
        if (!n->active) continue;

        int sx = to_screen_x(n->x);
        int sy = to_screen_y(n->y);
        int sw = (int)(n->w * g_board.zoom);
        int sh = (int)(n->h * g_board.zoom);

        // Drop Shadow
        qc_fill_rect(sx + 4, sy + 5, sw, sh, 0x60000000);

        // Solid Dark Code Box Body
        qc_fill_rect(sx, sy, sw, sh, 0xFF0e1411);

        // High-contrast Border (Accent glow if selected)
        uint32_t border_col = n->is_selected ? n->accent_color : 0xFF2d3d36;
        int border_th = n->is_selected ? 2 : 1;
        qc_fill_rect(sx, sy, sw, border_th, border_col);
        qc_fill_rect(sx, sy + sh - border_th, sw, border_th, border_col);
        qc_fill_rect(sx, sy, border_th, sh, border_col);
        qc_fill_rect(sx + sw - border_th, sy, border_th, sh, border_col);

        // Header Tab
        int header_h = (int)(20.0f * g_board.zoom);
        qc_fill_rect(sx + 1, sy + 1, sw - 2, header_h, 0xFF17221d);
        qc_fill_rect(sx + 1, sy + 1, (int)(4.0f * g_board.zoom), header_h, n->accent_color);

        // Title: "[#0] VCO.js"
        char title_buf[32];
        title_buf[0] = '[';
        title_buf[1] = '#';
        title_buf[2] = '0' + (n->id % 10);
        title_buf[3] = ']';
        title_buf[4] = ' ';
        int tc = 0;
        while (n->name[tc] && tc < 14) { title_buf[5 + tc] = n->name[tc]; tc++; }
        title_buf[5 + tc] = 0;

        qc_draw_text_clipped(sx + (int)(8.0f * g_board.zoom), sy + (int)(5.0f * g_board.zoom), title_buf, n->accent_color, 1, sx + sw - (int)(65.0f * g_board.zoom));
        qc_draw_text_clipped(sx + sw - (int)(60.0f * g_board.zoom), sy + (int)(5.0f * g_board.zoom), n->category, 0xFF8395a7, 1, sx + sw - (int)(4.0f * g_board.zoom));

        // Top IN Socket Indicator
        qc_draw_circle_filled(sx + sw / 2, sy, 4, 0xFFffffff);

        int cur_y = sy + header_h + (int)(4.0f * g_board.zoom);

        // Live Mini Oscilloscope / Waveform Display
        int sc_x = sx + (int)(8.0f * g_board.zoom);
        int sc_y = cur_y;
        int sc_w = sw - (int)(16.0f * g_board.zoom);
        int sc_h = (int)(26.0f * g_board.zoom);

        qc_fill_rect(sc_x, sc_y, sc_w, sc_h, 0xFF080c0a);
        qc_fill_rect(sc_x, sc_y + sc_h / 2, sc_w, 1, 0x22ffffff); // Scope center line

        int prev_px = sc_x;
        int prev_py = sc_y + sc_h / 2;
        for (int s = 0; s < 48 && s < sc_w; s++) {
            int px = sc_x + (s * sc_w) / 48;
            float val = n->scope_data[s];
            int py = sc_y + sc_h / 2 - (int)(val * (sc_h / 2 - 2));
            if (py < sc_y + 1) py = sc_y + 1;
            if (py >= sc_y + sc_h - 1) py = sc_y + sc_h - 2;

            qc_draw_line(prev_px, prev_py, px, py, 2, n->accent_color);
            prev_px = px;
            prev_py = py;
        }

        cur_y += sc_h + (int)(6.0f * g_board.zoom);

        // Dynamic Received Inputs Section
        if (n->input_count == 0) {
            qc_draw_text_clipped(sx + (int)(10.0f * g_board.zoom), cur_y + (int)(2.0f * g_board.zoom), "// in: (no links)", 0xFF485460, 1, sx + sw - (int)(10.0f * g_board.zoom));
            cur_y += (int)(16.0f * g_board.zoom);
        } else {
            for (int in = 0; in < n->input_count; in++) {
                chalk_received_input_t *tag = &n->inputs[in];
                int tag_h = (int)(15.0f * g_board.zoom);
                int tag_x = sx + (int)(8.0f * g_board.zoom);
                int tag_w = sw - (int)(16.0f * g_board.zoom);
                uint32_t tcol = s_link_colors[tag->link_type % 3];

                qc_fill_rect(tag_x, cur_y, tag_w, tag_h, 0x22000000 | (tcol & 0x00FFFFFF));
                qc_fill_rect(tag_x, cur_y, (int)(3.0f * g_board.zoom), tag_h, tcol);

                const char *badge = (tag->link_type == CHALK_LINK_AUDIO) ? "AUD" :
                                    (tag->link_type == CHALK_LINK_MIDI)  ? "MID" : "VAL";
                char buf[32];
                buf[0] = '['; buf[1] = badge[0]; buf[2] = badge[1]; buf[3] = badge[2]; buf[4] = ']'; buf[5] = ' ';
                int c = 0;
                while (tag->src_name[c] && c < 12) { buf[6 + c] = tag->src_name[c]; c++; }
                buf[6 + c] = 0;
                qc_draw_text_clipped(tag_x + (int)(6.0f * g_board.zoom), cur_y + (int)(2.0f * g_board.zoom), buf, tcol, 1, tag_x + tag_w - (int)(16.0f * g_board.zoom));
                qc_draw_text(tag_x + tag_w - (int)(12.0f * g_board.zoom), cur_y + (int)(2.0f * g_board.zoom), "x", 0xFFff6b6b, 1);

                cur_y += (int)(18.0f * g_board.zoom);
            }
        }

        // Sliders (if any)
        for (int s = 0; s < n->slider_count; s++) {
            chalk_slider_entry_t *sl = &n->sliders[s];
            int track_x = sx + (int)(8.0f * g_board.zoom);
            int track_w = sw - (int)(16.0f * g_board.zoom);
            int s_y = cur_y + (int)(s * 24.0f * g_board.zoom);

            qc_draw_text_clipped(track_x, s_y, sl->name, 0xFF8395a7, 1, track_x + track_w / 2);
            qc_draw_text_clipped(track_x + track_w - (int)(60.0f * g_board.zoom), s_y, sl->val_str, 0xFFffffff, 1, track_x + track_w);

            int bar_y = s_y + (int)(9.0f * g_board.zoom);
            int bar_h = (int)(5.0f * g_board.zoom);
            qc_fill_rect(track_x, bar_y, track_w, bar_h, 0xFF080c0a);

            int fill_w = (int)(sl->value * (float)track_w);
            qc_fill_rect(track_x, bar_y, fill_w, bar_h, n->accent_color);
            qc_fill_rect(track_x + fill_w - 2, bar_y - 2, 4, bar_h + 4, 0xFFffffff);
        }

        // Bottom Output Pin Handles
        int num_outs = (n->out_count > 0) ? n->out_count : 1;
        float spacing = (float)sw / (float)(num_outs + 1);
        for (int o = 0; o < num_outs; o++) {
            int pin_x = sx + (int)(spacing * (float)(o + 1));
            int pin_y = sy + sh;
            uint8_t out_t = (n->out_count > o) ? n->out_types[o] : CHALK_LINK_AUDIO;
            uint32_t pin_col = s_link_colors[out_t % 3];

            qc_draw_circle_filled(pin_x, pin_y, 5, pin_col);
            if (n->out_count > o && n->out_names[o][0]) {
                qc_draw_text(pin_x - 12, pin_y - 12, n->out_names[o], pin_col, 1);
            }
        }
    }
}

/* =========================================================================
 * Public GFX Drawing API for JS Modules
 * ========================================================================= */

W_EXPORT void quadro_chalk_draw_rect(int32_t x, int32_t y, int32_t w, int32_t h, uint32_t color) {
    qc_fill_rect(x, y, w, h, color);
}

W_EXPORT void quadro_chalk_draw_line(int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t thickness, uint32_t color) {
    qc_draw_line(x0, y0, x1, y1, (thickness > 0) ? thickness : 1, color);
}

W_EXPORT void quadro_chalk_draw_circle(int32_t cx, int32_t cy, int32_t radius, uint32_t color, int32_t filled) {
    if (filled) {
        qc_draw_circle_filled(cx, cy, radius, color);
    } else {
        qc_draw_line(cx - radius, cy, cx + radius, cy, 1, color);
    }
}

W_EXPORT void quadro_chalk_draw_text_cmd(int32_t x, int32_t y, const char *str, uint32_t color, int32_t scale) {
    qc_draw_text(x, y, str, color, (scale > 0) ? scale : 1);
}

W_EXPORT void quadro_chalk_draw_pixel(int32_t x, int32_t y, uint32_t color) {
    qc_put_pixel(x, y, color);
}

W_EXPORT int32_t quadro_chalk_get_node_rect(int32_t node_id, int32_t *out_x, int32_t *out_y, int32_t *out_w, int32_t *out_h) {
    if (node_id < 0 || node_id >= g_board.node_count) return 0;
    chalk_module_node_t *n = &g_board.nodes[node_id];
    if (out_x) *out_x = to_screen_x(n->x);
    if (out_y) *out_y = to_screen_y(n->y);
    if (out_w) *out_w = (int)(n->w * g_board.zoom);
    if (out_h) *out_h = (int)(n->h * g_board.zoom);
    return 1;
}

