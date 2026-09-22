/**
 * =========================================================================
 * BRACK Chalkboard Visual Engine (src/ui/chalk_board.c)
 * Pure C / Quadro-based Blackboard Node Graph with Chalk Brush Textures
 * =========================================================================
 */

#include "chalk_board.h"
#include "brack_dsp.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

static chalk_board_state_t g_chalk = {0};
static uint32_t s_chalk_fb[1920 * 1080];

/* =========================================================================
 * Chalk Drawing Primitives & Procedural Dust
 * ========================================================================= */

static inline uint32_t chalk_prng(uint32_t *seed) {
    uint32_t x = *seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *seed = x;
    return x;
}

static inline uint32_t chalk_blend_pixel(uint32_t src, uint32_t dst) {
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

static void chalk_put_pixel(int x, int y, uint32_t color, uint8_t alpha) {
    if (x < 0 || x >= g_chalk.width || y < 0 || y >= g_chalk.height) return;
    uint32_t src = ((uint32_t)alpha << 24) | (color & 0x00FFFFFF);
    uint32_t *dst_ptr = &s_chalk_fb[y * g_chalk.width + x];
    *dst_ptr = chalk_blend_pixel(src, *dst_ptr);
}

/**
 * Chalk Dab: Simulates rough texture of chalk on slate
 */
static void chalk_dab(int cx, int cy, int radius, uint32_t color, uint32_t *seed, uint8_t density) {
    for (int dy = -radius; dy <= radius; dy++) {
        for (int dx = -radius; dx <= radius; dx++) {
            int d2 = dx * dx + dy * dy;
            if (d2 <= radius * radius) {
                uint32_t r = chalk_prng(seed);
                if ((r & 0xFF) < density) {
                    uint8_t a = 120 + ((r >> 8) & 0x7F);
                    chalk_put_pixel(cx + dx, cy + dy, color, a);
                }
            }
        }
    }
}

/**
 * Hand-Drawn Chalk Stroke between two points
 */
static void chalk_draw_stroke(int x0, int y0, int x1, int y1, int thickness, uint32_t color, uint32_t *seed) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int steps = w_isqrt(dx * dx + dy * dy);
    if (steps <= 0) return;

    for (int i = 0; i <= steps; i++) {
        int x = x0 + (dx * i) / steps;
        int y = y0 + (dy * i) / steps;
        // Subtle hand jitter
        int jx = ((chalk_prng(seed) & 3) - 1);
        int jy = ((chalk_prng(seed) & 3) - 1);
        chalk_dab(x + jx, y + jy, thickness, color, seed, 190);
    }
}

/**
 * Curved Chalk Wire (SunVox / PureData Link with chalk dust & gravity sag)
 */
static void chalk_draw_wire(int x0, int y0, int x1, int y1, uint32_t color, uint32_t *seed) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int dist = w_isqrt(dx * dx + dy * dy);
    int sag = 30 + dist / 4;
    if (sag > 90) sag = 90;

    int mid_x = (x0 + x1) / 2;
    int mid_y = (y0 > y1 ? y0 : y1) + sag;

    int steps = dist / 3 + 20;
    if (steps < 24) steps = 24;

    int prev_x = x0;
    int prev_y = y0;

    for (int i = 1; i <= steps; i++) {
        int t = (i * 1024) / steps;
        int it = 1024 - t;

        int px = (it * it * x0 + 2 * it * t * mid_x + t * t * x1) / (1024 * 1024);
        int py = (it * it * y0 + 2 * it * t * mid_y + t * t * y1) / (1024 * 1024);

        chalk_draw_stroke(prev_x, prev_y, px, py, 2, color, seed);

        // Falling chalk dust specks
        if ((chalk_prng(seed) & 0x1F) == 0) {
            int dust_y = py + 4 + (chalk_prng(seed) % 10);
            chalk_put_pixel(px, dust_y, color, 80);
        }

        prev_x = px;
        prev_y = py;
    }
}

