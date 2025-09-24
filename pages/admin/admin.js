const app = getApp();

Page({
    data: {
        isAdmin: false,
        loading: true,
    },

    onLoad() {
        this.checkAdminPermission();
    },

    onShow() {
    },

    onPullDownRefresh() {
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

    

    
    // 跳转到校园墙管理
    goToWallManage() {
        wx.navigateTo({
            url: '/pages/admin/wall-manage'
        });
    },

    // 返回
    goBack() {
        wx.switchTab({
            url: '/pages/wall/wall'
        });
    },
});