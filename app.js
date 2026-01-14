// ============================================
// 配置和初始化
// ============================================

// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyCqfE3hThLmbDWQE987ho7LrS7InLx_S8M",
    authDomain: "photoshareapp-15f24.firebaseapp.com",
    projectId: "photoshareapp-15f24",
    storageBucket: "photoshareapp-15f24.firebasestorage.app",
    messagingSenderId: "698614095306",
    appId: "1:698614095306:web:9d01ec9c4f03f6e9944333",
    measurementId: "G-QK9HBFPGC8"
};

// Cloudinary 配置
const CLOUDINARY_CONFIG = {
    cloudName: 'dy77idija',
    uploadPreset: 'photo_share_app',
    apiKey: '735299868247252',
    apiUrl: 'https://api.cloudinary.com/v1_1',
    unsignedUpload: true,
    folder: 'photo_share/photos',
    tags: 'photo_share,user_upload',
    optimization: { maxWidth: 1200, quality: 0.8, format: 'auto' },
    thumbnail: { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
    allowedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024
};

// 管理员邮箱列表
const ADMIN_EMAILS = [
    'admin@example.com',
    'xu@example.com'
];

// 全局变量
let currentUser = null;
let currentTheme = 'light';
let selectedKeywords = [];
let lastVisibleDoc = null;
let isLoading = false;
let hasMorePhotos = true;
let isAdmin = false;
let unreadMessageCount = 0;
let messageListeners = {};

// ============================================
// DOM 加载初始化
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 应用初始化...');
    
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase 初始化成功');
    } catch (error) {
        console.error('❌ Firebase 初始化失败:', error);
        showNotification('Firebase 初始化失败，请刷新页面', 'error');
        return;
    }
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    window.auth = auth;
    window.db = db;
    
    loadTheme();
    initDragAndDrop();
    initMobileOptimizations();
    validateCloudinaryConfig();
    
    // 监听认证状态
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        isAdmin = user && ADMIN_EMAILS.includes(user.email);
        
        updateUI();
        
        if (user) {
            console.log('👤 用户登录:', user.email);
            console.log('👑 管理员状态:', isAdmin);
            
            try {
                await loadUserProfile(user.uid);
                await loadUserPhotos(user.uid);
                await checkUnreadMessages();
                setupMessageListeners();
            } catch (error) {
                console.error('加载用户数据失败:', error);
            }
        } else {
            console.log('👤 用户未登录');
            cleanupMessageListeners();
        }
        
        loadPhotos();
        updateStats();
    });
    
    // 初始加载完成提示
    setTimeout(() => {
        if (!currentUser) {
            showNotification('欢迎使用光影相册！请登录或注册开始分享照片。', 'info');
        }
    }, 1000);
    
    // 绑定搜索输入框事件
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchContent();
            }
        });
    }
    
    // 初始化移动端搜索
    initMobileSearch();
});

// ============================================
// 移动端搜索功能
// ============================================

function initMobileSearch() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;
    
    // 创建移动端搜索按钮
    const mobileSearchBtn = document.createElement('button');
    mobileSearchBtn.className = 'mobile-search-btn';
    mobileSearchBtn.innerHTML = '<i class="fas fa-search"></i>';
    mobileSearchBtn.title = '搜索';
    mobileSearchBtn.onclick = toggleMobileSearch;
    
    // 插入到导航栏切换按钮之前
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navContainer.insertBefore(mobileSearchBtn, navToggle);
    } else {
        navContainer.appendChild(mobileSearchBtn);
    }
    
    // 创建移动端搜索模态框
    const mobileSearchModal = document.createElement('div');
    mobileSearchModal.className = 'mobile-search-modal';
    mobileSearchModal.innerHTML = `
        <div class="mobile-search-header">
            <button class="mobile-search-back" onclick="toggleMobileSearch()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <div class="mobile-search-input-container">
                <input type="text" 
                       id="mobileSearchInput" 
                       placeholder="搜索关键词、用户名或描述..."
                       autocomplete="off">
                <button class="mobile-search-clear" onclick="clearMobileSearch()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <button class="mobile-search-submit" onclick="performMobileSearch()">
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div class="mobile-search-suggestions" id="mobileSearchSuggestions"></div>
        <div class="mobile-search-history" id="mobileSearchHistory"></div>
        <div class="mobile-search-trending" id="mobileSearchTrending"></div>
    `;
    
    document.body.appendChild(mobileSearchModal);
    
    // 初始化移动端搜索建议
    initSearchSuggestions();
}

function toggleMobileSearch() {
    const modal = document.querySelector('.mobile-search-modal');
    const searchInput = document.getElementById('mobileSearchInput');
    
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.classList.remove('mobile-search-open');
    } else {
        modal.classList.add('active');
        document.body.classList.add('mobile-search-open');
        if (searchInput) {
            searchInput.focus();
            loadSearchHistory();
            loadTrendingSearches();
        }
    }
}