/* =========================================================================
 * Chalk Box & UI Component Renderers
 * ========================================================================= */

static void chalk_draw_box(int x, int y, int w, int h, uint32_t color, uint32_t *seed) {
    // Hand-sketched chalk rectangle
    chalk_draw_stroke(x, y, x + w, y, 2, color, seed);
    chalk_draw_stroke(x + w, y, x + w, y + h, 2, color, seed);
    chalk_draw_stroke(x + w, y + h, x, y + h, 2, color, seed);
    chalk_draw_stroke(x, y + h, x, y, 2, color, seed);

    // Subtle dark slate inner fill
    for (int iy = y + 2; iy < y + h - 2; iy++) {
        uint32_t *row = &s_chalk_fb[iy * g_chalk.width + (x + 2)];
        int count = w - 4;
        for (int ix = 0; ix < count; ix++) {
            row[ix] = chalk_blend_pixel(0x50101715, row[ix]);
        }
    }
}

/* =========================================================================
 * Chalkboard Public API
 * ========================================================================= */

W_EXPORT void chalk_board_init(int32_t width, int32_t height) {
    g_chalk.width = (width > 0 && width <= 1920) ? width : 1280;
    g_chalk.height = (height > 0 && height <= 1080) ? height : 720;
    g_chalk.node_count = 0;
    g_chalk.link_count = 0;
    g_chalk.drag_mode = 0;
    g_chalk.chalk_seed = 0x98765432;
    g_chalk.anim_frame = 0;
}

W_EXPORT uint32_t* chalk_board_get_framebuffer(void) {
    return s_chalk_fb;
}

W_EXPORT void chalk_board_resize(int32_t width, int32_t height) {
    if (width > 0 && width <= 1920) g_chalk.width = width;
    if (height > 0 && height <= 1080) g_chalk.height = height;
}

W_EXPORT int32_t chalk_board_add_node(int32_t slot_id, const char *name, uint32_t color, int32_t x, int32_t y, int32_t w, int32_t h) {
    if (g_chalk.node_count >= MAX_CHALK_NODES) return -1;
    int idx = g_chalk.node_count++;
    chalk_node_t *n = &g_chalk.nodes[idx];
    n->id = idx;
    n->slot_id = slot_id;
    n->chalk_color = (color != 0) ? color : CHALK_WHITE;
    n->x = x;
    n->y = y;
    n->w = (w >= 160) ? w : 180;
    n->h = (h >= 120) ? h : 160;
    n->input_count = 0;
    n->slider_count = 0;
    n->active = 1;

    int c = 0;
    while (name && name[c] && c < 19) { n->name[c] = name[c]; c++; }
    n->name[c] = 0;
    return idx;
}

W_EXPORT int32_t chalk_board_add_slider(int32_t node_id, int32_t param_id, const char *name, float def_v, float min_v, float max_v) {
    if (node_id >= 0 && node_id < g_chalk.node_count) {
        chalk_node_t *n = &g_chalk.nodes[node_id];
        if (n->slider_count < MAX_CHALK_SLIDERS) {
            int s_idx = n->slider_count++;
            chalk_slider_t *s = &n->sliders[s_idx];
            s->param_id = param_id;
            s->min_val = min_v;
            s->max_val = max_v;
            s->value = (max_v > min_v) ? (def_v - min_v) / (max_v - min_v) : 0.5f;

            int c = 0;
            while (name && name[c] && c < 11) { s->name[c] = name[c]; c++; }
            s->name[c] = 0;

            // Update node height dynamically to fit inputs + scope + sliders
            n->h = 40 + 35 + (n->input_count * 18) + (n->slider_count * 20) + 15;
            return s_idx;
        }
    }
    return -1;
}

