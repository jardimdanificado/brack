/**
 * =========================================================================
 * BRACK SunVox / PureData Node Graph Renderer (src/ui/node_graph.c)
 * Rendered using Quadro Engine (Brushes, Anti-Aliasing, SIMD, Vector Curves)
 * =========================================================================
 */

#include "node_graph.h"
#include "brack_dsp.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

static graph_canvas_state_t g_graph = {0};
static uint32_t s_fb[1920 * 1080]; // Full HD Framebuffer support

/* =========================================================================
 * Fast Software Blitting & Drawing Helpers
 * ========================================================================= */

static inline uint32_t graph_blend_pixel(uint32_t src, uint32_t dst) {
    uint32_t sa = (src >> 24) & 0xFF;
    if (sa == 0) return dst;
    if (sa == 255) return src;

    uint32_t inv_sa = 255 - sa;
    uint32_t sr = src & 0xFF, sg = (src >> 8) & 0xFF, sb = (src >> 16) & 0xFF;
    uint32_t dr = dst & 0xFF, dg = (dst >> 8) & 0xFF, db = (dst >> 16) & 0xFF;

    uint32_t r = (sr * sa + dr * inv_sa) / 255;
    uint32_t g = (sg * sa + dg * inv_sa) / 255;
    uint32_t b = (sb * sa + db * inv_sa) / 255;

    return 0xFF000000 | (b << 16) | (g << 8) | r;
}

static void graph_fill_rect(int x0, int y0, int w, int h, uint32_t color) {
    int x1 = x0 + w;
    int y1 = y0 + h;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > g_graph.view_w) x1 = g_graph.view_w;
    if (y1 > g_graph.view_h) y1 = g_graph.view_h;

    for (int y = y0; y < y1; y++) {
        uint32_t *row = &s_fb[y * g_graph.view_w + x0];
        int count = x1 - x0;
        for (int x = 0; x < count; x++) {
            row[x] = graph_blend_pixel(color, row[x]);
        }
    }
}

static void graph_draw_circle_filled(int cx, int cy, int radius, uint32_t color) {
    int r2 = radius * radius;
    int y0 = cy - radius; if (y0 < 0) y0 = 0;
    int y1 = cy + radius; if (y1 >= g_graph.view_h) y1 = g_graph.view_h - 1;

    for (int y = y0; y <= y1; y++) {
        int dy = y - cy;
        int dx_limit = w_isqrt(r2 - dy * dy);
        int x0 = cx - dx_limit; if (x0 < 0) x0 = 0;
        int x1 = cx + dx_limit; if (x1 >= g_graph.view_w) x1 = g_graph.view_w - 1;

        uint32_t *row = &s_fb[y * g_graph.view_w];
        for (int x = x0; x <= x1; x++) {
            row[x] = graph_blend_pixel(color, row[x]);
        }
    }
}

static void graph_draw_line(int x0, int y0, int x1, int y1, int thickness, uint32_t color) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int steps = w_isqrt(dx * dx + dy * dy);
    if (steps <= 0) return;

    int rad = thickness / 2;
    for (int i = 0; i <= steps; i++) {
        int x = x0 + (dx * i) / steps;
        int y = y0 + (dy * i) / steps;
        graph_draw_circle_filled(x, y, rad, color);
    }
}

/**
 * SunVox / PureData Smooth Vertical Flow Bezier Curve
 */
