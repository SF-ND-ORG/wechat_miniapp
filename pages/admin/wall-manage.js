const app = getApp();

Page({
    data: {
        currentStatus: 'PENDING', // PENDING, APPROVED, REJECTED, ALL
        messages: [],
        statistics: {},
        loading: false,
        refreshing: false,
        page: 1,
        hasMore: true
    },

    onLoad() {
        this.loadStatistics();
        this.loadMessages();
    },

    onShow() {
        // 重新加载数据，因为可能在其他地方有更新
        this.refresh();
    },

    // 刷新数据
    refresh() {
        this.setData({
            page: 1,
            messages: [],
            hasMore: true
        });
        this.loadStatistics();
        this.loadMessages();
    },

    // 下拉刷新
    onRefresh() {
        this.setData({ refreshing: true });
        this.refresh();
        setTimeout(() => {
            this.setData({ refreshing: false });
        }, 1000);
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

    // 加载消息列表
    loadMessages() {
        if (this.data.loading || !this.data.hasMore) return;

        this.setData({ loading: true });

        const params = {
            page: this.data.page,
            page_size: 20
        };

        // 根据当前状态筛选
        if (this.data.currentStatus !== 'ALL') {
            params.status = this.data.currentStatus;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/admin/messages',
            data: params,
            success: res => {
                const newMessages = res.data.items || [];
                for(let i = 0; i < newMessages.length; i++){
                  newMessages[i].vmessage_type = this.getTypeText(newMessages[i].message_type);
                  newMessages[i].vtimestamp = this.formatTime(newMessages[i].timestamp);
                  newMessages[i].vstatus = this.getStatusText(newMessages[i].status);
                }
                this.setData({
                    messages: this.data.page === 1 ? newMessages : [...this.data.messages, ...newMessages],
                    hasMore: res.data.has_next || false,
                    page: this.data.page + 1,
                    loading: false
                });
            },
            fail: err => {
                console.error('加载消息失败:', err);
                this.setData({ loading: false });
                wx.showToast({
                    title: '加载失败',
                    icon: 'error'
                });
            }
        });
    },

    // 加载更多
    loadMore() {
        this.loadMessages();
    },

    // 切换状态筛选
    switchStatus(e) {
        const status = e.currentTarget.dataset.status;
        if (status === this.data.currentStatus) return;

        this.setData({
            currentStatus: status,
            page: 1,
            messages: [],
            hasMore: true
        });
        this.loadMessages();
    },

    // 通过消息
    approveMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateMessageStatus(messageId, 'APPROVED');
    },

    // 拒绝消息
    rejectMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateMessageStatus(messageId, 'REJECTED');
    },

    // 删除消息
    deleteMessage(e) {
        const messageId = e.currentTarget.dataset.id;

        wx.showModal({
            title: '确认删除',
            content: '确定要删除这条消息吗？删除后无法恢复。',
            success: res => {
                if (res.confirm) {
                    app.globalData.request({
                        url: app.globalData.env.API_BASE_URL + `/api/wall/messages/${messageId}`,
                        method: 'DELETE',
                        success: () => {
                            wx.showToast({
                                title: '删除成功',
                                icon: 'success'
                            });
                            this.refresh();
                        },
                        fail: err => {
                            console.error('删除消息失败:', err);
                            wx.showToast({
                                title: '删除失败',
                                icon: 'error'
                            });
                        }
                    });
                }
            }
        });
    },

    // 更新消息状态
    updateMessageStatus(messageId, status) {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/wall/messages/${messageId}/status`,
            method: 'PUT',
            data: { status },
            success: () => {
                const actionText = status === 'APPROVED' ? '通过' : '拒绝';
                wx.showToast({
                    title: `${actionText}成功`,
                    icon: 'success'
                });
                this.refresh();
            },
            fail: err => {
                console.error('更新状态失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 获取消息类型文本
    getTypeText(type) {
        const typeMap = {
            'general': '普通',
            'lost_and_found': '失物',
            'confession': '表白',
            'help': '求助',
            'announcement': '公告'
        };
        return typeMap[type] || type;
    },

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            'PENDING': '待审核',
            'APPROVED': '已通过',
            'REJECTED': '已拒绝',
            'DELETED': '已删除'
        };
        return statusMap[status] || status;
    },

    // 格式化时间
    formatTime(timeStr) {
        const date = new Date(timeStr);
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
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
    },

    // 返回
    goBack() {
        wx.navigateBack();
    }
});