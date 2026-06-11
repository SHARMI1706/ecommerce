// ══════════════════════════════════════════════════════════════════
//  DRAPE — Clothing Store App
//  Backend: Supabase | Payment: Cash on Delivery
// ══════════════════════════════════════════════════════════════════

// ─── SUPABASE CONFIG ───────────────────────────────────────────────
// 🔧 Replace with your actual Supabase project URL and anon key
// Get these from: https://app.supabase.com → your project → Settings → API
const SUPABASE_URL = 'https://ufveapuntflasvbcqwxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i2a3MCZXpsul7J-TV4xi0w_bpEikiPB';

const supabaseClient = SUPABASE_URL === 'YOUR_SUPABASE_URL'
  ? null
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ─────────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('drape_cart') || '[]');
let currentUser = null;
let allProducts = [];
let currentCategory = 'All';
let currentPage = 'home';
let selectedSize = 'M';

// ─── SAMPLE PRODUCTS (fallback when Supabase not set up) ───────────
const SAMPLE_PRODUCTS = [
  { id:1, name:'Oxford Button-Down', category:'Men', price:1299, original_price:1899, emoji:'👔', sizes:['S','M','L','XL'], description:'A timeless Oxford shirt crafted from 100% breathable cotton. Perfect for casual Fridays or smart-casual outings.', is_featured:true, stock:50 },
  { id:2, name:'Slim Chino Trousers', category:'Men', price:1599, original_price:2199, emoji:'👖', sizes:['28','30','32','34','36'], description:'Sleek slim-fit chinos in a versatile mid-grey. Pairs effortlessly with almost anything.', is_featured:true, stock:40 },
  { id:3, name:'Floral Midi Dress', category:'Women', price:1899, original_price:2799, emoji:'👗', sizes:['XS','S','M','L'], description:'A flowing midi dress with a delicate floral print. Light fabric for warm days.', is_featured:true, stock:30 },
  { id:4, name:'Structured Blazer', category:'Women', price:2999, original_price:4199, emoji:'🧥', sizes:['XS','S','M','L','XL'], description:'An impeccably tailored blazer that transitions from boardroom to brunch with ease.', is_featured:true, stock:25 },
  { id:5, name:'Striped Tee', category:'Kids', price:599, original_price:899, emoji:'👕', sizes:['2Y','4Y','6Y','8Y','10Y'], description:'Fun and comfortable striped tee for kids. Made from soft organic cotton.', is_featured:false, stock:80 },
  { id:6, name:'Denim Shorts', category:'Kids', price:799, original_price:1199, emoji:'🩳', sizes:['2Y','4Y','6Y','8Y','10Y'], description:'Classic denim shorts with an adjustable waistband for a perfect fit.', is_featured:false, stock:60 },
  { id:7, name:'Canvas Tote Bag', category:'Accessories', price:699, original_price:999, emoji:'👜', sizes:['One Size'], description:'A spacious canvas tote with inner pockets. Durable and stylish for everyday use.', is_featured:true, stock:100 },
  { id:8, name:'Leather Belt', category:'Accessories', price:899, original_price:1399, emoji:'🪢', sizes:['S','M','L','XL'], description:'Full-grain leather belt with a classic buckle. A wardrobe staple that lasts.', is_featured:false, stock:70 },
  { id:9, name:'Linen Kurta', category:'Men', price:1499, original_price:2099, emoji:'🥻', sizes:['S','M','L','XL','XXL'], description:'Breathable linen kurta, ideal for festive occasions and everyday comfort.', is_featured:false, stock:45 },
  { id:10, name:'Wrap Skirt', category:'Women', price:1199, original_price:1699, emoji:'🩱', sizes:['XS','S','M','L'], description:'An elegant wrap skirt with a knotted waist. Versatile and effortlessly stylish.', is_featured:false, stock:35 },
  { id:11, name:'Kids Hoodie', category:'Kids', price:999, original_price:1499, emoji:'🧸', sizes:['2Y','4Y','6Y','8Y','10Y'], description:'A cozy pullover hoodie with a kangaroo pocket. Perfect for cooler evenings.', is_featured:false, stock:55 },
  { id:12, name:'Wristwatch Casual', category:'Accessories', price:2499, original_price:3499, emoji:'⌚', sizes:['One Size'], description:'A clean minimal watch with a mesh strap. Understated elegance on your wrist.', is_featured:true, stock:20 },
];