W_EXPORT int32_t chalk_board_connect(int32_t src_node, int32_t dst_node, float amount, uint32_t color) {
    if (src_node >= g_chalk.node_count || dst_node >= g_chalk.node_count || src_node == dst_node) return -1;

    // 1. Add visual link
    if (g_chalk.link_count < MAX_CHALK_LINKS) {
        int l_idx = g_chalk.link_count++;
        chalk_link_t *l = &g_chalk.links[l_idx];
        l->src_node = src_node;
        l->dst_node = dst_node;
        l->chalk_color = (color != 0) ? color : g_chalk.nodes[src_node].chalk_color;
        l->active = 1;
    }

    // 2. Add to destination node's dynamic input list (SunVox style)
    chalk_node_t *dst_n = &g_chalk.nodes[dst_node];
    chalk_node_t *src_n = &g_chalk.nodes[src_node];

    if (dst_n->input_count < MAX_INPUT_ENTRIES) {
        chalk_input_entry_t *entry = &dst_n->inputs[dst_n->input_count++];
        entry->src_node_id = src_node;
        entry->src_port = 0;
        entry->dst_port = 0;
        entry->amount = (amount > 0.0f) ? amount : 1.0f;

        int c = 0;
        while (src_n->name[c] && c < 15) { entry->src_name[c] = src_n->name[c]; c++; }
        entry->src_name[c] = 0;

        dst_n->h = 40 + 35 + (dst_n->input_count * 18) + (dst_n->slider_count * 20) + 15;
    }

    return 0;
}

W_EXPORT void chalk_board_disconnect(int32_t src_node, int32_t dst_node) {
    for (int i = 0; i < g_chalk.link_count; i++) {
        if (g_chalk.links[i].src_node == src_node && g_chalk.links[i].dst_node == dst_node) {
            g_chalk.links[i].active = 0;
        }
    }
}

W_EXPORT void chalk_board_clear(void) {
    g_chalk.link_count = 0;
    for (int i = 0; i < g_chalk.node_count; i++) {
        g_chalk.nodes[i].input_count = 0;
    }
}

W_EXPORT void chalk_board_feed_scope(int32_t node_id, const float *samples, uint32_t count) {
    if (node_id >= 0 && node_id < g_chalk.node_count && samples) {
        chalk_node_t *n = &g_chalk.nodes[node_id];
        uint32_t c = count > 48 ? 48 : count;
        for (uint32_t i = 0; i < c; i++) {
            n->scope_data[i] = samples[i];
        }
    }
}

/* =========================================================================
 * Mouse & Drag Interaction
 * ========================================================================= */

W_EXPORT void chalk_board_mouse_down(int32_t x, int32_t y) {
    g_chalk.mouse_x = x;
    g_chalk.mouse_y = y;

    // Check click on nodes (from top to bottom)
    for (int i = g_chalk.node_count - 1; i >= 0; i--) {
        chalk_node_t *n = &g_chalk.nodes[i];
        if (x >= n->x && x <= n->x + n->w && y >= n->y && y <= n->y + n->h) {
            // Check slider clicks inside node
            int start_s_y = n->y + 24 + 30 + (n->input_count * 18) + 6;
            for (int s = 0; s < n->slider_count; s++) {
                int sy = start_s_y + s * 20;
                if (y >= sy && y <= sy + 16) {
                    g_chalk.drag_mode = 3; // Slider
                    g_chalk.active_node_id = i;
                    g_chalk.active_slider_id = s;

                    int sw = n->w - 24;
                    float rel_x = (float)(x - (n->x + 12)) / (float)sw;
                    n->sliders[s].value = b_clamp(rel_x, 0.0f, 1.0f);
                    return;
                }
            }

            // Check if clicked header/body:
            // Shift click or right side drag = Wire Drag
            if (x >= n->x + n->w - 30 && y >= n->y && y <= n->y + 24) {
                g_chalk.drag_mode = 2; // Wire Drag
                g_chalk.wire_src_node = i;
            } else {
                g_chalk.drag_mode = 1; // Move Node
                g_chalk.active_node_id = i;
                g_chalk.drag_off_x = x - n->x;
                g_chalk.drag_off_y = y - n->y;
            }
            return;
        }
    }
    g_chalk.drag_mode = 0;
}

