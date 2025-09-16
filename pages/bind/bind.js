const app = getApp();
Page({
    data: { isSubmitting: false },

    onLoad() {
        // 检查用户是否已经绑定
        this.checkBindStatus();
    },

    checkBindStatus() {
        // 检查本地存储或通过API检查绑定状态
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo && userInfo.student_id) {
            // 用户已绑定，自动跳转到搜索页
            wx.redirectTo({
                url: '/pages/songrequest/songrequest'
            });
            return;
        }

        // 如果本地没有信息，通过API检查
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/user',
            method: 'GET',
            success: res => {
                if (res.data.success && res.data.data && res.data.data.student_id) {
                    // 用户已绑定，保存到本地存储并跳转
                    wx.setStorageSync('userInfo', res.data.data);
                    wx.redirectTo({
                        url: '/pages/songrequest/songrequest'
                    });
                }
            },
            fail: () => {
                // API调用失败，留在绑定页面
                console.log('检查绑定状态失败');
            }
        });
    },

    onSubmit(e) {
        const { student_id, name } = e.detail.value;
        if (!student_id || !name) {
            wx.showToast({ title: '请输入完整信息', icon: 'none' });
            return;
        }
        this.setData({ isSubmitting: true });

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/bind',
            method: 'POST',
            data: { student_id, name },
            success: res => {
                const msg = res.data.msg || (res.data.success ? "绑定成功" : res.data.detail);
                wx.showToast({ title: msg, icon: res.data.success ? 'success' : 'none' });
                if (res.data.success) {
                    // 保存用户信息到本地存储
                    wx.setStorageSync('userInfo', {
                        student_id: student_id,
                        name: name,
                        bindTime: new Date().getTime()
                    });

                    setTimeout(() => {
                        wx.redirectTo({ url: '/pages/songrequest/songrequest' });
                    }, 800);
                }
            },
            fail: () => {
                wx.showToast({ title: '网络错误', icon: 'none' });
            },
            complete: () => {
                this.setData({ isSubmitting: false });
            }
        });
    }
})