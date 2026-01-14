// ============================================
// 配置和初始化
// ============================================

// Firebase 配置 - 使用你的配置
const firebaseConfig = {
    apiKey: "AIzaSyCqfE3hThLmbDWQE987ho7LrS7InLx_S8M",
    authDomain: "photoshareapp-15f24.firebaseapp.com",
    projectId: "photoshareapp-15f24",
    storageBucket: "photoshareapp-15f24.firebasestorage.app",
    messagingSenderId: "698614095306",
    appId: "1:698614095306:web:9d01ec9c4f03f6e9944333",
    measurementId: "G-QK9HBFPGC8"
};

// Cloudinary 配置 - 使用你的配置
const CLOUDINARY_CONFIG = {
    cloudName: 'dy77idija',          // 你的 Cloud name
    uploadPreset: 'photo_share_app', // 需要你在 Cloudinary 创建
    apiKey: '735299868247252',       // 你的 API Key
    apiUrl: 'https://api.cloudinary.com/v1_1',
    unsignedUpload: true,
    folder: 'photo_share/photos',
    tags: 'photo_share,user_upload',
    optimization: { maxWidth: 1200, quality: 0.8, format: 'auto' },
    thumbnail: { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
    allowedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024
};

// 全局变量
let currentUser = null;
let currentTheme = 'light';
let selectedKeywords = [];
let lastVisibleDoc = null;
let isLoading = false;
let hasMorePhotos = true;

// ============================================
// DOM 加载初始化
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 应用初始化...');
    
    try {
        // 初始化 Firebase（使用兼容版本）
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase 初始化成功');
    } catch (error) {
        console.error('❌ Firebase 初始化失败:', error);
        showNotification('Firebase 初始化失败，请刷新页面', 'error');
        return;
    }
    
    // 初始化服务
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // 设置全局变量
    window.auth = auth;
    window.db = db;
    
    // 加载主题
    loadTheme();
    
    // 初始化拖拽上传
    initDragAndDrop();
    
    // 初始化移动端优化
    initMobileOptimizations();
    
    // 验证 Cloudinary 配置
    validateCloudinaryConfig();
    
    // 监听认证状态
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        updateUI();
        
        if (user) {
            console.log('👤 用户登录:', user.email);
            try {
                await loadUserProfile(user.uid);
                await loadUserPhotos(user.uid);
            } catch (error) {
                console.error('加载用户数据失败:', error);
            }
        } else {
            console.log('👤 用户未登录');
        }
        
        // 加载照片
        loadPhotos();
        
        // 更新统计
        updateStats();
    });
    
    // 初始加载完成提示
    setTimeout(() => {
        if (!currentUser) {
            showNotification('欢迎使用光影相册！请登录或注册开始分享照片。', 'info');
        }
    }, 1000);
});

// ============================================
// 配置验证
// ============================================

function validateCloudinaryConfig() {
    console.log('🔍 验证 Cloudinary 配置...');
    
    if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName === '你的_cloud_name') {
        console.error('❌ Cloudinary: cloudName 未设置');
        showNotification('Cloudinary 配置不完整，请检查 cloudName', 'error');
        return false;
    }
    
    if (!CLOUDINARY_CONFIG.uploadPreset || CLOUDINARY_CONFIG.uploadPreset === '你的_upload_preset') {
        console.error('❌ Cloudinary: uploadPreset 未设置');
        showNotification('Cloudinary 配置不完整，请检查 uploadPreset', 'error');
        return false;
    }
    
    console.log('✅ Cloudinary 配置有效:', {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset
    });
    
    return true;
}

// ============================================
// 主题管理
// ============================================

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const themeIcon = document.querySelector('.theme-toggle i');
    if (theme === 'dark') {
        themeIcon.className = 'fas fa-sun';
    } else if (theme === 'white') {
        themeIcon.className = 'fas fa-adjust';
    } else {
        themeIcon.className = 'fas fa-moon';
    }
}

function toggleTheme() {
    const themes = ['light', 'dark', 'white'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
    showNotification(`已切换至${themes[nextIndex]}主题`, 'info');
}

// ============================================
// 认证功能
// ============================================

function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        document.getElementById('authEmail').focus();
    }
}

function toggleAuthMode() {
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmit');
    const toggleLink = document.getElementById('authToggle');
    const registerFields = document.getElementById('registerFields');
    
    if (title.textContent === '登录') {
        title.textContent = '注册账号';
        submitBtn.textContent = '注册';
        toggleLink.innerHTML = '已有账号？<a href="#" onclick="toggleAuthMode()">立即登录</a>';
        registerFields.style.display = 'block';
    } else {
        title.textContent = '登录';
        submitBtn.textContent = '登录';
        toggleLink.innerHTML = '还没有账号？<a href="#" onclick="toggleAuthMode()">立即注册</a>';
        registerFields.style.display = 'none';
    }
}

