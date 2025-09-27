const app = getApp();

Page({
    data: {
        messages: [],
        currentType: 'all', // all, general, lost_and_found, confession, help, announcement
        searchKeyword: '',
        loading: false,
        page: 1,
        hasMore: true,
        isAdmin: false
    },

    onLoad() {
        this.loadMessages();
        this.checkAdminStatus();
    },

    checkAdminStatus() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/userinfo',
            success: res => {
                this.setData({
                    isAdmin: res.data.is_admin || false
                });
            }
        });
    },

    onShow() {
        // 检查绑定状态
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
            success: res => {
                if (!res.data.is_bound) {
                    wx.redirectTo({ url: '/pages/bind/bind' });
                } else {
                    // 重新检查管理员状态
                    this.checkAdminStatus();
                }
            }
        });
    },

    onPullDownRefresh() {
        this.setData({
            page: 1,
            messages: [],
            hasMore: true
        });
        this.loadMessages();
        wx.stopPullDownRefresh();
    },

    onReachBottom() {
        if (this.data.hasMore && !this.data.loading) {
            this.setData({
                page: this.data.page + 1
            });
            this.loadMessages();
        }
    },

    // 加载消息列表
    loadMessages() {
        if (this.data.loading) return;

        this.setData({ loading: true });

        const params = {
            page: this.data.page,
            page_size: 20
        };

        if (this.data.currentType !== 'all') {
            params.message_type = this.data.currentType;
        }

        if (this.data.searchKeyword) {
            params.keyword = this.data.searchKeyword;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/messages',
            data: params,
            success: res => {
                const newMessages = res.data.items || [];
                for (let i = 0; i < newMessages.length; i++) {
                    newMessages[i].vmessage_type = this.getTypeText(newMessages[i].message_type);
                    newMessages[i].vtimestamp = this.formatTime(newMessages[i].timestamp);
                    newMessages[i].vtags = this.parseTags(newMessages[i].tags);
                    newMessages[i].hasimage = newMessages[i].files!=''
                    let uids = newMessages[i].files.split(',')
                    newMessages[i].images = []
                    for (let j = 0; j < uids.length; j++) {
                        newMessages[i].images.push(app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + uids[j])
                    }
                }
                this.setData({
                    messages: this.data.page === 1 ? newMessages : this.data.messages.concat(newMessages),
                    hasMore: res.data.has_next,
                    loading: false
                });
            },
            fail: err => {
                console.error('加载消息失败:', err);
                wx.showToast({
                    title: '加载失败',
                    icon: 'error'
                });
                this.setData({ loading: false });
            }
        });
    },

    // 类型切换
    onTypeChange(e) {
        const type = e.currentTarget.dataset.type;
        this.setData({
            currentType: type,
            page: 1,
            messages: [],
            hasMore: true
        });
        this.loadMessages();
    },

    // 搜索输入
    onSearchInput(e) {
        this.setData({
            searchKeyword: e.detail.value
        });
    },

    // 搜索
    onSearch() {
        this.setData({
            page: 1,
            messages: [],
            hasMore: true
        });
        this.loadMessages();
    },

    // 跳转到发布页面
    goToPost() {
        wx.navigateTo({
            url: '/pages/wall-post/wall-post'
        });
    },

    // 跳转到详情页面
    goToDetail(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/wall-detail/wall-detail?id=${id}`
        });
    },

    // 跳转到管理页面
    navigateToAdmin() {
        wx.navigateTo({ url: '/pages/wall-manage/wall-manage' });
    },

    // 获取类型文本
    getTypeText(type) {
        const typeMap = {
            'general': '普通',
            'lost_and_found': '失物招领',
            'confession': '表白墙',
            'help': '求助',
            'announcement': '公告'
        };
        return typeMap[type] || '未知';
    },

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) { // 1天内
            return Math.floor(diff / 3600000) + '小时前';
        } else if (diff < 2592000000) { // 30天内
            return Math.floor(diff / 86400000) + '天前';
        } else {
            return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        }
    },

    // 解析标签
    parseTags(tags) {
        try {
            if (typeof tags === 'string') {
                return tags.split(',').filter(tag => tag.trim());
            }
            return [];
        } catch (e) {
            return [];
        }
    },

    // 跳转到管理员页面
    goToAdmin() {
        wx.navigateTo({
            url: '/pages/wall-manage/wall-manage'
        });
    }
});