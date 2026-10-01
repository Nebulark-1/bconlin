<?php
// Illustrative sketch written for this site - not the firm's code. It shows
// the techniques a dashboard login layer like the real one needs: password
// verification, concurrent sessions (one row per device, each refreshable or
// revocable on its own), and access decided by role, with role following title.

const SESSION_TTL = 8 * 3600;        // sliding: refreshed on every request
const MAX_SESSIONS_PER_USER = 5;

const ROLE_BY_TITLE = [
    'Managing Partner' => 'partner',
    'Partner'          => 'partner',
    'Firm Manager'     => 'manager',
    'Operations'       => 'manager',
    'Associate'        => 'attorney',
    'Of Counsel'       => 'attorney',
];

function sign_in(PDO $db, string $email, string $password): ?string {
    $user = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $user->execute([$email]);
    $row = $user->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        return null;                  // same answer for unknown email and wrong password
    }

    // Concurrent sessions: keep the newest few, drop the oldest beyond the cap.
    $db->prepare('DELETE FROM sessions WHERE user_id = ? AND id NOT IN (
                      SELECT id FROM sessions WHERE user_id = ? ORDER BY last_seen DESC LIMIT ?)')
       ->execute([$row['id'], $row['id'], MAX_SESSIONS_PER_USER - 1]);

    $token = bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO sessions (user_id, token_hash, user_agent, expires_at)
                  VALUES (?, ?, ?, ?)')
       ->execute([$row['id'], hash('sha256', $token), $_SERVER['HTTP_USER_AGENT'] ?? '',
                  date('c', time() + SESSION_TTL)]);
    return $token;                    // stored client-side; only its hash lives in the DB
}

function current_user(PDO $db, ?string $token): ?array {
    if (!$token) return null;
    $q = $db->prepare('SELECT u.*, s.id AS session_id FROM sessions s
                       JOIN users u ON u.id = s.user_id
                       WHERE s.token_hash = ? AND s.expires_at > ?');
    $q->execute([hash('sha256', $token), date('c')]);
    $user = $q->fetch() ?: null;
    if ($user) {
        $db->prepare('UPDATE sessions SET last_seen = CURRENT_TIMESTAMP, expires_at = ? WHERE id = ?')
           ->execute([date('c', time() + SESSION_TTL), $user['session_id']]);
    }
    return $user;
}

function require_role(?array $user, string ...$allowed): array {
    if (!$user) {
        http_response_code(401);
        exit;
    }
    $role = $user['role'] ?? (ROLE_BY_TITLE[$user['title'] ?? ''] ?? 'staff');
    if (!in_array($role, $allowed, true)) {
        http_response_code(403);
        exit;
    }
    return $user + ['role' => $role];
}
