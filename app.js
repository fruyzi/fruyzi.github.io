
const firebaseConfig = {
  apiKey: "AIzaSyBh6Qw5BTfsfSaKYiQN6rD68D_ryqGzZ9k",
  authDomain: "site-be901.firebaseapp.com",
  databaseURL: "https://site-be901-default-rtdb.firebaseio.com",
  projectId: "site-be901",
  storageBucket: "site-be901.firebasestorage.app",
  messagingSenderId: "516530894177",
  appId: "1:516530894177:web:b84b2b3ceab87e2d5c8120",
  measurementId: "G-ZPW5BBKV4S"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== ГЛОБАЛЬНОЕ СОСТОЯНИЕ =====
let currentUser = null;
let userData = null;
let cart = [];
let products = [];
let currentCategory = 'all';
let currentPage = 'home';
let allOrders = [];
let allUsers = [];

// ===== РОУТИНГ =====
function router(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');
    window.scrollTo(0, 0);

    switch(page) {
        case 'home': renderHome(); break;
        case 'catalog': renderCatalog(); break;
        case 'cart': renderCart(); break;
        case 'profile': renderProfile(); break;
        case 'orders': renderOrders(); break;
        case 'eco-impact': renderEcoImpact(); break;
        case 'admin': renderAdmin(); break;
    }
}

// ===== АВТОРИЗАЦИЯ =====
function openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-message').style.display = 'none';
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

function showAuthMessage(text, type) {
    const msg = document.getElementById('auth-message');
    msg.textContent = text;
    msg.className = 'message ' + (type || '');
    msg.style.display = text ? 'block' : 'none';
}

function logout() {
    auth.signOut();
    cart = [];
    updateCartCount();
    router('home');
}

function toggleUserDropdown() {
    document.getElementById('user-dropdown').classList.toggle('hidden');
}

// ===== ТОСТЫ =====
function toast(message, type) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.innerHTML = type === 'error' ? '❌ ' + message : '✅ ' + message;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ===== ПРОДУКТЫ =====
function getProductsRef() {
    return db.collection('products');
}

function loadProducts() {
    getProductsRef().onSnapshot(snapshot => {
        products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        if (currentPage === 'home') renderHome();
        if (currentPage === 'catalog') renderCatalog();
        if (currentPage === 'admin') renderAdminProducts();
    });
}

function renderProductCard(p, featured) {
    const img = p.image && p.image.startsWith('http') 
        ? '<img src="' + p.image + '" alt="' + escapeHtml(p.name) + '">'
        : (p.image || '🌿');
    const ecoBadge = p.co2Saved > 0 ? '<span class="product-eco-badge">♻️ ' + p.co2Saved + ' кг CO₂</span>' : '';
    return `
        <div class="product-card" onclick="showProductDetail('${p.id}')">
            <div class="product-image">${img}${ecoBadge}</div>
            <div class="product-info">
                <div class="product-title">${escapeHtml(p.name)}</div>
                <div class="product-desc">${escapeHtml(p.description || '')}</div>
                <div class="product-footer">
                    <div>
                        <div class="product-price">${p.price} ₽</div>
                        <div class="product-points">+${p.price} 🌱</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); addToCart('${p.id}')">В корзину</button>
                </div>
            </div>
        </div>
    `;
}

function renderHome() {
    const featured = products.filter(p => p.active !== false).slice(0, 4);
    document.getElementById('featured-products').innerHTML = featured.map(p => renderProductCard(p, true)).join('');

    // Статистика
    db.collection('stats').doc('global').get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            animateNum('stat-products', d.products || products.length);
            animateNum('stat-trees', d.trees || 0);
            animateNum('stat-users', d.users || 0);
        }
    }).catch(() => {
        animateNum('stat-products', products.length);
    });
}

function renderCatalog() {
    const filtered = currentCategory === 'all' 
        ? products.filter(p => p.active !== false)
        : products.filter(p => p.category === currentCategory && p.active !== false);

    const container = document.getElementById('catalog-products');
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">🔍</div><h2>Ничего не найдено</h2></div>';
        return;
    }
    container.innerHTML = filtered.map(p => renderProductCard(p)).join('');
}

