Page({
    data: { isSubmitting: false },
    onSubmit(e) {
        const { student_id, name } = e.detail.value;
        if (!student_id || !name) {
            wx.showToast({ title: '请输入完整信息', icon: 'none' });
            return;
        }
        this.setData({ isSubmitting: true });
        const token = wx.getStorageSync('token');
        wx.request({
            url: 'http://127.0.0.1:8000/api/wechat/bind',
            method: 'POST',
            data: { student_id, name },
            header: { 'Authorization': 'Bearer ' + token },
            success: res => {
                const msg = res.data.msg || (res.data.success ? "绑定成功" : res.data.detail);
                wx.showToast({ title: msg, icon: res.data.success ? 'success' : 'none' });
                if (res.data.success) {
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
        })
    }
})