// ─── SUPABASE HELPERS ──────────────────────────────────────────────
async function fetchProducts() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    // Demo mode — use sample data
    return SAMPLE_PRODUCTS;
  }
  const { data, error } = await supabaseClient.from('products').select('*').order('id');
  if (error) { console.warn('Supabase fetch failed, using sample data'); return SAMPLE_PRODUCTS; }
  return data;
}

async function getCurrentUser() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.user || null;
}

async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  showToast('Signed out successfully');
  renderAccountPage();
}

async function insertOrder(orderData) {
  // If Supabase client is not configured, create a demo order locally.
  if (!supabaseClient) {
    const demoId = 'DEMO-' + Math.random().toString(36).substr(2,8).toUpperCase();
    return { id: demoId };
  }

  try {
    const { data, error } = await supabaseClient.from('orders').insert([orderData]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Supabase insert failed — falling back to local demo orders', err);
    const demoOrders = JSON.parse(localStorage.getItem('drape_orders') || '[]');
    const demoId = 'DEMO-' + Math.random().toString(36).substr(2,8).toUpperCase();
    demoOrders.unshift({ ...orderData, id: demoId });
    localStorage.setItem('drape_orders', JSON.stringify(demoOrders));
    return { id: demoId };
  }
}

async function fetchOrders() {
  // Prefer Supabase when configured; but gracefully fall back to local demo orders.
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('user_email', currentUser?.email || '')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) return data;
      if (error) console.warn('Supabase fetchOrders error', error);
    } catch (err) {
      console.warn('Supabase fetch failed', err);
    }
  }

  // Fallback to demo orders stored in localStorage
  const demo = JSON.parse(localStorage.getItem('drape_orders') || '[]');
  if (!currentUser) return demo;
  return demo.filter(o => o.user_email === currentUser.email);
}

// ─── CART LOGIC ────────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('drape_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(product, size = 'M') {
  const key = `${product.id}-${size}`;
  const existing = cart.find(i => i.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ key, id: product.id, name: product.name, price: product.price, emoji: product.emoji, size, qty: 1, category: product.category });
  }
  saveCart();
  showToast(`${product.name} added to bag!`);
  renderCartDrawer();
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  renderCartDrawer();
}

function updateQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) cart = cart.filter(i => i.key !== key);
  saveCart();
  renderCartDrawer();
}

function cartTotal() { return cart.reduce((s,i) => s + i.price * i.qty, 0); }
function cartCount() { return cart.reduce((s,i) => s + i.qty, 0); }

function updateCartBadge() {
  const n = cartCount();
  const badge = document.getElementById('cart-badge');
  const countBadge = document.getElementById('cart-count-badge');
  if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
  if (countBadge) countBadge.textContent = n;
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items');
  if (!container) return;
  updateCartBadge();
  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-empty-msg">Your bag is empty.<br/>Start shopping!</div>';
    document.getElementById('cart-total').textContent = '₹0';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Size: ${item.size}</div>
        <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString()}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty('${item.key}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.key}',1)">+</button>
          <span class="cart-remove" onclick="removeFromCart('${item.key}')">Remove</span>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('cart-total').textContent = '₹' + cartTotal().toLocaleString();
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  renderCartDrawer();
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

// ─── PAGE ROUTER ────────────────────────────────────────────────────
function showPage(page, data = null) {
  currentPage = page;
  const app = document.getElementById('app');
  closeCart();

  switch(page) {
    case 'home':      renderHome(); break;
    case 'shop':      renderShop(); break;
    case 'product':   renderProduct(data); break;
    case 'checkout':  renderCheckout(); break;
    case 'success':   renderSuccess(data); break;
    case 'orders':    renderOrders(); break;
    case 'account':   renderAccountPage(); break;
    default:          renderHome();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToCheckout() {
  if (cart.length === 0) { showToast('Your bag is empty!'); return; }
  closeCart();
  showPage('checkout');
}

// ─── HOME PAGE ─────────────────────────────────────────────────────
async function renderHome() {
  const tpl = document.getElementById('tpl-home');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  // Load featured products
  if (allProducts.length === 0) allProducts = await fetchProducts();
  const featured = allProducts.filter(p => p.is_featured).slice(0, 4);
  const container = document.getElementById('featured-products');
  if (container) {
    container.innerHTML = featured.map(p => productCardHTML(p)).join('');
  }
}

// ─── SHOP PAGE ─────────────────────────────────────────────────────
async function renderShop() {
  const tpl = document.getElementById('tpl-shop');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  if (allProducts.length === 0) allProducts = await fetchProducts();

  // Set active filter
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(t => {
    const cat = t.textContent.trim();
    t.classList.toggle('active', cat === currentCategory || (currentCategory === 'All' && cat === 'All'));
  });
  document.getElementById('shop-loading').classList.add('hidden');
  renderProductGrid();
}

function filterByCategory(cat) {
  currentCategory = cat;
  if (currentPage !== 'shop') { showPage('shop'); return; }

  // Update tabs
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.trim() === cat || (cat === 'All' && t.textContent.trim() === 'All'));
  });
  const titleEl = document.getElementById('shop-page-title');
  if (titleEl) titleEl.textContent = cat === 'All' ? 'All Products' : cat;
  renderProductGrid();
}