function showProductDetail(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const img = p.image && p.image.startsWith('http')
        ? '<img src="' + p.image + '" alt="' + escapeHtml(p.name) + '">'
        : (p.image || '🌿');

    document.getElementById('product-detail').innerHTML = `
        <div class="product-detail-image">${img}</div>
        <div class="product-detail-info">
            <div style="margin-bottom:10px;">
                <span class="priority-badge ${p.category}">${getCategoryLabel(p.category)}</span>
            </div>
            <h1>${escapeHtml(p.name)}</h1>
            <div class="product-detail-price">${p.price} ₽</div>
            <div class="product-detail-desc">${escapeHtml(p.description || '')}</div>
            <div class="product-detail-meta">
                <div><span>Эко-влияние:</span><span>♻️ ${p.co2Saved || 0} кг CO₂ предотвращено</span></div>
                <div><span>ЭкоБаллов:</span><span>+${p.price} 🌱</span></div>
                <div><span>Артикул:</span><span>ECO-${p.id.slice(-6).toUpperCase()}</span></div>
            </div>
            <div class="quantity-selector">
                <button onclick="changeQty(-1)">−</button>
                <span id="detail-qty">1</span>
                <button onclick="changeQty(1)">+</button>
            </div>
            <button class="btn btn-primary btn-lg btn-full" onclick="addToCartFromDetail('${p.id}')">
                🛒 Добавить в корзину
            </button>
            <button class="btn btn-secondary btn-full" style="margin-top:10px;" onclick="router('catalog')">
                ← Назад в каталог
            </button>
        </div>
    `;
    router('product');
}

let detailQty = 1;
function changeQty(delta) {
    detailQty = Math.max(1, detailQty + delta);
    const el = document.getElementById('detail-qty');
    if (el) el.textContent = detailQty;
}

function addToCartFromDetail(id) {
    for (let i = 0; i < detailQty; i++) addToCart(id);
    detailQty = 1;
}

function addToCart(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    cart.push({ ...p, cartId: Date.now() + Math.random() });
    updateCartCount();
    toast(p.name + ' добавлен в корзину!');
}

function removeFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    renderCart();
    updateCartCount();
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.length;
}

