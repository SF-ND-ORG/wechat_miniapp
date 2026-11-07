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
        maxCount: 9
    },

    chooseImage() {
        const remain = this.data.maxCount - this.data.files.length;
        if (remain <= 0) return;
        wx.chooseMedia({
            count: remain,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: res => {
                res.tempFiles.forEach(item => this.uploadFile(item.tempFilePath));
            }
        });
    },

    uploadFile(tempPath) {
        // 从临时路径安全提取扩展名，仅保留白名单内的图片格式，缺失时默认 png
        const rawExt = (tempPath.split('.').pop() || '').toLowerCase();
        const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const extension = allowed.includes(rawExt) ? rawExt : 'png';
        // 先放一个 loading 占位，下标保持稳定，避免并发上传乱序
        const index = this.data.files.length;
        const files = this.data.files.concat([{ url: tempPath, status: 'loading' }]);
        this.setData({ files });
        app.globalData.uploadFile({
            url: app.globalData.env.API_BASE_URL + '/api/resources/image?extension=' + extension,
            filePath: tempPath,
            name: 'file',
            success: res => {
                let uid = null;
                try {
                    uid = JSON.parse(res.data).uid;
                } catch (e) {
                    uid = null;
                }
                const next = this.data.files.slice();
                if (!uid) {
                    if (next[index]) next[index].status = 'failed';
                    this.setData({ files: next });
                    return;
                }
                next[index] = {
                    url: app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + encodeURIComponent(uid),
                    status: 'done',
                    uid: uid
                };
                this.setData({ files: next });
            },
            fail: () => {
                const next = this.data.files.slice();
                if (next[index]) next[index].status = 'failed';
                this.setData({ files: next });
            }
        });
    },

    previewImage(e) {
        const index = e.currentTarget.dataset.index;
        const urls = this.data.files
            .filter(f => f.status !== 'failed')
            .map(f => f.url);
        const current = this.data.files[index] ? this.data.files[index].url : '';
        if (!urls.length || !current) return;
        wx.previewImage({ urls, current });
    },

    handleRemove(e) {
        const index = e.currentTarget.dataset.index;
        const file = this.data.files[index];
        if (!file) return;
        const applyRemove = () => {
            const files = this.data.files.slice();
            files.splice(index, 1);
            this.setData({ files });
        };
        if (file.uid) {
            app.globalData.request({
                url: app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + encodeURIComponent(file.uid),
                method: 'DELETE',
                success: applyRemove,
                fail: applyRemove
            });
        } else {
            applyRemove();
        }
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
        postData.files = this.data.files
            .filter(f => f.uid)
            .map(f => f.uid)
            .join(',')
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