function clearMobileSearch() {
    const searchInput = document.getElementById('mobileSearchInput');
    const suggestions = document.getElementById('mobileSearchSuggestions');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    if (suggestions) {
        suggestions.innerHTML = '';
    }
}

function performMobileSearch() {
    const searchInput = document.getElementById('mobileSearchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    
    if (!query) {
        showNotification('请输入搜索内容', 'info');
        return;
    }
    
    // 保存到搜索历史
    saveToSearchHistory(query);
    
    // 执行搜索
    searchContent(query);
    
    // 关闭移动端搜索
    toggleMobileSearch();
}

// ============================================
// 智能搜索功能
// ============================================

// 处理搜索输入
let searchTimeout;
function handleSearchInput(event) {
    const query = event.target.value.trim();
    const suggestionsContainer = document.getElementById('searchSuggestions');
    
    // 清除之前的定时器
    clearTimeout(searchTimeout);
    
    if (!suggestionsContainer) return;
    
    if (!query) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    // 防抖处理
    searchTimeout = setTimeout(async () => {
        try {
            const suggestions = await getSearchSuggestions(query);
            displaySearchSuggestions(suggestions, query);
        } catch (error) {
            console.error('获取搜索建议失败:', error);
        }
    }, 300);
}

// 获取搜索建议
async function getSearchSuggestions(query) {
    if (!query || query.length < 1) return [];
    
    const suggestions = {
        keywords: [],
        users: [],
        photos: []
    };
    
    try {
        const lowerQuery = query.toLowerCase();
        
        // 1. 搜索关键词（从现有照片中提取）
        const photosSnapshot = await db.collection('photos')
            .where('isPrivate', '==', false)
            .limit(100)
            .get();
        
        const keywordsSet = new Set();
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            if (photo.keywords && Array.isArray(photo.keywords)) {
                photo.keywords.forEach(keyword => {
                    if (keyword.toLowerCase().includes(lowerQuery)) {
                        keywordsSet.add(keyword);
                    }
                });
            }
            
            // 从标题和描述中提取关键词
            const text = (photo.title + ' ' + photo.description).toLowerCase();
            if (text.includes(lowerQuery)) {
                // 提取相关的关键词
                const words = text.split(/[\s,.!?]+/);
                words.forEach(word => {
                    if (word.length > 1 && word.includes(lowerQuery)) {
                        keywordsSet.add(word);
                    }
                });
            }
        });
        
        suggestions.keywords = Array.from(keywordsSet).slice(0, 10);
        
        // 2. 搜索用户
        const usersSnapshot = await db.collection('users')
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .limit(5)
            .get();
        
        usersSnapshot.forEach(doc => {
            suggestions.users.push(doc.data());
        });
        
        // 3. 搜索相关照片标题
        const titleMatches = [];
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            if (photo.title.toLowerCase().includes(lowerQuery)) {
                titleMatches.push(photo.title);
            }
        });
        suggestions.photos = titleMatches.slice(0, 5);
        
    } catch (error) {
        console.error('获取搜索建议失败:', error);
    }
    
    return suggestions;
}