function renderCart() {
    if (cart.length === 0) {
        document.getElementById('cart-content').classList.add('hidden');
        document.getElementById('cart-empty').classList.remove('hidden');
        return;
    }
    document.getElementById('cart-content').classList.remove('hidden');
    document.getElementById('cart-empty').classList.add('hidden');

    let total = 0;
    document.getElementById('cart-items').innerHTML = cart.map(item => {
        total += item.price;
        const img = item.image && item.image.startsWith('http')
            ? '<img src="' + item.image + '">'
            : (item.image || '🌿');
        return `
            <div class="cart-item">
                <div class="cart-item-image">${img}</div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${item.price} ₽</div>
                </div>
                <div class="cart-item-actions">
                    <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.cartId}')">Удалить</button>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('cart-subtotal').textContent = total + ' ₽';
    document.getElementById('cart-points').textContent = total;
    document.getElementById('cart-total').textContent = total + ' ₽';
}

function checkout() {
    if (!currentUser) { openAuthModal(); return; }
    if (cart.length === 0) { toast('Корзина пуста!', 'error'); return; }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const order = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price })),
        total: total,
        pointsEarned: total,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('orders').add(order).then(() => {
        // Начисляем баллы
        const userRef = db.collection('users').doc(currentUser.uid);
        userRef.update({
            points: firebase.firestore.FieldValue.increment(total),
            ordersCount: firebase.firestore.FieldValue.increment(1)
        });

        // Обновляем глобальную статистику
        const statsRef = db.collection('stats').doc('global');
        statsRef.update({
            orders: firebase.firestore.FieldValue.increment(1),
            revenue: firebase.firestore.FieldValue.increment(total),
            co2Saved: firebase.firestore.FieldValue.increment(cart.reduce((s, i) => s + (i.co2Saved || 0), 0))
        });

        cart = [];
        updateCartCount();
        toast('Заказ оформлен! +' + total + ' 🌱');
        router('orders');
    });
}

// ===== ПРОФИЛЬ =====
function renderProfile() {
    if (!userData) return;
    document.getElementById('profile-name').textContent = userData.name || 'Эко-покупатель';
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-points').textContent = userData.points || 0;
    document.getElementById('profile-trees').textContent = userData.trees || 0;
    document.getElementById('profile-orders').textContent = userData.ordersCount || 0;
    document.getElementById('nav-points').innerHTML = '🌱 ' + (userData.points || 0);

    const forest = document.getElementById('user-forest');
    const trees = userData.trees || 0;
    if (trees > 0) {
        forest.innerHTML = '';
        for (let i = 0; i < trees; i++) {
            forest.innerHTML += '<span class="tree">🌳</span>';
        }
    } else {
        forest.innerHTML = '<p class="forest-empty">Пока нет деревьев. Накопите 500 ЭкоБаллов, чтобы посадить первое!</p>';
    }

    const btn = document.getElementById('plant-tree-btn');
    btn.disabled = (userData.points || 0) < 500;
    if (btn.disabled) {
        btn.textContent = '🌳 Нужно 500 🌱 (у вас ' + (userData.points || 0) + ')';
    } else {
        btn.textContent = '🌳 Посадить дерево (500 🌱)';
    }
}

function plantTree() {
    if (!userData || (userData.points || 0) < 500) return;

    db.collection('users').doc(currentUser.uid).update({
        points: firebase.firestore.FieldValue.increment(-500),
        trees: firebase.firestore.FieldValue.increment(1)
    }).then(() => {
        db.collection('stats').doc('global').update({
            trees: firebase.firestore.FieldValue.increment(1)
        });
        toast('🌳 Дерево посажено! Спасибо за заботу о планете!');
    });
}

// ===== ЗАКАЗЫ =====
function renderOrders() {
    if (!currentUser) { router('home'); return; }
    const list = document.getElementById('orders-list');
    list.innerHTML = '<div class="loading" style="text-align:center;padding:40px;">Загрузка...</div>';

    db.collection('orders')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                list.innerHTML = '<div class="empty-state"><div class="emoji">📦</div><h2>Нет заказов</h2><p>Сделайте первый заказ в каталоге!</p></div>';
                return;
            }
            list.innerHTML = snapshot.docs.map(doc => {
                const o = doc.data();
                const date = o.createdAt ? o.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
                const statusLabels = {
                    pending: '⏳ Ожидает',
                    processing: '🔧 В обработке',
                    shipped: '🚚 Отправлен',
                    delivered: '✅ Доставлен',
                    cancelled: '❌ Отменён'
                };
                return `
                    <div class="order-card">
                        <div class="order-header">
                            <div><strong>Заказ #${doc.id.slice(-6).toUpperCase()}</strong> · ${date}</div>
                            <span class="order-status status-${o.status}">${statusLabels[o.status] || o.status}</span>
                        </div>
                        <div class="order-items">
                            ${o.items.map(i => `<div class="order-item-row"><span>${escapeHtml(i.name)}</span><span>${i.price} ₽</span></div>`).join('')}
                        </div>
                        <div class="order-total">Итого: ${o.total} ₽ · +${o.pointsEarned} 🌱</div>
                    </div>
                `;
            }).join('');
        });
}

// ===== ЭКО-ВЛИЯНИЕ =====
function renderEcoImpact() {
    db.collection('stats').doc('global').get().then(doc => {
        const d = doc.exists ? doc.data() : {};
        animateNum('impact-trees', d.trees || 0);
        animateNum('impact-plastic', Math.round((d.co2Saved || 0) * 2.5));
        animateNum('impact-water', Math.round((d.co2Saved || 0) * 150));
        animateNum('impact-co2', Math.round(d.co2Saved || 0));
    });

    // Лидерборд
    db.collection('users').orderBy('trees', 'desc').limit(10).get().then(snapshot => {
        const users = snapshot.docs.map((doc, i) => ({ ...doc.data(), rank: i + 1 }));
        document.getElementById('leaderboard').innerHTML = users.map((u, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${rankClass}">${u.rank}</div>
                    <div class="leaderboard-name">${escapeHtml(u.name || 'Аноним')}</div>
                    <div class="leaderboard-score">${u.trees || 0} 🌳 · ${u.points || 0} 🌱</div>
                </div>
            `;
        }).join('');
    });
}

