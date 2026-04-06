<?php
session_start();
require_once __DIR__ . '/auth_config.php';

// Выход
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// Обработка формы входа
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login   = trim($_POST['login'] ?? '');
    $passMd5 = trim($_POST['password_md5'] ?? '');
    if ($login === AUTH_LOGIN && $passMd5 === AUTH_PASS_MD5) {
        $_SESSION['auth'] = true;
        header('Location: index.php');
        exit;
    }
    $error = 'Неверный логин или пароль';
}

// Авторизованным — отдаём index.html с инжекцией PHP-переменных
if (!empty($_SESSION['auth'])) {
    $html = file_get_contents(__DIR__ . '/index.html');
    $inject = '<script>' .
        'var PHP_SESSION_ID   = ' . json_encode(session_id()) . ';' .
        'var PHP_CLIENT_ID    = ' . json_encode(AUTH_CLIENT_ID) . ';' .
        'var PHP_CLINIC_NET_ID = ' . json_encode(AUTH_CLINIC_NET_ID) . ';' .
    '</script>';
    echo str_replace('<head>', '<head>' . $inject, $html);
    exit;
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.19.0/js/md5.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f4f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.1);
      padding: 40px 36px;
      width: 100%;
      max-width: 360px;
    }

    .card h1 {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 28px;
      text-align: center;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }

    .field label {
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }

    .field input {
      border: 1.5px solid #d0d7de;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 15px;
      outline: none;
      transition: border-color .2s;
    }

    .field input:focus { border-color: #2493f9; }

    .error {
      background: #fff0f0;
      color: #c0392b;
      border: 1px solid #f5c6c6;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      margin-bottom: 16px;
      text-align: center;
    }

    button[type="submit"] {
      width: 100%;
      background: #2493f9;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
      transition: background .2s;
    }

    button[type="submit"]:hover { background: #0385d1; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Вход в систему</h1>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST" onsubmit="return hashPassword()">
      <div class="field">
        <label for="login">Логин</label>
        <input type="text" id="login" name="login" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="pwd">Пароль</label>
        <input type="password" id="pwd" autocomplete="current-password" required>
      </div>
      <input type="hidden" name="password_md5" id="pwdMd5">
      <button type="submit">Войти</button>
    </form>
  </div>

  <script>
    function hashPassword() {
      var pwd = document.getElementById('pwd').value;
      document.getElementById('pwdMd5').value = md5(pwd);
      document.getElementById('pwd').value = '';
      return true;
    }
  </script>
</body>
</html>