static void graph_draw_wire(int x0, int y0, int x1, int y1, uint32_t color, int is_shadow) {
    int dy = y1 - y0;
    int abs_dy = dy < 0 ? -dy : dy;
    int c_dist = abs_dy / 2;
    if (c_dist < 40) c_dist = 40;

    int cx0 = x0;
    int cy0 = y0 + c_dist;
    int cx1 = x1;
    int cy1 = y1 - c_dist;

    if (is_shadow) {
        y0 += 8; y1 += 8; cy0 += 8; cy1 += 8;
        color = 0x50000000;
    }

    int steps = 32;
    int prev_x = x0;
    int prev_y = y0;

    for (int i = 1; i <= steps; i++) {
        float t = (float)i / (float)steps;
        float it = 1.0f - t;

        // Cubic Bezier
        float px = it*it*it * x0 + 3*it*it*t * cx0 + 3*it*t*t * cx1 + t*t*t * x1;
        float py = it*it*it * y0 + 3*it*it*t * cy0 + 3*it*t*t * cy1 + t*t*t * y1;

        graph_draw_line(prev_x, prev_y, (int)px, (int)py, is_shadow ? 6 : 3, color);
        prev_x = (int)px;
        prev_y = (int)py;
    }

    // Active traveling signal pulse dot (SunVox Style)
    if (!is_shadow) {
        float pulse_t = ((float)((g_graph.anim_tick * 2) % 100)) / 100.0f;
        float it = 1.0f - pulse_t;
        float dot_x = it*it*it * x0 + 3*it*it*pulse_t * cx0 + 3*it*pulse_t*pulse_t * cx1 + pulse_t*pulse_t*pulse_t * x1;
        float dot_y = it*it*it * y0 + 3*it*it*pulse_t * cy0 + 3*it*pulse_t*pulse_t * cy1 + pulse_t*pulse_t*pulse_t * y1;
        graph_draw_circle_filled((int)dot_x, (int)dot_y, 4, 0xFFffffff);
    }
}

/* =========================================================================
 * Category Colors & Palette
 * ========================================================================= */

static uint32_t get_category_color(int category) {
    switch (category) {
        case NODE_CAT_GENERATOR: return 0xFF00d2d3; // Neon Cyan (VCO)
        case NODE_CAT_FILTER:    return 0xFFff9f43; // Tangerine Orange (VCF)
        case NODE_CAT_MODULATOR: return 0xFF9c88ff; // Purple Amethyst (ADSR, LFO)
        case NODE_CAT_CONTROL:   return 0xFFfeca57; // Sun Yellow (Sequencer, Clock)
        case NODE_CAT_EFFECT:    return 0xFF10ac84; // Emerald Green (Delay, Reverb)
        case NODE_CAT_OUTPUT:    return 0xFFff4757; // Ruby Red (Master Out)
        default:                 return 0xFF576574; // Slate Gray
    }
}

/* =========================================================================
 * Public Node Graph API Implementation
 * ========================================================================= */

W_EXPORT void node_graph_init(int32_t width, int32_t height) {
    g_graph.view_w = (width > 0 && width <= 1920) ? width : 1280;
    g_graph.view_h = (height > 0 && height <= 1080) ? height : 720;
    g_graph.cam_x = 0;
    g_graph.cam_y = 0;
    g_graph.zoom = 1.0f;
    g_graph.node_count = 0;
    g_graph.wire_count = 0;
    g_graph.drag_mode = 0;
    g_graph.anim_tick = 0;
}

W_EXPORT uint32_t* node_graph_get_framebuffer(void) {
    return s_fb;
}

W_EXPORT void node_graph_resize(int32_t width, int32_t height) {
    if (width > 0 && width <= 1920) g_graph.view_w = width;
    if (height > 0 && height <= 1080) g_graph.view_h = height;
}

W_EXPORT int32_t node_graph_add_node(int32_t slot_id, const char *name, int32_t category, int32_t x, int32_t y, int32_t w, int32_t h) {
    if (g_graph.node_count >= MAX_GRAPH_NODES) return -1;
    int idx = g_graph.node_count++;
    graph_node_t *node = &g_graph.nodes[idx];
    node->id = idx;
    node->slot_id = slot_id;
    node->category = category;
    node->header_color = get_category_color(category);
    node->x = x;
    node->y = y;
    node->w = (w >= 140) ? w : 170;
    node->h = (h >= 100) ? h : 160;
    node->inlet_count = 0;
    node->outlet_count = 0;
    node->slider_count = 0;
    node->has_scope = 1;
    node->active = 1;

    int c = 0;
    while (name && name[c] && c < 19) { node->name[c] = name[c]; c++; }
    node->name[c] = 0;
    return idx;
}