// ===== АДМИН-ПАНЕЛЬ =====
function renderAdmin() {
    if (!userData || !userData.isAdmin) { router('home'); return; }
    showAdminTab('products');
    renderAdminProducts();
    renderAdminOrders();
    renderAdminUsers();
    renderAdminStats();
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById('admin-tab-' + tab).classList.remove('hidden');
    document.querySelectorAll('.admin-sidebar nav a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');
}

function renderAdminProducts() {
    const tbody = document.querySelector('#admin-products-table tbody');
    tbody.innerHTML = products.map(p => {
        const img = p.image && p.image.startsWith('http') 
            ? '<img src="' + p.image + '">'
            : (p.image || '🌿');
        return `
            <tr>
                <td>${img}</td>
                <td>${escapeHtml(p.name)}</td>
                <td>${getCategoryLabel(p.category)}</td>
                <td>${p.price} ₽</td>
                <td>${p.active !== false ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAdminOrders() {
    db.collection('orders').orderBy('createdAt', 'desc').get().then(snapshot => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.querySelector('#admin-orders-table tbody');
        tbody.innerHTML = allOrders.map(o => {
            const date = o.createdAt ? o.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
            const statusOpts = ['pending','processing','shipped','delivered','cancelled'];
            return `
                <tr>
                    <td>#${o.id.slice(-6).toUpperCase()}</td>
                    <td>${escapeHtml(o.userEmail || '—')}</td>
                    <td>${o.items.length} тов.</td>
                    <td>${o.total} ₽</td>
                    <td>
                        <select onchange="updateOrderStatus('${o.id}', this.value)">
                            ${statusOpts.map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                    </td>
                    <td>${date}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="deleteOrder('${o.id}')">🗑️</button></td>
                </tr>
            `;
        }).join('');
    });
}

function renderAdminUsers() {
    db.collection('users').get().then(snapshot => {
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.querySelector('#admin-users-table tbody');
        tbody.innerHTML = allUsers.map(u => {
            const regDate = u.createdAt ? u.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
            return `
                <tr>
                    <td>${escapeHtml(u.email || '—')}</td>
                    <td>${u.points || 0}</td>
                    <td>${u.trees || 0}</td>
                    <td>${u.ordersCount || 0}</td>
                    <td>${regDate}</td>
                </tr>
            `;
        }).join('');
    });
}

function renderAdminStats() {
    db.collection('stats').doc('global').get().then(doc => {
        const d = doc.exists ? doc.data() : {};
        document.getElementById('admin-stat-revenue').textContent = (d.revenue || 0) + ' ₽';
        document.getElementById('admin-stat-orders').textContent = d.orders || 0;
        document.getElementById('admin-stat-users').textContent = d.users || 0;
        document.getElementById('admin-stat-products').textContent = products.length;

        // График по категориям
        const cats = {};
        allOrders.forEach(o => {
            o.items.forEach(i => {
                const prod = products.find(p => p.id === i.id);
                if (prod) {
                    cats[prod.category] = (cats[prod.category] || 0) + 1;
                }
            });
        });
        const maxVal = Math.max(...Object.values(cats), 1);
        document.getElementById('category-chart').innerHTML = Object.entries(cats).map(([cat, val]) => `
            <div class="bar-item">
                <div class="bar-fill" style="height:${(val/maxVal*150)}px"></div>
                <div class="bar-label">${getCategoryLabel(cat)}<br><small>${val}</small></div>
            </div>
        `).join('');
    });
}

function updateOrderStatus(id, status) {
    db.collection('orders').doc(id).update({ status: status })
        .then(() => toast('Статус обновлён'));
}

function deleteOrder(id) {
    if (!confirm('Удалить заказ?')) return;
    db.collection('orders').doc(id).delete().then(() => {
        renderAdminOrders();
        toast('Заказ удалён');
    });
}

function openProductModal() {
    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('product-form').reset();
    document.getElementById('edit-product-id').value = '';
    document.getElementById('product-modal-title').textContent = 'Добавить товар';
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('edit-product-id').value = id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-category').value = p.category;
    document.getElementById('prod-desc').value = p.description || '';
    document.getElementById('prod-image').value = p.image || '';
    document.getElementById('prod-co2').value = p.co2Saved || 0;
    document.getElementById('prod-active').checked = p.active !== false;
    document.getElementById('product-modal-title').textContent = 'Редактировать товар';
    document.getElementById('product-modal').classList.remove('hidden');
}

function deleteProduct(id) {
    if (!confirm('Удалить товар?')) return;
    getProductsRef().doc(id).delete().then(() => toast('Товар удалён'));
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    // Фильтры каталога
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.cat;
            renderCatalog();
        });
    });

    // Форма входа
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        auth.signInWithEmailAndPassword(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        ).then(() => {
            closeAuthModal();
            toast('Добро пожаловать!');
        }).catch(err => showAuthMessage(getAuthError(err.code), 'error'));
    });

    // Форма регистрации
    document.getElementById('register-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const name = document.getElementById('reg-name').value;

        if (pass.length < 6) { showAuthMessage('Пароль минимум 6 символов', 'error'); return; }

        auth.createUserWithEmailAndPassword(email, pass).then(cred => {
            db.collection('users').doc(cred.user.uid).set({
                email: email,
                name: name,
                points: 0,
                trees: 0,
                ordersCount: 0,
                isAdmin: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            db.collection('stats').doc('global').update({
                users: firebase.firestore.FieldValue.increment(1)
            });
            closeAuthModal();
            toast('Регистрация успешна!');
        }).catch(err => showAuthMessage(getAuthError(err.code), 'error'));
    });

    // Форма товара (админ)
    document.getElementById('product-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('edit-product-id').value;
        const data = {
            name: document.getElementById('prod-name').value.trim(),
            price: parseInt(document.getElementById('prod-price').value),
            category: document.getElementById('prod-category').value,
            description: document.getElementById('prod-desc').value.trim(),
            image: document.getElementById('prod-image').value.trim(),
            co2Saved: parseFloat(document.getElementById('prod-co2').value) || 0,
            active: document.getElementById('prod-active').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            getProductsRef().doc(id).update(data).then(() => {
                closeProductModal();
                toast('Товар обновлён');
            });
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            getProductsRef().add(data).then(() => {
                closeProductModal();
                toast('Товар добавлен');
                db.collection('stats').doc('global').update({
                    products: firebase.firestore.FieldValue.increment(1)
                });
            });
        }
    });

    // Закрытие модалок по клику вне
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
    });

    loadProducts();

    // Создаём начальные товары если пусто
    getProductsRef().get().then(snap => {
        if (snap.empty) seedProducts();
    });

    // Создаём глобальную статистику если нет
    db.collection('stats').doc('global').get().then(doc => {
        if (!doc.exists) {
            db.collection('stats').doc('global').set({
                products: 0, orders: 0, users: 0, trees: 0, revenue: 0, co2Saved: 0
            });
        }
    });
});

// ===== AUTH STATE =====
auth.onAuthStateChanged(user => {
    currentUser = user;

    if (user) {
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-menu').classList.remove('hidden');

        db.collection('users').doc(user.uid).onSnapshot(doc => {
            userData = doc.exists ? doc.data() : {};
            if (!doc.exists) {
                db.collection('users').doc(user.uid).set({
                    email: user.email,
                    name: user.displayName || 'Пользователь',
                    points: 0, trees: 0, ordersCount: 0, isAdmin: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Показать админку если админ
            if (userData && userData.isAdmin) {
                document.getElementById('admin-link').classList.remove('hidden');
            } else {
                document.getElementById('admin-link').classList.add('hidden');
            }

            document.getElementById('nav-points').innerHTML = '🌱 ' + (userData.points || 0);

            if (currentPage === 'profile') renderProfile();
            if (currentPage === 'admin') renderAdmin();
        });
    } else {
        document.getElementById('auth-buttons').classList.remove('hidden');
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('admin-link').classList.add('hidden');
        document.getElementById('nav-points').innerHTML = '🌱 0';
        userData = null;
    }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
function getCategoryLabel(cat) {
    const labels = {
        kitchen: '🍽️ Кухня', beauty: '💄 Красота', home: '🏠 Дом',
        accessories: '🎒 Аксессуары', tech: '🔋 Техника'
    };
    return labels[cat] || cat;
}

function getAuthError(code) {
    const errors = {
        'auth/invalid-email': 'Неверный email',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/email-already-in-use': 'Email уже используется',
        'auth/weak-password': 'Пароль слишком простой',
        'auth/invalid-credential': 'Неверный email или пароль'
    };
    return errors[code] || code;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function animateNum(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 30));
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString('ru-RU');
    }, 30);
}

// ===== НАЧАЛЬНЫЕ ТОВАРЫ =====
function seedProducts() {
    const initialProducts = [
        { name: 'Бамбуковая зубная щётка', price: 199, category: 'beauty', description: 'Экологичная зубная щётка из натурального бамбука. Биоразлагаемая, без пластика.', image: '🦷', co2Saved: 0.3, active: true },
        { name: 'Многоразовая сумка-шоппер', price: 349, category: 'accessories', description: 'Прочная сумка из органического хлопка. Заменяет до 500 пластиковых пакетов.', image: '🛍️', co2Saved: 1.2, active: true },
        { name: 'Силиконовые трубочки (набор 4 шт)', price: 299, category: 'kitchen', description: 'Многоразовые силиконовые трубочки с щёткой для чистки. Идеальны для смузи и коктейлей.', image: '🥤', co2Saved: 0.5, active: true },
        { name: 'Эко-контейнер для еды 1.2л', price: 599, category: 'kitchen', description: 'Контейнер из нержавеющей стали. Герметичный, безопасный, вечный.', image: '🍱', co2Saved: 0.8, active: true },
        { name: 'Натуральное мыло ручной работы', price: 249, category: 'beauty', description: 'Мыло из натуральных масел. Без SLS и парабенов. Упаковка из крафт-бумаги.', image: '🧼', co2Saved: 0.2, active: true },
        { name: 'LED-лампа экономичная 9W', price: 199, category: 'tech', description: 'Энергосберегающая LED-лампа. Срок службы 25 000 часов. Экономия до 80% энергии.', image: '💡', co2Saved: 2.0, active: true },
        { name: 'Бамбуковые палочки для ушей (200 шт)', price: 149, category: 'beauty', description: 'Палочки из бамбука и органического хлопка. Полностью биоразлагаемые.', image: '👂', co2Saved: 0.4, active: true },
        { name: 'Многоразовые обёртки для еды (набор 3 шт)', price: 499, category: 'kitchen', description: 'Обёртки из пчелиного воска. Заменяют пищевую плёнку. Моющиеся, многоразовые.', image: '🥪', co2Saved: 0.6, active: true },
        { name: 'Эко-шампунь в твёрдом виде', price: 399, category: 'beauty', description: 'Твёрдый шампунь без пластиковой упаковки. Натуральные ингредиенты, 60+ использований.', image: '🧴', co2Saved: 0.5, active: true },
        { name: 'Солнечное зарядное устройство 10000mAh', price: 2499, category: 'tech', description: 'Портативная батарея с солнечной панелью. Заряжайте гаджеты от солнца!', image: '☀️', co2Saved: 3.5, active: true },
        { name: 'Компостер для кухни 5л', price: 1299, category: 'home', description: 'Настольный компостер с угольным фильтром. Превращайте отходы в удобрения!', image: '🌱', co2Saved: 1.5, active: true },
        { name: 'Многоразовые бамбуковые салфетки (набор 6 шт)', price: 349, category: 'home', description: 'Салфетки из бамбукового волокна. Заменяют бумажные. Моющиеся до 100 раз.', image: '🧽', co2Saved: 0.7, active: true },
    ];

    initialProducts.forEach(p => {
        p.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        getProductsRef().add(p);
    });

    db.collection('stats').doc('global').update({
        products: firebase.firestore.FieldValue.increment(initialProducts.length)
    });
}
