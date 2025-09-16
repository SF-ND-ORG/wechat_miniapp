const app = getApp();

Page({
    data: {
        currentSong: null,
        queueList: [],
        historyList: [],
        reviewList: [],
        queueCount: 0,
        totalRequests: 0,
        isPlaying: false,
        shuffleMode: false,
        historyFilter: 'all',
        reviewFilter: 'pending',
        refreshing: false,
        refreshingReview: false,
        loadingHistory: false,
        loadingReview: false,
        hasMoreHistory: true,
        hasMoreReviews: true,
        historyPage: 1,
        reviewPage: 1,
        // 审核相关
        showRejectModal: false,
        rejectReason: '',
        currentRejectId: null
    },

    onLoad() {
        this.loadCurrentSong();
        this.loadQueue();
        this.loadHistory();
        this.loadReviewList();
        this.loadStatistics();
    },

    onShow() {
        // 重新加载数据
        this.refresh();
    },

    // 刷新数据
    refresh() {
        this.loadCurrentSong();
        this.loadQueue();
        this.refreshHistory();
        this.refreshReviewList();
        this.loadStatistics();
    },

    // 下拉刷新
    onRefresh() {
        this.setData({ refreshing: true });
        this.refresh();
        setTimeout(() => {
            this.setData({ refreshing: false });
        }, 1000);
    },

    // 加载当前播放歌曲
    loadCurrentSong() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/player/current',
            success: res => {
                this.setData({
                    currentSong: res.data.current_song || null,
                    isPlaying: res.data.is_playing || false
                });
            },
            fail: err => {
                console.error('加载当前歌曲失败:', err);
            }
        });
    },

    // 加载播放队列
    loadQueue() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/player/queue',
            success: res => {
                this.setData({
                    queueList: res.data.queue || [],
                    queueCount: res.data.queue ? res.data.queue.length : 0
                });
            },
            fail: err => {
                console.error('加载播放队列失败:', err);
            }
        });
    },

    // 刷新历史记录
    refreshHistory() {
        this.setData({
            historyPage: 1,
            historyList: [],
            hasMoreHistory: true
        });
        this.loadHistory();
    },

    // 加载点歌历史
    loadHistory() {
        if (this.data.loadingHistory || !this.data.hasMoreHistory) return;

        this.setData({ loadingHistory: true });

        const params = {
            page: this.data.historyPage,
            page_size: 20
        };

        // 如果是今日筛选，添加日期参数
        if (this.data.historyFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            params.date = today;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/songs/admin/history',
            data: params,
            success: res => {
                const newHistory = res.data.items || [];
                this.setData({
                    historyList: this.data.historyPage === 1 ? newHistory : [...this.data.historyList, ...newHistory],
                    hasMoreHistory: res.data.has_next || false,
                    historyPage: this.data.historyPage + 1,
                    loadingHistory: false
                });
            },
            fail: err => {
                console.error('加载点歌历史失败:', err);
                this.setData({ loadingHistory: false });
            }
        });
    },

    // 加载更多历史记录
    loadMoreHistory() {
        this.loadHistory();
    },

    // 加载统计信息
    loadStatistics() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/songs/admin/statistics',
            success: res => {
                this.setData({
                    totalRequests: res.data.total_requests || 0
                });
            },
            fail: err => {
                console.error('加载统计信息失败:', err);
            }
        });
    },

    // 跳过当前歌曲
    skipSong() {
        wx.showModal({
            title: '确认跳过',
            content: '确定要跳过当前歌曲吗？',
            success: res => {
                if (res.confirm) {
                    app.globalData.request({
                        url: app.globalData.env.API_BASE_URL + '/api/player/skip',
                        method: 'POST',
                        success: () => {
                            wx.showToast({
                                title: '已跳过',
                                icon: 'success'
                            });
                            this.refresh();
                        },
                        fail: err => {
                            console.error('跳过歌曲失败:', err);
                            wx.showToast({
                                title: '操作失败',
                                icon: 'error'
                            });
                        }
                    });
                }
            }
        });
    },

    // 清空播放队列
    clearQueue() {
        wx.showModal({
            title: '确认清空',
            content: '确定要清空播放队列吗？',
            success: res => {
                if (res.confirm) {
                    app.globalData.request({
                        url: app.globalData.env.API_BASE_URL + '/api/player/queue/clear',
                        method: 'POST',
                        success: () => {
                            wx.showToast({
                                title: '队列已清空',
                                icon: 'success'
                            });
                            this.loadQueue();
                        },
                        fail: err => {
                            console.error('清空队列失败:', err);
                            wx.showToast({
                                title: '操作失败',
                                icon: 'error'
                            });
                        }
                    });
                }
            }
        });
    },

    // 设置优先级（置顶）
    setPriority(e) {
        const songId = e.currentTarget.dataset.id;
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/player/queue/${songId}/priority`,
            method: 'PUT',
            success: () => {
                wx.showToast({
                    title: '已置顶',
                    icon: 'success'
                });
                this.loadQueue();
            },
            fail: err => {
                console.error('设置优先级失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 从队列中移除
    removeFromQueue(e) {
        const songId = e.currentTarget.dataset.id;
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/player/queue/${songId}`,
            method: 'DELETE',
            success: () => {
                wx.showToast({
                    title: '已移除',
                    icon: 'success'
                });
                this.loadQueue();
            },
            fail: err => {
                console.error('移除歌曲失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 切换历史记录筛选
    switchHistoryFilter(e) {
        const filter = e.currentTarget.dataset.filter;
        if (filter === this.data.historyFilter) return;

        this.setData({
            historyFilter: filter
        });
        this.refreshHistory();
    },

    // 暂停/播放
    pausePlay() {
        const action = this.data.isPlaying ? 'pause' : 'play';
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/player/${action}`,
            method: 'POST',
            success: () => {
                this.setData({
                    isPlaying: !this.data.isPlaying
                });
                wx.showToast({
                    title: this.data.isPlaying ? '已播放' : '已暂停',
                    icon: 'success'
                });
            },
            fail: err => {
                console.error('播放控制失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 下一首
    nextSong() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/player/next',
            method: 'POST',
            success: () => {
                wx.showToast({
                    title: '下一首',
                    icon: 'success'
                });
                this.refresh();
            },
            fail: err => {
                console.error('切换歌曲失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 切换随机播放
    toggleShuffle() {
        const newShuffleMode = !this.data.shuffleMode;
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/player/shuffle',
            method: 'PUT',
            data: { enabled: newShuffleMode },
            success: () => {
                this.setData({
                    shuffleMode: newShuffleMode
                });
                wx.showToast({
                    title: newShuffleMode ? '已开启随机' : '已关闭随机',
                    icon: 'success'
                });
            },
            fail: err => {
                console.error('切换随机模式失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            'pending': '排队中',
            'playing': '播放中',
            'completed': '已完成',
            'skipped': '已跳过',
            'removed': '已移除'
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
        } else {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hour = date.getHours().toString().padStart(2, '0');
            const minute = date.getMinutes().toString().padStart(2, '0');

            if (diff < 86400000 * 7) { // 一周内显示星期
                const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                return `${weekdays[date.getDay()]} ${hour}:${minute}`;
            } else {
                return `${month}/${day} ${hour}:${minute}`;
            }
        }
    },

    // 加载审核列表
    loadReviewList() {
        if (this.data.loadingReview || !this.data.hasMoreReviews) return;

        this.setData({ loadingReview: true });

        const params = {
            page: this.data.reviewPage,
            page_size: 20
        };

        // 根据筛选条件添加状态参数
        if (this.data.reviewFilter !== 'all') {
            params.status = this.data.reviewFilter;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/songs/admin/pending',
            data: params,
            success: res => {
                const newReviews = res.data.items || [];
                this.setData({
                    reviewList: this.data.reviewPage === 1 ? newReviews : [...this.data.reviewList, ...newReviews],
                    hasMoreReviews: res.data.has_next || false,
                    reviewPage: this.data.reviewPage + 1,
                    loadingReview: false
                });
            },
            fail: err => {
                console.error('加载审核列表失败:', err);
                this.setData({ loadingReview: false });
            }
        });
    },

    // 刷新审核列表
    refreshReviewList() {
        this.setData({
            reviewPage: 1,
            reviewList: [],
            hasMoreReviews: true
        });
        this.loadReviewList();
    },

    // 加载更多审核记录
    loadMoreReviews() {
        this.loadReviewList();
    },

    // 下拉刷新审核列表
    onRefreshReview() {
        this.setData({ refreshingReview: true });
        this.refreshReviewList();
        setTimeout(() => {
            this.setData({ refreshingReview: false });
        }, 1000);
    },

    // 切换审核筛选
    switchReviewFilter(e) {
        const filter = e.currentTarget.dataset.filter;
        if (filter === this.data.reviewFilter) return;

        this.setData({
            reviewFilter: filter
        });
        this.refreshReviewList();
    },

    // 通过歌曲
    approveSong(e) {
        const songId = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认通过',
            content: '确定要通过这首歌曲吗？',
            success: res => {
                if (res.confirm) {
                    this.reviewSong(songId, 'approved', '');
                }
            }
        });
    },

    // 拒绝歌曲
    rejectSong(e) {
        const songId = e.currentTarget.dataset.id;
        this.setData({
            currentRejectId: songId,
            showRejectModal: true,
            rejectReason: ''
        });
    },

    // 隐藏拒绝弹窗
    hideRejectModal() {
        this.setData({
            showRejectModal: false,
            currentRejectId: null,
            rejectReason: ''
        });
    },

    // 阻止弹窗关闭
    preventModalClose() {
        // 空函数，阻止事件冒泡
    },

    // 输入拒绝理由
    onReasonInput(e) {
        this.setData({
            rejectReason: e.detail.value
        });
    },

    // 确认拒绝
    confirmReject() {
        this.reviewSong(this.data.currentRejectId, 'rejected', this.data.rejectReason);
        this.hideRejectModal();
    },

    // 执行审核
    reviewSong(songId, status, reason) {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/songs/admin/review/${songId}`,
            method: 'PUT',
            data: {
                status: status,
                reason: reason
            },
            success: () => {
                const actionText = status === 'approved' ? '通过' : '拒绝';
                wx.showToast({
                    title: `${actionText}成功`,
                    icon: 'success'
                });
                // 刷新审核列表和统计数据
                this.refreshReviewList();
                this.loadStatistics();
                // 如果是通过的歌曲，刷新播放队列
                if (status === 'approved') {
                    this.loadQueue();
                }
            },
            fail: err => {
                console.error('审核失败:', err);
                const actionText = status === 'approved' ? '通过' : '拒绝';
                wx.showToast({
                    title: `${actionText}失败`,
                    icon: 'error'
                });
            }
        });
    },

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            'pending': '待审核',
            'approved': '已通过',
            'rejected': '已拒绝',
            'played': '已播放'
        };
        return statusMap[status] || status;
    },

    // 返回
    goBack() {
        wx.navigateBack();
    }
});