W_EXPORT void node_graph_add_inlet(int32_t node_id, int32_t port_id, int32_t sig_type, const char *name) {
    if (node_id >= 0 && node_id < g_graph.node_count) {
        graph_node_t *node = &g_graph.nodes[node_id];
        if (node->inlet_count < MAX_GRAPH_INLETS) {
            graph_port_t *p = &node->inlets[node->inlet_count++];
            p->port_id = port_id;
            p->sig_type = sig_type;
            int c = 0;
            while (name && name[c] && c < 7) { p->name[c] = name[c]; c++; }
            p->name[c] = 0;
        }
    }
}

W_EXPORT void node_graph_add_outlet(int32_t node_id, int32_t port_id, int32_t sig_type, const char *name) {
    if (node_id >= 0 && node_id < g_graph.node_count) {
        graph_node_t *node = &g_graph.nodes[node_id];
        if (node->outlet_count < MAX_GRAPH_OUTLETS) {
            graph_port_t *p = &node->outlets[node->outlet_count++];
            p->port_id = port_id;
            p->sig_type = sig_type;
            int c = 0;
            while (name && name[c] && c < 7) { p->name[c] = name[c]; c++; }
            p->name[c] = 0;
        }
    }
}

W_EXPORT int32_t node_graph_add_slider(int32_t node_id, int32_t param_id, const char *name, float def_v, float min_v, float max_v) {
    if (node_id >= 0 && node_id < g_graph.node_count) {
        graph_node_t *node = &g_graph.nodes[node_id];
        if (node->slider_count < MAX_GRAPH_SLIDERS) {
            int s_idx = node->slider_count++;
            graph_slider_t *s = &node->sliders[s_idx];
            s->id = s_idx;
            s->param_id = param_id;
            s->min_val = min_v;
            s->max_val = max_v;
            s->value = (max_v > min_v) ? (def_v - min_v) / (max_v - min_v) : 0.5f;
            int c = 0;
            while (name && name[c] && c < 11) { s->name[c] = name[c]; c++; }
            s->name[c] = 0;

            // Recalculate dynamic height based on sliders and scope
            node->h = 45 + (node->has_scope ? 45 : 0) + node->slider_count * 22 + 20;
            return s_idx;
        }
    }
    return -1;
}

W_EXPORT void node_graph_set_scope_active(int32_t node_id, int32_t active) {
    if (node_id >= 0 && node_id < g_graph.node_count) {
        g_graph.nodes[node_id].has_scope = active;
    }
}

W_EXPORT int32_t node_graph_connect_wire(int32_t src_node, int32_t src_out, int32_t dst_node, int32_t dst_in, uint32_t color) {
    if (g_graph.wire_count >= MAX_GRAPH_WIRES) return -1;
    int idx = g_graph.wire_count++;
    graph_wire_t *w = &g_graph.wires[idx];
    w->src_node = src_node;
    w->src_outlet = src_out;
    w->dst_node = dst_node;
    w->dst_inlet = dst_in;
    w->color = (color != 0) ? color : 0xFF00d2d3;
    w->active = 1;
    return idx;
}

W_EXPORT void node_graph_disconnect_wire(int32_t wire_id) {
    if (wire_id >= 0 && wire_id < g_graph.wire_count) {
        g_graph.wires[wire_id].active = 0;
    }
}

W_EXPORT void node_graph_clear_wires(void) {
    g_graph.wire_count = 0;
}

W_EXPORT void node_graph_feed_scope(int32_t node_id, const float *samples, uint32_t count) {
    if (node_id >= 0 && node_id < g_graph.node_count && samples) {
        graph_node_t *node = &g_graph.nodes[node_id];
        uint32_t n = count > 64 ? 64 : count;
        for (uint32_t i = 0; i < n; i++) {
            node->scope_data[i] = samples[i];
        }
    }
}

/* =========================================================================
 * Mouse & Node Drag Interaction
 * ========================================================================= */

