const app = getApp();

Page({
    data: {
        activeTab: 'wall',
        tabList: [
            { key: 'wall', label: '留言审核' },
            { key: 'comment', label: '评论审核' },
            { key: 'song', label: '点歌审核' }
        ],
        tabTitles: {
            wall: '留言板管理',
            comment: '评论审核',
            song: '点歌审核'
        },
        refreshing: false,
        wall: {
            currentStatus: 'PENDING',
            messages: [],
            statistics: {},
            loading: false,
            page: 1,
            hasMore: true
        },
        comment: {
            currentStatus: 'PENDING',
            items: [],
            loading: false
        },
        song: {
            currentStatus: 'pending',
            items: [],
            loading: false,
            page: 1,
            hasMore: true,
            statistics: {}
        }
    },

    onLoad() {
        this.refresh();
        this._hasLoaded = true;
    },

    onShow() {
        if (this._hasLoaded) {
            this.refresh();
        }
    },

    switchTab(e) {
        const key = e.currentTarget.dataset.key;
        if (!key || key === this.data.activeTab) {
            return;
        }

        this.setData({ activeTab: key });
        this.stopRefreshing();

        if (key === 'wall' && this.data.wall.messages.length === 0) {
            this.loadWallStatistics();
            this.loadWallMessages();
        }

        if (key === 'comment' && this.data.comment.items.length === 0) {
            this.loadCommentMessages();
        }

        if (key === 'song' && this.data.song.items.length === 0) {
            this.loadSongStatistics();
            this.loadSongRequests();
        }
    },

    refresh(showRefresher = false) {
        if (showRefresher) {
            this.setData({ refreshing: true });
        }

        const tab = this.data.activeTab;
        if (tab === 'wall') {
            this.setData({
                'wall.page': 1,
                'wall.messages': [],
                'wall.hasMore': true
            });
            this.loadWallStatistics();
            this.loadWallMessages(() => this.stopRefreshing());
        } else if (tab === 'comment') {
            this.loadCommentMessages(() => this.stopRefreshing());
        } else if (tab === 'song') {
            this.setData({
                'song.page': 1,
                'song.items': [],
                'song.hasMore': true
            });
            this.loadSongStatistics();
            this.loadSongRequests(() => this.stopRefreshing());
        }
    },

    onRefresh() {
        this.refresh(true);
    },

    stopRefreshing() {
        if (this.data.refreshing) {
            this.setData({ refreshing: false });
        }
    },

    loadWallStatistics() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/statistics',
            success: res => {
                this.setData({ 'wall.statistics': res.data });
            },
            fail: err => {
                console.error('加载统计信息失败:', err);
            }
        });
    },

    loadWallMessages(onComplete) {
        if (this.data.wall.loading) {
            if (onComplete) onComplete();
            return;
        }

        const hasMore = this.data.wall.hasMore;
        const currentPage = this.data.wall.page;
        if (!hasMore && currentPage !== 1) {
            if (onComplete) onComplete();
            return;
        }

        this.setData({ 'wall.loading': true });

        const params = {
            page: currentPage,
            page_size: 20
        };

        if (this.data.wall.currentStatus !== 'ALL') {
            params.status = this.data.wall.currentStatus;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/admin/messages',
            data: params,
            success: res => {
                const newMessages = (res.data.items || []).map(item => {
                    const message = { ...item };
                    message.vmessage_type = this.getTypeText(message.message_type);
                    message.vtimestamp = this.formatTime(message.timestamp);
                    message.vstatus = this.getWallStatusText(message.status);
                    message.statusClass = (message.status || '').toUpperCase();
                    const files = message.files || '';
                    message.hasimage = files !== '';
                    message.images = [];
                    if (message.hasimage) {
                        const uids = files.split(',').filter(Boolean);
                        message.images = uids.map(uid => app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + uid);
                    }
                    return message;
                });

                if (currentPage === 1) {
                    this.setData({ 'wall.messages': newMessages });
                } else {
                    this.setData({ 'wall.messages': this.data.wall.messages.concat(newMessages) });
                }

                this.setData({
                    'wall.hasMore': res.data.has_next || false,
                    'wall.page': currentPage + 1
                });
            },
            fail: err => {
                console.error('加载消息失败:', err);
                wx.showToast({
                    title: '加载失败',
                    icon: 'error'
                });
            },
            complete: () => {
                this.setData({ 'wall.loading': false });
                if (onComplete) onComplete();
            }
        });
    },

    switchWallStatus(e) {
        const status = e.currentTarget.dataset.status;
        if (!status || status === this.data.wall.currentStatus) {
            return;
        }

        this.setData({
            'wall.currentStatus': status,
            'wall.page': 1,
            'wall.messages': [],
            'wall.hasMore': true
        });
        this.loadWallMessages();
    },

    approveWallMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateWallMessageStatus(messageId, 'APPROVED');
    },

    rejectWallMessage(e) {
        const messageId = e.currentTarget.dataset.id;
        this.updateWallMessageStatus(messageId, 'REJECTED');
    },

    deleteWallMessage(e) {
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

    updateWallMessageStatus(messageId, status) {
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

    loadCommentMessages(onComplete) {
        if (this.data.comment.loading) {
            if (onComplete) onComplete();
            return;
        }

        this.setData({ 'comment.loading': true });

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/comment/message',
            data: {
                status: this.data.comment.currentStatus
            },
            success: res => {
                const items = (res.data.items || []).map(item => {
                    const comment = { ...item };
                    comment.vstatus = this.getWallStatusText(comment.status);
                    comment.vtimestamp = this.formatTime(comment.timestamp);
                    comment.statusClass = comment.status || '';
                    return comment;
                });
                this.setData({ 'comment.items': items });
            },
            fail: err => {
                console.error('加载评论失败:', err);
                wx.showToast({
                    title: '加载失败',
                    icon: 'error'
                });
            },
            complete: () => {
                this.setData({ 'comment.loading': false });
                if (onComplete) onComplete();
            }
        });
    },

    switchCommentStatus(e) {
        const status = e.currentTarget.dataset.status;
        if (!status || status === this.data.comment.currentStatus) {
            return;
        }

        this.setData({ 'comment.currentStatus': status });
        this.loadCommentMessages();
    },

    approveComment(e) {
        const commentId = e.currentTarget.dataset.id;
        this.updateCommentStatus(commentId, 'APPROVED');
    },

    rejectComment(e) {
        const commentId = e.currentTarget.dataset.id;
        this.updateCommentStatus(commentId, 'REJECTED');
    },

    deleteComment(e) {
        const commentId = e.currentTarget.dataset.id;

        wx.showModal({
            title: '确认删除',
            content: '删除后不可恢复，是否继续？',
            success: res => {
                if (res.confirm) {
                    app.globalData.request({
                        url: app.globalData.env.API_BASE_URL + `/api/comment/delete?commentid=${commentId}`,
                        method: 'DELETE',
                        success: () => {
                            wx.showToast({
                                title: '删除成功',
                                icon: 'success'
                            });
                            this.loadCommentMessages();
                        },
                        fail: err => {
                            console.error('删除评论失败:', err);
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

    updateCommentStatus(commentId, status) {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/comment/status/${commentId}`,
            method: 'PUT',
            data: { status },
            success: () => {
                const actionText = status === 'APPROVED' ? '通过' : '拒绝';
                wx.showToast({
                    title: `${actionText}成功`,
                    icon: 'success'
                });
                this.loadCommentMessages();
            },
            fail: err => {
                console.error('更新评论状态失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    loadSongStatistics() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/songs/admin/statistics',
            success: res => {
                this.setData({ 'song.statistics': res.data });
            },
            fail: err => {
                console.error('加载歌曲统计失败:', err);
            }
        });
    },

    loadSongRequests(onComplete) {
        if (this.data.song.loading) {
            if (onComplete) onComplete();
            return;
        }

        const hasMore = this.data.song.hasMore;
        const currentPage = this.data.song.page;
        if (!hasMore && currentPage !== 1) {
            if (onComplete) onComplete();
            return;
        }

        this.setData({ 'song.loading': true });

        const params = {
            page: currentPage,
            page_size: 20
        };

        if (this.data.song.currentStatus !== 'all') {
            params.status = this.data.song.currentStatus;
        }

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/songs/admin/pending',
            data: params,
            success: res => {
                const newItems = (res.data.items || []).map(item => {
                    const song = { ...item };
                    const parsed = this.parseSongName(song.song_name || '');
                    song.displayTitle = parsed.title;
                    song.displayArtist = parsed.artist;
                    song.vstatus = this.getSongStatusText(song.status);
                    song.statusClass = (song.status || '').toUpperCase();
                    song.vtime = this.formatTime(song.request_time);
                    song.requester = song.user_name ? `${song.user_name}${song.user_student_id ? ' (' + song.user_student_id + ')' : ''}` : '未知用户';
                    return song;
                });

                if (currentPage === 1) {
                    this.setData({ 'song.items': newItems });
                } else {
                    this.setData({ 'song.items': this.data.song.items.concat(newItems) });
                }

                this.setData({
                    'song.hasMore': res.data.has_next || false,
                    'song.page': currentPage + 1
                });
            },
            fail: err => {
                console.error('加载点歌请求失败:', err);
                wx.showToast({
                    title: '加载失败',
                    icon: 'error'
                });
            },
            complete: () => {
                this.setData({ 'song.loading': false });
                if (onComplete) onComplete();
            }
        });
    },

    switchSongStatus(e) {
        const status = e.currentTarget.dataset.status;
        if (!status || status === this.data.song.currentStatus) {
            return;
        }

        this.setData({
            'song.currentStatus': status,
            'song.page': 1,
            'song.items': [],
            'song.hasMore': true
        });
        this.loadSongRequests();
    },

    approveSong(e) {
        const id = e.currentTarget.dataset.id;
        this.reviewSong(id, 'approved');
    },

    rejectSong(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '拒绝理由',
            content: '请输入拒绝理由（可选）',
            editable: true,
            placeholderText: '可填写拒绝原因',
            success: res => {
                if (res.confirm) {
                    const reason = res.content || '';
                    this.reviewSong(id, 'rejected', reason);
                }
            }
        });
    },

    reviewSong(id, status, reason = '') {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/songs/admin/review/${id}`,
            method: 'PUT',
            data: { status, reason },
            success: () => {
                const actionText = status === 'approved' ? '通过' : '拒绝';
                wx.showToast({
                    title: `${actionText}成功`,
                    icon: 'success'
                });
                this.setData({
                    'song.page': 1,
                    'song.items': [],
                    'song.hasMore': true
                });
                this.loadSongStatistics();
                this.loadSongRequests();
            },
            fail: err => {
                console.error('审核歌曲失败:', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'error'
                });
            }
        });
    },

    loadMore() {
        const tab = this.data.activeTab;
        if (tab === 'wall') {
            this.loadWallMessages();
        } else if (tab === 'song') {
            this.loadSongRequests();
        }
    },

    getTypeText(type) {
        const typeMap = {
            general: '普通',
            lost_and_found: '失物',
            help: '求助',
            announcement: '公告'
        };
        return typeMap[type] || type || '未知';
    },

    getWallStatusText(status) {
        const statusMap = {
            PENDING: '待审核',
            APPROVED: '已通过',
            REJECTED: '已拒绝',
            DELETED: '已删除'
        };
        return statusMap[status] || status || '';
    },

    getSongStatusText(status) {
        const statusMap = {
            pending: '待审核',
            approved: '已通过',
            rejected: '已拒绝',
            played: '已播放'
        };
        return statusMap[status] || status || '';
    },

    parseSongName(name) {
        if (typeof name !== 'string') {
            return { title: '', artist: '' };
        }
        if (name.indexOf(' - ') !== -1) {
            const parts = name.split(' - ');
            if (parts.length >= 2) {
                return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
            }
        }
        return { title: name, artist: '' };
    },

    formatTime(timeStr) {
        if (!timeStr) {
            return '';
        }
        const date = new Date(timeStr);
        if (Number.isNaN(date.getTime())) {
            return timeStr;
        }
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) {
            return '刚刚';
        }
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        }
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        }
        if (diff < 2592000000) {
            return Math.floor(diff / 86400000) + '天前';
        }
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
});