const app = getApp();

Page({
    data: {
        messageType: 'general',
        title: '',
        content: '',
        contactInfo: '',
        location: '',
        tags: '',
        submitting: false,
        files: [],
        uids: []
    },
    handleAdd(e) {
        e.detail.files.forEach(file => this.uploadFile(file))
    },

    uploadFile(file) {
        wx.uploadFile({
            url: app.globalData.env.API_BASE_URL + '/api/resources/image?extension=' + file.url.split('.').at(-1),
            filePath: file.url,
            name: 'file',
            success: res => {
                const uid = JSON.parse(res.data).uid
                this.setData({
                    uids: [...this.data.uids, uid],
                    files: [...this.data.files, {
                        url: app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + uid,
                        status: 'done'
                    }]
                })
            },
            fail: res => {
                this.setData({
                    files: [...this.data.files, {
                        url: file.url,
                        status: 'failed'
                    }]
                })
            }
        })
    },
    handleRemove(e) {
        const { index } = e.detail;
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/resources/image?uid='+this.data.uids[index],
            method: 'DELETE',
            success: res => {
                const {uids,files} = this.data
                uids.splice(index,1)
                files.splice(index,1)
                this.setData({
                    files:files,
                    uids:uids
                })
            }
        })
    },

    onLoad() {
        // 检查绑定状态
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
            success: res => {
                if (!res.data.is_bound) {
                    wx.redirectTo({
                        url: '/pages/bind/bind'
                    });
                }
            }
        });
    },

    // 选择消息类型
    selectType(e) {
        const type = e.currentTarget.dataset.type;
        this.setData({
            messageType: type
        });
    },

    // 标题输入
    onTitleInput(e) {
        this.setData({
            title: e.detail.value
        });
    },

    // 内容输入
    onContentInput(e) {
        this.setData({
            content: e.detail.value
        });
    },

    // 联系方式输入
    onContactInput(e) {
        this.setData({
            contactInfo: e.detail.value
        });
    },

    // 位置输入
    onLocationInput(e) {
        this.setData({
            location: e.detail.value
        });
    },

    // 标签输入
    onTagsInput(e) {
        this.setData({
            tags: e.detail.value
        });
    },

    // 提交表单
    onSubmit() {
        if (!this.data.content.trim()) {
            wx.showToast({
                title: '请输入内容',
                icon: 'error'
            });
            return;
        }

        if (this.data.submitting) return;

        this.setData({
            submitting: true
        });

        // 构建请求数据
        const postData = {
            message_type: this.data.messageType,
            content: this.data.content.trim()
        };

        // 添加可选字段
        if (this.data.title.trim()) {
            postData.title = this.data.title.trim();
        }
        if (this.data.contactInfo.trim()) {
            postData.contact_info = this.data.contactInfo.trim();
        }
        if (this.data.location.trim()) {
            postData.location = this.data.location.trim();
        }
        if (this.data.tags.trim()) {
            postData.tags = this.data.tags.trim();
            postData.tags = postData.tags.split('，').join(',');
        }
        postData.files = this.data.uids.join(',')
        // 发布消息
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wall/messages',
            method: 'POST',
            data: postData,
            success: res => {
                wx.showToast({
                    title: '发布成功，等待审核',
                    icon: 'success'
                });

                // 返回上一页并刷新
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            },
            fail: err => {
                console.error('发布失败:', err);
                wx.showToast({
                    title: '发布失败',
                    icon: 'error'
                });
                this.setData({
                    submitting: false
                });
            }
        });
    }
});