function sortProducts() {
  renderProductGrid();
}

function renderProductGrid() {
  let prods = currentCategory === 'All' ? [...allProducts] : allProducts.filter(p => p.category === currentCategory);

  const sortSel = document.getElementById('sort-select');
  if (sortSel) {
    const sortVal = sortSel.value;
    if (sortVal === 'price-asc')  prods.sort((a,b) => a.price - b.price);
    if (sortVal === 'price-desc') prods.sort((a,b) => b.price - a.price);
    if (sortVal === 'name-asc')   prods.sort((a,b) => a.name.localeCompare(b.name));
  }

  const container = document.getElementById('shop-products');
  const empty = document.getElementById('shop-empty');
  if (!container) return;

  if (prods.length === 0) {
    container.innerHTML = '';
    empty?.classList.remove('hidden');
  } else {
    empty?.classList.add('hidden');
    container.innerHTML = prods.map(p => productCardHTML(p)).join('');
  }
}

function productCardHTML(p) {
  const discount = p.original_price ? Math.round((1 - p.price/p.original_price)*100) : 0;
  return `
    <div class="product-card" onclick="showPage('product', ${p.id})">
      <div class="product-card-img" style="background: linear-gradient(135deg, #1a2535, #2d3f55);">
        ${p.emoji}
        ${discount > 0 ? `<span class="badge">${discount}% OFF</span>` : ''}
      </div>
      <div class="product-card-body">
        <div class="product-card-cat">${p.category}</div>
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-footer">
          <div>
            <span class="product-price">₹${p.price.toLocaleString()}</span>
            ${p.original_price ? `<span class="product-price-old">₹${p.original_price.toLocaleString()}</span>` : ''}
          </div>
          <button class="add-to-cart-btn" onclick="event.stopPropagation(); quickAdd(${p.id})" title="Add to bag">+</button>
        </div>
      </div>
    </div>
  `;
}

function quickAdd(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const size = product.sizes?.[1] || product.sizes?.[0] || 'M';
  addToCart(product, size);
}

// ─── PRODUCT DETAIL ─────────────────────────────────────────────────
async function renderProduct(productId) {
  const tpl = document.getElementById('tpl-product');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  if (allProducts.length === 0) allProducts = await fetchProducts();
  const p = allProducts.find(x => x.id === productId);
  if (!p) { showPage('shop'); return; }

  selectedSize = p.sizes?.[1] || p.sizes?.[0] || 'M';
  const discount = p.original_price ? Math.round((1 - p.price/p.original_price)*100) : 0;

  const container = document.getElementById('product-detail-inner');
  container.innerHTML = `
    <div class="back-link" onclick="history.back()">← Back</div>
    <div class="product-detail-grid">
      <div class="product-detail-img-wrap">${p.emoji}</div>
      <div class="product-detail-info">
        <div class="product-detail-cat">${p.category}</div>
        <h1 class="product-detail-name">${p.name}</h1>
        <div class="product-detail-price">
          ₹${p.price.toLocaleString()}
          ${p.original_price ? `<span class="old">₹${p.original_price.toLocaleString()}</span>` : ''}
          ${discount > 0 ? `&nbsp;<span style="font-size:14px;background:var(--sage);color:var(--bg);padding:2px 10px;border-radius:20px;font-weight:700;">${discount}% off</span>` : ''}
        </div>
        <p class="product-detail-desc">${p.description}</p>

        <div class="size-label">Select Size</div>
        <div class="size-options" id="size-options">
          ${(p.sizes || ['S','M','L','XL']).map(s => `
            <button class="size-btn ${s === selectedSize ? 'active' : ''}" onclick="selectSize('${s}')">${s}</button>
          `).join('')}
        </div>

        <div class="detail-actions">
          <button class="btn-primary" onclick="addProductToCart(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Add to Bag
          </button>
          <button class="btn-secondary" onclick="addProductToCart(${p.id}); showPage('checkout')">Buy Now</button>
        </div>

        <div class="product-detail-meta">
          <div class="detail-meta-row"><strong>Delivery:</strong> <span>Free delivery above ₹999 | COD available</span></div>
          <div class="detail-meta-row"><strong>Returns:</strong> <span>Easy 7-day return policy</span></div>
          <div class="detail-meta-row"><strong>Stock:</strong> <span>${p.stock > 10 ? 'In Stock' : `Only ${p.stock} left!`}</span></div>
        </div>
      </div>
    </div>
  `;
}