static void get_inlet_pos(graph_node_t *n, int inlet_idx, int *out_x, int *out_y) {
    int count = n->inlet_count;
    int step = n->w / (count + 1);
    *out_x = n->x + step * (inlet_idx + 1);
    *out_y = n->y; // Top edge
}

static void get_outlet_pos(graph_node_t *n, int outlet_idx, int *out_x, int *out_y) {
    int count = n->outlet_count;
    int step = n->w / (count + 1);
    *out_x = n->x + step * (outlet_idx + 1);
    *out_y = n->y + n->h; // Bottom edge
}

W_EXPORT void node_graph_mouse_down(int32_t screen_x, int32_t screen_y, int32_t button) {
    g_graph.mouse_screen_x = screen_x;
    g_graph.mouse_screen_y = screen_y;

    if (button == 2 || button == 1) { // Right or middle click = Pan
        g_graph.drag_mode = 4; // Pan
        return;
    }

    // 1. Check Outlet clicks (Start dragging wire)
    for (int i = 0; i < g_graph.node_count; i++) {
        graph_node_t *n = &g_graph.nodes[i];
        for (int o = 0; o < n->outlet_count; o++) {
            int ox, oy;
            get_outlet_pos(n, o, &ox, &oy);
            int dx = screen_x - ox;
            int dy = screen_y - oy;
            if (dx * dx + dy * dy <= 10 * 10) {
                g_graph.drag_mode = 2; // Wire Drag
                g_graph.wire_src_node = i;
                g_graph.wire_src_outlet = o;
                return;
            }
        }
    }

    // 2. Check Node Slider clicks
    for (int i = g_graph.node_count - 1; i >= 0; i--) {
        graph_node_t *n = &g_graph.nodes[i];
        if (screen_x >= n->x && screen_x <= n->x + n->w && screen_y >= n->y && screen_y <= n->y + n->h) {
            int start_y = n->y + 28 + (n->has_scope ? 45 : 0) + 6;
            for (int s = 0; s < n->slider_count; s++) {
                int sy = start_y + s * 22;
                if (screen_y >= sy && screen_y <= sy + 18) {
                    g_graph.drag_mode = 3; // Slider Drag
                    g_graph.active_node_id = i;
                    g_graph.active_slider_id = s;
                    // Immediately update slider value
                    int slider_w = n->w - 24;
                    float rel_x = (float)(screen_x - (n->x + 12)) / (float)slider_w;
                    n->sliders[s].value = b_clamp(rel_x, 0.0f, 1.0f);
                    return;
                }
            }

            // Clicked node body: Move Node
            g_graph.drag_mode = 1; // Node Drag
            g_graph.active_node_id = i;
            g_graph.drag_offset_x = screen_x - n->x;
            g_graph.drag_offset_y = screen_y - n->y;
            return;
        }
    }

    // Clicked empty canvas: Pan
    g_graph.drag_mode = 4; // Pan
}

W_EXPORT int32_t node_graph_mouse_move(int32_t screen_x, int32_t screen_y, int32_t *out_node_id, int32_t *out_param_id, float *out_val) {
    int dx = screen_x - g_graph.mouse_screen_x;
    int dy = screen_y - g_graph.mouse_screen_y;
    g_graph.mouse_screen_x = screen_x;
    g_graph.mouse_screen_y = screen_y;

    if (g_graph.drag_mode == 1 && g_graph.active_node_id >= 0) {
        // Move Node
        graph_node_t *n = &g_graph.nodes[g_graph.active_node_id];
        n->x = screen_x - g_graph.drag_offset_x;
        n->y = screen_y - g_graph.drag_offset_y;
        return 0;
    } else if (g_graph.drag_mode == 3 && g_graph.active_node_id >= 0) {
        // Drag Slider
        graph_node_t *n = &g_graph.nodes[g_graph.active_node_id];
        graph_slider_t *s = &n->sliders[g_graph.active_slider_id];
        int slider_w = n->w - 24;
        float rel_x = (float)(screen_x - (n->x + 12)) / (float)slider_w;
        s->value = b_clamp(rel_x, 0.0f, 1.0f);

        if (out_node_id) *out_node_id = n->slot_id;
        if (out_param_id) *out_param_id = s->param_id;
        if (out_val) *out_val = s->min_val + s->value * (s->max_val - s->min_val);
        return 1;
    } else if (g_graph.drag_mode == 4) {
        // Pan Canvas
        g_graph.cam_x += dx;
        g_graph.cam_y += dy;
        return 0;
    }
    return 0;
}