W_EXPORT int32_t chalk_board_mouse_move(int32_t x, int32_t y, int32_t *out_slot, int32_t *out_param, float *out_val) {
    g_chalk.mouse_x = x;
    g_chalk.mouse_y = y;

    if (g_chalk.drag_mode == 1 && g_chalk.active_node_id >= 0) {
        // Move Node
        chalk_node_t *n = &g_chalk.nodes[g_chalk.active_node_id];
        n->x = x - g_chalk.drag_off_x;
        n->y = y - g_chalk.drag_off_y;
        return 0;
    } else if (g_chalk.drag_mode == 3 && g_chalk.active_node_id >= 0) {
        // Drag Slider
        chalk_node_t *n = &g_chalk.nodes[g_chalk.active_node_id];
        chalk_slider_t *s = &n->sliders[g_chalk.active_slider_id];
        int sw = n->w - 24;
        float rel_x = (float)(x - (n->x + 12)) / (float)sw;
        s->value = b_clamp(rel_x, 0.0f, 1.0f);

        if (out_slot)  *out_slot  = n->slot_id;
        if (out_param) *out_param = s->param_id;
        if (out_val)   *out_val   = s->min_val + s->value * (s->max_val - s->min_val);
        return 1;
    }
    return 0;
}

W_EXPORT int32_t chalk_board_mouse_up(int32_t x, int32_t y, int32_t *out_src_slot, int32_t *out_dst_slot) {
    int connected = 0;
    if (g_chalk.drag_mode == 2 && g_chalk.wire_src_node >= 0) {
        // Find if dropped on another node
        for (int i = 0; i < g_chalk.node_count; i++) {
            if (i == g_chalk.wire_src_node) continue;
            chalk_node_t *n = &g_chalk.nodes[i];
            if (x >= n->x && x <= n->x + n->w && y >= n->y && y <= n->y + n->h) {
                chalk_board_connect(g_chalk.wire_src_node, i, 1.0f, g_chalk.nodes[g_chalk.wire_src_node].chalk_color);
                if (out_src_slot) *out_src_slot = g_chalk.nodes[g_chalk.wire_src_node].slot_id;
                if (out_dst_slot) *out_dst_slot = n->slot_id;
                connected = 1;
                break;
            }
        }
    }

    g_chalk.drag_mode = 0;
    g_chalk.active_node_id = -1;
    g_chalk.wire_src_node = -1;
    return connected;
}

/* =========================================================================
 * Blackboard Full Render Pass (60 FPS)
 * ========================================================================= */