// 显示搜索建议
function displaySearchSuggestions(suggestions, query) {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) return;
    
    let html = '';
    
    if (suggestions.keywords.length > 0) {
        html += `
            <div class="suggestion-category">
                <div class="category-title"><i class="fas fa-hashtag"></i> 相关关键词</div>
                ${suggestions.keywords.map(keyword => `
                    <div class="suggestion-item" onclick="selectSuggestion('${escapeHtml(keyword)}')">
                        <i class="fas fa-search"></i>
                        <span class="suggestion-text">${escapeHtml(keyword)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (suggestions.users.length > 0) {
        html += `
            <div class="suggestion-category">
                <div class="category-title"><i class="fas fa-users"></i> 相关用户</div>
                ${suggestions.users.map(user => `
                    <div class="suggestion-item" onclick="searchUser('${escapeHtml(user.username)}')">
                        <img src="${user.avatar || generateAvatarUrl(user.username)}" 
                             alt="${escapeHtml(user.username)}"
                             class="suggestion-avatar">
                        <div class="suggestion-user-info">
                            <div class="suggestion-username">${escapeHtml(user.username)}</div>
                            ${user.bio ? `<div class="suggestion-bio">${escapeHtml(user.bio.substring(0, 30))}${user.bio.length > 30 ? '...' : ''}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (suggestions.photos.length > 0) {
        html += `
            <div class="suggestion-category">
                <div class="category-title"><i class="fas fa-images"></i> 相关照片</div>
                ${suggestions.photos.map(title => `
                    <div class="suggestion-item" onclick="selectSuggestion('${escapeHtml(title)}')">
                        <i class="fas fa-camera"></i>
                        <span class="suggestion-text">${escapeHtml(title)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 如果没有建议，显示一些通用建议
    if (!html) {
        html = `
            <div class="suggestion-category">
                <div class="category-title"><i class="fas fa-lightbulb"></i> 搜索建议</div>
                <div class="suggestion-item" onclick="selectSuggestion('${query} 照片')">
                    <i class="fas fa-search"></i>
                    <span class="suggestion-text">${escapeHtml(query)} 照片</span>
                </div>
                <div class="suggestion-item" onclick="selectSuggestion('${query} 风景')">
                    <i class="fas fa-search"></i>
                    <span class="suggestion-text">${escapeHtml(query)} 风景</span>
                </div>
                <div class="suggestion-item" onclick="selectSuggestion('${query} 人像')">
                    <i class="fas fa-search"></i>
                    <span class="suggestion-text">${escapeHtml(query)} 人像</span>
                </div>
            </div>
        `;
    }
    
    // 添加搜索历史
    const searchHistory = getSearchHistory();
    if (searchHistory.length > 0) {
        html += `
            <div class="suggestion-category">
                <div class="category-title"><i class="fas fa-history"></i> 搜索历史</div>
                ${searchHistory.slice(0, 5).map(item => `
                    <div class="suggestion-item" onclick="selectSuggestion('${escapeHtml(item)}')">
                        <i class="fas fa-clock"></i>
                        <span class="suggestion-text">${escapeHtml(item)}</span>
                        <button class="clear-history-item" onclick="removeFromSearchHistory('${escapeHtml(item)}', event)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    suggestionsContainer.innerHTML = html;
    suggestionsContainer.style.display = 'block';
}

// 选择建议
function selectSuggestion(text) {
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    if (searchInput) {
        searchInput.value = text;
        searchInput.focus();
    }
    
    if (mobileSearchInput) {
        mobileSearchInput.value = text;
    }
    
    // 隐藏建议
    hideSearchSuggestions();
    
    // 执行搜索
    searchContent(text);
}

// 隐藏搜索建议
function hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
}

// 搜索用户
function searchUser(username) {
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    if (searchInput) {
        searchInput.value = username;
    }
    
    if (mobileSearchInput) {
        mobileSearchInput.value = username;
    }
    
    searchContent(username);
}

// ============================================
// 改进的搜索功能
// ============================================

function searchContent(query = null) {
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    let searchQuery = query;
    
    if (!searchQuery) {
        if (searchInput) {
            searchQuery = searchInput.value.trim();
        } else if (mobileSearchInput) {
            searchQuery = mobileSearchInput.value.trim();
        }
    }
    
    if (!searchQuery) {
        showNotification('请输入搜索内容', 'info');
        return;
    }
    
    // 保存搜索历史
    saveToSearchHistory(searchQuery);
    
    // 执行搜索
    performIntelligentSearch(searchQuery);
}

async function performIntelligentSearch(query) {
    showSearchResults(query);
}

// 智能搜索
async function showSearchResults(query) {
    hideAllSections();
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="loading">搜索中...</div>';
    document.getElementById('searchSection').classList.remove('hidden');
    document.title = `搜索: ${query} - 光影相册`;
    
    try {
        const lowerQuery = query.toLowerCase();
        let html = `
            <div class="search-results-header">
                <h2><i class="fas fa-search"></i> 搜索结果: "${escapeHtml(query)}"</h2>
                <div class="search-tips">
                    <small><i class="fas fa-info-circle"></i> 正在为您智能匹配相关结果...</small>
                </div>
            </div>
            
            <div class="search-tabs" id="searchTabs">
                <button class="search-tab active" data-tab="all">全部</button>
                <button class="search-tab" data-tab="photos">照片</button>
                <button class="search-tab" data-tab="users">用户</button>
                <button class="search-tab" data-tab="keywords">关键词</button>
            </div>
            
            <div class="search-content">
                <div id="searchAllTab" class="search-tab-content active">
                    <div class="loading-section">加载中...</div>
                </div>
                <div id="searchPhotosTab" class="search-tab-content"></div>
                <div id="searchUsersTab" class="search-tab-content"></div>
                <div id="searchKeywordsTab" class="search-tab-content"></div>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
        
        // 为标签页添加点击事件
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                switchSearchTab(tabName);
            });
        });
        
        // 并行加载所有搜索结果
        await Promise.all([
            loadSearchPhotos(query, lowerQuery),
            loadSearchUsers(query, lowerQuery),
            loadSearchKeywords(query, lowerQuery)
        ]);
        
        // 加载全部标签页内容
        loadSearchAllTab();
        
    } catch (error) {
        console.error('❌ 搜索错误:', error);
        resultsDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>搜索失败: ${error.message}</p>
                <button onclick="searchContent('${escapeHtml(query)}')" style="margin-top:1rem; padding:0.5rem 1rem; background:var(--primary-color); color:white; border:none; border-radius:var(--radius); cursor:pointer;">
                    重试搜索
                </button>
            </div>
        `;
    }
}

// 切换搜索标签页
function switchSearchTab(tabName) {
    // 更新标签页状态
    document.querySelectorAll('.search-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.search-tab[data-tab="${tabName}"]`).classList.add('active');
    
    // 显示对应的内容
    document.querySelectorAll('.search-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`search${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
}

// 加载搜索照片
async function loadSearchPhotos(query, lowerQuery) {
    const photosTab = document.getElementById('searchPhotosTab');
    if (!photosTab) return;
    
    try {
        // 获取所有公开照片
        const photosSnapshot = await db.collection('photos')
            .where('isPrivate', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const matchedPhotos = [];
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            const photoId = doc.id;
            
            // 智能匹配：检查标题、描述、关键词
            const titleMatch = photo.title.toLowerCase().includes(lowerQuery);
            const descMatch = photo.description && photo.description.toLowerCase().includes(lowerQuery);
            const keywordMatch = photo.keywords && photo.keywords.some(keyword => 
                keyword.toLowerCase().includes(lowerQuery)
            );
            
            // 模糊匹配：检查部分匹配
            const words = query.split(' ').filter(w => w.length > 0);
            let fuzzyMatch = false;
            
            if (words.length > 0) {
                const allText = (photo.title + ' ' + (photo.description || '')).toLowerCase();
                fuzzyMatch = words.some(word => allText.includes(word.toLowerCase()));
            }
            
            if (titleMatch || descMatch || keywordMatch || fuzzyMatch) {
                // 计算匹配度分数
                let score = 0;
                if (titleMatch) score += 3; // 标题匹配权重最高
                if (descMatch) score += 2;  // 描述匹配次之
                if (keywordMatch) score += photo.keywords.filter(k => 
                    k.toLowerCase().includes(lowerQuery)
                ).length; // 每个匹配的关键词加1分
                if (fuzzyMatch) score += 1; // 模糊匹配
                
                matchedPhotos.push({
                    ...photo,
                    id: photoId,
                    matchScore: score
                });
            }
        });
        
        // 按匹配度排序
        matchedPhotos.sort((a, b) => b.matchScore - a.matchScore);
        
        if (matchedPhotos.length === 0) {
            photosTab.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-images"></i>
                    <h3>没有找到相关照片</h3>
                    <p>尝试其他关键词或上传新照片</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="search-stats">
                <p>找到 <strong>${matchedPhotos.length}</strong> 张相关照片</p>
                <div class="search-sort">
                    <select onchange="sortSearchPhotos(this.value, '${escapeHtml(query)}')">
                        <option value="relevance">按相关度</option>
                        <option value="recent">按时间</option>
                        <option value="popular">按热度</option>
                    </select>
                </div>
            </div>
            <div class="photos-grid search-photos-grid">
        `;
        
        matchedPhotos.slice(0, 20).forEach(photo => {
            html += createSearchPhotoCard(photo);
        });
        
        html += '</div>';
        
        if (matchedPhotos.length > 20) {
            html += `
                <div class="search-more-results">
                    <p>还有 ${matchedPhotos.length - 20} 张相关照片</p>
                    <button onclick="showAllSearchPhotos('${escapeHtml(query)}')" class="btn-show-more">
                        <i class="fas fa-eye"></i> 查看全部
                    </button>
                </div>
            `;
        }
        
        photosTab.innerHTML = html;
        
        // 存储搜索结果用于排序
        window.searchPhotosResults = matchedPhotos;
        
    } catch (error) {
        console.error('加载搜索照片失败:', error);
        photosTab.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载照片失败: ${error.message}</p>
            </div>
        `;
    }
}

// 创建搜索照片卡片
function createSearchPhotoCard(photo) {
    const thumbnailUrl = getSmartThumbnailUrl(photo.imageUrl, photo.imageSize);
    
    return `
        <div class="photo-card search-photo-card">
            <div class="photo-image-container" onclick="showImageDetail('${photo.id}')">
                <img src="${thumbnailUrl}" 
                     alt="${escapeHtml(photo.title)}" 
                     class="photo-image"
                     loading="lazy">
                <div class="image-overlay">
                    <div class="overlay-content">
                        <i class="fas fa-expand"></i>
                    </div>
                </div>
            </div>
            <div class="photo-info">
                <h3 class="photo-title">${escapeHtml(photo.title)}</h3>
                <div class="photo-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(photo.username)}</span>
                    <span><i class="fas fa-heart"></i> ${photo.likesCount || 0}</span>
                    <span><i class="fas fa-eye"></i> ${photo.views || 0}</span>
                </div>
                ${photo.description ? `
                    <p class="photo-description">${escapeHtml(photo.description.substring(0, 80))}${photo.description.length > 80 ? '...' : ''}</p>
                ` : ''}
                ${photo.keywords && photo.keywords.length > 0 ? `
                    <div class="photo-keywords">
                        ${photo.keywords.slice(0, 3).map(keyword => 
                            `<span class="keyword ${keyword.toLowerCase().includes((document.getElementById('searchInput')?.value || '').toLowerCase()) ? 'highlight' : ''}" 
                                  onclick="searchKeyword('${escapeHtml(keyword)}')">
                                ${escapeHtml(keyword)}
                            </span>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// 加载搜索用户
async function loadSearchUsers(query, lowerQuery) {
    const usersTab = document.getElementById('searchUsersTab');
    if (!usersTab) return;
    
    try {
        // 获取所有用户
        const usersSnapshot = await db.collection('users').get();
        
        const matchedUsers = [];
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            
            // 智能匹配：用户名、个人介绍、邮箱
            const usernameMatch = user.username.toLowerCase().includes(lowerQuery);
            const bioMatch = user.bio && user.bio.toLowerCase().includes(lowerQuery);
            const emailMatch = user.email && user.email.toLowerCase().includes(lowerQuery);
            
            // 模糊匹配
            const words = query.split(' ').filter(w => w.length > 0);
            let fuzzyMatch = false;
            
            if (words.length > 0) {
                const allText = (user.username + ' ' + (user.bio || '')).toLowerCase();
                fuzzyMatch = words.some(word => allText.includes(word.toLowerCase()));
            }
            
            if (usernameMatch || bioMatch || emailMatch || fuzzyMatch) {
                // 计算匹配度
                let score = 0;
                if (usernameMatch) score += 3;
                if (bioMatch) score += 2;
                if (emailMatch) score += 1;
                if (fuzzyMatch) score += 1;
                
                matchedUsers.push({
                    ...user,
                    matchScore: score
                });
            }
        });
        
        // 按匹配度排序
        matchedUsers.sort((a, b) => b.matchScore - a.matchScore);
        
        if (matchedUsers.length === 0) {
            usersTab.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-users"></i>
                    <h3>没有找到相关用户</h3>
                    <p>尝试其他用户名或关键词</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="search-stats">
                <p>找到 <strong>${matchedUsers.length}</strong> 位相关用户</p>
            </div>
            <div class="users-grid search-users-grid">
        `;
        
        matchedUsers.slice(0, 15).forEach(user => {
            html += `
                <div class="user-card search-user-card" onclick="showUserProfile('${user.uid}')">
                    <img src="${user.avatar || generateAvatarUrl(user.username)}" 
                         alt="${escapeHtml(user.username)}" 
                         class="user-avatar-large">
                    <div class="user-info-card">
                        <h4>${escapeHtml(user.username)}</h4>
                        ${user.bio ? `<p class="user-bio">${escapeHtml(user.bio.substring(0, 60))}${user.bio.length > 60 ? '...' : ''}</p>` : ''}
                        <div class="user-stats">
                            <span><i class="fas fa-camera"></i> ${user.photoCount || 0} 照片</span>
                            <span><i class="fas fa-heart"></i> ${user.likeCount || 0} 获赞</span>
                            <span><i class="fas fa-users"></i> ${user.followerCount || 0} 粉丝</span>
                        </div>
                        ${user.email && user.email.includes(query) ? `
                            <div class="email-match">
                                <i class="fas fa-envelope"></i> 邮箱匹配
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        usersTab.innerHTML = html;
        
    } catch (error) {
        console.error('加载搜索用户失败:', error);
        usersTab.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载用户失败: ${error.message}</p>
            </div>
        `;
    }
}

// 加载搜索关键词
async function loadSearchKeywords(query, lowerQuery) {
    const keywordsTab = document.getElementById('searchKeywordsTab');
    if (!keywordsTab) return;
    
    try {
        // 从所有照片中提取关键词
        const photosSnapshot = await db.collection('photos')
            .where('isPrivate', '==', false)
            .limit(200)
            .get();
        
        const keywordMap = new Map();
        
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            
            if (photo.keywords && Array.isArray(photo.keywords)) {
                photo.keywords.forEach(keyword => {
                    const lowerKeyword = keyword.toLowerCase();
                    
                    // 检查是否匹配查询
                    if (lowerKeyword.includes(lowerQuery) || lowerQuery.includes(lowerKeyword)) {
                        if (keywordMap.has(keyword)) {
                            keywordMap.set(keyword, keywordMap.get(keyword) + 1);
                        } else {
                            keywordMap.set(keyword, 1);
                        }
                    }
                });
            }
            
            // 从标题中提取单词作为关键词
            const titleWords = photo.title.split(/[\s,.!?]+/).filter(word => 
                word.length > 1 && word.toLowerCase().includes(lowerQuery)
            );
            
            titleWords.forEach(word => {
                if (keywordMap.has(word)) {
                    keywordMap.set(word, keywordMap.get(word) + 1);
                } else {
                    keywordMap.set(word, 1);
                }
            });
        });
        
        // 转换为数组并按频率排序
        const keywordArray = Array.from(keywordMap.entries())
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count);
        
        if (keywordArray.length === 0) {
            keywordsTab.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-hashtag"></i>
                    <h3>没有找到相关关键词</h3>
                    <p>尝试其他搜索词</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="search-stats">
                <p>找到 <strong>${keywordArray.length}</strong> 个相关关键词</p>
            </div>
            <div class="keywords-cloud">
        `;
        
        // 计算最大最小频率
        const counts = keywordArray.map(k => k.count);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        
        keywordArray.forEach(({ keyword, count }) => {
            // 计算字体大小（基于频率）
            const fontSize = 14 + (count - minCount) / (maxCount - minCount) * 10;
            
            html += `
                <span class="keyword-cloud-item" 
                      style="font-size: ${fontSize}px;"
                      onclick="searchKeyword('${escapeHtml(keyword)}')"
                      title="${count} 张照片">
                    ${escapeHtml(keyword)}
                    <span class="keyword-count">${count}</span>
                </span>
            `;
        });
        
        html += '</div>';
        
        // 添加热门组合关键词
        const combinedKeywords = generateCombinedKeywords(keywordArray.map(k => k.keyword), query);
        if (combinedKeywords.length > 0) {
            html += `
                <div class="combined-keywords">
                    <h4><i class="fas fa-lightbulb"></i> 相关组合</h4>
                    <div class="combined-keywords-list">
                        ${combinedKeywords.map(combined => `
                            <span class="combined-keyword" onclick="searchKeyword('${escapeHtml(combined)}')">
                                ${escapeHtml(combined)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        keywordsTab.innerHTML = html;
        
    } catch (error) {
        console.error('加载搜索关键词失败:', error);
        keywordsTab.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载关键词失败: ${error.message}</p>
            </div>
        `;
    }
}

// 生成组合关键词
function generateCombinedKeywords(keywords, query) {
    const combinations = new Set();
    const lowerQuery = query.toLowerCase();
    
    // 常见的组合词
    const commonModifiers = ['照片', '图片', '风景', '人像', '摄影', '作品', '艺术', '创意', '美丽'];
    
    keywords.forEach(keyword => {
        commonModifiers.forEach(modifier => {
            combinations.add(`${keyword} ${modifier}`);
        });
        
        // 添加查询词组合
        if (!keyword.toLowerCase().includes(lowerQuery)) {
            combinations.add(`${query} ${keyword}`);
            combinations.add(`${keyword} ${query}`);
        }
    });
    
    return Array.from(combinations).slice(0, 10);
}

// 加载全部标签页
function loadSearchAllTab() {
    const allTab = document.getElementById('searchAllTab');
    if (!allTab) return;
    
    const photosTab = document.getElementById('searchPhotosTab');
    const usersTab = document.getElementById('searchUsersTab');
    const keywordsTab = document.getElementById('searchKeywordsTab');
    
    if (!photosTab || !usersTab || !keywordsTab) return;
    
    let html = '';
    
    // 添加照片部分（如果有）
    if (!photosTab.innerHTML.includes('no-results')) {
        const photosContent = photosTab.innerHTML;
        html += `
            <div class="search-section">
                <h3><i class="fas fa-images"></i> 相关照片</h3>
                ${photosContent}
            </div>
        `;
    }
    
    // 添加用户部分（如果有）
    if (!usersTab.innerHTML.includes('no-results')) {
        const usersContent = usersTab.innerHTML;
        html += `
            <div class="search-section">
                <h3><i class="fas fa-users"></i> 相关用户</h3>
                ${usersContent}
            </div>
        `;
    }
    
    // 添加关键词部分（如果有）
    if (!keywordsTab.innerHTML.includes('no-results')) {
        const keywordsContent = keywordsTab.innerHTML;
        html += `
            <div class="search-section">
                <h3><i class="fas fa-hashtag"></i> 相关关键词</h3>
                ${keywordsContent}
            </div>
        `;
    }
    
    if (!html) {
        html = `
            <div class="no-results" style="text-align:center; padding:3rem;">
                <i class="fas fa-search" style="font-size:3rem; color:var(--text-secondary); margin-bottom:1rem;"></i>
                <h3>没有找到相关结果</h3>
                <p>尝试其他关键词或上传新内容</p>
                <div class="search-suggestions" style="margin-top:2rem;">
                    <h4>搜索建议：</h4>
                    <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;">
                        <button class="keyword" onclick="searchContent('风景')">风景</button>
                        <button class="keyword" onclick="searchContent('人像')">人像</button>
                        <button class="keyword" onclick="searchContent('动物')">动物</button>
                        <button class="keyword" onclick="searchContent('建筑')">建筑</button>
                        <button class="keyword" onclick="searchContent('美食')">美食</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    allTab.innerHTML = html;
}

// 排序搜索照片
function sortSearchPhotos(sortBy, query) {
    if (!window.searchPhotosResults) return;
    
    let sortedPhotos = [...window.searchPhotosResults];
    
    switch (sortBy) {
        case 'recent':
            sortedPhotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'popular':
            sortedPhotos.sort((a, b) => {
                const scoreA = (a.likesCount || 0) + (a.views || 0);
                const scoreB = (b.likesCount || 0) + (b.views || 0);
                return scoreB - scoreA;
            });
            break;
        case 'relevance':
        default:
            sortedPhotos.sort((a, b) => b.matchScore - a.matchScore);
            break;
    }
    
    // 更新显示
    const photosTab = document.getElementById('searchPhotosTab');
    if (!photosTab) return;
    
    let html = `
        <div class="search-stats">
            <p>找到 <strong>${sortedPhotos.length}</strong> 张相关照片</p>
            <div class="search-sort">
                <select onchange="sortSearchPhotos(this.value, '${escapeHtml(query)}')">
                    <option value="relevance" ${sortBy === 'relevance' ? 'selected' : ''}>按相关度</option>
                    <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>按时间</option>
                    <option value="popular" ${sortBy === 'popular' ? 'selected' : ''}>按热度</option>
                </select>
            </div>
        </div>
        <div class="photos-grid search-photos-grid">
    `;
    
    sortedPhotos.slice(0, 20).forEach(photo => {
        html += createSearchPhotoCard(photo);
    });
    
    html += '</div>';
    
    if (sortedPhotos.length > 20) {
        html += `
            <div class="search-more-results">
                <p>还有 ${sortedPhotos.length - 20} 张相关照片</p>
                <button onclick="showAllSearchPhotos('${escapeHtml(query)}')" class="btn-show-more">
                    <i class="fas fa-eye"></i> 查看全部
                </button>
            </div>
        `;
    }
    
    photosTab.innerHTML = html;
}

// 显示所有搜索结果照片
function showAllSearchPhotos(query) {
    if (!window.searchPhotosResults) return;
    
    // 这里可以实现加载更多功能
    // 由于Firestore查询限制，目前只显示前20张
    showNotification('正在加载更多结果...', 'info');
    
    // 可以在这里添加分页加载逻辑
}

// ============================================
// 搜索历史和热门搜索
// ============================================

// 搜索历史管理
function getSearchHistory() {
    try {
        const history = localStorage.getItem('searchHistory');
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('读取搜索历史失败:', error);
        return [];
    }
}

function saveToSearchHistory(query) {
    try {
        let history = getSearchHistory();
        
        // 移除重复项
        history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        
        // 添加到开头
        history.unshift(query);
        
        // 只保留最近20条
        if (history.length > 20) {
            history = history.slice(0, 20);
        }
        
        localStorage.setItem('searchHistory', JSON.stringify(history));
        
    } catch (error) {
        console.error('保存搜索历史失败:', error);
    }
}

function removeFromSearchHistory(query, event) {
    if (event) event.stopPropagation();
    
    try {
        let history = getSearchHistory();
        history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        localStorage.setItem('searchHistory', JSON.stringify(history));
        
        // 重新显示建议
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            handleSearchInput({ target: searchInput });
        }
        
        // 移动端搜索历史
        loadSearchHistory();
        
    } catch (error) {
        console.error('删除搜索历史失败:', error);
    }
}

function clearSearchHistory() {
    if (!confirm('确定要清空搜索历史吗？')) return;
    
    localStorage.removeItem('searchHistory');
    
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            handleSearchInput({ target: searchInput });
        }
    }
    
    // 移动端搜索历史
    loadSearchHistory();
}

// 加载搜索历史（移动端）
function loadSearchHistory() {
    const historyContainer = document.getElementById('mobileSearchHistory');
    if (!historyContainer) return;
    
    const history = getSearchHistory();
    
    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="mobile-search-section">
                <h4><i class="fas fa-history"></i> 搜索历史</h4>
                <p class="empty-history">暂无搜索历史</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="mobile-search-section">
            <div class="section-header">
                <h4><i class="fas fa-history"></i> 搜索历史</h4>
                <button class="clear-all-history" onclick="clearSearchHistory()">清空</button>
            </div>
            <div class="history-list">
    `;
    
    history.forEach((item, index) => {
        html += `
            <div class="history-item">
                <button class="history-content" onclick="selectMobileHistory('${escapeHtml(item)}')">
                    <i class="fas fa-clock"></i>
                    <span>${escapeHtml(item)}</span>
                </button>
                <button class="remove-history" onclick="removeFromSearchHistory('${escapeHtml(item)}', event)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    historyContainer.innerHTML = html;
}

// 选择移动端历史记录
function selectMobileHistory(query) {
    const searchInput = document.getElementById('mobileSearchInput');
    if (searchInput) {
        searchInput.value = query;
        searchInput.focus();
    }
    
    // 显示搜索建议
    showMobileSearchSuggestions(query);
}

// 显示移动端搜索建议
async function showMobileSearchSuggestions(query) {
    const suggestionsContainer = document.getElementById('mobileSearchSuggestions');
    if (!suggestionsContainer) return;
    
    if (!query) {
        suggestionsContainer.innerHTML = '';
        return;
    }
    
    try {
        const suggestions = await getSearchSuggestions(query);
        
        let html = '';
        
        if (suggestions.keywords.length > 0) {
            html += `
                <div class="mobile-search-section">
                    <h4><i class="fas fa-hashtag"></i> 相关关键词</h4>
                    <div class="suggestions-list">
            `;
            
            suggestions.keywords.forEach(keyword => {
                html += `
                    <button class="suggestion-btn" onclick="selectMobileSuggestion('${escapeHtml(keyword)}')">
                        ${escapeHtml(keyword)}
                    </button>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        if (suggestions.users.length > 0) {
            html += `
                <div class="mobile-search-section">
                    <h4><i class="fas fa-users"></i> 相关用户</h4>
                    <div class="users-suggestions">
            `;
            
            suggestions.users.forEach(user => {
                html += `
                    <button class="user-suggestion" onclick="selectMobileUser('${escapeHtml(user.username)}')">
                        <img src="${user.avatar || generateAvatarUrl(user.username)}" 
                             alt="${escapeHtml(user.username)}">
                        <span>${escapeHtml(user.username)}</span>
                    </button>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        suggestionsContainer.innerHTML = html;
        
    } catch (error) {
        console.error('显示移动端搜索建议失败:', error);
    }
}

// 选择移动端建议
function selectMobileSuggestion(text) {
    const searchInput = document.getElementById('mobileSearchInput');
    if (searchInput) {
        searchInput.value = text;
        searchInput.focus();
    }
}

// 选择移动端用户
function selectMobileUser(username) {
    const searchInput = document.getElementById('mobileSearchInput');
    if (searchInput) {
        searchInput.value = username;
        searchInput.focus();
    }
    
    // 直接搜索用户
    setTimeout(() => {
        performMobileSearch();
    }, 100);
}

// 加载热门搜索
async function loadTrendingSearches() {
    const trendingContainer = document.getElementById('mobileSearchTrending');
    if (!trendingContainer) return;
    
    try {
        // 这里可以从服务器获取热门搜索，暂时使用示例数据
        const trendingSearches = [
            '风景', '人像', '动物', '建筑', '美食', 
            '日落', '海滩', '星空', '城市', '自然'
        ];
        
        let html = `
            <div class="mobile-search-section">
                <h4><i class="fas fa-fire"></i> 热门搜索</h4>
                <div class="trending-list">
        `;
        
        trendingSearches.forEach(search => {
            html += `
                <button class="trending-btn" onclick="selectMobileSuggestion('${search}')">
                    ${search}
                </button>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        trendingContainer.innerHTML = html;
        
    } catch (error) {
        console.error('加载热门搜索失败:', error);
    }
}

// ============================================
// 初始化搜索建议
// ============================================

function initSearchSuggestions() {
    const searchContainer = document.querySelector('.nav-search');
    if (!searchContainer) return;
    
    // 创建搜索建议容器
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'searchSuggestions';
    suggestionsContainer.className = 'search-suggestions';
    
    searchContainer.appendChild(suggestionsContainer);
    
    // 点击其他地方关闭建议
    document.addEventListener('click', function(event) {
        if (!searchContainer.contains(event.target)) {
            hideSearchSuggestions();
        }
    });
}

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
window.showMessages = showMessages;
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
window.showSettings = showSettings;
window.showAdminPanel = showAdminPanel;
window.closeEditProfile = closeEditProfile;
window.saveProfileChanges = saveProfileChanges;
window.toggleFollow = toggleFollow;
window.sendMessage = sendMessage;
window.updatePrivacySetting = updatePrivacySetting;
window.updateNotificationSetting = updateNotificationSetting;
window.openConversation = openConversation;
window.startNewConversation = startNewConversation;
window.searchUsersForMessage = searchUsersForMessage;
window.handleMessageKeyPress = handleMessageKeyPress;
window.attachImageToMessage = attachImageToMessage;
window.removeMessageAttachment = removeMessageAttachment;
window.showImageInMessage = showImageInMessage;
window.clearConversation = clearConversation;
window.reportUser = reportUser;
window.blockUser = blockUser;
window.toggleMobileSearch = toggleMobileSearch;
window.clearMobileSearch = clearMobileSearch;
window.performMobileSearch = performMobileSearch;
window.selectSuggestion = selectSuggestion;
window.searchUser = searchUser;
window.removeFromSearchHistory = removeFromSearchHistory;
window.clearSearchHistory = clearSearchHistory;
window.selectMobileHistory = selectMobileHistory;
window.selectMobileSuggestion = selectMobileSuggestion;
window.selectMobileUser = selectMobileUser;
window.sortSearchPhotos = sortSearchPhotos;
window.showAllSearchPhotos = showAllSearchPhotos;

console.log('🚀 应用初始化完成！');