function selectSize(size) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b.textContent.trim() === size));
}

function addProductToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  addToCart(product, selectedSize);
}

// ─── CHECKOUT ──────────────────────────────────────────────────────
function renderCheckout() {
  const tpl = document.getElementById('tpl-checkout');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  const subtotal = cartTotal();
  const delivery = subtotal >= 999 ? 0 : 79;
  const total = subtotal + delivery;

  const itemsList = document.getElementById('co-items-list');
  itemsList.innerHTML = cart.map(item => `
    <div class="co-item-row">
      <span class="co-item-name">${item.emoji} ${item.name} (${item.size}) × ${item.qty}</span>
      <span class="co-item-price">₹${(item.price * item.qty).toLocaleString()}</span>
    </div>
  `).join('');

  document.getElementById('co-subtotal').textContent = '₹' + subtotal.toLocaleString();
  document.getElementById('co-delivery').textContent = delivery === 0 ? 'FREE' : '₹' + delivery;
  document.getElementById('co-total').textContent = '₹' + total.toLocaleString();
}

async function placeOrder() {
  const name    = document.getElementById('co-name')?.value.trim();
  const phone   = document.getElementById('co-phone')?.value.trim();
  const email   = document.getElementById('co-email')?.value.trim();
  const addr1   = document.getElementById('co-addr1')?.value.trim();
  const city    = document.getElementById('co-city')?.value.trim();
  const pin     = document.getElementById('co-pin')?.value.trim();
  const state   = document.getElementById('co-state')?.value.trim();

  if (!name || !phone || !email || !addr1 || !city || !pin || !state) {
    showToast('Please fill in all required fields'); return;
  }
  if (!/^\d{6}$/.test(pin)) { showToast('Enter a valid 6-digit pincode'); return; }

  const subtotal = cartTotal();
  const delivery = subtotal >= 999 ? 0 : 79;
  const total = subtotal + delivery;
  const addr2 = document.getElementById('co-addr2')?.value.trim();

  const orderData = {
    user_email: email,
    customer_name: name,
    phone,
    address: [addr1, addr2, city, state, pin].filter(Boolean).join(', '),
    items: JSON.stringify(cart),
    subtotal,
    delivery_fee: delivery,
    total,
    payment_method: 'COD',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  try {
    const btn = document.querySelector('.checkout-page .btn-primary');
    if (btn) { btn.textContent = 'Placing order…'; btn.disabled = true; }

    const order = await insertOrder(orderData);

    // Save demo orders to localStorage
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      const demoOrders = JSON.parse(localStorage.getItem('drape_orders') || '[]');
      demoOrders.unshift({ ...orderData, id: order.id });
      localStorage.setItem('drape_orders', JSON.stringify(demoOrders));
    }

    cart = [];
    saveCart();
    renderCartDrawer();
    showPage('success', order.id);
  } catch (err) {
    console.error(err);
    showToast('Failed to place order. Please try again.');
    const btn = document.querySelector('.checkout-page .btn-primary');
    if (btn) { btn.textContent = 'Place Order (COD)'; btn.disabled = false; }
  }
}

// ─── ORDER SUCCESS ─────────────────────────────────────────────────
function renderSuccess(orderId) {
  const tpl = document.getElementById('tpl-order-success');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));
  const el = document.getElementById('success-order-id');
  if (el) el.textContent = orderId || 'ORD-' + Date.now();
}