W_EXPORT int32_t node_graph_mouse_up(int32_t screen_x, int32_t screen_y, int32_t *out_src_node, int32_t *out_src_out, int32_t *out_dst_node, int32_t *out_dst_in) {
    int connected = 0;
    if (g_graph.drag_mode == 2 && g_graph.wire_src_node >= 0) {
        // Check if dropped onto an Inlet
        for (int i = 0; i < g_graph.node_count; i++) {
            if (i == g_graph.wire_src_node) continue;
            graph_node_t *n = &g_graph.nodes[i];
            for (int in = 0; in < n->inlet_count; in++) {
                int ix, iy;
                get_inlet_pos(n, in, &ix, &iy);
                int dx = screen_x - ix;
                int dy = screen_y - iy;
                if (dx * dx + dy * dy <= 12 * 12) {
                    // Connect Wire
                    uint32_t color = get_category_color(g_graph.nodes[g_graph.wire_src_node].category);
                    node_graph_connect_wire(g_graph.wire_src_node, g_graph.wire_src_outlet, i, in, color);

                    if (out_src_node) *out_src_node = g_graph.nodes[g_graph.wire_src_node].slot_id;
                    if (out_src_out)  *out_src_out  = g_graph.nodes[g_graph.wire_src_node].outlets[g_graph.wire_src_outlet].port_id;
                    if (out_dst_node) *out_dst_node = n->slot_id;
                    if (out_dst_in)   *out_dst_in   = n->inlets[in].port_id;
                    connected = 1;
                    break;
                }
            }
            if (connected) break;
        }
    }

    g_graph.drag_mode = 0;
    g_graph.active_node_id = -1;
    g_graph.wire_src_node = -1;
    return connected;
}

/* =========================================================================
 * Full SunVox / PureData Frame Rendering (Quadro Vector & Shading)
 * ========================================================================= */