async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorElement = document.getElementById('authError');
    
    errorElement.textContent = '';
    
    const isLogin = document.getElementById('authTitle').textContent === '登录';
    
    try {
        if (isLogin) {
            // 登录
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ 登录成功:', userCredential.user.email);
            toggleAuthModal();
            showNotification('登录成功！', 'success');
        } else {
            // 注册
            const username = document.getElementById('authUsername').value.trim();
            const bio = document.getElementById('authBio').value.trim();
            
            if (!username) {
                throw new Error('请输入用户名');
            }
            
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // 更新用户资料
            await user.updateProfile({
                displayName: username,
                photoURL: generateAvatarUrl(username)
            });
            
            // 创建用户文档
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                username: username,
                bio: bio || '',
                avatar: generateAvatarUrl(username),
                joinDate: new Date().toISOString(),
                photoCount: 0,
                likeCount: 0,
                followerCount: 0,
                followingCount: 0,
                lastActive: new Date().toISOString()
            });
            
            console.log('✅ 注册成功:', username);
            toggleAuthModal();
            showNotification('注册成功！欢迎加入光影相册！', 'success');
        }
    } catch (error) {
        console.error('❌ 认证错误:', error);
        errorElement.textContent = getAuthErrorMessage(error);
    }
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return '邮箱已被注册';
        case 'auth/user-not-found':
            return '用户不存在';
        case 'auth/wrong-password':
            return '密码错误';
        case 'auth/weak-password':
            return '密码至少6位字符';
        case 'auth/invalid-email':
            return '邮箱格式不正确';
        case 'auth/network-request-failed':
            return '网络错误，请检查连接';
        default:
            return error.message || '发生错误，请重试';
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showNotification('已退出登录', 'info');
        console.log('👤 用户已退出');
    } catch (error) {
        console.error('❌ 退出失败:', error);
        showNotification('退出失败: ' + error.message, 'error');
    }
}

// ============================================
// UI 更新
// ============================================

function updateUI() {
    const loginBtn = document.getElementById('loginBtn');
    const loginIcon = loginBtn.querySelector('i');
    const loginText = loginBtn.querySelector('.nav-text');
    
    if (currentUser) {
        loginIcon.className = 'fas fa-sign-out-alt';
        loginText.textContent = '退出';
        loginBtn.onclick = handleLogout;
        
        // 更新导航菜单
        const profileLink = document.querySelector('a[onclick="showProfile()"] .nav-text');
        if (profileLink) {
            profileLink.textContent = currentUser.displayName || '我的';
        }
    } else {
        loginIcon.className = 'fas fa-sign-in-alt';
        loginText.textContent = '登录';
        loginBtn.onclick = toggleAuthModal;
    }
}

// ============================================
// 照片管理
// ============================================

