var adminToken = null;

function testApi(url, resId) {
  var box = document.getElementById(resId);
  box.style.display = 'block';
  box.textContent = 'جاري التحميل...';
  box.style.color = '#68d391';
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(j) { box.textContent = JSON.stringify(j, null, 2); })
    .catch(function(e) {
      box.textContent = 'خطأ: ' + e.message;
      box.style.color = '#fc8181';
    });
}

function testLogin() {
  var box = document.getElementById('res4');
  box.style.display = 'block';
  box.textContent = 'جاري التحميل...';
  box.style.color = '#68d391';
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tourist@example.com', password: 'Password123!' })
  })
    .then(function(r) { return r.json(); })
    .then(function(j) { box.textContent = JSON.stringify(j, null, 2); })
    .catch(function(e) {
      box.textContent = 'خطأ: ' + e.message;
      box.style.color = '#fc8181';
    });
}

function testAdminStats() {
  var box = document.getElementById('res6');
  box.style.display = 'block';
  box.textContent = 'جاري تسجيل الدخول كـ Admin...';
  box.style.color = '#68d391';
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@omanexplorer.com', password: 'Password123!' })
  })
    .then(function(r) { return r.json(); })
    .then(function(loginData) {
      adminToken = loginData.data.accessToken;
      return fetch('/api/users/admin/stats', {
        headers: { 'Authorization': 'Bearer ' + adminToken }
      });
    })
    .then(function(r) { return r.json(); })
    .then(function(stats) { box.textContent = JSON.stringify(stats, null, 2); })
    .catch(function(e) {
      box.textContent = 'خطأ: ' + e.message;
      box.style.color = '#fc8181';
    });
}

function checkHealth() {
  var dot  = document.getElementById('statusDot');
  var text = document.getElementById('statusText');
  fetch('/health')
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (j.status === 'ok') {
        dot.className = 'dot green';
        text.textContent = 'الخادم يعمل — ' + new Date(j.timestamp).toLocaleTimeString('ar');
      }
    })
    .catch(function() {
      dot.className = 'dot red';
      text.textContent = 'الخادم لا يستجيب';
    });
}

function loadTours() {
  var list = document.getElementById('tourList');
  fetch('/api/tours')
    .then(function(r) { return r.json(); })
    .then(function(j) {
      list.innerHTML = j.data.tours.map(function(t) {
        return '<div class="tour-item">' +
          '<div>' +
            '<h3>' + t.title + '</h3>' +
            '<p>📍 ' + t.location + ' &nbsp;|&nbsp; ⏱ ' + t.duration_days + ' يوم &nbsp;|&nbsp; 👥 ' + t.max_participants + ' شخص &nbsp;|&nbsp; ' + t.category + '</p>' +
          '</div>' +
          '<div class="price-badge">$' + t.price + '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      list.textContent = 'تعذّر تحميل الجولات';
    });
}

window.onload = function() {
  checkHealth();
  loadTours();
  setInterval(checkHealth, 30000);
};