W_EXPORT void node_graph_render(void) {
    int w = g_graph.view_w;
    int h = g_graph.view_h;
    g_graph.anim_tick++;

    // 1. Technical Dark Blueprint Grid Background
    graph_fill_rect(0, 0, w, h, 0xFF0c0e14);

    // Subtle grid dots
    const int grid_size = 24;
    for (int y = (g_graph.cam_y % grid_size); y < h; y += grid_size) {
        for (int x = (g_graph.cam_x % grid_size); x < w; x += grid_size) {
            s_fb[y * w + x] = 0xFF1b1f2b;
        }
    }

    // 2. Render Connected Wires (First Shadows, then Neon Vector Cables)
    for (int pass = 0; pass < 2; pass++) {
        for (int i = 0; i < g_graph.wire_count; i++) {
            graph_wire_t *wire = &g_graph.wires[i];
            if (!wire->active) continue;

            graph_node_t *src_n = &g_graph.nodes[wire->src_node];
            graph_node_t *dst_n = &g_graph.nodes[wire->dst_node];

            int x0, y0, x1, y1;
            get_outlet_pos(src_n, wire->src_outlet, &x0, &y0);
            get_inlet_pos(dst_n, wire->dst_inlet, &x1, &y1);

            graph_draw_wire(x0, y0, x1, y1, wire->color, pass == 0);
        }
    }

    // 3. Render Currently Dragged Wire
    if (g_graph.drag_mode == 2 && g_graph.wire_src_node >= 0) {
        graph_node_t *src_n = &g_graph.nodes[g_graph.wire_src_node];
        int x0, y0;
        get_outlet_pos(src_n, g_graph.wire_src_outlet, &x0, &y0);
        graph_draw_wire(x0, y0, g_graph.mouse_screen_x, g_graph.mouse_screen_y, 0xFF00d2d3, 0);
    }

    // 4. Render SunVox Node Boxes
    for (int i = 0; i < g_graph.node_count; i++) {
        graph_node_t *n = &g_graph.nodes[i];
        if (!n->active) continue;

        int nx = n->x;
        int ny = n->y;
        int nw = n->w;
        int nh = n->h;

        // Drop shadow for node box
        graph_fill_rect(nx + 4, ny + 6, nw, nh, 0x70000000);

        // Node Body (Dark Acrylic Panel)
        graph_fill_rect(nx, ny, nw, nh, 0xFF161922);
        
        // Node Outer Border
        graph_fill_rect(nx, ny, nw, 1, 0xFF2d3244);
        graph_fill_rect(nx, ny + nh - 1, nw, 1, 0xFF2d3244);
        graph_fill_rect(nx, ny, 1, nh, 0xFF2d3244);
        graph_fill_rect(nx + nw - 1, ny, 1, nh, 0xFF2d3244);

        // Category Colored Title Header Bar
        graph_fill_rect(nx + 1, ny + 1, nw - 2, 22, n->header_color);
        graph_fill_rect(nx + 1, ny + 23, nw - 2, 1, 0xFF000000);

        // Mini Display / Oscilloscope Window inside Node
        if (n->has_scope) {
            int sc_x = nx + 8;
            int sc_y = ny + 28;
            int sc_w = nw - 16;
            int sc_h = 36;

            graph_fill_rect(sc_x, sc_y, sc_w, sc_h, 0xFF08090d);
            graph_fill_rect(sc_x, sc_y + sc_h / 2, sc_w, 1, 0xFF141720); // Center line

            int prev_px = sc_x;
            int prev_py = sc_y + sc_h / 2;

            for (int s = 0; s < 64 && s < sc_w; s++) {
                int px = sc_x + (s * sc_w) / 64;
                float val = n->scope_data[s];
                int py = sc_y + sc_h / 2 - (int)(val * (sc_h / 2 - 2));
                py = b_clamp(py, sc_y + 1, sc_y + sc_h - 2);

                graph_draw_line(prev_px, prev_py, px, py, 1, n->header_color);
                prev_px = px;
                prev_py = py;
            }
        }

        // Sliders
        int start_slider_y = ny + 28 + (n->has_scope ? 45 : 0) + 6;
        for (int s = 0; s < n->slider_count; s++) {
            int sy = start_slider_y + s * 22;
            int sx = nx + 10;
            int sw = nw - 20;

            // Slider track
            graph_fill_rect(sx, sy + 3, sw, 12, 0xFF0d0f14);
            
            // Slider fill bar
            int fill_w = (int)(n->sliders[s].value * (float)sw);
            graph_fill_rect(sx, sy + 3, fill_w, 12, 0x8034495e);

            // Slider thumb indicator
            int thumb_x = sx + fill_w;
            graph_fill_rect(thumb_x - 2, sy + 1, 4, 16, n->header_color);
        }

        // 5. Inlets (Top Sockets)
        for (int in = 0; in < n->inlet_count; in++) {
            int ix, iy;
            get_inlet_pos(n, in, &ix, &iy);
            graph_draw_circle_filled(ix, iy, 5, 0xFF2d3436);
            graph_draw_circle_filled(ix, iy, 3, 0xFF00d2d3); // Cyan Inlet
        }

        // 6. Outlets (Bottom Sockets)
        for (int out = 0; out < n->outlet_count; out++) {
            int ox, oy;
            get_outlet_pos(n, out, &ox, &oy);
            graph_draw_circle_filled(ox, oy, 5, 0xFF2d3436);
            graph_draw_circle_filled(ox, oy, 3, 0xFFff9f43); // Orange Outlet
        }
    }
}
