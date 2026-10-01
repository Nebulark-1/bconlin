<?php
/**
 * Plugin Name: Firm Operations
 * Description: Illustrative sketch written for this site - not the firm's
 *              code. It shows the WordPress extension points an intranet
 *              plugin is built from: a custom content type with its own
 *              capabilities, a shortcode form, a nonce-checked handler, and
 *              a REST route.
 */

// The operations manual: procedures are their own post type with their own
// capabilities, so only operations staff can edit what everyone can read.
function ops_register_manual() {
    register_post_type('procedure', [
        'label'           => 'Operations Manual',
        'public'          => false,
        'show_ui'         => true,
        'show_in_rest'    => true,
        'has_archive'     => false,
        'supports'        => ['title', 'editor', 'revisions'],
        'capability_type' => ['procedure', 'procedures'],
        'map_meta_cap'    => true,
    ]);
    register_taxonomy('department', 'procedure', ['hierarchical' => true, 'show_in_rest' => true]);
    register_post_type('pto_request', ['label' => 'PTO Requests', 'public' => false, 'show_ui' => true,
                                       'supports' => ['title', 'author']]);
}
add_action('init', 'ops_register_manual');

// Roles mirror the firm: everyone reads the manual, operations maintains it.
function ops_roles() {
    add_role('paralegal', 'Paralegal', ['read' => true, 'read_procedure' => true]);
    $ops = get_role('administrator');
    foreach (['edit_procedures', 'publish_procedures', 'delete_procedures'] as $cap) {
        $ops->add_cap($cap);
    }
}
register_activation_hook(__FILE__, 'ops_roles');

// [pto_request] renders the form anywhere on the intranet.
function ops_pto_form() {
    if (!is_user_logged_in()) return '';
    ob_start(); ?>
    <form method="post" action="<?= esc_url(admin_url('admin-post.php')) ?>">
        <input type="hidden" name="action" value="ops_pto">
        <?php wp_nonce_field('ops_pto'); ?>
        <label>From <input type="date" name="from" required></label>
        <label>To <input type="date" name="to" required></label>
        <button>Request time off</button>
    </form>
    <?php return ob_get_clean();
}
add_shortcode('pto_request', 'ops_pto_form');

function ops_pto_submit() {
    check_admin_referer('ops_pto');                       // CSRF
    $from = sanitize_text_field($_POST['from'] ?? '');
    $to   = sanitize_text_field($_POST['to'] ?? '');
    $id = wp_insert_post([
        'post_type'   => 'pto_request',
        'post_status' => 'pending',
        'post_author' => get_current_user_id(),
        'post_title'  => wp_get_current_user()->display_name . " · $from → $to",
    ]);
    do_action('ops_pto_requested', $id);                  // notifies the approver
    wp_safe_redirect(add_query_arg('pto', 'sent', wp_get_referer()));
    exit;
}
add_action('admin_post_ops_pto', 'ops_pto_submit');

// The dashboard's tiles read live numbers over a REST route, scoped by role.
function ops_rest_routes() {
    register_rest_route('ops/v1', '/my-week', [
        'methods'             => 'GET',
        'permission_callback' => fn() => is_user_logged_in(),
        'callback'            => fn() => [
            'pto_pending' => count(get_posts(['post_type' => 'pto_request', 'post_status' => 'pending',
                                              'author' => get_current_user_id(), 'fields' => 'ids'])),
            'manual_updated' => get_lastpostmodified('server', 'procedure'),
        ],
    ]);
}
add_action('rest_api_init', 'ops_rest_routes');
