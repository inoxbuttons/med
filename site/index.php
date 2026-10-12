<?php
session_start();
require_once __DIR__ . '/auth_config.php';

// Выход
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// Всегда отдаём index1.html с инжекцией PHP-переменных (авторизация отключена)
$html = file_get_contents(__DIR__ . '/index1.html');
$inject = '<script>' .
    'var PHP_SESSION_ID   = ' . json_encode(session_id()) . ';' .
    'var PHP_CLIENT_ID    = ' . json_encode(AUTH_CLIENT_ID) . ';' .
    'var PHP_CLINIC_NET_ID = ' . json_encode(AUTH_CLINIC_NET_ID) . ';' .
'</script>';
echo str_replace('<head>', '<head>' . $inject, $html);