async function loadPhotos() {
    if (isLoading) return;
    isLoading = true;
    
    const grid = document.getElementById('photosGrid');
    const sortBy = document.getElementById('sortBy').value;
    
    // 如果是第一次加载，显示加载中
    if (!lastVisibleDoc) {
        grid.innerHTML = '<div class="loading">加载中...</div>';
    }
    
    try {
        let query = db.collection('photos').where('isPrivate', '==', false);
        
        // 排序
        if (sortBy === 'likes') {
            query = query.orderBy('likesCount', 'desc');
        } else if (sortBy === 'recent') {
            query = query.orderBy('createdAt', 'desc');
        } else if (sortBy === 'views') {
            query = query.orderBy('views', 'desc');
        }
        
        // 分页
        if (lastVisibleDoc) {
            query = query.startAfter(lastVisibleDoc);
        }
        
        const snapshot = await query.limit(12).get();
        
        // 清除加载中提示（如果是第一次加载）
        if (!lastVisibleDoc) {
            grid.innerHTML = '';
        }
        
        if (snapshot.empty) {
            if (!lastVisibleDoc) {
                grid.innerHTML = `
                    <div class="no-photos" style="text-align:center; padding:3rem; color:var(--text-secondary);">
                        <i class="fas fa-camera" style="font-size:3rem; margin-bottom:1rem;"></i>
                        <h3>还没有照片</h3>
                        <p>上传第一张照片开始分享吧！</p>
                        <button class="btn-login" onclick="showUpload()" style="margin-top:1rem;">
                            <i class="fas fa-cloud-upload-alt"></i> 上传照片
                        </button>
                    </div>
                `;
            }
            hasMorePhotos = false;
            return;
        }
        
        // 处理照片
        snapshot.forEach(doc => {
            const photo = doc.data();
            createPhotoCard(photo, doc.id);
        });
        
        // 更新最后一个文档
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMorePhotos = snapshot.docs.length === 12;
        
    } catch (error) {
        console.error('❌ 加载照片错误:', error);
        if (!lastVisibleDoc) {
            grid.innerHTML = `
                <div class="error" style="text-align:center; padding:2rem; color:var(--danger-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:1rem;"></i>
                    <h3>加载失败</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:1rem; padding:0.5rem 1rem; background:var(--primary-color); color:white; border:none; border-radius:var(--radius); cursor:pointer;">
                        刷新页面
                    </button>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        document.getElementById('loadingMore').style.display = hasMorePhotos ? 'block' : 'none';
    }
}

function createPhotoCard(photo, photoId) {
    const grid = document.getElementById('photosGrid');
    
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.id = photoId;
    
    // 使用缩略图提高加载速度
    const imageUrl = getOptimizedImageUrl(photo.imageUrl, { width: 400, height: 250, crop: 'fill' });
    
    card.innerHTML = `
        <img src="${imageUrl}" 
             data-original="${photo.imageUrl}"
             alt="${escapeHtml(photo.title)}" 
             class="photo-image lazy-load"
             onclick="showImageDetail('${photoId}')"
             loading="lazy">
        <div class="photo-info">
            <div class="photo-header">
                <h3 class="photo-title" title="${escapeHtml(photo.title)}">${escapeHtml(photo.title)}</h3>
                ${photo.isPrivate ? '<span class="photo-privacy"><i class="fas fa-lock"></i> 私密</span>' : ''}
            </div>
            <p class="photo-description" title="${escapeHtml(photo.description || '')}">
                ${escapeHtml(photo.description || '')}
            </p>
            ${photo.keywords && photo.keywords.length > 0 ? `
                <div class="photo-keywords">
                    ${photo.keywords.slice(0, 3).map(keyword => 
                        `<span class="keyword" onclick="searchKeyword('${escapeHtml(keyword)}')">${escapeHtml(keyword)}</span>`
                    ).join('')}
                    ${photo.keywords.length > 3 ? '<span class="keyword">...</span>' : ''}
                </div>
            ` : ''}
            <div class="photo-footer">
                <div class="user-info" onclick="showUserProfile('${photo.userId}')">
                    <img src="${photo.userAvatar || generateAvatarUrl(photo.username)}" 
                         alt="${escapeHtml(photo.username)}" 
                         class="user-avatar"
                         loading="lazy">
                    <span class="username" title="${escapeHtml(photo.username)}">${escapeHtml(photo.username)}</span>
                </div>
                <div class="photo-stats">
                    <button class="like-btn ${currentUser && photo.likes && photo.likes.includes(currentUser.uid) ? 'liked' : ''}" 
                            onclick="toggleLike('${photoId}', event)"
                            title="点赞">
                        <i class="fas fa-heart"></i>
                        <span>${photo.likesCount || 0}</span>
                    </button>
                    <div class="stat" title="浏览量">
                        <i class="fas fa-eye"></i>
                        <span>${photo.views || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    grid.appendChild(card);
    
    // 初始化懒加载
    initLazyLoad(card.querySelector('.lazy-load'));
}

// ============================================
// Cloudinary 上传功能
// ============================================

async function optimizeImageForUpload(file) {
    return new Promise((resolve, reject) => {
        // 检查文件类型
        const allowedTypes = CLOUDINARY_CONFIG.allowedFormats;
        if (!allowedTypes.includes(file.type)) {
            reject(new Error(`不支持的文件格式: ${file.type}`));
            return;
        }
        
        // 检查文件大小
        if (file.size > CLOUDINARY_CONFIG.maxFileSize) {
            reject(new Error(`文件太大: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持5MB`));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算新尺寸
                let width = img.width;
                let height = img.height;
                const maxWidth = CLOUDINARY_CONFIG.optimization.maxWidth;
                
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = Math.floor(height * ratio);
                }
                
                // 设置画布
                canvas.width = width;
                canvas.height = height;
                
                // 高质量绘制
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为 Blob
                canvas.toBlob(
                    (blob) => {
                        const optimizedFile = new File(
                            [blob], 
                            file.name.replace(/\.[^/.]+$/, '') + '_optimized.jpg',
                            { type: 'image/jpeg' }
                        );
                        resolve(optimizedFile);
                    },
                    'image/jpeg',
                    CLOUDINARY_CONFIG.optimization.quality
                );
            };
            
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

async function uploadToCloudinary(file) {
    console.log('☁️ 上传到 Cloudinary...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
    
    // 添加文件夹和标签
    if (CLOUDINARY_CONFIG.folder) {
        formData.append('folder', CLOUDINARY_CONFIG.folder);
    }
    if (CLOUDINARY_CONFIG.tags) {
        formData.append('tags', CLOUDINARY_CONFIG.tags);
    }
    
    try {
        const response = await fetch(
            `${CLOUDINARY_CONFIG.apiUrl}/${CLOUDINARY_CONFIG.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ 上传成功:', data.secure_url);
        return data.secure_url;
        
    } catch (error) {
        console.error('❌ Cloudinary 上传错误:', error);
        throw error;
    }
}

async function uploadPhoto(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showNotification('请先登录', 'error');
        toggleAuthModal();
        return;
    }
    
    const fileInput = document.getElementById('photoInput');
    const file = fileInput.files[0];
    const title = document.getElementById('photoTitle').value.trim();
    const description = document.getElementById('photoDescription').value.trim();
    const isPrivate = document.getElementById('isPrivate').checked;
    
    if (!file) {
        showNotification('请选择照片', 'error');
        return;
    }
    
    if (!title) {
        showNotification('请输入照片标题', 'error');
        document.getElementById('photoTitle').focus();
        return;
    }
    
    if (selectedKeywords.length === 0) {
        showNotification('请至少添加一个关键词', 'error');
        document.getElementById('keywordInput').focus();
        return;
    }
    
    const uploadBtn = document.getElementById('uploadButton');
    const originalText = uploadBtn.innerHTML;
    
    try {
        // 禁用按钮，显示进度
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
        showUploadProgress('准备上传...', 10);
        
        // 1. 优化图片
        showUploadProgress('优化图片...', 30);
        const optimizedFile = await optimizeImageForUpload(file);
        
        // 2. 上传到 Cloudinary
        showUploadProgress('上传到云端...', 50);
        const imageUrl = await uploadToCloudinary(optimizedFile);
        
        // 3. 保存到数据库
        showUploadProgress('保存信息...', 80);
        
        const photoData = {
            // 用户信息
            userId: currentUser.uid,
            userEmail: currentUser.email,
            username: currentUser.displayName || '匿名用户',
            userAvatar: currentUser.photoURL || generateAvatarUrl(currentUser.email),
            
            // 图片信息
            title: title,
            description: description,
            keywords: selectedKeywords,
            
            // Cloudinary 信息
            imageUrl: imageUrl,
            imageThumbnail: getThumbnailUrl(imageUrl),
            imageOriginalName: file.name,
            imageSize: file.size,
            imageFormat: file.type,
            
            // 设置
            isPrivate: isPrivate,
            
            // 统计数据
            likes: [],
            likesCount: 0,
            views: 0,
            
            // 系统信息
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active'
        };
        
        // 保存到 Firestore
        const photoRef = await db.collection('photos').add(photoData);
        const photoId = photoRef.id;
        
        // 更新用户统计
        await updateUserPhotoCount(currentUser.uid);
        
        // 完成
        showUploadProgress('完成！', 100);
        showNotification('🎉 照片上传成功！', 'success');
        
        // 重置表单
        setTimeout(() => {
            resetUploadForm();
            hideUploadProgress();
            toggleUploadModal();
            
            // 重新加载照片列表
            lastVisibleDoc = null;
            hasMorePhotos = true;
            loadPhotos();
            
            // 显示刚上传的照片
            setTimeout(() => {
                showImageDetail(photoId);
            }, 1000);
            
        }, 1000);
        
    } catch (error) {
        console.error('❌ 上传失败:', error);
        hideUploadProgress();
        
        let errorMessage = '上传失败';
        if (error.message.includes('太大')) {
            errorMessage = '图片太大，请选择小于5MB的图片';
        } else if (error.message.includes('不支持')) {
            errorMessage = '仅支持 JPG、PNG、GIF、WebP 格式';
        } else if (error.message.includes('网络') || error.message.includes('Failed to fetch')) {
            errorMessage = '网络错误，请检查连接';
        } else if (error.message.includes('Invalid upload preset')) {
            errorMessage = '上传配置错误，请检查 Cloudinary 设置';
        }
        
        showNotification(`❌ ${errorMessage}`, 'error');
        
    } finally {
        // 恢复按钮状态
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    }
}

// ============================================
// 关键词管理
// ============================================

function addKeyword(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const input = document.getElementById('keywordInput');
        const keyword = input.value.trim();
        
        if (keyword && !selectedKeywords.includes(keyword)) {
            selectedKeywords.push(keyword);
            renderKeywords();
            input.value = '';
            input.focus();
        }
    }
}

function renderKeywords() {
    const container = document.getElementById('keywordsList');
    container.innerHTML = selectedKeywords.map(keyword => `
        <div class="keyword-item">
            ${escapeHtml(keyword)}
            <button class="remove-keyword" onclick="removeKeyword('${escapeHtml(keyword)}')" title="删除">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeKeyword(keyword) {
    selectedKeywords = selectedKeywords.filter(k => k !== keyword);
    renderKeywords();
}

// ============================================
// 图片详情功能
// ============================================

async function showImageDetail(photoId) {
    const modal = document.getElementById('imageModal');
    const content = document.getElementById('imageDetail');
    
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    
    try {
        const doc = await db.collection('photos').doc(photoId).get();
        if (!doc.exists) {
            content.innerHTML = '<div class="error-message">照片不存在或已被删除</div>';
            return;
        }
        
        const photo = doc.data();
        photo.id = photoId;
        
        // 检查权限
        if (photo.isPrivate && currentUser?.uid !== photo.userId) {
            content.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <i class="fas fa-lock" style="font-size:3rem; color:var(--text-secondary); margin-bottom:1rem;"></i>
                    <h3>私密照片</h3>
                    <p>这是私密照片，只有发布者可以查看</p>
                </div>
            `;
            return;
        }
        
        // 更新浏览量（如果不是自己的照片）
        if (currentUser?.uid !== photo.userId) {
            await db.collection('photos').doc(photoId).update({
                views: (photo.views || 0) + 1
            });
            photo.views = (photo.views || 0) + 1;
        }
        
        // 构建详情页面
        content.innerHTML = `
            <div class="image-container">
                <img src="${photo.imageUrl}" 
                     alt="${escapeHtml(photo.title)}"
                     onclick="toggleImageZoom(this)"
                     loading="lazy">
            </div>
            <div class="image-info">
                <div class="info-header">
                    <h2>${escapeHtml(photo.title)}</h2>
                    <div class="info-meta">
                        <div class="user" onclick="showUserProfile('${photo.userId}')">
                            <img src="${photo.userAvatar || generateAvatarUrl(photo.username)}" 
                                 alt="${escapeHtml(photo.username)}">
                            <span>${escapeHtml(photo.username)}</span>
                        </div>
                        <span class="date">${formatDate(photo.createdAt)}</span>
                    </div>
                </div>
                
                ${photo.description ? `
                    <div class="image-description">
                        <p>${escapeHtml(photo.description)}</p>
                    </div>
                ` : ''}
                
                ${photo.keywords && photo.keywords.length > 0 ? `
                    <div class="image-keywords">
                        ${photo.keywords.map(keyword => 
                            `<span class="keyword" onclick="searchKeyword('${escapeHtml(keyword)}')">${escapeHtml(keyword)}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                
                <div class="image-stats">
                    <button class="like-btn ${currentUser && photo.likes && photo.likes.includes(currentUser.uid) ? 'liked' : ''}" 
                            onclick="toggleLike('${photoId}', event)">
                        <i class="fas fa-heart"></i>
                        <span>${photo.likesCount || 0} 点赞</span>
                    </button>
                    <div class="stat">
                        <i class="fas fa-eye"></i>
                        <span>${photo.views || 0} 浏览</span>
                    </div>
                    ${currentUser?.uid === photo.userId || currentUser?.email === 'admin@example.com' ? 
                        `<button class="delete-btn" onclick="deletePhoto('${photoId}')">
                            <i class="fas fa-trash"></i> 删除
                        </button>` : ''}
                </div>
            </div>
        `;
        
        // 存储当前图片信息
        window.currentImageDetail = photo;
        
    } catch (error) {
        console.error('❌ 加载详情错误:', error);
        content.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载失败: ${error.message}</p>
                <button onclick="showImageDetail('${photoId}')" style="margin-top:1rem; padding:0.5rem 1rem; background:var(--primary-color); color:white; border:none; border-radius:var(--radius); cursor:pointer;">
                    重试
                </button>
            </div>
        `;
    }
}

function toggleImageZoom(img) {
    if (img.classList.contains('zoomed')) {
        img.classList.remove('zoomed');
        img.style.cursor = 'zoom-in';
    } else {
        img.classList.add('zoomed');
        img.style.cursor = 'zoom-out';
    }
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.classList.remove('modal-open');
    window.currentImageDetail = null;
}

// ============================================
// 点赞功能
// ============================================

async function toggleLike(photoId, event) {
    if (event) event.stopPropagation();
    
    if (!currentUser) {
        showNotification('请先登录', 'error');
        toggleAuthModal();
        return;
    }
    
    const likeBtn = event?.currentTarget || document.querySelector(`.like-btn`);
    const photoRef = db.collection('photos').doc(photoId);
    
    try {
        const doc = await photoRef.get();
        if (!doc.exists) return;
        
        const photo = doc.data();
        const likes = photo.likes || [];
        const isLiked = likes.includes(currentUser.uid);
        
        if (isLiked) {
            // 取消点赞
            await photoRef.update({
                likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                likesCount: firebase.firestore.FieldValue.increment(-1)
            });
            likeBtn?.classList.remove('liked');
        } else {
            // 点赞
            await photoRef.update({
                likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                likesCount: firebase.firestore.FieldValue.increment(1)
            });
            likeBtn?.classList.add('liked');
        }
        
        // 更新显示
        if (likeBtn) {
            const countSpan = likeBtn.querySelector('span');
            const currentCount = parseInt(countSpan.textContent) || 0;
            countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
        }
        
    } catch (error) {
        console.error('❌ 点赞错误:', error);
        showNotification('操作失败，请重试', 'error');
    }
}

// ============================================
// 删除照片
// ============================================

async function deletePhoto(photoId) {
    if (!confirm('确定要删除这张照片吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        await db.collection('photos').doc(photoId).delete();
        showNotification('照片已删除', 'success');
        
        // 关闭模态框
        closeImageModal();
        
        // 从网格中移除卡片
        const card = document.querySelector(`.photo-card[data-id="${photoId}"]`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => card.remove(), 300);
        }
        
        // 更新用户统计
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).update({
                photoCount: firebase.firestore.FieldValue.increment(-1)
            });
        }
        
    } catch (error) {
        console.error('❌ 删除错误:', error);
        showNotification('删除失败: ' + error.message, 'error');
    }
}

// ============================================
// 用户管理
// ============================================

async function loadUserProfile(userId) {
    const isCurrentUser = currentUser && currentUser.uid === userId;
    const targetId = isCurrentUser ? 'profileContent' : 'userContent';
    const container = document.getElementById(targetId);
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) {
            container.innerHTML = '<div class="error-message">用户不存在</div>';
            return;
        }
        
        const user = doc.data();
        
        container.innerHTML = `
            <div class="profile-header">
                <img src="${user.avatar || generateAvatarUrl(user.username)}" 
                     alt="${escapeHtml(user.username)}" 
                     class="profile-avatar"
                     onclick="${isCurrentUser ? 'changeAvatar()' : ''}">
                <h1 class="profile-name">${escapeHtml(user.username)}</h1>
                ${user.bio ? `<p class="profile-bio">${escapeHtml(user.bio)}</p>` : ''}
                
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-number">${user.photoCount || 0}</div>
                        <div class="stat-label">照片</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${user.likeCount || 0}</div>
                        <div class="stat-label">获赞</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${user.followerCount || 0}</div>
                        <div class="stat-label">粉丝</div>
                    </div>
                </div>
                
                ${isCurrentUser ? `
                    <div class="profile-actions">
                        <button class="btn-edit" onclick="editProfile()">
                            <i class="fas fa-edit"></i> 编辑资料
                        </button>
                        <button class="btn-settings" onclick="showSettings()">
                            <i class="fas fa-cog"></i> 设置
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div id="userPhotosGrid" class="photos-grid"></div>
        `;
        
        // 加载用户的照片
        await loadUserPhotos(userId, '#userPhotosGrid');
        
    } catch (error) {
        console.error('❌ 加载用户资料错误:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

async function loadUserPhotos(userId, target = '#photosGrid') {
    const container = document.querySelector(target);
    if (!container) return;
    
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        let query = db.collection('photos').where('userId', '==', userId);
        
        // 如果不是当前用户，只显示公开照片
        if (!currentUser || currentUser.uid !== userId) {
            query = query.where('isPrivate', '==', false);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').limit(20).get();
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="no-photos" style="text-align:center; padding:3rem; color:var(--text-secondary);">
                    <i class="fas fa-camera" style="font-size:3rem; margin-bottom:1rem;"></i>
                    <h3>还没有照片</h3>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const photo = doc.data();
            createPhotoCard(photo, doc.id);
        });
        
    } catch (error) {
        console.error('❌ 加载用户照片错误:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

async function editProfile() {
    if (!currentUser) return;
    
    const newUsername = prompt('请输入新用户名:', currentUser.displayName || '');
    if (!newUsername || newUsername.trim() === '') return;
    
    const newBio = prompt('请输入新个人简介:', '');
    
    try {
        // 更新认证信息
        await currentUser.updateProfile({
            displayName: newUsername
        });
        
        // 更新用户文档
        await db.collection('users').doc(currentUser.uid).update({
            username: newUsername,
            bio: newBio || '',
            avatar: generateAvatarUrl(newUsername),
            updatedAt: new Date().toISOString()
        });
        
        // 更新所有照片的用户名
        const batch = db.batch();
        const photosSnapshot = await db.collection('photos')
            .where('userId', '==', currentUser.uid)
            .get();
        
        photosSnapshot.forEach(doc => {
            batch.update(doc.ref, { 
                username: newUsername,
                userAvatar: generateAvatarUrl(newUsername)
            });
        });
        
        await batch.commit();
        
        showNotification('资料更新成功', 'success');
        loadUserProfile(currentUser.uid);
        
    } catch (error) {
        console.error('❌ 更新资料错误:', error);
        showNotification('更新失败: ' + error.message, 'error');
    }
}

// ============================================
// 搜索功能
// ============================================

function searchContent() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showNotification('请输入搜索内容', 'info');
        return;
    }
    
    showSearchResults(query);
}

async function showSearchResults(query) {
    hideAllSections();
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="loading">搜索中...</div>';
    document.getElementById('searchSection').classList.remove('hidden');
    
    try {
        let html = `<h2><i class="fas fa-search"></i> 搜索结果: "${escapeHtml(query)}"</h2>`;
        
        // 搜索用户
        const usersSnapshot = await db.collection('users')
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .limit(10)
            .get();
        
        if (!usersSnapshot.empty) {
            html += '<h3><i class="fas fa-users"></i> 用户</h3><div class="users-grid">';
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                html += `
                    <div class="user-card" onclick="showUserProfile('${user.uid}')">
                        <img src="${user.avatar || generateAvatarUrl(user.username)}" 
                             alt="${escapeHtml(user.username)}" 
                             class="user-avatar-large">
                        <div class="user-info-card">
                            <h4>${escapeHtml(user.username)}</h4>
                            <p>${escapeHtml(user.bio || '')}</p>
                            <span class="user-stats">${user.photoCount || 0} 照片</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // 搜索照片（标题和关键词）
        const photosSnapshot = await db.collection('photos')
            .where('isPrivate', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const filteredPhotos = [];
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            if (photo.title.includes(query) || 
                (photo.keywords && photo.keywords.some(k => k.includes(query)))) {
                filteredPhotos.push({ ...photo, id: doc.id });
            }
        });
        
        if (filteredPhotos.length > 0) {
            html += `<h3><i class="fas fa-images"></i> 照片 (${filteredPhotos.length})</h3><div class="photos-grid">`;
            filteredPhotos.forEach(photo => {
                html += `
                    <div class="photo-card">
                        <img src="${getOptimizedImageUrl(photo.imageUrl, { width: 400, height: 250, crop: 'fill' })}" 
                             alt="${escapeHtml(photo.title)}" 
                             onclick="showImageDetail('${photo.id}')"
                             loading="lazy">
                        <div class="photo-info">
                            <h3>${escapeHtml(photo.title)}</h3>
                            <p>by ${escapeHtml(photo.username)}</p>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        if (usersSnapshot.empty && filteredPhotos.length === 0) {
            html = `
                <div class="no-results" style="text-align:center; padding:3rem;">
                    <i class="fas fa-search" style="font-size:3rem; color:var(--text-secondary); margin-bottom:1rem;"></i>
                    <h3>没有找到相关结果</h3>
                    <p>尝试其他关键词或上传新照片</p>
                </div>
            `;
        }
        
        resultsDiv.innerHTML = html;
        
    } catch (error) {
        console.error('❌ 搜索错误:', error);
        resultsDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>搜索失败: ${error.message}</p>
            </div>
        `;
    }
}

function searchKeyword(keyword) {
    document.getElementById('searchInput').value = keyword;
    searchContent();
}

// ============================================
// 页面导航
// ============================================

function showHome() {
    hideAllSections();
    document.getElementById('homeSection').classList.remove('hidden');
    document.title = '光影相册 - 照片分享社区';
}

function showUpload() {
    if (!currentUser) {
        showNotification('请先登录', 'error');
        toggleAuthModal();
        return;
    }
    toggleUploadModal();
}

function showProfile() {
    if (!currentUser) {
        showNotification('请先登录', 'error');
        toggleAuthModal();
        return;
    }
    hideAllSections();
    document.getElementById('profileSection').classList.remove('hidden');
    document.title = `我的资料 - ${currentUser.displayName || '用户'}`;
    loadUserProfile(currentUser.uid);
}

function showUserProfile(userId) {
    hideAllSections();
    document.getElementById('userSection').classList.remove('hidden');
    loadUserProfile(userId);
}

function hideAllSections() {
    document.getElementById('homeSection').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('searchSection').classList.add('hidden');
}

// ============================================
// 上传模态框管理
// ============================================

function toggleUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        resetUploadForm();
    }
}

function previewImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function showUploadProgress(message, percent) {
    const container = document.getElementById('uploadProgressContainer');
    const text = document.getElementById('uploadProgressText');
    const fill = document.getElementById('uploadProgressFill');
    
    if (container && text && fill) {
        container.style.display = 'block';
        text.textContent = message;
        fill.style.width = `${percent}%`;
    }
}

function hideUploadProgress() {
    const container = document.getElementById('uploadProgressContainer');
    if (container) {
        container.style.display = 'none';
        document.getElementById('uploadProgressFill').style.width = '0%';
    }
}

function resetUploadForm() {
    document.getElementById('uploadForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    selectedKeywords = [];
    renderKeywords();
    hideUploadProgress();
}

// ============================================
// 拖拽上传
// ============================================

function initDragAndDrop() {
    const uploadArea = document.getElementById('uploadDropZone');
    const fileInput = document.getElementById('photoInput');
    
    if (!uploadArea || !fileInput) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        uploadArea.classList.add('drag-over');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            previewImage({ target: fileInput });
        }
    }
}

// ============================================
// 移动端优化
// ============================================

function initMobileOptimizations() {
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
    
    // 改进触摸滚动
    document.addEventListener('touchstart', function() {}, { passive: true });
    
    // 移动端菜单切换
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // 点击菜单外区域关闭菜单
    document.addEventListener('click', function(event) {
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (navMenu && navMenu.classList.contains('active') && 
            !navMenu.contains(event.target) && 
            !navToggle.contains(event.target)) {
            navMenu.classList.remove('active');
        }
    });
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.classList.toggle('active');
    }
}

// ============================================
// 懒加载
// ============================================

function initLazyLoad(img) {
    if (!img || !img.classList.contains('lazy-load')) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const originalSrc = img.getAttribute('data-original');
                
                if (originalSrc) {
                    img.src = originalSrc;
                    img.classList.remove('lazy-load');
                }
                
                observer.unobserve(img);
            }
        });
    });
    
    observer.observe(img);
}

