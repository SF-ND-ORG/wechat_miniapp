const app = getApp();

Page({
    data: {
        message: null,
        loading: true,
        error: '',
        liking: false,
        messageId: null,
        messages: [],
        sendMessage: '',
        images: [],
        hasimage: false,
        showDetail: false,
        index: 0,
        srcs: []
    },
    showImg(e) {
        const id = e.currentTarget.dataset.id;
        this.setData({
            showDetail: !this.data.showDetail,
            index: id
        })
    },
    onClose(e) {
        this.setData({
            showDetail: false
        });
    },
    onSend() {
        if (!this.data.sendMessage.trim()) {
            wx.showToast({
                title: '请输入内容',
                icon: 'none'
            });
            return;
        }
        app.globalData.request({
            'url': app.globalData.env.API_BASE_URL + '/api/comment/send',
            method: 'POST',
            data: {
                'content': this.data.sendMessage.trim(),
                'wall_id': parseInt(this.data.messageId)
            },
            success: res => {
                wx.showToast({
                    title: '评论成功，等待审核',
                    icon: 'success'
                });
                this.setData({ 'sendMessage': '' })
            }
        })
        this.loadMessage();
    },
    onSendInput(e) {
        this.setData({
            sendMessage: e.detail.value
        });
    },
    onLoad(options) {
        const { id } = options;
        if (id) {
            this.setData({ messageId: id });
            this.loadMessage();
        } else {
            this.setData({
                loading: false,
                error: '缺少消息ID参数'
            });
        }
    },

    onShow() {
        // 检查绑定状态
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
            success: res => {
                if (!res.data.is_bound) {
                    wx.redirectTo({ url: '/pages/bind/bind' });
                }
            }
        });
    },

    // 加载消息详情
    loadMessage() {
        if (!this.data.messageId) return;

        this.setData({
            loading: true,
            error: ''
        });
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/wall/messages/${this.data.messageId}`,
            success: res => {
                let temp = res.data;
                temp.vtags = this.parseTags(temp.tags);
                temp.vmessage_type = this.getTypeText(temp.message_type);
                temp.vtimestamp = this.formatTime(temp.timestamp);
                temp.vauthor = temp.author_display_name || temp.author_nickname || temp.author_name || '匿名用户'
                temp.author_avatar = temp.author_avatar_url || '/assets/imgs/default-avatar.png'
                let images = [], srcs = []
                const fileString = temp.files || ''
                const uids = fileString ? fileString.split(',').filter(Boolean) : []
                for (let i = 0; i < uids.length; i++) {
                    const src = app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + uids[i]
                    images.push({
                        id: i,
                        src
                    })
                    srcs.push(src)
                }
                this.setData({
                    message: temp,
                    loading: false,
                    images: images,
                    hasimage: uids.length > 0,
                    srcs: srcs
                });
            },
            fail: err => {
                console.error('加载消息详情失败:', err);
                this.setData({
                    loading: false,
                    error: '加载失败，请重试'
                });
            }
        });
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/comment/message?wall_id=${this.data.messageId}`,
            success: res => {
                const items = (res.data.items || []).map(item => {
                    return {
                        ...item,
                        vtimestamp: this.formatTime(item.timestamp),
                        vauthor: item.author_display_name || item.author_nickname || item.author_name || '匿名用户',
                        author_avatar: item.author_avatar_url || '/assets/imgs/default-avatar.png',
                        isPending: item.status === 'PENDING',
                        isRejected: item.status === 'REJECTED'
                    };
                });

                this.setData({
                    messages: items
                });
            },
            fail: err => {
                console.error('加载消息评论失败:', err);
                this.setData({
                    loading: false,
                    error: '加载失败，请重试'
                });
            }
        })
    },

    // 点赞消息
    onLike() {
        if (this.data.liking || !this.data.message) return;

        this.setData({ liking: true });

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + `/api/wall/messages/${this.data.messageId}/like`,
            method: 'POST',
            success: res => {
                // 更新本地数据
                const updatedMessage = { ...this.data.message };
                updatedMessage.like_count = res.data.like_count;

                this.setData({
                    message: updatedMessage,
                    liking: false
                });

                wx.showToast({
                    title: '点赞成功',
                    icon: 'success'
                });
            },
            fail: err => {
                console.error('点赞失败:', err);
                this.setData({ liking: false });
                wx.showToast({
                    title: '点赞失败',
                    icon: 'error'
                });
            }
        });
    },

    // 复制联系方式
    copyContact() {
        if (!this.data.message || !this.data.message.contact_info) return;

        wx.setClipboardData({
            data: this.data.message.contact_info,
            success: () => {
                wx.showToast({
                    title: '已复制到剪贴板',
                    icon: 'success'
                });
            },
            fail: () => {
                wx.showToast({
                    title: '复制失败',
                    icon: 'error'
                });
            }
        });
    },

    // 获取类型文本
    getTypeText(type) {
        const typeMap = {
            'general': '普通',
            'lost_and_found': '失物招领',
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
    }
});
export { };