W_EXPORT void chalk_board_render(void) {
    int w = g_chalk.width;
    int h = g_chalk.height;
    uint32_t seed = 0x5a1b3c7d + (g_chalk.anim_frame++);

    // 1. Blackboard Slate Background (Dark Charcoal Slate with Chalk Dust)
    for (int y = 0; y < h; y++) {
        uint32_t *row = &s_chalk_fb[y * w];
        for (int x = 0; x < w; x++) {
            // Subtle chalk grain variation
            uint32_t dust = (chalk_prng(&seed) & 0x07);
            uint8_t base_r = 0x14 + dust;
            uint8_t base_g = 0x1a + dust;
            uint8_t base_b = 0x18 + dust;
            row[x] = 0xFF000000 | (base_b << 16) | (base_g << 8) | base_r;
        }
    }

    // 2. Render Connected Chalk Wires
    for (int i = 0; i < g_chalk.link_count; i++) {
        chalk_link_t *l = &g_chalk.links[i];
        if (!l->active) continue;

        chalk_node_t *src_n = &g_chalk.nodes[l->src_node];
        chalk_node_t *dst_n = &g_chalk.nodes[l->dst_node];

        int x0 = src_n->x + src_n->w / 2;
        int y0 = src_n->y + src_n->h;
        int x1 = dst_n->x + dst_n->w / 2;
        int y1 = dst_n->y;

        chalk_draw_wire(x0, y0, x1, y1, l->chalk_color, &seed);
    }

    // 3. Render Wire being dragged by user
    if (g_chalk.drag_mode == 2 && g_chalk.wire_src_node >= 0) {
        chalk_node_t *src_n = &g_chalk.nodes[g_chalk.wire_src_node];
        int x0 = src_n->x + src_n->w / 2;
        int y0 = src_n->y + src_n->h;
        chalk_draw_wire(x0, y0, g_chalk.mouse_x, g_chalk.mouse_y, src_n->chalk_color, &seed);
    }

    // 4. Render Chalk Node Boxes
    for (int i = 0; i < g_chalk.node_count; i++) {
        chalk_node_t *n = &g_chalk.nodes[i];
        if (!n->active) continue;

        int nx = n->x;
        int ny = n->y;
        int nw = n->w;
        int nh = n->h;

        // Hand-sketched box on blackboard
        chalk_draw_box(nx, ny, nw, nh, n->chalk_color, &seed);

        // Header Title Underline
        chalk_draw_stroke(nx + 6, ny + 22, nx + nw - 6, ny + 22, 1, n->chalk_color, &seed);

        // Mini Chalk Oscilloscope / Waveform Box
        int sc_x = nx + 10;
        int sc_y = ny + 28;
        int sc_w = nw - 20;
        int sc_h = 24;

        // Oscilloscope boundary
        chalk_draw_stroke(sc_x, sc_y, sc_x + sc_w, sc_y, 1, 0x50f1f2f6, &seed);
        chalk_draw_stroke(sc_x, sc_y + sc_h, sc_x + sc_w, sc_y + sc_h, 1, 0x50f1f2f6, &seed);

        int prev_sx = sc_x;
        int prev_sy = sc_y + sc_h / 2;

        for (int s = 0; s < 48 && s < sc_w; s++) {
            int sx = sc_x + (s * sc_w) / 48;
            float val = n->scope_data[s];
            int sy = sc_y + sc_h / 2 - (int)(val * (sc_h / 2 - 2));
            sy = b_clamp(sy, sc_y + 1, sc_y + sc_h - 1);

            chalk_draw_stroke(prev_sx, prev_sy, sx, sy, 1, n->chalk_color, &seed);
            prev_sx = sx;
            prev_sy = sy;
        }

        // 5. Dynamic Received Inputs List (SunVox Tag Style in Chalk)
        int cur_y = sc_y + sc_h + 8;
        for (int in = 0; in < n->input_count; in++) {
            chalk_input_entry_t *entry = &n->inputs[in];
            // Tag border
            chalk_draw_stroke(nx + 10, cur_y, nx + nw - 10, cur_y, 1, 0x80ffeaa7, &seed);
            chalk_draw_stroke(nx + 10, cur_y + 14, nx + nw - 10, cur_y + 14, 1, 0x80ffeaa7, &seed);
            cur_y += 18;
        }

        // 6. Chalk Sliders
        for (int s = 0; s < n->slider_count; s++) {
            int sy = cur_y + s * 20;
            int sx = nx + 12;
            int sw = nw - 24;

            // Slider Track (Chalk line)
            chalk_draw_stroke(sx, sy + 7, sx + sw, sy + 7, 1, 0x80747d8c, &seed);

            // Filled Value (Double chalk line)
            int fill_w = (int)(n->sliders[s].value * (float)sw);
            chalk_draw_stroke(sx, sy + 7, sx + fill_w, sy + 7, 2, n->chalk_color, &seed);

            // Chalk Thumb Tick
            int tx = sx + fill_w;
            chalk_draw_stroke(tx, sy + 2, tx, sy + 12, 2, CHALK_WHITE, &seed);
        }

        // Link Handle (Top & Bottom Chalk Connectors)
        chalk_dab(nx + nw / 2, ny, 4, n->chalk_color, &seed, 230);
        chalk_dab(nx + nw / 2, ny + nh, 4, n->chalk_color, &seed, 230);
    }
}