// ─── ORDERS PAGE ───────────────────────────────────────────────────
async function renderOrders() {
  const tpl = document.getElementById('tpl-orders');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  const loading = document.getElementById('orders-loading');
  const empty = document.getElementById('orders-empty');
  const list = document.getElementById('orders-list');

  const orders = await fetchOrders();
  loading?.classList.add('hidden');

  if (!orders || orders.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }

  list.innerHTML = orders.map(o => {
    let items = [];
    try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch(e) {}
    const statusClass = { pending: 'status-pending', confirmed: 'status-confirmed', delivered: 'status-delivered' }[o.status] || 'status-pending';
    const statusLabel = { pending: 'Pending', confirmed: 'Confirmed', delivered: 'Delivered' }[o.status] || 'Pending';
    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-id">Order #${o.id}</div>
            <div class="order-date">${new Date(o.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'short',year:'numeric' })}</div>
          </div>
          <span class="order-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="order-items-summary">
          ${items.slice(0,3).map(i=>`${i.emoji} ${i.name} × ${i.qty}`).join(' &nbsp;·&nbsp; ')}
          ${items.length > 3 ? ` &nbsp;+${items.length-3} more` : ''}
        </div>
        <div class="order-total">₹${Number(o.total).toLocaleString()} &nbsp;·&nbsp; <span style="font-size:13px;font-weight:500;color:var(--text-muted);">Cash on Delivery</span></div>
      </div>
    `;
  }).join('');
}

// ─── ACCOUNT PAGE ──────────────────────────────────────────────────
async function renderAccountPage() {
  const tpl = document.getElementById('tpl-account');
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(tpl.content.cloneNode(true));

  currentUser = await getCurrentUser();
  const section = document.getElementById('auth-section');

  if (currentUser) {
    const initial = (currentUser.email || 'U')[0].toUpperCase();
    section.innerHTML = `
      <div class="logged-in-card">
        <div class="user-avatar">${initial}</div>
        <h3>${currentUser.user_metadata?.name || 'Welcome back!'}</h3>
        <div class="email">${currentUser.email}</div>
        <div class="account-menu">
          <div class="account-menu-item" onclick="showPage('orders')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
            My Orders
          </div>
          <div class="account-menu-item" onclick="showPage('shop')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Continue Shopping
          </div>
          <div class="account-menu-item" onclick="signOut()" style="color:var(--error);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </div>
        </div>
      </div>
    `;
  } else {
    renderAuthForm(section, 'signin');
  }
}

function renderAuthForm(container, mode) {
  const isSignIn = mode === 'signin';
  container.innerHTML = `
    <div class="auth-card">
      <h2>${isSignIn ? 'Sign In' : 'Create Account'}</h2>
      <p>${isSignIn ? 'Welcome back to DRAPE.' : 'Join DRAPE for a seamless shopping experience.'}</p>
      ${!isSignIn ? `
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="auth-name" placeholder="Priya Sharma" />
        </div>
      ` : ''}
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="auth-email" placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="auth-password" placeholder="••••••••" />
      </div>
      <button class="btn-primary full-width" onclick="handleAuth('${mode}')">
        ${isSignIn ? 'Sign In' : 'Create Account'}
      </button>
      ${SUPABASE_URL === 'YOUR_SUPABASE_URL' ? `
        <p style="margin-top:16px;font-size:12px;color:var(--text-muted);text-align:center;background:rgba(143,175,140,.08);padding:10px;border-radius:8px;">
          🔧 Connect Supabase to enable authentication. <br/>See <strong>SETUP.md</strong> for instructions.
        </p>
      ` : ''}
      <div class="auth-toggle">
        ${isSignIn
          ? `Don't have an account? <a onclick="renderAuthForm(document.getElementById('auth-section'),'signup')">Sign up</a>`
          : `Already have an account? <a onclick="renderAuthForm(document.getElementById('auth-section'),'signin')">Sign in</a>`
        }
      </div>
    </div>
  `;
}

async function handleAuth(mode) {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    showToast('Connect Supabase first. See SETUP.md'); return;
  }
  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  if (!email || !password) { showToast('Please fill in all fields'); return; }

  try {
    const btn = document.querySelector('.auth-card .btn-primary');
    if (btn) { btn.textContent = 'Please wait…'; btn.disabled = true; }

    if (mode === 'signup') {
      const name = document.getElementById('auth-name')?.value.trim();
      await supabaseClient.auth.signUp({ email, password, options: { data: { name } } });
      showToast('Check your email to confirm your account!');
    } else {
      await signIn(email, password);
      showToast('Welcome back!');
      renderAccountPage();
    }
  } catch (err) {
    showToast(err.message || 'Authentication failed');
    const btn = document.querySelector('.auth-card .btn-primary');
    if (btn) { btn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In'; btn.disabled = false; }
  }
}

// ─── TOAST ────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  updateCartBadge();
  currentUser = await getCurrentUser();
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
    });
  }
  showPage('home');

  // Scroll effect on navbar
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.style.background = window.scrollY > 40 ? 'rgba(15,17,23,0.98)' : 'rgba(15,17,23,0.92)';
  });
}

init();