// ============================================
// 统计功能
// ============================================

async function updateStats() {
    try {
        const photosSnapshot = await db.collection('photos')
            .where('isPrivate', '==', false)
            .get();
        
        const usersSnapshot = await db.collection('users').get();
        
        const statsInfo = document.getElementById('statsInfo');
        if (statsInfo) {
            statsInfo.textContent = `已分享 ${photosSnapshot.size} 张照片 · ${usersSnapshot.size} 位用户`;
        }
        
    } catch (error) {
        console.error('❌ 统计更新错误:', error);
    }
}

// ============================================
// 工具函数
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateAvatarUrl(username) {
    if (!username) username = 'User';
    const colors = ['6366f1', '8b5cf6', '3b82f6', '10b981', 'f59e0b', 'ef4444'];
    const color = colors[username.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${color}&color=fff&size=150`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000) {
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes}分钟前`;
        }
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}小时前`;
    }
    
    // 昨天
    if (diff < 48 * 60 * 60 * 1000) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}天前`;
    }
    
    // 更早
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getOptimizedImageUrl(originalUrl, options = {}) {
    if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
        return originalUrl;
    }
    
    const transformations = [];
    
    if (options.width) {
        transformations.push(`w_${options.width}`);
    }
    if (options.height) {
        transformations.push(`h_${options.height}`);
    }
    if (options.crop) {
        transformations.push(`c_${options.crop}`);
    }
    if (options.quality) {
        transformations.push(`q_${options.quality}`);
    }
    if (options.format) {
        transformations.push(`f_${options.format}`);
    }
    
    if (transformations.length === 0) {
        return originalUrl.replace('/upload/', '/upload/q_auto,f_auto/');
    }
    
    const transformString = transformations.join(',');
    return originalUrl.replace('/upload/', `/upload/${transformString}/`);
}

