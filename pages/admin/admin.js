const app = getApp();

Page({
    data: {
        isAdmin: false,
        loading: true,
        statistics: {},
        pendingMessages: []
    },

    onLoad() {
        this.checkAdminPermission();
    },

    onShow() {
        if (this.data.isAdmin) {
            this.loadData();
        }
    },

    onPullDownRefresh() {
        this.loadData();
        wx.stopPullDownRefresh();
    },

    // 检查管理员权限
    checkAdminPermission() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/userinfo',
            success: res => {
                const isAdmin = res.data.is_admin || false;
                this.setData({
                    isAdmin: isAdmin,
                    loading: false
                });

                if (isAdmin) {
                    this.loadData();
                }
            },
            fail: err => {
                console.error('获取用户信息失败:', err);
                this.setData({
                    isAdmin: false,
                    loading: false
                });

                // 可能是未登录，跳转到绑定页面
                wx.redirectTo({ url: '/pages/bind/bind' });
            }
        });
    },

    // 加载数据
    loadData() {
        this.loadStatistics();
        this.loadPendingMessages();
    },

    // 加载统计信息
    loadStatistics() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/statistics',
            success: res => {
                this.setData({
                    statistics: res.data
                });
            },
            fail: err => {
                console.error('加载统计信息失败:', err);
            }
        });
    },

    // 加载待审核消息
    loadPendingMessages() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/admin/messages',
            data: {
                page: 1,
                page_size: 5, // 只显示前5条
                status: 'PENDING'
            },
            success: res => {
                this.setData({
                    pendingMessages: res.data.items || []
                });
            },
            fail: err => {
                console.error('加载待审核消息失败:', err);
            }
        });
    },

    // 通过消息
    approveMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateMessageStatus(messageId, 'APPROVED', '通过');
    },

    // 拒绝消息
    rejectMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateMessageStatus(messageId, 'REJECTED', '拒绝');
    },

    // 更新消息状态
    updateMessageStatus(messageId, status, actionText) {
        wx.showModal({
            title: '确认操作',
            content: `确定要${actionText}这条消息吗？`,
            success: (res) => {
                if (res.confirm) {
                    app.globalData.request({
                        url: app.globalData.env.API_BASE_URL + `/api/wall/messages/${messageId}/status`,
                        method: 'PUT',
                        data: { status: status },
                        success: () => {
                            wx.showToast({
                                title: `${actionText}成功`,
                                icon: 'success'
                            });

                            // 刷新数据
                            this.loadData();
                        },
                        fail: (err) => {
                            console.error(`${actionText}失败:`, err);
                            wx.showToast({
                                title: `${actionText}失败`,
                                icon: 'error'
                            });
                        }
                    });
                }
            }
        });
    },

    // 跳转到校园墙管理
    goToWallManage() {
        wx.navigateTo({
            url: '/pages/admin/wall-manage'
        });
    },

    // 跳转到点歌管理
    goToSongManage() {
        wx.navigateTo({
            url: '/pages/admin/song-manage'
        });
    },

    // 返回
    goBack() {
        wx.switchTab({
            url: '/pages/wall/wall'
        });
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
    }
});