function getThumbnailUrl(originalUrl) {
    return getOptimizedImageUrl(originalUrl, {
        width: CLOUDINARY_CONFIG.thumbnail.width,
        height: CLOUDINARY_CONFIG.thumbnail.height,
        crop: CLOUDINARY_CONFIG.thumbnail.crop,
        quality: 'auto',
        format: 'auto'
    });
}

async function updateUserPhotoCount(userId) {
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            photoCount: firebase.firestore.FieldValue.increment(1),
            lastUploadTime: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ 更新用户统计失败:', error);
    }
}

// ============================================
// 通知系统
// ============================================

function showNotification(message, type = 'info') {
    // 移除旧的通知
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // 创建新通知
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => notification.classList.add('show'), 10);
    
    // 3秒后移除
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ============================================
// 页面信息
// ============================================

function showAbout() {
    showNotification('光影相册 - 分享每一刻精彩', 'info');
}

function showTerms() {
    showNotification('使用条款：请尊重他人版权和隐私', 'info');
}

function showPrivacy() {
    showNotification('隐私政策：我们保护您的个人信息安全', 'info');
}

// ============================================
// 无限滚动
// ============================================

window.addEventListener('scroll', () => {
    if (isLoading || !hasMorePhotos) return;
    
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadPhotos();
    }
});

// ============================================
// 导出到全局
// ============================================

// 确保所有函数都可以全局访问
window.toggleTheme = toggleTheme;
window.toggleAuthModal = toggleAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.handleAuth = handleAuth;
window.searchContent = searchContent;
window.showHome = showHome;
window.showUpload = showUpload;
window.showProfile = showProfile;
window.showUserProfile = showUserProfile;
window.uploadPhoto = uploadPhoto;
window.addKeyword = addKeyword;
window.removeKeyword = removeKeyword;
window.previewImage = previewImage;
window.toggleUploadModal = toggleUploadModal;
window.closeImageModal = closeImageModal;
window.showImageDetail = showImageDetail;
window.toggleImageZoom = toggleImageZoom;
window.toggleLike = toggleLike;
window.deletePhoto = deletePhoto;
window.searchKeyword = searchKeyword;
window.editProfile = editProfile;
window.showAbout = showAbout;
window.showTerms = showTerms;
window.showPrivacy = showPrivacy;
window.toggleMobileMenu = toggleMobileMenu;

console.log('🚀 应用初始化完成！');